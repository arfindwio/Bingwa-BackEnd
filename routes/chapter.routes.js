const router = require("express").Router();
const { createChapter, getChapters, getChapterById, updateChapter, deleteChapter } = require("../controllers/chapter.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", getChapters);
router.post("/", Auth, checkRole(["admin"]), createChapter);
router.get("/:id", getChapterById);
router.put("/:id", Auth, checkRole(["admin"]), updateChapter);
router.delete("/:id", Auth, checkRole(["admin"]), deleteChapter);

module.exports = router;
