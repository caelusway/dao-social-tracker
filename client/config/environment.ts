import dotenv from 'dotenv';

// Load environment variables (only in development)
// In production (Railway), environment variables are already available
if (process.env.NODE_ENV !== 'production') {
  try {
    // Try to load .env file for development
    dotenv.config();
  } catch (error) {
    // Ignore if .env file doesn't exist
    console.warn('No .env file found, using system environment variables');
  }
}

// Debug environment variables in production
if (process.env.NODE_ENV === 'production') {
  console.log('🔍 Environment Debug:');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('SUPABASE_URL present:', !!process.env.SUPABASE_URL);
  console.log('NEXT_PUBLIC_SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SUPABASE_ANON_KEY present:', !!process.env.SUPABASE_ANON_KEY);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY present:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log('TWITTER_BEARER_TOKEN present:', !!process.env.TWITTER_BEARER_TOKEN);
}

// Environment configuration for the DAO social tracker
export const ENV_CONFIG = {
  // Supabase Configuration - Support both Next.js and standard naming
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Twitter API Configuration
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN || '',
  
  // Validation
  isValid: function() {
    return !!(this.SUPABASE_URL && this.SUPABASE_ANON_KEY);
  },
  
  // Get missing variables
  getMissingVars: function(): string[] {
    const missing: string[] = [];
    if (!this.SUPABASE_URL) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
    if (!this.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return missing;
  }
}; 