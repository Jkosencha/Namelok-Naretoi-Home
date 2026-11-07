// Programme pages: scroll effects, back-to-top, reveal and footer year.
// The navbar itself (including the mobile menu toggle) comes from the navbar component,
// so this file deliberately does NOT touch the menu. Load it AFTER the navbar script.
(() => {
  const bar = document.createElement("div");
  bar.id = "scroll-progress";
  document.body.appendChild(bar);

  const up = document.getElementById("upArrow");
  if (up) up.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const onScroll = () => {
    // The navbar is injected by another script, so look it up each time
    const nav = document.querySelector(".title");
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 30);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
    if (up) up.classList.toggle("visible", window.scrollY > 400);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const targets = document.querySelectorAll(".section-head, .card, .split-text, .split-img, .callout");
  if ("IntersectionObserver" in window) {
    targets.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min((i % 4) * 0.08, 0.3) + "s";
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    targets.forEach((el) => io.observe(el));
  }

  document.querySelectorAll(".nl-year").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
