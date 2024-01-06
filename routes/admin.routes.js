const router = require("express").Router();
const { detailDashboard } = require("../controllers/admin.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/all", Auth, checkRole(["admin"]), detailDashboard);
module.exports = router;
