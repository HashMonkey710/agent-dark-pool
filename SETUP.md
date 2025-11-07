# Setup Guide

Complete setup instructions for deploying the Agent Dark Pool.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** (comes with Node.js)
3. **Cloudflare Account** (free tier works)
4. **Wrangler CLI** (installed via npm)

## Step 1: Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/agent-dark-pool.git
cd agent-dark-pool
npm install
```

## Step 2: Login to Cloudflare

```bash
npx wrangler login
```

This opens your browser to authenticate with Cloudflare.

## Step 3: Create D1 Database

```bash
npx wrangler d1 create agent-dark-pool-db
```

Output will look like:
```
✅ Successfully created DB 'agent-dark-pool-db'!

[[d1_databases]]
binding = "DB"
database_name = "agent-dark-pool-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` value!**

## Step 4: Update Configuration

Edit `wrangler.toml` and replace `YOUR_DATABASE_ID_HERE` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "agent-dark-pool-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← Your actual ID here
```

## Step 5: Apply Database Migrations

```bash
# Apply to production database
npx wrangler d1 migrations apply agent-dark-pool-db

# Or apply to local database for testing
npx wrangler d1 migrations apply agent-dark-pool-db --local
```

## Step 6: Test Locally (Optional)

```bash
npm run dev
```

Visit http://localhost:8787 in your browser or test with curl:

```bash
# Health check
curl http://localhost:8787/health

# Submit test transaction
curl -X POST http://localhost:8787/submit \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
    "target_endpoint": "https://httpbin.org/post",
    "request_payload": {"test": "data"},
    "payment_amount": "10.00"
  }'

# Check stats
curl http://localhost:8787/stats
```

## Step 7: Deploy to Cloudflare

```bash
npm run deploy
```

Output will show your deployment URL:
```
Published agent-dark-pool (X.XX sec)
  https://agent-dark-pool.YOUR_SUBDOMAIN.workers.dev
```

## Step 8: Verify Deployment

```bash
curl https://agent-dark-pool.YOUR_SUBDOMAIN.workers.dev/health
```

Should return:
```json
{"status":"healthy","service":"agent-dark-pool"}
```

## Configuration Options

Edit these values in `wrangler.toml` under `[vars]`:

```toml
[vars]
ENVIRONMENT = "production"
PRIVACY_PREMIUM_PERCENT = "5"      # 5% fee on transactions
MAX_BATCH_SIZE = "10"              # Max transactions per batch
BATCH_WINDOW_SECONDS = "30"        # Seconds between batch executions
```

## Monitoring

### View Logs
```bash
npx wrangler tail
```

### Check Stats
```bash
curl https://agent-dark-pool.YOUR_SUBDOMAIN.workers.dev/stats
```

### Query Database
```bash
npx wrangler d1 execute agent-dark-pool-db \
  --command="SELECT COUNT(*) FROM private_transactions"
```

## Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your `agent-dark-pool` worker
3. Click "Triggers" tab
4. Add custom domain (e.g., `darkpool.yourdomain.com`)

## Troubleshooting

### Issue: "Database not found"
**Solution**: Make sure you ran migrations:
```bash
npx wrangler d1 migrations apply agent-dark-pool-db
```

### Issue: "Unauthorized" error
**Solution**: Login again:
```bash
npx wrangler logout
npx wrangler login
```

### Issue: Transactions not executing
**Solution**: Check cron triggers are enabled in Cloudflare Dashboard

### Issue: Port 8787 already in use
**Solution**: Use a different port:
```bash
npx wrangler dev --port 8788
```

## Cost

**Free Tier Limits** (Cloudflare Workers):
- ✅ 100,000 requests/day FREE
- ✅ 10 D1 databases @ 500MB each FREE
- ✅ 1GB Workers KV FREE
- ✅ Unlimited bandwidth on Workers FREE

**You won't pay anything until you exceed these limits.**

## Support

- GitHub Issues: https://github.com/YOUR_USERNAME/agent-dark-pool/issues
- Cloudflare Docs: https://developers.cloudflare.com/workers/
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/

## License

MIT License - See LICENSE file for details
