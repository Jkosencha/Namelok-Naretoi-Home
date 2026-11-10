// Programmes page: the programme buttons, plus scroll progress, back-to-top and footer year.
// Load it AFTER the navbar script.
(() => {
  // ── Programme buttons: each opens its programme below, and the address (#education…) follows ──
  const strip = document.querySelector(".prog-tabs");
  const tabs = [...strip.querySelectorAll(".prog-tab")];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const show = (id) => {
    if (!panels.some((p) => p.id === id)) return false;
    tabs.forEach((t) => {
      const on = t.getAttribute("aria-controls") === id;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      if (on) strip.scrollTo({ left: t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2, behavior: "smooth" });   // on phones the strip slides sideways
    });
    panels.forEach((p) => { p.hidden = p.id !== id; });
    return true;
  };
  // Bring the open programme into view, under the sticky buttons
  const reveal = (id) => {
    const top = document.getElementById(id).getBoundingClientRect().top;
    const below = parseFloat(getComputedStyle(strip).top) + strip.offsetHeight + 24;   // just under the sticky buttons
    if (top < below || top > innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - below, behavior: "smooth" });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const id = tab.getAttribute("aria-controls");
      show(id);
      history.replaceState(null, "", "#" + id);
      reveal(id);
    });
    tab.addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
  });
  // Links like services.html#rescue (from the footer, the home page or old programme pages)
  const fromHash = () => { const id = location.hash.slice(1); if (show(id)) reveal(id); };
  window.addEventListener("hashchange", fromHash);
  if (location.hash) fromHash(); else show(panels[0].id);

  // ── Scroll progress bar, back to top, navbar shadow ──
  const progress = document.createElement("div");
  progress.id = "scroll-progress";
  document.body.appendChild(progress);
  const up = document.getElementById("upArrow");
  if (up) up.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  const onScroll = () => {
    const nav = document.querySelector(".title");
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 30);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
    if (up) up.classList.toggle("visible", window.scrollY > 400);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.querySelectorAll(".nl-year").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
