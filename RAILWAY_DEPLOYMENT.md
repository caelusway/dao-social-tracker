# 🚂 Railway Production Deployment Guide

Complete guide to deploy your Twitter Engagement Sync system to Railway in production.

## 🚀 **Quick Deploy Steps**

### **1. Prepare Repository**
```bash
# Ensure all files are committed
git add .
git commit -m "Production deployment setup"
git push origin main
```

### **2. Deploy to Railway**
1. Go to [Railway.app](https://railway.app)
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect and deploy

### **3. Set Environment Variables**
In Railway dashboard, go to your service → Variables tab and add:

```bash
# Required Variables (Standard naming - preferred for production)
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Alternative naming (Next.js convention - also supported)
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional Configuration
SYNC_INTERVAL_HOURS=2
DAYS_TO_LOOK_BACK=5
MAX_REQUESTS_PER_BATCH=5
LOG_LEVEL=INFO
NODE_ENV=production
```

## 🔧 **Detailed Configuration**

### **Environment Variables Explained**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TWITTER_BEARER_TOKEN` | ✅ Yes | - | Your Twitter API Bearer Token |
| `SUPABASE_URL` | ✅ Yes | - | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ Yes | - | Your Supabase anonymous key |
| `SYNC_INTERVAL_HOURS` | ❌ Optional | 2 | How often to sync (hours) |
| `DAYS_TO_LOOK_BACK` | ❌ Optional | 5 | Days of tweets to check |
| `MAX_REQUESTS_PER_BATCH` | ❌ Optional | 5 | API requests per batch |
| `LOG_LEVEL` | ❌ Optional | INFO | DEBUG, INFO, WARN, ERROR |
| `NODE_ENV` | ❌ Optional | production | Environment type |

**Note**: The app supports both `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` naming conventions. Use the standard naming (`SUPABASE_URL`) for production deployments.

### **Getting Your Credentials**

#### **Twitter Bearer Token:**
1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Navigate to your app → Keys and Tokens
3. Copy "Bearer Token"

#### **Supabase Credentials:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → Settings → API
3. Copy "URL" and "anon public" key

## 📊 **Monitoring & Health Checks**

### **Health Check Endpoints**

Railway will automatically monitor these endpoints:

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `/health` | Health check | Service status |
| `/status` | Detailed status | Sync status & config |
| `/metrics` | Performance metrics | 7-day statistics |

### **Example Health Check Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "sync": {
    "isRunning": false,
    "isAutomatic": true
  }
}
```

## 🔍 **Production Monitoring**

### **Viewing Logs**
```bash
# In Railway dashboard
1. Go to your service
2. Click "Logs" tab
3. View real-time logs
```

### **Log Levels**
- **DEBUG**: Detailed debugging info
- **INFO**: General information (default)
- **WARN**: Warning messages
- **ERROR**: Error messages only

### **Key Log Messages**
```
🚀 Starting Production Engagement Sync Server
✅ Environment validation passed
📊 Sync interval: 2 hours
🩺 Health check server running on port 3000
```

## ⚙️ **Performance Optimization**

### **Resource Configuration**
Railway automatically scales, but you can optimize:

1. **Memory**: Monitor usage in Railway dashboard
2. **CPU**: Should be minimal for this workload
3. **Network**: Mainly Twitter API calls

### **Rate Limit Optimization**
```bash
# Conservative settings for production
SYNC_INTERVAL_HOURS=3          # Longer intervals
MAX_REQUESTS_PER_BATCH=3       # Smaller batches
DAYS_TO_LOOK_BACK=3           # Fewer days
```

## 🚨 **Error Handling**

### **Automatic Recovery**
The service includes:
- ✅ Graceful shutdown handling
- ✅ Automatic restart on failure
- ✅ Rate limit handling
- ✅ Database connection recovery

### **Common Issues & Solutions**

#### **Rate Limit Exceeded**
```
❌ Error: Rate limit reached
✅ Solution: Service waits automatically
📊 Check: /status endpoint for reset time
```

#### **Database Connection Issues**
```
❌ Error: Failed to fetch DAO Twitter accounts
✅ Solution: Check SUPABASE_URL and SUPABASE_ANON_KEY
🔍 Debug: Enable LOG_LEVEL=DEBUG
```

#### **Twitter API Issues**
```
❌ Error: Failed to fetch engagement data
✅ Solution: Verify TWITTER_BEARER_TOKEN
📱 Check: Twitter API status page
```

## 📈 **Scaling Considerations**

### **Current Limits**
- Twitter API: 15 requests/15min, 50k/month
- Processing: ~100 DAOs every 2 hours
- Database: Unlimited with Supabase

### **Scaling Up**
If you need higher throughput:

1. **Multiple Services**: Deploy separate instances
2. **Load Balancing**: Use Railway's built-in load balancing
3. **Database Sharding**: Split DAOs across services

## 🔒 **Security Best Practices**

### **Environment Variables**
- ✅ Never commit API keys to git
- ✅ Use Railway's environment variables
- ✅ Rotate keys regularly

### **Network Security**
- ✅ Railway provides HTTPS by default
- ✅ Health checks are public (no sensitive data)
- ✅ API keys are server-side only

## 🛠️ **Maintenance**

### **Regular Tasks**
```bash
# Weekly: Check logs for errors
railway logs

# Monthly: Review metrics
curl https://your-app.railway.app/metrics

# Quarterly: Rotate API keys
# Update environment variables in Railway
```

### **Updates & Deployments**
```bash
# Deploy updates
git push origin main
# Railway auto-deploys on push

# Rollback if needed
# Use Railway dashboard → Deployments → Rollback
```

## 📞 **Support & Troubleshooting**

### **Debugging Steps**
1. **Check Health**: Visit `/health` endpoint
2. **View Status**: Visit `/status` endpoint  
3. **Check Logs**: Railway dashboard → Logs
4. **Enable Debug**: Set `LOG_LEVEL=DEBUG`

### **Getting Help**
- Railway Discord: Community support
- GitHub Issues: Report bugs
- Supabase Support: Database issues
- Twitter Developer: API issues

## 🎯 **Production Checklist**

Before going live:

- [ ] ✅ Environment variables set
- [ ] ✅ Health check responding
- [ ] ✅ Logs showing successful startup  
- [ ] ✅ First sync completed successfully
- [ ] ✅ Rate limits configured appropriately
- [ ] ✅ Monitoring/alerting setup (optional)

## 📊 **Sample Production Configuration**

**For 50 DAOs, 2-hour sync cycle:**
```bash
SYNC_INTERVAL_HOURS=2
DAYS_TO_LOOK_BACK=5
MAX_REQUESTS_PER_BATCH=5
# Uses ~6 API requests per cycle
# Well within 15 req/15min limit
```

**For 100+ DAOs, conservative:**
```bash
SYNC_INTERVAL_HOURS=4
DAYS_TO_LOOK_BACK=3  
MAX_REQUESTS_PER_BATCH=3
# Uses ~12 API requests per cycle
# Safe for large DAO collections
```

Your system is now production-ready! 🚀 