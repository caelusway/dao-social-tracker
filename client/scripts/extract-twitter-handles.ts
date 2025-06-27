import { readFileSync, readdirSync, openSync, readSync, closeSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function extractTwitterHandles(): Promise<Record<string, string> | undefined> {
  try {
    console.log('🔍 Extracting Twitter handles from JSON data...\n');

    const dataDir = join(__dirname, '../../data');
    const files = readdirSync(dataDir).filter(file => file.endsWith('.json'));

    const handles: Record<string, string> = {};

    for (const file of files) {
      try {
        const daoName = file.replace(' tweets.json', '').toLowerCase();
        console.log(`📊 Processing ${file}...`);

        const filePath = join(dataDir, file);
        
        // Read just the first 10KB to avoid memory issues but get enough data
        const buffer = Buffer.alloc(10240);
        const fd = openSync(filePath, 'r');
        const bytesRead = readSync(fd, buffer, 0, 10240, 0);
        closeSync(fd);
        
        const partialContent = buffer.toString('utf8', 0, bytesRead);
        
        // Try to find the first complete tweet object
        const firstBracket = partialContent.indexOf('[');
        const firstTweetStart = partialContent.indexOf('{', firstBracket);
        
        if (firstTweetStart === -1) {
          console.log(`  ⚠️  Could not find tweet structure`);
          handles[daoName] = daoName;
          continue;
        }

        // Find the end of the first tweet (look for closing brace followed by comma or bracket)
        let braceCount = 0;
        let tweetEnd = firstTweetStart;
        
        for (let i = firstTweetStart; i < partialContent.length; i++) {
          if (partialContent[i] === '{') braceCount++;
          if (partialContent[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              tweetEnd = i + 1;
              break;
            }
          }
        }

        const tweetJson = partialContent.substring(firstTweetStart, tweetEnd);
        
        try {
          const tweet = JSON.parse(tweetJson);
          console.log(`  🔍 Sample tweet keys:`, Object.keys(tweet).slice(0, 10));
          
          // Look for the Twitter handle in various possible fields
          let handle = null;
          
          // Check all possible field combinations
          const possibleFields = [
            'author.userName',
            'author.username',
            'author_username', 
            'username',
            'user.username',
            'user.screen_name',
            'screen_name',
            'handle',
            'twitter_handle'
          ];
          
          for (const field of possibleFields) {
            const value = getNestedValue(tweet, field);
            if (value && typeof value === 'string') {
              handle = value;
              console.log(`  ✅ Found handle in '${field}': @${handle}`);
              break;
            }
          }
          
          // If no handle found, try to extract from URL or other fields
          if (!handle) {
            if (tweet.url && typeof tweet.url === 'string') {
              const urlMatch = tweet.url.match(/twitter\.com\/([^\/]+)/);
              if (urlMatch) {
                handle = urlMatch[1];
                console.log(`  ✅ Extracted handle from URL: @${handle}`);
              }
            }
          }
          
          if (!handle && tweet.twitterUrl && typeof tweet.twitterUrl === 'string') {
            const urlMatch = tweet.twitterUrl.match(/twitter\.com\/([^\/]+)/);
            if (urlMatch) {
              handle = urlMatch[1];
              console.log(`  ✅ Extracted handle from twitterUrl: @${handle}`);
            }
          }
          
          if (handle) {
            handles[daoName] = handle;
          } else {
            console.log(`  ⚠️  No handle found, using default: ${daoName}`);
            console.log(`  📝 Available fields:`, Object.keys(tweet));
            handles[daoName] = daoName;
          }
          
        } catch (parseError: any) {
          console.log(`  ❌ Could not parse tweet JSON: ${parseError.message}`);
          handles[daoName] = daoName;
        }
        
      } catch (error: any) {
        console.error(`  ❌ Error processing ${file}: ${error.message}`);
        const daoName = file.replace(' tweets.json', '').toLowerCase();
        handles[daoName] = daoName; // fallback
      }
    }

    console.log('\n📋 Twitter Handles Summary:');
    console.log('==========================');
    Object.entries(handles).forEach(([dao, handle]) => {
      console.log(`${dao.padEnd(15)} -> @${handle}`);
    });

    console.log('\n📝 SQL INSERT statements with correct handles:');
    console.log('==============================================');
    
    const insertLines = Object.entries(handles).map(([daoSlug, handle]) => {
      const daoName = daoSlug.charAt(0).toUpperCase() + daoSlug.slice(1) + 'DAO';
      const description = getDAODescription(daoSlug);
      return `  ('${daoName}', '${daoSlug}', '${handle}', '${description}')`;
    });

    console.log('INSERT INTO daos (name, slug, twitter_handle, description) VALUES');
    console.log(insertLines.join(',\n'));
    console.log('ON CONFLICT (slug) DO NOTHING;');

    return handles;

  } catch (error) {
    console.error('❌ Error extracting handles:', error);
    return undefined;
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

function getDAODescription(slug: string): string {
  const descriptions: Record<string, string> = {
    'vitadao': 'Decentralized collective funding longevity research',
    'spinedao': 'Decentralized autonomous organization focused on spine health research',
    'mycodao': 'Decentralized collective advancing mycology and fungal research',
    'reflexdao': 'Decentralized organization focused on reflex and neurological research',
    'kidneydao': 'Decentralized collective funding kidney disease research',
    'microbiomedao': 'Decentralized organization advancing microbiome research',
    'spectruthaidao': 'Decentralized collective focused on spectral analysis and AI research'
  };
  
  return descriptions[slug] || `Decentralized autonomous organization - ${slug}`;
}

// Run the script
const isMainModule = process.argv[1] && process.argv[1].includes('extract-twitter-handles.ts');
if (isMainModule) {
  extractTwitterHandles().catch(console.error);
}

export { extractTwitterHandles }; 