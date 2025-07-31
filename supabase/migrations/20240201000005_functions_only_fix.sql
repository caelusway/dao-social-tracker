-- Migration: Fix only the growth functions (no policies or table creation)
-- This fixes just the function issues to avoid conflicts

-- =======================
-- 1. Fix the update_account_growth_periods function with proper date casting
-- =======================
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

-- =======================
-- 2. Ensure the upsert function exists (in case it's missing)
-- =======================
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

-- =======================
-- 3. Ensure the calculation function exists
-- =======================
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

-- =======================
-- 4. Grant basic permissions (no conflicts)
-- =======================
GRANT EXECUTE ON FUNCTION calculate_period_growth(UUID, TEXT, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION upsert_account_growth_metrics(UUID, TEXT, DATE, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_account_growth_periods(UUID) TO authenticated, anon;