/**
 * Professional blog editor.
 *
 * The rich text toolbar is built on `document.execCommand` — yes, it's
 * a deprecated API, but it remains supported in every current major
 * browser and is the only way to build a real WYSIWYG editor in plain
 * vanilla JS without pulling in an external editor library (which this
 * project's stack deliberately avoids). Content is stored as the
 * editor's raw `innerHTML`, trusted because the only person who can ever
 * write it is the logged-in administrator — the same trust model as any
 * single-admin CMS.
 *
 * Supports both create (`new-blog.html`) and edit (`?edit=<id>`) in one
 * file, same convention as new-entry.js.
 */
(function () {
  const { qs, qsa, showError, hideError, redirectTo } = window.DiaryUtils;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const isEditMode = Boolean(editId);

  const canvas = () => qs('#editorCanvas');

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

  // --- Toolbar: simple formatting commands ---

  function wireBasicToolbarButtons() {
    qsa('.toolbar-btn[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        canvas().focus();
        const cmd = btn.dataset.cmd;
        const value = btn.dataset.value || null;
        document.execCommand(cmd, false, value);
        updateToolbarState();
        updateWordStats();
      });
    });
  }

  function updateToolbarState() {
    // Reflect current selection's formatting on the toolbar (bold/italic/
    // underline highlighted when the cursor is inside formatted text).
    ['bold', 'italic', 'underline'].forEach((cmd) => {
      const btn = qs(`.toolbar-btn[data-cmd="${cmd}"]`);
      if (!btn) return;
      let active = false;
      try {
        active = document.queryCommandState(cmd);
      } catch (_err) {
        active = false;
      }
      btn.classList.toggle('is-active', active);
    });
  }

  // --- Toolbar: custom insertions (code block, link, image, video, table, hr) ---

  function insertHtml(html) {
    canvas().focus();
    document.execCommand('insertHTML', false, html);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function wireCodeBlock() {
    qs('#btnCodeBlock').addEventListener('click', () => {
      const selection = window.getSelection();
      const selectedText = selection && selection.toString();
      const codeText = selectedText ? escapeHtml(selectedText) : 'your code here';
      // Defaults to JavaScript for syntax highlighting on the detail page
      // (Prism.js) — the most common case for a developer's blog. Not
      // configurable per-block in this editor; a reasonable practical
      // default rather than building a full language picker.
      insertHtml(`<pre><code class="language-javascript">${codeText}</code></pre><p><br></p>`);
    });
  }

  function wireLink() {
    qs('#btnLink').addEventListener('click', () => {
      const url = prompt('Link URL (including https://):');
      if (!url) return;
      canvas().focus();
      document.execCommand('createLink', false, url);
    });
  }

  function wireImage() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    qs('#btnImage').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        showError(qs('#formError'), 'Image must be 5MB or smaller.');
        return;
      }

      const caption = prompt('Image caption (optional):') || '';
      const formData = new FormData();
      formData.append('image', file);

      try {
        const result = await window.DiaryAPI.blogs.uploadImage(formData);
        const figureHtml = caption
          ? `<figure><img src="${result.url}" alt="${escapeHtml(caption)}" /><figcaption>${escapeHtml(caption)}</figcaption></figure><p><br></p>`
          : `<img src="${result.url}" alt="" /><p><br></p>`;
        insertHtml(figureHtml);
      } catch (err) {
        showError(qs('#formError'), err.message || 'Image upload failed.');
      }
    });
  }

  /**
   * Turns a pasted YouTube or Vimeo URL into an embeddable iframe. Only
   * URL-based embedding is supported (not uploading video files) — that
   * keeps this practical without adding video transcoding/storage
   * infrastructure this app doesn't otherwise need.
   */
  function toEmbedUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);

      if (url.hostname.includes('youtube.com')) {
        const videoId = url.searchParams.get('v');
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }
      if (url.hostname === 'youtu.be') {
        const videoId = url.pathname.slice(1);
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }
      if (url.hostname.includes('vimeo.com')) {
        const videoId = url.pathname.split('/').filter(Boolean).pop();
        if (videoId) return `https://player.vimeo.com/video/${videoId}`;
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  function wireVideo() {
    qs('#btnVideo').addEventListener('click', () => {
      const url = prompt('YouTube or Vimeo video URL:');
      if (!url) return;

      const embedUrl = toEmbedUrl(url);
      if (!embedUrl) {
        showError(qs('#formError'), 'Could not recognize that as a YouTube or Vimeo URL.');
        return;
      }

      insertHtml(
        `<div class="video-embed"><iframe src="${embedUrl}" allowfullscreen loading="lazy"></iframe></div><p><br></p>`
      );
    });
  }

  function wireTable() {
    qs('#btnTable').addEventListener('click', () => {
      const table = `
        <table>
          <thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead>
          <tbody>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          </tbody>
        </table><p><br></p>`;
      insertHtml(table);
    });
  }

  function wireHr() {
    qs('#btnHr').addEventListener('click', () => insertHtml('<hr /><p><br></p>'));
  }

  function wireUndo() {
    qs('#btnUndo').addEventListener('click', () => {
      canvas().focus();
      document.execCommand('undo');
    });
  }

  // --- Word count / reading time (live estimate, mirrors the backend's own calculation) ---

  function updateWordStats() {
    const text = canvas().innerText || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 200));
    qs('#wordStats').textContent = `${words} word${words === 1 ? '' : 's'} · ${minutes} min read`;
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

    updateWordStats();
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

    wireBasicToolbarButtons();
    wireCodeBlock();
    wireLink();
    wireImage();
    wireVideo();
    wireTable();
    wireHr();
    wireUndo();
    wireCoverImage();
    wirePreview();
    wireSubmitButtons();

    canvas().addEventListener('input', updateWordStats);
    canvas().addEventListener('keyup', updateToolbarState);
    canvas().addEventListener('mouseup', updateToolbarState);
    updateWordStats();

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
