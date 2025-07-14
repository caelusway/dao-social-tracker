-- Migration: Update functions and triggers for account tables
-- This script updates all functions and triggers to work with the new account table naming

-- =======================
-- 1. Drop old DAO functions and triggers
-- =======================
DROP TRIGGER IF EXISTS create_dao_twitter_table_trigger ON daos;
DROP TRIGGER IF EXISTS create_dao_twitter_table_trigger ON accounts;
DROP FUNCTION IF EXISTS trigger_create_dao_twitter_table();
DROP FUNCTION IF EXISTS create_dao_twitter_table(TEXT);
DROP FUNCTION IF EXISTS get_dao_twitter_table_name(TEXT);

-- =======================
-- 2. Create new account-based functions
-- =======================

-- Create function to generate table name from account slug
CREATE OR REPLACE FUNCTION get_account_twitter_table_name(account_slug TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'account_' || account_slug || '_tweets';
END;
$$ LANGUAGE plpgsql;

-- Create function to create a new Account Twitter table
CREATE OR REPLACE FUNCTION create_account_twitter_table(account_slug TEXT)
RETURNS VOID AS $$
DECLARE
  table_name TEXT;
BEGIN
  table_name := get_account_twitter_table_name(account_slug);
  
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT ''tweet'',
      url TEXT,
      twitter_url TEXT,
      text TEXT,
      source TEXT,
      retweet_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      quote_count INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      bookmark_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE,
      lang TEXT,
      is_reply BOOLEAN DEFAULT FALSE,
      in_reply_to_id TEXT,
      conversation_id TEXT,
      in_reply_to_user_id TEXT,
      in_reply_to_username TEXT,
      author_username TEXT,
      author_name TEXT,
      author_id TEXT,
      mentions JSONB DEFAULT ''[]'',
      hashtags JSONB DEFAULT ''[]'',
      urls JSONB DEFAULT ''[]'',
      media JSONB DEFAULT ''[]'',
      raw_data JSONB,
      synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )', table_name);
  
  -- Create indexes for better performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (created_at DESC)', 
    table_name || '_created_at_idx', table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (like_count DESC)', 
    table_name || '_like_count_idx', table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (retweet_count DESC)', 
    table_name || '_retweet_count_idx', table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (view_count DESC)', 
    table_name || '_view_count_idx', table_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (conversation_id)', 
    table_name || '_conversation_id_idx', table_name);
    
  RAISE NOTICE 'Created Twitter table for account: %', account_slug;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to automatically create Twitter table when new account is inserted
CREATE OR REPLACE FUNCTION trigger_create_account_twitter_table()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_account_twitter_table(NEW.slug);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on accounts table
CREATE TRIGGER create_account_twitter_table_trigger
  AFTER INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_account_twitter_table();

-- =======================
-- 3. Add comments for documentation
-- =======================
COMMENT ON FUNCTION get_account_twitter_table_name(TEXT) IS 'Generates account Twitter table name from account slug';
COMMENT ON FUNCTION create_account_twitter_table(TEXT) IS 'Creates a new Twitter table for an account with proper indexes';
COMMENT ON FUNCTION trigger_create_account_twitter_table() IS 'Trigger function to auto-create Twitter table when new account is added';

-- =======================
-- 4. Verify the migration completed successfully
-- =======================
-- You can run these queries to verify the migration worked:
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%account%';
-- SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public' AND trigger_name LIKE '%account%'; 