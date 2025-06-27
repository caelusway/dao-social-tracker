export const TWITTER_CONFIG = {
  FETCH_INTERVAL: 15 * 60 * 1000, // 15 minutes in milliseconds
  MAX_TWEETS_PER_REQUEST: 100,
  API_VERSION: '2',
  BASE_URL: 'https://api.twitter.com/2',
};

// Twitter API rate limits for free tier
export const RATE_LIMITS = {
  TWEETS_PER_15_MIN: 180,  // Standard v2 API limit
  USER_LOOKUP_PER_15_MIN: 300,
  DELAY_BETWEEN_REQUESTS: 1000, // 1 second delay between requests
};

export const ENDPOINTS = {
  USER_BY_USERNAME: (username: string) => `/users/by/username/${username}`,
  USER_TWEETS: (userId: string) => `/users/${userId}/tweets`,
}; 