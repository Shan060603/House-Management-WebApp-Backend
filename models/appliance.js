const mongoose = require("mongoose");

const applianceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Added for user isolation
    name: { type: String, required: true },
    brand: { type: String },
    dateBought: { type: Date, required: true },
    maintenanceHistory: [
      {
        date: { type: Date },
        description: { type: String },
      },
    ],
    nextMaintenanceDate: { type: Date },
  },
  { timestamps: true }
);

const Appliance = mongoose.model("Appliance", applianceSchema);
module.exports = Appliance;
