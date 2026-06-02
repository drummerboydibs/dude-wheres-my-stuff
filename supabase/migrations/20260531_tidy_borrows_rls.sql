-- ============================================================
-- Migration: Tidy borrows RLS policies
-- Author: Dylan Smith | 2026-05-31
--
-- Style/consistency cleanup so borrows policies match the
-- shape used on loans. Functionally equivalent to the
-- pre-existing policies — no security change.
--
-- Changes:
--   1. Target the `authenticated` role explicitly instead of
--      the default `public` role. Anon already failed the
--      `auth.uid() = user_id` check (auth.uid() is null), so
--      this is intent clarification, not a permission change.
--   2. Give the UPDATE policy an explicit WITH CHECK clause
--      matching the USING clause. Previously WITH CHECK was
--      omitted and Postgres fell back to USING for new-row
--      validation; making it explicit mirrors the loans table.
-- ============================================================

DROP POLICY "Users can view own borrows"   ON borrows;
DROP POLICY "Users can insert own borrows" ON borrows;
DROP POLICY "Users can update own borrows" ON borrows;
DROP POLICY "Users can delete own borrows" ON borrows;

CREATE POLICY "Users can view own borrows"
  ON borrows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own borrows"
  ON borrows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own borrows"
  ON borrows FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own borrows"
  ON borrows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
