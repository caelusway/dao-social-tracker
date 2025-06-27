-- Create dao_sync_logs table for storing detailed sync logs
CREATE TABLE IF NOT EXISTS dao_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  level INTEGER NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  error TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dao_sync_stats JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS dao_sync_logs_service_idx ON dao_sync_logs (service);
CREATE INDEX IF NOT EXISTS dao_sync_logs_timestamp_idx ON dao_sync_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS dao_sync_logs_level_idx ON dao_sync_logs (level);
CREATE INDEX IF NOT EXISTS dao_sync_logs_service_timestamp_idx ON dao_sync_logs (service, timestamp DESC);

-- Create dao_sync_stats table for storing aggregated sync statistics
CREATE TABLE IF NOT EXISTS dao_sync_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  total_tweets_processed INTEGER DEFAULT 0,
  tweets_updated INTEGER DEFAULT 0,
  tweets_added INTEGER DEFAULT 0,
  api_requests_used INTEGER DEFAULT 0,
  sync_duration_ms INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for dao_sync_stats
CREATE INDEX IF NOT EXISTS dao_sync_stats_service_idx ON dao_sync_stats (service);
CREATE INDEX IF NOT EXISTS dao_sync_stats_timestamp_idx ON dao_sync_stats (timestamp DESC);
CREATE INDEX IF NOT EXISTS dao_sync_stats_service_timestamp_idx ON dao_sync_stats (service, timestamp DESC);

-- Add RLS policies for dao_sync_logs
ALTER TABLE dao_sync_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to sync logs (adjust as needed for your auth setup)
CREATE POLICY "Allow read access to sync logs" ON dao_sync_logs
  FOR SELECT USING (true);

-- Allow insert access to sync logs
CREATE POLICY "Allow insert access to sync logs" ON dao_sync_logs
  FOR INSERT WITH CHECK (true);

-- Add RLS policies for dao_sync_stats
ALTER TABLE dao_sync_stats ENABLE ROW LEVEL SECURITY;

-- Allow read access to sync stats
CREATE POLICY "Allow read access to sync stats" ON dao_sync_stats
  FOR SELECT USING (true);

-- Allow insert access to sync stats
CREATE POLICY "Allow insert access to sync stats" ON dao_sync_stats
  FOR INSERT WITH CHECK (true);

-- Create function to clean up old logs
CREATE OR REPLACE FUNCTION cleanup_old_dao_sync_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM dao_sync_logs 
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get sync statistics summary
CREATE OR REPLACE FUNCTION get_dao_sync_stats_summary(service_name TEXT, days_back INTEGER DEFAULT 7)
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
  FROM dao_sync_stats ss
  WHERE ss.service = service_name
    AND ss.timestamp >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql; 