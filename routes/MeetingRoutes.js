import express from "express";
import {CreateZoomMeeting, GetRecordingUrl} from "../controllers/CreateZoomMeeting.js";
import { ListMeetings, DeleteMeeting, GetMeetingStats, FetchTeachersMeetings, FetchAggregates, FetchHistoricalMeetings, FetchStudentsHistoricMeetings, FetchTeachersMeetingAdmin } from "../controllers/ListMeetings.js";
import tokenMiddleware from "../middleware/TokenMiddleware.js";
import { DeleteAllZoomMeetings, UpdateMeetingOwnership} from "../controllers/CreateZoomMeeting.js";


const router = express.Router();


router.post("/meeting/create-meeting", tokenMiddleware, CreateZoomMeeting);
router.get("/meeting/list-meetings", ListMeetings);
router.get("/meeting/get-meeting-stats", GetMeetingStats);
router.get("/meeting/fetch-teachers-meeting-admin", tokenMiddleware, FetchTeachersMeetingAdmin)
router.delete("/meeting/delete-meeting", DeleteMeeting);
router.get("/meetings/fetch-teachers-meetings", tokenMiddleware, FetchTeachersMeetings);
router.get("/meetings/fetch-aggregates", tokenMiddleware, FetchAggregates);
router.get("/meetings/fetch-historical-meetings", tokenMiddleware, FetchHistoricalMeetings);
router.get("/meetings/fetch-student-historic-meetings", tokenMiddleware ,FetchStudentsHistoricMeetings);
router.get("/meeting/get-meeting-recording", GetRecordingUrl);
router.delete("/meeting/delete-all-meetings", DeleteAllZoomMeetings);
router.post("/meetings/update-meeting-owner", UpdateMeetingOwnership);

export default router;