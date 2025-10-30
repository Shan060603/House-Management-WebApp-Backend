const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    console.warn("❌ [AUTH] No token provided");
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.warn("❌ [AUTH] Invalid token:", err.message);
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user; // user: { userId, role, ... }
    console.log("✅ [AUTH] Authenticated user:", user);
    next();
  });
}

module.exports = authenticateToken;
