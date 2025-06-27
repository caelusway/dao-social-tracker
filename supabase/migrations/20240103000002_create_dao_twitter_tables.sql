-- Create function to generate table name from DAO slug
CREATE OR REPLACE FUNCTION get_dao_twitter_table_name(dao_slug TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN 'dao_' || dao_slug || '_tweets';
END;
$$ LANGUAGE plpgsql;

-- Create function to create a new DAO Twitter table
CREATE OR REPLACE FUNCTION create_dao_twitter_table(dao_slug TEXT)
RETURNS VOID AS $$
DECLARE
  table_name TEXT;
BEGIN
  table_name := get_dao_twitter_table_name(dao_slug);
  
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
    
  RAISE NOTICE 'Created Twitter table for DAO: %', dao_slug;
END;
$$ LANGUAGE plpgsql;

-- Create Twitter tables for existing DAOs
DO $$
DECLARE
  dao_record RECORD;
BEGIN
  FOR dao_record IN SELECT slug FROM daos LOOP
    PERFORM create_dao_twitter_table(dao_record.slug);
  END LOOP;
END;
$$;

-- Create trigger function to automatically create Twitter table when new DAO is inserted
CREATE OR REPLACE FUNCTION trigger_create_dao_twitter_table()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_dao_twitter_table(NEW.slug);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on daos table
CREATE TRIGGER create_dao_twitter_table_trigger
  AFTER INSERT ON daos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_dao_twitter_table(); 