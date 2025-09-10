import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

// pool create kar rahe hain using connection string
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

// function to connect to the database
const connectDb = async () => {
  try {
    const client = await pool.connect();
    console.log("Database Connected");
    client.release();  // connection release kar diya
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1); // agar connection fail hua to app close kar do
  }
};

export { pool, connectDb };
