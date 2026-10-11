// Back to top button — fades in after scrolling, scrolls smoothly to top
const upArrow = document.getElementById("upArrow");
if (upArrow) {
  const upArrowCont = document.getElementById("upArrow");

  upArrowCont.onclick = function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleUpArrow = () => {
    upArrowCont.classList.toggle("visible", window.scrollY > 400);
  };
  window.addEventListener("scroll", toggleUpArrow, { passive: true });
  toggleUpArrow();
}

// Scroll progress bar
const progressBar = document.createElement("div");
progressBar.id = "scroll-progress";
document.body.appendChild(progressBar);

const updateProgressBar = () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  progressBar.style.width = progress + "%";
};
window.addEventListener("scroll", updateProgressBar, { passive: true });
updateProgressBar();

// Counter animation
const counters = document.querySelectorAll(".counter");

const startCount = () => {
  counters.forEach((counter) => {
    const target = +counter.getAttribute("data-target");
    const duration = 2000;
    const frameRate = 20;
    const increment = Math.ceil(target / (duration / frameRate));

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

const counterContainer = document.querySelector(".counterContainer");
if (counterContainer) {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        startCount();
        counterObserver.disconnect();
      }
    });
  });
  counterObserver.observe(counterContainer);
}

// Scroll-reveal animation for content blocks
const revealSelectors = [
  ".aboutUsLeft",
  ".aboutUsText",
  ".stories-section h2",
  ".stories-subtitle",
  ".story-card",
  ".section4-heading",
  ".mv-card",
  ".gallery-heading",
  ".galleryContainer",
  ".partners-title",
  ".partner-logos",
  ".service-card",
  ".video-section",
  ".history-content",
  ".history-cta",
  ".donate-form-wrap",
  ".trust-panel",
  ".contact-form-wrap",
  ".contact-info-panel",
  ".impact-stat",
  ".gallery-container img",
];

const revealEls = document.querySelectorAll(revealSelectors.join(","));
revealEls.forEach((el, i) => {
  el.classList.add("reveal");
  el.style.transitionDelay = Math.min((i % 6) * 0.08, 0.4) + "s";
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
revealEls.forEach((el) => revealObserver.observe(el));

// Navbar shadow/blur state on scroll
const navTitle = document.querySelector(".title");
if (navTitle) {
  const toggleNavShadow = () => {
    navTitle.classList.toggle("scrolled", window.scrollY > 30);
  };
  window.addEventListener("scroll", toggleNavShadow, { passive: true });
  toggleNavShadow();
}

// Homepage video modal: load the video only when opened, stop it on close
const videoModal = document.getElementById("videoModal");
if (videoModal) {
  const videoFrame = document.getElementById("videoFrame");

  document.getElementById("videoOpen").addEventListener("click", () => {
    videoFrame.src = videoFrame.dataset.src;
    videoModal.showModal();
  });
  document.getElementById("videoClose").addEventListener("click", () => videoModal.close());
  videoModal.addEventListener("click", (e) => {
    if (e.target === videoModal) videoModal.close();
  });
  videoModal.addEventListener("close", () => {
    videoFrame.src = "";
  });
}

// Partner logos: repeat the set so the scrolling strip loops seamlessly
const partnerLogos = document.querySelector(".partner-marquee .partner-logos");
if (partnerLogos) {
  const originals = [...partnerLogos.children];
  const copies = Math.max(2, Math.ceil(12 / originals.length));
  for (let i = 1; i < copies * 2; i++) {
    originals.forEach((logo) => {
      const copy = logo.cloneNode(true);
      copy.alt = "";
      copy.setAttribute("aria-hidden", "true");
      partnerLogos.appendChild(copy);
    });
  }
  partnerLogos.classList.add("is-scrolling");
}
