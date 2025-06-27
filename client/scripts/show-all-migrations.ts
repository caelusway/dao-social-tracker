import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function showAllMigrations() {
  try {
    console.log('📋 ALL SUPABASE MIGRATIONS TO RUN:');
    console.log('=====================================\n');

    // Read all migration files
    const migration1Path = join(__dirname, '../../supabase/migrations/20240103000001_create_daos_table.sql');
    const migration2Path = join(__dirname, '../../supabase/migrations/20240103000002_create_dao_twitter_tables.sql');

    console.log('🗂️  MIGRATION 1: Create DAOs Table');
    console.log('----------------------------------');
    try {
      const migration1SQL = readFileSync(migration1Path, 'utf8');
      console.log(migration1SQL);
    } catch (error) {
      console.log('❌ Could not read migration 1');
    }

    console.log('\n🗂️  MIGRATION 2: Create DAO Twitter Tables & Functions');
    console.log('----------------------------------------------------');
    try {
      const migration2SQL = readFileSync(migration2Path, 'utf8');
      console.log(migration2SQL);
    } catch (error) {
      console.log('❌ Could not read migration 2');
    }

    console.log('\n📋 INSTRUCTIONS:');
    console.log('================');
    console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to "SQL Editor" in the left sidebar');
    console.log('4. Click "New query"');
    console.log('5. Copy and paste BOTH migrations above (in order)');
    console.log('6. Click "Run" to execute');
    console.log('7. You should see "Success" messages if everything works');
    console.log('\n💡 After running migrations, you can import your Twitter data with:');
    console.log('   npm run import:twitter');

  } catch (error) {
    console.error('❌ Error showing migrations:', error);
  }
}

// Run the script
const isMainModule = process.argv[1] && process.argv[1].includes('show-all-migrations.ts');
if (isMainModule) {
  showAllMigrations().catch(console.error);
}

export { showAllMigrations }; 