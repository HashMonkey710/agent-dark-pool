# Agent Dark Pool

Private transaction network for x402 agents with MEV protection.

## What It Does

The Agent Dark Pool provides a **private mempool** for x402 agent transactions, protecting them from:
- Front-running attacks
- Sandwich attacks
- MEV extraction
- Public transaction visibility

Agents pay a **5% privacy premium** to submit transactions privately, which are then batched and executed atomically every 30 seconds.

## How It Works

1. **Agent submits private transaction** → Hidden from public mempool
2. **Stored in private database** → No one can see it
3. **Batched with other transactions** → Every 30 seconds
4. **Executed atomically** → All transactions in bundle succeed/fail together
5. **MEV protection** → Front-runners can't see individual requests

## Revenue Model

```
Privacy Premium: 5% of transaction value

Example:
- Agent wants to call endpoint for $10
- Agent pays Dark Pool: $10.50 ($10 + $0.50 privacy fee)
- Dark Pool executes transaction privately
- Dark Pool keeps $0.50 profit

At Scale:
- 1,000 transactions/day × $10 avg × 5% = $500/day profit
- 10,000 transactions/day = $5,000/day profit
- 100,000 transactions/day = $50,000/day profit
```

## API Endpoints

### Submit Private Transaction
```bash
POST /submit
{
  "agent_id": "agent-123",
  "target_endpoint": "https://some-x402-service.com/api",
  "request_payload": { "query": "data" },
  "payment_amount": "10.00"
}

Response:
{
  "success": true,
  "transaction_id": "uuid",
  "status": "pending",
  "privacy_fee": "0.50",
  "total_cost": "10.50",
  "estimated_execution": "30s"
}
```

### Check Transaction Status
```bash
GET /status/:txId

Response:
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "status": "executed",
    "batch_id": "batch-uuid",
    "result": { /* response data */ }
  }
}
```

### Pool Stats
```bash
GET /stats

Response:
{
  "success": true,
  "today": {
    "total_transactions": 1247,
    "total_volume": "12470.00",
    "total_fees": "623.50",
    "avg_batch_size": 8.3,
    "mev_attacks_prevented": 42
  },
  "pending_transactions": 5
}
```

## Local Development

```bash
# Install dependencies
npm install

# Apply database migrations
npm run db:local

# Start local dev server
npm run dev

# Access at http://localhost:8787
```

## Testing

```bash
# Submit a test transaction
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

# Check health
curl http://localhost:8787/health
```

## Deployment

```bash
# Create D1 database in Cloudflare
npm run db:create

# Update wrangler.toml with database_id

# Apply migrations to production
npm run db:migrate

# Deploy to Cloudflare Workers
npm run deploy
```

## Configuration

Environment variables in `wrangler.toml`:

- `PRIVACY_PREMIUM_PERCENT`: Privacy fee percentage (default: 5)
- `MAX_BATCH_SIZE`: Maximum transactions per batch (default: 10)
- `BATCH_WINDOW_SECONDS`: Seconds between batch executions (default: 30)

## Architecture

```
Agent → Dark Pool → Private DB → Batch Processor → Atomic Execution
  ↓         ↓           ↓              ↓                  ↓
Pay fee   Hide it   Store it      Bundle it         Execute it
```

## Why Agents Need This

As x402 ecosystem grows (932K transactions/week), MEV bots will attack agent transactions:

- **Front-running**: Bots see agent requests and execute first
- **Sandwich attacks**: Bots manipulate prices before/after agent trades
- **Privacy leaks**: Competitors see what agents are doing

Dark Pool solves this by **hiding transactions until execution**.

## Economics

**Zero Infrastructure Cost**: Cloudflare Workers free tier:
- 100,000 requests/day FREE
- 10 D1 databases @ 500MB each FREE
- Global edge network FREE

**Pure Profit**: Every transaction = 5% fee with zero marginal cost

## Next Steps

1. **Deploy to Cloudflare** - `npm run deploy`
2. **Integrate x402 payments** - Add payment verification
3. **Launch to agents** - Market as MEV protection service
4. **Scale up** - As volume grows, revenue compounds

## License

MIT

## Contact

Built by DegenLlama.net for the x402 ecosystem.
