export interface TwitterPost {
  id: string;
  text: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  author_id: string;
}

export interface AccountTwitterAccount {
  id: string;
  username: string;
  account_id: string;
}

export interface TwitterSyncStatus {
  account_id: string;
  last_tweet_id: string | null;
  last_sync_time: string;
}

// Keep the old interface for backwards compatibility
export interface DAOTwitterAccount extends AccountTwitterAccount {
  dao_id: string;
} 