/**
 * Blog Details page.
 *
 * Reads `?slug=<slug>` (preferred, SEO-friendly) or `?id=<id>` from the
 * URL, fetches that single post via the backend's combined
 * GET /api/blogs/:idOrSlug route, and renders it. If the post doesn't
 * exist (or is an unpublished draft and the visitor isn't the admin),
 * shows a clean "not found" state instead of a broken page.
 */
(function () {
  const { qs } = window.DiaryUtils;

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function showNotFound() {
    qs('#notFoundState').hidden = false;
    qs('#blogContent').hidden = true;
  }

  function renderBlog(blog) {
    document.title = `${blog.title} — Olamide Miracle`;
    qs('#pageDescription').setAttribute('content', blog.excerpt || '');

    qs('#blogTitleDisplay').textContent = blog.title;
    qs('#blogMetaDate').textContent = formatDate(blog.publishedAt || blog.createdAt);
    qs('#blogMetaReadingTime').textContent = `${blog.readingTime} min read`;

    const categoryEl = qs('#blogMetaCategory');
    if (blog.category) {
      categoryEl.textContent = blog.category;
    } else {
      categoryEl.remove();
    }

    if (blog.status === 'draft') {
      const draftBadge = document.createElement('span');
      draftBadge.textContent = 'Draft (only visible to you)';
      draftBadge.style.color = '#fbbf24';
      qs('.blog-hero__meta').appendChild(draftBadge);
    }

    const tagsEl = qs('#blogTagsDisplay');
    tagsEl.innerHTML = (blog.tags || [])
      .map((t) => `<span class="tag-chip">#${escapeHtml(t)}</span>`)
      .join('');

    const coverEl = qs('#blogCoverDisplay');
    if (blog.coverImage?.path) {
      coverEl.src = blog.coverImage.path;
      coverEl.alt = blog.title;
      coverEl.hidden = false;
    }

    qs('#blogAuthorName').textContent = blog.administrator?.username
      ? blog.administrator.username
      : 'Olamide Miracle';

    // Trusted content: only the logged-in administrator can ever write
    // this HTML (see models/Blog.js) — same trust model as any
    // single-admin CMS, so rendering it directly is an accepted tradeoff.
    qs('#blogBodyDisplay').innerHTML = blog.content;

    qs('#notFoundState').hidden = true;
    qs('#blogContent').hidden = false;

    // Syntax-highlight any code blocks now that the content is in the DOM.
    if (window.Prism) {
      window.Prism.highlightAll();
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    window.DiaryUtils.initChrome();

    const params = new URLSearchParams(window.location.search);
    const identifier = params.get('slug') || params.get('id');

    if (!identifier) {
      showNotFound();
      return;
    }

    try {
      const blog = await window.DiaryAPI.blogs.get(identifier);
      renderBlog(blog);
    } catch (_err) {
      showNotFound();
    }
  });
})();
