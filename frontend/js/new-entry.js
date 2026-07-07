/**
 * New / Edit Diary Entry page.
 *
 * Shared by both flows via a `?edit=<id>` query param:
 *   - no param        -> create mode, POSTs to /api/entries
 *   - ?edit=<entryId>  -> edit mode, fetches the entry via
 *                         GET /api/entries/:id and PUTs changes back
 *
 * Everything here is real: the auth guard checks the live session, the
 * category list comes from GET /api/categories, and Publish/Save sends a
 * real multipart request that writes to MongoDB.
 *
 * Date and time are never collected from the user — the auto-timestamp
 * shown on this page is a live preview only; the actual `date` field is
 * captured server-side once, at creation, and never changes after that.
 */
(function () {
  const { qs, showError, hideError, redirectTo, showToast } = window.DiaryUtils;

  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  const isEditMode = Boolean(editId);

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

  // --- Live auto date/time preview (display only, not submitted) ---

  function startAutoTimestamp() {
    const el = qs('#autoTimestampText');
    if (!el) return;

    function tick() {
      el.textContent = new Date().toLocaleString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      });
    }

    tick();
    setInterval(tick, 1000);
  }

  // --- Categories ---

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function loadCategoriesIntoSelect(selectedCategoryId) {
    const select = qs('#entryCategory');

    let categories;
    try {
      categories = await window.DiaryAPI.categories.list();
      if (!Array.isArray(categories) || !categories.length) throw new Error('empty');
    } catch (_err) {
      categories = window.DiaryMockData?.categories || [];
    }

    select.innerHTML =
      '<option value="">No category</option>' +
      categories
        .map((c) => {
          const value = c._id || c.slug;
          return `<option value="${value}">${escapeHtml(c.name)}</option>`;
        })
        .join('');

    if (selectedCategoryId) {
      select.value = selectedCategoryId;
    }
  }

  // --- Image preview / removal ---

  let currentImageDataUrl = null;
  let removeExistingImage = false;

  function wireImageControls() {
    const input = qs('#entryImage');
    const preview = qs('#entryImagePreview');
    const removeBtn = qs('#removeImageBtn');
    const errorEl = qs('#formError');

    input.addEventListener('change', () => {
      hideError(errorEl);
      const file = input.files?.[0];
      if (!file) {
        currentImageDataUrl = null;
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        showError(errorEl, 'Image must be 5MB or smaller.');
        input.value = '';
        currentImageDataUrl = null;
        return;
      }

      removeExistingImage = false; // a new file supersedes any removal intent
      const reader = new FileReader();
      reader.onload = () => {
        currentImageDataUrl = reader.result;
        preview.src = reader.result;
        preview.classList.add('is-visible');
        removeBtn.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener('click', () => {
      removeExistingImage = true;
      currentImageDataUrl = null;
      input.value = '';
      preview.classList.remove('is-visible');
      preview.src = '';
      removeBtn.style.display = 'none';
    });
  }

  // --- Edit mode: prefill from the existing entry ---

  async function prefillForEdit() {
    qs('#pageEyebrow').textContent = 'edit';
    qs('#pageHeading').textContent = 'Edit Diary Entry';
    qs('#pageSubtext').textContent = "Update today's entry. The original publish date and time never change.";
    qs('#publishBtn').textContent = 'Save Changes';
    qs('#publishSuccessText').textContent = 'Entry updated successfully. Redirecting to the dashboard…';

    let entry;
    try {
      entry = await window.DiaryAPI.entries.get(editId);
    } catch (err) {
      showError(qs('#formError'), err.message || 'Could not load this entry.');
      qs('#newEntryForm').style.display = 'none';
      return;
    }

    qs('#entryTitle').value = entry.title || '';
    qs('#entryWorkedOn').value = entry.workedOn || '';
    qs('#entryLearned').value = entry.learned || '';
    qs('#entryProblems').value = entry.problems || '';
    qs('#entrySolutions').value = entry.solutions || '';

    await loadCategoriesIntoSelect(entry.category?._id || '');

    if (Array.isArray(entry.images) && entry.images.length) {
      const preview = qs('#entryImagePreview');
      const removeBtn = qs('#removeImageBtn');
      preview.src = entry.images[0].path;
      preview.classList.add('is-visible');
      removeBtn.style.display = 'inline-flex';
    }
  }

  // --- Submit (create or edit) ---

  async function handleSubmit(e) {
    e.preventDefault();

    const errorEl = qs('#formError');
    hideError(errorEl);

    const title = qs('#entryTitle').value.trim();
    const category = qs('#entryCategory').value;
    const workedOn = qs('#entryWorkedOn').value.trim();
    const learned = qs('#entryLearned').value.trim();
    const problems = qs('#entryProblems').value.trim();
    const solutions = qs('#entrySolutions').value.trim();
    const imageFile = qs('#entryImage').files?.[0];

    if (title.length < 3) {
      showError(errorEl, 'Title must be at least 3 characters.');
      return;
    }
    if (!workedOn) {
      showError(errorEl, '"What I Worked On Today" is required.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    if (category) formData.append('category', category);
    formData.append('workedOn', workedOn);
    formData.append('learned', learned);
    formData.append('problems', problems);
    formData.append('solutions', solutions);
    if (imageFile) formData.append('image', imageFile);
    if (isEditMode && removeExistingImage) formData.append('removeImage', 'true');

    const publishBtn = qs('#publishBtn');
    publishBtn.disabled = true;
    publishBtn.textContent = isEditMode ? 'Saving…' : 'Publishing…';

    try {
      if (isEditMode) {
        await window.DiaryAPI.entries.update(editId, formData);
      } else {
        await window.DiaryAPI.entries.create(formData);
      }

      qs('#publishSuccess').classList.add('is-visible');
      qs('#newEntryForm').style.display = 'none';

      const redirectFlag = isEditMode ? 'updated=1' : 'created=1';
      setTimeout(() => redirectTo(`dashboard.html?${redirectFlag}`), 1400);
    } catch (err) {
      showError(errorEl, err.message || 'Failed to save entry. Please try again.');
      publishBtn.disabled = false;
      publishBtn.textContent = isEditMode ? 'Save Changes' : 'Publish';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await requireAuth();
    if (!ok) return;

    startAutoTimestamp();
    wireImageControls();
    window.DiaryUtils.initScrollReveal();   // ← new line
    if (isEditMode) {
      await prefillForEdit();
    } else {
      await loadCategoriesIntoSelect();
    }

    qs('#newEntryForm').addEventListener('submit', handleSubmit);

    qs('#logoutBtn').addEventListener('click', async () => {
      try {
        await window.DiaryAPI.auth.logout();
      } finally {
        redirectTo('login.html');
      }
    });
  });
})();
