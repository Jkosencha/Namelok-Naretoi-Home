(function () {
  const isRoot = !window.location.pathname.includes('/Stories/');
  const root = isRoot ? '' : '../';

  const footerEl = document.getElementById("footer");
  if (!footerEl) return;

  footerEl.innerHTML = `
    <footer class="namelok-footer">
      <div class="footer-container">
        <div class="footer-brand">
          <a href="${root}index.html" class="footer-logo">
            <img src="${root}images/logo.png" alt="" />
            <span>Namelok Naretoi Home</span>
          </a>
          <p>Caring for children with disabilities and girls rescued from FGM and early marriage in Narok, Kenya, since 1991.</p>
          <a href="${root}donate.html" class="donate-btn">Donate</a>
        </div>
        <div class="footer-col">
          <h3>Explore</h3>
          <ul>
            <li><a href="${root}index.html">Home</a></li>
            <li><a href="${root}about.html">About Us</a></li>
            <li><a href="${root}stories.html">Stories</a></li>
            <li><a href="${root}gallery.html">Gallery</a></li>
            <li><a href="${root}contact.html">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>Get Involved</h3>
          <ul>
            <li><a href="${root}donate.html">Donate</a></li>
            <li><a href="${root}index.html#volunteer">Volunteer</a></li>
            <li><a href="${root}about.html#programs">Our Programs</a></li>
            <li><a href="${root}about.html#history">Our History</a></li>
          </ul>
        </div>
        <div class="footer-col footer-contact">
          <h3>Contact</h3>
          <ul>
            <li>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>
              <span>Narok, Kenya</span>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>
              <a href="tel:+254722537380">0722 537 380</a>
            </li>
            <li>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
              <a href="mailto:jenniferkosencha@gmail.com">jenniferkosencha@gmail.com</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} Namelok Naretoi Home. All rights reserved.</p>
        <p>Narok, Kenya</p>
      </div>
    </footer>
  `;
})();