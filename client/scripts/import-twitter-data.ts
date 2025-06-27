import dotenv from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DAOService } from '../services/dao/daoService';
import { DAOTwitterService } from '../services/dao/daoTwitterService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the root directory
dotenv.config({ path: join(__dirname, '../../.env') });

async function importTwitterData() {
  try {
    console.log('🚀 Starting Twitter data import...');

    const daoService = new DAOService();
    const twitterService = new DAOTwitterService();

    // Get data directory
    const dataDir = join(__dirname, '../../data');
    const files = readdirSync(dataDir).filter(file => file.endsWith('.json'));

    console.log(`📁 Found ${files.length} JSON files in data directory:`);
    files.forEach(file => console.log(`  • ${file}`));

    for (const file of files) {
      try {
        // Extract DAO name from filename (e.g., "vitadao tweets.json" -> "vitadao")
        const daoName = file.replace(' tweets.json', '').toLowerCase();
        console.log(`\n📊 Processing ${daoName}...`);

        // Check if DAO exists in database
        const dao = await daoService.getDAOBySlug(daoName);
        if (!dao) {
          console.log(`⚠️  DAO '${daoName}' not found in database. Creating it...`);
          
          // Create the DAO
          const newDAO = await daoService.createDAO({
            name: daoName.charAt(0).toUpperCase() + daoName.slice(1) + 'DAO',
            slug: daoName,
            twitter_handle: daoName,
            description: `Tweets imported from ${file}`
          });
          console.log(`✅ Created DAO: ${newDAO.name}`);
        }

        // Read and parse JSON file
        const filePath = join(dataDir, file);
        console.log(`📄 Reading ${file}...`);
        
        const fileContent = readFileSync(filePath, 'utf8');
        const tweets = JSON.parse(fileContent);
        
        if (!Array.isArray(tweets)) {
          console.log(`❌ Invalid JSON format in ${file} - expected array`);
          continue;
        }

        console.log(`📝 Found ${tweets.length} tweets for ${daoName}`);

        // Transform tweets to match our schema
        const transformedTweets = tweets.map((tweet: any) => ({
          id: tweet.id,
          type: tweet.type || 'tweet',
          url: tweet.url,
          twitter_url: tweet.twitterUrl || tweet.twitter_url,
          text: tweet.text,
          source: tweet.source,
          retweet_count: tweet.retweetCount || tweet.retweet_count || 0,
          reply_count: tweet.replyCount || tweet.reply_count || 0,
          like_count: tweet.likeCount || tweet.like_count || 0,
          quote_count: tweet.quoteCount || tweet.quote_count || 0,
          view_count: tweet.viewCount || tweet.view_count || 0,
          bookmark_count: tweet.bookmarkCount || tweet.bookmark_count || 0,
          created_at: tweet.createdAt || tweet.created_at,
          lang: tweet.lang,
          is_reply: tweet.isReply || tweet.is_reply || false,
          in_reply_to_id: tweet.inReplyToId || tweet.in_reply_to_id,
          conversation_id: tweet.conversationId || tweet.conversation_id,
          in_reply_to_user_id: tweet.inReplyToUserId || tweet.in_reply_to_user_id,
          in_reply_to_username: tweet.inReplyToUsername || tweet.in_reply_to_username,
          author_username: tweet.author?.username || tweet.author_username,
          author_name: tweet.author?.name || tweet.author_name,
          author_id: tweet.author?.id || tweet.author_id,
          mentions: tweet.mentions || [],
          hashtags: tweet.hashtags || [],
          urls: tweet.urls || [],
          media: tweet.media || [],
          raw_data: tweet
        }));

        // Insert tweets in batches to avoid memory issues
        const batchSize = 100;
        let imported = 0;
        
        for (let i = 0; i < transformedTweets.length; i += batchSize) {
          const batch = transformedTweets.slice(i, i + batchSize);
          
          try {
            await twitterService.insertTwitterPosts(daoName, batch);
            imported += batch.length;
            console.log(`  ✅ Imported batch ${Math.ceil((i + 1) / batchSize)} - ${imported}/${transformedTweets.length} tweets`);
          } catch (batchError: any) {
            console.error(`  ❌ Error importing batch: ${batchError.message}`);
            // Continue with next batch
          }
        }

        console.log(`✅ Successfully imported ${imported}/${transformedTweets.length} tweets for ${daoName}`);

        // Show some analytics
        try {
          const analytics = await twitterService.getTwitterAnalytics(daoName);
          console.log(`📈 Analytics for ${daoName}:`);
          console.log(`  • Total tweets: ${analytics.total_tweets}`);
          console.log(`  • Total likes: ${analytics.total_likes}`);
          console.log(`  • Total retweets: ${analytics.total_retweets}`);
          console.log(`  • Avg likes per tweet: ${analytics.avg_likes_per_tweet}`);
          if (analytics.most_liked_tweet) {
            console.log(`  • Most liked tweet: ${analytics.most_liked_tweet.like_count} likes`);
          }
        } catch (analyticsError) {
          console.log(`⚠️  Could not fetch analytics for ${daoName}`);
        }

      } catch (fileError: any) {
        console.error(`❌ Error processing ${file}: ${fileError.message}`);
        continue;
      }
    }

    console.log('\n🎉 Twitter data import completed!');
    
    // Show summary
    console.log('\n📊 Import Summary:');
    const allDAOs = await daoService.getAllDAOs();
    for (const dao of allDAOs) {
      try {
        const analytics = await twitterService.getTwitterAnalytics(dao.slug);
        console.log(`  • ${dao.name}: ${analytics.total_tweets} tweets, ${analytics.total_likes} likes`);
      } catch (error) {
        console.log(`  • ${dao.name}: No Twitter data`);
      }
    }

  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Run the import
const isMainModule = process.argv[1] && process.argv[1].includes('import-twitter-data.ts');
if (isMainModule) {
  console.log('📋 Starting Twitter data import...');
  importTwitterData().catch(console.error);
}

export { importTwitterData }; 