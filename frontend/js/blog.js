/**
 * Blog posts on the Homepage.
 *
 * Completely independent of js/public.js (which handles diary entries) —
 * separate data source (GET /api/blogs, not /api/entries), separate
 * rendering, separate modal. The only thing shared is DiaryUtils/DiaryAPI
 * and the visual language (reusing .entry-card/.modal-overlay/.icon-btn
 * classes that already exist), so blog posts look at home on the same
 * page without duplicating CSS.
 *
 * Reading is public — no auth check gates the list itself. Edit/Delete
 * controls only appear if the current visitor happens to be the logged-in
 * administrator (checked silently via GET /api/auth/me; failure just
 * means "show it as a normal visitor would see it," never a redirect or
 * an error visitors would notice).
 */
(function () {
  const { qs, qsa, redirectTo, showToast } = window.DiaryUtils;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  function excerptOf(content, max = 160) {
    const text = (content || '').trim();
    return text.length > max ? `${text.slice(0, max).trim()}…` : text;
  }

  async function loadBlogs() {
    try {
      const data = await window.DiaryAPI.blogs.list();
      return Array.isArray(data) ? data : [];
    } catch (_err) {
      return [];
    }
  }

  async function checkIsAdmin() {
    try {
      await window.DiaryAPI.auth.me();
      return true;
    } catch (_err) {
      return false; // not logged in — normal visitor view, no error shown
    }
  }

  // --- Read modal ---

  function ensureBlogModal() {
    let overlay = qs('#blogModal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'blogModal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <button class="modal-close" aria-label="Close">&times;</button>
        <p class="modal-card__meta" id="blogModalMeta"></p>
        <h2 id="blogModalTitle"></h2>
        <div class="modal-card__body" id="blogModalBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('modal-close')) {
        closeBlogModal();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeBlogModal();
    });

    return overlay;
  }

  function openBlogModal(blog) {
    const overlay = ensureBlogModal();
    qs('#blogModalTitle', overlay).textContent = blog.title;
    qs('#blogModalMeta', overlay).textContent = formatDate(blog.createdAt);
    qs('#blogModalBody', overlay).textContent = blog.content;

    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeBlogModal() {
    const overlay = qs('#blogModal');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // --- Delete confirm ---

  function ensureConfirmModal() {
    let overlay = qs('#blogConfirmModal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'blogConfirmModal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card confirm-card" role="dialog" aria-modal="true">
        <div class="confirm-card__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <h2>Delete this blog post?</h2>
        <p>"<span id="blogConfirmTitle"></span>" will be permanently removed. This can't be undone.</p>
        <div class="form-actions">
          <button type="button" class="btn btn--secondary" id="blogConfirmCancel">Cancel</button>
          <button type="button" class="btn btn--primary" id="blogConfirmDelete" style="background-color: var(--color-danger);">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeConfirmModal();
    });
    qs('#blogConfirmCancel', overlay).addEventListener('click', closeConfirmModal);

    return overlay;
  }

  function closeConfirmModal() {
    const overlay = qs('#blogConfirmModal');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  let pendingDeleteId = null;

  function openConfirmModal(blogId, title) {
    const overlay = ensureConfirmModal();
    pendingDeleteId = blogId;
    qs('#blogConfirmTitle', overlay).textContent = title;

    const deleteBtn = qs('#blogConfirmDelete', overlay);
    // Replace the button so we never stack duplicate click listeners
    // across repeated opens.
    const freshBtn = deleteBtn.cloneNode(true);
    deleteBtn.replaceWith(freshBtn);
    freshBtn.addEventListener('click', async () => {
      freshBtn.disabled = true;
      freshBtn.textContent = 'Deleting…';
      try {
        await window.DiaryAPI.blogs.remove(pendingDeleteId);
        closeConfirmModal();
        showToast('Blog post deleted successfully', 'success');
        await renderBlogSection();
      } catch (err) {
        showToast(err.message || 'Failed to delete blog post', 'error');
      } finally {
        freshBtn.disabled = false;
        freshBtn.textContent = 'Delete';
      }
    });

    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  // --- Card rendering ---

  function buildBlogCard(blog, isAdmin) {
    const card = document.createElement('article');
    card.className = 'entry-card reveal';
    card.innerHTML = `
      <div class="entry-card__meta">
        <span>${formatDate(blog.createdAt)}</span>
      </div>
      <h3 class="entry-card__title">${escapeHtml(blog.title)}</h3>
      <p class="entry-card__excerpt">${escapeHtml(excerptOf(blog.content))}</p>
      <div class="entry-card__footer">
        <span class="entry-card__read">read →</span>
        ${
          isAdmin
            ? `<div class="entry-row__actions" style="flex-shrink:0;">
                 <button class="icon-btn" data-action="edit-blog" data-id="${blog._id}" aria-label="Edit blog post">
                   <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                 </button>
                 <button class="icon-btn icon-btn--danger" data-action="delete-blog" data-id="${blog._id}" data-title="${escapeHtml(blog.title)}" aria-label="Delete blog post">
                   <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                 </button>
               </div>`
            : ''
        }
      </div>
    `;

    card.addEventListener('click', (e) => {
      // Edit/Delete buttons handle their own clicks — don't also open
      // the read modal when one of those was what was actually clicked.
      if (e.target.closest('[data-action]')) return;
      openBlogModal(blog);
    });

    return card;
  }

  async function renderBlogSection() {
    const section = qs('#blogSection');
    const listEl = qs('#blogList');
    if (!listEl) return; // this page doesn't have a blog section

    const [blogs, isAdmin] = await Promise.all([loadBlogs(), checkIsAdmin()]);

    if (!blogs.length) {
      // No published posts yet — hide the section entirely rather than
      // showing an empty "From the Blog" heading with nothing under it.
      if (section) section.hidden = true;
      return;
    }

    if (section) section.hidden = false;
    listEl.innerHTML = '';
    blogs.forEach((blog) => listEl.appendChild(buildBlogCard(blog, isAdmin)));
    window.DiaryUtils.initScrollReveal();

    qsa('[data-action="edit-blog"]', listEl).forEach((btn) => {
      btn.addEventListener('click', () => redirectTo(`new-blog.html?edit=${btn.dataset.id}`));
    });
    qsa('[data-action="delete-blog"]', listEl).forEach((btn) => {
      btn.addEventListener('click', () => openConfirmModal(btn.dataset.id, btn.dataset.title));
    });
  }

  document.addEventListener('DOMContentLoaded', renderBlogSection);
})();
