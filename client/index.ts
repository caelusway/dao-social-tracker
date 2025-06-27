import dotenv from 'dotenv';
import { BioDAOSyncManager } from './services/sync/biodaoSyncManager';
import { ENV_CONFIG } from './config/environment';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🚀 Starting BioDAO Social Tracker...');
  
  try {
    // Validate environment variables
    if (!ENV_CONFIG.isValid()) {
      const missing = ENV_CONFIG.getMissingVars();
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.log('📝 Please create a .env file with the following variables:');
      console.log('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
      console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
      console.log('   TWITTER_BEARER_TOKEN=your_twitter_bearer_token');
      process.exit(1);
    }

    // Initialize BioDAO sync manager
    const syncManager = new BioDAOSyncManager();
    
    // Display system status
    const status = await syncManager.getSystemStatus();
    console.log('📊 System Status:');
    console.log(`   • BioDAOs: ${status.total_biodaos}`);
    console.log(`   • Twitter: ${status.platforms.twitter ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   • Discord: ${status.platforms.discord ? '✅ Enabled' : '❌ Disabled (coming soon)'}`);
    
    if (status.total_biodaos === 0) {
      console.log('');
      console.log('🎯 Quick Start: Add your first BioDAO');
      console.log('   Example: VitaDAO with Twitter @VitaDAO');
      console.log('');
      console.log('   You can add BioDAOs by running the migration SQL or using the API');
    } else {
      console.log('');
      console.log('📋 Configured BioDAOs:');
      status.biodaos.forEach((dao: any) => {
        console.log(`   • ${dao.name} (${dao.platforms.join(', ')})`);
      });
    }

    // Start periodic sync
    syncManager.startPeriodicSync();
    
    console.log('');
    console.log('✅ BioDAO Social Tracker started successfully!');
    console.log('📊 Service will sync social data every 15 minutes');
    console.log('🔄 Initial sync starting now...');
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down BioDAO Social Tracker...');
      syncManager.stopPeriodicSync();
      console.log('✅ Service stopped gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down...');
      syncManager.stopPeriodicSync();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start BioDAO Social Tracker:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 