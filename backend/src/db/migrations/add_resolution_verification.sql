-- Migration: add_resolution_verification
-- Run this in Supabase SQL Editor

-- 0. Update ENUMs
ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'pending_verification';
ALTER TYPE public.agent_type ADD VALUE IF NOT EXISTS 'resolution_verification';
ALTER TYPE public.agent_type ADD VALUE IF NOT EXISTS 'resolution_photo_submitted';
ALTER TYPE public.agent_type ADD VALUE IF NOT EXISTS 'verification_confirmed';
ALTER TYPE public.agent_type ADD VALUE IF NOT EXISTS 'verification_failed';
ALTER TYPE public.agent_type ADD VALUE IF NOT EXISTS 'verification_manual_review';

-- 1. Add new columns to reports table
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS resolution_image_url       TEXT,
  ADD COLUMN IF NOT EXISTS resolution_image_path      TEXT,
  ADD COLUMN IF NOT EXISTS resolution_submitted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_submitted_by    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_status        TEXT DEFAULT 'not_started'
    CHECK (verification_status IN (
      'not_started', 'pending', 'confirmed', 'failed', 'manual_review'
    )),
  ADD COLUMN IF NOT EXISTS verification_score         NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS verification_reasoning     TEXT,
  ADD COLUMN IF NOT EXISTS verification_ran_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_minted               BOOLEAN DEFAULT FALSE;

-- 2. Create verification_logs table
CREATE TABLE IF NOT EXISTS public.verification_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  before_image_url    TEXT NOT NULL,
  after_image_url     TEXT NOT NULL,
  ai_model            TEXT NOT NULL,
  ai_prompt_version   TEXT NOT NULL,
  raw_response        JSONB,
  confidence_score    NUMERIC(4,3),
  decision            TEXT CHECK (decision IN ('confirmed', 'failed', 'uncertain')),
  reasoning           TEXT,
  processing_ms       INTEGER,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS on verification_logs
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all verification logs"
ON public.verification_logs FOR SELECT
USING (auth.jwt() ->> 'user_role' IN ('admin', 'city_planner'));

CREATE POLICY "Citizens can read their own report logs"
ON public.verification_logs FOR SELECT
USING (
  report_id IN (
    SELECT id FROM public.reports WHERE user_id = auth.uid()
  )
);

-- 4. Storage RLS for resolutions/ path
CREATE POLICY "Officers can upload resolution photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'report-images'
  AND name LIKE 'resolutions/%'
  AND auth.jwt() ->> 'user_role' IN ('municipal_officer', 'admin')
);

CREATE POLICY "Authenticated users can view resolution photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'report-images'
  AND name LIKE 'resolutions/%'
  AND auth.role() = 'authenticated'
);
