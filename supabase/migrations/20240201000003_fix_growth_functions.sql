-- Migration: Fix growth function parameter types
-- This fixes the type casting issues in the growth calculation functions

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
-- 2. Add comment for the fixed function
-- =======================
COMMENT ON FUNCTION update_account_growth_periods(UUID) IS 'Updates all current growth periods for an account (fixed date casting)';

-- =======================
-- 3. Grant permissions for the updated function
-- =======================
GRANT EXECUTE ON FUNCTION update_account_growth_periods(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_account_growth_periods(UUID) TO anon;