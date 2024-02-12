const router = require("express").Router();
const { createCategory, deleteCategory, editCategory, showCategory } = require("../controllers/category.controllers");
const { image } = require("../libs/multer");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", showCategory);
router.post("/", Auth, checkRole(["admin"]), image.single("image"), createCategory);
router.put("/:idCategory", Auth, checkRole(["admin"]), image.single("image"), editCategory);
router.delete("/:idCategory", Auth, checkRole(["admin"]), deleteCategory);

module.exports = router;
