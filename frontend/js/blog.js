/**
 * Blog feed on the Homepage.
 *
 * Completely independent of js/public.js (diary entries) — separate data
 * source (GET /api/blogs), separate rendering, no shared modal. Reading
 * is public; Edit/Delete controls only appear if the current visitor
 * happens to be the logged-in administrator (checked silently via
 * GET /api/auth/me — failure just means "render it the way a normal
 * visitor would see it," never a redirect or a visible error).
 *
 * Clicking a post now navigates to a dedicated detail page
 * (blog-post.html?slug=...) instead of opening a modal, per the
 * "professional blogging platform" redesign.
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
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  async function loadBlogs(filters = {}) {
    try {
      const data = await window.DiaryAPI.blogs.list(filters);
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

  // --- Delete confirm (styled, reused pattern from the dashboard) ---

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
    card.className = 'blog-card reveal';

    const cover = blog.coverImage?.path
      ? `<img class="blog-card__cover" src="${blog.coverImage.path}" alt="" loading="lazy" />`
      : `<div class="blog-card__cover-placeholder">no cover image</div>`;

    const isDraft = blog.status === 'draft';

    card.innerHTML = `
      ${cover}
      <div class="blog-card__body">
        <div class="blog-card__meta-row">
          <span>${formatDate(blog.publishedAt || blog.createdAt)}</span>
          <span>·</span>
          <span>${blog.readingTime} min read</span>
          ${blog.category ? `<span class="blog-card__badge">${escapeHtml(blog.category)}</span>` : ''}
          ${isDraft ? '<span class="blog-card__badge blog-card__badge--draft">Draft</span>' : ''}
        </div>
        <h3 class="blog-card__title">${escapeHtml(blog.title)}</h3>
        <p class="blog-card__excerpt">${escapeHtml(blog.excerpt)}</p>
        ${
          blog.tags?.length
            ? `<div class="blog-card__tags">${blog.tags
                .slice(0, 3)
                .map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`)
                .join('')}</div>`
            : ''
        }
        <div class="blog-card__footer">
          <a href="blog-post.html?slug=${encodeURIComponent(blog.slug)}" class="blog-card__read-more">
            Read more →
          </a>
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
      </div>
    `;

    return card;
  }

  // --- Category filters ---

  function renderFilterBar(blogs, activeCategory, onSelect) {
    const bar = qs('#blogFilterBar');
    if (!bar) return;

    const categories = [...new Set(blogs.map((b) => b.category).filter(Boolean))];
    if (!categories.length) {
      bar.innerHTML = '';
      return;
    }

    const chips = [{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))];
    bar.innerHTML = chips
      .map(
        (c) =>
          `<button type="button" class="blog-filter-chip${c.value === activeCategory ? ' is-active' : ''}" data-category="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`
      )
      .join('');

    qsa('.blog-filter-chip', bar).forEach((chip) => {
      chip.addEventListener('click', () => onSelect(chip.dataset.category));
    });
  }

  let activeCategory = '';

  async function renderBlogSection() {
    const section = qs('#blogSection');
    const listEl = qs('#blogList');
    if (!listEl) return; // this page doesn't have a blog section

    const [allBlogs, isAdmin] = await Promise.all([loadBlogs(), checkIsAdmin()]);

    if (!allBlogs.length) {
      if (section) section.hidden = true;
      return;
    }

    if (section) section.hidden = false;

    renderFilterBar(allBlogs, activeCategory, (category) => {
      activeCategory = category;
      renderBlogSection();
    });

    const filtered = activeCategory ? allBlogs.filter((b) => b.category === activeCategory) : allBlogs;

    listEl.innerHTML = '';
    if (!filtered.length) {
      listEl.innerHTML = '<p class="empty-state">// no posts in this category yet</p>';
      return;
    }

    filtered.forEach((blog) => listEl.appendChild(buildBlogCard(blog, isAdmin)));
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
