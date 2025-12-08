import express from "express";
import tokenMiddleware from "../middleware/TokenMiddleware.js";
import {GetRazorPayKey, MakePayment, VerifyPayment, AddTransaction, FetchTransaction} from "../controllers/PaymentsController.js";

const router = express.Router();

router.get("/payments/get-razorpay-key", GetRazorPayKey);
router.post("/payments/make-payment", MakePayment);
router.post("/payments/verify-payments", VerifyPayment);
router.post("/payments/add-transcation", tokenMiddleware, AddTransaction);
router.get("/payments/fetch-transactions", tokenMiddleware, FetchTransaction);


export default router;