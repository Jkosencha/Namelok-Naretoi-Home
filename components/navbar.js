(function () {
  const isRoot = !window.location.pathname.includes('/Stories/');
  const root = isRoot ? '' : '../';

  const navbarEl = document.getElementById("navbar");
  if (!navbarEl) return;

  navbarEl.innerHTML = `
    <div class="title">
      <nav class="navbar">
        <div class="logo">
          <a href="${root}index.html">
            <img src="${root}images/logo.png" alt="Brand Logo" />
          </a>
        </div>
        <div class="menu-toggle" id="menu-toggle">☰</div>
        <ul class="nav-links">
          <li><a href="${root}index.html">HOME</a></li>
          <li><a href="${root}about.html">ABOUT US</a></li>
          <li><a href="${root}stories.html">STORIES</a></li>
          <li><a href="${root}gallery.html">OUR GALLERY</a></li>
          <li><a href="${root}contact.html">CONTACT US</a></li>
          <li class="nav-phone-item">
            <a href="tel:+254722537380" class="nav-phone" aria-label="Call the director on 0722 537 380">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>
              <span data-setting="phone">0722 537 380</span>
            </a>
          </li>
          <li><a href="${root}donate.html" class="donate-btn">Donate</a></li>
        </ul>
      </nav>
    </div>
  `;

  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("show");
      menuToggle.textContent = navLinks.classList.contains("show") ? "✖" : "☰";
    });
  }
})();