-- ==============================================================================
-- BUDGETMITRA — PRODUCTION DATABASE MIGRATION (Idempotent)
-- ==============================================================================
-- Location: supabase/migrations/20261124_production_schema.sql
-- Target: Supabase Postgres 15+
-- Features:
--   1. Schema for profiles, transactions, budgets, savings_goals, student_loans,
--      gamification, and schemes with strict numeric & enum check constraints.
--   2. Strict Row Level Security (RLS) policies restricting data access to auth.uid().
--   3. Indexes on user_id, dates, and categories for optimal query performance.
--   4. Automatic auth.users trigger that initializes user profiles on signup.
--
-- HOW TO APPLY:
--   Option A: Via Supabase Web Dashboard -> SQL Editor -> Paste & Run.
--   Option B: Via Supabase CLI: supabase db push or supabase migration up.
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Profiles Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Student',
    monthly_allowance NUMERIC(12, 2) NOT NULL DEFAULT 15000.00 CHECK (monthly_allowance >= 0 AND monthly_allowance <= 10000000),
    academic_year TEXT NOT NULL DEFAULT '2nd Year',
    course TEXT NOT NULL DEFAULT 'B.Tech Computer Science',
    college TEXT NOT NULL DEFAULT 'Engineering College',
    state TEXT NOT NULL DEFAULT 'Maharashtra',
    category TEXT NOT NULL DEFAULT 'General',
    family_income NUMERIC(12, 2) NOT NULL DEFAULT 450000.00 CHECK (family_income >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    theme_preference TEXT NOT NULL DEFAULT 'dark',
    has_completed_onboarding BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ==============================================================================
-- 3. Transactions Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    description TEXT NOT NULL CHECK (char_length(description) <= 255),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0 AND amount <= 10000000),
    category TEXT NOT NULL CHECK (category IN (
        'Food & Dining', 'Housing & Rent', 'Academic & Books', 'Transport',
        'Entertainment', 'Healthcare', 'Personal & Shopping', 'Utilities & Bills',
        'Income & Stipend', 'Savings & Investments', 'Other'
    )),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL DEFAULT 'debit' CHECK (type IN ('debit', 'credit')),
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'sms_parsed', 'csv_import', 'split_bill', 'receipt_scan')),
    masked_account TEXT,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category);

-- ==============================================================================
-- 4. Budgets Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    allocated NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (allocated >= 0 AND allocated <= 10000000),
    period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'semester')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE (user_id, category, period)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);

-- ==============================================================================
-- 5. Savings Goals Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(title) <= 120),
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0 AND target_amount <= 10000000),
    current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
    deadline DATE,
    icon TEXT DEFAULT 'Target',
    category TEXT DEFAULT 'Personal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON public.savings_goals(user_id);

-- ==============================================================================
-- 6. Student Loans Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) <= 120),
    principal NUMERIC(14, 2) NOT NULL CHECK (principal > 0 AND principal <= 100000000),
    interest_rate NUMERIC(5, 2) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 100),
    term_months INTEGER NOT NULL CHECK (term_months > 0 AND term_months <= 600),
    extra_payment NUMERIC(12, 2) DEFAULT 0.00 CHECK (extra_payment >= 0),
    loan_type TEXT DEFAULT 'Subsidized' CHECK (loan_type IN ('Subsidized', 'Unsubsidized', 'Private', 'NBFC')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_student_loans_user_id ON public.student_loans(user_id);

-- ==============================================================================
-- 7. Gamification & Streaks Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.gamification (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    streak_count INTEGER NOT NULL DEFAULT 0 CHECK (streak_count >= 0),
    last_active_date DATE,
    total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    unlocked_badges TEXT[] DEFAULT ARRAY[]::TEXT[],
    history JSONB DEFAULT '[]'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ==============================================================================
-- 8. Government & Private Schemes Repository (Shared Reference Data)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    provider TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Scholarship', 'Loan', 'Grant', 'Fellowship')),
    amount_max NUMERIC(12, 2) NOT NULL CHECK (amount_max >= 0),
    deadline DATE,
    category TEXT[] NOT NULL DEFAULT ARRAY['All'],
    eligible_states TEXT[] NOT NULL DEFAULT ARRAY['All India'],
    eligible_courses TEXT[] NOT NULL DEFAULT ARRAY['All'],
    max_income NUMERIC(12, 2) DEFAULT NULL,
    min_cgpa NUMERIC(3, 2) DEFAULT NULL,
    gender_preference TEXT DEFAULT 'All',
    portal_url TEXT NOT NULL,
    official_description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ==============================================================================
-- 9. Automatic Updated-At Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_budgets_updated ON public.budgets;
CREATE TRIGGER on_budgets_updated
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_savings_goals_updated ON public.savings_goals;
CREATE TRIGGER on_savings_goals_updated
    BEFORE UPDATE ON public.savings_goals
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 10. Automatic Profile Creation on Signup (Auth Trigger)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, has_completed_onboarding)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, 'student@college.edu'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Student'),
        FALSE
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.gamification (user_id, streak_count, total_xp, level)
    VALUES (NEW.id, 0, 50, 1)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only manage own profile
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
CREATE POLICY "Users can manage own profile"
    ON public.profiles FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Transactions: Strict isolation by user_id
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Budgets: Strict isolation by user_id
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;
CREATE POLICY "Users can manage own budgets"
    ON public.budgets FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Savings Goals: Strict isolation by user_id
DROP POLICY IF EXISTS "Users can manage own savings goals" ON public.savings_goals;
CREATE POLICY "Users can manage own savings goals"
    ON public.savings_goals FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Student Loans: Strict isolation by user_id
DROP POLICY IF EXISTS "Users can manage own loans" ON public.student_loans;
CREATE POLICY "Users can manage own loans"
    ON public.student_loans FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Gamification: Strict isolation by user_id
DROP POLICY IF EXISTS "Users can manage own gamification" ON public.gamification;
CREATE POLICY "Users can manage own gamification"
    ON public.gamification FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Schemes: Shared reference data (Read-only for all authenticated & anonymous users)
DROP POLICY IF EXISTS "Public schemes read access" ON public.schemes;
CREATE POLICY "Public schemes read access"
    ON public.schemes FOR SELECT
    USING (is_active = true);
