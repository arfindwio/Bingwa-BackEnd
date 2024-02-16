const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");
const { getPagination } = require("../utils/getPagination");

// Controller for creating a new chapter
const createChapter = catchAsync(async (req, res, next) => {
  try {
    const { name, courseId, duration } = req.body;

    // Input validation
    if (!name || !courseId || !duration) throw new CustomError(400, "Please provide name, courseId, and duration");

    // Ensure createdAt and updatedAt cannot be provided during chapter creation
    if (req.body.createdAt !== undefined || req.body.updatedAt !== undefined) throw new CustomError(400, "createdAt or updatedAt cannot be provided during chapter creation");

    // Create a new chapter using Prisma
    const newChapter = await prisma.chapter.create({
      data: {
        name,
        courseId,
        duration,
        createdAt: formattedDate(new Date()),
        updatedAt: formattedDate(new Date()),
      },
    });

    const chapters = await prisma.chapter.findMany({
      where: { courseId: Number(courseId) },
    });

    const totalDuration = chapters.reduce((sum, chapter) => sum + chapter.duration, 0);

    const updatedcourse = await prisma.course.update({
      where: { id: Number(courseId) },
      data: {
        totalDuration: parseInt(totalDuration),
      },
    });

    res.status(201).json({
      status: true,
      message: "Create Chapter Success",
      data: { newChapter },
    });
  } catch (err) {
    next(err);
  }
});

// Controller to get a list of chapters with search options
const getChapters = catchAsync(async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    // Retrieve a list of chapters with filtering based on search criteria
    const chapters = await prisma.chapter.findMany({
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      where: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { lesson: { some: { lessonName: { contains: search, mode: "insensitive" } } } },
          { course: { courseName: { contains: search, mode: "insensitive" } } },
          { course: { category: { categoryName: { contains: search, mode: "insensitive" } } } },
        ],
      },
      include: {
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
        lesson: {
          select: {
            lessonName: true,
            videoURL: true,
            createdAt: true,
          },
        },
      },
    });

    const totalChapters = await prisma.chapter.count({
      where: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { lesson: { some: { lessonName: { contains: search, mode: "insensitive" } } } },
          { course: { courseName: { contains: search, mode: "insensitive" } } },
          { course: { category: { categoryName: { contains: search, mode: "insensitive" } } } },
        ],
      },
    });

    // Generate pagination information
    const pagination = getPagination(req, totalChapters, Number(page), Number(limit));

    res.status(200).json({
      status: true,
      message: "Get chapters success",
      data: { pagination, chapters },
    });
  } catch (err) {
    next(err);
  }
});

// Controller to get detailed information about a chapter based on ID
const getChapterById = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    // Retrieve a chapter based on ID with additional information about lessons
    const chapter = await prisma.chapter.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        lesson: {
          select: {
            lessonName: true,
            videoURL: true,
            createdAt: true,
          },
        },
      },
    });

    // Handle if the chapter is not found
    if (!chapter) throw new CustomError(404, "Chapter not found");

    res.status(200).json({
      status: true,
      message: "Get Detail chapter success",
      data: { chapter },
    });
  } catch (err) {
    next(err);
  }
});

// Controller to update chapter information based on ID
const updateChapter = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, courseId, duration } = req.body;

    // Input validation
    if (!name || !courseId || !duration) throw new CustomError(400, "Please provide name, courseId, and duration");

    // Ensure createdAt and updatedAt cannot be provided during chapter update
    if (req.body.createdAt !== undefined || req.body.updatedAt !== undefined) throw new CustomError(400, "createdAt or updatedAt cannot be provided during chapter update");

    // Check if the chapter to be updated exists
    const isExistChapter = await prisma.chapter.findUnique({
      where: {
        id: Number(id),
      },
    });

    // Handle if the chapter is not found
    if (!isExistChapter) throw new CustomError(404, "Chapter not found");

    // Perform the chapter update using Prisma
    const updatedChapter = await prisma.chapter.update({
      where: {
        id: Number(id),
      },
      data: {
        ...req.body,
        updatedAt: formattedDate(new Date()),
      },
    });

    const chapters = await prisma.chapter.findMany({
      where: { courseId: Number(updatedChapter.courseId) },
    });

    // Calculate the new average rating for the course
    const totalDuration = chapters.reduce((sum, chapter) => sum + chapter.duration, 0);

    const updatedcourse = await prisma.course.update({
      where: { id: Number(updatedChapter.courseId) },
      data: {
        totalDuration: parseInt(totalDuration),
      },
    });

    res.status(200).json({
      status: true,
      message: "Chapter updated success",
      data: { updatedChapter, updatedcourse },
    });
  } catch (err) {
    next(err);
  }
});

// Controller to delete a chapter based on ID
const deleteChapter = catchAsync(async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if the chapter to be deleted exists
    const isExistChapter = await prisma.chapter.findUnique({
      where: {
        id: Number(id),
      },
    });

    // Handle if the chapter is not found
    if (!isExistChapter) throw new CustomError(404, "Chapter not found");

    // Delete the chapter using Prisma
    const deletedChapter = await prisma.chapter.delete({
      where: {
        id: Number(id),
      },
    });

    res.status(200).json({
      status: true,
      message: "Delete chapter success",
      data: { deletedChapter },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  createChapter,
  getChapters,
  getChapterById,
  updateChapter,
  deleteChapter,
};
