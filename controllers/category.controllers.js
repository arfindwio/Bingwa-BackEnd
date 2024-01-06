const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = {
  // Controller to create a new category
  createCategory: async (req, res, next) => {
    try {
      const { categoryName, categoryImg } = req.body;

      // Validating the presence of required fields
      if (!categoryName || !categoryImg) {
        return res.status(400).json({
          status: false,
          message: "Please provide categoryName, and categoryImg",
          data: null,
        });
      }

      // Creating a new category using Prisma ORM
      let newCategory = await prisma.category.create({
        data: {
          categoryName,
          categoryImg,
        },
      });
      return res.status(201).json({
        status: true,
        message: "create category successful",
        data: { newCategory },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller to retrieve and filter categories
  showCategory: async (req, res, next) => {
    try {
      const { search } = req.query;

      // Fetching categories based on search parameter (if provided)
      const categories = await prisma.category.findMany({
        where: search ? { categoryName: { contains: search, mode: "insensitive" } } : {},
      });

      return res.status(200).json({
        status: true,
        message: "show all category successful",
        data: { categories },
      });
    } catch (err) {
      next(err);
    }
  },

  // Controller to edit an existing category
  editCategory: async (req, res, next) => {
    try {
      const { idCategory } = req.params;
      const { categoryName, categoryImg } = req.body;

      // Validating the presence of required fields
      if (!categoryName || !categoryImg) {
        return res.status(400).json({
          status: false,
          message: "Please provide categoryName, and categoryImg",
          data: null,
        });
      }

      // Updating the specified category using Prisma ORM
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
  },

  // Controller to delete an existing category
  deleteCategory: async (req, res, next) => {
    try {
      const { idCategory } = req.params;

      // Fetching the category to check its existence
      const category = await prisma.category.findUnique({
        where: { id: Number(idCategory) },
      });

      // If the category does not exist, send a 404 response
      if (!category) {
        res.status(404).json({
          status: false,
          message: "Category Not Found",
          data: null,
        });
      }

      // Deleting the specified category using Prisma ORM
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
  },
};
