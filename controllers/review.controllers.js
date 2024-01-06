const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  // Controller for creating a new review for a course
  createReview: async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { userRating, userComment } = req.body;

      // Validate the provided courseId
      if (isNaN(courseId) || courseId <= 0) {
        return res.status(400).json({
          status: false,
          message: "Invalid courseId provided",
          data: null,
        });
      }

      // Validate the provided userRating
      if (!Number.isInteger(userRating) || userRating < 1 || userRating > 5) {
        return res.status(400).json({
          status: false,
          message: "Invalid userRating provided. It must be an integer between 1 and 5.",
          data: null,
        });
      }

      // Find the enrollment details for the user and course
      let enrollment = await prisma.enrollment.findFirst({
        where: { userId: Number(req.user.id), courseId: Number(courseId) },
        include: { course: true },
      });

      // Check if the user is enrolled in the course
      if (!enrollment) {
        return res.status(404).json({
          status: false,
          message: "Please enroll in this course to review it",
          data: null,
        });
      }

      // Check if the user has already submitted a review for this course
      const existingReview = await prisma.review.findFirst({
        where: { enrollmentId: enrollment.id },
      });

      if (existingReview) {
        return res.status(400).json({
          status: false,
          message: "You have already submitted a review for this course",
          data: null,
        });
      }

      // Create a new review record in the database
      let newReview = await prisma.review.create({
        data: { userRating, userComment, enrollmentId: enrollment.id, createdAt: formattedDate(new Date()) },
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
  },
};
