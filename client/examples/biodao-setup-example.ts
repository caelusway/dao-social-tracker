import dotenv from 'dotenv';
import { BioDAOSyncManager } from '../services/sync/biodaoSyncManager';
import { BioDAOService } from '../services/biodao/biodaoService';

// Load environment variables
dotenv.config();

async function setupExampleBioDAOs() {
  const syncManager = new BioDAOSyncManager();
  const biodaoService = new BioDAOService();

  try {
    console.log('🚀 Setting up example BioDAOs...');

    // Example 1: VitaDAO
    await syncManager.addBioDAO(
      'VitaDAO',
      'vitadao',
      'Decentralized collective funding longevity research',
      [
        { platform: 'twitter', account_identifier: 'VitaDAO' },
        // Add more platforms as needed
        // { platform: 'discord', account_identifier: 'server_id_here' }
      ]
    );

    // Example 2: HairDAO
    await syncManager.addBioDAO(
      'HairDAO',
      'hairdao',
      'Decentralized collective focused on hair loss research',
      [
        { platform: 'twitter', account_identifier: 'HairDAO_' }
      ]
    );

    // Example 3: CryoDAO
    await syncManager.addBioDAO(
      'CryoDAO',
      'cryodao',
      'Advancing cryonics and life extension research',
      [
        { platform: 'twitter', account_identifier: 'cryodao' }
      ]
    );

    console.log('✅ Example BioDAOs set up successfully!');

    // Show system status
    const status = await syncManager.getSystemStatus();
    console.log('\n📊 System Status:');
    console.log(JSON.stringify(status, null, 2));

  } catch (error) {
    console.error('❌ Error setting up BioDAOs:', error);
  }
}

async function demonstrateDataRetrieval() {
  const biodaoService = new BioDAOService();

  try {
    console.log('\n🔍 Demonstrating data retrieval...');

    // Get all BioDAOs
    const bioDAOs = await biodaoService.getAllBioDAOs();
    console.log(`Found ${bioDAOs.length} BioDAOs`);

    for (const bioDAO of bioDAOs) {
      console.log(`\n📊 ${bioDAO.name} (${bioDAO.slug}):`);
      
      // Get social accounts
      const accounts = await biodaoService.getSocialAccounts(bioDAO.id);
      console.log(`  Social accounts: ${accounts.length}`);
      accounts.forEach(acc => {
        console.log(`    • ${acc.platform}: ${acc.account_identifier}`);
      });

      // Get recent social data
      const socialData = await biodaoService.getSocialData({
        dao_slug: bioDAO.slug,
        limit: 5
      });
      console.log(`  Recent posts: ${socialData.length}`);
      
      if (socialData.length > 0) {
        const latestPost = socialData[0];
        console.log(`    Latest: ${latestPost?.platform} - ${latestPost?.content?.substring(0, 100)}...`);
        console.log(`    Engagement: ${JSON.stringify(latestPost?.engagement_metrics)}`);
      }

      // Get engagement metrics
      const metrics = await biodaoService.getEngagementMetrics(bioDAO.slug);
      console.log(`  30-day metrics: ${metrics.total_posts} posts, ${metrics.total_likes} likes`);
    }

  } catch (error) {
    console.error('❌ Error retrieving data:', error);
  }
}

async function main() {
  console.log('🧪 BioDAO System Demo');
  console.log('====================');

  // Setup example BioDAOs (run this once)
  await setupExampleBioDAOs();

  // Demonstrate data retrieval
  await demonstrateDataRetrieval();

  console.log('\n✅ Demo completed!');
  console.log('💡 You can now run the main application with: npm run dev');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { setupExampleBioDAOs, demonstrateDataRetrieval }; 