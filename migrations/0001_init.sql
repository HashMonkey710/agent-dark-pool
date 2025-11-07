-- Agent Dark Pool Database Schema
-- Stores private transactions before batching and execution

-- Private transactions waiting to be batched
CREATE TABLE IF NOT EXISTS private_transactions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  target_endpoint TEXT NOT NULL,
  request_payload TEXT NOT NULL,
  payment_amount TEXT NOT NULL,
  privacy_fee TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, batched, executed, failed
  batch_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  executed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pt_status ON private_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pt_batch_id ON private_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_pt_created_at ON private_transactions(created_at);

-- Execution batches
CREATE TABLE IF NOT EXISTS execution_batches (
  id TEXT PRIMARY KEY,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  total_value TEXT NOT NULL DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, completed, failed
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  executed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_eb_status ON execution_batches(status);

-- Transaction results
CREATE TABLE IF NOT EXISTS transaction_results (
  transaction_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0,
  response_data TEXT,
  error_message TEXT,
  executed_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (transaction_id) REFERENCES private_transactions(id),
  FOREIGN KEY (batch_id) REFERENCES execution_batches(id)
);

-- Stats for monitoring
CREATE TABLE IF NOT EXISTS pool_stats (
  date TEXT PRIMARY KEY, -- YYYY-MM-DD format
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_volume TEXT NOT NULL DEFAULT '0',
  total_fees TEXT NOT NULL DEFAULT '0',
  avg_batch_size REAL NOT NULL DEFAULT 0.0,
  mev_attacks_prevented INTEGER NOT NULL DEFAULT 0
);
