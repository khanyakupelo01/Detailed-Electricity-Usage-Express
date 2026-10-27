CREATE TABLE purchase_transactions (
  id BIGSERIAL PRIMARY KEY,
  meter_number TEXT NOT NULL CHECK (meter_number !~ '^[[:space:]]*$'),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  transaction_timestamp TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type = 'purchase'),
  CONSTRAINT purchase_transactions_meter_amount_timestamp_key
    UNIQUE (meter_number, amount, transaction_timestamp)
);
