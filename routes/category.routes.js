const router = require("express").Router();
const { createCategory, deleteCategory, editCategory, showCategory } = require("../controllers/category.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", showCategory);
router.post("/", Auth, checkRole(["admin"]), createCategory);
router.put("/:idCategory", Auth, checkRole(["admin"]), editCategory);
router.delete("/:idCategory", Auth, checkRole(["admin"]), deleteCategory);

module.exports = router;
