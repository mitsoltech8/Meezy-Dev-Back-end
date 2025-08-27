const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;

  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };  // Attach user information to the request
    next();  // Proceed to the next middleware/route
  } catch (e) {
    console.error('Token verification failed:', e);
    return res.status(401).json({ message: 'Invalid token' });
  }
};
