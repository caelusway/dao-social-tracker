#!/usr/bin/env tsx

import { supabase } from '../services/supabase/client.js';
import { EngagementSyncService } from '../services/twitter/engagementSyncService.js';
import TwitterService from '../services/twitter/twitterService.js';

async function debugTweetData() {
  console.log('🔍 Debug Tweet Data Script');
  console.log('==========================');

  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) {
    console.error('❌ TWITTER_BEARER_TOKEN environment variable is required');
    process.exit(1);
  }

  try {
    // Create services
    const engagementService = new EngagementSyncService(bearerToken);
    const twitterService = new TwitterService(bearerToken);

    console.log('📋 Fetching accounts...');
    const { data: accounts, error } = await supabase
      .from('accounts')
      .select('id, slug, twitter_handle, name')
      .not('twitter_handle', 'is', null)
      .limit(1); // Just test with one account

    if (error) {
      console.error('❌ Error fetching accounts:', error);
      return;
    }

    if (!accounts || accounts.length === 0) {
      console.log('⚠️  No accounts found with Twitter handles');
      return;
    }

    const testAccount = accounts[0];
    console.log(`📱 Testing with account: ${testAccount.name} (@${testAccount.twitter_handle})`);

    // Test Twitter API call
    console.log('\n🐦 Testing Twitter API call...');
    const user = await twitterService.getUserByUsername(testAccount.twitter_handle);
    if (!user) {
      console.error('❌ Could not find Twitter user');
      return;
    }

    console.log('✅ Twitter user found:', {
      id: user.id,
      username: user.username,
      name: user.name
    });

    // Fetch recent tweets
    console.log('\n📄 Fetching recent tweets...');
    const tweets = await twitterService.fetchUserTweets(user.id, undefined, 5);
    
    if (tweets.length === 0) {
      console.log('⚠️  No tweets found');
      return;
    }

    console.log(`✅ Found ${tweets.length} tweets`);

    // Test validation on each tweet
    console.log('\n🔍 Testing tweet validation...');
    for (const [index, tweet] of tweets.entries()) {
      console.log(`\n--- Tweet ${index + 1} ---`);
      console.log('Raw tweet data:', JSON.stringify(tweet, null, 2));

      // Access the private validateTweetData method (hack for debugging)
      const validation = (engagementService as any).validateTweetData(tweet, testAccount);
      
      if (validation.isValid) {
        console.log('✅ Tweet validation passed');
        console.log('Validated data:', JSON.stringify(validation.data, null, 2));
        
        // Test database insertion
        console.log('\n🗄️  Testing database insertion...');
        const tableName = `account_${testAccount.slug}_tweets`;
        
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(validation.data);

        if (insertError) {
          if (insertError.code === '23505') {
            console.log('⚠️  Tweet already exists (duplicate)');
          } else {
            console.error('❌ Database insertion error:', {
              message: insertError.message,
              code: insertError.code,
              details: insertError.details,
              hint: insertError.hint
            });
          }
        } else {
          console.log('✅ Tweet inserted successfully');
        }
      } else {
        console.error('❌ Tweet validation failed:', validation.error);
      }
    }

    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Debug script error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : error);
  }
}

// Run the debug script
debugTweetData().catch(console.error); 