import React from "react";
import "./App.css";

function App() {
  return (
    <div className="App">
      <header>
        <h1>Luke Strazz</h1>
        <p>Software Developer • React | .NET | Azure</p>
      </header>

      <section className="section">
        <h2>About Me</h2>
        <p>
          I'm a passionate developer focused on building modern web apps.
          Currently working on full-stack .NET + React projects and open to freelance or full-time work.
        </p>
      </section>

      <section className="section">
        <h2>Skills</h2>
        <ul>
          <li>React, JavaScript, TypeScript</li>
          <li>.NET, C#, MSSQL</li>
          <li>Azure, GitHub Actions, Firebase</li>
        </ul>
      </section>

      <section className="section">
        <h2>Projects</h2>
        <ul>
          <li>
            <strong>Meal Planner App</strong> – A Blazor + MSSQL app for AI-based meal planning.
          </li>
          <li>
            <strong>Video Slicer Tool</strong> – React + FFmpeg-based UI for uploading and randomizing clips.
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>Contact</h2>
        <p>Email: lukestrazz@example.com</p>
        <p>GitHub: <a href="https://github.com/lukestrazz" target="_blank">lukestrazz</a></p>
      </section>

      <footer>
        <p>© {new Date().getFullYear()} Luke Strazz</p>
      </footer>
    </div>
  );
}

export default App;
