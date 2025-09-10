import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDb } from "./config/postgres.js";  // postgres connection
import { createUsersTable } from "./models/userModel.js";
import { createTransactionsTable } from "./models/transactionModel.js";
import userRouter from "./routes/userRoutes.js";
import imageRouter from "./routes/imageRoutes.js";

dotenv.config();

const PORT = process.env.PORT || 4000;
const app = express();

app.use(express.json());
app.use(cors());

await connectDb();  // PostgreSQL se connect karna
await createUsersTable(); // table ready karna
await createTransactionsTable();

app.use("/api/user", userRouter);
app.use("/api/image", imageRouter);

app.get('/', (req, res) => res.send("API working"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
