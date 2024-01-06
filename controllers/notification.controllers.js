const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  // Controller for retrieving all notifications for the authenticated user
  getAllNotifications: async (req, res, next) => {
    try {
      // Retrieve all notifications for the authenticated user
      const notifications = await prisma.notification.findMany({
        where: { userId: Number(req.user.id) },
      });

      res.status(200).json({
        status: true,
        message: "Notifications retrieved successfully",
        data: { notifications },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for creating notifications for all users
  createNotification: async (req, res, next) => {
    try {
      const { title, message, createdAt } = req.body;

      // Validate the presence of required fields
      if (!title || !message) {
        return res.status(400).json({
          status: false,
          message: "Title and message are required fields",
        });
      }

      // Validate the absence of createdAt during notification creation
      if (createdAt !== undefined) {
        return res.status(400).json({
          status: false,
          message: "createdAt  cannot be provided during notification creation",
          data: null,
        });
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
  },

  // Controller for marking all notifications as read for the authenticated user
  markNotificationsAsRead: async (req, res, next) => {
    try {
      // Mark all notifications as read for the authenticated users
      const notifications = await prisma.notification.updateMany({
        where: { userId: Number(req.user.id) },
        data: {
          isRead: true,
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
  },
};
