const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { formattedDate } = require("../utils/formattedDate");

// Controller for creating a new promotion
const createPromotion = catchAsync(async (req, res, next) => {
  try {
    const { discount, startDate, endDate } = req.body;

    // Validate that all required fields are provided
    if (!discount || !startDate || !endDate) throw new CustomError(400, "All fields must be filled");

    // Format start and end dates
    let formattedStartDate = formattedDate(startDate);
    let formattedEndDate = formattedDate(endDate);

    // Create a new promotion record in the database
    const newPromotion = await prisma.promotion.create({
      data: { discount, startDate: formattedStartDate, endDate: formattedEndDate },
    });

    // Retrieve all users from the database
    const users = await prisma.user.findMany();

    // Create notification records for each user
    await Promise.all(
      users.map(async (user) => {
        return prisma.notification.create({
          data: {
            title: "Promo",
            message: `Diskon ${discount * 100}% berlaku dari ${formattedStartDate} sampai ${formattedEndDate}`,
            userId: Number(user.id),
            createdAt: formattedDate(new Date()),
          },
          include: {
            user: {
              select: {
                userProfile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        });
      })
    );

    res.status(201).json({
      status: true,
      message: "Promotion created successfully",
      data: { newPromotion },
    });
  } catch (err) {
    next(err);
  }
});

// Controller for getting all promotions with optional search query
const getAllPromotions = catchAsync(async (req, res, next) => {
  try {
    const { search } = req.query;

    // Retrieve promotions from the database based on the search query
    const promotions = await prisma.promotion.findMany({
      where: search
        ? {
            OR: [search && { discount: parseFloat(search) }, search && { startDate: { contains: search, mode: "insensitive" } }, search && { endDate: { contains: search, mode: "insensitive" } }].filter(Boolean),
          }
        : {},
    });

    res.status(200).json({
      status: true,
      message: "Get all promotions successful",
      data: { promotions },
    });
  } catch (err) {
    next(err);
  }
});

// Controller for getting details of a promotion by ID
const getPromotionById = catchAsync(async (req, res, next) => {
  try {
    const promotionId = req.params.id;

    // Validate the promotion ID
    if (!promotionId || isNaN(promotionId)) throw new CustomError(400, "Invalid promotion ID");

    // Retrieve the promotion details from the database
    const promotion = await prisma.promotion.findUnique({
      where: { id: Number(promotionId) },
    });

    // Handle case when promotion is not found
    if (!promotion) {
      throw new CustomError(404, "Promotion not found");
    }

    res.status(200).json({
      status: true,
      message: "Get detail promotion successful",
      data: { promotion },
    });
  } catch (err) {
    next(err);
  }
});

// Controller for editing a promotion by ID
const editPromotionById = catchAsync(async (req, res, next) => {
  try {
    const promotionId = req.params.id;
    const { discount, startDate, endDate } = req.body;

    // Validate the promotion ID
    if (!promotionId || isNaN(promotionId)) throw new CustomError(400, "Invalid promotion ID");

    // Retrieve the existing promotion details from the database
    const promotion = await prisma.promotion.findUnique({
      where: { id: Number(promotionId) },
    });

    // Handle case when promotion is not found
    if (!promotion) throw new CustomError(404, "Promotion not found");

    // Validate that all required fields are provided
    if (!discount || !startDate || !endDate) throw new CustomError(400, "All fields must be filled");

    let formattedStartDate = formattedDate(startDate);
    let formattedEndDate = formattedDate(endDate);

    // Update the promotion details in the database
    const updatedPromotion = await prisma.promotion.update({
      where: { id: Number(promotionId) },
      data: { discount, startDate: formattedStartDate, endDate: formattedEndDate },
    });

    res.status(200).json({
      status: true,
      message: "Promotion edited successfully",
      data: { updatedPromotion },
    });
  } catch (err) {
    next(err);
  }
});

// Controller for deleting a promotion by ID
const deletePromotionById = catchAsync(async (req, res, next) => {
  try {
    const promotionId = req.params.id;

    // Validate the promotion ID
    if (!promotionId || isNaN(promotionId)) throw new CustomError(400, "Invalid promotion ID");

    // Retrieve the existing promotion details from the database
    const promotion = await prisma.promotion.findUnique({
      where: { id: Number(promotionId) },
    });

    // Handle case when promotion is not found
    if (!promotion) throw new CustomError(404, "Promotion not found");

    // Delete the promotion record from the database
    const deletedPromotion = await prisma.promotion.delete({
      where: { id: Number(promotionId) },
    });

    res.status(200).json({
      status: true,
      message: "Promotion deleted successfully",
      data: { deletedPromotion },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  createPromotion,
  getAllPromotions,
  getPromotionById,
  editPromotionById,
  deletePromotionById,
};
