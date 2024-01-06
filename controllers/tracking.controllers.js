const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { formattedDate } = require("../utils/formattedDate");

// Variable to store the timeout for progress update reminders
let reminderTimeout;

module.exports = {
  // Controller for updating lesson tracking and progress
  updateTracking: async (req, res, next) => {
    try {
      const lessonId = req.params.lessonId;
      const { createdAt, updatedAt } = req.body;

      // Validate the provided lessonId
      if (isNaN(lessonId) || lessonId <= 0) {
        return res.status(400).json({
          status: false,
          message: "Invalid lessonId parameter",
          data: null,
        });
      }

      // Validate that createdAt or updatedAt is not provided during tracking update
      if (createdAt !== undefined || updatedAt !== undefined) {
        return res.status(400).json({
          status: false,
          message: "createdAt or updateAt cannot be provided during tracking update",
          data: null,
        });
      }

      // Find the lesson details
      const lesson = await prisma.lesson.findUnique({
        where: { id: Number(lessonId) },
      });

      // Check if the lesson exists
      if (!lesson) {
        return res.status(404).json({
          status: false,
          message: "Lesson not found",
          data: null,
        });
      }

      // Find the tracking record for the user and lesson
      const trackingId = await prisma.tracking.findFirst({
        where: {
          lessonId: Number(lessonId),
          userId: Number(req.user.id),
        },
        select: {
          id: true,
        },
      });

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
  },
};
