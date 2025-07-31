-- Migration: Safe setup of growth metrics system (handles existing objects)
-- This migration safely creates or updates all growth-related database objects

-- =======================
-- 1. Ensure account_growth_metrics table exists with all columns
-- =======================
CREATE TABLE IF NOT EXISTS public.account_growth_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  start_followers INTEGER NOT NULL DEFAULT 0,
  end_followers INTEGER NOT NULL DEFAULT 0,
  growth_count INTEGER NOT NULL DEFAULT 0,
  growth_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique periods per account
  UNIQUE(account_id, period_type, period_start)
);

-- =======================
-- 2. Create indexes safely (IF NOT EXISTS)
-- =======================
CREATE INDEX IF NOT EXISTS account_growth_metrics_account_id_idx ON public.account_growth_metrics(account_id);
CREATE INDEX IF NOT EXISTS account_growth_metrics_period_type_idx ON public.account_growth_metrics(period_type);
CREATE INDEX IF NOT EXISTS account_growth_metrics_period_start_idx ON public.account_growth_metrics(period_start DESC);
CREATE INDEX IF NOT EXISTS account_growth_metrics_growth_count_idx ON public.account_growth_metrics(growth_count DESC);
CREATE INDEX IF NOT EXISTS account_growth_metrics_composite_idx ON public.account_growth_metrics(account_id, period_type, period_start DESC);

-- =======================
-- 3. Create all functions (CREATE OR REPLACE handles existing functions)
-- =======================

-- Function to calculate growth for a specific period
CREATE OR REPLACE FUNCTION calculate_period_growth(
  p_account_id UUID,
  p_period_type TEXT,
  p_period_start DATE,
  p_period_end DATE
) RETURNS TABLE (
  start_followers INTEGER,
  end_followers INTEGER,
  growth_count INTEGER,
  growth_percentage DECIMAL(5,2)
) AS $$
DECLARE
  v_start_followers INTEGER := 0;
  v_end_followers INTEGER := 0;
  v_growth_count INTEGER := 0;
  v_growth_percentage DECIMAL(5,2) := 0.00;
BEGIN
  -- Get follower count at start of period (closest record at or before start date)
  SELECT afh.follower_count INTO v_start_followers
  FROM account_follower_history afh
  WHERE afh.account_id = p_account_id
    AND DATE(afh.recorded_at) <= p_period_start
  ORDER BY afh.recorded_at DESC
  LIMIT 1;

  -- Get follower count at end of period (closest record at or before end date)
  SELECT afh.follower_count INTO v_end_followers
  FROM account_follower_history afh
  WHERE afh.account_id = p_account_id
    AND DATE(afh.recorded_at) <= p_period_end
  ORDER BY afh.recorded_at DESC
  LIMIT 1;

  -- Calculate growth
  v_start_followers := COALESCE(v_start_followers, 0);
  v_end_followers := COALESCE(v_end_followers, 0);
  v_growth_count := v_end_followers - v_start_followers;
  
  -- Calculate percentage
  IF v_start_followers > 0 THEN
    v_growth_percentage := ROUND((v_growth_count::DECIMAL / v_start_followers) * 100, 2);
  END IF;

  -- Return results
  start_followers := v_start_followers;
  end_followers := v_end_followers;
  growth_count := v_growth_count;
  growth_percentage := v_growth_percentage;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert growth metrics for an account
CREATE OR REPLACE FUNCTION upsert_account_growth_metrics(
  p_account_id UUID,
  p_period_type TEXT,
  p_period_start DATE,
  p_period_end DATE
) RETURNS VOID AS $$
DECLARE
  growth_data RECORD;
BEGIN
  -- Calculate growth for the period
  SELECT * INTO growth_data
  FROM calculate_period_growth(p_account_id, p_period_type, p_period_start, p_period_end);

  -- Upsert the growth metrics
  INSERT INTO public.account_growth_metrics (
    account_id,
    period_type,
    period_start,
    period_end,
    start_followers,
    end_followers,
    growth_count,
    growth_percentage
  ) VALUES (
    p_account_id,
    p_period_type,
    p_period_start,
    p_period_end,
    growth_data.start_followers,
    growth_data.end_followers,
    growth_data.growth_count,
    growth_data.growth_percentage
  )
  ON CONFLICT (account_id, period_type, period_start)
  DO UPDATE SET
    period_end = EXCLUDED.period_end,
    start_followers = EXCLUDED.start_followers,
    end_followers = EXCLUDED.end_followers,
    growth_count = EXCLUDED.growth_count,
    growth_percentage = EXCLUDED.growth_percentage,
    calculated_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to update all growth periods for an account (FIXED VERSION)
CREATE OR REPLACE FUNCTION update_account_growth_periods(p_account_id UUID)
RETURNS VOID AS $$
DECLARE
  current_date DATE := CURRENT_DATE;
  week_start DATE;
  month_start DATE;
  year_start DATE;
BEGIN
  -- Calculate current periods
  week_start := DATE_TRUNC('week', current_date)::DATE;
  month_start := DATE_TRUNC('month', current_date)::DATE;
  year_start := DATE_TRUNC('year', current_date)::DATE;

  -- Update current daily growth (yesterday)
  IF current_date > '2024-01-01'::DATE THEN
    PERFORM upsert_account_growth_metrics(
      p_account_id,
      'daily',
      (current_date - INTERVAL '1 day')::DATE,
      current_date
    );
  END IF;

  -- Update current weekly growth
  IF week_start > '2024-01-01'::DATE THEN
    PERFORM upsert_account_growth_metrics(
      p_account_id,
      'weekly',
      week_start,
      (week_start + INTERVAL '6 days')::DATE
    );
  END IF;

  -- Update current monthly growth
  IF month_start > '2024-01-01'::DATE THEN
    PERFORM upsert_account_growth_metrics(
      p_account_id,
      'monthly',
      month_start,
      (month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE
    );
  END IF;

  -- Update current yearly growth
  IF year_start > '2024-01-01'::DATE THEN
    PERFORM upsert_account_growth_metrics(
      p_account_id,
      'yearly',
      year_start,
      (year_start + INTERVAL '1 year' - INTERVAL '1 day')::DATE
    );
  END IF;

  -- Also update previous completed periods
  -- Previous week (if it's a new week)
  IF EXTRACT(DOW FROM current_date) = 1 AND (week_start - INTERVAL '7 days')::DATE > '2024-01-01'::DATE THEN
    PERFORM upsert_account_growth_metrics(
      p_account_id,
      'weekly',
      (week_start - INTERVAL '7 days')::DATE,
      (week_start - INTERVAL '1 day')::DATE
    );
  END IF;

  -- Previous month (if it's a new month)
  IF EXTRACT(DAY FROM current_date) = 1 AND (month_start - INTERVAL '1 month')::DATE > '2024-01-01'::DATE THEN
    PERFORM upsert_account_growth_metrics(
      p_account_id,
      'monthly',
      (month_start - INTERVAL '1 month')::DATE,
      (month_start - INTERVAL '1 day')::DATE
    );
  END IF;

  -- Previous year (if it's a new year)
  IF EXTRACT(DOY FROM current_date) = 1 AND (year_start - INTERVAL '1 year')::DATE > '2024-01-01'::DATE THEN
    PERFORM upsert_account_growth_metrics(
      p_account_id,
      'yearly',
      (year_start - INTERVAL '1 year')::DATE,
      (year_start - INTERVAL '1 day')::DATE
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-update growth when follower history changes
CREATE OR REPLACE FUNCTION trigger_update_growth_on_follower_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Update growth metrics for the account
  PERFORM update_account_growth_periods(NEW.account_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enhanced follower update function with automatic growth calculation
CREATE OR REPLACE FUNCTION update_account_follower_count_with_auto_growth(
  p_account_id UUID,
  p_new_follower_count INTEGER
) RETURNS VOID AS $$
DECLARE
  v_current_count INTEGER;
  v_change_amount INTEGER;
BEGIN
  -- Get current follower count
  SELECT follower_count INTO v_current_count
  FROM public.accounts
  WHERE id = p_account_id;
  
  -- Calculate change amount
  v_change_amount := p_new_follower_count - COALESCE(v_current_count, 0);
  
  -- Update accounts table
  UPDATE public.accounts 
  SET 
    follower_count = p_new_follower_count,
    follower_count_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_account_id;
  
  -- Insert into history table (this will trigger growth calculation)
  INSERT INTO public.account_follower_history (
    account_id,
    follower_count,
    change_amount,
    recorded_at
  ) VALUES (
    p_account_id,
    p_new_follower_count,
    v_change_amount,
    NOW()
  );
  
  RAISE NOTICE 'Updated follower count for account %: % (change: %, growth auto-calculated)', 
    p_account_id, p_new_follower_count, v_change_amount;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 4. Setup trigger safely
-- =======================
DROP TRIGGER IF EXISTS trigger_follower_history_growth_update ON public.account_follower_history;
CREATE TRIGGER trigger_follower_history_growth_update
  AFTER INSERT OR UPDATE ON public.account_follower_history
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_growth_on_follower_change();

-- =======================
-- 5. Create view safely
-- =======================
CREATE OR REPLACE VIEW account_latest_growth AS
SELECT DISTINCT ON (agm.account_id, agm.period_type)
  a.id as account_id,
  a.name,
  a.twitter_handle,
  a.follower_count,
  agm.period_type,
  agm.period_start,
  agm.period_end,
  agm.start_followers,
  agm.end_followers,
  agm.growth_count,
  agm.growth_percentage,
  agm.calculated_at
FROM public.accounts a
JOIN public.account_growth_metrics agm ON a.id = agm.account_id
WHERE a.twitter_handle IS NOT NULL AND a.twitter_handle != ''
ORDER BY agm.account_id, agm.period_type, agm.period_start DESC;

-- =======================
-- 6. Setup RLS safely
-- =======================
ALTER TABLE public.account_growth_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
  -- Try to drop policies if they exist
  DROP POLICY IF EXISTS "Allow read access to growth metrics" ON public.account_growth_metrics;
  DROP POLICY IF EXISTS "Allow insert access to growth metrics" ON public.account_growth_metrics;
  DROP POLICY IF EXISTS "Allow update access to growth metrics" ON public.account_growth_metrics;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors if policies don't exist
  NULL;
END
$$;

-- Create policies
CREATE POLICY "Allow read access to growth metrics" ON public.account_growth_metrics
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to growth metrics" ON public.account_growth_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to growth metrics" ON public.account_growth_metrics
  FOR UPDATE USING (true);

-- =======================
-- 7. Grant permissions safely
-- =======================
GRANT SELECT, INSERT, UPDATE ON public.account_growth_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.account_growth_metrics TO anon;
GRANT SELECT ON account_latest_growth TO authenticated;
GRANT SELECT ON account_latest_growth TO anon;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION calculate_period_growth(UUID, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_account_growth_metrics(UUID, TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION update_account_growth_periods(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_account_follower_count_with_auto_growth(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION calculate_period_growth(UUID, TEXT, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION upsert_account_growth_metrics(UUID, TEXT, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION update_account_growth_periods(UUID) TO anon;
GRANT EXECUTE ON FUNCTION update_account_follower_count_with_auto_growth(UUID, INTEGER) TO anon;

-- =======================
-- 8. Add comments
-- =======================
COMMENT ON FUNCTION calculate_period_growth(UUID, TEXT, DATE, DATE) IS 'Calculates growth metrics for a specific period';
COMMENT ON FUNCTION upsert_account_growth_metrics(UUID, TEXT, DATE, DATE) IS 'Updates or inserts growth metrics for a period';
COMMENT ON FUNCTION update_account_growth_periods(UUID) IS 'Updates all current growth periods for an account (fixed)';
COMMENT ON FUNCTION update_account_follower_count_with_auto_growth(UUID, INTEGER) IS 'Updates follower count and auto-calculates growth metrics';
COMMENT ON VIEW account_latest_growth IS 'Latest growth metrics for each account and period type';