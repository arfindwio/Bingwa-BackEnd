const router = require("express").Router();
const { getAllEnrollment, getDetailEnrollment, courseEnrollment } = require("../controllers/enrollment.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", Auth, checkRole(["user", "admin"]), getAllEnrollment);
router.get("/:id", Auth, checkRole(["user", "admin"]), getDetailEnrollment);
router.post("/:courseId", Auth, checkRole(["user", "admin"]), courseEnrollment);

module.exports = router;
