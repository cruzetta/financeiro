/*
  # Add end_date column to recurring_transactions

  1. Changes
    - Add `end_date` column to `recurring_transactions` table
    - This allows setting an end date for recurring transactions
    - Useful for handling future deletions and modifications

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recurring_transactions' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE recurring_transactions ADD COLUMN end_date timestamptz;
  END IF;
END $$;