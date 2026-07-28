# GitHub Secrets Setup — one time, ~5 minutes

The two workflows in `.github/workflows/` need two secrets before the daily
encrypted database backup can run. The keepalive workflow needs nothing.

> **Never paste either value into a chat, an issue, or a commit.** They go into
> GitHub's Secrets page only. Once saved, GitHub hides them permanently — even
> you cannot read them back, only overwrite them.

---

## Secret ① — `SUPABASE_DB_URL`

This is the full Postgres connection string, password included.

### Step 1 — Get the connection string from Supabase

1. Open <https://supabase.com/dashboard> and select the project **Al-Mostadira**.
2. In the top bar, click the **Connect** button (next to the branch name).
3. A dialog opens with several tabs. Choose the tab named **Session pooler**.

   > ⚠️ **Do NOT use "Direct connection".** Direct connections are IPv6-only,
   > and GitHub Actions runners have no IPv6. The job would fail with
   > `could not translate host name`. The Session pooler is reachable over IPv4.

4. Copy the URI shown. It looks like this:

   ```
   postgresql://postgres.nxqddfuwtrsabprxcfez:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

5. Replace the placeholder `[YOUR-PASSWORD]` (including the square brackets)
   with your **database password** — the one shown once when you created the
   project.

### Step 1b — If you don't remember the database password

1. Supabase Dashboard → **Project Settings** (gear icon, bottom left).
2. Open **Database**.
3. Click **Reset database password**, then **Generate a password**.
4. Copy the new password immediately and save it in your password manager.

   > This is safe. The app does **not** use the database password — it connects
   > with the public `anon` API key. Resetting it breaks nothing.

### Step 2 — Store it in GitHub

1. Open <https://github.com/malikAlmasri-tech/mustadeera>.
2. Click **Settings** (repository settings, in the repo's own top tab bar —
   not your account settings).
3. In the left sidebar: **Secrets and variables** → **Actions**.
4. Make sure you are on the **Secrets** tab, then click
   **New repository secret**.
5. Fill in:
   - **Name:** `SUPABASE_DB_URL`
   - **Secret:** paste the full connection string, with the real password
     substituted in. No quotes, no spaces, no line breaks.
6. Click **Add secret**.

---

## Secret ② — `BACKUP_PASSPHRASE`

This encrypts each backup file with AES-256 before it is uploaded.

**Why it is required:** GitHub Actions artifacts on a public repository can be
downloaded by anyone. The backup contains real users' phone numbers. Encrypted,
a leaked artifact is worthless without this passphrase.

### Step 1 — Create the passphrase

Use your password manager's generator, 30+ characters, letters and digits.
Do not reuse any existing password. **Save it in your password manager now.**

> ⚠️ **If this passphrase is lost, every backup becomes permanently
> unreadable.** There is no recovery path — not through GitHub, not through
> Supabase, not through me. It is not stored anywhere else.

### Step 2 — Store it in GitHub

Same path as before: **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**.

- **Name:** `BACKUP_PASSPHRASE`
- **Secret:** the passphrase you just generated

Click **Add secret**.

---

## Verify it works

1. Go to the repository's **Actions** tab.
2. In the left sidebar, select **DB backup (daily, encrypted)**.
3. Click **Run workflow** → **Run workflow** (this runs it immediately instead
   of waiting for 02:00 UTC).
4. Wait about a minute, then open the run.
   - **Green check** → scroll to the bottom of the run page. Under
     **Artifacts** you will see `db-backup-YYYY-MM-DD`. That is your first
     backup.
   - **Yellow "skipped" notice** → a secret is missing or misspelled. Check
     that both names match exactly: `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`.
   - **Red X** → open the failed step and read the error. The two common ones:
     - `could not translate host name` → you used Direct connection instead of
       Session pooler.
     - `password authentication failed` → the `[YOUR-PASSWORD]` placeholder was
       not replaced, or the password is wrong.

After this, it runs by itself every day at 02:00 UTC (05:00 Amman time) and
keeps each backup for 90 days.

---

## How to restore a backup

Download the artifact from the Actions run, unzip it, then:

```bash
gpg -d mustadeera-2026-07-28.sql.gz.gpg | gunzip | psql "$SUPABASE_DB_URL"
```

`gpg` will prompt for `BACKUP_PASSPHRASE`.

> **Do this once now, into a throwaway Supabase project, while nothing is
> wrong.** A backup you have never restored is a guess, not a backup.

---

## One more thing

GitHub disables scheduled workflows in repositories with no activity for
60 days. Any push — or a manual **Run workflow** — re-enables them.
