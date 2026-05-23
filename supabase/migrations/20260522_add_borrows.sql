-- ============================================================
-- Migration: Add borrows table
-- Author: Dylan Smith | 2026-05-22
--
-- Tracks items the user has BORROWED from other people.
-- Schema mirrors the loans table but uses semantically
-- distinct column names (borrowed_from, borrowed_on) so
-- the two tables stay unambiguous in SQL queries.
-- ============================================================

CREATE TABLE borrows (
  id              bigserial    PRIMARY KEY,
  user_id         uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item            text         NOT NULL,
  borrowed_from   text         NOT NULL,
  category_id     int          REFERENCES item_categories(id),
  borrowed_on     date         NOT NULL,
  due_date        date,                        -- return-by date; optional
  notes           text,
  returned        boolean      NOT NULL DEFAULT false,
  returned_on     date,
  written_off     boolean      NOT NULL DEFAULT false,
  writeoff_reason text,
  written_off_on  date,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

-- ── Row-Level Security ──────────────────────────────────────
ALTER TABLE borrows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own borrows"
  ON borrows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own borrows"
  ON borrows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own borrows"
  ON borrows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own borrows"
  ON borrows FOR DELETE
  USING (auth.uid() = user_id);
