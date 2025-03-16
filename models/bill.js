const mongoose = require("mongoose");

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    billType: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
  },
  { timestamps: true }
);

const Bill = mongoose.model("Bill", billSchema);
module.exports = Bill;
