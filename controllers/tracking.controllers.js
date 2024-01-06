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
      });

      // Check if the lesson exists
      if (!lesson) throw new CustomError(404, "Lesson not found");

      // Find the tracking record for the user and lesson
      const trackingId = await prisma.tracking.findFirst({
        where: {
          lessonId: Number(lessonId),
          userId: Number(req.user.id),
        },
        select: {
          id: true,
          courseId: true, // Added courseId to use later
        },
      });

      // Check if the tracking record exists
      if (!trackingId) throw new CustomError(404, "Tracking record not found");

      // Update the tracking status and timestamp
      const tracking = await prisma.tracking.update({
        where: {
          id: trackingId.id,
        },
        data: {
          status: true,
          updatedAt: formattedDate(new Date()),
        },
      });

      // Update course progress for the user
      let courseId = tracking.courseId;
      let lessonLenght;
      let lessonTrue = 0;
      let newProgres;
      const lessonUser = await prisma.tracking.findMany({
        where: {
          userId: Number(req.user.id),
          courseId: Number(courseId),
        },
      });

      lessonLenght = lessonUser.length;
      lessonUser.forEach((val) => {
        if (val.status == true) {
          lessonTrue++;
        }
      });
      newProgres = (100 / lessonLenght) * lessonTrue;

      // Find enrollment ID
      const enrolId = await prisma.enrollment.findFirst({
        where: {
          userId: Number(req.user.id),
          courseId: Number(courseId),
        },
        select: {
          id: true,
        },
      });

      // Update the progress in the enrollment record
      const data = await prisma.enrollment.update({
        where: {
          id: enrolId.id,
        },
        data: {
          progres: newProgres.toFixed(1),
        },
      });

      // Clear existing progress update reminders
      if (reminderTimeout) {
        clearTimeout(reminderTimeout);
      }

      // Find all tracking records for the user with incomplete status
      const allTracking = await prisma.tracking.findMany({
        where: { userId: Number(req.user.id), status: false },
      });

      // Schedule a progress update reminder if there are incomplete lessons
      if (allTracking.length > 0 && !allTracking[0].status) {
        reminderTimeout = setTimeout(async () => {
          const lastUpdate = new Date(tracking.updatedAt).getTime();
          const currentTime = new Date().getTime();
          const timeDifference = currentTime - lastUpdate;

          // Send a reminder notification if no progress update in the last 24 hours
          if (timeDifference >= 24 * 60 * 60 * 1000) {
            await prisma.notification.create({
              data: {
                title: "Reminder",
                message: "You haven't updated your progress in the last 24 hours. Please continue learning.",
                userId: Number(req.user.id),
                createdAt: formattedDate(new Date()),
              },
            });
          }
        }, 24 * 60 * 60 * 1000);
      }

      res.status(200).json({
        status: true,
        message: "Tracking updated successfully",
        data: { tracking },
      });
    } catch (err) {
      next(err);
    }
  }),
};
