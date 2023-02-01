var slides = document.querySelectorAll('.slide');
var currentSlide = 0;

function nextSlide() {
  slides[currentSlide].style.display = 'none';
  currentSlide = (currentSlide + 1) % slides.length;
  slides[currentSlide].style.display = 'flex';
}

setInterval(nextSlide, 3000);
