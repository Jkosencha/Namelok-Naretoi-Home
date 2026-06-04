(function () {
  const isRoot = !window.location.pathname.includes('/Stories/');
  const root = isRoot ? '' : '../';

  const contactEl = document.getElementById("contact-section");
  if (!contactEl) return;

  contactEl.innerHTML = `
    <section class="contact-cta-strip-global">
      <div class="cta-strip-inner">
        <div class="cta-strip-text">
          <h3>Have questions or want to get involved?</h3>
          <p>Reach out to the Namelok Naretoi team — we'd love to hear from you.</p>
        </div>
        <a href="${root}contact.html" class="cta-strip-btn">Contact Us</a>
      </div>
    </section>
  `;
})();