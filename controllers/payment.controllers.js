const midtransClient = require("midtrans-client");
const axios = require("axios");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const nodemailer = require("../utils/nodemailer");
const { formattedDate } = require("../utils/formattedDate");
const { generatedPaymentCode } = require("../utils/codeGenerator");
const catchAsync = require("../utils/catchAsync");
const { CustomError } = require("../utils/errorHandler");
const { getPagination } = require("../utils/getPagination");

const { PAYMENT_DEV_CLIENT_KEY, PAYMENT_DEV_SERVER_KEY, PAYMENT_PROD_CLIENT_KEY, PAYMENT_PROD_SERVER_KEY, FRONTEND_URL } = process.env;

// Setting the environment (true for production, false for development)
const isProduction = false;

// Initializing Midtrans CoreApi with appropriate keys based on the environment
let core = new midtransClient.CoreApi({
  // Set to true if you want Production Environment (accept real transaction).
  isProduction: isProduction,
  serverKey: isProduction ? PAYMENT_PROD_SERVER_KEY : PAYMENT_DEV_SERVER_KEY,
  clientKey: isProduction ? PAYMENT_PROD_CLIENT_KEY : PAYMENT_DEV_CLIENT_KEY,
});

module.exports = {
  // Controller for creating a payment
  createPayment: catchAsync(async (req, res, next) => {
    try {
      const { idCourse } = req.params;
      const { methodPayment, createdAt, updatedAt } = req.body;
      const PPN = 11 / 100;

      if (createdAt !== undefined || updatedAt !== undefined) {
        throw new CustomError(400, "createdAt or updateAt cannot be provided during payment creation");
      }

      const course = await prisma.course.findFirst({
        where: {
          id: Number(idCourse),
        },
        include: {
          category: {
            select: {
              categoryName: true,
            },
          },
        },
      });

      if (!course) {
        throw new CustomError(404, `Course Not Found With Id ${idCourse}`);
      }

      if (!course.isPremium) {
        throw new CustomError(400, `Course Free Not Able to Buy`);
      }

      const statusEnrollUser = await prisma.enrollment.findFirst({
        where: {
          courseId: Number(idCourse),
          userId: Number(req.user.id),
        },
      });

      if (statusEnrollUser) {
        throw new CustomError(400, `User Already Enrolled in this Course`);
      }

      const modifiedName = course.category.categoryName.replace(/\s+/g, "-");

      let amount = course.price + course.price * PPN;

      if (course.promotionId) {
        let promotion = await prisma.promotion.findFirst({
          where: { id: course.promotionId },
        });
        amount = amount - (amount * promotion.discount) / 100;
      }

      if (!methodPayment || typeof methodPayment !== "string") {
        throw new CustomError(400, "Bad Request for method payment");
      }

      const newPayment = await prisma.payment.create({
        data: {
          amount: parseInt(amount),
          courseId: Number(idCourse),
          userId: Number(req.user.id),
          status: "Paid",
          methodPayment,
          paymentCode: `${modifiedName}-${generatedPaymentCode()}`,
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      const html = await nodemailer.getHtml("transaction-success.ejs", {
        course: course.courseName,
      });
      await nodemailer.sendEmail(req.user.email, "Email Transaction", html);

      await prisma.enrollment.create({
        data: {
          userId: Number(req.user.id),
          courseId: Number(idCourse),
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      await prisma.notification.create({
        data: {
          title: "Notification",
          message: "You have successfully enrolled in the course",
          userId: Number(req.user.id),
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      const lessons = await prisma.lesson.findMany({
        where: {
          chapter: {
            courseId: Number(idCourse),
          },
        },
      });

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

      res.status(201).json({
        status: true,
        message: "Success to Create Payment",
        data: { newPayment },
      });
    } catch (err) {
      next(err);
    }
  }),

  getDetailPayment: catchAsync(async (req, res, next) => {
    try {
      const { idCourse } = req.params;
      const PPN = 11 / 100;
      let amount;

      // Find the course for which the payment detail is being requested
      let course = await prisma.course.findFirst({
        where: {
          id: Number(idCourse),
        },
        select: {
          id: true,
          courseName: true,
          price: true,
          mentor: true,
          category: {
            select: {
              categoryName: true,
            },
          },
        },
      });

      // Handle case when the course is not found
      if (!course) {
        throw new CustomError(404, `Course Not Found With Id ${idCourse}`);
      }

      // Calculate the payment amount with PPN
      amount = course.price * PPN + course.price;

      res.status(200).json({
        status: true,
        message: `Success To Show Detail Payment`,
        data: {
          course,
          PPN: PPN * course.price,
          amount,
        },
      });
    } catch (err) {
      next(err);
    }
  }),

  getAllPayments: catchAsync(async (req, res, next) => {
    try {
      const { search, page = 1, limit = 10 } = req.query;

      // Find payments based on search criteria
      let payments = await prisma.payment.findMany({
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        where: {
          OR: [
            { status: { contains: search, mode: "insensitive" } },
            {
              course: { courseName: { contains: search, mode: "insensitive" } },
            },
            {
              user: {
                userProfile: {
                  fullName: { contains: search, mode: "insensitive" },
                },
              },
            },
            {
              course: {
                category: {
                  categoryName: { contains: search, mode: "insensitive" },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          methodPayment: true,
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
          user: {
            select: {
              userProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          paymentCode: true,
        },
      });

      const totalPayments = await prisma.payment.count({
        where: {
          OR: [
            { status: { contains: search, mode: "insensitive" } },
            {
              course: { courseName: { contains: search, mode: "insensitive" } },
            },
            {
              user: {
                userProfile: {
                  fullName: { contains: search, mode: "insensitive" },
                },
              },
            },
            {
              course: {
                category: {
                  categoryName: { contains: search, mode: "insensitive" },
                },
              },
            },
          ],
        },
      });

      // Generate pagination information
      const pagination = getPagination(req, totalPayments, Number(page), Number(limit));

      res.status(200).json({
        status: true,
        message: "Get all payments successful",
        data: { pagination, payments },
      });
    } catch (err) {
      next(err);
    }
  }),

  getPaymentHistory: catchAsync(async (req, res, next) => {
    try {
      // Find all payments for the authenticated user
      let payments = await prisma.payment.findMany({
        where: {
          userId: Number(req.user.id),
        },
        include: {
          course: {
            select: {
              id: true,
              courseName: true,
              courseImg: true,
              mentor: true,
              averageRating: true,
              totalDuration: true,
              level: true,
              price: true,
              category: {
                select: {
                  categoryName: true,
                },
              },
              enrollment: true,
              _count: {
                select: {
                  chapter: true,
                },
              },
            },
          },
        },
      });

      // Modify object property _count to modul
      payments = payments.map((val) => {
        val.course.modul = val.course._count.chapter;
        delete val.course._count;
        return val;
      });

      res.status(200).json({
        status: true,
        message: "Get all payment history successful",
        data: { payments },
      });
    } catch (err) {
      next(err);
    }
  }),

  createPaymentMidtrans: catchAsync(async (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { methodPayment, cardNumber, cvv, expiryDate, bankName, store, message, createdAt, updatedAt } = req.body;

      // Validate that createdAt and updatedAt are not provided during payment creation
      if (createdAt !== undefined || updatedAt !== undefined) {
        throw new CustomError(400, "createdAt or updateAt cannot be provided during payment creation");
      }

      // Extract month and year from expiryDate
      let month = expiryDate.slice(0, 2);
      let year = expiryDate.slice(3);

      // Set the Midtrans API URL based on the environment
      const apiUrl = isProduction ? `https://api.midtrans.com/v2/token?client_key=${PAYMENT_PROD_CLIENT_KEY}` : `https://api.sandbox.midtrans.com/v2/token?client_key=${PAYMENT_DEV_CLIENT_KEY}`;

      // Get card token from Midtrans API
      const response = await axios.get(`${apiUrl}&card_number=${cardNumber}&card_cvv=${cvv}&card_exp_month=${month}&card_exp_year=${`20${year}`}`);

      const token_id = response.data.token_id;

      // Find user and course details
      const user = await prisma.user.findUnique({
        where: { id: Number(req.user.id) },
        include: {
          userProfile: true,
        },
      });

      const course = await prisma.course.findUnique({
        where: { id: Number(courseId) },
        include: {
          promotion: true,
          category: {
            select: {
              categoryName: true,
            },
          },
        },
      });

      // Handle case when the course is not found
      if (!course) {
        throw new CustomError(404, `Course Not Found With Id ${courseId}`);
      }

      // Handle case when trying to buy a free course
      if (course.isPremium === false) {
        throw new CustomError(400, `Course Free Not Able to Buy`);
      }

      // Check if the user is already enrolled in the course
      const enrollmentUser = await prisma.enrollment.findFirst({
        where: {
          courseId: Number(course.id),
          userId: Number(req.user.id),
        },
      });

      // Handle case when the user is already enrolled
      if (enrollmentUser) {
        throw new CustomError(400, `User Already Enrolled in this Course`);
      }

      // Generate a modified name for the payment code
      const modifiedName = course.category.categoryName.replace(/\s+/g, "-");

      // Calculate the total price for the payment
      const totalPrice = course.promotion ? (course.price - course.promotion.discount * course.price) * (1 + 0.11) : course.price * 0.11 + course.price;

      // Create a new payment record in the database
      let newPayment = await prisma.payment.create({
        data: {
          amount: parseInt(totalPrice),
          status: "Paid",
          methodPayment,
          paymentCode: `${modifiedName}-${generatedPaymentCode()}`,
          courseId: Number(course.id),
          userId: Number(req.user.id),
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      // Define payment parameters for Midtrans API
      let parameter = {
        transaction_details: {
          order_id: `${modifiedName}-${generatedPaymentCode()}`,
          gross_amount: parseInt(totalPrice),
        },
        customer_details: {
          first_name: user.userProfile.fullName,
          email: user.email,
          phone: user.userProfile.phoneNumber,
        },
      };

      // Set payment type based on the methodPayment
      if (methodPayment === "Credit Card") {
        if (!cardNumber || !cvv || !expiryDate || bankName !== undefined || store !== undefined || message !== undefined) {
          throw new CustomError(400, "For Credit Card payments, please provide only card details (cardNumber, cvv, expiryDate). Other fields are not applicable.");
        }

        parameter.payment_type = "credit_card";
        parameter.credit_card = {
          token_id: token_id,
          authentication: true,
        };
      }

      if (methodPayment === "Bank Transfer") {
        if (!bankName || cardNumber !== undefined || cvv !== undefined || expiryDate !== undefined || store !== undefined || message !== undefined) {
          throw new CustomError(400, "For this payment method, please provide only the required fields. Unnecessary fields are not applicable.");
        }

        parameter.payment_type = "bank_transfer";
        parameter.bank_transfer = {
          bank: bankName,
        };
      }

      if (methodPayment === "Mandiri Bill") {
        if (bankName !== undefined || cardNumber !== undefined || cvv !== undefined || expiryDate !== undefined || store !== undefined || message !== undefined) {
          throw new CustomError(400, "For this payment method, please provide only the required card details (cardNumber, cvv, expiryDate). Other fields are not applicable.");
        }

        parameter.payment_type = "echannel";
        parameter.echannel = {
          bill_info1: "Payment:",
          bill_info2: "Online purchase",
        };
      }

      if (methodPayment === "Permata") {
        if (bankName !== undefined || cardNumber !== undefined || cvv !== undefined || expiryDate !== undefined || store !== undefined || message !== undefined) {
          throw new CustomError(400, "For this payment method, please provide only the required card details (cardNumber, cvv, expiryDate). Other fields are not applicable.");
        }

        parameter.payment_type = "permata";
      }

      if (methodPayment === "Gopay") {
        if (bankName !== undefined || cardNumber !== undefined || cvv !== undefined || expiryDate !== undefined || store !== undefined || message !== undefined) {
          throw new CustomError(400, "For this payment method, please provide only the required card details (cardNumber, cvv, expiryDate). Other fields are not applicable.");
        }

        parameter.payment_type = "gopay";
        parameter.gopay = {
          enable_callback: true,
          callback_url: `${FRONTEND_URL}/payment-success`,
        };
      }

      if (methodPayment === "Counter") {
        if (bankName !== undefined || cardNumber !== undefined || cvv !== undefined || expiryDate !== undefined || !store || !message) {
          throw new CustomError(400, "Please provide only the required card details (cardNumber, cvv, expiryDate) for this payment method. Other fields are not applicable.");
        }

        parameter.payment_type = "cstore";
        if (store === "alfamart") {
          parameter.cstore = {
            store: "alfamart",
            message,
            alfamart_free_text_1: "1st row of receipt,",
            alfamart_free_text_2: "This is the 2nd row,",
            alfamart_free_text_3: "3rd row. The end.",
          };
        }

        if (store === "indomaret") {
          parameter.cstore = {
            store: "indomaret",
            message,
          };
        }
      }

      if (methodPayment === "Cardless Credit") {
        if (bankName !== undefined || cardNumber !== undefined || cvv !== undefined || expiryDate !== undefined || store !== undefined || message !== undefined) {
          throw new CustomError(400, "For this payment method, please provide only the required card details (cardNumber, cvv, expiryDate). Other fields are not applicable.");
        }

        parameter.payment_type = "akulaku";
      }

      // Charge the transaction using Midtrans API
      let transaction = await core.charge(parameter);

      // Send email notification to the user
      const html = await nodemailer.getHtml("transaction-success.ejs", {
        course: course.courseName,
      });
      await nodemailer.sendEmail(user.email, "Email Transaction", html);

      // Create enrollment record for the user
      await prisma.enrollment.create({
        data: {
          userId: Number(req.user.id),
          courseId: Number(course.id),
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      await prisma.notification.create({
        data: {
          title: "Notification",
          message: "You have successfully enrolled in the course",
          userId: Number(req.user.id),
          createdAt: formattedDate(new Date()),
          updatedAt: formattedDate(new Date()),
        },
      });

      // Create tracking records for each lesson in the course
      const lessons = await prisma.lesson.findMany({
        where: {
          chapter: {
            courseId: Number(course.id),
          },
        },
      });

      await Promise.all(
        lessons.map(async (lesson) => {
          return await prisma.tracking.create({
            data: {
              userId: Number(req.user.id),
              lessonId: Number(lesson.id),
              status: false,
              createdAt: formattedDate(new Date()),
              updatedAt: formattedDate(new Date()),
            },
          });
        })
      );

      res.status(201).json({
        status: true,
        message: "Payment initiated successfully",
        data: {
          newPayment,
          transaction,
        },
      });
    } catch (err) {
      next(err);
    }
  }),

  // Controller to handle Midtrans payment notifications
  handlePaymentNotification: catchAsync(async (req, res, next) => {
    try {
      // Extract payment notification data from the request body
      let notification = {
        currency: req.body.currency,
        fraud_status: req.body.fraud_status,
        gross_amount: req.body.gross_amount,
        order_id: req.body.order_id,
        payment_type: req.body.payment_type,
        status_code: req.body.status_code,
        status_message: req.body.status_message,
        transaction_id: req.body.transaction_id,
        transaction_status: req.body.transaction_status,
        transaction_time: req.body.transaction_time,
        merchant_id: req.body.merchant_id,
      };

      // Process the payment notification using Midtrans API
      let data = await core.transaction.notification(notification);

      // Update the payment status in the database
      const updatedPayment = await prisma.payment.update({
        where: { paymentCode: data.order_id },
        data: {
          status: "Paid",
          methodPayment: data.payment_type,
          updatedAt: formattedDate(new Date()),
        },
      });

      res.status(200).json({
        status: true,
        message: "Payment notification processed successfully",
        data: { updatedPayment },
      });
    } catch (err) {
      next(err);
    }
  }),
};
