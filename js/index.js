// // Carousel functionality
const track = document.getElementById('carouselTrack');
const scrollAmount = 320; // Adjust to match your card width + gap

function scrollCarousel(direction) {
  const maxScrollLeft = track.scrollWidth - track.clientWidth;

  // If scrolling right and at (or near) the end
  if (direction === 1 && Math.ceil(track.scrollLeft) >= maxScrollLeft) {
    track.scrollTo({
      left: 0,
      behavior: 'smooth'
    });
  }
  // If scrolling left and at (or near) the beginning
  else if (direction === -1 && track.scrollLeft <= 0) {
    track.scrollTo({
      left: maxScrollLeft,
      behavior: 'smooth'
    });
  }
  // Otherwise just scroll normally
  else {
    track.scrollBy({
      left: scrollAmount * direction,
      behavior: 'smooth'
    });
  }
}

// Auto-scroll carousel every 4 seconds
setInterval(() => {
  scrollCarousel(1);
}, 3000);

// Scroll to top when up arrow is clicked
document.getElementById("upArrow").onclick = function () {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

document.getElementById("upArrow").onclick = function () {
  //scroll to top
  window.scrollTo(0, 0);
}

// Counter animation
const counters = document.querySelectorAll('.counter');

const startCount = () => {
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    const duration = 2000; // Total duration in ms for the count animation
    const frameRate = 20;  // ms between frames
    const increment = Math.ceil(target / (duration / frameRate)); // adaptive increment

    const updateCount = () => {
      let count = +counter.innerText;
      if (count < target) {
        counter.innerText = Math.min(count + increment, target);
        setTimeout(updateCount, frameRate);
      } else {
        counter.innerText = target;
      }
    };

    updateCount();
  });
};

// Animate only when counter section is visible
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      startCount();
      observer.disconnect(); // run only once
    }
  });
});

observer.observe(document.querySelector('.counterContainer'));

// ------------------ Hamburger Menu Toggle ------------------
const menuToggle = document.getElementById('menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('show');
    // Change icon to "X" when menu is open
    menuToggle.textContent = navLinks.classList.contains('show') ? '✖' : '☰';
  });
}
