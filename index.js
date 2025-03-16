const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/user");
const Task = require("./models/task");
const Appliance = require("./models/appliance");
const Expense = require("./models/expense");
const Bill = require("./models/bill");
const Inventory = require("./models/inventory");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());

const PORT = process.env.PORT || 3001;

mongoose
  .connect("mongodb://localhost:27017/home-web-app", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Could not connect to MongoDB", err));

// ======================= Helper Functions =======================

const SECRET_KEY = "your_secret_key";
const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS);
const jwtSecret = process.env.JWT_SECRET;

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "1h" }
  );
};

// Hashing function
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// ======================= USER CONTROLLER =======================

// REGISTER
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = await User.create({
      userId: uuidv4(),
      fullName,
      email,
      password: hashedPassword,
      role,
    });

    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error("Error registering user:", error.message);
    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Normalize email to avoid case sensitivity issues
    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Compare password securely
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(401).json({ message: "Invalid credentials" });

    // Generate token (e.g., 1-hour expiry)
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// ======================= APPLIANCE CONTROLLER =======================

app.post("/appliances", async (req, res) => {
  try {
    const newAppliance = await Appliance.create({
      applianceId: uuidv4(),
      ...req.body,
    });
    res.status(201).json(newAppliance);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding appliance", error: error.message });
  }
});

app.get("/appliances", async (req, res) => {
  try {
    const appliances = await Appliance.find();
    res.json(appliances);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching appliances", error: error.message });
  }
});

app.put("/appliances/:id", async (req, res) => {
  try {
    const updatedAppliance = await Appliance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedAppliance)
      return res.status(404).json({ message: "Appliance not found" });
    res.json(updatedAppliance);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating appliance", error: error.message });
  }
});

app.delete("/appliances/:id", async (req, res) => {
  try {
    const deletedAppliance = await Appliance.findByIdAndDelete(req.params.id);
    if (!deletedAppliance)
      return res.status(404).json({ message: "Appliance not found" });
    res.json(deletedAppliance);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting appliance", error: error.message });
  }
});

// ======================= BILL CONTROLLER =======================

// ADD Bill
app.post("/bills", async (req, res) => {
  try {
    const newBill = await Bill.create({ billId: uuidv4(), ...req.body });
    res.status(201).json(newBill);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding bill", error: error.message });
  }
});

// GET Bills
app.get("/bills", async (req, res) => {
  try {
    const bills = await Bill.find();
    res.json(bills);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching bills", error: error.message });
  }
});

// UPDATE Bill
app.put("/bills/:id", async (req, res) => {
  try {
    const updatedBill = await Bill.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedBill)
      return res.status(404).json({ message: "Bill not found" });
    res.json(updatedBill);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating bill", error: error.message });
  }
});

// DELETE Bill
app.delete("/bills/:id", async (req, res) => {
  try {
    const deletedBill = await Bill.findByIdAndDelete(req.params.id);
    if (!deletedBill)
      return res.status(404).json({ message: "Bill not found" });
    res.json(deletedBill);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting bill", error: error.message });
  }
});

// ======================= EXPENSE CONTROLLER =======================

// ADD Expense
app.post("/expenses", async (req, res) => {
  try {
    const newExpense = await Expense.create({
      expenseId: uuidv4(),
      ...req.body,
    });
    res.status(201).json(newExpense);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding expense", error: error.message });
  }
});

// GET Expenses
app.get("/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find();
    res.json(expenses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching expenses", error: error.message });
  }
});

// UPDATE Expense
app.put("/expenses/:id", async (req, res) => {
  try {
    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedExpense)
      return res.status(404).json({ message: "Expense not found" });
    res.json(updatedExpense);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating expense", error: error.message });
  }
});

// DELETE Expense
app.delete("/expenses/:id", async (req, res) => {
  try {
    const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
    if (!deletedExpense)
      return res.status(404).json({ message: "Expense not found" });
    res.json(deletedExpense);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting expense", error: error.message });
  }
});

// ======================= INVENTORY CONTROLLER =======================

// ADD Inventory
app.post("/inventory", async (req, res) => {
  try {
    const newItem = await Inventory.create({
      inventoryId: uuidv4(),
      ...req.body,
    });
    res.status(201).json(newItem);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding inventory", error: error.message });
  }
});

// GET Inventory
app.get("/inventory", async (req, res) => {
  try {
    const items = await Inventory.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching inventory items",
      error: error.message,
    });
  }
});

// UPDATE Inventory
app.put("/inventory/:id", async (req, res) => {
  try {
    const updatedItem = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedItem)
      return res.status(404).json({ message: "Inventory item not found" });
    res.json(updatedItem);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating inventory item", error: error.message });
  }
});

// DELETE Inventory
app.delete("/inventory/:id", async (req, res) => {
  try {
    const deletedItem = await Inventory.findByIdAndDelete(req.params.id);
    if (!deletedItem)
      return res.status(404).json({ message: "Inventory item not found" });
    res.json(deletedItem);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting inventory item", error: error.message });
  }
});

// ======================= TASK CONTROLLER =======================

// ADD Task
app.post("/tasks", async (req, res) => {
  try {
    const newTask = await Task.create({ taskId: uuidv4(), ...req.body });
    res.status(201).json(newTask);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding task", error: error.message });
  }
});

// GET Task
app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching tasks", error: error.message });
  }
});

// UPDATE Task
app.put("/tasks/:id", async (req, res) => {
  try {
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedTask)
      return res.status(404).json({ message: "Task not found" });
    res.json(updatedTask);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating task", error: error.message });
  }
});

// DELETE Task
app.delete("/tasks/:id", async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);
    if (!deletedTask)
      return res.status(404).json({ message: "Task not found" });
    res.json(deletedTask);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting task", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is Running on ${PORT}`);
});
