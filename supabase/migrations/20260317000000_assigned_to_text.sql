-- Change assigned_to from UUID FK to TEXT so facility IDs can be stored
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_assigned_to_fkey;
ALTER TABLE public.reports ALTER COLUMN assigned_to TYPE TEXT;
