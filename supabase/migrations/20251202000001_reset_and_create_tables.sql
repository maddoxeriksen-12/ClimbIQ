-- Drop tables in reverse dependency order (CASCADE will handle policies and triggers)
DROP TABLE IF EXISTS custom_variable_entries CASCADE;
DROP TABLE IF EXISTS custom_variables CASCADE;
DROP TABLE IF EXISTS goal_progress CASCADE;
DROP TABLE IF EXISTS climbing_sessions CASCADE;
DROP TABLE IF EXISTS climbing_goals CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_goal_progress() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Now create everything fresh

-- Create profiles table to store user profile data
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'athlete' CHECK (role IN ('athlete', 'coach')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create climbing_goals table
CREATE TABLE climbing_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  start_date DATE DEFAULT CURRENT_DATE,
  target_grade TEXT,
  project_name TEXT,
  competition_name TEXT,
  custom_details TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create climbing_sessions table
CREATE TABLE climbing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES climbing_goals(id) ON DELETE SET NULL,
  
  -- Session basics
  session_type TEXT NOT NULL,
  location TEXT,
  is_outdoor BOOLEAN DEFAULT false,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  planned_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  
  -- Pre-session data (stored as JSONB for flexibility)
  pre_session_data JSONB DEFAULT '{}',
  
  -- Post-session data (stored as JSONB for flexibility)
  post_session_data JSONB DEFAULT '{}',
  
  -- Key metrics (extracted for easy querying)
  energy_level INTEGER CHECK (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10)),
  motivation INTEGER CHECK (motivation IS NULL OR (motivation >= 1 AND motivation <= 10)),
  sleep_quality INTEGER CHECK (sleep_quality IS NULL OR (sleep_quality >= 1 AND sleep_quality <= 10)),
  stress_level INTEGER CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 10)),
  session_rpe INTEGER CHECK (session_rpe IS NULL OR (session_rpe >= 1 AND session_rpe <= 10)),
  satisfaction INTEGER CHECK (satisfaction IS NULL OR (satisfaction >= 1 AND satisfaction <= 5)),
  
  -- Climbing metrics
  highest_grade_sent TEXT,
  highest_grade_attempted TEXT,
  total_climbs INTEGER,
  total_sends INTEGER,
  flash_count INTEGER,
  
  -- Pain/injury tracking
  had_pain_before BOOLEAN DEFAULT false,
  had_pain_after BOOLEAN DEFAULT false,
  pain_location TEXT,
  pain_severity INTEGER CHECK (pain_severity IS NULL OR (pain_severity >= 1 AND pain_severity <= 10)),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create goal_progress table to track sessions per goal
CREATE TABLE goal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES climbing_goals(id) ON DELETE CASCADE,
  sessions_completed INTEGER DEFAULT 0,
  last_session_date TIMESTAMPTZ,
  milestones JSONB DEFAULT '[]',
  notes JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id)
);

-- Create custom_variables table for user-defined tracking
CREATE TABLE custom_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('scale', 'number', 'boolean', 'text')),
  form_type TEXT NOT NULL CHECK (form_type IN ('pre_session', 'post_session')),
  description TEXT,
  min_value NUMERIC,
  max_value NUMERIC,
  is_active BOOLEAN DEFAULT true,
  is_team_variable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create custom_variable_entries table
CREATE TABLE custom_variable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID NOT NULL REFERENCES custom_variables(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES climbing_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value JSONB NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sessions_user_id ON climbing_sessions(user_id);
CREATE INDEX idx_sessions_started_at ON climbing_sessions(started_at DESC);
CREATE INDEX idx_sessions_status ON climbing_sessions(status);
CREATE INDEX idx_goals_user_id ON climbing_goals(user_id);
CREATE INDEX idx_goals_is_active ON climbing_goals(is_active);
CREATE INDEX idx_custom_variables_user_id ON custom_variables(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE climbing_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE climbing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_variable_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for climbing_goals
CREATE POLICY "Users can view own goals" ON climbing_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON climbing_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON climbing_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON climbing_goals
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for climbing_sessions
CREATE POLICY "Users can view own sessions" ON climbing_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON climbing_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON climbing_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON climbing_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for goal_progress
CREATE POLICY "Users can view own goal progress" ON goal_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM climbing_goals 
      WHERE climbing_goals.id = goal_progress.goal_id 
      AND climbing_goals.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own goal progress" ON goal_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM climbing_goals 
      WHERE climbing_goals.id = goal_progress.goal_id 
      AND climbing_goals.user_id = auth.uid()
    )
  );

-- RLS Policies for custom_variables
CREATE POLICY "Users can view own variables" ON custom_variables
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = coach_id);

CREATE POLICY "Users can insert own variables" ON custom_variables
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own variables" ON custom_variables
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own variables" ON custom_variables
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for custom_variable_entries
CREATE POLICY "Users can view own entries" ON custom_variable_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entries" ON custom_variable_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'athlete')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update goal progress when session is completed
CREATE OR REPLACE FUNCTION public.update_goal_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.goal_id IS NOT NULL THEN
    INSERT INTO goal_progress (goal_id, sessions_completed, last_session_date)
    VALUES (NEW.goal_id, 1, COALESCE(NEW.ended_at, NOW()))
    ON CONFLICT (goal_id) DO UPDATE SET
      sessions_completed = goal_progress.sessions_completed + 1,
      last_session_date = COALESCE(NEW.ended_at, NOW()),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update goal progress
CREATE TRIGGER on_session_completed
  AFTER INSERT OR UPDATE OF status ON climbing_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.update_goal_progress();

-- Create profiles for existing users (if any)
INSERT INTO profiles (id, full_name, role)
SELECT 
  id, 
  raw_user_meta_data->>'full_name',
  COALESCE(raw_user_meta_data->>'role', 'athlete')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
