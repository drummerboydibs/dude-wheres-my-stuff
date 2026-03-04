# Loanlist — Setup Guide

## Files
```
loanlist/
├── index.html   ← main app
├── styles.css   ← all styling (BEM + CSS custom properties)
└── README.md    ← this file
```

---

## Option A: Local Storage Only
Just open `index.html` in a browser and click **"Use Local Storage"**.
Data lives only in that browser — no account needed.

---

## Option B: Supabase (Postgres, cloud sync)

### 1. Create a free Supabase project
Go to [https://supabase.com](https://supabase.com), create an account,
and start a new project. Note your **Project URL** and **anon public key**
(found under Settings → API).

### 2. Run this SQL in the Supabase SQL Editor

```sql
-- Create the loans table
CREATE TABLE loans (
  id           BIGSERIAL PRIMARY KEY,
  item         TEXT        NOT NULL,
  loaned_to    TEXT        NOT NULL,
  category     TEXT        NOT NULL DEFAULT 'other',
  loaned_on    DATE        NOT NULL,
  due_date     DATE,
  notes        TEXT,
  returned     BOOLEAN     NOT NULL DEFAULT FALSE,
  returned_on  DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional: index for faster queries on common filters
CREATE INDEX idx_loans_returned ON loans (returned);
CREATE INDEX idx_loans_loaned_on ON loans (loaned_on DESC);

-- Row Level Security (recommended — locks data to your anon key)
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users
-- (fine for personal use; swap for auth policies if you add login)
CREATE POLICY "Allow all for anon"
  ON loans
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
```

### 3. Connect in the app
Open `index.html`, paste your Project URL and anon key into the
**Database Setup** panel, and click **Connect**.
Credentials are saved in localStorage so you won't need to re-enter them.

---

## Hosting on Netlify (recommended)
1. Go to [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop the entire `loanlist/` folder
3. You'll get a public URL immediately

For a custom domain or auto-deploy from GitHub, connect a repo
in Netlify's dashboard.

---

## CSS Architecture Notes

`styles.css` is organized in layers:

| Layer | Purpose |
|-------|---------|
| `1. Design Tokens` | All colors, fonts, spacing as CSS custom properties. Change here to retheme globally. |
| `2. Reset & Base` | Normalize + body defaults |
| `3. Layout Utilities` | `.u-*` prefixed single-purpose classes |
| `4. Typography Utilities` | `.u-text-*`, `.u-font-*`, etc. |
| `5. Components` | BEM blocks: `.loan-card`, `.stats-bar`, `.btn`, etc. |
| `6. Responsive` | Media queries at the bottom |

To change the accent color everywhere: update `--color-accent` in `:root`.
