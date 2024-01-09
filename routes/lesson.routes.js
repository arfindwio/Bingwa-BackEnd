const router = require("express").Router();
const { createLesson, getAllLessons, getDetailLesson, updateLessonById, deleteLessonById, showLessonByCourse } = require("../controllers/lesson.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", getAllLessons);
router.post("/", Auth, checkRole(["admin"]), createLesson);
// router.get("/filter", Auth, checkRole(["admin"]), filterLesson);
router.get("/:id", Auth, checkRole(["user", "admin"]), getDetailLesson);
router.put("/:id", Auth, checkRole(["admin"]), updateLessonById);
router.delete("/:id", Auth, checkRole(["admin"]), deleteLessonById);
router.get("/:idCourse/course", showLessonByCourse);

module.exports = router;
