// Simple DAO interface matching the database schema
export interface DAO {
  id: string;
  name: string;
  slug: string;
  twitter_handle?: string;
  description?: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
}

// For creating new DAOs
export interface CreateDAOInput {
  name: string;
  slug: string;
  twitter_handle?: string;
  description?: string;
  website_url?: string;
} 