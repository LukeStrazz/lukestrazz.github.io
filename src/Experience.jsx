/**
 * Experience.jsx
 * ----------------------------------------------------------------------------
 * The full-screen 3D layer that sits behind the entire site.
 *
 * A cinematic black hole in a black-and-gold nebula:
 *
 *   <Experience>             Canvas + shared intro timeline
 *   ├── <IntroDirector>      drives the 0→1 intro progress every frame
 *   ├── <CameraRig>          cinematic pull-back on load, then scroll + mouse
 *   ├── <NebulaBackdrop>     fullscreen shader — swirling gold nebula + stars
 *   ├── <SceneRig>           rotates the composition as the page scrolls
 *   │   └── <BlackHole>      event horizon, accretion disk, photon rim, glow
 *   │       └── <VortexParticles>  Keplerian swirl of gold dust around the hole
 *   └── <DustField>          CPU particle simulation that reacts to the mouse
 *
 * Everything respects `reducedEffects` (small screens, touch devices,
 * prefers-reduced-motion) by lowering counts, octaves, and motion.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/* ------------------------------- palette --------------------------------- */

const GOLD = {
  bright: '#f7d98c', // highlight gold
  rich: '#d4a23d', // primary metal tone
  deep: '#7a5316', // shadowed gold / emissive base
  glow: '#ffeebc', // near-white warm glow
  ink: '#030303' // the void
};

/* ------------------------------ intro timing ------------------------------ */

const INTRO_DURATION = 4.4; // seconds of camera pull-back on first load
const INTRO_DURATION_REDUCED = 2.0;

/** easeOutQuart — fast ignition, long graceful settle. */
const easeIntro = (t) => 1 - Math.pow(1 - t, 4);

/**
 * Computes intro progress (0→1) once per frame into a shared ref so every
 * component (camera, shaders, particles) stays perfectly in sync without
 * re-rendering React.
 */
function IntroDirector({ intro, reducedEffects }) {
  useFrame((state) => {
    const duration = reducedEffects ? INTRO_DURATION_REDUCED : INTRO_DURATION;
    intro.current = easeIntro(Math.min(state.clock.elapsedTime / duration, 1));
  });
  return null;
}

/* --------------------------- shared page state ---------------------------- */

/**
 * Tracks normalized pointer position (-1..1, y up) and page scroll progress
 * (0..1) in refs so the render loop can read them without re-rendering React.
 */
function usePageMotion(reducedEffects) {
  const pointer = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);

  useEffect(() => {
    const onPointerMove = (event) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      scroll.current = window.scrollY / max;
    };

    onScroll();
    if (!reducedEffects) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reducedEffects]);

  return { pointer, scroll };
}

/* ------------------------------ shader chunks ----------------------------- */

/** Value noise + fbm shared by the nebula and accretion disk shaders. */
const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVES; i += 1) {
      value += amplitude * noise(p);
      p = p * 2.03 + 17.31;
      amplitude *= 0.55;
    }
    return value;
  }
`;

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ----------------------------- nebula backdrop ---------------------------- */

const NEBULA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  varying vec2 vUv;

  ${'${NOISE}'}

  void main() {
    // Centered coords matching the 64x36 plane's aspect.
    vec2 p = (vUv - 0.5) * vec2(4.57, 2.57);
    float r = length(p);

    // Swirl: rotation grows toward the center, so the whole cloud appears
    // to be dragged around the hole like water around a drain.
    float swirl = 1.9 / (r + 0.4) - uTime * 0.022;
    float c = cos(swirl);
    float s = sin(swirl);
    vec2 q = mat2(c, -s, s, c) * p;

    // Two fbm layers, the second warped by the first for filament detail.
    float n1 = fbm(q * 1.5 + vec2(0.0, uTime * 0.012));
    float n2 = fbm(q * 3.1 - uTime * 0.008 + n1 * 1.4);
    float neb = pow(max(n1 * 0.55 + n2 * 0.6 - 0.35, 0.0) * 1.6, 1.5);

    // The hole owns the very center; clouds thin out toward the edges.
    neb *= smoothstep(0.10, 0.55, r);
    neb *= smoothstep(2.7, 1.0, r);

    vec3 color = vec3(0.012, 0.009, 0.006);
    color += vec3(0.38, 0.23, 0.07) * neb;                  // deep gold clouds
    color += vec3(1.0, 0.85, 0.55) * pow(neb, 2.6) * 0.55;  // hot filaments

    // Sparse twinkling starfield on a hash grid.
    vec2 cell = floor(vUv * vec2(300.0, 170.0));
    float star = hash(cell);
    if (star > 0.996) {
      vec2 f = fract(vUv * vec2(300.0, 170.0)) - 0.5;
      float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + star * 4.0) + star * 40.0);
      color += vec3(1.0, 0.95, 0.8) * smoothstep(0.5, 0.05, length(f)) * twinkle * 0.85;
    }

    gl_FragColor = vec4(color * uIntro, 1.0);
  }
`;

/** Giant shader plane far behind the scene — the nebula and the stars. */
function NebulaBackdrop({ intro, reducedEffects }) {
  const material = useRef(null);

  const fragmentShader = useMemo(
    () =>
      `#define OCTAVES ${reducedEffects ? 3 : 5}\n` +
      NEBULA_FRAGMENT.replace('${NOISE}', NOISE_GLSL),
    [reducedEffects]
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntro: { value: 0 }
    }),
    []
  );

  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uIntro.value = intro.current;
  });

  return (
    <mesh position={[0, 0, -16]}>
      <planeGeometry args={[64, 36]} />
      <shaderMaterial
        ref={material}
        key={fragmentShader}
        vertexShader={FULLSCREEN_VERTEX}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ----------------------------- accretion disk ----------------------------- */

const DISK_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntro;
  varying vec2 vUv;

  ${'${NOISE}'}

  void main() {
    vec2 p = (vUv - 0.5) * 2.0; // -1..1 across the disk plane
    float r = length(p);
    float angle = atan(p.y, p.x);

    // Keplerian shear: inner material orbits much faster than outer,
    // smearing the noise into hot spiral streaks.
    float rot = uTime * 0.55 / pow(r * 0.85 + 0.18, 1.5);
    float c = cos(rot);
    float s = sin(rot);
    vec2 q = mat2(c, -s, s, c) * p;
    float bands = fbm(q * 6.0);

    float inner = 0.30;
    float outer = 0.94;
    float ring = smoothstep(inner - 0.012, inner + 0.05, r) * (1.0 - smoothstep(0.60, outer, r));
    float heat = pow(clamp(1.0 - (r - inner) / (outer - inner), 0.0, 1.0), 2.0);

    float brightness = ring * (0.30 + 0.95 * bands) * (0.30 + 1.45 * heat);
    // Relativistic beaming: the side spinning toward the viewer burns brighter.
    brightness *= 0.55 + 0.40 * sin(angle + 2.2);

    // Photon ring: a razor-thin white-hot rim hugging the horizon.
    float rim = exp(-pow((r - inner) / 0.016, 2.0)) * 1.4;

    vec3 color = mix(vec3(0.85, 0.50, 0.12), vec3(1.0, 0.93, 0.72), heat) * brightness;
    color += vec3(1.0, 0.95, 0.80) * rim;

    // The disk ignites as the intro plays.
    float ignite = smoothstep(0.05, 0.75, uIntro);
    gl_FragColor = vec4(color * ignite, 1.0);
  }
`;

function AccretionDisk({ intro, reducedEffects }) {
  const material = useRef(null);

  const fragmentShader = useMemo(
    () =>
      `#define OCTAVES ${reducedEffects ? 3 : 4}\n` +
      DISK_FRAGMENT.replace('${NOISE}', NOISE_GLSL),
    [reducedEffects]
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntro: { value: 0 }
    }),
    []
  );

  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uIntro.value = intro.current;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial
        ref={material}
        key={fragmentShader}
        vertexShader={FULLSCREEN_VERTEX}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ----------------------------- event horizon ------------------------------ */

const HORIZON_GLOW_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HORIZON_GLOW_FRAGMENT = /* glsl */ `
  uniform float uIntro;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Fresnel rim: gravity bending the disk's light around the silhouette.
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.5);
    vec3 color = vec3(1.0, 0.87, 0.55) * fresnel * 1.6;
    gl_FragColor = vec4(color * uIntro, 1.0);
  }
`;

/** Pure black sphere (occludes the disk behind it) plus a fresnel gold rim. */
function EventHorizon({ intro }) {
  const material = useRef(null);

  const uniforms = useMemo(() => ({ uIntro: { value: 0 } }), []);

  useFrame(() => {
    if (material.current) material.current.uniforms.uIntro.value = intro.current;
  });

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          ref={material}
          vertexShader={HORIZON_GLOW_VERTEX}
          fragmentShader={HORIZON_GLOW_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* --------------------------- core ambient glow ---------------------------- */

/** Soft radial halo billboarded around the hole — the sense of raw energy. */
function CoreGlow({ intro }) {
  const sprite = useRef(null);

  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 238, 188, 0.55)');
    gradient.addColorStop(0.25, 'rgba(232, 188, 90, 0.22)');
    gradient.addColorStop(0.6, 'rgba(122, 83, 22, 0.07)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    if (!sprite.current) return;
    // Slow breathing pulse so the energy never feels static.
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.7) * 0.05;
    const scale = 6.5 * pulse * (0.4 + 0.6 * intro.current);
    sprite.current.scale.set(scale, scale, 1);
    sprite.current.material.opacity = 0.6 * intro.current;
  });

  return (
    <sprite ref={sprite}>
      <spriteMaterial map={texture} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

/* ---------------------------- vortex particles ---------------------------- */

const VORTEX_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uIntro;
  attribute float aSeed;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    vec3 p = position;
    float radius = length(p.xz);

    // Keplerian orbit: speed falls off with radius^1.5, so the inner dust
    // whips around the horizon while the outer field drifts — a true vortex.
    float angle = uTime * (1.6 / pow(radius, 1.5)) * (0.7 + aSeed * 0.6);
    float c = cos(angle);
    float s = sin(angle);
    p.xz = mat2(c, -s, s, c) * p.xz;

    // Gentle vertical breathing.
    p.y += sin(uTime * 0.5 + aSeed * 6.2831) * 0.08;

    // During the intro the whole vortex contracts in from the void.
    p *= 0.55 + 0.45 * uIntro;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vHeat = smoothstep(5.4, 1.5, radius);
    gl_PointSize = min(uSize * (0.5 + aSeed) * (9.0 / -mvPosition.z), 14.0);
    vAlpha = (0.25 + 0.75 * aSeed) * smoothstep(2.5, 5.0, -mvPosition.z) * uIntro * 0.8;
  }
`;

const VORTEX_FRAGMENT = /* glsl */ `
  uniform vec3 uColorHot;
  uniform vec3 uColorCool;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float dist = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, dist);
    vec3 color = mix(uColorCool, uColorHot, vHeat);
    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

/**
 * Gold dust caught in the hole's gravity. All animation happens in the
 * vertex shader, so thousands of points cost almost nothing.
 */
function VortexParticles({ intro, reducedEffects }) {
  const material = useRef(null);
  const count = reducedEffects ? 1100 : 2800;

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const radius = 1.55 + Math.pow(Math.random(), 1.4) * 3.9;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      // Multiplying two randoms keeps the dust biased toward the disk plane,
      // thinning vertically near the horizon.
      positions[i * 3 + 1] = (Math.random() - 0.5) * (Math.random() * 0.9) * (radius / 5.4 + 0.25);
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      seeds[i] = Math.random();
    }

    return { positions, seeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntro: { value: 0 },
      uSize: { value: reducedEffects ? 5.5 : 7 },
      uColorHot: { value: new THREE.Color(GOLD.glow) },
      uColorCool: { value: new THREE.Color(GOLD.rich) }
    }),
    [reducedEffects]
  );

  useFrame((state) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = state.clock.elapsedTime;
    material.current.uniforms.uIntro.value = intro.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        vertexShader={VORTEX_VERTEX}
        fragmentShader={VORTEX_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------- black hole ------------------------------ */

/** The full composition, tilted like a classic cinematic accretion shot. */
function BlackHole({ intro, reducedEffects }) {
  return (
    <group rotation={[0.42, 0, -0.12]}>
      <EventHorizon intro={intro} />
      <AccretionDisk intro={intro} reducedEffects={reducedEffects} />
      <VortexParticles intro={intro} reducedEffects={reducedEffects} />
      <CoreGlow intro={intro} />
    </group>
  );
}

/* ----------------------------- interactive dust --------------------------- */

const DUST_BOUNDS = { x: 14, y: 9, z: 6 };

/**
 * Ambient dust drifting through the whole frame, simulated on the CPU so the
 * particles can physically react to the cursor: anything near the pointer is
 * pushed away, then damping settles it back into a slow upward drift.
 */
function DustField({ pointer, reducedEffects }) {
  const geometry = useRef(null);
  const count = reducedEffects ? 450 : 1300;
  const pointerWorld = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector3(), []);

  const { positions, velocities, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * DUST_BOUNDS.x * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * DUST_BOUNDS.y * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * DUST_BOUNDS.z * 2;
      seeds[i] = Math.random() * Math.PI * 2;
    }

    return { positions, velocities, seeds };
  }, [count]);

  useFrame((state, delta) => {
    if (!geometry.current) return;
    const time = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05); // clamp so a dropped frame can't explode the sim

    // Project the cursor onto the z = 0 plane so repulsion happens in world space.
    ndc.set(pointer.current.x, pointer.current.y, 0.5).unproject(state.camera);
    ndc.sub(state.camera.position).normalize();
    const distance = -state.camera.position.z / ndc.z;
    pointerWorld.copy(state.camera.position).addScaledVector(ndc, distance);

    const repelRadius = 2.4;
    const repelStrength = reducedEffects ? 0 : 6;

    for (let i = 0; i < count; i += 1) {
      const ix = i * 3;
      const iy = ix + 1;
      const iz = ix + 2;

      // Base motion: slow rise plus a per-particle sideways wander.
      velocities[iy] += 0.12 * dt;
      velocities[ix] += Math.sin(time * 0.4 + seeds[i]) * 0.05 * dt;

      // Mouse repulsion (skipped entirely on touch / reduced devices).
      if (repelStrength > 0) {
        const dx = positions[ix] - pointerWorld.x;
        const dy = positions[iy] - pointerWorld.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < repelRadius * repelRadius && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const force = ((repelRadius - dist) / repelRadius) * repelStrength * dt;
          velocities[ix] += (dx / dist) * force;
          velocities[iy] += (dy / dist) * force;
        }
      }

      // Drag keeps everything floaty instead of ballistic.
      velocities[ix] *= 0.965;
      velocities[iy] *= 0.965;
      velocities[iz] *= 0.965;

      positions[ix] += velocities[ix];
      positions[iy] += velocities[iy];
      positions[iz] += velocities[iz];

      // Wrap around the bounds so dust never runs out.
      if (positions[iy] > DUST_BOUNDS.y) positions[iy] = -DUST_BOUNDS.y;
      if (positions[iy] < -DUST_BOUNDS.y) positions[iy] = DUST_BOUNDS.y;
      if (positions[ix] > DUST_BOUNDS.x) positions[ix] = -DUST_BOUNDS.x;
      if (positions[ix] < -DUST_BOUNDS.x) positions[ix] = DUST_BOUNDS.x;
    }

    geometry.current.attributes.position.needsUpdate = true;
  });

  return (
    <points position={[0, 0, -1.5]}>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={GOLD.glow}
        size={0.035}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------- camera rig ------------------------------ */

/** Where the camera begins the intro: low and close, staring up at the disk. */
const INTRO_CAMERA_START = { x: 0, y: -2.1, z: 3.3 };
const INTRO_CAMERA_START_REDUCED = { x: 0, y: 0.2, z: 5.4 };

/**
 * Plays a cinematic pull-back on first load — the camera starts almost
 * inside the accretion glow, then sweeps up and out to reveal the whole
 * black hole. After the intro it hands off to scroll dolly + pointer
 * parallax, all damped so motion never feels tied 1:1 to input.
 */
function CameraRig({ pointer, scroll, intro, reducedEffects }) {
  useFrame((state, delta) => {
    const s = scroll.current;
    const t = intro.current;
    const parallax = reducedEffects ? 0 : 1;
    const start = reducedEffects ? INTRO_CAMERA_START_REDUCED : INTRO_CAMERA_START;

    // Where the camera wants to be once the intro has fully resolved.
    const restX = pointer.current.x * 0.7 * parallax;
    const restY = 0.55 + pointer.current.y * 0.35 * parallax - s * 1.8;
    const restZ = 9.6 + s * 2.6;

    // Blend the intro start into the resting shot as the timeline plays.
    const targetX = THREE.MathUtils.lerp(start.x, restX, t);
    const targetY = THREE.MathUtils.lerp(start.y, restY, t);
    const targetZ = THREE.MathUtils.lerp(start.z, restZ, t);

    state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, targetX, 3, delta);
    state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, targetY, 3, delta);
    state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, targetZ, 3, delta);
    // Look slightly above center at first (the disk looms overhead), settling
    // onto the hole as the pull-back completes.
    state.camera.lookAt(0, (1 - t) * 0.6 - s * 1.2, 0);
  });

  return null;
}

/* -------------------------------- scene rig ------------------------------- */

/**
 * Wraps the core composition and rotates it as the page scrolls, so moving
 * between sections reads as one continuous cinematic camera move.
 */
function SceneRig({ scroll, children }) {
  const root = useRef(null);

  useFrame((_, delta) => {
    if (!root.current) return;
    // A third of a turn across the full page height, plus a slow drift.
    const target = scroll.current * Math.PI * 0.35 + performance.now() * 0.00002;
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, target, 2.5, delta);
  });

  return <group ref={root}>{children}</group>;
}

/* ------------------------------- root canvas ------------------------------ */

export default function Experience({ reducedEffects = false }) {
  const { pointer, scroll } = usePageMotion(reducedEffects);
  const intro = useRef(0);
  const start = reducedEffects ? INTRO_CAMERA_START_REDUCED : INTRO_CAMERA_START;

  return (
    <Canvas
      camera={{ position: [start.x, start.y, start.z], fov: 38 }}
      dpr={reducedEffects ? 1 : [1, 1.75]}
      shadows={false}
      resize={{ scroll: false, debounce: { resize: 0, scroll: 120 } }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      {/* The void: pure near-black, with the nebula painting all the light. */}
      <color attach="background" args={[GOLD.ink]} />

      <IntroDirector intro={intro} reducedEffects={reducedEffects} />
      <CameraRig pointer={pointer} scroll={scroll} intro={intro} reducedEffects={reducedEffects} />

      <NebulaBackdrop intro={intro} reducedEffects={reducedEffects} />
      <SceneRig scroll={scroll}>
        <BlackHole intro={intro} reducedEffects={reducedEffects} />
      </SceneRig>
      <DustField pointer={pointer} reducedEffects={reducedEffects} />
    </Canvas>
  );
}
