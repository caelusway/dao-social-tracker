import { createClient } from '@supabase/supabase-js';
import { ENV_CONFIG } from '../../config/environment';

// Validate environment variables
if (!ENV_CONFIG.isValid()) {
  const missing = ENV_CONFIG.getMissingVars();
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

// Create Supabase client
export const supabase = createClient(
  ENV_CONFIG.SUPABASE_URL,
  ENV_CONFIG.SUPABASE_ANON_KEY
);

// For server-side operations (if needed)
export const supabaseAdmin = ENV_CONFIG.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      ENV_CONFIG.SUPABASE_URL,
      ENV_CONFIG.SUPABASE_SERVICE_ROLE_KEY
    )
  : null; 