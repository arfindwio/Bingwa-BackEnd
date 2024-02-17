const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { generatedOTP } = require("../utils/otpGenerator");
const nodemailer = require("../utils/nodemailer");
const { formattedDate } = require("../utils/formattedDate");

const { JWT_SECRET_KEY, FRONTEND_URL } = process.env;

module.exports = {
  // Controller for user registration
  register: catchAsync(async (req, res, next) => {
    try {
      let { fullName, email, phoneNumber, password } = req.body;
      const passwordValidator = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,12}$/;
      const emailValidator = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      // Validate required fields
      if (!fullName || !email || !phoneNumber || !password) throw new CustomError(400, "All fields are required.");

      // Validate full name length
      if (fullName.length > 50) throw new CustomError(400, "Invalid full name length. It must be at most 50 characters.");

      // Check for existing user with the same email or phone number
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { userProfile: { phoneNumber } }],
        },
      });

      if (existingUser) {
        if (existingUser.googleId) throw new CustomError(409, "User already registered using Google OAuth. Please use Google OAuth to log in.");

        throw new CustomError(409, "Email or phone number already exists");
      }

      // Validate email format
      if (!emailValidator.test(email)) throw new CustomError(400, "Invalid email format.");

      // Validate phone number format
      if (!/^\d+$/.test(phoneNumber)) throw new CustomError(400, "Invalid phone number format. It must contain only numeric characters.");

      // Validate phone number length
      if (phoneNumber.length < 10 || phoneNumber.length > 12) throw new CustomError(400, "Invalid phone number length. It must be between 10 and 12 characters.");

      // Validate password format
      if (!passwordValidator.test(password)) throw new CustomError(400, "Invalid password format. It must contain at least 1 lowercase, 1 uppercase, 1 digit number, 1 symbol, and be between 8 and 12 characters long.");

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
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      await prisma.userProfile.create({
        data: {
          fullName,
          phoneNumber,
          userId: newUser.id,
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      // Send email verification OTP
      const html = await nodemailer.getHtml("verify-otp.ejs", { email, otp });
      await nodemailer.sendEmail(email, "Email Activation", html);

      delete newUser.id;
      delete newUser.otp;
      delete newUser.otpCreatedAt;
      delete newUser.role;
      delete newUser.resetPasswordToken;
      delete newUser.googleId;
      delete newUser.isVerified;

      res.status(201).json({
        status: true,
        message: "Registration successful",
        data: { newUser },
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller for user login
  login: catchAsync(async (req, res, next) => {
    try {
      let { emailOrPhoneNumber, password } = req.body;
      // Find user record based on email or phone number
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: emailOrPhoneNumber }, { userProfile: { phoneNumber: emailOrPhoneNumber } }],
        },
      });

      // Return error if user not found
      if (!user) throw new CustomError(401, "Invalid Email or Password!");

      if (!user.password && user.googleId) throw new CustomError(401, "Authentication failed. Please use Google OAuth to log in.");

      // Check if the provided password is correct
      let isPasswordCorrect = await bcrypt.compare(password, user.password);
      if (!isPasswordCorrect) throw new CustomError(401, "Invalid Email or Password!");

      // Return error if the user account is not verified
      if (!user.isVerified) throw new CustomError(403, "Account not verified. Please check your email!");

      // Generate JWT token for authentication
      let token = jwt.sign({ id: user.id }, JWT_SECRET_KEY, {
        expiresIn: "6h",
      });

      delete user.id;
      delete user.otp;
      delete user.otpCreatedAt;
      delete user.isVerified;
      delete user.role;
      delete user.resetPasswordToken;
      delete user.googleId;

      return res.status(200).json({
        status: true,
        message: "Login successful",
        data: { user, token },
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller for verifying email OTP
  verifyOtp: catchAsync(async (req, res, next) => {
    try {
      let { email, otp } = req.body;
      // Set OTP expiration time to 30 minutes
      const otpExpired = 30 * 60 * 1000;

      // Find the user based on the provided email
      let user = await prisma.user.findUnique({
        where: { email },
      });

      // Return error if user not found
      if (!user) throw new CustomError(404, "User not found");

      // Return error if the provided OTP is incorrect
      if (user.otp !== otp) throw new CustomError(401, "Invalid OTP");

      const currentTime = new Date();
      const isExpired = currentTime - user.otpCreatedAt > otpExpired;

      if (isExpired) throw new CustomError(400, "OTP has expired. Please request a new one.");

      // Update user's verification status
      let updateUser = await prisma.user.update({
        where: { email },
        data: { isVerified: true, updatedAt: formattedDate(new Date()) },
      });

      delete updateUser.id;
      delete updateUser.otp;
      delete updateUser.otpCreatedAt;
      delete updateUser.role;
      delete updateUser.resetPasswordToken;
      delete updateUser.googleId;

      res.status(200).json({
        status: true,
        message: "Activation successful",
        data: { updateUser },
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller to resend OTP for email verification
  resendOtp: catchAsync(async (req, res, next) => {
    try {
      const { email } = req.body;

      // Generate a new OTP and its creation timestamp
      const otpObject = generatedOTP();
      otp = otpObject.code;
      otpCreatedAt = otpObject.createdAt;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) throw new CustomError(404, "Email not found");

      // Send the new OTP via email
      const html = await nodemailer.getHtml("verify-otp.ejs", { email, otp });
      await nodemailer.sendEmail(email, "Email Activation", html);

      // Update user's OTP and OTP creation timestamp
      const updateOtp = await prisma.user.update({
        where: { email, id: Number(user.id) },
        data: { otp, otpCreatedAt, updatedAt: formattedDate(new Date()) },
      });

      delete updateOtp.id;
      delete updateOtp.otp;
      delete updateOtp.otpCreatedAt;
      delete updateOtp.isVerified;
      delete updateOtp.role;
      delete updateOtp.resetPasswordToken;
      delete updateOtp.googleId;

      res.status(200).json({
        status: true,
        message: "Resend OTP successful",
        data: { updateOtp },
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller to initiate the process of resetting the user's password
  forgetPasswordUser: catchAsync(async (req, res, next) => {
    try {
      let { email } = req.body;

      // Find the user based on the provided email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Return error if user not found
      if (!user) throw new CustomError(404, "Email not found");

      // Generate a JWT token for password reset with a 1-hour expiration
      let token = jwt.sign({ email: user.email }, JWT_SECRET_KEY, {
        expiresIn: "1h",
      });

      // Send an email with the password reset link
      const html = await nodemailer.getHtml("email-password-reset.ejs", {
        email,
        token,
        FRONTEND_URL,
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
  }),

  // Controller to update the user's password after password reset
  updatePasswordUser: catchAsync(async (req, res, next) => {
    try {
      let { token } = req.query;
      let { password, passwordConfirmation } = req.body;

      // Validate the new password format
      const passwordValidator = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,12}$/;

      if (!passwordValidator.test(password)) throw new CustomError(400, "Invalid password format. It must contain at least 1 lowercase, 1 uppercase, 1 digit number, 1 symbol, and be between 8 and 12 characters long.");

      // Confirm that the password and confirmation match
      if (password !== passwordConfirmation) throw new CustomError(400, "Please ensure that the password and password confirmation match!");

      // Hash the new password
      let encryptedPassword = await bcrypt.hash(password, 10);

      // Check if the token has already been used
      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
        },
      });

      if (user) throw new CustomError(400, "Token Is Alredy Use , generate new token to reset password");

      // Verify the JWT token and update the user's password
      jwt.verify(token, JWT_SECRET_KEY, async (err, decoded) => {
        if (err) throw new CustomError(400, "Bad request");

        let updateUser = await prisma.user.update({
          where: { email: decoded.email },
          data: { password: encryptedPassword, resetPasswordToken: token, updatedAt: formattedDate(new Date()) },
        });

        // Create a notification for the user
        await prisma.notification.create({
          data: {
            title: "Notifikasi",
            message: "Password successfully changed!",
            userId: updateUser.id,
            createdAt: formattedDate(new Date()),
            updatedAt: formattedDate(new Date()),
          },
        });

        delete updateUser.id;
        delete updateUser.otp;
        delete updateUser.otpCreatedAt;
        delete updateUser.isVerified;
        delete updateUser.role;
        delete updateUser.resetPasswordToken;
        delete updateUser.googleId;

        res.status(200).json({
          status: true,
          message: "Your password has been updated successfully!",
          data: { updateUser },
        });
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller to authenticate a user based on their ID
  authenticateUser: catchAsync(async (req, res, next) => {
    try {
      // Find the user based on their ID and include their profile information
      const user = await prisma.user.findUnique({
        where: { id: Number(req.user.id) },
        include: {
          userProfile: true,
        },
      });

      // Return error if user not found
      if (!user) throw new CustomError(404, "User not found");

      delete user.id;
      delete user.otp;
      delete user.otpCreatedAt;
      delete user.isVerified;
      delete user.resetPasswordToken;
      delete user.googleId;
      delete user.userProfile.id;
      delete user.userProfile.userId;

      return res.status(200).json({
        status: true,
        message: "Authentication successful",
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller to change the user's password
  changePasswordUser: catchAsync(async (req, res, next) => {
    try {
      const { oldPassword, newPassword, newPasswordConfirmation } = req.body;

      // Check if required parameters are provided
      if (!oldPassword || !newPassword || !newPasswordConfirmation) throw new CustomError(400, "Please provide oldPassword, newPassword, and newPasswordConfirmation");

      // Check if the old password provided matches the user's current password
      let isOldPasswordCorrect = await bcrypt.compare(oldPassword, req.user.password);
      if (!isOldPasswordCorrect) throw new CustomError(401, "Incorrect old password");

      // Validate the format of the new password using a regular expression
      const passwordValidator = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,12}$/;

      if (!passwordValidator.test(newPassword)) throw new CustomError(400, "Invalid password format. It must contain at least 1 lowercase, 1 uppercase, 1 digit number, 1 symbol, and be between 8 and 12 characters long.");

      // Check if the new password matches the password confirmation
      if (newPassword !== newPasswordConfirmation) throw new CustomError(400, "Please ensure that the new password and confirmation match!");

      // Hash the new password
      let encryptedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update user's password in the database
      let updateUser = await prisma.user.update({
        where: { id: Number(req.user.id) },
        data: { password: encryptedNewPassword, updatedAt: formattedDate(new Date()) },
      });

      // Create a notification for the user
      await prisma.notification.create({
        data: {
          title: "Notification",
          message: "Password successfully changed!",
          userId: req.user.id,
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      delete updateUser.id;
      delete updateUser.otp;
      delete updateUser.otpCreatedAt;
      delete updateUser.isVerified;
      delete updateUser.role;
      delete updateUser.resetPasswordToken;
      delete updateUser.googleId;

      res.status(200).json({
        status: true,
        message: "Your password has been successfully changed",
        data: { updateUser },
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller for Google OAuth2 authentication
  googleOauth2: (req, res) => {
    // Generate a JWT token for the authenticated user
    let token = jwt.sign({ id: req.user.id }, JWT_SECRET_KEY, {
      expiresIn: "6h",
    });

    const cookieOptions = {
      secure: true,
    };

    res.cookie("authToken", token, cookieOptions).redirect(FRONTEND_URL);
  },

  getAllUsers: catchAsync(async (req, res, next) => {
    try {
      const users = await prisma.user.findMany();

      return res.status(200).json({
        status: true,
        message: "Get All Users successful",
        data: { users },
      });
    } catch (err) {
      next(err);
    }
  }),

  deleteUserById: catchAsync(async (req, res, next) => {
    try {
      const userId = req.params.id;

      // Validation: Check if the userId is a valid number
      if (isNaN(userId)) throw new CustomError(400, "Invalid userId");

      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
      });

      // Validation: Check if the user with the given userId exists
      if (!user) throw new CustomError(404, "User not found");

      if (user.role === "admin") throw new CustomError(403, "Admins are not allowed to be deleted");

      await prisma.userProfile.delete({
        where: { userId: Number(user.id) },
      });

      const deletedUser = await prisma.user.delete({
        where: { id: Number(user.id) },
      });

      return res.status(200).json({
        status: true,
        message: "Delete User by Id successful",
        data: { deletedUser },
      });
    } catch (err) {
      next(err);
    }
  }),
};
