// Core BioDAO types
export interface BioDAO {
  id: string;
  name: string;
  slug: string;
  description?: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
}

// Social platform account configuration
export interface BioDAOSocialAccount {
  id: string;
  biodao_id: string;
  platform: SocialPlatform;
  account_identifier: string; // username, server_id, etc.
  account_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Social platforms enum
export type SocialPlatform = 'twitter' | 'discord' | 'telegram' | 'reddit' | 'youtube' | 'linkedin';

// Sync status tracking
export interface BioDAOSyncStatus {
  id: string;
  biodao_id: string;
  platform: SocialPlatform;
  last_sync_time?: string;
  last_sync_data: Record<string, any>;
  sync_errors: any[];
  is_syncing: boolean;
  created_at: string;
  updated_at: string;
}

// Social data entry (stored in individual DAO tables)
export interface BioDAOSocialData {
  id: string;
  platform: SocialPlatform;
  post_id: string;
  post_type: 'post' | 'comment' | 'reaction' | 'share' | 'mention';
  content?: string;
  author_info: {
    username?: string;
    display_name?: string;
    user_id?: string;
    avatar_url?: string;
    follower_count?: number;
    verified?: boolean;
  };
  engagement_metrics: {
    likes?: number;
    shares?: number;
    comments?: number;
    reactions?: Record<string, number>;
    views?: number;
    clicks?: number;
  };
  platform_data: Record<string, any>; // Platform-specific additional data
  posted_at?: string;
  synced_at: string;
  created_at: string;
}

// Twitter-specific types (extending the base types)
export interface TwitterPostData extends Omit<BioDAOSocialData, 'platform' | 'engagement_metrics'> {
  platform: 'twitter';
  engagement_metrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    views?: number;
  };
  platform_data: {
    tweet_type?: 'original' | 'retweet' | 'reply' | 'quote';
    in_reply_to_tweet_id?: string;
    quoted_tweet_id?: string;
    hashtags?: string[];
    mentions?: string[];
    urls?: string[];
    media?: Array<{
      type: 'photo' | 'video' | 'gif';
      url: string;
    }>;
  };
}

// Discord-specific types
export interface DiscordMessageData extends Omit<BioDAOSocialData, 'platform' | 'engagement_metrics'> {
  platform: 'discord';
  engagement_metrics: {
    reactions?: Record<string, number>;
    replies?: number;
  };
  platform_data: {
    server_id: string;
    channel_id: string;
    channel_name: string;
    message_type?: 'default' | 'reply' | 'thread_starter';
    attachments?: Array<{
      filename: string;
      url: string;
      content_type: string;
    }>;
    embeds?: any[];
  };
}

// Helper types for API responses
export interface BioDAOWithAccounts extends BioDAO {
  social_accounts: BioDAOSocialAccount[];
}

export interface SocialDataQuery {
  dao_slug: string;
  platform?: SocialPlatform;
  post_type?: string;
  limit?: number;
  offset?: number;
  date_from?: string;
  date_to?: string;
} 