import { pool } from "../config/postgres.js";

// create transactions table if not exists
const createTransactionsTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      amount INTEGER NOT NULL,
      credits INTEGER NOT NULL,
      payment BOOLEAN DEFAULT FALSE,
      date BIGINT
    );
  `;
  try {
    await pool.query(query);
    console.log("Transactions table is ready");
  } catch (error) {
    console.error("Error creating transactions table:", error);
  }
};

// example function to add a new transaction
const addTransaction = async (user_id, plan, amount, credits, payment, date) => {
  const query = `
    INSERT INTO transactions (user_id, plan, amount, credits, payment, date)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  try {
    const result = await pool.query(query, [user_id, plan, amount, credits, payment, date]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// example function to get transactions by user ID
const getTransactionsByUserId = async (user_id) => {
  const query = `
    SELECT * FROM transactions WHERE user_id = $1;
  `;
  try {
    const result = await pool.query(query, [user_id]);
    return result.rows;
  } catch (error) {
    throw error;
  }
};

export { createTransactionsTable, addTransaction, getTransactionsByUserId };
