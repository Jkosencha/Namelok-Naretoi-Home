
document.getElementById("upArrow").onclick = function(){
    //scroll to top
    window.scrollTo(0, 0);
}

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
