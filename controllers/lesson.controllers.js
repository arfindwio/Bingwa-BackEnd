const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");

let reminderTimeout;

module.exports = {
  createLesson: catchAsync(async (req, res, next) => {
    try {
      const { lessonName, videoURL, chapterId, createdAt, updatedAt } = req.body;

      // Validate the presence of required fields
      if (!lessonName || !videoURL || !chapterId) {
        throw new CustomError(400, "Please provide lessonName, videoURL, and chapterId");
      }

      // Validate the absence of createdAt or updatedAt during lesson creation
      if (createdAt !== undefined || updatedAt !== undefined) {
        throw new CustomError(400, "createdAt or updateAt cannot be provided during lesson creation");
      }

      // Check if the specified chapter exists
      const chapter = await prisma.chapter.findUnique({
        where: { id: Number(chapterId) },
      });

      // Return an error if the chapter is not found
      if (!chapter) throw new CustomError(404, "Chapter not found");

      // Retrieve all users and enrollments associated with the chapter's course
      const users = await prisma.user.findMany();

      const enrollments = await prisma.enrollment.findMany({
        where: {
          userId: { in: users.map((user) => user.id) },
          courseId: chapter.courseId,
        },
      });

      // Create a new lesson record
      const newLesson = await prisma.lesson.create({
        data: {
          lessonName,
          videoURL,
          chapterId,
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      // Create tracking records for each enrollment to monitor user progress
      await Promise.all(
        enrollments.map(async (enrollment) => {
          const tracking = await prisma.tracking.create({
            data: {
              userId: Number(enrollment.userId),
              lessonId: Number(newLesson.id),
              status: false,
              createdAt: formattedDate(new Date()),
              updatedAt: formattedDate(new Date()),
            },
          });

          const allTracking = await prisma.tracking.findMany({
            where: {
              userId: Number(enrollment.userId),
              lesson: {
                chapter: {
                  courseId: chapter.courseId,
                },
              },
            },
          });

          const trueCount = allTracking.filter((item) => item.status === true).length;
          const falseCount = allTracking.filter((item) => item.status === false).length;
          const updatedProgress = trueCount / allTracking.length;

          // Update the enrollment progress
          const updatedEnrollment = await prisma.enrollment.update({
            where: {
              id: Number(enrollment.id),
            },
            data: {
              progress: updatedProgress,
            },
          });

          if (reminderTimeout) {
            clearTimeout(reminderTimeout);
          }

          // Schedule a progress update reminder if there are incomplete lessons
          if (falseCount > 0) {
            reminderTimeout = setTimeout(async () => {
              const latestTrueTracking = allTracking
                .filter((item) => item.status === true)
                .reduce(
                  (latest, current) => (new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? current : latest),
                  { updatedAt: 0 } // Provide an initial value with a timestamp of 0
                );

              const lastUpdate = new Date(latestTrueTracking.updatedAt).getTime();
              const currentTime = new Date().getTime();
              const timeDifference = currentTime - lastUpdate;

              // Send a reminder notification if no progress update in the last 3 days
              if (timeDifference >= 3 * 24 * 60 * 60 * 1000) {
                return prisma.notification.create({
                  data: {
                    title: "Reminder",
                    message: "You haven't updated your progress in the last 3 days. Please continue learning.",
                    userId: Number(enrollment.userId),
                    createdAt: formattedDate(new Date()),
                  },
                });
              }
            }, 3 * 24 * 60 * 60 * 1000);
          }
          return { tracking, updatedEnrollment };
        })
      );

      res.status(201).json({
        status: true,
        message: "Lesson created successfully",
        data: { newLesson },
      });
    } catch (err) {
      next(err);
    }
  }),

  getAllLessons: catchAsync(async (req, res, next) => {
    try {
      const { search } = req.query;

      // Retrieve all lessons based on the search criteria
      const lessons = await prisma.lesson.findMany({
        where: {
          OR: [
            { lessonName: { contains: search, mode: "insensitive" } },
            { chapter: { name: { contains: search, mode: "insensitive" } } },
            {
              chapter: {
                course: { courseName: { contains: search, mode: "insensitive" } },
              },
            },
            {
              chapter: {
                course: {
                  category: {
                    categoryName: { contains: search, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        },
        include: {
          chapter: {
            select: {
              name: true,
              course: {
                select: {
                  id: true,
                  courseName: true,
                  category: {
                    select: {
                      categoryName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      res.status(200).json({
        status: true,
        message: "Get all lessons successful",
        data: { lessons },
      });
    } catch (err) {
      next(err);
    }
  }),

  updateLessonById: catchAsync(async (req, res, next) => {
    try {
      const lessonId = req.params.id;
      const { lessonName, videoURL, chapterId, createdAt, updatedAt } = req.body;

      // Validate the presence of required fields
      if (!lessonName || !videoURL || !chapterId) {
        throw new CustomError(400, "Please provide lessonName, videoURL, and chapterId");
      }

      // Validate the absence of createdAt or updatedAt during lesson update
      if (createdAt !== undefined || updatedAt !== undefined) {
        throw new CustomError(400, "createdAt or updateAt cannot be provided during lesson update");
      }

      // Retrieve details of the specified lesson
      const lesson = await prisma.lesson.findUnique({
        where: { id: Number(lessonId) },
        include: {
          chapter: {
            select: {
              name: true,
            },
          },
        },
      });

      // Return an error if the lesson is not found
      if (!lesson) {
        throw new CustomError(404, "Lesson not found");
      }

      // Check if the specified chapter exists
      const chapter = await prisma.chapter.findUnique({
        where: { id: Number(chapterId) },
      });

      // Return an error if the chapter is not found
      if (!chapter) {
        throw new CustomError(404, "Chapter not found");
      }

      // Update details of the specified lesson
      const updatedLesson = await prisma.lesson.update({
        where: { id: Number(lessonId) },
        data: {
          lessonName,
          videoURL,
          chapterId,
          updatedAt: formattedDate(new Date()),
        },
      });

      res.status(200).json({
        status: true,
        message: "Lesson updated successfully",
        data: { updatedLesson },
      });
    } catch (err) {
      next(err);
    }
  }),

  deleteLessonById: catchAsync(async (req, res, next) => {
    try {
      const lessonId = req.params.id;

      // Retrieve details of the specified lesson
      const lesson = await prisma.lesson.findUnique({
        where: { id: Number(lessonId) },
        include: {
          chapter: {
            select: {
              name: true,
            },
          },
        },
      });

      // Return an error if the lesson is not found
      if (!lesson) {
        throw new CustomError(404, "Lesson not found");
      }

      // Delete the specified lesson
      const deletedLesson = await prisma.lesson.delete({
        where: { id: Number(lessonId) },
      });

      res.status(200).json({
        status: true,
        message: "Lesson deleted successfully",
        data: { deletedLesson },
      });
    } catch (err) {
      next(err);
    }
  }),

  // filterLesson: catchAsync(async (req, res, next) => {
  //   try {
  //     const { chapter, lesson, course } = req.query;

  //     // Check if any of the filter parameters is provided
  //     if (chapter || lesson || course) {
  //       // Perform a search based on the provided filters
  //       let filterLesson = await prisma.lesson.findMany({
  //         where: {
  //           OR: [
  //             {
  //               lessonName: {
  //                 contains: lesson,
  //                 mode: "insensitive",
  //               },
  //             },
  //             {
  //               chapter: {
  //                 name: {
  //                   contains: chapter,
  //                   mode: "insensitive",
  //                 },
  //               },
  //             },
  //             {
  //               chapter: {
  //                 course: {
  //                   courseName: {
  //                     contains: course,
  //                     mode: "insensitive",
  //                   },
  //                 },
  //               },
  //             },
  //           ],
  //         },
  //         include: {
  //           chapter: {
  //             include: {
  //               course: {
  //                 select: {
  //                   courseName: true,
  //                 },
  //               },
  //             },
  //           },
  //         },
  //       });
  //       return res.status(200).json({
  //         status: true,
  //         message: "Success Filter Or Search Video",
  //         data: filterLesson,
  //       });
  //     }
  //     res.status(400).json({
  //       status: false,
  //       message: "Bad Request",
  //       data: null,
  //     });
  //   } catch (err) {
  //     next(err);
  //   }
  // });

  getAllLessonByCourseId: catchAsync(async (req, res, next) => {
    try {
      const courseId = req.params.courseId;

      // Find the course with the specified ID
      const course = await prisma.course.findFirst({
        where: {
          id: Number(courseId),
        },
      });

      // Return an error if the course is not found
      if (!course) {
        throw new CustomError(404, `Course Not Found`);
      }

      // Retrieve all  and associated lessons for the specified course
      let lessons = await prisma.lesson.findMany({
        where: {
          chapter: {
            course: {
              id: Number(course.id),
            },
          },
        },
      });

      res.status(200).json({
        status: true,
        message: "Show All Video in Course",
        data: { lessons },
      });
    } catch (err) {
      next(err);
    }
  }),
};
