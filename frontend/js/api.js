/**
 * Thin fetch wrapper for talking to the Developer Diary backend.
 * All endpoints will be implemented in later phases (auth, entries, uploads);
 * this file just centralizes the request logic so pages stay simple.
 */
(function () {
  const BASE_URL = window.location.origin.includes('5500')
  ? 'http://127.0.0.1:5000/api' // when frontend is served separately (e.g. Live Server)
  : '/api'; // when frontend is served by Express itself

  async function request(path, { method = 'GET', body } = {}) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    const options = {
      method,
      credentials: 'include', // send the httpOnly JWT cookie
      // For FormData, no Content-Type header — the browser sets one
      // (including the multipart boundary) automatically.
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      cache: 'no-store',   // ← this is the only new line
    };

    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = Array.isArray(data.errors) ? ` ${data.errors.join(' ')}` : '';
      throw new Error((data.message || `Request failed with status ${response.status}`) + detail);
    }

    return data;
  }

  const DiaryAPI = {
    auth: {
      // No register() — there is no public registration route (Phase 2).
      login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
      logout: () => request('/auth/logout', { method: 'POST' }),
      me: () => request('/auth/me'),
    },
    entries: {
      list: () => request('/entries'),
      get: (id) => request(`/entries/${id}`),
      // `payload` can be a plain object (JSON) or a FormData instance
      // (when publishing with an image) — request() handles both.
      create: (payload) => request('/entries', { method: 'POST', body: payload }),
      update: (id, payload) => request(`/entries/${id}`, { method: 'PUT', body: payload }),
      remove: (id) => request(`/entries/${id}`, { method: 'DELETE' }),
    },
    categories: {
      list: () => request('/categories'),
    },
    // Blog posts are a separate content type from diary entries — see
    // backend/models/Blog.js. Reads are public; writes require login
    // (enforced server-side, same `protect` middleware as everything else).
    blogs: {
      list: (params = {}) => {
        const query = new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
        ).toString();
        return request(`/blogs${query ? `?${query}` : ''}`);
      },
      get: (idOrSlug) => request(`/blogs/${idOrSlug}`),
      create: (payload) => request('/blogs', { method: 'POST', body: payload }),
      update: (id, payload) => request(`/blogs/${id}`, { method: 'PUT', body: payload }),
      remove: (id) => request(`/blogs/${id}`, { method: 'DELETE' }),
      // Editor utility: upload one image and get back { url }. Used for
      // both the cover image preview flow and inserting images inline
      // into the rich text content.
      uploadImage: (formData) => request('/blogs/upload-image', { method: 'POST', body: formData }),
    },
    uploads: {
      image: (formData) => request('/uploads', { method: 'POST', body: formData }),
    },
    health: () => request('/health'),
  };

  window.DiaryAPI = DiaryAPI;
})();
