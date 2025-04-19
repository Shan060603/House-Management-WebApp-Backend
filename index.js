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
    origin: "http://localhost:3000", // Adjust to your frontend's port
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true, // Allow cookies and authorization headers
  })
);

app.use(express.json());

const PORT = process.env.PORT || 3001;

mongoose
  .connect("mongodb://localhost:27017/home-web-app")
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

app.post("/addAppliances", async (req, res) => {
  const { name, brand, dateBought, nextMaintenanceDate } = req.body;

  if (!name || !dateBought) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const newAppliance = new Appliance({
      name,
      brand,
      dateBought,
      nextMaintenanceDate,
    });

    await newAppliance.save();
    res.status(201).json(newAppliance);
  } catch (error) {
    console.error("Error adding appliance:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/getAppliances", async (req, res) => {
  try {
    const appliances = await Appliance.find();
    res.json(appliances);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching appliances", error: error.message });
  }
});

app.put("/updateAppliances/:id", async (req, res) => {
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

app.delete("/deleteAppliances/:id", async (req, res) => {
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

// Add this to restore the endpoint with capital B
app.post("/addBills", async (req, res) => {
  try {
    console.log("POST /addBills endpoint hit with data:", req.body);
    const newBill = await Bill.create({ billId: uuidv4(), ...req.body });
    res.status(201).json(newBill);
  } catch (error) {
    console.error("Error adding bill via /addBills:", error);
    res.status(500).json({ message: "Error adding bill", error: error.message });
  }
});



// GET Bills
app.get("/getBills", async (req, res) => {
  console.log("GET /getBills endpoint hit");
  try {
    const bills = await Bill.find();
    console.log("Bills found:", bills);
    res.json(bills);
  } catch (error) {
    console.error("Error in /getBills:", error);
    res.status(500).json({ message: "Error fetching bills", error: error.message });
  }
});



// Update your /bills endpoint in index.js
app.get("/bills", async (req, res) => {
  try {
    console.log("Fetching bills via /bills endpoint");
    const bills = await Bill.find();
    
    // Enhance bills with user data
    const enhancedBills = await Promise.all(bills.map(async (bill) => {
      const billObj = bill.toObject();
      
      // Look up user by ID
      if (bill.userId) {
        try {
          const user = await User.findById(bill.userId);
          if (user) {
            billObj.userDetails = {
              name: user.fullName,
              email: user.email
            };
          }
        } catch (err) {
          console.error(`Error looking up user for bill ${bill._id}:`, err);
        }
      }
      
      return billObj;
    }));
    
    console.log("Enhanced bills:", JSON.stringify(enhancedBills.slice(0, 2), null, 2));
    res.json(enhancedBills);
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ message: "Error fetching bills", error: error.message });
  }
});

// UPDATE Bill
app.put("/updateBills/:id", async (req, res) => {
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
app.delete("/deleteBills/:id", async (req, res) => {
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
app.post("/addTasks", async (req, res) => {
  try {
    console.log("Incoming Request Body:", req.body); // ✅ Debugging log

    if (!req.body.title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const newTask = await Task.create(req.body);
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Error adding task:", error); // ✅ Add detailed logs
    res
      .status(500)
      .json({ message: "Error adding task", error: error.message });
  }
});

// GET Task
app.get("/gettasks", async (req, res) => {
  try {
    const tasks = await Task.find(); // Get all tasks
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// UPDATE Task
app.put("/updateTasks/:id", async (req, res) => {
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
app.delete("/deleteTasks/:id", async (req, res) => {
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

// Add this to your index.js file in the USER CONTROLLER section
app.get("/getUsers", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    console.log(`Found ${userCount} users in database`);
    
    // Only return necessary user info (not passwords)
    const users = await User.find({}, 'fullName email _id');
    console.log("Users found:", users);
    
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
});




app.listen(PORT, () => {
  console.log(`Server is Running on ${PORT}`);
});
