const router = require("express").Router();
const { getTrackingByCourseId, updateTracking } = require("../controllers/tracking.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/:courseId", Auth, checkRole(["user", "admin"]), getTrackingByCourseId);
router.put("/:lessonId", Auth, checkRole(["user", "admin"]), updateTracking);

module.exports = router;
