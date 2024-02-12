const router = require("express").Router();
const { createCourse, editCourse, deleteCourse, detailCourse, getCourse } = require("../controllers/course.controllers");
const { image } = require("../libs/multer");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", getCourse);
router.post("/", Auth, checkRole(["admin"]), image.single("image"), createCourse);
router.get("/:idCourse", detailCourse);
router.put("/:idCourse", Auth, checkRole(["admin"]), image.single("image"), editCourse);
router.delete("/:idCourse", Auth, checkRole(["admin"]), deleteCourse);

module.exports = router;
