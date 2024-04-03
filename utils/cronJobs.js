const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const cron = require("node-cron");

const { formattedDate } = require("./formattedDate");

module.exports = {
  promotionCheck: () => {
    cron.schedule("0 0 * * *", async function () {
      const courses = await prisma.course.findMany();
      const promotions = await prisma.promotion.findMany();
      const validPromotionIds = courses.map((data) => data.promotionId).filter((promotionId) => promotionId !== null);

      for (const promotionId of validPromotionIds) {
        const promotion = promotions.find((promotion) => promotion.id === promotionId);

        if (!promotion || new Date(promotion.endDate) < new Date()) {
          const coursesToUpdate = courses.filter((course) => course.promotionId === promotionId);

          for (const course of coursesToUpdate) {
            await prisma.course.update({
              where: { id: course.id },
              data: {
                price: course.price / (1 - promotion.discount),
                promotionId: null,
              },
            });
          }
        }
      }
    });
  },
  reminderUsers: () => {
    cron.schedule("0 0 1 */2 *", async function () {
      const enrollments = await prisma.enrollment.findMany();

      for (const enrollment of enrollments) {
        const lastAccess = new Date(enrollment.lastAccessed);
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        if (lastAccess < threeDaysAgo) {
          await prisma.notification.create({
            data: {
              title: "Reminder",
              message: "You haven't updated your progress in the last 3 days. Please continue learning.",
              userId: enrollment.userId,
              createdAt: formattedDate(new Date()),
              updatedAt: formattedDate(new Date()),
            },
          });
        }
      }
    });
  },
};
