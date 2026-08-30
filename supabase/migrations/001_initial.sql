-- ============================================================
-- CenovIA — Migration 001: Estrutura inicial do banco de dados
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfis de usuário (criados automaticamente via trigger)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessões de estudo
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('fundamental', 'medio', 'superior')),
  grade_label TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  course TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0
);

-- Controle de uso mensal (free tier)
-- Constraint UNIQUE(user_id, month) garante uma linha por usuário/mês
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,  -- formato 'YYYY-MM'
  minutes_used NUMERIC(10,2) DEFAULT 0,
  UNIQUE(user_id, month)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário gerencia apenas o próprio perfil
CREATE POLICY "Users can manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Sessions: usuário gerencia apenas suas próprias sessões
CREATE POLICY "Users can manage own sessions" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Usage: usuário apenas lê (backend usa service key para escrever)
CREATE POLICY "Users can view own usage" ON usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Backend pode inserir/atualizar usage (via service key, bypassa RLS)

-- ============================================================
-- TRIGGER: Criar profile automaticamente ao cadastrar usuário
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNÇÃO RPC: Incremento atômico de uso (evita race conditions)
-- O backend chama esta função a cada 30s de sessão ativa
-- Usa INSERT ... ON CONFLICT ... DO UPDATE para operação atômica
-- ============================================================

CREATE OR REPLACE FUNCTION increment_usage_minutes(
  p_user_id UUID,
  p_month TEXT,
  p_minutes NUMERIC
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO usage_tracking (user_id, month, minutes_used)
  VALUES (p_user_id, p_month, p_minutes)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    minutes_used = usage_tracking.minutes_used + EXCLUDED.minutes_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permite que usuários anônimos chamem a função via service key
-- (o backend usa service key, então não precisa de grant explícito)

-- ============================================================
-- ÍNDICES para performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON study_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month ON usage_tracking(user_id, month);

-- ============================================================
-- FIM DA MIGRATION 001
-- ============================================================
