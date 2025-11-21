import express from "express";
import HomeController from "../controllers/HomeController.js";

const router = express.Router();


router.get("/", HomeController);


export default router;