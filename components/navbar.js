// (function () {
//   const isRoot = !window.location.pathname.includes('/Stories/');
//   const root = isRoot ? '' : '../';

//   const navbarEl = document.getElementById("navbar");
//   if (!navbarEl) return;

//   navbarEl.innerHTML = `
//     <div class="title">
//       <nav class="navbar">
//         <div class="logo">
//           <a href="${root}index.html">
//             <img src="${root}images/logo.png" alt="Brand Logo" />
//           </a>
//         </div>
//         <div class="menu-toggle" id="menu-toggle">☰</div>
//         <ul class="nav-links">
//           <li><a href="${root}index.html">HOME</a></li>
//           <li class="dropdown">
//   <a href="${root}services.html" class="dropdown-toggle">
//     SERVICES <span class="dropdown-arrow">⌄</span>
//   </a>

//   <ul class="dropdown-menu">
//     <li><a href="${root}services.html">All Programmes</a></li>
//     <li><a href="${root}medical-rehabilitation.html">Disability Rehabilitation</a></li>
//     <li><a href="${root}education.html">Inclusive Education</a></li>
//     <li><a href="${root}rescue-girls.html">Rescue and Protection of Girls</a></li>
//     <li><a href="${root}safe-home.html">Safe Home and Holistic Care</a></li>
//     <li><a href="${root}community-outreach.html">Community Outreach and Mentorship</a></li>
//   </ul>
// </li>
//           <li><a href="${root}about.html">ABOUT US</a></li>
//           <li><a href="${root}stories.html">STORIES</a></li>
//           <li><a href="${root}gallery.html">OUR GALLERY</a></li>
//           <li><a href="${root}contact.html">CONTACT US</a></li>
//           <li class="nav-phone-item">
//             <a href="tel:+254722537380" class="nav-phone" aria-label="Call the director on 0722 537 380">
//               <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>
//               <span data-setting="phone">0722 537 380</span>
//             </a>
//           </li>
//           <li><a href="${root}donate.html" class="donate-btn">Donate</a></li>
//         </ul>
//       </nav>
//     </div>
//   `;

//   const menuToggle = document.getElementById("menu-toggle");
//   const navLinks = document.querySelector(".nav-links");

//   if (menuToggle && navLinks) {
//     menuToggle.addEventListener("click", () => {
//       navLinks.classList.toggle("show");
//       menuToggle.textContent = navLinks.classList.contains("show") ? "✖" : "☰";
//     });
//   }
// })();

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
            <div class="dropdown-row">
              <a href="${root}services.html" class="dropdown-toggle">SERVICES</a>
              <button class="dropdown-arrow" type="button" aria-label="Show programmes" aria-expanded="false" aria-controls="programmes-menu"></button>
            </div>
            <ul class="dropdown-menu" id="programmes-menu">
              <li><a href="${root}services.html">All Programmes</a></li>
              <li><a href="${root}medical-rehabilitation.html">Disability Rehabilitation</a></li>
              <li><a href="${root}education.html">Inclusive Education</a></li>
              <li><a href="${root}rescue-girls.html">Rescue and Protection of Girls</a></li>
              <li><a href="${root}safe-home.html">Safe Home and Holistic Care</a></li>
              <li><a href="${root}community-outreach.html">Community Outreach and Mentorship</a></li>
            </ul>
          </li>
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

  // SERVICES DROPDOWN: tap/click the arrow to open or close the programmes list.
  // (Bound once, even if the navbar component binds it too.)
  if (!window.__nlDropdownBound) {
    window.__nlDropdownBound = true;
    const closeAll = (except) => {
      document.querySelectorAll(".dropdown.open").forEach((dd) => {
        if (dd === except) return;
        dd.classList.remove("open");
        const a = dd.querySelector(".dropdown-arrow");
        if (a) a.setAttribute("aria-expanded", "false");
      });
    };
    document.addEventListener("click", (e) => {
      const arrow = e.target.closest(".dropdown-arrow");
      if (arrow) {
        e.preventDefault();   // the arrow only toggles; the word "SERVICES" still goes to services.html
        const dd = arrow.closest(".dropdown");
        const open = dd.classList.toggle("open");
        arrow.setAttribute("aria-expanded", String(open));
        return;
      }
      if (e.target.closest("#menu-toggle")) return closeAll();   // collapse when the mobile menu is toggled
      if (!e.target.closest(".dropdown")) closeAll();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
  }
})();
