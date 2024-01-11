const router = require("express").Router();
const { getAllEnrollment, getEnrollmentByCourseId, courseEnrollment } = require("../controllers/enrollment.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", Auth, checkRole(["user", "admin"]), getAllEnrollment);
router.get("/:courseId", Auth, checkRole(["user", "admin"]), getEnrollmentByCourseId);
router.post("/:courseId", Auth, checkRole(["user", "admin"]), courseEnrollment);

module.exports = router;
