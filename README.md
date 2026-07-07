# Personal Developer Diary

A full-stack journaling app for a single developer to log daily progress —
what got worked on, what got learned, what broke, and how it got fixed —
with a public read-only site for visitors and a private dashboard for the
admin. Built with vanilla HTML/CSS/JS on the frontend and Node.js +
Express + MongoDB on the backend, no frontend framework.

**→ Deploying this? See [DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step
GitHub, MongoDB Atlas, and Render instructions.

---

## Features

- **Public site** — Home, Diary Entries, Search (with category/date/month/
  year filters), Categories, About Me. Read-only; visitors can't create,
  edit, or delete anything.
- **Single-administrator auth** — no public registration. JWT sessions in
  an httpOnly cookie, bcrypt-hashed password, brute-force lockout on login.
- **Admin dashboard** — stats, recent entries, create/edit/delete, all
  backed by real MongoDB data.
- **New/Edit Diary Entry** — Title, Category, "What I Worked On Today",
  "What I Learned Today", "Problems I Faced", "How I Solved Them", optional
  image upload. Date/time captured automatically, never user-editable.
- **Very dark, premium UI** — near-black background, charcoal cards,
  electric-blue accents, Space Grotesk/Inter/JetBrains Mono type, subtle
  motion (scroll-reveal, hover-lift, a terminal-style blinking cursor),
  all `prefers-reduced-motion`-aware. Fully responsive down to mobile.
- **Production-hardened backend** — Helmet security headers, gzip
  compression, NoSQL-injection sanitization, general + login-specific rate
  limiting, ownership-scoped queries, graceful shutdown, startup checks
  that refuse to boot with an unsafe JWT secret in production.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript (no framework) |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Auth | JSON Web Tokens (httpOnly cookie), bcrypt |
| File uploads | Multer (disk storage) |
| Security | Helmet, express-mongo-sanitize, express-rate-limit, CORS |

## Project structure

```
developer-diary/
├── backend/
│   ├── config/db.js              # MongoDB connection
│   ├── controllers/              # authController, entryController,
│   │                             # categoryController, uploadController
│   ├── middleware/                # auth, validation, rate limiting, errors, uploads
│   ├── models/                    # Administrator, Diary, Category, Image
│   ├── routes/                    # authRoutes, entryRoutes, categoryRoutes, uploadRoutes
│   ├── seed/                      # createAdmin.js, createCategories.js
│   ├── uploads/                   # uploaded images live here (disk storage)
│   ├── .env.example
│   ├── package.json
│   └── server.js                  # app entry point
└── frontend/
    ├── index.html, entries.html, search.html, categories.html, about.html
    ├── login.html, dashboard.html, new-entry.html   (admin-only)
    ├── css/                        # style.css (design system), public.css, dashboard.css, auth.css
    ├── js/                         # api.js, utils.js, public.js, dashboard.js, new-entry.js, auth.js, data.js
    └── robots.txt
```

## Getting started (local development)

**Prerequisites:** Node.js 18+, a MongoDB instance (local `mongod` or a
free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
cd backend
npm install
cp .env.example .env        # then edit .env — see "Environment variables" below
npm run seed                # creates the one administrator account
npm run seed:categories     # adds a starter set of categories
npm run dev                 # starts the server with nodemon
```

Open **http://127.0.0.1:5000** — Express serves the frontend directly, so
there's no separate frontend server or build step. `GET /api/health`
should return `{"status":"ok"}`.

## Environment variables

All configured in `backend/.env` (see `backend/.env.example` for the full
template with inline comments):

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | defaults to 5000; hosting platforms usually set this for you |
| `NODE_ENV` | recommended | `development` or `production` |
| `MONGO_URI` | **yes** | local `mongodb://...` or Atlas `mongodb+srv://...` |
| `JWT_SECRET` | **yes** | 32+ random characters; server refuses to boot in production without one |
| `JWT_EXPIRES_IN` | no | defaults to `7d` |
| `JWT_COOKIE_NAME` | no | defaults to `diary_token` |
| `CLIENT_URL` | **yes** | allowed CORS origin(s), comma-separated if more than one |
| `MAX_UPLOAD_SIZE_MB` | no | defaults to 5 |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | only for `npm run seed` | the one admin account |

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Available scripts (run from `backend/`)

| Script | Purpose |
|---|---|
| `npm run dev` | start with nodemon (auto-restart on changes) |
| `npm start` | start normally (production) |
| `npm run seed` | create the one administrator account (idempotent — refuses if one exists) |
| `npm run seed:categories` | add starter categories (idempotent — skips existing names) |

## API overview

All routes are prefixed `/api`. Full request/response detail is in the
controller source (`backend/controllers/`), which is commented throughout.

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/health` | public | liveness check |
| POST | `/auth/login` | public | rate-limited, validated |
| POST | `/auth/logout` | private | clears the session cookie |
| GET | `/auth/me` | private | current admin profile |
| GET | `/entries` | private | supports optional `?page=&limit=` |
| POST | `/entries` | private | multipart/form-data, optional image |
| GET / PUT / DELETE | `/entries/:id` | private | ownership-scoped |
| GET | `/categories` | public | used by the public Categories page |
| POST | `/categories` | private | |
| POST | `/uploads` | private | standalone image upload utility |

## Security

- Single administrator, no public registration; the account is created
  only via `npm run seed`, never through an API route.
- Passwords bcrypt-hashed, never returned by queries by default
  (`select: false`).
- JWT stored in an **httpOnly, sameSite, secure-in-production** cookie —
  not accessible to JavaScript, mitigating XSS token theft.
- **Helmet** sets standard security headers, including a Content-Security-
  Policy scoped to this app's actual needs (self + Google Fonts).
- **express-mongo-sanitize** strips `$`/`.` keys from `body`/`query`/
  `params`, defense-in-depth against NoSQL injection on top of existing
  type-checked validation.
- **Rate limiting**: a general limiter across all `/api` routes, plus a
  stricter login-specific lockout (5 failed attempts → 15 minute lockout
  per IP).
- Ownership-scoped queries everywhere (`Diary.findOne({ _id, administrator:
  req.user._id })`) — a malformed or someone-else's id 404s rather than
  leaking existence.
- The server **refuses to start in production** if `JWT_SECRET` is
  missing, too short, or still set to one of the sample values from
  `.env.example`.
- Multer restricts uploads to image mimetypes and a configurable max size;
  deleting an entry deletes its image files from disk, not just the
  database record.

## Performance

- gzip/deflate compression on all responses (`compression` middleware).
- MongoDB indexes on every field the app actually queries by (see the
  `Diary`/`Category`/`Image` schemas): text search, `administrator + date`,
  `category + date`, uploader/entry lookups.
- Optional pagination on `GET /api/entries` (`?page=&limit=`, capped at
  100/page) for when entry counts grow.
- Frontend: `defer` on all scripts (non-blocking parse), `loading="lazy"`
  on entry images, `preconnect` hints for Google Fonts, a single shared
  design-system stylesheet (no per-page CSS duplication).
- Client-side search is pre-indexed once per page load (search text and
  date parts computed up front) rather than re-derived on every keystroke.

## License

MIT — do whatever you'd like with it.

---

# Development history (phase notes)

The sections below document how this project was built, phase by phase.
Kept for reference; the sections above are the practical, up-to-date docs.

## About Me (Phase 9)

`about.html` shows: name (Olamide Miracle), role ("Software Engineering
Student"), a short description, and three action buttons — **GitHub**,
**Portfolio**, and **Email Me** (a `mailto:` link). The GitHub/portfolio
URLs and email address are placeholders (`github.com/olamidemiracle`,
`olamidemiracle.dev`, `hello@olamidemiracle.dev`) — swap them for your
real links in `about.html`.

## Search & filters (Phase 8)

`search.html` combines free-text search with four filter dimensions, all
applied together (AND logic): **Search** (title/content/tags), **Category
Filter** (real `Category` data), **Date Filter** (exact date), **Month
Filter**, **Year Filter** (populated dynamically from the years actually
present in the data).

**Fast search:** every entry is indexed once up front — search text
pre-joined and lowercased, dates broken into ISO date/month/year — so
filtering is cheap property comparisons over pre-normalized data, not
repeated string work or `Date` parsing on every keystroke. Text input is
debounced (120ms); dropdown/date filters apply immediately.

**Responsive search UI** — all four filters sit in an always-visible
panel on desktop; below 780px, a "Filters" button (with a live count
badge) toggles a collapsible panel instead.

## Edit & Delete (Phase 7)

The dashboard reads and manages real MongoDB data end to end.

- **Edit Entry** — the edit icon navigates to `new-entry.html?edit=<id>`,
  which fetches the entry, prefills every field, and saves via `PUT`
  instead of `POST`. The original publish `date` never changes (the
  schema field is `immutable`).
- **Delete Entry** — a styled confirm dialog (not a native `confirm()`)
  names the entry, then calls `DELETE /api/entries/:id`.
- **Delete Image** — deleting an entry deletes every attached `Image`
  document *and* its file on disk. Editing with a new upload replaces the
  old image the same way; a "Remove image" button drops the existing
  image without uploading a new one.
- **Validation** — `validateDiaryEntry` guards both `POST` and `PUT`.
  Ownership is enforced at the query level.
- **Success messages** — a shared toast helper shows confirmation after
  delete/publish/update.

## New Diary Entry (Phase 6)

`new-entry.html` — real MongoDB writes, not local storage. **Fields:**
Title, Category, "What I Worked On Today", "What I Learned Today",
"Problems I Faced", "How I Solved Them", optional image upload. Date and
time are captured server-side (`Diary.date`, `default: Date.now`,
`immutable: true`) — never sent by the client. `POST /api/entries` is
`multipart/form-data`, handled by Multer; an uploaded image becomes an
`Image` document linked to the new `Diary`. `GET/POST /api/categories`
were added so the form's category dropdown reads real data.

## Administrator dashboard (Phase 5, updated in Phase 7)

Protected single page: real auth guard (`GET /api/auth/me`, redirects to
`login.html` if invalid — no flash of protected content), animated stats
(total entries, categories used, this month/week), a real entries list
with Edit/Delete, a "New Entry" link, "View website", and "Log out".

## Public site (Phase 4)

Five read-only pages: Home (hero + 3 recent entries), Diary Entries
(filterable by category), Search, Categories (with entry counts), About
Me. Clicking any entry opens a read-only modal. No create/edit/delete UI
anywhere on the public site. `js/data.js` ships sample content matching
the real schema shape as a fallback for when the live API isn't reachable
(e.g. an unauthenticated visitor hitting a currently admin-only route).

## Authentication model (Phase 2)

Exactly **one** administrator account, created only via `npm run seed` —
no public registration route or page exists. The `Administrator` model
enforces this at the database level (a `singleton` field with a unique
index). Login validates input, checks the bcrypt hash, and issues a JWT
in an httpOnly cookie. Repeated failed attempts from the same IP are
temporarily locked out.

## Database design (Phase 3, updated in Phase 6)

Four collections in `backend/models/`:

**`Administrator`** — `username`, `email` (unique), `password` (bcrypt,
`select: false`), `lastLoginAt`, enforced singleton, timestamps.

**`Diary`** — the core collection. `administrator` (ref, required),
`title`, `category` (ref, optional), `workedOn` (required), `learned`,
`problems`, `solutions` (all optional), `images` ([ref]), `date`
(auto-captured, immutable), timestamps. Indexes: text search across all
prompt fields, `administrator + date`, `category + date`.

**`Category`** — `name` (unique), auto-generated `slug` (unique),
`description`, `color` (hex-validated). Indexes: unique on name/slug,
text index on name/description.

**`Image`** — metadata for files Multer writes to `backend/uploads/`:
`administrator` (ref, uploader), `diary` (ref, nullable), `filename`,
`originalName`, `path`, `mimetype` (enum), `size` (capped to match
Multer's limit). Indexes on `diary + createdAt`, `administrator +
createdAt`.

**Relationships:**
```
Administrator  1 ───── * Diary        (author)
Category       1 ───── * Diary        (optional grouping)
Diary          1 ───── * Image        (attachments)
Administrator  1 ───── * Image        (uploader)
```
