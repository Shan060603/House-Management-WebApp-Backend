const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: [String], // Changed from String to Array of Strings
    default: [],
  },
  dueDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ["Pending", "Completed"],
    default: "Pending",
  },
});

const Task = mongoose.model("Task", taskSchema);
module.exports = Task;
