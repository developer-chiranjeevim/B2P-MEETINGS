import express from "express";
import { createAssignment } from "../controllers/CreateAssignment.js";


const router = express.Router();

router.post("/assignment/create-assignment", createAssignment);



export default router;