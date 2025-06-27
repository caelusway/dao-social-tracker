import dotenv from 'dotenv';
import { DAOService } from '../services/dao/daoService';
import { DAOTwitterService } from '../services/dao/daoTwitterService';

// Load environment variables
dotenv.config();

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
        // Get Twitter analytics for this DAO
        const analytics = await twitterService.getTwitterAnalytics(dao.slug);
        
        console.log(`📈 Twitter Analytics:`);
        console.log(`  • Total tweets: ${analytics.total_tweets}`);
        console.log(`  • Total likes: ${analytics.total_likes.toLocaleString()}`);
        console.log(`  • Total retweets: ${analytics.total_retweets.toLocaleString()}`);
        console.log(`  • Total views: ${analytics.total_views.toLocaleString()}`);
        console.log(`  • Avg likes per tweet: ${analytics.avg_likes_per_tweet}`);
        console.log(`  • Avg retweets per tweet: ${analytics.avg_retweets_per_tweet}`);
        console.log(`  • Avg views per tweet: ${analytics.avg_views_per_tweet}`);
        
        if (analytics.most_liked_tweet) {
          console.log(`\n🔥 Most liked tweet (${analytics.most_liked_tweet.like_count} likes):`);
          console.log(`   "${analytics.most_liked_tweet.text?.substring(0, 100)}..."`);
        }
        
        if (analytics.most_retweeted_tweet) {
          console.log(`\n🔄 Most retweeted tweet (${analytics.most_retweeted_tweet.retweet_count} retweets):`);
          console.log(`   "${analytics.most_retweeted_tweet.text?.substring(0, 100)}..."`);
        }
        
        // Get recent tweets
        console.log(`\n📝 Recent tweets (last 5):`);
        const recentTweets = await twitterService.getTwitterPosts(dao.slug, { 
          limit: 5, 
          orderBy: 'created_at',
          orderDirection: 'desc'
        });
        
        recentTweets.forEach((tweet, index) => {
          console.log(`   ${index + 1}. [${tweet.like_count}❤️ ${tweet.retweet_count}🔄] "${tweet.text?.substring(0, 80)}..."`);
        });
        
        // Get engagement metrics for last 30 days
        console.log(`\n📊 Engagement metrics (last 30 days):`);
        const metrics = await twitterService.getEngagementMetrics(dao.slug, 30);
        
        if (metrics.length > 0) {
          const totalTweets = metrics.reduce((sum, day) => sum + day.tweet_count, 0);
          const totalLikes = metrics.reduce((sum, day) => sum + day.total_likes, 0);
          const totalRetweets = metrics.reduce((sum, day) => sum + day.total_retweets, 0);
          
          console.log(`   • Total tweets in 30 days: ${totalTweets}`);
          console.log(`   • Total likes in 30 days: ${totalLikes.toLocaleString()}`);
          console.log(`   • Total retweets in 30 days: ${totalRetweets.toLocaleString()}`);
          console.log(`   • Avg tweets per day: ${Math.round(totalTweets / 30)}`);
          
          // Show most active day
          const mostActiveDay = metrics.reduce((max, day) => 
            day.tweet_count > max.tweet_count ? day : max
          );
          console.log(`   • Most active day: ${mostActiveDay.date} (${mostActiveDay.tweet_count} tweets)`);
        }
        
        // Test search functionality
        console.log(`\n🔍 Searching for tweets with "research":`);
        const searchResults = await twitterService.searchTwitterPosts(dao.slug, 'research', { limit: 3 });
        searchResults.forEach((tweet, index) => {
          console.log(`   ${index + 1}. "${tweet.text?.substring(0, 80)}..."`);
        });
        
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log(`   ⚠️  No Twitter table exists for ${dao.slug}`);
          console.log(`   💡 Run "npm run import:twitter" to create tables and import data`);
        } else {
          console.log(`   ❌ Error fetching Twitter data: ${error.message}`);
        }
      }
    }

    console.log('\n✅ DAO Twitter Service test completed!');

  } catch (error) {
    console.error('❌ Error testing DAO Twitter service:', error);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('dao-twitter-example.ts')) {
  testDAOTwitterService().catch(console.error);
}

export { testDAOTwitterService }; 