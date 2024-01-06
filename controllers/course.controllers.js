const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { getPagination } = require("../utils/getPagination");
const { formattedDate } = require("../utils/formattedDate");

module.exports = {
  // Controller for creating a new course
  createCourse: async (req, res, next) => {
    try {
      const {
        price,
        isPremium,
        categoryId,
        promotionId,
        averageRating,
        createdAt,
        updatedAt,
      } = req.body;

      if (
        isPremium !== undefined ||
        averageRating !== undefined ||
        createdAt !== undefined ||
        updatedAt !== undefined
      ) {
        return res.status(400).json({
          status: false,
          message:
            "isPremium, averageRating, createdAt, or updateAt cannot be provided during course creation",
          data: null,
        });
      }

      // Calculate isPremium based on price
      const updatedIsPremium = price > 0 ? true : false;

      // Fetch category information
      let category = await prisma.category.findUnique({
        where: { id: Number(categoryId) },
      });

      // Handle if the category is not found
      if (!category) {
        return res.status(404).json({
          status: false,
          message: "Category not found",
          data: null,
        });
      }

      // Fetch promotion information if provided
      if (promotionId) {
        promotion = await prisma.promotion.findUnique({
          where: { id: Number(promotionId) },
        });

        // Handle if the promotion is not found
        if (!promotion) {
          return res.status(404).json({
            status: false,
            message: "Promotion not found",
            data: null,
          });
        }
      }

      // Create a new course using Prisma
      let newCourse = await prisma.course.create({
        data: {
          ...req.body,
          isPremium: updatedIsPremium,
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      return res.status(201).json({
        status: true,
        message: "create Kelas successful",
        data: { newCourse },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for updating course information
  editCourse: async (req, res, next) => {
    try {
      const { idCourse } = req.params;

      const { price, isPremium, averageRating, createdAt, updatedAt } =
        req.body;

      // Check if the course to be updated exists
      const checkCourse = await prisma.course.findFirst({
        where: {
          id: Number(idCourse),
        },
      });
      if (!checkCourse) {
        return res.status(404).json({
          status: false,
          message: `Course Not Found With Id ${idCourse}`,
          data: null,
        });
      }

      // Input validation
      if (
        isPremium !== undefined ||
        averageRating !== undefined ||
        createdAt !== undefined ||
        updatedAt !== undefined
      ) {
        return res.status(400).json({
          status: false,
          message:
            "isPremium, averageRating, createdAt, or updateAt cannot be provided during course update",
          data: null,
        });
      }

      // Calculate isPremium based on price
      const updatedIsPremium = price > 0 ? true : false;

      // Update the course using Prisma
      let editedCourse = await prisma.course.update({
        where: {
          id: Number(idCourse),
        },
        data: {
          ...req.body,
          isPremium: updatedIsPremium,
          updatedAt: formattedDate(new Date()),
        },
      });

      return res.status(200).json({
        status: true,
        message: "Update Kelas successful",
        data: { editedCourse },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for deleting a course
  deleteCourse: async (req, res, next) => {
    try {
      const { idCourse } = req.params;

      // Delete the course using Prisma
      let deletedCourse = await prisma.course.delete({
        where: {
          id: Number(idCourse),
        },
      });

      res.status(200).json({
        status: true,
        message: "delete Kelas successful",
        data: { deletedCourse },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for retrieving detailed information about a course
  detailCourse: async (req, res, next) => {
    try {
      const { idCourse } = req.params;

      // Check if the course exists
      const checkCourse = await prisma.course.findFirst({
        where: {
          id: Number(idCourse),
        },
      });
      if (!checkCourse) {
        return res.status(404).json({
          status: false,
          message: `Course Not Found With Id ${idCourse}`,
          data: null,
        });
      }

      // Retrieve detailed information about a course using Prisma
      const course = await prisma.course.findUnique({
        where: {
          id: Number(idCourse),
        },
        include: {
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
            where:{
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

      // Modify object property count to modul
      course["modul"] = course._count.chapter;
      delete course["_count"];
      res.status(200).json({
        status: true,
        message: ` Detail Kelas with id:${idCourse} successful`,
        data: { course },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for retrieving the courses enrolled by the user
  getMyCourse: async (req, res, next) => {
    try {
      const { id } = req.user;
      const {
        search,
        filter,
        category,
        level,
        page = 1,
        limit = 10,
      } = req.query;

      // Count the number of courses the user is enrolled in
      const countEnrollCourse = await prisma.course.count({
        where: {
          enrollment: {
            some: {
              userId: {
                equals: Number(id),
              },
            },
          },
        },
      });

      // Calculate pagination
      const pagination = getPagination(
        req,
        countEnrollCourse,
        Number(page),
        Number(limit)
      );

      // Query parameters for fetching enrolled courses
      let coursesQuery = {
        where: {},
      };

      // Search filter
      if (search) {
        coursesQuery.where.OR = [
          { courseName: { contains: search, mode: "insensitive" } },
          { mentor: { contains: search, mode: "insensitive" } },
        ];
      }

      // Sorting filter
      if (filter) {
        coursesQuery.orderBy = [];
        if (filter.includes("newest")) {
          coursesQuery.orderBy.push({ createdAt: "desc" });
        }
        if (filter.includes("populer")) {
          coursesQuery.orderBy.push({ averageRating: "desc" });
        }
        if (filter.includes("promo")) {
          coursesQuery.where.promotionId = { not: null };
        }
        if (filter.includes("premium")) {
          coursesQuery.where.isPremium = true;
        }
        if (filter.includes("free")) {
          coursesQuery.where.isPremium = false;
        }
      }

      // Category filter
      if (category) {
        const categories = Array.isArray(category)
          ? category.map((c) => c.toLowerCase())
          : [category.toLowerCase()];
        coursesQuery.where.category = {
          categoryName: { in: categories, mode: "insensitive" },
        };
      }

      // Level filter
      if (level) {
        const levels = Array.isArray(level) ? level : [level];
        coursesQuery.where.level = { in: levels };
      }

      // Fetch courses not enrolled by the user
      let courseNotEnrol = await prisma.course.findMany({
        // skip: (Number(page) - 1) * Number(limit),
        // take: Number(limit),
        where: {
          enrollment: {
            none: {
              userId: {
                equals: Number(id),
              },
            },
          },
          ...coursesQuery.where,
        },
        select: {
          id: true,
          courseName: true,
          mentor: true,
          averageRating: true,
          duration: true,
          level: true,
          courseImg:true,
          price: true,
          isPremium: true,
          category: {
            select: {
              id: true,
              categoryName: true,
            },
          },
          _count: {
            select: {
              chapter: true,
            },
          },
        },
      });

      // Fetch enrolled courses with additional information
      let course = await prisma.course.findMany({
        // skip: (Number(page) - 1) * Number(limit),
        // take: Number(limit),
        where: {
          enrollment: {
            some: {
              userId: {
                equals: Number(id),
              },
            },
          },
          ...coursesQuery.where,
        },
        select: {
          id: true,
          courseName: true,
          mentor: true,
          averageRating: true,
          courseImg:true,
          duration: true,
          level: true,
          price: true,
          isPremium: true,
          category: {
            select: {
              id: true,
              categoryName: true,
            },
          },
          enrollment: {
            where: {
              userId: Number(req.user.id),
            },
            select: {
              id: true,
              progres: true,
            },
          },
          _count: {
            select: {
              chapter: true,
            },
          },
        },
      });

      // Modify object property count to modul
      course = course.map((val) => {
        val.enrollment = val.enrollment[0];
        val.modul = val._count.chapter;
        val.statusEnrol = true;
        delete val["_count"];
        return val;
      });

      // Modify object property count to modul for not enrolled courses
      courseNotEnrol = courseNotEnrol.map((val) => {
        val.modul = val._count.chapter;
        val.statusEnrol = false;
        delete val["_count"];
        return val;
      });

      res.json({
        status: true,
        message: "Success",
        data: { course, courseNotEnrol },
      });
    } catch (error) {
      next(error);
    }
  },

  // Controller for retrieving detailed information about a user's enrolled course
  detailMyCourse: async (req, res, next) => {
    try {
      const { idCourse } = req.params;

      // Check if the user is enrolled in the course
      const findCourse = await prisma.enrollment.findFirst({
        where: {
          courseId: Number(idCourse),
          userId: req.user.id,
        },
      });
      if (!findCourse) {
        return res.status(400).json({
          status: false,
          message: "You Not Enroll this course ",
          data: null,
        });
      }

      // Retrieve detailed information about the user's enrolled course
      const course = await prisma.course.findFirst({
        where: {
          enrollment: {
            some: {
              userId: {
                equals: Number(req.user.id),
              },
              courseId: {
                equals: Number(idCourse),
              },
            },
          },
        },
        include: {
          category: {
            select: {
              id: true,
              categoryName: true,
            },
          },
          enrollment: {
            where: {
              userId: Number(req.user.id),
              courseId: Number(idCourse),
            },
            select: {
              id: true,
              progres: true,
            },
          },
          chapter: {
            select: {
              name: true,
              duration:true,
              lesson: {
                include: {
                  tracking: {
                    where: {
                      userId: Number(req.user.id),
                      courseId: Number(idCourse),
                    },
                    select: {
                      status: true,
                    },
                  },
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

      // Modify object property count to modul and property enrollment
      course.enrollment = course.enrollment[0];
      course["modul"] = course._count.chapter;
      delete course["_count"];

      res.status(200).json({
        status: true,
        message: "Succes to Show detail Course",
        data: course,
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller for retrieving a list of courses based on various filterss
  getCourse: async (req, res, next) => {
    try {
      const {
        search,
        filter,
        category,
        level,
        page = 1,
        limit = 10,
      } = req.query;

      // Initialize an object to store query parameters for Prisma
      let coursesQuery = {
        where: {},
      };

      // Apply search filter if provided
      if (search) {
        coursesQuery.where.OR = [
          { courseName: { contains: search, mode: "insensitive" } },
          { mentor: { contains: search, mode: "insensitive" } },
        ];
      }

      // Apply sorting/filtering based on filter parameter
      if (filter) {
        coursesQuery.orderBy = [];
        if (filter.includes("newest")) {
          coursesQuery.orderBy.push({ createdAt: "desc" });
        }
        if (filter.includes("populer")) {
          coursesQuery.orderBy.push({ averageRating: "desc" });
        }
        if (filter.includes("promo")) {
          coursesQuery.where.promotionId = { not: null };
        }
        if (filter.includes("premium")) {
          coursesQuery.where.isPremium = true;
        }
        if (filter.includes("free")) {
          coursesQuery.where.isPremium = false;
        }
      }

      // Apply filtering based on category if provided
      if (category) {
        const categories = Array.isArray(category)
          ? category.map((c) => c.toLowerCase())
          : [category.toLowerCase()];
        coursesQuery.where.category = {
          categoryName: { in: categories, mode: "insensitive" },
        };
      }

      // Apply filtering based on level if provided
      if (level) {
        const levels = Array.isArray(level) ? level : [level];
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
          _count: {
            select: {
              chapter: true,
              enrollment: {
                include: {
                  _count: {
                    select: {
                      review: {
                        select: {
                          id: true,
                        },
                      },
                    },
                  },
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
        },
      });

      // Count total number of courses for pagination
      const totalCourses = await prisma.course.count({
        where: coursesQuery.where,
      });

      // Generate pagination information
      const pagination = getPagination(
        req,
        totalCourses,
        Number(page),
        Number(limit)
      );

      // Modify each course object to include additional information and remove unnecessary count object
      courses = courses.map((val) => {
        val["modul"] = val._count.chapter;
        val["totalReviews"] = val.enrollment.reduce((sum, enrollment) => {
          return sum + (enrollment.review ? 1 : 0);
        }, 0);
        delete val["_count"];
        return val;
      });

      return res.status(200).json({
        status: true,
        message: "Courses retrieved successfully",
        data: { pagination, courses },
      });
    } catch (err) {
      next(err);
    }
  },
};
