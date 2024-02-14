const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { getPagination } = require("../utils/getPagination");
const { formattedDate } = require("../utils/formattedDate");
const imagekit = require("../libs/imagekit");

module.exports = {
  createCourse: catchAsync(async (req, res, next) => {
    try {
      const { price, isPremium, categoryId, promotionId, averageRating, totalDuration, createdAt, updatedAt } = req.body;
      const file = req.file;
      let imageURL;

      if (isPremium !== undefined || averageRating !== undefined || totalDuration !== undefined || !file || createdAt !== undefined || updatedAt !== undefined)
        throw new CustomError(400, "isPremium, averageRating, totalDuration, courseImg, createdAt, or updatedAt cannot be provided during course creation");

      // Calculate isPremium based on price
      const updatedIsPremium = Number(price) > 0 ? true : false;

      // Fetch category information
      const category = await prisma.category.findUnique({
        where: { id: Number(categoryId) },
      });

      // Handle if the category is not found
      if (!category) {
        throw new CustomError(404, "Category not found");
      }

      // Handle if the promotion is not found
      if (promotionId !== null && promotionId !== "null" && promotionId) {
        const promotion = await prisma.promotion.findUnique({
          where: { id: Number(promotionId) },
        });

        if (!promotion) throw new CustomError(404, "Promotion not found");
      }

      const finalPromotionId = updatedIsPremium ? (!promotionId || promotionId === "null" || promotionId === null ? null : promotionId) : null;

      if (file) {
        const strFile = file.buffer.toString("base64");

        const { url } = await imagekit.upload({
          fileName: Date.now() + path.extname(req.file.originalname),
          file: strFile,
        });

        imageURL = url;
      }

      // Create a new course using Prisma
      const newCourse = await prisma.course.create({
        data: {
          ...req.body,
          price: parseInt(price),
          isPremium: updatedIsPremium,
          courseImg: imageURL,
          promotionId: finalPromotionId,
          categoryId: Number(categoryId),
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      res.status(201).json({
        status: true,
        message: "create Course successful",
        data: { newCourse },
      });
    } catch (err) {
      next(err);
    }
  }),

  editCourse: catchAsync(async (req, res, next) => {
    try {
      const { idCourse } = req.params;

      const { courseName, level, aboutCourse, targetAudience, learningMaterial, mentor, videoURL, forumURL, price, isPremium, categoryId, promotionId, averageRating, totalDuration, createdAt, updatedAt } = req.body;
      const file = req.file;
      let imageURL;

      // Check if the course to be updated exists
      const course = await prisma.course.findUnique({
        where: {
          id: Number(idCourse),
        },
      });

      if (!course) throw new CustomError(404, `Course Not Found`);

      // Input validation
      if (
        courseName !== undefined ||
        level !== undefined ||
        aboutCourse !== undefined ||
        targetAudience !== undefined ||
        learningMaterial !== undefined ||
        mentor !== undefined ||
        videoURL !== undefined ||
        forumURL !== undefined ||
        price !== undefined ||
        isPremium !== undefined ||
        averageRating !== undefined ||
        totalDuration !== undefined ||
        createdAt !== undefined ||
        updatedAt !== undefined
      )
        throw new CustomError(
          400,
          "courseName, level, aboutCourse, targetAudience, learningMaterial, mentor, videoURL, forumURL, price, isPremium, averageRating, totalDuration, createdAt, or updatedAt cannot be provided during course update"
        );

      // Calculate isPremium based on price
      const updatedIsPremium = Number(price) > 0 ? true : false;

      // Fetch category information
      let category = await prisma.category.findUnique({
        where: { id: Number(categoryId) },
      });

      // Handle if the category is not found
      if (!category) {
        throw new CustomError(404, "Category not found");
      }

      // Handle if the promotion is not found
      if (promotionId !== null && promotionId !== "null" && promotionId) {
        const promotion = await prisma.promotion.findUnique({
          where: { id: Number(promotionId) },
        });

        if (!promotion) throw new CustomError(404, "Promotion not found");
      }

      const finalPromotionId = updatedIsPremium ? (!promotionId || promotionId === "null" || promotionId === null ? null : promotionId) : null;

      if (file) {
        const strFile = file.buffer.toString("base64");

        const { url } = await imagekit.upload({
          fileName: Date.now() + path.extname(req.file.originalname),
          file: strFile,
        });

        imageURL = url;
      }

      // Update the course using Prisma
      let editedCourse = await prisma.course.update({
        where: {
          id: Number(course.id),
        },
        data: {
          courseName,
          level,
          aboutCourse,
          targetAudience,
          learningMaterial,
          mentor,
          videoURL,
          forumURL,
          price: parseInt(price),
          isPremium: updatedIsPremium,
          courseImg: imageURL,
          promotionId: finalPromotionId,
          categoryId: Number(categoryId),
          updatedAt: formattedDate(new Date()),
        },
      });

      res.status(200).json({
        status: true,
        message: "Update Course successful",
        data: { editedCourse },
      });
    } catch (err) {
      next(err);
    }
  }),

  deleteCourse: catchAsync(async (req, res, next) => {
    const { idCourse } = req.params;

    // Check if the course to be updated exists
    const course = await prisma.course.findUnique({
      where: {
        id: Number(idCourse),
      },
    });

    if (!course) throw new CustomError(404, `Course Not Found`);

    // Delete the course using Prisma
    let deletedCourse = await prisma.course.delete({
      where: {
        id: Number(course.id),
      },
    });

    res.status(200).json({
      status: true,
      message: "delete Kelas successful",
      data: { deletedCourse },
    });
  }),

  detailCourse: catchAsync(async (req, res, next) => {
    const { idCourse } = req.params;

    // Retrieve detailed information about a course using Prisma
    const course = await prisma.course.findUnique({
      where: {
        id: Number(idCourse),
      },
      include: {
        promotion: {
          select: {
            discount: true,
          },
        },
        category: {
          select: {
            categoryName: true,
          },
        },
        chapter: {
          select: {
            id: true,
            name: true,
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
        enrollment: {
          where: {
            review: {
              OR: [{ userComment: null }, { userComment: { not: null } }],
            },
          },
          select: {
            review: {
              select: {
                id: true,
                userRating: true,
                userComment: true,
                createdAt: true,
              },
            },
          },
        },
        _count: {
          select: {
            chapter: true,
          },
        },
      },
    });

    if (!course) throw new CustomError(404, `Course Not Found`);

    // Modify object property count to modul
    course["modul"] = course._count.chapter;
    delete course["_count"];

    res.status(200).json({
      status: true,
      message: `Get Detail Course successful`,
      data: { course },
    });
  }),

  getCourse: catchAsync(async (req, res, next) => {
    try {
      const { search, f, c, l, page = 1, limit = 10 } = req.query;

      // Initialize an object to store query parameters for Prisma
      let coursesQuery = {
        where: {},
      };

      // Apply search filter if provided
      if (search) {
        coursesQuery.where.OR = [{ courseName: { contains: search, mode: "insensitive" } }, { mentor: { contains: search, mode: "insensitive" } }];
      }

      // Apply sorting/filtering based on filter parameter
      if (f) {
        coursesQuery.orderBy = [];
        if (f.includes("newest")) {
          coursesQuery.orderBy.push({ createdAt: "asc" });
        }
        if (f.includes("populer")) {
          coursesQuery.orderBy.push({ averageRating: "asc" });
        }
        if (f.includes("promo")) {
          coursesQuery.where.promotionId = { not: null };
        }
        if (f.includes("premium")) {
          coursesQuery.where.isPremium = true;
        }
        if (f.includes("free")) {
          coursesQuery.where.isPremium = false;
        }
      }

      // Apply filtering based on category if provided
      if (c) {
        const categories = Array.isArray(c) ? c.map((category) => category.toLowerCase()) : [c.toLowerCase()];
        coursesQuery.where.category = {
          categoryName: { in: categories, mode: "insensitive" },
        };
      }

      // Apply filtering based on level if provided
      if (l) {
        const levels = Array.isArray(l) ? l : [l];
        coursesQuery.where.level = { in: levels };
      }

      // Retrieve a list of courses with specified filters using Prisma
      let courses = await prisma.course.findMany({
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        where: coursesQuery.where,
        orderBy: coursesQuery.orderBy,
        include: {
          promotion: {
            select: {
              discount: true,
              startDate: true,
              endDate: true,
            },
          },
          category: {
            select: {
              categoryName: true,
            },
          },
          enrollment: {
            where: {
              review: {
                OR: [{ userComment: null }, { userComment: { not: null } }],
              },
            },
            select: {
              review: true,
            },
          },
        },
      });

      // Count total number of courses for pagination
      const totalCourses = await prisma.course.count({
        where: coursesQuery.where,
      });

      // Generate pagination information
      const pagination = getPagination(req, totalCourses, Number(page), Number(limit));

      res.status(200).json({
        status: true,
        message: "Courses retrieved successfully",
        data: { pagination, courses },
      });
    } catch (err) {
      next(err);
    }
  }),
};
