import dotenv from 'dotenv';
import { DAOService } from '../services/dao/daoService';

// Load environment variables
dotenv.config();

async function testDAOService() {
  const daoService = new DAOService();

  try {
    console.log('🚀 Testing DAO Service...');

    // Get all DAOs
    const daos = await daoService.getAllDAOs();
    console.log(`📊 Found ${daos.length} DAOs:`);
    
    daos.forEach(dao => {
      console.log(`  • ${dao.name} (@${dao.twitter_handle}) - ${dao.slug}`);
    });

    // Test getting a specific DAO
    if (daos.length > 0) {
      const firstDAO = daos[0];
      console.log(`\n🔍 Getting DAO by slug: ${firstDAO.slug}`);
      const daoBySlug = await daoService.getDAOBySlug(firstDAO.slug);
      console.log(`  Found: ${daoBySlug?.name}`);

      // Test creating a table for this DAO (placeholder for now)
      console.log(`\n📝 Creating table for ${firstDAO.slug}:`);
      await daoService.createDAOTable(firstDAO.slug);
    }

    // Test creating a new DAO
    console.log('\n➕ Creating a new test DAO...');
    try {
      const newDAO = await daoService.createDAO({
        name: 'TestDAO',
        slug: 'testdao',
        twitter_handle: 'testdao',
        description: 'A test DAO for demonstration'
      });
      console.log(`✅ Created: ${newDAO.name} with ID: ${newDAO.id}`);

      // Clean up - delete the test DAO
      console.log('🗑️  Cleaning up test DAO...');
      await daoService.deleteDAO(newDAO.id);
      console.log('✅ Test DAO deleted');
    } catch (error: any) {
      if (error.code === '23505') {
        console.log('⚠️  Test DAO already exists (this is fine)');
      } else {
        throw error;
      }
    }

    console.log('\n✅ DAO Service test completed!');

  } catch (error) {
    console.error('❌ Error testing DAO service:', error);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testDAOService().catch(console.error);
}

export { testDAOService }; 