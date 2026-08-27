/**
 * Shared rich-text editor toolbar, used by both the blog editor
 * (new-blog.js) and the diary entry editor (new-entry.js) so the
 * bold/italic/heading/list/code/link/image/video/table toolbar isn't
 * duplicated between them.
 *
 * Built on `document.execCommand` — deprecated but still supported in
 * every current major browser, and the only way to get a real WYSIWYG
 * editor in plain vanilla JS without pulling in an external editor
 * library (which this project's stack deliberately avoids). Content is
 * the editor's raw `innerHTML`; the only person who can ever write it is
 * the logged-in administrator, so rendering it directly elsewhere is an
 * accepted tradeoff (same trust model as Blog.content).
 *
 * Expects a fixed set of element ids on the page: #editorCanvas,
 * #editorToolbar, #btnCodeBlock, #btnLink, #btnImage, #btnVideo,
 * #btnTable, #btnHr, #btnUndo, #wordStats (optional), #formError
 * (optional). The only page-specific piece is `uploadImage`, since the
 * blog and diary-entry editors upload to different endpoints with
 * different response shapes.
 */
(function () {
  const { qs, qsa, showError } = window.DiaryUtils;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Turns a pasted YouTube or Vimeo URL into an embeddable player URL. */
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

  /**
   * Wires up the toolbar against #editorCanvas.
   * @param {{ uploadImage: (file: File) => Promise<string> }} config
   *   uploadImage must resolve to the inserted <img>'s src URL.
   * @returns {{ updateStats: () => void }}
   */
  function wire({ uploadImage }) {
    const canvas = qs('#editorCanvas');
    const errorEl = qs('#formError');

    function insertHtml(html) {
      canvas.focus();
      document.execCommand('insertHTML', false, html);
    }

    function updateStats() {
      const statsEl = qs('#wordStats');
      if (!statsEl) return;
      const text = canvas.innerText || '';
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      const minutes = Math.max(1, Math.ceil(words / 200));
      statsEl.textContent = `${words} word${words === 1 ? '' : 's'} · ${minutes} min read`;
    }

    function updateToolbarState() {
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

    qsa('.toolbar-btn[data-cmd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        canvas.focus();
        document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
        updateToolbarState();
        updateStats();
      });
    });

    qs('#btnCodeBlock')?.addEventListener('click', () => {
      const selection = window.getSelection();
      const selectedText = selection && selection.toString();
      // Defaults to JavaScript for syntax highlighting on the detail page
      // (Prism.js) — the most common case for this app's authoring.
      const codeText = selectedText ? escapeHtml(selectedText) : 'your code here';
      insertHtml(`<pre><code class="language-javascript">${codeText}</code></pre><p><br></p>`);
    });

    qs('#btnLink')?.addEventListener('click', () => {
      const url = prompt('Link URL (including https://):');
      if (!url) return;
      canvas.focus();
      document.execCommand('createLink', false, url);
    });

    if (qs('#btnImage')) {
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
          showError(errorEl, 'Image must be 5MB or smaller.');
          return;
        }

        const caption = prompt('Image caption (optional):') || '';
        try {
          const url = await uploadImage(file);
          const figureHtml = caption
            ? `<figure><img src="${url}" alt="${escapeHtml(caption)}" /><figcaption>${escapeHtml(caption)}</figcaption></figure><p><br></p>`
            : `<img src="${url}" alt="" /><p><br></p>`;
          insertHtml(figureHtml);
        } catch (err) {
          showError(errorEl, err.message || 'Image upload failed.');
        }
      });
    }

    qs('#btnVideo')?.addEventListener('click', () => {
      const url = prompt('YouTube or Vimeo video URL:');
      if (!url) return;

      const embedUrl = toEmbedUrl(url);
      if (!embedUrl) {
        showError(errorEl, 'Could not recognize that as a YouTube or Vimeo URL.');
        return;
      }

      insertHtml(
        `<div class="video-embed"><iframe src="${embedUrl}" allowfullscreen loading="lazy"></iframe></div><p><br></p>`
      );
    });

    qs('#btnTable')?.addEventListener('click', () => {
      insertHtml(`
        <table>
          <thead><tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr></thead>
          <tbody>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          </tbody>
        </table><p><br></p>`);
    });

    qs('#btnHr')?.addEventListener('click', () => insertHtml('<hr /><p><br></p>'));

    qs('#btnUndo')?.addEventListener('click', () => {
      canvas.focus();
      document.execCommand('undo');
    });

    canvas.addEventListener('input', updateStats);
    canvas.addEventListener('keyup', updateToolbarState);
    canvas.addEventListener('mouseup', updateToolbarState);
    updateStats();

    return { updateStats };
  }

  window.DiaryRichEditor = { wire };
})();
