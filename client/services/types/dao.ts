// Simple Account interface matching the database schema
export interface Account {
  id: string;
  name: string;
  slug: string;
  twitter_handle?: string;
  description?: string;
  website_url?: string;
  follower_count?: number;
  follower_count_updated_at?: string;
  created_at: string;
  updated_at: string;
}

// For creating new Accounts
export interface CreateAccountInput {
  name: string;
  slug: string;
  twitter_handle?: string;
  description?: string;
  website_url?: string;
}

// For updating follower counts
export interface UpdateFollowerCountInput {
  account_id: string;
  follower_count: number;
}

// Follower history record
export interface FollowerHistory {
  id: string;
  account_id: string;
  follower_count: number;
  change_amount: number;
  recorded_at: string;
  created_at: string;
}

// Follower trend data
export interface FollowerTrend {
  recorded_date: string;
  follower_count: number;
  daily_change: number;
}

// Backward compatibility - keep the old DAO types
export interface DAO extends Account {}
export interface CreateDAOInput extends CreateAccountInput {} 