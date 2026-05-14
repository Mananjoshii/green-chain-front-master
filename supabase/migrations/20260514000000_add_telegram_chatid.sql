-- Migration: add_telegram_chatid
-- Adds telegram_chat_id column to reports table for persistent reporter notifications

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Index for efficient lookups by telegram_chat_id
CREATE INDEX IF NOT EXISTS idx_reports_telegram_chat_id ON public.reports(telegram_chat_id);
