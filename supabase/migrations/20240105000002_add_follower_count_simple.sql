-- Add follower_count column to accounts table
ALTER TABLE accounts 
ADD COLUMN follower_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN accounts.follower_count IS 'Current follower count from Twitter/social media';

-- Create index for better query performance
CREATE INDEX idx_accounts_follower_count ON accounts(follower_count); 