const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  getAllEnrollment: catchAsync(async (req, res, next) => {
    try {
      // Retrieve all enrollments for the current user, including associated course details
      const enrollments = await prisma.enrollment.findMany({
        where: { userId: req.user.id },
        include: {
          review: {
            select: {
              userRating: true,
            },
          },
          course: {
            select: {
              courseName: true,
              level: true,
              mentor: true,
              totalDuration: true,
              courseImg: true,
              createdAt: true,
              categoryId: true,
              averageRating: true,
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
                      id: true,
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
  }),

  getEnrollmentByCourseId: catchAsync(async (req, res, next) => {
    try {
      const courseId = req.params.courseId;

      // Validate if enrollmentId is a number
      if (isNaN(courseId)) {
        throw new CustomError(400, "Invalid courseId provided");
      }

      // Retrieve details of the specified enrollment, including associated course details
      let enrollment = await prisma.enrollment.findFirst({
        where: { courseId: Number(courseId), userId: Number(req.user.id) },
        include: {
          course: {
            select: {
              averageRating: true,
              courseName: true,
              level: true,
              mentor: true,
              totalDuration: true,
              courseImg: true,
              createdAt: true,
              categoryId: true,
              aboutCourse: true,
              targetAudience: true,
              videoURL: true,
              forumURL: true,
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
                      id: true,
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
        throw new CustomError(404, "Enrollment not found");
      }

      return res.status(200).json({
        status: true,
        message: "Get enrollment by courseId successful",
        data: { enrollment },
      });
    } catch (err) {
      next(err);
    }
  }),

  courseEnrollment: catchAsync(async (req, res, next) => {
    try {
      const { courseId } = req.params;

      // Validate if courseId is a number
      if (isNaN(courseId)) {
        throw new CustomError(400, "Invalid courseId provided");
      }

      // Check if the course exists
      const course = await prisma.course.findUnique({
        where: {
          id: Number(courseId),
        },
      });

      // Return an error if the course is not found
      if (!course) throw new CustomError(404, `Course not found`);

      // Check if the user is already enrolled in the course
      const existsEnrollment = await prisma.enrollment.findFirst({
        where: {
          courseId: Number(courseId),
          userId: Number(req.user.id),
        },
      });

      // Return an error if the user is already enrolled
      if (existsEnrollment) {
        throw new CustomError(400, "User already enrolled in this course");
      }

      // Return an error if the course is premium
      if (course.isPremium) {
        throw new CustomError(400, "This course is premium. You must pay before enrolling.");
      }

      // Create a new enrollment record for the user
      const enrollCourse = await prisma.enrollment.create({
        data: {
          userId: Number(req.user.id),
          courseId: Number(courseId),
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
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
      await Promise.all(
        lessons.map(async (lesson) => {
          return await prisma.tracking.create({
            data: {
              userId: Number(req.user.id),
              lessonId: lesson.id,
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
          updatedAt: formattedDate(new Date()),
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
              updatedAt: formattedDate(new Date()),
            },
          });
        }
      }, 3 * 24 * 60 * 60 * 1000);

      res.status(201).json({
        status: true,
        message: "Success to enroll in the course",
        data: { enrollCourse },
      });
    } catch (err) {
      next(err);
    }
  }),

  enrollmentPreparation: catchAsync(async (req, res, next) => {
    try {
      const { courseId } = req.params;

      // Validate if courseId is a number
      if (isNaN(courseId)) {
        throw new CustomError(400, "Invalid courseId provided");
      }

      // Check if the course exists
      const course = await prisma.course.findUnique({
        where: {
          id: Number(courseId),
        },
      });

      // Return an error if the course is not found
      if (!course) throw new CustomError(404, `Course not found`);

      const enrollment = await prisma.enrollment.findFirst({
        where: {
          courseId: Number(course.id),
          userId: Number(req.user.id),
        },
      });

      if (!enrollment) throw new CustomError(404, `Enrollment not found`);

      const updatedEnrollment = await prisma.enrollment.update({
        where: {
          id: Number(enrollment.id),
          courseId: Number(course.id),
          userId: Number(req.user.id),
        },
        data: {
          preparationCheck: true,
          updatedAt: formattedDate(new Date()),
        },
      });

      res.status(201).json({
        status: true,
        message: "Success to enroll in the course",
        data: { updatedEnrollment },
      });
    } catch (err) {
      next(err);
    }
  }),
};
