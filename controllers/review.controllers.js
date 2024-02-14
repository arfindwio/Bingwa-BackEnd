const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  // Controller for creating a new review for a course
  createReview: catchAsync(async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { userRating, userComment } = req.body;

      // Validate the provided courseId
      if (isNaN(courseId) || courseId <= 0) throw new CustomError(400, "Invalid courseId provided");

      // Validate the provided userRating
      if (!Number.isInteger(userRating) || userRating < 1 || userRating > 5) throw new CustomError(400, "Invalid userRating provided. It must be an integer between 1 and 5.");

      // Find the enrollment details for the user and course
      let enrollment = await prisma.enrollment.findFirst({
        where: { userId: Number(req.user.id), courseId: Number(courseId) },
        include: { course: true },
      });

      // Check if the user is enrolled in the course
      if (!enrollment) throw new CustomError(404, "Please enroll in this course to review it");

      // Check if the user has already submitted a review for this course
      const existingReview = await prisma.review.findFirst({
        where: { enrollmentId: enrollment.id },
      });

      if (existingReview) throw new CustomError(400, "You have already submitted a review for this course");

      // Create a new review record in the database
      let newReview = await prisma.review.create({
        data: {
          userRating,
          userComment,
          enrollmentId: enrollment.id,
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      // Retrieve all reviews for the course
      const existingReviews = await prisma.review.findMany({
        where: { enrollment: { courseId: Number(courseId) } },
      });

      // Calculate the new average rating for the course
      const totalRating = existingReviews.reduce((sum, review) => sum + review.userRating, 0);
      const newAverageRating = totalRating / existingReviews.length;

      // Update the average rating for the course in the database
      const updatedCourse = await prisma.course.update({
        where: { id: Number(courseId) },
        data: { averageRating: newAverageRating },
      });

      return res.status(200).json({
        status: true,
        message: "Create Review User successfully",
        data: { newReview, updatedCourse: { averageRating: updatedCourse.averageRating } },
      });
    } catch (err) {
      next(err);
    }
  }),
};
