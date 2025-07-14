-- Migration: Add follower count tracking to accounts table
-- This script adds follower_count column and creates tracking infrastructure

-- =======================
-- 1. Add follower_count column to accounts table
-- =======================
ALTER TABLE public.accounts 
ADD COLUMN follower_count INTEGER DEFAULT 0,
ADD COLUMN follower_count_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for better performance on follower count queries
CREATE INDEX IF NOT EXISTS accounts_follower_count_idx ON public.accounts(follower_count DESC);
CREATE INDEX IF NOT EXISTS accounts_follower_updated_idx ON public.accounts(follower_count_updated_at DESC);

-- =======================
-- 2. Create follower count history table for tracking changes
-- =======================
CREATE TABLE IF NOT EXISTS public.account_follower_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  follower_count INTEGER NOT NULL DEFAULT 0,
  change_amount INTEGER DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for follower history
CREATE INDEX IF NOT EXISTS account_follower_history_account_id_idx ON public.account_follower_history(account_id);
CREATE INDEX IF NOT EXISTS account_follower_history_recorded_at_idx ON public.account_follower_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS account_follower_history_change_idx ON public.account_follower_history(change_amount DESC);

-- =======================
-- 3. Create function to update follower count with history tracking
-- =======================
CREATE OR REPLACE FUNCTION update_account_follower_count(
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
  
  -- Log the change
  RAISE NOTICE 'Updated follower count for account %: % (change: %)', 
    p_account_id, p_new_follower_count, v_change_amount;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 4. Create function to get follower count trends
-- =======================
CREATE OR REPLACE FUNCTION get_account_follower_trends(
  p_account_id UUID,
  p_days_back INTEGER DEFAULT 30
) RETURNS TABLE (
  recorded_date DATE,
  follower_count INTEGER,
  daily_change INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(afh.recorded_at) as recorded_date,
    afh.follower_count,
    afh.change_amount as daily_change
  FROM public.account_follower_history afh
  WHERE afh.account_id = p_account_id
    AND afh.recorded_at >= NOW() - (p_days_back || ' days')::INTERVAL
  ORDER BY afh.recorded_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 5. Add RLS policies for follower history table
-- =======================
ALTER TABLE public.account_follower_history ENABLE ROW LEVEL SECURITY;

-- Allow read access to follower history
CREATE POLICY "Allow read access to follower history" ON public.account_follower_history
  FOR SELECT USING (true);

-- Allow insert access to follower history
CREATE POLICY "Allow insert access to follower history" ON public.account_follower_history
  FOR INSERT WITH CHECK (true);

-- =======================
-- 6. Add comments for documentation
-- =======================
COMMENT ON COLUMN public.accounts.follower_count IS 'Current Twitter follower count';
COMMENT ON COLUMN public.accounts.follower_count_updated_at IS 'Last time follower count was updated';
COMMENT ON TABLE public.account_follower_history IS 'Historical tracking of follower count changes';
COMMENT ON FUNCTION update_account_follower_count(UUID, INTEGER) IS 'Updates follower count and records history';
COMMENT ON FUNCTION get_account_follower_trends(UUID, INTEGER) IS 'Gets follower count trends for an account';

-- =======================
-- 7. Create a cleanup function for old follower history
-- =======================
CREATE OR REPLACE FUNCTION cleanup_old_follower_history(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.account_follower_history 
  WHERE recorded_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql; 