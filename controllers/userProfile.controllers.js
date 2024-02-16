const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const imagekit = require("../libs/imagekit");
const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  // Controller to update user profile information
  updateProfile: catchAsync(async (req, res, next) => {
    try {
      const { fullName, phoneNumber, city, country } = req.body;
      const file = req.file;
      let imageURL;

      // Validation checks for mandatory fields
      if (!fullName || !phoneNumber) throw new CustomError(400, "Please provide fullName, and phoneNumber ");

      // Validation check for full name length
      if (fullName.length > 50) throw new CustomError(400, "Invalid full name length. It must be at most 50 characters.");

      // Validation checks for phone number format and length
      if (phoneNumber) {
        if (!/^\d+$/.test(phoneNumber)) throw new CustomError(400, "Invalid phone number format. It must contain only numeric characters.");

        if (phoneNumber.length < 10 || phoneNumber.length > 12) throw new CustomError(400, "Invalid phone number length. It must be between 10 and 12 characters.");
      }

      // Handle file upload if a new profile picture is provided
      if (file) {
        const strFile = file.buffer.toString("base64");

        const { url } = await imagekit.upload({
          fileName: Date.now() + path.extname(req.file.originalname),
          file: strFile,
        });

        imageURL = url;
      }

      // Update user profile in the database
      const newUserProfile = await prisma.userProfile.update({
        where: {
          userId: Number(req.user.id),
        },
        data: { profilePicture: imageURL, fullName, phoneNumber, city, country, updatedAt: formattedDate(new Date()) },
      });

      delete newUserProfile.id;
      delete newUserProfile.userId;

      res.status(200).json({
        status: true,
        message: "Profile updated successfully",
        data: { newUserProfile },
      });
    } catch (err) {
      next(err);
    }
  }),
};
