/**
 * Public, read-only site logic.
 *
 * Every page here is reading only — there is no create/edit/delete UI
 * anywhere in this file, by design ("visitors can only read entries").
 *
 * Data loading tries the real API first and falls back to the bundled
 * sample data in data.js if the backend isn't reachable/implemented yet.
 * Once later phases finish wiring /api/entries and /api/categories, this
 * will start returning live data automatically — no changes needed here.
 */
(function () {
  const { qs, qsa } = window.DiaryUtils;

  const MOOD_COLORS = {
    great: 'var(--mood-great)',
    good: 'var(--mood-good)',
    neutral: 'var(--mood-neutral)',
    bad: 'var(--mood-bad)',
    terrible: 'var(--mood-terrible)',
  };

  async function loadEntries() {
    try {
      const data = await window.DiaryAPI.entries.list();
      if (Array.isArray(data) && data.length) return data;
      if (Array.isArray(data?.entries) && data.entries.length) return data.entries;
      throw new Error('empty');
    } catch (_err) {
      return window.DiaryMockData.entries;
    }
  }

  async function loadCategories() {
    try {
      const data = await window.DiaryAPI.categories.list();
      if (Array.isArray(data) && data.length) return data;
      if (Array.isArray(data?.categories) && data.categories.length) return data.categories;
      throw new Error('empty');
    } catch (_err) {
      return window.DiaryMockData.categories;
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  function categoryLabel(categories, categoryOrIdOrSlug) {
    if (categoryOrIdOrSlug && typeof categoryOrIdOrSlug === 'object') {
      return categoryOrIdOrSlug.name || 'Uncategorized';
    }
    const match = categories.find((c) => c._id === categoryOrIdOrSlug || c.slug === categoryOrIdOrSlug);
    return match ? match.name : categoryOrIdOrSlug || 'Uncategorized';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // --- Entry modal (shared by home / entries / search pages) ---

  function ensureModal() {
    let overlay = qs('#entryModal');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'entryModal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <button class="modal-close" aria-label="Close">&times;</button>
        <img id="modalImage" class="modal-card__image" alt="" loading="lazy" hidden />
        <p class="modal-card__meta" id="modalMeta"></p>
        <h2 id="modalTitle"></h2>
        <div class="tag-row" id="modalTags" style="margin-bottom: 1rem;"></div>
        <div class="modal-card__body" id="modalBody"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('modal-close')) {
        closeModal();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    return overlay;
  }

  function openModal(entry, categories) {
    const overlay = ensureModal();
    const imageEl = qs('#modalImage', overlay);
    const firstImage = Array.isArray(entry.images) && entry.images.length ? entry.images[0] : null;

    if (firstImage) {
      imageEl.src = firstImage.path;
      imageEl.hidden = false;
    } else {
      imageEl.hidden = true;
      imageEl.removeAttribute('src');
    }

    qs('#modalTitle', overlay).textContent = entry.title;
    qs('#modalMeta', overlay).textContent = `${formatDate(entry.date)} · ${categoryLabel(
      categories,
      entry.category
    )}`;
    const body = qs('#modalBody', overlay);

body.innerHTML = `
  <section class="modal-section">
    <h3>What I Worked On Today</h3>
    <p>${escapeHtml(entry.workedOn || '—')}</p>
  </section>

  <section class="modal-section">
    <h3>What I Learned Today</h3>
    <p>${escapeHtml(entry.learned || '—')}</p>
  </section>

  <section class="modal-section">
    <h3>Problems I Faced</h3>
    <p>${escapeHtml(entry.problems || '—')}</p>
  </section>

  <section class="modal-section">
    <h3>How I Solved Them</h3>
    <p>${escapeHtml(entry.solutions || '—')}</p>
  </section>
`;

    const tagsEl = qs('#modalTags', overlay);
    tagsEl.innerHTML = (entry.tags || [])
      .map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`)
      .join('');

    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = qs('#entryModal');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // --- Entry card builder (shared) ---

  function buildEntryCard(entry, categories) {
    const card = document.createElement('article');
    card.className = 'entry-card reveal';
    const firstImage = Array.isArray(entry.images) && entry.images.length ? entry.images[0] : null;
    card.innerHTML = `
      ${firstImage ? `<img class="entry-card__image" src="${firstImage.path}" alt="" loading="lazy" />` : ''}
      <div class="entry-card__meta">
        <span><span class="mood-dot" style="background:${MOOD_COLORS[entry.mood] || MOOD_COLORS.neutral}"></span>${formatDate(entry.date)}</span>
        <span class="category-badge">${escapeHtml(categoryLabel(categories, entry.category))}</span>
      </div>
      <h3 class="entry-card__title">${escapeHtml(entry.title)}</h3>
      <p class="entry-card__excerpt">${escapeHtml(entry.excerpt || entry.workedOn || '')}</p>
      <div class="entry-card__footer">
        <div class="tag-row">${(entry.tags || []).slice(0, 3).map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>
        <span class="entry-card__read">read →</span>
      </div>
    `;
    card.addEventListener('click', () => openModal(entry, categories));
    return card;
  }

  // --- Home page ---

  async function initHome() {
    const grid = qs('#featuredEntries');
    if (!grid) return;

    const [entries, categories] = await Promise.all([loadEntries(), loadCategories()]);
    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    const statTotal = qs('#statTotalEntries');
    const statCategories = qs('#statTotalCategories');
    if (statTotal) statTotal.textContent = entries.length;
    if (statCategories) statCategories.textContent = categories.length;

    sorted.slice(0, 3).forEach((entry) => grid.appendChild(buildEntryCard(entry, categories)));
    window.DiaryUtils.initScrollReveal();
  }

  // --- Diary Entries page ---

  async function initEntriesPage() {
    const grid = qs('#entriesGrid');
    if (!grid) return;

    const [entries, categories] = await Promise.all([loadEntries(), loadCategories()]);
    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    const filterRow = qs('#filterRow');
    const params = new URLSearchParams(window.location.search);
    let activeCategory = params.get('category') || 'all';

    function renderChips() {
      const chips = [{ slug: 'all', name: 'All' }, ...categories];
      filterRow.innerHTML = chips
        .map(
          (c) =>
            `<button class="filter-chip${c.slug === activeCategory ? ' is-active' : ''}" data-slug="${c.slug}">${escapeHtml(c.name)}</button>`
        )
        .join('');

      qsa('.filter-chip', filterRow).forEach((chip) => {
        chip.addEventListener('click', () => {
          activeCategory = chip.dataset.slug;
          renderChips();
          renderGrid();
        });
      });
    }

    function categoryIdentifier(entry) {
      return entry.category?.slug || entry.category?._id || entry.category || null;
    }

    function renderGrid() {
      grid.innerHTML = '';
      const filtered =
        activeCategory === 'all' ? sorted : sorted.filter((e) => categoryIdentifier(e) === activeCategory);

      if (!filtered.length) {
        grid.innerHTML = '<p class="empty-state">// no entries in this category yet</p>';
        return;
      }

      filtered.forEach((entry) => grid.appendChild(buildEntryCard(entry, categories)));
      window.DiaryUtils.initScrollReveal();
    }

    renderChips();
    renderGrid();
  }

  // --- Search page ---

  async function initSearchPage() {
    const input = qs('#searchInput');
    if (!input) return;

    const [entries, categories] = await Promise.all([loadEntries(), loadCategories()]);
    const resultsEl = qs('#searchResults');
    const metaEl = qs('#searchMeta');

    const categorySelect = qs('#filterCategory');
    const dateInput = qs('#filterDate');
    const monthSelect = qs('#filterMonth');
    const yearSelect = qs('#filterYear');
    const clearBtn = qs('#clearFiltersBtn');
    const filterToggle = qs('#filterToggle');
    const filterPanel = qs('#filterPanel');
    const filterCountBadge = qs('#filterCountBadge');

    // --- Fast search: precompute everything once up front, instead of
    // re-deriving date parts / search text on every keystroke or filter
    // change. Filtering below is then just cheap property comparisons
    // over data that's already normalized. ---
    const indexed = entries.map((entry) => {
      const d = new Date(entry.date);
      const searchText = [
        entry.title,
        entry.content || entry.excerpt || '',
        entry.workedOn || '',
        entry.learned || '',
        entry.problems || '',
        entry.solutions || '',
        (entry.tags || []).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return {
        entry,
        searchText,
        isoDate: Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10), // YYYY-MM-DD
        month: Number.isNaN(d.getTime()) ? '' : String(d.getMonth() + 1).padStart(2, '0'),
        year: Number.isNaN(d.getTime()) ? '' : String(d.getFullYear()),
        categoryId: entry.category?._id || entry.category || '',
      };
    });

    // --- Populate category + year selects from the actual data ---

    categorySelect.innerHTML =
      '<option value="">All categories</option>' +
      categories
        .map((c) => `<option value="${c._id || c.slug}">${escapeHtml(c.name)}</option>`)
        .join('');

    const years = [...new Set(indexed.map((i) => i.year).filter(Boolean))].sort((a, b) => b - a);
    yearSelect.innerHTML =
      '<option value="">All years</option>' + years.map((y) => `<option value="${y}">${y}</option>`).join('');

    function highlight(text, query) {
      if (!query) return escapeHtml(text);
      const escaped = escapeHtml(text);
      const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return escaped.replace(new RegExp(`(${escapedQuery})`, 'ig'), '<em>$1</em>');
    }

    function activeFilters() {
      return {
        query: input.value.trim(),
        category: categorySelect.value,
        date: dateInput.value,
        month: monthSelect.value,
        year: yearSelect.value,
      };
    }

    function updateFilterCount() {
      const f = activeFilters();
      const count = [f.category, f.date, f.month, f.year].filter(Boolean).length;
      if (count > 0) {
        filterCountBadge.textContent = String(count);
        filterCountBadge.hidden = false;
      } else {
        filterCountBadge.hidden = true;
      }
    }

    function render() {
      updateFilterCount();
      const { query, category, date, month, year } = activeFilters();
      const trimmedQuery = query.toLowerCase();

      const matches = indexed.filter((row) => {
        if (trimmedQuery && !row.searchText.includes(trimmedQuery)) return false;
        if (category && row.categoryId !== category) return false;
        if (date && row.isoDate !== date) return false;
        if (month && row.month !== month) return false;
        if (year && row.year !== year) return false;
        return true;
      });

      const hasAnyFilter = query || category || date || month || year;

      if (!hasAnyFilter) {
        resultsEl.innerHTML = '';
        metaEl.textContent = 'Start typing to search, or use filters to narrow by category and date.';
        return;
      }

      const filterBits = [];
      if (query) filterBits.push(`"${query}"`);
      if (category) filterBits.push(categorySelect.selectedOptions[0]?.textContent);
      if (date) filterBits.push(date);
      if (month) filterBits.push(monthSelect.selectedOptions[0]?.textContent);
      if (year) filterBits.push(year);

      metaEl.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'} for ${filterBits.join(' · ')}`;

      if (!matches.length) {
        resultsEl.innerHTML = '<p class="empty-state">// no entries match these filters</p>';
        return;
      }

      resultsEl.innerHTML = matches
        .map(
          ({ entry }) => `
        <div class="search-result" data-id="${entry._id || entry.id}">
          <div class="entry-card__meta" style="margin-bottom:0.5rem;">
            <span>${formatDate(entry.date)}</span>
            <span class="category-badge">${escapeHtml(categoryLabel(categories, entry.category?._id || entry.category))}</span>
          </div>
          <div class="search-result__title">${highlight(entry.title, query)}</div>
          <p class="search-result__excerpt">${highlight(entry.excerpt || entry.workedOn || '', query)}</p>
        </div>
      `
        )
        .join('');

      qsa('.search-result', resultsEl).forEach((el) => {
        el.addEventListener('click', () => {
          const row = indexed.find((i) => (i.entry._id || i.entry.id) === el.dataset.id);
          if (row) openModal(row.entry, categories);
        });
      });
    }

    // Text input: debounced (fast search — avoids re-filtering on every
    // single keystroke while still feeling instant).
    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(render, 120);
    });

    // Filter controls: apply immediately, no debounce needed.
    [categorySelect, dateInput, monthSelect, yearSelect].forEach((el) => {
      el.addEventListener('change', render);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      categorySelect.value = '';
      dateInput.value = '';
      monthSelect.value = '';
      yearSelect.value = '';
      render();
    });

    // Mobile filter panel toggle
    if (filterToggle && filterPanel) {
      filterToggle.addEventListener('click', () => {
        const isOpen = filterPanel.classList.toggle('is-open');
        filterToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    render();
  }

  // --- Categories page ---

  async function initCategoriesPage() {
    const grid = qs('#categoriesGrid');
    if (!grid) return;

    const [entries, categories] = await Promise.all([loadEntries(), loadCategories()]);

    grid.innerHTML = categories
      .map((cat) => {
        const count = entries.filter(
          (e) => (e.category?.slug || e.category?._id || e.category) === cat.slug
        ).length;
        return `
          <a class="category-card reveal" href="entries.html?category=${encodeURIComponent(cat.slug)}">
            <div class="category-card__swatch" style="background:${cat.color || 'var(--color-primary)'}"></div>
            <div class="category-card__name">${escapeHtml(cat.name)}</div>
            <p class="category-card__desc">${escapeHtml(cat.description || '')}</p>
            <div class="category-card__count">${count} ${count === 1 ? 'entry' : 'entries'}</div>
          </a>
        `;
      })
      .join('');

    window.DiaryUtils.initScrollReveal();
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.DiaryUtils.initChrome();
    initHome();
    initEntriesPage();
    initSearchPage();
    initCategoriesPage();
    window.DiaryUtils.initScrollReveal();
  });
})();
