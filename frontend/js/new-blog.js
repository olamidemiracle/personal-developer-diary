/**
 * Professional blog editor.
 *
 * The rich text toolbar itself lives in js/richEditor.js, shared with the
 * diary entry editor (new-entry.js) — this file only wires up the
 * blog-specific pieces: cover image, category/tags/excerpt sidebar,
 * preview modal, and save/publish.
 *
 * Supports both create (`new-blog.html`) and edit (`?edit=<id>`) in one
 * file, same convention as new-entry.js.
 */
(function () {
  const { qs, showError, hideError, redirectTo } = window.DiaryUtils;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const isEditMode = Boolean(editId);

  const canvas = () => qs('#editorCanvas');
  let richEditor;

  // --- Auth guard ---

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

  // --- Cover image ---

  let coverImageFile = null;
  let removeExistingCover = false;

  function wireCoverImage() {
    const input = qs('#coverImageInput');
    const preview = qs('#coverImagePreview');
    const removeBtn = qs('#removeCoverBtn');

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        showError(qs('#formError'), 'Cover image must be 5MB or smaller.');
        input.value = '';
        return;
      }

      coverImageFile = file;
      removeExistingCover = false;

      const reader = new FileReader();
      reader.onload = () => {
        preview.src = reader.result;
        preview.classList.add('is-visible');
        removeBtn.classList.add('is-visible');
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', () => {
      coverImageFile = null;
      removeExistingCover = true;
      input.value = '';
      preview.classList.remove('is-visible');
      preview.src = '';
      removeBtn.classList.remove('is-visible');
    });
  }

  // --- Preview modal ---

  function wirePreview() {
    const overlay = qs('#previewModal');

    qs('#previewBtn').addEventListener('click', () => {
      const title = qs('#blogTitle').value.trim() || 'Untitled post';
      const category = qs('#blogCategory').value.trim();

      qs('#previewTitle').textContent = title;
      qs('#previewMeta').textContent = category
        ? `${category} · ${qs('#wordStats').textContent}`
        : qs('#wordStats').textContent;
      qs('#previewBody').innerHTML = canvas().innerHTML;

      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('modal-close')) {
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }

  // --- Edit mode: prefill ---

  async function prefillForEdit() {
    qs('#pageEyebrow').textContent = 'edit';
    qs('#pageHeading').textContent = 'Edit Blog Post';
    qs('#pageSubtext').textContent = 'Update this blog post.';
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
    qs('#blogCategory').value = blog.category || '';
    qs('#blogTags').value = (blog.tags || []).join(', ');
    qs('#blogExcerpt').value = blog.excerpt || '';
    canvas().innerHTML = blog.content || '';

    if (blog.coverImage?.path) {
      const preview = qs('#coverImagePreview');
      preview.src = blog.coverImage.path;
      preview.classList.add('is-visible');
      qs('#removeCoverBtn').classList.add('is-visible');
    }

    if (blog.status === 'published') {
      qs('#saveDraftBtn').textContent = 'Unpublish (Save as Draft)';
      qs('#publishBtn').textContent = 'Save Changes';
    }

    richEditor.updateStats();
  }

  // --- Submit ---

  async function submitForm(status) {
    const errorEl = qs('#formError');
    hideError(errorEl);

    const title = qs('#blogTitle').value.trim();
    const content = canvas().innerHTML.trim();
    const plainText = canvas().innerText.trim();

    if (title.length < 3) {
      showError(errorEl, 'Title must be at least 3 characters.');
      return;
    }
    if (!plainText) {
      showError(errorEl, 'Content is required.');
      return;
    }

    const tags = qs('#blogTags')
      .value.split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    formData.append('excerpt', qs('#blogExcerpt').value.trim());
    formData.append('category', qs('#blogCategory').value.trim());
    formData.append('tags', JSON.stringify(tags));
    formData.append('status', status);
    if (coverImageFile) formData.append('coverImage', coverImageFile);
    if (isEditMode && removeExistingCover) formData.append('removeCoverImage', 'true');

    const activeBtn = status === 'published' ? qs('#publishBtn') : qs('#saveDraftBtn');
    const originalText = activeBtn.textContent;
    qs('#publishBtn').disabled = true;
    qs('#saveDraftBtn').disabled = true;
    activeBtn.textContent = status === 'published' ? 'Publishing…' : 'Saving…';

    try {
      if (isEditMode) {
        await window.DiaryAPI.blogs.update(editId, formData);
      } else {
        await window.DiaryAPI.blogs.create(formData);
      }

      qs('#publishSuccessText').textContent =
        status === 'published'
          ? 'Blog post published successfully. Redirecting to the homepage…'
          : 'Draft saved successfully. Redirecting to the homepage…';
      qs('#publishSuccess').classList.add('is-visible');
      qs('#newBlogForm').style.display = 'none';

      setTimeout(() => redirectTo('index.html'), 1200);
    } catch (err) {
      showError(errorEl, err.message || 'Failed to save this post. Please try again.');
      qs('#publishBtn').disabled = false;
      qs('#saveDraftBtn').disabled = false;
      activeBtn.textContent = originalText;
    }
  }

  function wireSubmitButtons() {
    qs('#newBlogForm').addEventListener('submit', (e) => e.preventDefault());

    qs('#publishBtn').addEventListener('click', (e) => {
      e.preventDefault();
      submitForm('published');
    });
    qs('#saveDraftBtn').addEventListener('click', (e) => {
      e.preventDefault();
      submitForm('draft');
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await requireAuth();
    if (!ok) return;

    window.DiaryUtils.initScrollReveal();

    richEditor = window.DiaryRichEditor.wire({
      uploadImage: async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const result = await window.DiaryAPI.blogs.uploadImage(formData);
        return result.url;
      },
    });

    wireCoverImage();
    wirePreview();
    wireSubmitButtons();

    if (isEditMode) {
      await prefillForEdit();
    }

    qs('#logoutBtn').addEventListener('click', async () => {
      try {
        await window.DiaryAPI.auth.logout();
      } finally {
        redirectTo('login.html');
      }
    });
  });
})();
