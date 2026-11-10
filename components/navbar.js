(function () {
  const isRoot = !window.location.pathname.includes('/Stories/');
  const root = isRoot ? '' : '../';

  const navbarEl = document.getElementById("navbar");
  if (!navbarEl) return;

  // The page we're on, so its link can be highlighted (story pages count as Stories)
  const file = window.location.pathname.split("/").pop() || "index.html";
  const page = !isRoot || file === "story.html" ? "stories.html" : file;
  const cur = (href) => (href === page ? ' aria-current="page"' : "");

  navbarEl.innerHTML = `
    <div class="title">
      <nav class="navbar" aria-label="Main">
        <div class="logo">
          <a href="${root}index.html">
            <img src="${root}images/logo.png" alt="" />
            <span>Namelok</span>
          </a>
        </div>
        <div class="nav-menu" id="nav-menu">
          <ul class="nav-links nav-main">
            <li><a href="${root}index.html"${cur("index.html")}>Home</a></li>
            <li><a href="${root}services.html"${cur("services.html")}>Programmes</a></li>
            <li><a href="${root}about.html"${cur("about.html")}>About us</a></li>
            <li><a href="${root}stories.html"${cur("stories.html")}>Stories</a></li>
            <li><a href="${root}gallery.html"${cur("gallery.html")}>Gallery</a></li>
          </ul>
          <ul class="nav-links nav-side">
            <li><a href="${root}contact.html"${cur("contact.html")}>Contact us</a></li>
            <li class="nav-phone-item">
              <a href="tel:+254722537380" class="nav-phone" aria-label="Call the director">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>
                <span data-setting="phone">0722 537 380</span>
              </a>
            </li>
            <li class="nav-donate-item"><a href="${root}donate.html" class="donate-btn"${cur("donate.html")}>Donate</a></li>
          </ul>
        </div>
        <button type="button" class="menu-toggle" id="menu-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav-menu">☰</button>
      </nav>
    </div>
  `;

  const menuToggle = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");
  menuToggle.addEventListener("click", () => {
    const open = navMenu.classList.toggle("show");
    menuToggle.textContent = open ? "✕" : "☰";
    menuToggle.setAttribute("aria-expanded", String(open));
  });
})();
