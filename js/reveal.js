// Scroll animations on every page: blocks slide in from different directions as they come into view.
//   headings drop in from above, blocks on the left come from the left, blocks on the right from
//   the right, centred blocks rise from below, and photos zoom in gently.
// Load it after the page's own content (and the footer/section components) are in place.
(() => {
  const SELECTORS = [
    // headings: from above
    ".stories-head", ".gallery-heading", ".partners-title", ".section4-heading", ".programs-head",
    ".about-header", ".prog-picker > .container > h2", ".lift-section h2",
    // blocks and cards: direction from where they sit
    ".home-program", ".story-card", ".lift-section p", ".lift-actions", ".help-card", ".volunteer-text",
    ".volunteer-media", ".mv-card", ".quote-inner", ".s3d", ".partner-marquee", ".next-story-inner",
    ".aboutUsLeft", ".aboutUsText", ".pill-collage", ".service-card", ".tl-card", ".video-section",
    ".featured-story-img", ".featured-story-body", ".story-tile", ".gallery-toolbar", ".g-item",
    ".story-profile", ".story-article", ".prog-tabs", ".prog-photos", ".prog-text", ".prog-how", ".prog-quote",
    ".ct-info", ".dn-details", ".dn-actions",
  ];
  const HEADINGS = new Set([".stories-head", ".gallery-heading", ".partners-title", ".section4-heading", ".programs-head",
    ".about-header", ".prog-picker > .container > h2", ".lift-section h2"]);
  const PHOTOS = /(^|\s)(s3d|pill-collage|featured-story-img|prog-photos|video-section|volunteer-media)(\s|$)/;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  // Pick a direction from where the block sits on the page
  const direction = (el, sel, i) => {
    if (HEADINGS.has(sel)) return "down";
    if (PHOTOS.test(el.className)) return "zoom";
    const r = el.getBoundingClientRect();
    const mid = (r.left + r.right) / 2 / window.innerWidth;
    if (r.width > window.innerWidth * 0.7) return i % 2 ? "up" : "zoom";      // full-width blocks
    if (mid < 0.42) return "left";
    if (mid > 0.58) return "right";
    return "up";
  };

  const show = (el) => el.classList.add("is-visible");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });

  // Find new blocks and set them up (runs again when the dashboard adds stories or photos)
  const scan = () => {
    const found = [];
    SELECTORS.forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
      if (el.classList.contains("reveal") || el.closest(".page-hero")) return;
      found.push([el, sel]);
    }));
    let prev = null;
    found.forEach(([el, sel], i) => {
      el.dataset.reveal = direction(el, sel, i);
      el.classList.add("reveal");
      // blocks side by side come in one after another
      const sameRow = prev && Math.abs(prev.getBoundingClientRect().top - el.getBoundingClientRect().top) < 40;
      el.style.transitionDelay = sameRow ? Math.min((parseFloat(prev.style.transitionDelay) || 0) + 0.12, 0.48) + "s" : "0s";
      io.observe(el);
      prev = el;
    });
  };
  scan();
  let pending = 0;
  new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; scan(); }); })
    .observe(document.body, { childList: true, subtree: true });

  // Backup for fast scrolling and late layout changes: anything already on or above the screen is shown
  const showPassed = () => document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.width > 0) show(el);
  });
  let tick = 0;
  window.addEventListener("scroll", () => { if (!tick) tick = requestAnimationFrame(() => { tick = 0; showPassed(); }); }, { passive: true });
  window.addEventListener("load", showPassed);
  setTimeout(showPassed, 1500);
})();
