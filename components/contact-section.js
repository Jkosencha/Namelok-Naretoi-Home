(function () {
  const isRoot = !window.location.pathname.includes('/Stories/');
  const root = isRoot ? '' : '../';

  const contactEl = document.getElementById("contact-section");
  if (!contactEl) return;

  contactEl.innerHTML = `
    <section class="next-story-section">
      <div class="next-story-inner">
        <h2>Have questions or want to get involved?</h2>
        <p>Reach out to the Namelok Naretoi team, we'd love to hear from you.</p>
        <div class="next-story-actions">
          <a href="${root}contact.html" class="next-story-btn">Contact Us</a>
        </div>
      </div>
    </section>
  `;
})();
