/**
 * Administrator dashboard.
 *
 * Everything here is real as of Phase 7: entries are fetched from
 * GET /api/entries (MongoDB), Edit navigates to the shared entry-editing
 * page (new-entry.html?edit=<id>), and Delete calls the real
 * DELETE /api/entries/:id endpoint after a confirmation dialog.
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

  function excerptOf(entry) {
    const text = entry.workedOn || '';
    return text.length > 140 ? `${text.slice(0, 140).trim()}…` : text;
  }

  function countUp(el, target) {
    const duration = 600;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target;
      return;
    }
    requestAnimationFrame(tick);
  }

  // --- Auth guard ---

  async function requireAuth() {
    const gate = qs('#authGate');
    const root = qs('#dashRoot');

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

  // --- Data + stats ---

  async function fetchEntries() {
    return window.DiaryAPI.entries.list();
  }

  function computeStats(entries) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const categories = new Set(entries.map((e) => e.category?._id).filter(Boolean));
    const thisMonth = entries.filter((e) => new Date(e.date) >= startOfMonth).length;
    const thisWeek = entries.filter((e) => new Date(e.date) >= startOfWeek).length;

    return { total: entries.length, categories: categories.size, thisMonth, thisWeek };
  }

  function renderStats(entries) {
    const stats = computeStats(entries);
    countUp(qs('#statTotal'), stats.total);
    countUp(qs('#statCategories'), stats.categories);
    countUp(qs('#statMonth'), stats.thisMonth);
    countUp(qs('#statWeek'), stats.thisWeek);
  }

  // --- Rendering ---

  function buildEntryRow(entry) {
    const li = document.createElement('li');
    li.className = 'entry-row reveal';

    const categoryLabel = entry.category?.name || 'Uncategorized';
    const hasImage = Array.isArray(entry.images) && entry.images.length > 0;

    li.innerHTML = `
      <div class="entry-row__main" data-view-id="${entry._id}">
        <div class="entry-row__meta">
          <span>${formatDate(entry.date)}</span>
          <span class="category-badge">${escapeHtml(categoryLabel)}</span>
          ${hasImage ? '<span class="category-badge">📷 image</span>' : ''}
        </div>
        <div class="entry-row__title">${escapeHtml(entry.title)}</div>
        <p class="entry-card__excerpt" style="margin-top:0.3rem;">${escapeHtml(excerptOf(entry))}</p>
      </div>
      <div class="entry-row__actions">
        <button class="icon-btn" data-action="edit" data-id="${entry._id}" aria-label="Edit entry">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
        <button class="icon-btn icon-btn--danger" data-action="delete" data-id="${entry._id}" data-title="${escapeHtml(entry.title)}" aria-label="Delete entry">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;
    return li;
  }

  function renderEntryList(entries) {
    const listEl = qs('#entryList');
    listEl.innerHTML = '';

    if (!entries.length) {
      listEl.innerHTML =
        '<p class="empty-state">// no entries yet — click "New Entry" above to write your first one</p>';
      return;
    }

    entries.forEach((entry) => listEl.appendChild(buildEntryRow(entry)));
    window.DiaryUtils.initScrollReveal();

    qsa('[data-action="edit"]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => redirectTo(`new-entry.html?edit=${btn.dataset.id}`))
    );
    qsa('[data-action="delete"]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => openConfirmDelete(btn.dataset.id, btn.dataset.title))
    );
    qsa('.entry-row__main', listEl).forEach((row) =>
      row.addEventListener('click', () => openViewEntry(row.dataset.viewId))
    );
  }

  async function refreshDashboard() {
    const listEl = qs('#entryList');
    try {
      const entries = await fetchEntries();
      renderStats(entries);
      renderEntryList(entries);
    } catch (err) {
      listEl.innerHTML = `<p class="empty-state">// couldn't load entries: ${escapeHtml(err.message || 'unknown error')}</p>`;
      renderStats([]);
    }
  }

  // --- Delete confirmation ---
  // --- View entry modal ---

async function openViewEntry(entryId) {
  try {
    const entry = await window.DiaryAPI.entries.get(entryId);

    qs('#viewTitle').textContent = entry.title || '';
    qs('#viewCategory').textContent = entry.category?.name || 'Uncategorized';
    qs('#viewDate').textContent = new Date(entry.date).toLocaleString();

    qs('#viewWorkedOn').textContent = entry.workedOn || '';
    qs('#viewLearned').textContent = entry.learned || '';
    qs('#viewProblems').textContent = entry.problems || '';
    qs('#viewSolutions').textContent = entry.solutions || '';

    const img = qs('#viewImage');

    if (Array.isArray(entry.images) && entry.images.length) {
      img.src = entry.images[0].path;
      img.hidden = false;
    } else {
      img.hidden = true;
      img.src = '';
    }

    qs('#viewEntryModal').classList.add('is-open');
    document.body.style.overflow = 'hidden';

  } catch (err) {
    showToast(err.message || 'Failed to load entry.', 'error');
  }
}

function closeViewEntry() {
  qs('#viewEntryModal').classList.remove('is-open');
  document.body.style.overflow = '';
}
  let entryIdPendingDelete = null;

  function openConfirmDelete(entryId, title) {
    entryIdPendingDelete = entryId;
    qs('#confirmEntryTitle').textContent = title || 'this entry';
    const modal = qs('#confirmModal');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeConfirmDelete() {
    entryIdPendingDelete = null;
    qs('#confirmModal').classList.remove('is-open');
    document.body.style.overflow = '';
  }

  async function handleConfirmedDelete() {
    if (!entryIdPendingDelete) return;

    const deleteBtn = qs('#confirmDelete');
    deleteBtn.disabled = true;
    deleteBtn.textContent = 'Deleting…';

    try {
      await window.DiaryAPI.entries.remove(entryIdPendingDelete);
      closeConfirmDelete();
      showToast('Entry deleted successfully', 'success');
      await refreshDashboard();
    } catch (err) {
      showToast(err.message || 'Failed to delete entry', 'error');
    } finally {
      deleteBtn.disabled = false;
      deleteBtn.textContent = 'Delete';
    }
  }

  // --- Wiring ---

  function wireEvents() {
    qs('#confirmCancel').addEventListener('click', closeConfirmDelete);
    qs('#confirmDelete').addEventListener('click', handleConfirmedDelete);

    qs('#confirmModal').addEventListener('click', (e) => {
      if (e.target.id === 'confirmModal') closeConfirmDelete();
    });
    // View modal
qs('#closeViewEntry').addEventListener('click', closeViewEntry);

qs('#viewEntryModal').addEventListener('click', (e) => {
  if (e.target.id === 'viewEntryModal') {
    closeViewEntry();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeConfirmDelete();
    closeViewEntry();
  }
});

    qs('#logoutBtn').addEventListener('click', async () => {
      try {
        await window.DiaryAPI.auth.logout();
      } finally {
        redirectTo('login.html');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const ok = await requireAuth();
    if (!ok) return;

    const todayEl = qs('#todayDate');
    if (todayEl) {
      todayEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    // If we just came back from publishing/editing an entry, say so.
    const params = new URLSearchParams(window.location.search);
    if (params.get('created') === '1') showToast('Entry published successfully', 'success');
    if (params.get('updated') === '1') showToast('Entry updated successfully', 'success');

    wireEvents();
    await refreshDashboard();
  });
})();
