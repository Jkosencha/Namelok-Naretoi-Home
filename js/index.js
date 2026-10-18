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

// Years of service, counted from the founding year so it never goes out of date
document.querySelectorAll("[data-since]").forEach((el) => {
  const years = new Date().getFullYear() - Number(el.dataset.since);
  if (el.classList.contains("counter")) el.dataset.target = years;
  else el.textContent = years + (el.dataset.suffix || "");
});

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
  ".featured-story",
  ".tl-card",
  ".story-tile",
  ".next-story-inner",
  ".aboutUsLeft",
  ".aboutUsText",
  ".stories-section h2",
  ".stories-subtitle",
  ".story-card",
  ".section4-heading",
  ".mv-card",
  ".gallery-heading",
  ".s3d",
  ".partners-title",
  ".partner-marquee",
  ".service-card",
  ".video-section",
  ".history-content",
  ".history-cta",
  ".donate-form-wrap",
  ".trust-panel",
  ".contact-form-wrap",
  ".contact-info-panel",
  ".impact-stat",
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
  // Trigger as soon as any part is on screen (minus the bottom 8%), so very wide
  // or very tall blocks can never stay hidden
  { threshold: 0, rootMargin: "0px 0px -8% 0px" }
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

// Gallery page: category filters and full-screen photo viewer
const galleryGrid = document.querySelector(".gallery-masonry");
if (galleryGrid) {
  // Items are looked up on each use, because the photos may be replaced with ones
  // from the dashboard after the page loads (see js/site-data.js)
  const allItems = () => [...galleryGrid.querySelectorAll(".g-item")];
  const filters = document.querySelectorAll(".g-filter");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbCaption = document.getElementById("lbCaption");
  const lbCount = document.getElementById("lbCount");
  let current = 0;

  const visibleItems = () => allItems().filter((item) => !item.hidden);

  filters.forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", b === btn);
      });
      const cat = btn.dataset.filter;
      allItems().forEach((item) => {
        item.hidden = cat !== "all" && item.dataset.cat !== cat;
      });
    });
  });

  const show = (index) => {
    const list = visibleItems();
    current = (index + list.length) % list.length;
    const img = list[current].querySelector("img");
    lbImg.src = list[current].querySelector(".g-open").dataset.full;
    lbImg.alt = img.alt;
    lbCaption.textContent = img.alt;
    lbCount.textContent = `${current + 1} / ${list.length}`;
    lbImg.style.animation = "none";
    void lbImg.offsetWidth;
    lbImg.style.animation = "";
  };

  galleryGrid.addEventListener("click", (e) => {
    const item = e.target.closest(".g-item");
    if (!item) return;
    show(visibleItems().indexOf(item));
    lightbox.showModal();
  });

  lightbox.querySelector(".lb-prev").addEventListener("click", () => show(current - 1));
  lightbox.querySelector(".lb-next").addEventListener("click", () => show(current + 1));
  lightbox.querySelector(".lb-close").addEventListener("click", () => lightbox.close());
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });
}

// Home: 3D gallery slider
const slider3d = document.querySelector(".s3d");
if (slider3d) {
  const cards = [...slider3d.querySelectorAll(".s3d-card")];
  const bgLayers = document.querySelectorAll(".s3d-bg-layer");
  const dots = document.querySelectorAll(".s3d-dot");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const total = cards.length;
  let current = 0;
  let timer = null;

  const layout = () => {
    const narrow = window.innerWidth <= 700;
    const spread = narrow ? 52 : 62; // % of card width between neighbours
    cards.forEach((card, i) => {
      // Shortest signed distance from the active card, wrapping around
      let offset = i - current;
      if (offset > total / 2) offset -= total;
      if (offset < -total / 2) offset += total;
      const abs = Math.abs(offset);
      const hidden = abs > (narrow ? 1 : 2);
      card.style.transform =
        `translateX(${offset * spread}%) translateZ(${-abs * 160}px) rotateY(${offset * -32}deg) scale(${1 - abs * 0.06})`;
      card.style.opacity = hidden ? 0 : 1 - abs * 0.18;
      card.style.filter = abs ? `brightness(${1 - abs * 0.25})` : "none";
      card.style.zIndex = 20 - abs;
      card.style.pointerEvents = hidden ? "none" : "auto";
      card.classList.toggle("is-active", offset === 0);
      card.setAttribute("aria-hidden", offset !== 0);
    });
    bgLayers.forEach((layer, i) => layer.classList.toggle("is-active", i === current));
    dots.forEach((dot, i) => dot.classList.toggle("is-active", i === current));
  };

  const go = (index) => {
    current = (index + total) % total;
    layout();
  };

  const stop = () => clearInterval(timer);
  const start = () => {
    stop();
    if (!reduceMotion) timer = setInterval(() => go(current + 1), 5000);
  };

  slider3d.querySelector(".s3d-prev").addEventListener("click", () => go(current - 1));
  slider3d.querySelector(".s3d-next").addEventListener("click", () => go(current + 1));
  let swiped = false;
  cards.forEach((card, i) => card.addEventListener("click", () => {
    if (!swiped) go(i);
  }));
  dots.forEach((dot, i) => dot.addEventListener("click", () => go(i)));

  slider3d.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(current - 1);
    if (e.key === "ArrowRight") go(current + 1);
  });

  // Swipe on touch screens
  let startX = null;
  slider3d.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
    swiped = false;
  });
  slider3d.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) {
      swiped = true;
      go(current + (dx < 0 ? 1 : -1));
    }
    startX = null;
  });

  // Pause while someone is looking at or using it
  const section = slider3d.closest("section");
  section.addEventListener("mouseenter", stop);
  section.addEventListener("mouseleave", start);
  section.addEventListener("focusin", stop);
  section.addEventListener("focusout", start);

  window.addEventListener("resize", layout);
  layout();
  start();
}
