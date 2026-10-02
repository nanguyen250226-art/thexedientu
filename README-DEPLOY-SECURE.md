# Deploy secure student accounts

The Netlify site publishes only `site/`. Student records and the initial-password seed are not in that directory. Keep the GitHub repository **private**; `.gitignore` excludes the original local demo files and `private/seed-students.sql`.

## 1. Create the database

Create a Supabase project. In its SQL Editor, run `supabase/schema.sql`, then run `private/seed-students.sql` once. The seed gives each student the temporary password `123456`; only its bcrypt hash is stored in the database. Students must change it on first login. This shared password is weak, so distribute it only through a private channel and replace it with unique temporary passwords before a real launch if possible.

The database denies direct access to the `anon` and `authenticated` roles. The site talks to it only through Netlify Functions using the server-only service-role key.

## 2. Create a private GitHub repository

Use GitHub Desktop or Git to publish this project to a **private** repository. Check that `private/seed-students.sql`, root `script.js`, root `index.html`, and root `style.css` are ignored before pushing. Do not force-add them. Netlify's publish directory is `site/`; do not deploy the project root with Netlify Drop.

## 3. Connect Netlify

In Netlify, import the private GitHub repository. `netlify.toml` sets the publish directory and Functions directory; leave the build command empty. Add these environment variables in the Netlify site settings, then redeploy:

- `SUPABASE_URL`: the project's URL from Supabase API settings.
- `SUPABASE_SERVICE_ROLE_KEY`: the service-role secret from Supabase API settings. Never add it to HTML, JavaScript, Git, or a `VITE_` variable.
- `SESSION_SECRET`: a new random value of at least 32 characters. Generate it locally in PowerShell and paste it directly into Netlify:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Do not send these values to chat or place them in this repository.

## 4. First login

Use the student's MSSV and temporary password `123456`. The student must choose a new password with at least 10 characters. The server stores a salted bcrypt hash; the browser receives only a signed, HttpOnly session cookie.

Parking charges are enforced atomically in Postgres at 500 VND per tap. The PayOS screen stays disabled until a real payment-creation endpoint and signature-verified webhook are configured. Do not re-enable client-side balance crediting.

## 5. Verify before sharing

- Confirm `/script.js`, `/private/seed-students.sql`, and `/supabase/schema.sql` are not part of the published `site/` directory.
- Confirm `/api/me` without a session returns 401 and login sets an HttpOnly, Secure cookie.
- Test a wrong password, first-login password change, each 500 VND charge, insufficient balance, and refresh persistence.
- Keep Supabase backups and limit access to the Netlify and Supabase projects to trusted administrators.

This is a starting production architecture, not a completed payment integration or a security audit. Have the institution's IT/security team review it before using real balances or student data.