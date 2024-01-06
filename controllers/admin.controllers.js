const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = {
  detailDashboard: async (req, res, next) => {
    try {
      // Retrieve the count of users from the database using PrismaClient
      let countUser = await prisma.user.count();

      // Retrieve the count of all courses from the database using PrismaClient
      let allCourse = await prisma.course.count();

      // Retrieve the count of premium courses from the database using PrismaClient
      let coursePremium = await prisma.course.count({
        where: {
          isPremium: true,
        },
      });
      res.status(200).json({
        status: true,
        message: "Succes to show detail data dashboard",
        data: {
          countUser,
          allCourse,
          coursePremium,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
