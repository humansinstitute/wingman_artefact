const slides = Array.from(document.querySelectorAll('.slide'));
const prev = document.querySelector('.nav-prev');
const next = document.querySelector('.nav-next');
const current = document.querySelector('#currentSlide');
const total = document.querySelector('#totalSlides');
const progress = document.querySelector('.progress');
let index = 0;

total.textContent = String(slides.length);

function indexFromHash() {
  const raw = window.location.hash.replace('#', '');
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed - 1, 0), slides.length - 1);
}

function showSlide(nextIndex) {
  index = (nextIndex + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle('active', slideIndex === index);
  });
  current.textContent = String(index + 1);
  progress.classList.toggle('on-cover', index === 0);
  window.history.replaceState(null, '', `#${index + 1}`);
}

prev.addEventListener('click', () => showSlide(index - 1));
next.addEventListener('click', () => showSlide(index + 1));

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showSlide(index - 1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    showSlide(index + 1);
  }
});

window.addEventListener('hashchange', () => showSlide(indexFromHash()));

showSlide(indexFromHash());
