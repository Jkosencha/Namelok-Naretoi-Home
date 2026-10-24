// Fills the public website with content managed in the admin dashboard.
// Does nothing until js/supabase-config.js is filled in. If the database can't be
// reached, the page simply keeps the content written into the HTML.
(function () {
  const cfg = window.NAMELOK_SUPABASE || {};
  if (!cfg.url || !cfg.anonKey) return;

  const root = window.location.pathname.includes("/Stories/") ? "../" : "";
  const ARROW = '<svg class="arrow-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const TAGS = { rescue: ["Rescue", "story-tag-rescue"], disability: ["Disability", "story-tag-health"], education: ["Education", "story-tag-rescue"], community: ["Community", "story-tag-rescue"] };
  const CATS = { home: "Life at the Home", school: "School Outreach", health: "Healthcare" };

  // Supabase accepts the legacy "anon" key (a JWT starting "eyJ") as a Bearer token too,
  // but the newer "sb_publishable_…" keys must only go in the apikey header
  const AUTH = { apikey: cfg.anonKey, ...(cfg.anonKey.startsWith("eyJ") ? { Authorization: `Bearer ${cfg.anonKey}` } : {}) };

  // Read-only REST calls with the public key (the database only allows published content)
  const get = (path) =>
    fetch(`${cfg.url}/rest/v1/${path}`, { headers: AUTH })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Images saved by the dashboard are full URLs; the starting photos are site-relative
  const img = (url) => (/^(https?:|blob:|data:|\/)/.test(url) ? url : root + url);
  const storyUrl = (s) => `${root}story.html?s=${encodeURIComponent(s.slug)}`;
  const tag = (s) => (TAGS[s.category] || TAGS.rescue);
  const who = (s) => [s.child_name, s.age].filter(Boolean).join(", ");

  // ── Settings: numbers, phone, email, payment details ──
  function applySettings(rows) {
    const set = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    // Pages can react to the settings too (the Donate page shows only methods with real details)
    setTimeout(() => document.dispatchEvent(new CustomEvent("namelok:settings", { detail: set })));
    if (set.founded_year) {
      const years = new Date().getFullYear() - Number(set.founded_year);
      document.querySelectorAll("[data-since]").forEach((el) => {
        el.dataset.since = set.founded_year;
        if (el.classList.contains("counter")) updateCounter(el, years);
        else el.textContent = years + (el.dataset.suffix || "");
      });
    }
    document.querySelectorAll("[data-setting]").forEach((el) => {
      const value = set[el.dataset.setting];
      if (!value) return; // keep what the page already says
      if (el.classList.contains("counter")) return updateCounter(el, Number(value));
      el.textContent = value + (el.dataset.suffix || "");
      const link = el.closest("a");
      if (link && link.href.startsWith("tel:")) link.href = "tel:+254" + value.replace(/\D/g, "").replace(/^0/, "");
      if (link && link.href.startsWith("mailto:")) link.href = "mailto:" + value;
    });
  }
  // Counters animate on scroll; if the animation already finished, show the new number
  function updateCounter(el, value) {
    const done = el.textContent.trim() === el.dataset.target;
    el.dataset.target = value;
    if (done) el.textContent = value;
  }

  // ── Stories ──
  function storyCard(s) {
    return `<article class="story-card">
      <img src="${esc(img(s.image_url))}" alt="" loading="lazy" />
      <div class="story-card-body">
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.summary)}</p>
        <a href="${storyUrl(s)}">Read More ${ARROW}</a>
      </div>
    </article>`;
  }
  function storyTile(s) {
    const [label, cls] = tag(s);
    return `<article class="story-tile">
      <a href="${storyUrl(s)}" class="story-tile-img"><img src="${esc(img(s.image_url))}" alt="" loading="lazy" /></a>
      <div class="story-tile-body">
        <div class="story-tile-meta"><span class="story-tag ${cls}">${label}</span><span>${esc(who(s))}</span></div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.summary)}</p>
        <a href="${storyUrl(s)}" class="story-tile-link">Read story ${ARROW}</a>
      </div>
    </article>`;
  }
  function applyStories(stories) {
    if (!stories.length) return;
    const homeGrid = document.querySelector(".stories-section .stories-grid");
    if (homeGrid) homeGrid.innerHTML = stories.slice(0, 6).map(storyCard).join("");

    const featured = stories.find((s) => s.featured) || stories[0];
    const feat = document.querySelector(".featured-story");
    if (feat) {
      const [label, cls] = tag(featured);
      feat.innerHTML = `<div class="featured-story-img">
          <img src="${esc(img(featured.image_url))}" alt="" />
          <span class="featured-badge">Featured Story</span>
        </div>
        <div class="featured-story-body">
          <span class="story-tag ${cls}">${label}</span>
          <h2>${esc(featured.title)}</h2>
          <p>${esc(featured.summary)}</p>
          <a href="${storyUrl(featured)}" class="featured-story-link">Read the story ${ARROW}</a>
        </div>`;
    }
    const grid = document.querySelector(".all-stories-section .all-stories-grid");
    if (grid) grid.innerHTML = stories.filter((s) => s !== featured).map(storyTile).join("") || stories.map(storyTile).join("");
  }

  // ── Gallery ──
  function applyGallery(photos) {
    const grid = document.querySelector(".gallery-masonry");
    if (!grid || !photos.length) return;
    grid.innerHTML = photos.map((p) => `<figure class="g-item" data-cat="${esc(p.category)}">
        <button type="button" class="g-open" data-full="${esc(img(p.image_url))}">
          <img src="${esc(img(p.image_url))}" alt="${esc(p.caption)}" loading="lazy" />
        </button>
        <figcaption><span>${CATS[p.category] || ""}</span>${esc(p.caption)}</figcaption>
      </figure>`).join("");
    const count = document.querySelector(".gallery-count strong");
    if (count) count.textContent = photos.length;
    document.querySelectorAll(".g-filter").forEach((btn) => {
      const n = btn.dataset.filter === "all" ? photos.length : photos.filter((p) => p.category === btn.dataset.filter).length;
      const badge = btn.querySelector("span");
      if (badge) badge.textContent = n;
    });
    document.querySelector(".g-filter.is-active")?.click(); // re-apply the current filter
  }

  // ── Contact form: lets contact.html send real messages ──
  window.NamelokSite = {
    sendMessage(msg) {
      return fetch(`${cfg.url}/rest/v1/contact_messages`, {
        method: "POST",
        headers: { ...AUTH, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(msg),
      }).then((r) => { if (!r.ok) throw new Error("Message could not be sent (" + r.status + ")"); });
    },
  };

  // ── A single story page: story.html?s=<web address> ──
  function applyStoryPage(rows) {
    const s = rows[0];
    if (!s) {
      document.getElementById("storyTitle").textContent = "Story not found";
      return;
    }
    document.title = `${s.title} – Namelok Naretoi Home`;
    document.getElementById("storyTitle").innerHTML = s.child_name ? `<span class="hero-accent">${esc(s.child_name)}’s</span> Story` : esc(s.title);
    const [label] = tag(s);
    const profile = document.getElementById("storyProfile");
    profile.innerHTML = `${s.image_url ? `<img src="${esc(img(s.image_url))}" alt="" />` : ""}
      <div class="story-profile-body">
        <h2>${esc(s.title)}</h2>
        <dl>
          ${s.child_name ? `<div class="sp-row"><dt>Name</dt><dd>${esc(s.child_name)}</dd></div>` : ""}
          ${s.age ? `<div class="sp-row"><dt>Age</dt><dd>${esc(s.age)}</dd></div>` : ""}
          <div class="sp-row"><dt>Story</dt><dd>${label}</dd></div>
        </dl>
      </div>`;
    profile.hidden = false;
    const paragraphs = (s.body || s.summary || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    document.getElementById("storyBody").innerHTML = paragraphs.map((p) => `<p>${esc(p)}</p>`).join("");
  }

  get("site_settings?select=key,value").then(applySettings).catch(() => {});
  const slug = new URLSearchParams(location.search).get("s");
  if (document.getElementById("storyPage") && slug)
    get(`stories?select=*&published=eq.true&slug=eq.${encodeURIComponent(slug)}`).then(applyStoryPage).catch(() => {});
  if (document.querySelector(".stories-grid, .featured-story"))
    get("stories?select=*&published=eq.true&order=sort_order.asc").then(applyStories).catch(() => {});
  if (document.querySelector(".gallery-masonry"))
    get("gallery_photos?select=*&published=eq.true&order=sort_order.asc").then(applyGallery).catch(() => {});
})();
