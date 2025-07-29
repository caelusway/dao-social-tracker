-- Migration: Remove growth columns from accounts table
-- This cleans up the accounts table since we now have a dedicated growth metrics table

-- =======================
-- 1. Drop growth-related indexes first
-- =======================
DROP INDEX IF EXISTS accounts_weekly_growth_idx;
DROP INDEX IF EXISTS accounts_monthly_growth_idx;
DROP INDEX IF EXISTS accounts_yearly_growth_idx;
DROP INDEX IF EXISTS accounts_growth_calculated_idx;

-- =======================
-- 2. Drop the trigger that was updating growth columns
-- =======================
DROP TRIGGER IF EXISTS trigger_account_growth_update ON public.accounts;
DROP FUNCTION IF EXISTS trigger_update_growth_metrics();

-- =======================
-- 3. Drop growth-related functions that used accounts table columns
-- =======================
DROP FUNCTION IF EXISTS calculate_and_update_account_growth(UUID);
DROP FUNCTION IF EXISTS update_all_account_growth_metrics();
DROP FUNCTION IF EXISTS update_account_follower_count_with_growth(UUID, INTEGER);

-- =======================
-- 4. Drop the old view that referenced accounts table growth columns
-- =======================
DROP VIEW IF EXISTS account_growth_summary;

-- =======================
-- 5. Remove growth columns from accounts table
-- =======================
ALTER TABLE public.accounts 
DROP COLUMN IF EXISTS weekly_growth,
DROP COLUMN IF EXISTS weekly_growth_percentage,
DROP COLUMN IF EXISTS monthly_growth,
DROP COLUMN IF EXISTS monthly_growth_percentage,
DROP COLUMN IF EXISTS yearly_growth,
DROP COLUMN IF EXISTS yearly_growth_percentage,
DROP COLUMN IF EXISTS growth_calculated_at;

-- =======================
-- 6. Verify the cleanup was successful
-- =======================
-- Check that no growth columns remain in accounts table
-- This will help confirm the migration worked
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name LIKE '%growth%';
      
    IF col_count > 0 THEN
        RAISE EXCEPTION 'Growth columns still exist in accounts table after cleanup';
    ELSE
        RAISE NOTICE 'Successfully removed all growth columns from accounts table';
    END IF;
END
$$;

-- =======================
-- 7. Add comment about the change
-- =======================
COMMENT ON TABLE public.accounts IS 'Account information - growth metrics moved to account_growth_metrics table';