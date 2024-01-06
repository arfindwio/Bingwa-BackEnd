const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { generatedOTP } = require("../utils/otpGenerator");
const nodemailer = require("../utils/nodemailer");
const { formattedDate } = require("../utils/formattedDate");

const { JWT_SECRET_KEY } = process.env;

module.exports = {
  // Controller for user registration
  register: async (req, res, next) => {
    try {
      let { fullName, email, phoneNumber, password } = req.body;
      const passwordValidator =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,12}$/;
      const emailValidator = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Validate required fields
      if (!fullName || !email || !phoneNumber || !password) {
        return res.status(400).json({
          status: false,
          message: "All fields are required.",
          data: null,
        });
      }

      // Validate full name length
      if (fullName.length > 50) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid full name length. It must be at most 50 characters.",
          data: null,
        });
      }

      // Check for existing user with the same email or phone number
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { userProfile: { phoneNumber } }],
        },
      });

      if (existingUser) {
        if (existingUser.googleId) {
          return res.status(409).json({
            status: false,
            message:
              "User already registered using Google OAuth. Please use Google OAuth to log in.",
            data: null,
          });
        }

        return res.status(409).json({
          status: false,
          message: "Email or phone number already exists",
          data: null,
        });
      }

      // Validate email format
      if (!emailValidator.test(email)) {
        return res.status(400).json({
          status: false,
          message: "Invalid email format.",
          data: null,
        });
      }

      // Validate phone number format
      if (!/^\d+$/.test(phoneNumber)) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid phone number format. It must contain only numeric characters.",
          data: null,
        });
      }

      // Validate phone number length
      if (phoneNumber.length < 10 || phoneNumber.length > 12) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid phone number length. It must be between 10 and 12 characters.",
          data: null,
        });
      }

      // Validate password format
      if (!passwordValidator.test(password)) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid password format. It must contain at least 1 lowercase, 1 uppercase, 1 digit number, 1 symbol, and be between 8 and 12 characters long.",
          data: null,
        });
      }

      // Generate and store OTP for email verification
      const otpObject = generatedOTP();
      otp = otpObject.code;
      otpCreatedAt = otpObject.createdAt;

      // Encrypt user password
      let encryptedPassword = await bcrypt.hash(password, 10);

      // Create new user and user profile records
      let newUser = await prisma.user.create({
        data: {
          email,
          password: encryptedPassword,
          otp,
          otpCreatedAt,
        },
      });

      let newUserProfile = await prisma.userProfile.create({
        data: {
          fullName,
          phoneNumber,
          userId: newUser.id,
        },
      });

      // Send email verification OTP
      const html = await nodemailer.getHtml("verify-otp.ejs", { email, otp });
      await nodemailer.sendEmail(email, "Email Activation", html);

      res.status(201).json({
        status: true,
        message: "Registration successful",
        data: { newUser, newUserProfile },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for user login
  login: async (req, res, next) => {
    try {
      let { emailOrPhoneNumber, password } = req.body;
      // Find user record based on email or phone number
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: emailOrPhoneNumber },
            { userProfile: { phoneNumber: emailOrPhoneNumber } },
          ],
        },
      });

      // Return error if user not found
      if (!user) {
        return res.status(401).json({
          status: false,
          message: "Invalid Email or Password!",
          data: null,
        });
      }

      if (!user.password && user.googleId) {
        return res.status(401).json({
          status: false,
          message: "Authentication failed. Please use Google OAuth to log in.",
          data: null,
        });
      }

      // Check if the provided password is correct
      let isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) {
        return res.status(401).json({
          status: false,
          message: "Invalid Email or Password!",
          data: null,
        });
      }

      // Return error if the user account is not verified
      if (!user.isVerified) {
        return res.status(403).json({
          status: false,
          message: "Account not verified. Please check your email!",
          data: null,
        });
      }

      // Generate JWT token for authentication
      let token = jwt.sign({ id: user.id }, JWT_SECRET_KEY);

      return res.status(200).json({
        status: true,
        message: "Login successful",
        data: { user, token },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for verifying email OTP
  verifyOtp: async (req, res, next) => {
    try {
      let { email, otp } = req.body;
      // Set OTP expiration time to 30 minutes
      const otpExpired = 30 * 60 * 1000;

      // Find the user based on the provided email
      let user = await prisma.user.findUnique({
        where: { email },
      });

      // Return error if user not found
      if (!user) {
        return res.status(404).json({
          status: false,
          message: "User not found",
          data: null,
        });
      }

      // Return error if the provided OTP is incorrect
      if (user.otp !== otp) {
        return res.status(401).json({
          status: false,
          message: "Invalid OTP",
          data: null,
        });
      }

      const currentTime = new Date();
      const isExpired = currentTime - user.otpCreatedAt > otpExpired;

      if (isExpired) {
        return res.status(400).json({
          status: false,
          message: "OTP has expired. Please request a new one.",
          data: null,
        });
      }

      // Update user's verification status
      let updateUser = await prisma.user.update({
        where: { email },
        data: { isVerified: true },
      });

      res.status(200).json({
        status: true,
        message: "Activation successful",
        data: updateUser,
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller to resend OTP for email verification
  resendOtp: async (req, res, next) => {
    try {
      const { email } = req.body;

      // Generate a new OTP and its creation timestamp
      const otpObject = generatedOTP();
      otp = otpObject.code;
      otpCreatedAt = otpObject.createdAt;

      // Send the new OTP via email
      const html = await nodemailer.getHtml("verify-otp.ejs", { email, otp });
      await nodemailer.sendEmail(email, "Email Activation", html);

      // Update user's OTP and OTP creation timestamp
      const updateOtp = await prisma.user.update({
        where: { email },
        data: { otp, otpCreatedAt },
      });

      res.status(200).json({
        status: true,
        message: "Resend OTP successful",
        data: updateOtp,
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller to initiate the process of resetting the user's password
  forgetPasswordUser: async (req, res, next) => {
    try {
      let { email } = req.body;

      // Find the user based on the provided email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Return error if user not found
      if (!user) {
        return res.status(404).json({
          status: false,
          message: "Email not found",
          data: null,
        });
      }

      // Generate a JWT token for password reset with a 1-hour expiration
      let token = jwt.sign({ email: user.email }, JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      // Send an email with the password reset link
      const html = await nodemailer.getHtml("email-password-reset.ejs", {
        email,
        token,
      });
      await nodemailer.sendEmail(email, "Reset Password", html);

      res.status(200).json({
        status: true,
        message: "Email sent successfully",
        data: { email, token },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller to update the user's password after password reset
  updatePasswordUser: async (req, res, next) => {
    try {
      let { token } = req.query;
      let { password, passwordConfirmation } = req.body;

      // Validate the new password format
      const passwordValidator =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,12}$/;

      if (!passwordValidator.test(password)) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid password format. It must contain at least 1 lowercase, 1 uppercase, 1 digit number, 1 symbol, and be between 8 and 12 characters long.",
          data: null,
        });
      }

      // Confirm that the password and confirmation match
      if (password !== passwordConfirmation) {
        return res.status(400).json({
          status: false,
          message:
            "Please ensure that the password and password confirmation match!",
          data: null,
        });
      }

      // Hash the new password
      let encryptedPassword = await bcrypt.hash(password, 10);

      // Check if the token has already been used
      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
        },
      });

      if (user) {
        return res.status(400).json({
          status: false,
          message: "Token Is Alredy Use , generate new token to reset password",
        });
      }

      // Verify the JWT token and update the user's password
      jwt.verify(token, JWT_SECRET_KEY, async (err, decoded) => {
        if (err) {
          return res.status(400).json({
            status: false,
            message: "Bad request",
            err: err.message,
            data: null,
          });
        }

        let updateUser = await prisma.user.update({
          where: { email: decoded.email },
          data: { password: encryptedPassword, resetPasswordToken: token },
        });

        // Create a notification for the user
        await prisma.notification.create({
          data: {
            title: "Notifikasi",
            message: "Password successfully changed!",
            userId: updateUser.id,
            createdAt: formattedDate(new Date()),
          },
        });

        res.status(200).json({
          status: true,
          message: "Your password has been updated successfully!",
          data: { updateUser },
        });
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller to authenticate a user based on their ID
  authenticateUser: async (req, res, next) => {
    try {
      // Find the user based on their ID and include their profile information
      const user = await prisma.user.findUnique({
        where: { id: Number(req.user.id) },
        include: {
          userProfile: true,
        },
      });

      // Return error if user not found
      if (!user) {
        return res.status(404).json({
          status: false,
          message: "User not found",
          data: null,
        });
      }

      return res.status(200).json({
        status: true,
        message: "Authentication successful",
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller to change the user's password
  changePasswordUser: async (req, res, next) => {
    try {
      const { oldPassword, newPassword, newPasswordConfirmation } = req.body;

      // Check if required parameters are provided
      if (!oldPassword || !newPassword || !newPasswordConfirmation) {
        return res.status(400).json({
          status: false,
          message:
            "Please provide oldPassword, newPassword, and newPasswordConfirmation",
          data: null,
        });
      }

      // Check if the old password provided matches the user's current password
      let isOldPasswordCorrect = await bcrypt.compare(
        oldPassword,
        req.user.password
      );
      if (!isOldPasswordCorrect) {
        return res.status(401).json({
          status: false,
          message: "Incorrect old password",
          data: null,
        });
      }

      // Validate the format of the new password using a regular expression
      const passwordValidator =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,12}$/;

      if (!passwordValidator.test(newPassword)) {
        return res.status(400).json({
          status: false,
          message:
            "Invalid password format. It must contain at least 1 lowercase, 1 uppercase, 1 digit number, 1 symbol, and be between 8 and 12 characters long.",
          data: null,
        });
      }

      // Check if the new password matches the password confirmation
      if (newPassword !== newPasswordConfirmation) {
        return res.status(400).json({
          status: false,
          message:
            "Please ensure that the new password and confirmation match!",
          data: null,
        });
      }

      // Hash the new password
      let encryptedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update user's password in the database
      let updateUser = await prisma.user.update({
        where: { id: Number(req.user.id) },
        data: { password: encryptedNewPassword },
      });

      // Create a notification for the user
      await prisma.notification.create({
        data: {
          title: "Notification",
          message: "Password successfully changed!",
          userId: req.user.id,
          createdAt: formattedDate(new Date()),
        },
      });

      res.status(200).json({
        status: true,
        message: "Your password has been successfully changed",
        data: { updateUser },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for Google OAuth2 authentication
  googleOauth2: (req, res) => {
    // Generate a JWT token for the authenticated user
    let token = jwt.sign({ id: req.user.id }, JWT_SECRET_KEY);
    
    // Redirect to a desired URL
    res.redirect(`https://final-project-binar-seven.vercel.app?authToken=${token}`);
  },
};
