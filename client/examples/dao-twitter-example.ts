import dotenv from 'dotenv';
import { DAOService } from '../services/dao/daoService';
import { DAOTwitterService, TwitterPost } from '../services/dao/daoTwitterService';

// Load environment variables
dotenv.config();

// Define the engagement metrics type
type EngagementMetrics = {
  date: string;
  tweet_count: number;
  total_likes: number;
  total_retweets: number;
  total_views: number;
};

async function testDAOTwitterService() {
  const daoService = new DAOService();
  const twitterService = new DAOTwitterService();

  try {
    console.log('🚀 Testing DAO Twitter Service...');

    // Get all DAOs
    const daos = await daoService.getAllDAOs();
    console.log(`\n📊 Found ${daos.length} DAOs:`);
    
    for (const dao of daos) {
      console.log(`\n🏛️  DAO: ${dao.name} (${dao.slug})`);
      
      try {
        // Test creating a Twitter table for this DAO
        await twitterService.createAccountTwitterTable(dao.slug);
        
        // Get recent tweets
        console.log(`\n📋 Recent tweets:`);
        const recentTweets = await twitterService.getTwitterPosts(dao.slug, {
          limit: 5,
          orderBy: 'like_count',
          orderDirection: 'desc'
        });
        
        recentTweets.forEach((tweet: TwitterPost, index: number) => {
          console.log(`   ${index + 1}. [${tweet.like_count}❤️ ${tweet.retweet_count}🔄] "${tweet.text?.substring(0, 80)}..."`);
        });
        
        // Get engagement metrics for last 30 days
        console.log(`\n📊 Engagement metrics (last 30 days):`);
        const metrics = await twitterService.getEngagementMetrics(dao.slug, 30);
        
        if (metrics.length > 0) {
          const totalTweets = metrics.reduce((sum: number, day: EngagementMetrics) => sum + day.tweet_count, 0);
          const totalLikes = metrics.reduce((sum: number, day: EngagementMetrics) => sum + day.total_likes, 0);
          const totalRetweets = metrics.reduce((sum: number, day: EngagementMetrics) => sum + day.total_retweets, 0);
          
          console.log(`   • Total tweets in 30 days: ${totalTweets}`);
          console.log(`   • Total likes in 30 days: ${totalLikes.toLocaleString()}`);
          console.log(`   • Total retweets in 30 days: ${totalRetweets.toLocaleString()}`);
          console.log(`   • Avg tweets per day: ${Math.round(totalTweets / 30)}`);
          
          // Show most active day
          const mostActiveDay = metrics.reduce((max: EngagementMetrics, day: EngagementMetrics) => 
            day.tweet_count > max.tweet_count ? day : max
          );
          console.log(`   • Most active day: ${mostActiveDay.date} (${mostActiveDay.tweet_count} tweets)`);
        }
        
        // Test search functionality
        console.log(`\n🔍 Searching for tweets with "research":`);
        const searchResults = await twitterService.searchTwitterPosts(dao.slug, 'research', { limit: 3 });
        searchResults.forEach((tweet: TwitterPost, index: number) => {
          console.log(`   ${index + 1}. "${tweet.text?.substring(0, 80)}..."`);
        });
        
      } catch (error: any) {
        console.error(`   ❌ Error processing DAO ${dao.slug}:`, error.message);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error in DAO Twitter Service test:', error.message);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDAOTwitterService().catch(console.error);
}

export default testDAOTwitterService; 