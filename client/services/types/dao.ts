// Simple Account interface matching the database schema
export interface Account {
  id: string;
  name: string;
  slug: string;
  twitter_handle?: string;
  description?: string;
  website_url?: string;
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

// Backward compatibility - keep the old DAO types
export interface DAO extends Account {}
export interface CreateDAOInput extends CreateAccountInput {} 