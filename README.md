# Loanlist — Setup Guide

## Files

```
dude-wheres-my-stuff/
├── index.html   ← markup + page structure
├── styles.css   ← all styling (BEM + CSS custom properties)
├── app.js       ← UI logic: event handlers, rendering, modals
├── utils.js     ← pure helpers (escaping, dates, sorting) — unit-tested
├── db.js        ← database & auth abstraction layer
├── config.js    ← Supabase URL + anon key (generated at deploy; gitignored)
├── tests/       ← vitest unit tests for utils.js and db.js
└── README.md    ← this file
```

---

## How authentication works

Loanlist uses **Supabase Auth** (email + password). Here's the flow:

1. On first visit, you enter your Supabase project URL and anon key once.
   These are stored in `localStorage` — they are **not secrets** (see below).
2. You create an account or sign in. Supabase issues a JWT session token.
3. Every database query automatically includes that token.
4. **Row Level Security (RLS)** on the `loans` table checks `auth.uid()`
   against the `user_id` column — so each user can only ever see and
   modify their own rows, even if someone else has your anon key.

### Why is it safe to store the anon key in the browser?

The Supabase anon key is **intentionally public**. It's a JWT that
identifies your *project*, not a user. It grants no privileges by
itself — all access is controlled by RLS policies on the database.
This is the same model used by Firebase, Amplify, and most BaaS platforms.

---

## Supabase setup

### 1. Create a free project

Go to https://supabase.com, sign up, and create a new project.
Once it's ready, go to **Settings → API** and copy:
- **Project URL** (looks like `https://abcdefgh.supabase.co`)
- **anon public** key (a long JWT string)

### 2. Run this SQL in the Supabase SQL Editor

Open your project → **SQL Editor** → **New query**, paste and run:

Order matters — the lookup tables are referenced by `loans` and `borrows`,
so run the whole script top to bottom in one go:

```sql
-- 1. Lookup table: item categories (read-only, shared by all users)
CREATE TABLE item_categories (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0
);
INSERT INTO item_categories (name, slug, display_order) VALUES
  ('Other',    'other',    1),
  ('Book',     'book',     2),
  ('Tool',     'tool',     3),
  ('Clothing', 'clothing', 4),
  ('Media',    'media',    5);

-- 2. Lookup table: write-off reasons (read-only, shared by all users)
CREATE TABLE writeoff_reasons (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  display_order INT  NOT NULL DEFAULT 0
);
INSERT INTO writeoff_reasons (name, display_order) VALUES
  ('Lost',          1),
  ('Stolen',        2),
  ('Broken',        3),
  ('Given as Gift', 4);

-- 3. Loans — things you've lent OUT to other people
CREATE TABLE loans (
  id              BIGSERIAL    PRIMARY KEY,
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item            TEXT         NOT NULL,
  loaned_to       TEXT         NOT NULL,
  category_id     INT          REFERENCES item_categories(id),
  loaned_on       DATE         NOT NULL,
  due_date        DATE,
  notes           TEXT,
  returned        BOOLEAN      NOT NULL DEFAULT FALSE,
  returned_on     DATE,
  written_off     BOOLEAN      NOT NULL DEFAULT FALSE,
  writeoff_reason TEXT,
  written_off_on  DATE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_loans_user_id ON loans (user_id);
CREATE INDEX idx_loans_created ON loans (created_at DESC);

-- 4. Borrows — things you've BORROWED from other people
CREATE TABLE borrows (
  id              BIGSERIAL    PRIMARY KEY,
  user_id         UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item            TEXT         NOT NULL,
  borrowed_from   TEXT         NOT NULL,
  category_id     INT          REFERENCES item_categories(id),
  borrowed_on     DATE         NOT NULL,
  due_date        DATE,
  notes           TEXT,
  returned        BOOLEAN      NOT NULL DEFAULT FALSE,
  returned_on     DATE,
  written_off     BOOLEAN      NOT NULL DEFAULT FALSE,
  writeoff_reason TEXT,
  written_off_on  DATE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_borrows_user_id ON borrows (user_id);
CREATE INDEX idx_borrows_created ON borrows (created_at DESC);

-- 5. Row Level Security
ALTER TABLE item_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE writeoff_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrows          ENABLE ROW LEVEL SECURITY;

-- Lookup tables: any signed-in user may READ them; no API writes
-- (manage rows from the SQL editor / dashboard).
CREATE POLICY "Signed-in users can read categories"
  ON item_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read writeoff reasons"
  ON writeoff_reasons FOR SELECT TO authenticated USING (true);

-- loans: each user can only access their own rows.
CREATE POLICY "Users can view their own loans"
  ON loans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own loans"
  ON loans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own loans"
  ON loans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own loans"
  ON loans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- borrows: same per-user policies.
CREATE POLICY "Users can view their own borrows"
  ON borrows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own borrows"
  ON borrows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own borrows"
  ON borrows FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own borrows"
  ON borrows FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

**What this does:**
- Two small **lookup tables** (`item_categories`, `writeoff_reasons`) feed the
  category and write-off dropdowns. They're world-readable to signed-in users
  but not writable through the API.
- `loans` and `borrows` mirror each other (lent-out vs. borrowed-in) and use
  `category_id` to reference the lookup table.
- `user_id` ties every row to a Supabase auth user; cascade delete means
  deleting your account removes your data too.
- Four per-operation policies on each table follow least privilege — more
  explicit and auditable than a single `FOR ALL` policy.
- `TO authenticated` means the anon role gets nothing, even with the correct
  anon key.

> If you set this app up before write-offs/categories existed, your `loans`
> table may still have an old `category TEXT` column and be missing
> `category_id`, `written_off`, `writeoff_reason`, `written_off_on`. Add the
> missing columns (and the lookup tables above) to match this schema.

### 3. (Optional) Disable email confirmation for personal use

By default Supabase requires email confirmation for new accounts.
For a personal app you can disable this:
**Authentication → Providers → Email → toggle off "Confirm email"**

---

## Hosting on GitHub Pages

1. Push the `loanlist/` folder contents to a GitHub repo
2. Go to repo **Settings → Pages → Source: Deploy from branch → main**
3. Your site will be live at `https://yourusername.github.io/repo-name/`

The anon key will be visible in your repo. This is fine — your data
is protected by RLS, not by keeping the key secret.

### Netlify (alternative, auto-deploys on git push)

1. Push to GitHub
2. Connect the repo at netlify.com
3. Set publish directory to match where your files live
4. Every `git push` triggers a redeploy automatically

---

## CSS Architecture

`styles.css` is organized into layers:

| Layer            | Prefix          | Purpose                                          |
|------------------|-----------------|--------------------------------------------------|
| Design Tokens    | `:root` vars    | Colors, spacing, fonts. Change here to retheme.  |
| Reset & Base     | —               | Normalize + body defaults                        |
| Layout Utilities | `.u-`           | Single-purpose composable helpers                |
| Components       | BEM blocks      | `.loan-card`, `.btn`, `.stats-bar`, etc.         |
| Responsive       | `@media`        | Breakpoints at the bottom                        |

BEM naming: `.block`, `.block__element`, `.block--modifier`

---

## db.js Architecture

All database and auth operations route through `db.*`.
The UI never calls Supabase directly — swap backends by editing db.js only.

| Method                         | Description                          |
|--------------------------------|--------------------------------------|
| `db.init(url, key)`            | Load SDK, create client              |
| `db.auth.signUp(email, pw)`    | Create account                       |
| `db.auth.signIn(email, pw)`    | Log in                               |
| `db.auth.signOut()`            | Log out                              |
| `db.auth.getSession()`         | Restore session on page load         |
| `db.auth.onAuthStateChange(cb)`| React to login/logout events         |
| `db.getAll()`                  | Fetch all loans for current user     |
| `db.insert(loan)`              | Add a new loan                       |
| `db.update(id, changes)`       | Modify a loan                        |
| `db.remove(id)`                | Delete a loan                        |
