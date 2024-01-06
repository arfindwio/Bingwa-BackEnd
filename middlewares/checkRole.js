module.exports = (role) => {
  return function (req, res, next) {
    if (!role.includes(req.user.role)) {
      res.status(403).json({
        status: false,
        message: "Access denied. You are not authorized",
      });
    } else {
      next();
    }
  };
};
