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
          <li class="dropdown">
            <a href="${root}about.html">ABOUT US <span class="arrow">&#9662;</span></a>
            <ul class="dropdown-menu">
              <li><a href="${root}about.html">About Us</a></li>
              <li><a href="${root}history.html">Our History</a></li>
            </ul>
          </li>
          <li><a href="${root}index.html#stories">STORIES</a></li>
          <li><a href="${root}gallery.html">OUR GALLERY</a></li>
          <li><a href="${root}contact.html">CONTACT US</a></li>
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