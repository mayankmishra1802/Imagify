import { pool } from "../config/postgres.js";

// create users table if it doesn't exist
const createUsersTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      credit_balance INTEGER DEFAULT 5
    );
  `;
  try {
    await pool.query(query);
    console.log("Users table is ready");
  } catch (error) {
    console.error("Error creating users table:", error);
  }
};

// add a new user
const addUser = async (name, email, password) => {
  const query = `
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  try {
    const result = await pool.query(query, [name, email, password]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

// find user by email
const findUserByEmail = async (email) => {
  const query = `
    SELECT * FROM users WHERE email = $1;
  `;
  try {
    const result = await pool.query(query, [email]);
    return result.rows[0];
  } catch (error) {
    throw error;
  }
};

export { createUsersTable, addUser, findUserByEmail };
