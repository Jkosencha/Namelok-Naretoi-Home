// Scroll animations on every page, with GSAP and ScrollTrigger (js/vendor):
//   headings drop in from above, blocks on the left slide in from the left, blocks on the right
//   from the right, centred blocks rise, photos zoom in; cards in a row arrive one after another.
//   They play again as you scroll back past them, and the big photos drift slightly (parallax).
// If GSAP is missing, the same directions are done with CSS classes (see .reveal in theme.css).
// Load it last, after the page's own content and the footer/section components.
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
    ".ct-info", ".dn-details", ".dn-actions", ".home-band-text",
  ];
  const HEADINGS = new Set([".stories-head", ".gallery-heading", ".partners-title", ".section4-heading", ".programs-head",
    ".about-header", ".prog-picker > .container > h2", ".lift-section h2"]);
  const PHOTOS = /(^|\s)(s3d|pill-collage|featured-story-img|prog-photos|video-section|volunteer-media)(\s|$)/;
  // Never animate inside these: the page header and the overlapping form cards stay put
  const SKIP = ".page-hero, .ct-card, .dn-card";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Where a block sits decides where it comes from
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
  const FROM = {
    up: { y: 60 }, down: { y: -45 }, left: { x: -90 }, right: { x: 90 }, zoom: { scale: 0.88 },
  };

  // Blocks not yet set up, with their selector
  const fresh = () => {
    const found = [];
    SELECTORS.forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
      if (el.dataset.reveal || el.closest(SKIP)) return;
      found.push([el, sel]);
    }));
    return found;
  };

  const gsap = window.gsap, ST = window.ScrollTrigger;

  if (gsap && ST) {
    gsap.registerPlugin(ST);

    const setup = () => {
      let prev = null, delay = 0;
      fresh().forEach(([el, sel], i) => {
        const dir = direction(el, sel, i);
        el.dataset.reveal = dir;
        // blocks side by side come in one after another
        const top = el.getBoundingClientRect().top;
        delay = prev !== null && Math.abs(prev - top) < 40 ? Math.min(delay + 0.12, 0.48) : 0;
        prev = top;
        gsap.fromTo(el, { autoAlpha: 0, ...FROM[dir] }, {
          autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 1, delay, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
        });
      });
    };
    setup();

    // Parallax: big photos drift a little slower than the page
    const drift = (target, trigger, amount) => gsap.fromTo(target, { yPercent: -amount }, {
      yPercent: amount, ease: "none", scrollTrigger: { trigger, start: "top bottom", end: "bottom top", scrub: true },
    });
    document.querySelectorAll(".home-hero-photo img").forEach((img) => { img.style.scale = "1.15"; drift(img, img.parentElement, 6); });
    document.querySelectorAll(".page-hero").forEach((hero) => {
      gsap.fromTo(hero, { "--hero-shift": "0px" }, { "--hero-shift": "90px", ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    });
    document.querySelectorAll(".prog-photo-main, .story-card img, .featured-story-img img").forEach((img) => {
      img.style.scale = "1.12"; drift(img, img, 5);
    });

    // Stories and photos the dashboard adds later, and programmes opened from the buttons
    // (only when content we animate is added; counters changing their number are ignored)
    // (ScrollTrigger's own measuring elements are ignored too, or it would keep re-measuring)
    const ALL = SELECTORS.join(",");
    const addsElements = (list) => list.some((m) => [...m.addedNodes].some((n) =>
      n.nodeType === 1 && (n.matches(ALL) || n.querySelector(ALL))));
    let pending = 0;
    new MutationObserver((list) => {
      if (pending || !addsElements(list)) return;
      pending = setTimeout(() => { pending = 0; setup(); ST.refresh(); }, 200);
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", (e) => { if (e.target.closest(".prog-tab, .g-filter")) setTimeout(() => ST.refresh(), 60); });
    window.addEventListener("load", () => ST.refresh());
    return;
  }

  // ── Fallback without GSAP: CSS classes ──
  if (!("IntersectionObserver" in window)) return;
  const show = (el) => el.classList.add("is-visible");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
  const scan = () => fresh().forEach(([el, sel], i) => {
    el.dataset.reveal = direction(el, sel, i);
    el.classList.add("reveal");
    io.observe(el);
  });
  scan();
  new MutationObserver((list) => {
    if (list.some((m) => [...m.addedNodes].some((n) => n.nodeType === 1))) scan();
  }).observe(document.body, { childList: true, subtree: true });
  const showPassed = () => document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.width > 0) show(el);
  });
  window.addEventListener("scroll", showPassed, { passive: true });
  window.addEventListener("load", showPassed);
})();
