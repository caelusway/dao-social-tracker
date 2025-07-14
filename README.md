# DAO Social Tracker

A Node.js application that automatically tracks Twitter engagement data for DAOs every 15 minutes and stores the data in Supabase.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+
- Supabase account
- Twitter Developer account

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   
   # Twitter API Configuration
   TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here
   
   # Optional: For server-side operations
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   ```

3. **Set up Supabase:**
   - Install Supabase CLI: `npm install -g supabase`
   - Initialize Supabase: `supabase init`
   - Run migrations: Apply all migrations from `supabase/migrations/` in your Supabase SQL editor or run `supabase db push`

4. **Add Account Twitter accounts:**
   ```sql
   INSERT INTO account_twitter_accounts (account_id, username)
   VALUES 
     ('your_account_uuid', 'twitter_username_without_@'),
     ('another_account_uuid', 'another_twitter_username');
   ```

### Usage

**Start the service:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
npm start
```

## 📊 Features

- **Automatic Twitter Sync**: Fetches tweets every 15 minutes
- **Rate Limit Handling**: Respects Twitter API limits
- **Error Resilience**: Individual failures don't stop the entire process
- **Engagement Tracking**: Stores likes, retweets, replies, and quotes
- **TypeScript Support**: Full type safety
- **Supabase Integration**: Reliable data storage

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler check
- `npm run twitter:sync` - Run one-time sync
- `npm run supabase:start` - Start local Supabase
- `npm run supabase:stop` - Stop local Supabase
- `npm run supabase:status` - Check Supabase status

## 🔧 Configuration

### Twitter API Setup

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app
3. Generate a Bearer Token
4. Add it to your `.env` file

### Supabase Setup

1. Create a new project at [Supabase](https://supabase.com/)
2. Get your project URL and anon key
3. Run the database migration
4. Add DAO Twitter accounts to track

## 📁 Project Structure

```
├── client/
│   ├── config/
│   │   └── environment.ts      # Environment configuration
│   ├── services/
│   │   ├── supabase/
│   │   │   └── client.ts       # Supabase client
│   │   └── twitter/
│   │       ├── types.ts        # TypeScript interfaces
│   │       ├── config.ts       # Twitter API config
│   │       ├── twitterService.ts # Core Twitter service
│   │       ├── syncManager.ts  # Sync orchestration
│   │       └── index.ts        # Main exports
│   ├── examples/
│   │   └── twitter-sync-example.ts # Usage examples
│   └── index.ts                # Application entry point
├── supabase/
│   └── migrations/             # Database migrations
├── package.json
├── tsconfig.json
└── README.md
```

## 🗄️ Database Schema

### Tables Created

- **account_twitter_accounts**: Stores Account Twitter usernames
- **account_twitter_posts**: Stores tweet data and engagement metrics
- **account_twitter_sync_status**: Tracks sync status per Account

## 🔍 Monitoring

The application logs:
- Service start/stop events
- Sync progress and results
- Error messages and warnings
- Rate limit status

## 🐛 Troubleshooting

**Common Issues:**

1. **Missing environment variables**: Check your `.env` file
2. **Twitter API errors**: Verify your Bearer Token
3. **Supabase connection**: Check URL and keys
4. **No tweets syncing**: Verify DAO accounts exist in database

**Debug Mode:**
Check console output for detailed logging of all operations.

## 📝 License

MIT License - see LICENSE file for details. 