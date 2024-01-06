const router = require("express").Router();
const { createLesson, getAllLessons, getDetailLesson, updateDetailLesson, deleteLessonById, filterLesson, showLessonByCourse } = require("../controllers/lesson.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", getAllLessons);
router.post("/", Auth, checkRole(["admin"]), createLesson);
router.get("/filter", Auth, checkRole(["admin"]), filterLesson); //search Lesson for Admin
router.get("/:id", Auth, checkRole(["user", "admin"]), getDetailLesson);
router.put("/:id", Auth, checkRole(["admin"]), updateDetailLesson);
router.delete("/:id", Auth, checkRole(["admin"]), deleteLessonById);
router.get("/:idCourse/course", showLessonByCourse); //show Lesson by Course

module.exports = router;
