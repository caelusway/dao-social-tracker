-- Migration: Add follower growth data columns to accounts table
-- This script adds columns to store calculated growth metrics directly in the accounts table

-- =======================
-- 1. Add growth data columns to accounts table
-- =======================
ALTER TABLE public.accounts 
ADD COLUMN weekly_growth INTEGER DEFAULT 0,
ADD COLUMN weekly_growth_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN monthly_growth INTEGER DEFAULT 0,
ADD COLUMN monthly_growth_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN yearly_growth INTEGER DEFAULT 0,
ADD COLUMN yearly_growth_percentage DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN growth_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create indexes for better performance on growth queries
CREATE INDEX IF NOT EXISTS accounts_weekly_growth_idx ON public.accounts(weekly_growth DESC);
CREATE INDEX IF NOT EXISTS accounts_monthly_growth_idx ON public.accounts(monthly_growth DESC);
CREATE INDEX IF NOT EXISTS accounts_yearly_growth_idx ON public.accounts(yearly_growth DESC);
CREATE INDEX IF NOT EXISTS accounts_growth_calculated_idx ON public.accounts(growth_calculated_at DESC);

-- =======================
-- 2. Add comments for documentation
-- =======================
COMMENT ON COLUMN public.accounts.weekly_growth IS 'Recent weekly follower growth (last complete week)';
COMMENT ON COLUMN public.accounts.weekly_growth_percentage IS 'Recent weekly growth percentage';
COMMENT ON COLUMN public.accounts.monthly_growth IS 'Recent monthly follower growth (last complete month)';
COMMENT ON COLUMN public.accounts.monthly_growth_percentage IS 'Recent monthly growth percentage';
COMMENT ON COLUMN public.accounts.yearly_growth IS 'Recent yearly follower growth (last complete year)';
COMMENT ON COLUMN public.accounts.yearly_growth_percentage IS 'Recent yearly growth percentage';
COMMENT ON COLUMN public.accounts.growth_calculated_at IS 'When growth metrics were last calculated';

-- =======================
-- 3. Create function to calculate and update growth metrics for an account
-- =======================
CREATE OR REPLACE FUNCTION calculate_and_update_account_growth(
  p_account_id UUID
) RETURNS VOID AS $$
DECLARE
  v_weekly_growth INTEGER := 0;
  v_weekly_growth_pct DECIMAL(5,2) := 0.00;
  v_monthly_growth INTEGER := 0;
  v_monthly_growth_pct DECIMAL(5,2) := 0.00;
  v_yearly_growth INTEGER := 0;
  v_yearly_growth_pct DECIMAL(5,2) := 0.00;
BEGIN
  -- Calculate most recent weekly growth
  SELECT 
    COALESCE(growth_count, 0),
    COALESCE(growth_percentage, 0.00)
  INTO v_weekly_growth, v_weekly_growth_pct
  FROM get_weekly_follower_growth(p_account_id, 2)
  ORDER BY week_start_date DESC
  LIMIT 1;

  -- Calculate most recent monthly growth
  SELECT 
    COALESCE(growth_count, 0),
    COALESCE(growth_percentage, 0.00)
  INTO v_monthly_growth, v_monthly_growth_pct
  FROM get_monthly_follower_growth(p_account_id, 2)
  ORDER BY month_start_date DESC
  LIMIT 1;

  -- Calculate most recent yearly growth
  SELECT 
    COALESCE(growth_count, 0),
    COALESCE(growth_percentage, 0.00)
  INTO v_yearly_growth, v_yearly_growth_pct
  FROM get_yearly_follower_growth(p_account_id, 2)
  ORDER BY year_start_date DESC
  LIMIT 1;

  -- Update the accounts table
  UPDATE public.accounts 
  SET 
    weekly_growth = v_weekly_growth,
    weekly_growth_percentage = v_weekly_growth_pct,
    monthly_growth = v_monthly_growth,
    monthly_growth_percentage = v_monthly_growth_pct,
    yearly_growth = v_yearly_growth,
    yearly_growth_percentage = v_yearly_growth_pct,
    growth_calculated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_account_id;

  -- Log the update
  RAISE NOTICE 'Updated growth metrics for account %: W:%/% M:%/% Y:%/%', 
    p_account_id, v_weekly_growth, v_weekly_growth_pct, 
    v_monthly_growth, v_monthly_growth_pct, v_yearly_growth, v_yearly_growth_pct;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 4. Create function to update growth metrics for all accounts
-- =======================
CREATE OR REPLACE FUNCTION update_all_account_growth_metrics()
RETURNS TABLE (
  updated_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  account_record RECORD;
  v_updated_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  -- Loop through all accounts with Twitter handles
  FOR account_record IN 
    SELECT id, name, twitter_handle 
    FROM public.accounts 
    WHERE twitter_handle IS NOT NULL AND twitter_handle != ''
  LOOP
    BEGIN
      -- Calculate and update growth for each account
      PERFORM calculate_and_update_account_growth(account_record.id);
      v_updated_count := v_updated_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error updating growth for account % (%): %', 
        account_record.name, account_record.id, SQLERRM;
      v_error_count := v_error_count + 1;
    END;
  END LOOP;

  -- Return results
  updated_count := v_updated_count;
  error_count := v_error_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 5. Create enhanced follower count update function
-- =======================
CREATE OR REPLACE FUNCTION update_account_follower_count_with_growth(
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
  
  -- Update accounts table with new follower count
  UPDATE public.accounts 
  SET 
    follower_count = p_new_follower_count,
    follower_count_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_account_id;
  
  -- Insert into history table
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
  
  -- Calculate and update growth metrics
  PERFORM calculate_and_update_account_growth(p_account_id);
  
  -- Log the change
  RAISE NOTICE 'Updated follower count and growth for account %: % (change: %)', 
    p_account_id, p_new_follower_count, v_change_amount;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 6. Create view for easy access to account growth data
-- =======================
CREATE OR REPLACE VIEW account_growth_summary AS
SELECT 
  a.id,
  a.name,
  a.twitter_handle,
  a.follower_count,
  a.follower_count_updated_at,
  a.weekly_growth,
  a.weekly_growth_percentage,
  a.monthly_growth,
  a.monthly_growth_percentage,
  a.yearly_growth,
  a.yearly_growth_percentage,
  a.growth_calculated_at,
  CASE 
    WHEN a.weekly_growth > 0 THEN 'growing'
    WHEN a.weekly_growth < 0 THEN 'declining'
    ELSE 'stable'
  END as weekly_trend,
  CASE 
    WHEN a.monthly_growth > 0 THEN 'growing'
    WHEN a.monthly_growth < 0 THEN 'declining'
    ELSE 'stable'
  END as monthly_trend,
  CASE 
    WHEN a.yearly_growth > 0 THEN 'growing'
    WHEN a.yearly_growth < 0 THEN 'declining'
    ELSE 'stable'
  END as yearly_trend
FROM public.accounts a
WHERE a.twitter_handle IS NOT NULL AND a.twitter_handle != '';

-- =======================
-- 7. Add comments for new functions and view
-- =======================
COMMENT ON FUNCTION calculate_and_update_account_growth(UUID) IS 'Calculates and updates growth metrics for a specific account';
COMMENT ON FUNCTION update_all_account_growth_metrics() IS 'Updates growth metrics for all accounts with Twitter handles';
COMMENT ON FUNCTION update_account_follower_count_with_growth(UUID, INTEGER) IS 'Updates follower count and recalculates growth metrics';
COMMENT ON VIEW account_growth_summary IS 'Convenient view of account data with growth metrics and trends';

-- =======================
-- 8. Grant necessary permissions
-- =======================
GRANT EXECUTE ON FUNCTION calculate_and_update_account_growth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_all_account_growth_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION update_account_follower_count_with_growth(UUID, INTEGER) TO authenticated;
GRANT SELECT ON account_growth_summary TO authenticated;

GRANT EXECUTE ON FUNCTION calculate_and_update_account_growth(UUID) TO anon;
GRANT EXECUTE ON FUNCTION update_all_account_growth_metrics() TO anon;
GRANT EXECUTE ON FUNCTION update_account_follower_count_with_growth(UUID, INTEGER) TO anon;
GRANT SELECT ON account_growth_summary TO anon;

-- =======================
-- 9. Create trigger to auto-update growth metrics when follower count changes
-- =======================
CREATE OR REPLACE FUNCTION trigger_update_growth_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update growth if follower_count actually changed
  IF OLD.follower_count IS DISTINCT FROM NEW.follower_count THEN
    -- Schedule growth calculation (async to avoid slowing down the update)
    PERFORM calculate_and_update_account_growth(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_account_growth_update ON public.accounts;
CREATE TRIGGER trigger_account_growth_update
  AFTER UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_growth_metrics();