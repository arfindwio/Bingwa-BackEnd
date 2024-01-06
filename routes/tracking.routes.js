const router = require("express").Router();
const { updateTracking } = require("../controllers/tracking.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.put("/:lessonId", Auth, checkRole(["user", "admin"]), updateTracking);

module.exports = router;
