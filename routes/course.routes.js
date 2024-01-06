const router = require("express").Router();
const { createCourse, editCourse, deleteCourse, detailCourse, detailMyCourse, getMyCourse, getCourse } = require("../controllers/course.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", getCourse);
router.get("/me", Auth, getMyCourse);
router.get("/:idCourse/me", Auth, detailMyCourse);
router.post("/", Auth, checkRole(["admin"]), createCourse);
// router.get("/", Auth, checkRole(["admin"]), showAllCourse); // USER nanti gabsia lihat kelas apa aja dong sblm login
router.get("/:idCourse", detailCourse);
router.put("/:idCourse", Auth, checkRole(["admin"]), editCourse);
router.delete("/:idCourse", Auth, checkRole(["admin"]), deleteCourse);

// display videos in the course
module.exports = router;
