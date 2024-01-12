const router = require("express").Router();
const { createLesson, getAllLessons, updateLessonById, deleteLessonById, getAllLessonByCourseId } = require("../controllers/lesson.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", getAllLessons);
router.post("/", Auth, checkRole(["admin"]), createLesson);
// router.get("/filter", Auth, checkRole(["admin"]), filterLesson);
router.get("/:courseId", getAllLessonByCourseId);
router.put("/:id", Auth, checkRole(["admin"]), updateLessonById);
router.delete("/:id", Auth, checkRole(["admin"]), deleteLessonById);

module.exports = router;
