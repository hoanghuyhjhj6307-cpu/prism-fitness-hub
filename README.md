# Prism Fitness Hub — Supabase + Google OAuth + Netlify

What changed from your original artifact file:
- `storageLoadState`/`storageSaveState` now read/write a shared `app_state` row in Supabase Postgres instead of `window.storage`.
- `storageLoadPhotos`/`storageSavePhotos` now read/write a per-user row in `user_photos`.
- The "Continue with Google" button on the login screen now triggers real Supabase Google OAuth instead of a name-entry form. The first person to ever sign in still becomes admin; everyone after is `pending` until approved, exactly like before.
- Everything else — programs, worklogs, achievements, XP, the UI — is untouched.

## 1. Create the Supabase project

1. Go to supabase.com -> New project. Pick a name, password (for the DB, you won't need it day-to-day), and region.
2. Once it's provisioned, open **SQL Editor -> New query**, paste in the contents of `supabase/schema.sql`, and run it. This creates the two tables and their row-level-security policies.
3. Go to **Project Settings -> API**. Copy the **Project URL** and the **anon public** key — you'll need both shortly.

## 2. Turn on Google sign-in

1. In Supabase: **Authentication -> Providers -> Google** -> toggle it on.
2. In a separate tab, go to the [Google Cloud Console](https://console.cloud.google.com/) -> create a project (or reuse one) -> **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID** -> type **Web application**.
3. Supabase's provider page shows you a **Callback URL** (looks like `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`). Add that under **Authorized redirect URIs** in the Google Cloud console.
4. Copy the **Client ID** and **Client secret** Google gives you back into the Supabase Google provider fields, and save.
5. Back in Supabase, go to **Authentication -> URL Configuration** and set:
   - **Site URL**: your Netlify URL once you have it (you can update this after step 4 below; `http://localhost:5173` works for local dev in the meantime).
   - **Redirect URLs**: add both `http://localhost:5173` and your future Netlify URL (e.g. `https://prism-fitness.netlify.app`).

## 3. Run it locally

```bash
npm install
cp .env.example .env
# edit .env with your Project URL + anon key from step 1
npm run dev
```

Open the local URL, click "Continue with Google" — you should land back in the app signed in as the admin (since you're the first member).

## 4. Push to GitHub

Netlify deploys from a git repo, so if this isn't already a repo:

```bash
git init
git add .
git commit -m "Prism fitness hub"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/prism-fitness-hub.git
git push -u origin main
```

Make sure `.env` is **not** committed — add a `.gitignore` with at least:
```
node_modules
dist
.env
```

## 5. Deploy on Netlify

1. netlify.com -> **Add new site -> Import an existing project** -> connect GitHub -> pick the repo.
2. Build settings are already defined in `netlify.toml` (`npm run build`, publish `dist`) — Netlify should auto-detect them.
3. Before the first deploy (or right after, then redeploy), go to **Site configuration -> Environment variables** and add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (same values as your `.env`)
4. Deploy. Netlify gives you a URL like `https://your-site-name.netlify.app`.

## 6. Wire the real URL back into Google + Supabase

Once you have the Netlify URL:
1. Google Cloud Console -> your OAuth client -> add the Netlify URL to **Authorized JavaScript origins**, and keep the Supabase callback URL as the only entry under **Authorized redirect URIs** (that one doesn't change).
2. Supabase -> **Authentication -> URL Configuration** -> set **Site URL** to the Netlify URL, and make sure it's also listed under **Redirect URLs**.

Redeploy isn't needed for this part — it's config on Google/Supabase's side, not your app's.

## Notes on the data model

- `app_state` is a single JSONB row shared by the whole group (same "everyone sees everyone's data once approved" model as before) — access is gated to any authenticated user by RLS, and role logic (admin vs member, approved vs pending) is still enforced in the app code, same as the original.
- `user_photos` is one row per user, gated by RLS so only that user can read/write their own row.
- If you outgrow the single-JSONB-blob approach (e.g. want to query/filter server-side, or support a much larger group), the next step would be normalizing `app_state.data.members`, `.programs`, `.worklogs` into real tables — happy to help with that migration when you're there.
