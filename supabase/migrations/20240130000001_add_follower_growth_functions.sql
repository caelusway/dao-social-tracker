-- Migration: Add follower growth calculation functions
-- This script adds functions to calculate weekly, monthly, and yearly follower growth

-- =======================
-- 1. Function to get weekly follower growth
-- =======================
CREATE OR REPLACE FUNCTION get_weekly_follower_growth(
  p_account_id UUID,
  p_weeks_back INTEGER DEFAULT 4
) RETURNS TABLE (
  week_start_date DATE,
  week_end_date DATE,
  start_followers INTEGER,
  end_followers INTEGER,
  growth_count INTEGER,
  growth_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_data AS (
    SELECT 
      DATE_TRUNC('week', afh.recorded_at)::DATE as week_start,
      (DATE_TRUNC('week', afh.recorded_at) + INTERVAL '6 days')::DATE as week_end,
      MIN(afh.recorded_at) as first_record_time,
      MAX(afh.recorded_at) as last_record_time
    FROM account_follower_history afh
    WHERE afh.account_id = p_account_id
      AND afh.recorded_at >= DATE_TRUNC('week', NOW() - (p_weeks_back || ' weeks')::INTERVAL)
    GROUP BY DATE_TRUNC('week', afh.recorded_at)
    ORDER BY week_start DESC
  ),
  weekly_followers AS (
    SELECT 
      wd.week_start,
      wd.week_end,
      COALESCE(
        (SELECT afh.follower_count 
         FROM account_follower_history afh 
         WHERE afh.account_id = p_account_id 
           AND afh.recorded_at = wd.first_record_time
         LIMIT 1), 0
      ) as start_followers,
      COALESCE(
        (SELECT afh.follower_count 
         FROM account_follower_history afh 
         WHERE afh.account_id = p_account_id 
           AND afh.recorded_at = wd.last_record_time
         LIMIT 1), 0
      ) as end_followers
    FROM weekly_data wd
  )
  SELECT 
    wf.week_start,
    wf.week_end,
    wf.start_followers,
    wf.end_followers,
    (wf.end_followers - wf.start_followers) as growth_count,
    CASE 
      WHEN wf.start_followers > 0 THEN 
        ROUND(((wf.end_followers - wf.start_followers)::DECIMAL / wf.start_followers) * 100, 2)
      ELSE 0
    END as growth_percentage
  FROM weekly_followers wf
  ORDER BY wf.week_start DESC;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 2. Function to get monthly follower growth
-- =======================
CREATE OR REPLACE FUNCTION get_monthly_follower_growth(
  p_account_id UUID,
  p_months_back INTEGER DEFAULT 12
) RETURNS TABLE (
  month_start_date DATE,
  month_end_date DATE,
  start_followers INTEGER,
  end_followers INTEGER,
  growth_count INTEGER,
  growth_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      DATE_TRUNC('month', afh.recorded_at)::DATE as month_start,
      (DATE_TRUNC('month', afh.recorded_at) + INTERVAL '1 month' - INTERVAL '1 day')::DATE as month_end,
      MIN(afh.recorded_at) as first_record_time,
      MAX(afh.recorded_at) as last_record_time
    FROM account_follower_history afh
    WHERE afh.account_id = p_account_id
      AND afh.recorded_at >= DATE_TRUNC('month', NOW() - (p_months_back || ' months')::INTERVAL)
    GROUP BY DATE_TRUNC('month', afh.recorded_at)
    ORDER BY month_start DESC
  ),
  monthly_followers AS (
    SELECT 
      md.month_start,
      md.month_end,
      COALESCE(
        (SELECT afh.follower_count 
         FROM account_follower_history afh 
         WHERE afh.account_id = p_account_id 
           AND afh.recorded_at = md.first_record_time
         LIMIT 1), 0
      ) as start_followers,
      COALESCE(
        (SELECT afh.follower_count 
         FROM account_follower_history afh 
         WHERE afh.account_id = p_account_id 
           AND afh.recorded_at = md.last_record_time
         LIMIT 1), 0
      ) as end_followers
    FROM monthly_data md
  )
  SELECT 
    mf.month_start,
    mf.month_end,
    mf.start_followers,
    mf.end_followers,
    (mf.end_followers - mf.start_followers) as growth_count,
    CASE 
      WHEN mf.start_followers > 0 THEN 
        ROUND(((mf.end_followers - mf.start_followers)::DECIMAL / mf.start_followers) * 100, 2)
      ELSE 0
    END as growth_percentage
  FROM monthly_followers mf
  ORDER BY mf.month_start DESC;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 3. Function to get yearly follower growth
-- =======================
CREATE OR REPLACE FUNCTION get_yearly_follower_growth(
  p_account_id UUID,
  p_years_back INTEGER DEFAULT 3
) RETURNS TABLE (
  year_start_date DATE,
  year_end_date DATE,
  start_followers INTEGER,
  end_followers INTEGER,
  growth_count INTEGER,
  growth_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH yearly_data AS (
    SELECT 
      DATE_TRUNC('year', afh.recorded_at)::DATE as year_start,
      (DATE_TRUNC('year', afh.recorded_at) + INTERVAL '1 year' - INTERVAL '1 day')::DATE as year_end,
      MIN(afh.recorded_at) as first_record_time,
      MAX(afh.recorded_at) as last_record_time
    FROM account_follower_history afh
    WHERE afh.account_id = p_account_id
      AND afh.recorded_at >= DATE_TRUNC('year', NOW() - (p_years_back || ' years')::INTERVAL)
    GROUP BY DATE_TRUNC('year', afh.recorded_at)
    ORDER BY year_start DESC
  ),
  yearly_followers AS (
    SELECT 
      yd.year_start,
      yd.year_end,
      COALESCE(
        (SELECT afh.follower_count 
         FROM account_follower_history afh 
         WHERE afh.account_id = p_account_id 
           AND afh.recorded_at = yd.first_record_time
         LIMIT 1), 0
      ) as start_followers,
      COALESCE(
        (SELECT afh.follower_count 
         FROM account_follower_history afh 
         WHERE afh.account_id = p_account_id 
           AND afh.recorded_at = yd.last_record_time
         LIMIT 1), 0
      ) as end_followers
    FROM yearly_data yd
  )
  SELECT 
    yf.year_start,
    yf.year_end,
    yf.start_followers,
    yf.end_followers,
    (yf.end_followers - yf.start_followers) as growth_count,
    CASE 
      WHEN yf.start_followers > 0 THEN 
        ROUND(((yf.end_followers - yf.start_followers)::DECIMAL / yf.start_followers) * 100, 2)
      ELSE 0
    END as growth_percentage
  FROM yearly_followers yf
  ORDER BY yf.year_start DESC;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 4. Function to get growth summary for all periods
-- =======================
CREATE OR REPLACE FUNCTION get_account_growth_summary(
  p_account_id UUID
) RETURNS TABLE (
  period_type TEXT,
  recent_growth_count INTEGER,
  recent_growth_percentage DECIMAL(5,2),
  average_growth_count DECIMAL(10,2),
  average_growth_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  -- Weekly summary (last 4 weeks)
  SELECT 
    'weekly'::TEXT as period_type,
    COALESCE(SUM(growth_count), 0)::INTEGER as recent_growth_count,
    COALESCE(AVG(growth_percentage), 0)::DECIMAL(5,2) as recent_growth_percentage,
    COALESCE(AVG(growth_count), 0)::DECIMAL(10,2) as average_growth_count,
    COALESCE(AVG(growth_percentage), 0)::DECIMAL(5,2) as average_growth_percentage
  FROM get_weekly_follower_growth(p_account_id, 4)
  
  UNION ALL
  
  -- Monthly summary (last 12 months)
  SELECT 
    'monthly'::TEXT as period_type,
    COALESCE(SUM(growth_count), 0)::INTEGER as recent_growth_count,
    COALESCE(AVG(growth_percentage), 0)::DECIMAL(5,2) as recent_growth_percentage,
    COALESCE(AVG(growth_count), 0)::DECIMAL(10,2) as average_growth_count,
    COALESCE(AVG(growth_percentage), 0)::DECIMAL(5,2) as average_growth_percentage
  FROM get_monthly_follower_growth(p_account_id, 12)
  
  UNION ALL
  
  -- Yearly summary (last 3 years)
  SELECT 
    'yearly'::TEXT as period_type,
    COALESCE(SUM(growth_count), 0)::INTEGER as recent_growth_count,
    COALESCE(AVG(growth_percentage), 0)::DECIMAL(5,2) as recent_growth_percentage,
    COALESCE(AVG(growth_count), 0)::DECIMAL(10,2) as average_growth_count,
    COALESCE(AVG(growth_percentage), 0)::DECIMAL(5,2) as average_growth_percentage
  FROM get_yearly_follower_growth(p_account_id, 3);
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 5. Function to get top growing accounts by period
-- =======================
CREATE OR REPLACE FUNCTION get_top_growing_accounts(
  p_period_type TEXT DEFAULT 'monthly',
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  account_id UUID,
  account_name TEXT,
  twitter_handle TEXT,
  total_growth INTEGER,
  average_growth_percentage DECIMAL(5,2),
  current_followers INTEGER
) AS $$
BEGIN
  IF p_period_type = 'weekly' THEN
    RETURN QUERY
    SELECT 
      a.id,
      a.name,
      a.twitter_handle,
      COALESCE(SUM(wg.growth_count), 0)::INTEGER as total_growth,
      COALESCE(AVG(wg.growth_percentage), 0)::DECIMAL(5,2) as average_growth_percentage,
      COALESCE(a.follower_count, 0) as current_followers
    FROM accounts a
    LEFT JOIN LATERAL get_weekly_follower_growth(a.id, 4) wg ON true
    WHERE a.twitter_handle IS NOT NULL AND a.twitter_handle != ''
    GROUP BY a.id, a.name, a.twitter_handle, a.follower_count
    ORDER BY total_growth DESC
    LIMIT p_limit;
  
  ELSIF p_period_type = 'yearly' THEN
    RETURN QUERY
    SELECT 
      a.id,
      a.name,
      a.twitter_handle,
      COALESCE(SUM(yg.growth_count), 0)::INTEGER as total_growth,
      COALESCE(AVG(yg.growth_percentage), 0)::DECIMAL(5,2) as average_growth_percentage,
      COALESCE(a.follower_count, 0) as current_followers
    FROM accounts a
    LEFT JOIN LATERAL get_yearly_follower_growth(a.id, 3) yg ON true
    WHERE a.twitter_handle IS NOT NULL AND a.twitter_handle != ''
    GROUP BY a.id, a.name, a.twitter_handle, a.follower_count
    ORDER BY total_growth DESC
    LIMIT p_limit;
  
  ELSE -- Default to monthly
    RETURN QUERY
    SELECT 
      a.id,
      a.name,
      a.twitter_handle,
      COALESCE(SUM(mg.growth_count), 0)::INTEGER as total_growth,
      COALESCE(AVG(mg.growth_percentage), 0)::DECIMAL(5,2) as average_growth_percentage,
      COALESCE(a.follower_count, 0) as current_followers
    FROM accounts a
    LEFT JOIN LATERAL get_monthly_follower_growth(a.id, 12) mg ON true
    WHERE a.twitter_handle IS NOT NULL AND a.twitter_handle != ''
    GROUP BY a.id, a.name, a.twitter_handle, a.follower_count
    ORDER BY total_growth DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 6. Add comments for documentation
-- =======================
COMMENT ON FUNCTION get_weekly_follower_growth(UUID, INTEGER) IS 'Gets weekly follower growth data for an account';
COMMENT ON FUNCTION get_monthly_follower_growth(UUID, INTEGER) IS 'Gets monthly follower growth data for an account';
COMMENT ON FUNCTION get_yearly_follower_growth(UUID, INTEGER) IS 'Gets yearly follower growth data for an account';
COMMENT ON FUNCTION get_account_growth_summary(UUID) IS 'Gets growth summary across all time periods for an account';
COMMENT ON FUNCTION get_top_growing_accounts(TEXT, INTEGER) IS 'Gets top growing accounts by period (weekly/monthly/yearly)';

-- =======================
-- 7. Grant necessary permissions
-- =======================
-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_weekly_follower_growth(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monthly_follower_growth(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_yearly_follower_growth(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_growth_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_growing_accounts(TEXT, INTEGER) TO authenticated;

-- Grant execute permissions to anon users for public access
GRANT EXECUTE ON FUNCTION get_weekly_follower_growth(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_monthly_follower_growth(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_yearly_follower_growth(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_account_growth_summary(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_top_growing_accounts(TEXT, INTEGER) TO anon;