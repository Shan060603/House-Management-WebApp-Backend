// index.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/user");
const Task = require("./models/task");
const Appliance = require("./models/appliance");
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

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

// Serve uploaded images
app.use("/uploads", express.static("uploads"));

// --- CORS (allow both local and deployed frontend) ---
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://house-management-web-app-fronte-git-7144e6-shan060603s-projects.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// --- CRITICAL: Add these lines! ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MongoDB connection ---
const PORT = process.env.PORT || 3001;
mongoose
  .connect("mongodb://localhost:27017/home-web-app")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.log("❌ Could not connect to MongoDB", err));

// --- Error handlers ---
process.on("uncaughtException", function (err) {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", function (err) {
  console.error("Unhandled Rejection:", err);
});

// --- Helper functions ---
const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key";
const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    SECRET_KEY,
    { expiresIn: "1h" }
  );
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// ======================= USER CONTROLLER =======================

// REGISTER
app.post("/register", upload.single("image"), async (req, res) => {
  try {
    console.log("➡️ [REGISTER] req.body:", req.body);
    console.log("➡️ [REGISTER] req.file:", req.file);

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
      console.warn("⚠️ [REGISTER] User already exists:", email);
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

    console.log("✅ [REGISTER] User registered:", newUser.email);
    res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error("💥 [REGISTER] Error:", error);
    res
      .status(500)
      .json({ message: "Error registering user", error: error.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    console.log("➡️ [LOGIN] req.body:", req.body);

    const { email, password } = req.body;
    if (!email || !password) {
      console.warn("⚠️ [LOGIN] Missing email or password");
      return res.status(400).json({ message: "Email and password required" });
    }

    const trimmedEmail = email.trim();

    // Case-insensitive email match
    const user = await User.findOne({
      email: { $regex: new RegExp(`^${trimmedEmail}$`, "i") },
    });

    if (!user) {
      console.warn("❌ [LOGIN] User not found:", trimmedEmail);
      return res.status(400).json({ message: "User not found" });
    }

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn("❌ [LOGIN] Invalid password for user:", trimmedEmail);
      return res.status(400).json({ message: "Invalid password" });
    }

    // Use fallback for JWT secret
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || "default_jwt_secret",
      { expiresIn: "1d" }
    );

    console.log("✅ [LOGIN] Login successful:", user.email);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    console.error("💥 [LOGIN] Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user profile
app.get("/me", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [ME] req.user:", req.user);
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      console.warn("❌ [ME] User not found:", req.user.email);
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("💥 [ME] Error:", error);
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
      console.log("➡️ [UPDATE USER] req.body:", req.body);
      let updateFields = {};
      const { fullName, address, work } = req.body;
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
      if (!updatedUser) {
        console.warn("❌ [UPDATE USER] User not found:", req.params.id);
        return res.status(404).json({ message: "User not found" });
      }
      console.log("✅ [UPDATE USER] Updated:", updatedUser.email);
      res.json(updatedUser);
    } catch (error) {
      console.error("💥 [UPDATE USER] Error:", error);
      res
        .status(500)
        .json({ message: "Error updating user", error: error.message });
    }
  }
);

// Change password
app.put("/user/:id/password", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [CHANGE PASSWORD] req.body:", req.body);
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      console.warn("⚠️ [CHANGE PASSWORD] Missing fields");
      return res
        .status(400)
        .json({ message: "Current and new password required" });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      console.warn("❌ [CHANGE PASSWORD] User not found:", req.params.id);
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      console.warn("❌ [CHANGE PASSWORD] Incorrect current password");
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    user.password = await hashPassword(newPassword);
    await user.save();
    console.log("✅ [CHANGE PASSWORD] Password updated for:", user.email);
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("💥 [CHANGE PASSWORD] Error:", error);
    res
      .status(500)
      .json({ message: "Error updating password", error: error.message });
  }
});

// Update email
app.put("/user/:id/email", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [UPDATE EMAIL] req.body:", req.body);
    const { newEmail } = req.body;
    if (!newEmail) {
      console.warn("⚠️ [UPDATE EMAIL] New email required");
      return res.status(400).json({ message: "New email required" });
    }
    const existing = await User.findOne({ email: newEmail });
    if (existing) {
      console.warn("❌ [UPDATE EMAIL] Email already in use:", newEmail);
      return res.status(409).json({ message: "Email already in use" });
    }
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { email: newEmail } },
      { new: true }
    );
    if (!updatedUser) {
      console.warn("❌ [UPDATE EMAIL] User not found:", req.params.id);
      return res.status(404).json({ message: "User not found" });
    }
    console.log("✅ [UPDATE EMAIL] Email updated to:", newEmail);
    res.json(updatedUser);
  } catch (error) {
    console.error("💥 [UPDATE EMAIL] Error:", error);
    res
      .status(500)
      .json({ message: "Error updating email", error: error.message });
  }
});

// ======================= APPLIANCE CONTROLLER =======================

app.post("/addAppliances", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [ADD APPLIANCE] req.body:", req.body);
    const userId = req.user.id;
    const { name, brand, dateBought, nextMaintenanceDate } = req.body;
    if (!name || !dateBought) {
      console.warn("⚠️ [ADD APPLIANCE] Missing required fields");
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
    console.log("✅ [ADD APPLIANCE] Added:", name);
    res.status(201).json(newAppliance);
  } catch (error) {
    console.error("💥 [ADD APPLIANCE] Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/getAppliances", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const appliances = await Appliance.find({ userId });
    res.json(appliances);
  } catch (error) {
    console.error("💥 [GET APPLIANCES] Error:", error);
    res
      .status(500)
      .json({ message: "Error fetching appliances", error: error.message });
  }
});

app.put("/updateAppliance/:id", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [UPDATE APPLIANCE] req.body:", req.body);
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
      console.warn("❌ [UPDATE APPLIANCE] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Appliance not found or not authorized" });
    }
    console.log("✅ [UPDATE APPLIANCE] Updated:", updatedAppliance.name);
    res.json(updatedAppliance);
  } catch (error) {
    console.error("💥 [UPDATE APPLIANCE] Error:", error);
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
    if (!deletedAppliance) {
      console.warn("❌ [DELETE APPLIANCE] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Appliance not found or not authorized" });
    }
    console.log("✅ [DELETE APPLIANCE] Deleted:", deletedAppliance.name);
    res.json(deletedAppliance);
  } catch (error) {
    console.error("💥 [DELETE APPLIANCE] Error:", error);
    res
      .status(500)
      .json({ message: "Error deleting appliance", error: error.message });
  }
});

// ======================= BILL CONTROLLER =======================

app.post("/addBills", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [ADD BILL] req.body:", req.body);
    const userId = req.user.id;
    const newBill = await Bill.create({ ...req.body, userId });
    console.log("✅ [ADD BILL] Added");
    res.status(201).json(newBill);
  } catch (error) {
    console.error("💥 [ADD BILL] Error:", error);
    res
      .status(500)
      .json({ message: "Error adding bill", error: error.message });
  }
});

app.get("/getBills", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const bills = await Bill.find({ userId });
    res.json(bills);
  } catch (error) {
    console.error("💥 [GET BILLS] Error:", error);
    res
      .status(500)
      .json({ message: "Error fetching bills", error: error.message });
  }
});

app.put("/updateBills/:id", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [UPDATE BILL] req.body:", req.body);
    const userId = req.user.id;
    const updatedBill = await Bill.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedBill) {
      console.warn("❌ [UPDATE BILL] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Bill not found or not authorized" });
    }
    console.log("✅ [UPDATE BILL] Updated");
    res.json(updatedBill);
  } catch (error) {
    console.error("💥 [UPDATE BILL] Error:", error);
    res
      .status(500)
      .json({ message: "Error updating bill", error: error.message });
  }
});

app.delete("/deleteBills/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedBill = await Bill.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deletedBill) {
      console.warn("❌ [DELETE BILL] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Bill not found or not authorized" });
    }
    console.log("✅ [DELETE BILL] Deleted");
    res.json(deletedBill);
  } catch (error) {
    console.error("💥 [DELETE BILL] Error:", error);
    res
      .status(500)
      .json({ message: "Error deleting bill", error: error.message });
  }
});

// ======================= EXPENSE CONTROLLER =======================

app.post("/expenses", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [ADD EXPENSE] req.body:", req.body);
    const userId = req.user.id;
    const newExpense = await Expense.create({
      expenseId: uuidv4(),
      ...req.body,
      userId,
    });
    console.log("✅ [ADD EXPENSE] Added");
    res.status(201).json(newExpense);
  } catch (error) {
    console.error("💥 [ADD EXPENSE] Error:", error);
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
    console.error("💥 [GET EXPENSES] Error:", error);
    res
      .status(500)
      .json({ message: "Error fetching expenses", error: error.message });
  }
});

app.put("/expenses/:id", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [UPDATE EXPENSE] req.body:", req.body);
    const userId = req.user.id;
    const updatedExpense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedExpense) {
      console.warn("❌ [UPDATE EXPENSE] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Expense not found or not authorized" });
    }
    console.log("✅ [UPDATE EXPENSE] Updated");
    res.json(updatedExpense);
  } catch (error) {
    console.error("💥 [UPDATE EXPENSE] Error:", error);
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
    if (!deletedExpense) {
      console.warn("❌ [DELETE EXPENSE] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Expense not found or not authorized" });
    }
    console.log("✅ [DELETE EXPENSE] Deleted");
    res.json(deletedExpense);
  } catch (error) {
    console.error("💥 [DELETE EXPENSE] Error:", error);
    res
      .status(500)
      .json({ message: "Error deleting expense", error: error.message });
  }
});

// ======================= INVENTORY CONTROLLER =======================

app.post("/inventory", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [ADD INVENTORY] req.body:", req.body);
    const userId = req.user.id;
    const newItem = await Inventory.create({
      inventoryId: uuidv4(),
      ...req.body,
      userId,
    });
    console.log("✅ [ADD INVENTORY] Added");
    res.status(201).json(newItem);
  } catch (error) {
    console.error("💥 [ADD INVENTORY] Error:", error);
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
    console.error("💥 [GET INVENTORY] Error:", error);
    res.status(500).json({
      message: "Error fetching inventory items",
      error: error.message,
    });
  }
});

app.put("/inventory/:id", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [UPDATE INVENTORY] req.body:", req.body);
    const userId = req.user.id;
    const updatedItem = await Inventory.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedItem) {
      console.warn("❌ [UPDATE INVENTORY] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Inventory item not found or not authorized" });
    }
    console.log("✅ [UPDATE INVENTORY] Updated");
    res.json(updatedItem);
  } catch (error) {
    console.error("💥 [UPDATE INVENTORY] Error:", error);
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
    if (!deletedItem) {
      console.warn("❌ [DELETE INVENTORY] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Inventory item not found or not authorized" });
    }
    console.log("✅ [DELETE INVENTORY] Deleted");
    res.json(deletedItem);
  } catch (error) {
    console.error("💥 [DELETE INVENTORY] Error:", error);
    res
      .status(500)
      .json({ message: "Error deleting inventory item", error: error.message });
  }
});

// ======================= TASK CONTROLLER =======================

app.post("/addTasks", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [ADD TASK] req.body:", req.body);
    console.log("➡️ [ADD TASK] req.user:", req.user); // Add this log!

    const userId = req.user.userId; // <-- FIXED
    const { title, description, dueDate, status } = req.body;

    if (!title || !description || !dueDate || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newTask = await Task.create({
      title,
      description,
      dueDate,
      status,
      userId,
    });

    console.log("✅ [ADD TASK] Added:", title);
    res.status(201).json(newTask);
  } catch (error) {
    console.error("💥 [ADD TASK] Error:", error);
    res
      .status(500)
      .json({ message: "Error adding task", error: error.message });
  }
});

app.get("/getTasks", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tasks = await Task.find({ userId });
    res.json(tasks);
  } catch (error) {
    console.error("💥 [GET TASKS] Error:", error);
    res
      .status(500)
      .json({ message: "Error fetching tasks", error: error.message });
  }
});

app.put("/updateTasks/:id", authenticateToken, async (req, res) => {
  try {
    console.log("➡️ [UPDATE TASK] req.body:", req.body);
    const userId = req.user.id;
    const updatedTask = await Task.findOneAndUpdate(
      { _id: req.params.id, userId },
      req.body,
      { new: true }
    );
    if (!updatedTask) {
      console.warn("❌ [UPDATE TASK] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Task not found or not authorized" });
    }
    console.log("✅ [UPDATE TASK] Updated");
    res.json(updatedTask);
  } catch (error) {
    console.error("💥 [UPDATE TASK] Error:", error);
    res
      .status(500)
      .json({ message: "Error updating task", error: error.message });
  }
});

app.delete("/deleteTasks/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const deletedTask = await Task.findOneAndDelete({
      _id: req.params.id,
      userId,
    });
    if (!deletedTask) {
      console.warn("❌ [DELETE TASK] Not found or not authorized");
      return res
        .status(404)
        .json({ message: "Task not found or not authorized" });
    }
    console.log("✅ [DELETE TASK] Deleted");
    res.json(deletedTask);
  } catch (error) {
    console.error("💥 [DELETE TASK] Error:", error);
    res
      .status(500)
      .json({ message: "Error deleting task", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is Running on ${PORT}`);
});
