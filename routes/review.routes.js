const router = require("express").Router();
const { createReview } = require("../controllers/review.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.post("/:courseId", Auth, checkRole(["user", "admin"]), createReview);

module.exports = router;
