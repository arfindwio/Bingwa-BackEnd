const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");

const findChapterById = catchAsync(async (chapterId) => {
  return await prisma.chapter.findUnique({
    where: { id: Number(chapterId) },
  });
});

const findLessonById = catchAsync(async (lessonId) => {
  return await prisma.lesson.findUnique({
    where: { id: Number(lessonId) },
    include: {
      chapter: {
        select: {
          name: true,
        },
      },
    },
  });
});

const createLesson = catchAsync(async (req, res, next) => {
  const { lessonName, videoURL, chapterId, createdAt, updatedAt } = req.body;

  try {
    // Validate the presence of required fields
    if (!lessonName || !videoURL || !chapterId) {
      throw new CustomError(400, "Please provide lessonName, videoURL, and chapterId");
    }

    // Validate the absence of createdAt or updatedAt during lesson creation
    if (createdAt !== undefined || updatedAt !== undefined) {
      throw new CustomError(400, "createdAt or updateAt cannot be provided during lesson creation");
    }

    // Check if the specified chapter exists
    const chapter = await findChapterById(chapterId);

    // Return an error if the chapter is not found
    if (!chapter) {
      throw new CustomError(404, "Chapter not found");
    }

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
    const trackingRecords = await Promise.all(
      enrollments.map(async (enrollment) => {
        return prisma.tracking.create({
          data: {
            userId: Number(enrollment.userId),
            lessonId: Number(newLesson.id),
            courseId: Number(chapter.courseId),
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

    // Update Progres when create lesson
    const findLesson = await prisma.tracking.findMany({
      where: {
        courseId: chapter.courseId,
        userId: { in: users.map((user) => user.id) },
      },
      select: {
        courseId: true,
        lessonId: true,
        lesson: true,
        userId: true,
        status: true,
      },
    });
    const updateProgres = await Promise.all(
      enrollments.map(async (enrollment) => {
        let lessonLength;
        let lessonTrue = 0;
        let newProgres;
        let lesson = findLesson.filter((val) => {
          if (val.courseId == enrollment.courseId && val.userId == enrollment.userId) {
            return true;
          }
        });
        lessonLength = lesson.length;
        lessonTrue = lesson.filter((val) => {
          return val.status == true;
        }).length;
        newProgres = (lessonTrue / lessonLength) * 100;
        return prisma.enrollment.update({
          where: {
            id: enrollment.id,
          },
          data: {
            progres: newProgres.toFixed(1),
          },
        });
      })
    );
    // End Update Progres when create lesson

    res.status(201).json({
      status: true,
      message: "Lesson created successfully",
      data: { newLesson },
    });
  } catch (err) {
    next(err);
  }
});

const getAllLessons = catchAsync(async (req, res, next) => {
  const { search } = req.query;

  try {
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
});

const getDetailLesson = catchAsync(async (req, res, next) => {
  const lessonId = req.params.id;

  try {
    // Retrieve details of the specified lesson, including associated chapter details
    const lesson = await findLessonById(lessonId);

    // Return an error if the lesson is not found
    if (!lesson) {
      throw new CustomError(404, "Lesson not found");
    }

    res.status(200).json({
      status: true,
      message: "Get detail lesson successful",
      data: { lesson },
    });
  } catch (err) {
    next(err);
  }
});

const updateDetailLesson = catchAsync(async (req, res, next) => {
  const lessonId = req.params.id;
  const { lessonName, videoURL, chapterId, createdAt, updatedAt } = req.body;

  try {
    // Validate the presence of required fields
    if (!lessonName || !videoURL || !chapterId) {
      throw new CustomError(400, "Please provide lessonName, videoURL, and chapterId");
    }

    // Validate the absence of createdAt or updatedAt during lesson update
    if (createdAt !== undefined || updatedAt !== undefined) {
      throw new CustomError(400, "createdAt or updateAt cannot be provided during lesson update");
    }

    // Retrieve details of the specified lesson
    const lesson = await findLessonById(lessonId);

    // Return an error if the lesson is not found
    if (!lesson) {
      throw new CustomError(404, "Lesson not found");
    }

    // Check if the specified chapter exists
    const chapter = await findChapterById(chapterId);

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
});

const deleteLessonById = catchAsync(async (req, res, next) => {
  const lessonId = req.params.id;

  try {
    // Retrieve details of the specified lesson
    const lesson = await findLessonById(lessonId);

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
});

const filterLesson = catchAsync(async (req, res, next) => {
  const { chapter, lesson, course } = req.query;

  try {
    // Check if any of the filter parameters is provided
    if (chapter || lesson || course) {
      // Perform a search based on the provided filters
      let filterLesson = await prisma.lesson.findMany({
        where: {
          OR: [
            {
              lessonName: {
                contains: lesson,
                mode: "insensitive",
              },
            },
            {
              chapter: {
                name: {
                  contains: chapter,
                  mode: "insensitive",
                },
              },
            },
            {
              chapter: {
                course: {
                  courseName: {
                    contains: course,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
        include: {
          chapter: {
            include: {
              course: {
                select: {
                  courseName: true,
                },
              },
            },
          },
        },
      });
      return res.status(200).json({
        status: true,
        message: "Success Filter Or Search Video",
        data: filterLesson,
      });
    }
    res.status(400).json({
      status: false,
      message: "Bad Request",
      data: null,
    });
  } catch (err) {
    next(err);
  }
});

const showLessonByCourse = catchAsync(async (req, res, next) => {
  const { idCourse } = req.params;

  try {
    // Find the course with the specified ID
    const findCourse = await prisma.course.findFirst({
      where: {
        id: Number(idCourse),
      },
    });

    // Return an error if the course is not found
    if (!findCourse) {
      throw new CustomError(404, `Course Not Found With Id ${idCourse}`);
    }

    // Retrieve all chapters and associated lessons for the specified course
    let filterLesson = await prisma.chapter.findMany({
      where: {
        courseId: Number(idCourse),
      },
      include: {
        lesson: {
          select: {
            lessonName: true,
            videoURL: true,
          },
        },
      },
    });
    res.status(200).json({
      status: true,
      message: "Show All Video in Course",
      data: filterLesson,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  createLesson,
  getAllLessons,
  getDetailLesson,
  updateDetailLesson,
  deleteLessonById,
  filterLesson,
  showLessonByCourse,
};
