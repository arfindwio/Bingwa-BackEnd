const router = require("express").Router();
const { register, login, verifyOtp, resendOtp, forgetPasswordUser, updatePasswordUser, authenticateUser, changePasswordUser, googleOauth2 } = require("../controllers/user.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");
const passport = require("../libs/passport");

router.post("/register", register);
router.post("/login", login);
router.put("/verify-otp", verifyOtp);
router.put("/resend-otp", resendOtp);
router.post("/forget-password", forgetPasswordUser);
router.put("/update-password", updatePasswordUser);
router.get("/authenticate", Auth, checkRole(["user", "admin"]), authenticateUser);
router.put("/change-password", Auth, checkRole(["user", "admin"]), changePasswordUser);

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/api/v1/users/google",
    // successRedirect: "/",
    session: false,
  }),
  googleOauth2
);

module.exports = router;
