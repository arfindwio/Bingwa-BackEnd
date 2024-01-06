const router = require("express").Router();
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("fs");
const path = require("path");

const User = require("./user.routes");
const UserProfile = require("./userProfile.routes");
const Category = require("./category.routes");
const Course = require("./course.routes");
const Chapter = require("./chapter.routes");
const Lesson = require("./lesson.routes");
const Enrollment = require("./enrollment.routes");
const Promotion = require("./promotion.routes");
const Payment = require("./payment.routes");
const Notification = require("./notification.routes");
const Tracking = require("./tracking.routes");
const Review = require("./review.routes");
const Admin = require("./admin.routes");

const swagger_path = path.resolve(__dirname, "../docs/swagger.yaml");
const customCssUrl =
  "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css";
const customJs = [
  "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js",
  "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js",
];
const file = fs.readFileSync(swagger_path, "utf8");

// API Docs
const swaggerDocument = YAML.parse(file);
router.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, { customCssUrl, customJs })
); //fix  bug swager deployment

// API
router.use("/api/v1/users", User);
router.use("/api/v1/user-profiles", UserProfile);
router.use("/api/v1/categories", Category);
router.use("/api/v1/courses", Course);
router.use("/api/v1/chapters", Chapter);
router.use("/api/v1/lessons", Lesson);
router.use("/api/v1/enrollments", Enrollment);
router.use("/api/v1/promotions", Promotion);
router.use("/api/v1/payments", Payment);
router.use("/api/v1/notifications", Notification);
router.use("/api/v1/trackings", Tracking);
router.use("/api/v1/reviews", Review);
router.use("/api/v1/admin", Admin);

module.exports = router;
