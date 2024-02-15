const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  getAllNotifications: catchAsync(async (req, res, next) => {
    try {
      // Retrieve all notifications for the authenticated user
      const notifications = await prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        where: { userId: Number(req.user.id) },
      });

      delete notifications.map((notification) => {
        return delete notification.userId;
      });

      res.status(200).json({
        status: true,
        message: "Notifications retrieved successfully",
        data: { notifications },
      });
    } catch (err) {
      next(err);
    }
  }),

  createNotification: catchAsync(async (req, res, next) => {
    try {
      const { title, message, createdAt } = req.body;

      // Validate the presence of required fields
      if (!title || !message) {
        throw new CustomError(400, "Title and message are required fields");
      }

      // Validate the absence of createdAt during notification creation
      if (createdAt !== undefined) {
        throw new CustomError(400, "createdAt cannot be provided during notification creation");
      }

      // Retrieve all users from the database
      const allUsers = await prisma.user.findMany();

      // Create notifications for all users using Promise.all
      const newNotification = await Promise.all(
        allUsers.map(async (user) => {
          return prisma.notification.create({
            data: {
              title,
              message,
              userId: user.id,
              createdAt: formattedDate(new Date()),
              updatedAt: formattedDate(new Date()),
            },
            include: {
              user: {
                select: {
                  userProfile: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          });
        })
      );

      res.status(201).json({
        status: true,
        message: "Notifications created for all users",
        data: { newNotification },
      });
    } catch (err) {
      next(err);
    }
  }),

  markNotificationsAsRead: catchAsync(async (req, res, next) => {
    try {
      // Mark all notifications as read for the authenticated users
      const notifications = await prisma.notification.updateMany({
        where: { userId: Number(req.user.id) },
        data: {
          isRead: true,
          updatedAt: formattedDate(new Date()),
        },
      });

      res.status(200).json({
        status: true,
        message: "Notifications marked as read for the user",
        data: { notifications },
      });
    } catch (err) {
      next(err);
    }
  }),
};
