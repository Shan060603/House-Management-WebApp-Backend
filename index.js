const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/user");
const Task = require("./models/task");
const Appliance = require("./models/appliance");
//const Expense = require("./models/expense");
const Bill = require("./models/bill");
const Inventory = require("./models/inventory");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const app = express();
const authenticateToken = require("./auth");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

// Serve uploaded images
app.use("/uploads", express.static("uploads"));

//Offline
/*app.use(
  cors({
    origin: "http://localhost:3000", // Adjust to your frontend's port
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
); */

//Online
app.use(cors({
  origin: [ 'https://house-management-web-app-frontend-qjymcy8ry.vercel.app' ],
  credentials: true
}));


app.use(express.json());

//Offline
/*const PORT = process.env.PORT || 3001;*/

//Online
const PORT = process.env.PORT || 5000;

//offline
/* mongoose
  .connect("mongodb://localhost:27017/home-web-app")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Could not connect to MongoDB", err)); */

//online
mongoose
  .connect("mongodb+srv://shansilveo:silveo05@shansilveo.tpsrae8.mongodb.net/?retryWrites=true&w=majority&appName=shansilveo")
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.log("Could not connect to MongoDB Atlas", err));


// Add top-level error handlers for debugging
process.on("uncaughtException", function (err) {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", function (err) {
  console.error("Unhandled Rejection:", err);
});

// ======================= Helper Functions =======================

const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key";
const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10; // Default to 10 if not defined
const jwtSecret = process.env.JWT_SECRET || "default_jwt_secret"; // Default secret key

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
app.post("/register", upload.single("image"), async (req, res) => {
  try {
    console.log("Register req.body:", req.body);
    console.log("Register req.file:", req.file);
    const {
      fullName,
      email,
      password,
      role,
      address = "",
      work = "",
    } = req.body;
    let image = "";
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role,
      address,
      work,
      image,
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

    // Generate token (e.g., 2-hour expiry)
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      SECRET_KEY,
      { expiresIn: "2h" } // Set to 2 hours
    );

    res.json({
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// Get current user profile
app.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching user", error: error.message });
  }
});

// Update user profile
app.put(
  "/user/:id",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      const { fullName, address, work } = req.body;
      let updateFields = {};
      if (fullName) updateFields.fullName = fullName;
      if (address) updateFields.address = address;
      if (work) updateFields.work = work;
      if (req.file) {
        updateFields.image = `/uploads/${req.file.filename}`;
      }
      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updateFields },
        { new: true }
      );
      if (!updatedUser)
        return res.status(404).json({ message: "User not found" });
      res.json(updatedUser);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Error updating user", error: error.message });
    }
  }
);

// Change password
app.put("/user/:id/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password required" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Current password is incorrect" });
    user.password = await hashPassword(newPassword);
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating password", error: error.message });
  }
});

// Update email
app.put("/user/:id/email", authenticateToken, async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail)
      return res.status(400).json({ message: "New email required" });
    const existing = await User.findOne({ email: newEmail });
    if (existing)
      return res.status(409).json({ message: "Email already in use" });
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { email: newEmail } },
      { new: true }
    );
    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });
    res.json(updatedUser);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating email", error: error.message });
  }
});

// ======================= APPLIANCE CONTROLLER =======================

app.post("/addAppliances", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, brand, dateBought, nextMaintenanceDate } = req.body;
    if (!name || !dateBought) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const newAppliance = new Appliance({
      name,
      brand,
      dateBought,
      nextMaintenanceDate,
      userId,
    });
    await newAppliance.save();
    res.status(201).json(newAppliance);
  } catch (error) {
    console.error("Error adding appliance:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/getAppliances", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const appliances = await Appliance.find({ userId });
    res.json(appliances);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching appliances", error: error.message });
  }
});

// Update an appliance
app.put("/updateAppliance/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedData = { ...req.body };
    if (updatedData.dateBought) {
      updatedData.dateBought = new Date(updatedData.dateBought);
    }
    if (updatedData.nextMaintenanceDate) {
      updatedData.nextMaintenanceDate = new Date(
        updatedData.nextMaintenanceDate
      );
    }
    const updatedAppliance = await Appliance.findOneAndUpdate(
      { _id: req.params.id, userId },
      updatedData,
      { new: true }
    );
    if (!updatedAppliance) {
      return res
        .status(404)
        .json({ message: "Appliance not found or not authorized" });
    }
    res.json(updatedAppliance);
  } catch (error) {
    console.error("Error updating in backend:", error);
    res
      .status(400)
      .json({ message: "Error updating appliance", error: error.message });
  }
});

app.delete("/deleteAppliances/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedAppliance = await Appliance.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deletedAppliance)
      return res
        .status(404)
        .json({ message: "Appliance not found or not authorized" });
    res.json(deletedAppliance);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting appliance", error: error.message });
  }
});

// ======================= BILL CONTROLLER =======================

// ADD Bill
app.post("/addBills", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const newBill = await Bill.create({ ...req.body, userId });
    res.status(201).json(newBill);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding bill", error: error.message });
  }
});

// GET Bills
app.get("/getBills", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const bills = await Bill.find({ userId });
    res.json(bills);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching bills", error: error.message });
  }
});

// UPDATE Bill
app.put("/updateBills/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedBill = await Bill.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedBill)
      return res
        .status(404)
        .json({ message: "Bill not found or not authorized" });
    res.json(updatedBill);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating bill", error: error.message });
  }
});

// DELETE Bill
app.delete("/deleteBills/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedBill = await Bill.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deletedBill)
      return res
        .status(404)
        .json({ message: "Bill not found or not authorized" });
    res.json(deletedBill);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting bill", error: error.message });
  }
});

// ======================= EXPENSE CONTROLLER =======================

app.post("/expenses", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const newExpense = await Expense.create({
      expenseId: uuidv4(),
      ...req.body,
      userId,
    });
    res.status(201).json(newExpense);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding expense", error: error.message });
  }
});

app.get("/expenses", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const expenses = await Expense.find({ userId });
    res.json(expenses);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching expenses", error: error.message });
  }
});

app.put("/expenses/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedExpense)
      return res
        .status(404)
        .json({ message: "Expense not found or not authorized" });
    res.json(updatedExpense);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating expense", error: error.message });
  }
});

app.delete("/expenses/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedExpense = await Expense.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deletedExpense)
      return res
        .status(404)
        .json({ message: "Expense not found or not authorized" });
    res.json(deletedExpense);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting expense", error: error.message });
  }
});

// ======================= INVENTORY CONTROLLER =======================

app.post("/inventory", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const newItem = await Inventory.create({
      inventoryId: uuidv4(),
      ...req.body,
      userId,
    });
    res.status(201).json(newItem);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding inventory", error: error.message });
  }
});

app.get("/inventory", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await Inventory.find({ userId });
    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching inventory items",
      error: error.message,
    });
  }
});

app.put("/inventory/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedItem = await Inventory.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedItem)
      return res
        .status(404)
        .json({ message: "Inventory item not found or not authorized" });
    res.json(updatedItem);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating inventory item", error: error.message });
  }
});

app.delete("/inventory/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedItem = await Inventory.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deletedItem)
      return res
        .status(404)
        .json({ message: "Inventory item not found or not authorized" });
    res.json(deletedItem);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting inventory item", error: error.message });
  }
});

// ======================= TASK CONTROLLER =======================

// ADD Task
app.post("/addTasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Ensure description is always an array
    const description = Array.isArray(req.body.description)
      ? req.body.description
      : [req.body.description || ""];
    const newTask = await Task.create({ ...req.body, description, userId });
    res.status(201).json(newTask);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding task", error: error.message });
  }
});

// GET Task
app.get("/getTasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await Task.find({ userId });
    res.json(tasks);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching tasks", error: error.message });
  }
});

// UPDATE Task
app.put("/updateTasks/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedTask)
      return res
        .status(404)
        .json({ message: "Task not found or not authorized" });
    res.json(updatedTask);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating task", error: error.message });
  }
});

// DELETE Task
app.delete("/deleteTasks/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedTask = await Task.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deletedTask)
      return res
        .status(404)
        .json({ message: "Task not found or not authorized" });
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
