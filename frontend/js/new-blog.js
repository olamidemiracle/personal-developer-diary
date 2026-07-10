/**
 * New / Edit Blog Post page.
 *
 * Deliberately simple, matching the page itself: just a title and a
 * content field. Supports edit via `?edit=<id>`, same convention as
 * new-entry.js, but this is a fully separate file/flow — blog posts and
 * diary entries never share code paths, only the same auth system.
 *
 * On success, redirects to the Homepage (index.html), not the dashboard —
 * that's where published posts are meant to be seen.
 */
(function () {
  const { qs, showError, hideError, redirectTo } = window.DiaryUtils;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const isEditMode = Boolean(editId);

  // --- Auth guard (reuses the same session check as every other admin page) ---

  async function requireAuth() {
    const gate = qs('#authGate');
    const root = qs('#pageRoot');

    try {
      const admin = await window.DiaryAPI.auth.me();
      gate.style.display = 'none';
      root.hidden = false;

      const welcome = qs('#welcomeUser');
      if (welcome && admin?.username) welcome.textContent = admin.username;

      return true;
    } catch (_err) {
      redirectTo('login.html');
      return false;
    }
  }

  // --- Edit mode: prefill from the existing post ---

  async function prefillForEdit() {
    qs('#pageEyebrow').textContent = 'edit';
    qs('#pageHeading').textContent = 'Edit Blog Post';
    qs('#pageSubtext').textContent = 'Update this blog post.';
    qs('#publishBtn').textContent = 'Save Changes';
    qs('#publishSuccessText').textContent = 'Blog post updated successfully. Redirecting to the homepage…';

    let blog;
    try {
      blog = await window.DiaryAPI.blogs.get(editId);
    } catch (err) {
      showError(qs('#formError'), err.message || 'Could not load this blog post.');
      qs('#newBlogForm').style.display = 'none';
      return;
    }

    qs('#blogTitle').value = blog.title || '';
    qs('#blogContent').value = blog.content || '';
  }

  // --- Submit (create or edit) ---

  async function handleSubmit(e) {
    e.preventDefault();

    const errorEl = qs('#formError');
    hideError(errorEl);

    const title = qs('#blogTitle').value.trim();
    const content = qs('#blogContent').value.trim();

    if (title.length < 3) {
      showError(errorEl, 'Title must be at least 3 characters.');
      return;
    }
    if (!content) {
      showError(errorEl, 'Content is required.');
      return;
    }

    const payload = { title, content };

    const publishBtn = qs('#publishBtn');
    publishBtn.disabled = true;
    publishBtn.textContent = isEditMode ? 'Saving…' : 'Publishing…';

    try {
      if (isEditMode) {
        await window.DiaryAPI.blogs.update(editId, payload);
      } else {
        await window.DiaryAPI.blogs.create(payload);
      }

      qs('#publishSuccess').classList.add('is-visible');
      qs('#newBlogForm').style.display = 'none';

      // Requirement: publishing redirects to the Homepage, not the
      // Dashboard — that's where blog posts are meant to be read.
      setTimeout(() => redirectTo('index.html'), 1200);
    } catch (err) {
      showError(errorEl, err.message || 'Failed to save this post. Please try again.');
      publishBtn.disabled = false;
      publishBtn.textContent = isEditMode ? 'Save Changes' : 'Publish';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await requireAuth();
    if (!ok) return;

    window.DiaryUtils.initScrollReveal();

    if (isEditMode) {
      await prefillForEdit();
    }

    qs('#newBlogForm').addEventListener('submit', handleSubmit);

    qs('#logoutBtn').addEventListener('click', async () => {
      try {
        await window.DiaryAPI.auth.logout();
      } finally {
        redirectTo('login.html');
      }
    });
  });
})();
