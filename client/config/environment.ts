import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

// Environment configuration for the DAO social tracker
export const ENV_CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
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
    if (!this.SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!this.SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return missing;
  }
}; 