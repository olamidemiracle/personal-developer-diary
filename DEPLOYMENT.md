# Deployment Guide

This guide walks through putting the Personal Developer Diary online:
push the code to **GitHub**, create a free database on **MongoDB Atlas**,
and deploy the app on **Render**. Express serves the frontend directly
(`app.use(express.static(...))` in `server.js`), so a single Render web
service hosts both the API and the site — no separate frontend host
needed.

Estimated time: 20–30 minutes.

---

## 1. Push the project to GitHub

If you don't already have Git set up locally:

```bash
cd developer-diary
git init
```

Create a `.gitignore` at the project root if one isn't already there (this
project ships with one that excludes `node_modules/`, `.env`, and
`backend/uploads/*` — double check `backend/.env` is **not** tracked
before your first commit):

```bash
git status
```

If `backend/.env` shows up as untracked-and-about-to-be-committed, stop
and confirm `.gitignore` includes it before continuing — it holds your
JWT secret and admin password.

Commit and push:

```bash
git add .
git commit -m "Initial commit — Personal Developer Diary"
```

Create a new, empty repository on GitHub (via [github.com/new](https://github.com/new)) —
**don't** initialize it with a README, license, or .gitignore, since this
project already has its own. Then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

Refresh the GitHub repo page to confirm the files uploaded. From here on,
any change is: `git add . && git commit -m "..." && git push`.

---

## 2. Create a MongoDB Atlas database

1. Sign up / log in at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. **Create a new project** (any name, e.g. "Developer Diary").
3. **Build a database** → choose the **free M0 tier** → pick any cloud
   provider/region close to where you'll deploy (e.g. the same region as
   your Render service) → click **Create**.
4. **Create a database user**: under Security → Database Access → Add New
   Database User. Choose "Password" authentication, set a username and a
   strong generated password, and give it **Read and write to any
   database** (or scope it to just this app's database if you prefer).
   **Save this password somewhere safe** — you'll need it in the
   connection string.
5. **Allow network access**: under Security → Network Access → Add IP
   Address → **Allow Access from Anywhere** (`0.0.0.0/0`). Render's
   outbound IPs aren't static on free/starter plans, so this is the
   simplest option; if you're on a paid Render plan with static outbound
   IPs, you can restrict to those instead.
6. **Get the connection string**: Database → Connect → Drivers → copy the
   string, which looks like:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<username>`/`<password>` with the database user you created
   (URL-encode any special characters in the password), and add your
   database name before the `?`:
   ```
   mongodb+srv://diaryuser:yourpassword@cluster0.xxxxx.mongodb.net/developer-diary?retryWrites=true&w=majority
   ```
   This full string is your `MONGO_URI`.

---

## 3. Deploy to Render

1. Sign up / log in at [render.com](https://render.com) and connect your
   GitHub account.
2. **New** → **Web Service** → select the repository you pushed in Step 1.
3. Configure the service:
   - **Name**: anything, e.g. `developer-diary`
   - **Root Directory**: `backend` (important — the `package.json` and
     `server.js` live there, not at the repo root)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free is fine to start
4. **Add environment variables** (Environment tab → Add Environment
   Variable) — set every variable from `backend/.env.example`:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGO_URI` | your Atlas connection string from Step 2 |
   | `JWT_SECRET` | a long random string (see command below) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `JWT_COOKIE_NAME` | `diary_token` |
   | `CLIENT_URL` | your Render URL once known, e.g. `https://developer-diary.onrender.com` (see note below) |
   | `MAX_UPLOAD_SIZE_MB` | `5` |
   | `ADMIN_USERNAME` | your choice |
   | `ADMIN_EMAIL` | your choice |
   | `ADMIN_PASSWORD` | a strong password |

   Generate a `JWT_SECRET` locally:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   **About `CLIENT_URL`:** since this deployment serves the frontend from
   the same Express app, most requests are same-origin and don't need
   CORS at all. Set `CLIENT_URL` to your Render service's own URL anyway
   (you'll know it after the first deploy — Render assigns
   `https://<name>.onrender.com`) so any cross-origin tooling (API
   clients, a future separately-hosted frontend) still works. You can
   redeploy after updating this value once you know the final URL.

5. Click **Create Web Service**. Render will build and deploy — watch the
   logs for `Server running in production mode on port ...`.

6. **Seed the administrator account.** Render's free tier doesn't give
   you a persistent interactive shell by default, so the simplest option
   is a **one-off job**: in the Render dashboard, go to your service →
   **Shell** (available on paid plans) and run:
   ```bash
   npm run seed
   npm run seed:categories
   ```
   If your plan doesn't include a shell, temporarily add a Render **Cron
   Job** (or a manual "Job") using the same repo/root directory with the
   start command `npm run seed`, run it once, then delete the job — or
   run the seed script locally against the same `MONGO_URI` (from your
   own machine, with that connection string in a local `.env`), since
   Atlas is reachable from anywhere once network access is opened.

7. Visit your Render URL. The public site should load; `/login.html`
   should let you log in with the admin credentials you seeded.

### A note on uploaded images in production

`backend/uploads/` is local disk storage. **Render's free/standard web
services use an ephemeral filesystem** — anything written to disk (i.e.
uploaded images) is lost on every redeploy or restart. For a personal
project this may be fine (re-upload after a redeploy), but for anything
you don't want to lose:

- Use a [Render Persistent Disk](https://render.com/docs/disks) (paid
  add-on) mounted at `backend/uploads`, **or**
- Migrate image storage to a cloud provider (e.g. Cloudinary, AWS S3,
  Backblaze B2) — this would mean changing `uploadMiddleware.js`'s
  storage engine from `multer.diskStorage` to that provider's Multer
  storage adapter, and updating `Image.path` to store the returned cloud
  URL instead of a local `/uploads/...` path. Not implemented here, since
  it's a meaningful architectural change beyond this project's current
  scope — flagging it clearly so it's a deliberate choice, not a surprise.

### Redeploying

Render redeploys automatically on every push to your connected branch
(`git push` → Render picks it up). No extra steps needed.

---

## Post-deployment checklist

- [ ] `GET https://<your-app>.onrender.com/api/health` returns `{"status":"ok"}`
- [ ] Logged in successfully at `/login.html` with the seeded admin account
- [ ] Published a test diary entry from the dashboard and it appears on the public site
- [ ] `backend/.env` was never committed to GitHub (`git log --all --full-history -- backend/.env` should show nothing)
- [ ] `JWT_SECRET` is a real random value, not a sample from `.env.example`
- [ ] Considered the uploads-storage note above if image persistence matters to you
