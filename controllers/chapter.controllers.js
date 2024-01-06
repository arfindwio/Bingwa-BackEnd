const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { formattedDate } = require("../utils/formattedDate");

// Controller for creating a new chapter
const createChapter = async (req, res, next) => {
  try {
    const { name, courseId, duration, createdAt, updatedAt } = req.body;

    // Input validation
    if (!name || !courseId || !duration) {
      return res.status(400).json({
        status: false,
        message: "Please provide name, courseId, and duration",
        data: null,
      });
    }

    // Ensure createdAt and updatedAt cannot be provided during chapter creation
    if (createdAt !== undefined || updatedAt !== undefined) {
      return res.status(400).json({
        status: false,
        message: "createdAt or updateAt cannot be provided during chapter creation",
        data: null,
      });
    }

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

    res.status(201).json({
      status: true,
      message: "Create Chapter Success",
      data: { newChapter },
    });
  } catch (error) {
    next(error);
  }
};

// Controller to get a list of chapters with search options
const getChapters = async (req, res, next) => {
  try {
    const { search } = req.query;

    // Retrieve a list of chapters with filtering based on search criteria
    const chapters = await prisma.chapter.findMany({
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

    res.status(200).json({
      status: true,
      message: "Get chapters success",
      data: { chapters },
    });
  } catch (err) {
    next(err);
  }
};

// Controller to get detailed information about a chapter based on ID
const getChapterById = async (req, res, next) => {
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
    if (!chapter) return res.status(404).json({ status: false, message: "chapter not found", data: null });

    res.status(200).json({
      status: true,
      message: "Get Detail chapter succes",
      data: { chapter },
    });
  } catch (error) {
    next(error);
  }
};

// Controller to update chapter information based on ID
const updateChapter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, courseId, duration, createdAt, updatedAt } = req.body;

    // Input validation
    if (!name || !courseId || !duration) {
      return res.status(400).json({
        status: false,
        message: "Please provide name, courseId, and duration",
        data: null,
      });
    }

    // Ensure createdAt and updatedAt cannot be provided during chapter update
    if (createdAt !== undefined || updatedAt !== undefined) {
      return res.status(400).json({
        status: false,
        message: "createdAt or updateAt cannot be provided during chapter update",
        data: null,
      });
    }

    // Check if the chapter to be updated exists
    const isExistChapter = await prisma.chapter.findUnique({
      where: {
        id: Number(id),
      },
    });

    // Handle if the chapter is not found
    if (!isExistChapter) return res.status(404).json({ status: false, message: "chapter not found", data: null });

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

    res.status(200).json({
      status: true,
      message: "Chapter updated success",
      data: { updatedChapter },
    });
  } catch (error) {
    next(error);
  }
};

// Controller to delete a chapter based on ID
const deleteChapter = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if the chapter to be deleted exists
    const isExistChapter = await prisma.chapter.findUnique({
      where: {
        id: Number(id),
      },
    });

    // Handle if the chapter is not found
    if (!isExistChapter) return res.status(404).json({ status: false, message: "chapter not found", data: null });

    // Delete the chapter using Prisma
    const deletedChapter = await prisma.chapter.delete({
      where: {
        id: Number(id),
      },
    });

    res.status(200).json({
      status: true,
      message: "Delete chpater success",
      data: { deletedChapter },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createChapter,
  getChapters,
  getChapterById,
  updateChapter,
  deleteChapter,
};
