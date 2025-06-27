// Simple debug script to check environment variables
console.log('🔍 Environment Variables Debug:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('');
console.log('Supabase Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Present' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Present' : '❌ Missing');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing');
console.log('');
console.log('Twitter Variables:');
console.log('TWITTER_BEARER_TOKEN:', process.env.TWITTER_BEARER_TOKEN ? '✅ Present' : '❌ Missing');
console.log('');
console.log('All environment variables starting with SUPABASE or TWITTER:');
Object.keys(process.env)
  .filter(key => key.includes('SUPABASE') || key.includes('TWITTER'))
  .forEach(key => {
    console.log(`${key}: ${process.env[key] ? '✅ Present' : '❌ Missing'}`);
  }); 