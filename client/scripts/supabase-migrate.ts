import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables FIRST
dotenv.config();

// Debug: Check if environment variables are loaded
console.log('🔍 Environment check:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runSupabaseMigration() {
  try {
    console.log('🚀 Starting Supabase migration...');

    // Read the migration file
    const migrationPath = join(__dirname, '../../supabase/migrations/20240103000001_create_daos_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    
    // Since Supabase doesn't allow DDL operations through the client API,
    // we need to run this manually in the dashboard
    console.log('\n📋 MANUAL MIGRATION REQUIRED:');
    console.log('Supabase requires DDL operations to be run manually in the dashboard.');
    console.log('\n🔧 Steps to migrate:');
    console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to "SQL Editor" in the left sidebar');
    console.log('4. Click "New query"');
    console.log('5. Copy and paste the SQL below:');
    console.log('\n----------------------------------------');
    console.log('📝 SQL TO EXECUTE:');
    console.log('----------------------------------------');
    console.log(migrationSQL);
    console.log('----------------------------------------');
    console.log('\n6. Click "Run" to execute the SQL');
    console.log('7. You should see "Success. No rows returned" if it works correctly');
    
    // Test if the table already exists
    console.log('\n🔍 Testing if table already exists...');
    
    try {
      // Import supabase client AFTER environment variables are loaded
      const { supabase } = await import('../services/supabase/client');
      
      const { data: daos, error: fetchError } = await supabase
        .from('daos')
        .select('*')
        .limit(1);

      if (fetchError) {
        if (fetchError.message.includes('does not exist')) {
          console.log('❌ Table "daos" does not exist yet');
          console.log('💡 Please run the SQL above in Supabase Dashboard');
        } else {
          console.log('❌ Error checking table:', fetchError.message);
        }
      } else {
        console.log('✅ Table "daos" exists!');
        console.log(`📊 Found ${daos?.length || 0} DAOs in the database`);
        if (daos && daos.length > 0) {
          console.log('Sample DAOs:');
          daos.forEach(dao => {
            console.log(`  • ${dao.name} (${dao.slug}) - @${dao.twitter_handle || 'N/A'}`);
          });
        } else {
          console.log('💡 Table is empty. You can run "npm run test:dao" to test CRUD operations.');
        }
      }
    } catch (clientError) {
      console.log('❌ Error connecting to Supabase:', clientError);
    }

  } catch (error) {
    console.error('❌ Migration script failed:', error);
    console.log('\n💡 Manual migration required:');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the CREATE TABLE statement manually');
  }
}

// Run the migration
const isMainModule = process.argv[1] && process.argv[1].includes('supabase-migrate.ts');
if (isMainModule) {
  console.log('📋 Executing Supabase migration script...');
  runSupabaseMigration().catch(console.error);
}

export { runSupabaseMigration }; 