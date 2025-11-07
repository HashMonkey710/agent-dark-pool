import { Hono } from 'hono';
import { z } from 'zod';

// Types
interface Env {
  DB: D1Database;
  PRIVACY_PREMIUM_PERCENT: string;
  MAX_BATCH_SIZE: string;
  BATCH_WINDOW_SECONDS: string;
}

// Schemas
const PrivateTransactionSchema = z.object({
  agent_id: z.string().describe('Unique identifier for the agent'),
  target_endpoint: z.string().url().describe('The x402 endpoint URL to call'),
  request_payload: z.record(z.any()).describe('The request data to send'),
  payment_amount: z.string().describe('Amount in USDC'),
});

type PrivateTransaction = z.infer<typeof PrivateTransactionSchema>;

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// Helper: Generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

// Helper: Calculate privacy fee (5% default)
function calculatePrivacyFee(amount: string, premiumPercent: number): string {
  const amountNum = parseFloat(amount);
  const fee = amountNum * (premiumPercent / 100);
  return fee.toFixed(2);
}

// Helper: Get current date string
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

// Endpoint: Submit private transaction
app.post('/submit', async (c) => {
  try {
    const body = await c.req.json();
    const transaction = PrivateTransactionSchema.parse(body);

    const premiumPercent = parseInt(c.env.PRIVACY_PREMIUM_PERCENT || '5');
    const privacyFee = calculatePrivacyFee(transaction.payment_amount, premiumPercent);
    const txId = generateId();

    // Store transaction in database (private mempool)
    await c.env.DB.prepare(`
      INSERT INTO private_transactions
      (id, agent_id, target_endpoint, request_payload, payment_amount, privacy_fee, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      txId,
      transaction.agent_id,
      transaction.target_endpoint,
      JSON.stringify(transaction.request_payload),
      transaction.payment_amount,
      privacyFee,
      'pending'
    ).run();

    return c.json({
      success: true,
      transaction_id: txId,
      status: 'pending',
      privacy_fee: privacyFee,
      total_cost: (parseFloat(transaction.payment_amount) + parseFloat(privacyFee)).toFixed(2),
      message: 'Transaction submitted to private pool. Will be executed in next batch.',
      estimated_execution: `${c.env.BATCH_WINDOW_SECONDS || 30}s`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request',
    }, 400);
  }
});

// Endpoint: Check transaction status
app.get('/status/:txId', async (c) => {
  const txId = c.req.param('txId');

  const tx = await c.env.DB.prepare(`
    SELECT pt.*, tr.success, tr.response_data, tr.error_message
    FROM private_transactions pt
    LEFT JOIN transaction_results tr ON pt.id = tr.transaction_id
    WHERE pt.id = ?
  `).bind(txId).first();

  if (!tx) {
    return c.json({ success: false, error: 'Transaction not found' }, 404);
  }

  return c.json({
    success: true,
    transaction: {
      id: tx.id,
      status: tx.status,
      batch_id: tx.batch_id,
      created_at: tx.created_at,
      executed_at: tx.executed_at,
      result: tx.success ? JSON.parse(tx.response_data || '{}') : null,
      error: tx.error_message,
    },
  });
});

// Endpoint: Get pool stats
app.get('/stats', async (c) => {
  const today = getCurrentDate();

  const stats = await c.env.DB.prepare(`
    SELECT * FROM pool_stats WHERE date = ?
  `).bind(today).first();

  const pendingTxs = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM private_transactions WHERE status = 'pending'
  `).first();

  return c.json({
    success: true,
    today: stats || {
      date: today,
      total_transactions: 0,
      total_volume: '0',
      total_fees: '0',
      avg_batch_size: 0,
      mev_attacks_prevented: 0,
    },
    pending_transactions: pendingTxs?.count || 0,
  });
});

// Endpoint: Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'agent-dark-pool' });
});

// Endpoint: Get batch status
app.get('/batch/:batchId', async (c) => {
  const batchId = c.req.param('batchId');

  const batch = await c.env.DB.prepare(`
    SELECT * FROM execution_batches WHERE id = ?
  `).bind(batchId).first();

  if (!batch) {
    return c.json({ success: false, error: 'Batch not found' }, 404);
  }

  const transactions = await c.env.DB.prepare(`
    SELECT id, status, executed_at FROM private_transactions WHERE batch_id = ?
  `).bind(batchId).all();

  return c.json({
    success: true,
    batch: {
      id: batch.id,
      status: batch.status,
      transaction_count: batch.transaction_count,
      total_value: batch.total_value,
      created_at: batch.created_at,
      executed_at: batch.executed_at,
      transactions: transactions.results,
    },
  });
});

// Cron: Process batched transactions
async function processBatch(env: Env): Promise<void> {
  const maxBatchSize = parseInt(env.MAX_BATCH_SIZE || '10');

  // Get pending transactions
  const pendingTxs = await env.DB.prepare(`
    SELECT * FROM private_transactions
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ?
  `).bind(maxBatchSize).all();

  if (!pendingTxs.results || pendingTxs.results.length === 0) {
    console.log('No pending transactions to process');
    return;
  }

  // Create batch
  const batchId = generateId();
  const totalValue = pendingTxs.results.reduce((sum, tx: any) =>
    sum + parseFloat(tx.payment_amount), 0
  ).toFixed(2);

  await env.DB.prepare(`
    INSERT INTO execution_batches (id, transaction_count, total_value, status)
    VALUES (?, ?, ?, ?)
  `).bind(batchId, pendingTxs.results.length, totalValue, 'executing').run();

  // Execute transactions atomically
  for (const tx of pendingTxs.results as any[]) {
    try {
      // Execute the actual x402 call
      const response = await fetch(tx.target_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: tx.request_payload,
      });

      const responseData = await response.json();

      // Mark as executed
      await env.DB.prepare(`
        UPDATE private_transactions
        SET status = 'executed', batch_id = ?, executed_at = unixepoch()
        WHERE id = ?
      `).bind(batchId, tx.id).run();

      // Store result
      await env.DB.prepare(`
        INSERT INTO transaction_results (transaction_id, batch_id, success, response_data)
        VALUES (?, ?, ?, ?)
      `).bind(tx.id, batchId, response.ok ? 1 : 0, JSON.stringify(responseData)).run();

    } catch (error) {
      // Mark as failed
      await env.DB.prepare(`
        UPDATE private_transactions
        SET status = 'failed', batch_id = ?, executed_at = unixepoch()
        WHERE id = ?
      `).bind(batchId, tx.id).run();

      await env.DB.prepare(`
        INSERT INTO transaction_results (transaction_id, batch_id, success, error_message)
        VALUES (?, ?, 0, ?)
      `).bind(tx.id, batchId, error instanceof Error ? error.message : 'Unknown error').run();
    }
  }

  // Mark batch as completed
  await env.DB.prepare(`
    UPDATE execution_batches
    SET status = 'completed', executed_at = unixepoch()
    WHERE id = ?
  `).bind(batchId).run();

  // Update stats
  const today = getCurrentDate();
  const totalFees = pendingTxs.results.reduce((sum, tx: any) =>
    sum + parseFloat(tx.privacy_fee), 0
  ).toFixed(2);

  await env.DB.prepare(`
    INSERT INTO pool_stats (date, total_transactions, total_volume, total_fees, avg_batch_size)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      total_transactions = total_transactions + excluded.total_transactions,
      total_volume = (CAST(total_volume AS REAL) + CAST(excluded.total_volume AS REAL)),
      total_fees = (CAST(total_fees AS REAL) + CAST(excluded.total_fees AS REAL)),
      avg_batch_size = ((avg_batch_size * total_transactions) + excluded.avg_batch_size) / (total_transactions + excluded.total_transactions)
  `).bind(today, pendingTxs.results.length, totalValue, totalFees, pendingTxs.results.length).run();

  console.log(`Batch ${batchId} completed with ${pendingTxs.results.length} transactions`);
}

// Export worker
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processBatch(env));
  },
};
