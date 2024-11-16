const router = require("express").Router();
const { getAllPayments, getPaymentHistory, createPayment, getDetailPayment, createPaymentMidtrans, handlePaymentNotification, getStatusMidtrans } = require("../controllers/payment.controllers");
const Auth = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");

router.get("/", Auth, checkRole(["admin"]), getAllPayments);
router.get("/history", Auth, checkRole(["user", "admin"]), getPaymentHistory);
router.get("/:idCourse", getDetailPayment);
router.post("/:idCourse", Auth, checkRole(["user", "admin"]), createPayment);

// payment midtrans
router.post("/midtrans/:courseId", Auth, checkRole(["user", "admin"]), createPaymentMidtrans);
router.post("/midtrans/notif-midtrans", handlePaymentNotification);
router.get("/history/:orderId", Auth, checkRole(["Admin", "User"]), getStatusMidtrans);

module.exports = router;
