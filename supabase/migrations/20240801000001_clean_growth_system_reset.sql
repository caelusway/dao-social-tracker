-- Migration: Complete reset of growth tracking system
-- Drops all existing growth tables and creates a fresh, logical system starting from today
-- Date: 2024-07-31

-- =======================
-- 1. Drop all existing growth-related tables and functions
-- =======================

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_follower_history_growth_update ON public.account_follower_history;

-- Drop views
DROP VIEW IF EXISTS account_latest_growth;

-- Drop tables
DROP TABLE IF EXISTS public.account_growth_metrics CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_update_growth_on_follower_change();
DROP FUNCTION IF EXISTS update_account_growth_periods(UUID);
DROP FUNCTION IF EXISTS upsert_account_growth_metrics(UUID, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS calculate_period_growth(UUID, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS update_account_follower_count_with_auto_growth(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_weekly_follower_growth(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_monthly_follower_growth(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_yearly_follower_growth(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_account_growth_summary(UUID);
DROP FUNCTION IF EXISTS get_top_growing_accounts(TEXT, INTEGER);

-- Clean up account_follower_history table (keep the table but remove old data)
TRUNCATE TABLE public.account_follower_history;

-- =======================
-- 2. Create new simple daily growth tracking table
-- =======================
CREATE TABLE public.follower_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  follower_count INTEGER NOT NULL DEFAULT 0,
  change_from_previous INTEGER DEFAULT 0,
  change_percentage DECIMAL(5,2) DEFAULT 0.00,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per account per day
  UNIQUE(account_id, date)
);

-- Create indexes for optimal performance
CREATE INDEX idx_follower_snapshots_account_date ON public.follower_daily_snapshots(account_id, date DESC);
CREATE INDEX idx_follower_snapshots_date ON public.follower_daily_snapshots(date DESC);
CREATE INDEX idx_follower_snapshots_change ON public.follower_daily_snapshots(change_from_previous DESC);

-- =======================
-- 3. Simple function to record daily snapshot
-- =======================
CREATE OR REPLACE FUNCTION record_daily_follower_snapshot(
  p_account_id UUID,
  p_follower_count INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS VOID AS $$
DECLARE
  v_previous_count INTEGER := 0;
  v_change_amount INTEGER := 0;
  v_change_percentage DECIMAL(5,2) := 0.00;
BEGIN
  -- Get previous day's follower count
  SELECT follower_count INTO v_previous_count
  FROM public.follower_daily_snapshots
  WHERE account_id = p_account_id
    AND date < p_date
  ORDER BY date DESC
  LIMIT 1;
  
  -- Calculate changes
  v_previous_count := COALESCE(v_previous_count, p_follower_count);
  v_change_amount := p_follower_count - v_previous_count;
  
  IF v_previous_count > 0 THEN
    v_change_percentage := ROUND((v_change_amount::DECIMAL / v_previous_count) * 100, 2);
  END IF;
  
  -- Insert or update today's snapshot
  INSERT INTO public.follower_daily_snapshots (
    account_id,
    date,
    follower_count,
    change_from_previous,
    change_percentage
  ) VALUES (
    p_account_id,
    p_date,
    p_follower_count,
    v_change_amount,
    v_change_percentage
  )
  ON CONFLICT (account_id, date)
  DO UPDATE SET
    follower_count = EXCLUDED.follower_count,
    change_from_previous = EXCLUDED.change_from_previous,
    change_percentage = EXCLUDED.change_percentage,
    recorded_at = NOW();
    
  -- Also update the accounts table
  UPDATE public.accounts 
  SET 
    follower_count = p_follower_count,
    follower_count_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_account_id;
  
  -- Also record in the legacy history table for compatibility
  INSERT INTO public.account_follower_history (
    account_id,
    follower_count,
    change_amount,
    recorded_at
  ) VALUES (
    p_account_id,
    p_follower_count,
    v_change_amount,
    NOW()
  );
    
  RAISE NOTICE 'Daily snapshot recorded for account %: % followers (change: %)', 
    p_account_id, p_follower_count, v_change_amount;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 4. Functions to calculate growth over different periods  
-- =======================

-- Get growth over last N days
CREATE OR REPLACE FUNCTION get_account_growth_days(
  p_account_id UUID,
  p_days INTEGER DEFAULT 7
) RETURNS TABLE (
  start_date DATE,
  end_date DATE,
  start_followers INTEGER,
  end_followers INTEGER,
  total_change INTEGER,
  percentage_change DECIMAL(5,2),
  avg_daily_change DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH period_data AS (
    SELECT 
      MIN(date) as period_start,
      MAX(date) as period_end,
      (array_agg(follower_count ORDER BY date))[1] as start_count,
      (array_agg(follower_count ORDER BY date DESC))[1] as end_count
    FROM public.follower_daily_snapshots
    WHERE account_id = p_account_id
      AND date >= CURRENT_DATE - p_days
      AND date <= CURRENT_DATE
  )
  SELECT 
    pd.period_start,
    pd.period_end,
    pd.start_count,
    pd.end_count,
    (pd.end_count - pd.start_count) as total_change,
    CASE 
      WHEN pd.start_count > 0 THEN 
        ROUND(((pd.end_count - pd.start_count)::DECIMAL / pd.start_count) * 100, 2)
      ELSE 0.00
    END as percentage_change,
    CASE 
      WHEN p_days > 0 THEN 
        ROUND((pd.end_count - pd.start_count)::DECIMAL / p_days, 2)
      ELSE 0.00
    END as avg_daily_change
  FROM period_data pd
  WHERE pd.start_count IS NOT NULL AND pd.end_count IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Get top growing accounts over period
CREATE OR REPLACE FUNCTION get_top_growing_accounts_period(
  p_days INTEGER DEFAULT 7,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  account_id UUID,
  account_name TEXT,
  twitter_handle TEXT,
  current_followers INTEGER,
  growth_amount INTEGER,
  growth_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH account_growth AS (
    SELECT 
      a.id,
      a.name,
      a.twitter_handle,
      a.follower_count as current_followers,
      COALESCE(
        (SELECT s2.follower_count - s1.follower_count
         FROM public.follower_daily_snapshots s1, public.follower_daily_snapshots s2
         WHERE s1.account_id = a.id AND s2.account_id = a.id
           AND s1.date = CURRENT_DATE - p_days
           AND s2.date = CURRENT_DATE), 
        0
      ) as growth_amount,
      COALESCE(
        (SELECT 
          CASE 
            WHEN s1.follower_count > 0 THEN 
              ROUND(((s2.follower_count - s1.follower_count)::DECIMAL / s1.follower_count) * 100, 2)
            ELSE 0.00
          END
         FROM public.follower_daily_snapshots s1, public.follower_daily_snapshots s2
         WHERE s1.account_id = a.id AND s2.account_id = a.id
           AND s1.date = CURRENT_DATE - p_days
           AND s2.date = CURRENT_DATE), 
        0.00
      ) as growth_percentage
    FROM public.accounts a
    WHERE a.twitter_handle IS NOT NULL 
      AND a.twitter_handle != ''
      AND a.follower_count IS NOT NULL
  )
  SELECT 
    ag.id,
    ag.name,
    ag.twitter_handle,
    ag.current_followers,
    ag.growth_amount,
    ag.growth_percentage
  FROM account_growth ag
  ORDER BY ag.growth_amount DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get daily snapshots for an account
CREATE OR REPLACE FUNCTION get_account_daily_snapshots(
  p_account_id UUID,
  p_limit INTEGER DEFAULT 30
) RETURNS TABLE (
  date DATE,
  follower_count INTEGER,
  change_from_previous INTEGER,
  change_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fds.date,
    fds.follower_count,
    fds.change_from_previous,
    fds.change_percentage
  FROM public.follower_daily_snapshots fds
  WHERE fds.account_id = p_account_id
  ORDER BY fds.date DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 5. Create view for easy access to latest data
-- =======================
CREATE VIEW latest_follower_snapshots AS
SELECT DISTINCT ON (fds.account_id)
  a.id as account_id,
  a.name,
  a.twitter_handle,
  a.follower_count as current_followers,
  fds.date as last_snapshot_date,
  fds.change_from_previous as daily_change,
  fds.change_percentage as daily_change_percentage
FROM public.accounts a
LEFT JOIN public.follower_daily_snapshots fds ON a.id = fds.account_id
WHERE a.twitter_handle IS NOT NULL AND a.twitter_handle != ''
ORDER BY fds.account_id, fds.date DESC;

-- =======================
-- 6. Set up RLS policies
-- =======================
ALTER TABLE public.follower_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to follower snapshots" ON public.follower_daily_snapshots
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access to follower snapshots" ON public.follower_daily_snapshots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access to follower snapshots" ON public.follower_daily_snapshots
  FOR UPDATE USING (true);

-- =======================
-- 7. Grant permissions
-- =======================
GRANT SELECT, INSERT, UPDATE ON public.follower_daily_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.follower_daily_snapshots TO anon;
GRANT SELECT ON latest_follower_snapshots TO authenticated;
GRANT SELECT ON latest_follower_snapshots TO anon;

GRANT EXECUTE ON FUNCTION record_daily_follower_snapshot(UUID, INTEGER, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_growth_days(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_growing_accounts_period(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_daily_snapshots(UUID, INTEGER) TO authenticated;

GRANT EXECUTE ON FUNCTION record_daily_follower_snapshot(UUID, INTEGER, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_account_growth_days(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_top_growing_accounts_period(INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_account_daily_snapshots(UUID, INTEGER) TO anon;

-- =======================
-- 8. Add helpful comments
-- =======================
COMMENT ON TABLE public.follower_daily_snapshots IS 'Daily snapshots of follower counts starting from today';
COMMENT ON FUNCTION record_daily_follower_snapshot(UUID, INTEGER, DATE) IS 'Records daily follower snapshot with growth calculation';
COMMENT ON FUNCTION get_account_growth_days(UUID, INTEGER) IS 'Gets growth metrics over specified number of days';
COMMENT ON FUNCTION get_top_growing_accounts_period(INTEGER, INTEGER) IS 'Gets top growing accounts over specified period';
COMMENT ON VIEW latest_follower_snapshots IS 'Latest follower snapshot for each account';

-- =======================
-- 9. Initialize system with today's data
-- =======================
-- This will be populated when the first sync runs

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Growth tracking system has been completely reset and redesigned!';
  RAISE NOTICE 'New system features:';
  RAISE NOTICE '- Simple daily snapshots starting from today';
  RAISE NOTICE '- Flexible period-based growth calculations';
  RAISE NOTICE '- Clean, logical database structure';
  RAISE NOTICE '- Automatic change calculation';
  RAISE NOTICE 'Run follower sync to start collecting data!';
END $$;