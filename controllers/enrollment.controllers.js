const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  // Controller for handling course enrollment
  courseEnrollment: async (req, res, next) => {
    try {
      const { courseId } = req.params;

      // Validate if courseId is a number
      if (isNaN(courseId)) {
        return res.status(400).json({
          status: false,
          message: "Invalid courseId provided",
          data: null,
        });
      }

      // Check if the course exists
      const course = await prisma.course.findUnique({
        where: {
          id: Number(courseId),
        },
      });

      // Return an error if the course is not found
      if (!course) {
        return res.status(404).json({
          status: false,
          message: `Course not found with id ${courseId}`,
          data: null,
        });
      }

      // Check if the user is already enrolled in the course
      const statusEnrollUser = await prisma.enrollment.findFirst({
        where: {
          courseId: Number(courseId),
          userId: Number(req.user.id),
        },
      });

      // Return an error if the user is already enrolled
      if (statusEnrollUser) {
        return res.status(400).json({
          status: false,
          message: `User Alrady Enroll this Course`,
          data: null,
        });
      }

      // Return an error if the course is premium
      if (course.isPremium) {
        return res.status(400).json({
          status: false,
          message: "This course is premium. You must pay before enrolling.",
          data: null,
        });
      }

      // Create a new enrollment record for the user
      let enrollCourse = await prisma.enrollment.create({
        data: {
          userId: Number(req.user.id),
          courseId: Number(courseId),
          createdAt: formattedDate(new Date()),
        },
      });

      // Retrieve lessons associated with the course
      const lessons = await prisma.lesson.findMany({
        where: {
          chapter: {
            courseId: Number(courseId),
          },
        },
      });

      // Create tracking records for each lesson to monitor user progress
      const trackingRecords = await Promise.all(
        lessons.map(async (lesson) => {
          return prisma.tracking.create({
            data: {
              userId: Number(req.user.id),
              lessonId: lesson.id,
              courseId: Number(courseId),
              status: false,
              createdAt: formattedDate(new Date()),
              updatedAt: formattedDate(new Date()),
            },
            include: {
              lesson: {
                select: {
                  lessonName: true,
                },
              },
            },
          });
        })
      );

      await prisma.notification.create({
        data: {
          title: "Notification",
          message: "You have successfully enrolled in the course",
          userId: Number(req.user.id),
          createdAt: formattedDate(new Date()),
        },
      });

      // Schedule a reminder notification if user has incomplete lessons after 24 hours
      setTimeout(async () => {
        const allTracking = await prisma.tracking.findMany({
          where: { userId: Number(req.user.id), status: true },
        });

        if (allTracking.length === 0 || !allTracking[0].status) {
          await prisma.notification.create({
            data: {
              title: "Reminder",
              message: "You have incomplete lessons. Please continue your learning.",
              userId: Number(req.user.id),
              createdAt: formattedDate(new Date()),
            },
          });
        }
      }, 24 * 60 * 60 * 1000);

      res.status(201).json({
        status: true,
        message: "Succes To Enroll Course",
        data: { enrollCourse },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for retrieving all enrollments of the current user
  getAllEnrollment: async (req, res, next) => {
    try {
      // Retrieve all enrollments for the current user, including associated course details
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: req.user.id },
        include: {
          course: {
            select: {
              courseName: true,
              level: true,
              mentor: true,
              duration: true,
              courseImg: true,
              createdAt: true,
              categoryId: true,
              category: {
                select: {
                  categoryName: true,
                },
              },
              chapter: {
                select: {
                  id: true,
                  name: true,
                  createdAt: true,
                  duration: true,
                  lesson: {
                    select: {
                      lessonName: true,
                      videoURL: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      return res.status(200).json({
        status: true,
        message: "Get all enrollments successful",
        data: { enrollments },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for retrieving details of a specific enrollment
  getDetailEnrollment: async (req, res, next) => {
    try {
      const enrollmentId = req.params.id;

      // Validate if enrollmentId is a number
      if (isNaN(enrollmentId)) {
        return res.status(400).json({
          status: false,
          message: "Invalid enrollmentId provided",
          data: null,
        });
      }

      // Retrieve details of the specified enrollment, including associated course details
      let enrollment = await prisma.enrollment.findUnique({
        where: { id: Number(enrollmentId) },
        include: {
          course: {
            select: {
              courseName: true,
              level: true,
              mentor: true,
              duration: true,
              courseImg: true,
              createdAt: true,
              categoryId: true,
              category: {
                select: {
                  categoryName: true,
                },
              },
              chapter: {
                select: {
                  id: true,
                  name: true,
                  createdAt: true,
                  duration: true,
                  lesson: {
                    select: {
                      lessonName: true,
                      videoURL: true,
                      createdAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Return an error if the enrollment is not found
      if (!enrollment) {
        return res.status(404).json({
          status: false,
          message: "Enrollment not found",
          data: null,
        });
      }

      return res.status(200).json({
        status: true,
        message: "Get detail enrollment successful",
        data: { enrollment },
      });
    } catch (err) {
      next(err);
    }
  },
};
