import express from "express";
import CreateZoomMeeting from "../controllers/CreateZoomMeeting.js";
import { ListMeetings, DeleteMeeting, GetMeetingStats, FetchTeachersMeetings } from "../controllers/ListMeetings.js";
import tokenMiddleware from "../middleware/TokenMiddleware.js";

const router = express.Router();


router.post("/meeting/create-meeting", CreateZoomMeeting);
router.get("/meeting/list-meetings", ListMeetings);
router.get("/meeting/get-meeting-stats", GetMeetingStats);
router.delete("/meeting/delete-meeting", DeleteMeeting);
router.get("/meetings/fetch-teachers-meetings", tokenMiddleware, FetchTeachersMeetings);



export default router;