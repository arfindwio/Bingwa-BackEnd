const router = require("express").Router();
const { createCourse, editCourse, deleteCourse, detailCourse, getCourse } = require("../controllers/course.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", getCourse);
router.post("/", Auth, checkRole(["admin"]), createCourse);
router.get("/:idCourse", detailCourse);
router.put("/:idCourse", Auth, checkRole(["admin"]), editCourse);
router.delete("/:idCourse", Auth, checkRole(["admin"]), deleteCourse);

module.exports = router;
