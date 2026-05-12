
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('citizen', 'municipal_officer', 'city_planner', 'admin');

-- Create report_status enum
CREATE TYPE public.report_status AS ENUM ('pending', 'verified', 'assigned', 'in_progress', 'resolved', 'rejected');

-- Create waste_category enum
CREATE TYPE public.waste_category AS ENUM ('organic', 'plastic', 'e_waste', 'construction', 'hazardous', 'mixed', 'other');

-- Create severity_level enum
CREATE TYPE public.severity_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Create agent_type enum
CREATE TYPE public.agent_type AS ENUM ('waste_verification', 'geo_intelligence', 'municipal_coordination', 'reward_optimization', 'fraud_detection');

-- Create agent_stage_status enum
CREATE TYPE public.agent_stage_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own role on signup" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Reports table
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT,
  location_address TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  category waste_category NOT NULL DEFAULT 'other',
  severity severity_level NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL DEFAULT '',
  status report_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id),
  token_reward NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Citizens can view own reports" ON public.reports FOR SELECT USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'municipal_officer') OR public.has_role(auth.uid(), 'city_planner') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Citizens can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Municipal officers can update reports" ON public.reports FOR UPDATE USING (
  public.has_role(auth.uid(), 'municipal_officer') OR public.has_role(auth.uid(), 'admin')
);
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Report events (AI agent pipeline)
CREATE TABLE public.report_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
  agent_type agent_type NOT NULL,
  stage_status agent_stage_status NOT NULL DEFAULT 'pending',
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.report_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Report events viewable by report owner or officers" ON public.report_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'municipal_officer') OR public.has_role(auth.uid(), 'city_planner') OR public.has_role(auth.uid(), 'admin')))
);

-- Hotspots table
CREATE TABLE public.hotspots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  area_name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  avg_severity NUMERIC NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotspots are publicly viewable" ON public.hotspots FOR SELECT USING (true);
CREATE POLICY "Officers can manage hotspots" ON public.hotspots FOR ALL USING (
  public.has_role(auth.uid(), 'municipal_officer') OR public.has_role(auth.uid(), 'admin')
);

-- Token transactions
CREATE TABLE public.token_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL,
  tokens NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.token_transactions FOR SELECT USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for report images
INSERT INTO storage.buckets (id, name, public) VALUES ('report-images', 'report-images', true);
CREATE POLICY "Anyone can view report images" ON storage.objects FOR SELECT USING (bucket_id = 'report-images');
CREATE POLICY "Authenticated users can upload report images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'report-images' AND auth.role() = 'authenticated');
