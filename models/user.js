const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    default: "",
  },
  work: {
    type: String,
    default: "",
  },
  image: {
    type: String, // URL or file path
    default: "",
    required: false,
  },
});

const User = mongoose.model("User", userSchema);
module.exports = User;
