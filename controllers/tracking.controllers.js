const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");

// Variable to store the timeout for progress update reminders
let reminderTimeout;

module.exports = {
  // Controller for updating lesson tracking and progress
  updateTracking: catchAsync(async (req, res, next) => {
    try {
      const lessonId = req.params.lessonId;
      const { createdAt, updatedAt } = req.body;

      // Validate the provided lessonId
      if (isNaN(lessonId) || lessonId <= 0) throw new CustomError(400, "Invalid lessonId parameter");

      // Validate that createdAt or updatedAt is not provided during tracking update
      if (createdAt !== undefined || updatedAt !== undefined) throw new CustomError(400, "createdAt or updatedAt cannot be provided during tracking update");

      // Find the lesson details
      const lesson = await prisma.lesson.findUnique({
        where: { id: Number(lessonId) },
        include: {
          chapter: {
            select: {
              courseId: true,
            },
          },
        },
      });

      // Check if the lesson exists
      if (!lesson) throw new CustomError(404, "Lesson not found");

      // Find the tracking record for the user and lesson
      const tracking = await prisma.tracking.findFirst({
        where: {
          lessonId: Number(lesson.id),
          userId: Number(req.user.id),
        },
        select: {
          id: true,
        },
      });

      // Check if the tracking record exists
      if (!tracking) throw new CustomError(404, "Tracking record not found");

      // Update the tracking status and timestamp
      const updatedTracking = await prisma.tracking.update({
        where: {
          id: Number(tracking.id),
        },
        data: {
          status: true,
          updatedAt: formattedDate(new Date()),
        },
      });

      const allTracking = await prisma.tracking.findMany({
        where: {
          userId: Number(req.user.id),
          lesson: {
            chapter: {
              courseId: Number(lesson.chapter.courseId),
            },
          },
        },
      });

      const falseCount = allTracking.filter((item) => item.status === false).length;
      const trueCount = allTracking.filter((item) => item.status === true).length;

      let updatedProgress = trueCount / allTracking.length;

      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId: Number(req.user.id),
          courseId: Number(lesson.chapter.courseId),
        },
      });

      await prisma.enrollment.update({
        where: {
          id: Number(enrollment.id),
        },
        data: {
          progress: updatedProgress,
          updatedAt: formattedDate(new Date()),
        },
      });

      // Clear existing progress update reminders
      if (reminderTimeout) {
        clearTimeout(reminderTimeout);
      }

      // Schedule a progress update reminder if there are incomplete lessons
      if (falseCount > 0) {
        reminderTimeout = setTimeout(async () => {
          const lastUpdate = new Date(updatedTracking.updatedAt).getTime();
          const currentTime = new Date().getTime();
          const timeDifference = currentTime - lastUpdate;

          // Send a reminder notification if no progress update in the last 3 days
          if (timeDifference >= 3 * 24 * 60 * 60 * 1000) {
            await prisma.notification.create({
              data: {
                title: "Reminder",
                message: "You haven't updated your progress in the last 3 days. Please continue learning.",
                userId: Number(req.user.id),
                createdAt: formattedDate(new Date()),
                updatedAt: formattedDate(new Date()),
              },
            });
          }
        }, 3 * 24 * 60 * 60 * 1000);
      }

      res.status(200).json({
        status: true,
        message: "Tracking updated successfully",
        data: { updatedTracking },
      });
    } catch (err) {
      next(err);
    }
  }),

  getTrackingByCourseId: catchAsync(async (req, res, next) => {
    try {
      const courseId = req.params.courseId;

      // Validate the provided lessonId
      if (isNaN(courseId) || courseId <= 0) throw new CustomError(400, "Invalid lessonId parameter");

      // Find the tracking record for the user and lesson
      const allTrackings = await prisma.tracking.findMany({
        where: {
          lesson: {
            chapter: {
              course: {
                id: Number(courseId),
              },
            },
          },
          userId: Number(req.user.id),
        },
        select: {
          id: true,
          status: true,
          lessonId: true,
        },
      });

      // Check if the tracking record exists
      if (!allTrackings) throw new CustomError(404, "Tracking record by courseId not found");

      res.status(200).json({
        status: true,
        message: "Tracking updated successfully",
        data: { allTrackings },
      });
    } catch (err) {
      next(err);
    }
  }),
};
