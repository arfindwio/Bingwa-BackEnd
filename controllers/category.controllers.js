// controllers/category.controllers.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");

module.exports = {
  createCategory: catchAsync(async (req, res, next) => {
    try {
      const { categoryName, categoryImg } = req.body;

      if (!categoryName || !categoryImg) throw new CustomError(400, "Please provide categoryName and categoryImg");

      let newCategory = await prisma.category.create({
        data: {
          categoryName,
          categoryImg,
        },
      });

      res.status(201).json({
        status: true,
        message: "create category successful",
        data: { newCategory },
      });
    } catch (err) {
      next(err);
    }
  }),

  showCategory: catchAsync(async (req, res, next) => {
    try {
      const { search } = req.query;

      const categories = await prisma.category.findMany({
        where: search ? { categoryName: { contains: search, mode: "insensitive" } } : {},
      });

      res.status(200).json({
        status: true,
        message: "show all category successful",
        data: { categories },
      });
    } catch (err) {
      next(err);
    }
  }),

  editCategory: catchAsync(async (req, res, next) => {
    try {
      const { idCategory } = req.params;
      const { categoryName, categoryImg } = req.body;

      if (!categoryName || !categoryImg) throw new CustomError(400, "Please provide categoryName and categoryImg");

      let editedCategory = await prisma.category.update({
        where: {
          id: Number(idCategory),
        },
        data: {
          categoryName,
          categoryImg,
        },
      });

      res.status(200).json({
        status: true,
        message: "update category successful",
        data: { editedCategory },
      });
    } catch (err) {
      next(err);
    }
  }),

  deleteCategory: catchAsync(async (req, res, next) => {
    try {
      const { idCategory } = req.params;

      const category = await prisma.category.findUnique({
        where: { id: Number(idCategory) },
      });

      if (!category) throw new CustomError(404, "Category Not Found");

      const deletedCategory = await prisma.category.delete({
        where: {
          id: Number(idCategory),
        },
      });

      res.status(200).json({
        status: true,
        message: "delete category successful",
        data: { deletedCategory },
      });
    } catch (err) {
      next(err);
    }
  }),
};
