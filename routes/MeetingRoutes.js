import express from "express";
import CreateZoomMeeting from "../controllers/CreateZoomMeeting.js";
import { ListMeetings, DeleteMeeting, GetMeetingStats } from "../controllers/ListMeetings.js";


const router = express.Router();


router.post("/meeting/create-meeting", CreateZoomMeeting);
router.get("/meeting/list-meetings", ListMeetings);
router.get("/meeting/get-meeting-stats", GetMeetingStats);
router.delete("/meeting/delete-meeting", DeleteMeeting);



export default router;