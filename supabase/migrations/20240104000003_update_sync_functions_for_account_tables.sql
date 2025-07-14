-- Migration: Update sync logging functions for account tables
-- This script updates the sync logging functions to work with the new account table naming

-- =======================
-- 1. Drop old DAO sync functions
-- =======================
DROP FUNCTION IF EXISTS cleanup_old_dao_sync_logs(INTEGER);
DROP FUNCTION IF EXISTS get_dao_sync_stats_summary(TEXT, INTEGER);

-- =======================
-- 2. Create new account-based sync functions
-- =======================

-- Create function to clean up old logs
CREATE OR REPLACE FUNCTION cleanup_old_account_sync_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM account_sync_logs 
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get sync statistics summary
CREATE OR REPLACE FUNCTION get_account_sync_stats_summary(service_name TEXT, days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  total_syncs BIGINT,
  total_tweets_processed BIGINT,
  total_tweets_updated BIGINT,
  total_tweets_added BIGINT,
  total_api_requests BIGINT,
  average_sync_duration NUMERIC,
  total_errors BIGINT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_syncs,
    COALESCE(SUM(ss.total_tweets_processed), 0)::BIGINT as total_tweets_processed,
    COALESCE(SUM(ss.tweets_updated), 0)::BIGINT as total_tweets_updated,
    COALESCE(SUM(ss.tweets_added), 0)::BIGINT as total_tweets_added,
    COALESCE(SUM(ss.api_requests_used), 0)::BIGINT as total_api_requests,
    COALESCE(AVG(ss.sync_duration_ms), 0)::NUMERIC as average_sync_duration,
    COALESCE(SUM(ss.error_count), 0)::BIGINT as total_errors,
    (NOW() - (days_back || ' days')::INTERVAL)::TIMESTAMP WITH TIME ZONE as period_start,
    NOW()::TIMESTAMP WITH TIME ZONE as period_end
  FROM account_sync_stats ss
  WHERE ss.service = service_name
    AND ss.timestamp >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- =======================
-- 3. Update index names for consistency (if needed)
-- =======================
-- Note: The indexes should have been automatically renamed when the tables were renamed
-- But we can verify with these queries:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'account_sync_logs';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'account_sync_stats';

-- =======================
-- 4. Add comments for documentation
-- =======================
COMMENT ON FUNCTION cleanup_old_account_sync_logs(INTEGER) IS 'Cleans up old sync logs older than specified days';
COMMENT ON FUNCTION get_account_sync_stats_summary(TEXT, INTEGER) IS 'Gets aggregated sync statistics for a service over specified period';

-- =======================
-- 5. Optional: Create convenience views for backwards compatibility
-- =======================
-- If you need temporary backwards compatibility, you can create views:
-- CREATE OR REPLACE VIEW dao_sync_logs AS SELECT * FROM account_sync_logs;
-- CREATE OR REPLACE VIEW dao_sync_stats AS SELECT * FROM account_sync_stats;
-- Note: Remove these views once your application code is updated

-- =======================
-- 6. Verify the migration completed successfully
-- =======================
-- You can run these queries to verify the migration worked:
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%account_sync%';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'account_sync%'; 