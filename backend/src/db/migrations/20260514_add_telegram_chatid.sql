-- Migration: add_telegram_chatid
-- Run this in Supabase SQL Editor or include in migration pipeline

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

-- Optionally add an index for lookups by telegram_chat_id
CREATE INDEX IF NOT EXISTS idx_reports_telegram_chat_id ON public.reports(telegram_chat_id);
