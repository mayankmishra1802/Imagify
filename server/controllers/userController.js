import { pool } from "../config/postgres.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import razorpay from "razorpay";
import crypto from "crypto";
import dotenv from"dotenv";

dotenv.config();

// Get user by ID
const getUserById = async (id) => {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0];
};

// Get user by Email
const getUserByEmail = async (email) => {
  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return result.rows[0];
};

// Create new user
const createUser = async (name, email, hashedPassword) => {
  const result = await pool.query(
    `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *`,
    [name, email, hashedPassword]
  );
  return result.rows[0];
};

// Update user credits
const updateUserCredits = async (id, newCredits) => {
  const result = await pool.query(
    `UPDATE users SET credit_balance = $1 WHERE id = $2 RETURNING *`,
    [newCredits, id]
  );
  return result.rows[0];
};

// Create transaction
const createTransaction = async (userId, plan, amount, credits, date) => {
  const result = await pool.query(
    `INSERT INTO transactions (user_id, plan, amount, credits, date) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, plan, amount, credits, date]
  );
  return result.rows[0];
};

// Get transaction by ID
const getTransactionById = async (id) => {
  const result = await pool.query(`SELECT * FROM transactions WHERE id = $1`, [id]);
  return result.rows[0];
};

// Update transaction payment status
const updateTransactionPayment = async (id) => {
  const result = await pool.query(
    `UPDATE transactions SET payment = true WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
};

// Register User
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing Details" });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await createUser(name, email, hashedPassword);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

    res.status(201).json({ success: true, token, user: { name: user.name } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Missing Details" });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid Password" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.status(200).json({
      success: true,
      token,
      user: { name: user.name, creditBalance: user.credit_balance },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User Credits
const userCredits = async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      credits: user.credit_balance,
      user: { name: user.name },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Razorpay Instance
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Payment via Razorpay
const paymentRazorpay = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.user.id;

    if (!planId) {
      return res.status(400).json({ success: false, message: "Plan ID is required" });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    let credits, amount;
    switch (planId) {
      case "Basic":
        credits = 100;
        amount = 835;
        break;
      case "Advanced":
        credits = 500;
        amount = 4175;
        break;
      case "Business":
        credits = 1000;
        amount = 8453;
        break;
      default:
        return res.status(400).json({ success: false, message: "Invalid Plan ID" });
    }

    // Create transaction
    const transaction = await createTransaction(userId, planId, amount, credits, Date.now());

    // Razorpay order options
    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: transaction.id.toString(),
      notes: { planId, credits, userId: userId.toString() },
    };

    const order = await razorpayInstance.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Error in paymentRazorpay:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

// Verify Razorpay Payment
const verifyRazor = async (req, res) => {
  try {
    const { razorpay_signature, razorpay_order_id, razorpay_payment_id } = req.body;

    if (!razorpay_signature || !razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({ success: false, message: "Invalid payment response" });
    }

    // Fetch Razorpay order
    const order = await razorpayInstance.orders.fetch(razorpay_order_id);
    if (!order || order.status !== "paid") {
      return res.status(400).json({ success: false, message: "Payment not completed" });
    }

    // Fetch transaction by ID (receipt)
    const transaction = await getTransactionById(order.receipt);
    if (!transaction) {
      return res.status(400).json({ success: false, message: "Transaction not found" });
    }

    // Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // Update transaction payment
    await updateTransactionPayment(transaction.id);

    // Update user credits
    const user = await getUserById(transaction.user_id);
    const newCredits = user.credit_balance + transaction.credits;
    await updateUserCredits(user.id, newCredits);

    res.status(200).json({ success: true, message: "Payment verified successfully" });
  } catch (error) {
    console.error("Error in verifyRazor:", error);
    res.status(500).json({ success: false, message: "Payment verification failed", error: error.message });
  }
};

export { registerUser, loginUser, userCredits, paymentRazorpay, verifyRazor };
