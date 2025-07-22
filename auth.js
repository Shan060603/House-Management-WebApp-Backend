const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET || "your-secret-key";

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user; // user: { id, email, role }
    next();
  });
}

module.exports = authenticateToken;
