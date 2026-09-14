(function () {
  const isRoot = !window.location.pathname.includes('/Stories/');
  const root = isRoot ? '' : '../';

  const footerEl = document.getElementById("footer");
  if (!footerEl) return;

  footerEl.innerHTML = `
    <footer class="namelok-footer">
      <div class="footer-container">
        <div class="footer-section about">
          <h2>The Power of Giving</h2>
          <p>Support a cause and make a difference through charity.</p>
          <div class="footer-donate">
            <a href="${root}donate.html" class="donate-btn">Donate</a>
          </div>
        </div>
        <div class="footer-section links">
          <h3>About</h3>
          <ul>
            <li><a href="${root}about.html">About Us</a></li>
            <li><a href="${root}about.html#history">Our History</a></li>
            <li><a href="${root}about.html#programs">Our Programs</a></li>
          </ul>
        </div>
        <div class="footer-section links">
          <h3>Ways to Give</h3>
          <ul>
            <li><a href="${root}donate.html">Donate Now</a></li>
            <li><a href="${root}donate.html#panel-mpesa">M-Pesa</a></li>
            <li><a href="${root}donate.html#panel-paypal">PayPal</a></li>
          </ul>
        </div>
        <div class="footer-section contact">
          <h3>Contact Info</h3>
          <p>Narok, Kenya</p>
          <a href="mailto:jenniferkosencha@gmail.com">jenniferkosencha@gmail.com</a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} Namelok Naretoi Home. All rights reserved.</p>
      </div>
    </footer>
  `;
})();