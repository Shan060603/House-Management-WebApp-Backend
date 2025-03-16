const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    category: { type: String, required: true }, // e.g., Food, Cleaning, Tools
    quantity: { type: Number, required: true },
    unit: { type: String }, // e.g., kg, pieces, liters
    purchaseDate: { type: Date },
    expirationDate: { type: Date }, // Optional, useful for food or medicine
    location: { type: String }, // e.g., Kitchen, Bathroom
    status: {
      type: String,
      enum: ["Available", "Out of Stock"],
      default: "Available",
    },
  },
  { timestamps: true }
);

const Inventory = mongoose.model("Inventory", inventorySchema);
module.exports = Inventory;
