import axios from "axios";
import GetZoomAccessToken from "../utilities/GetZoomAccessToken.js";
import { CreateMeetingRecord } from "../utilities/CreateMeetingRecord.js";

const CreateZoomMeeting = async (request, response) => {
  try {
    const { meetingName, date, time, owner, participants, description, duration } = request.body;

    if (!meetingName || !date || !time) {
      return response.status(400).json({
        error: "meetingName, date (YYYY-MM-DD) & time (HH:mm) are required"
      });
    }

    // Create ISO string in IST without converting to UTC
    const zoomStartTime = `${date}T${time}:00`;

    const token = await GetZoomAccessToken();

    const zoom_response = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: meetingName,
        type: 2,
        start_time: zoomStartTime, // stay in IST format
        duration: duration,
        timezone: "Asia/Kolkata", // Zoom will treat above time as IST
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          
          waiting_room: false,
          auto_recording: "cloud",
        },

      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const datas = {
      MEETING_ID: String(zoom_response.data.id),
      title: meetingName,
      url: zoom_response.data.join_url,
      password: zoom_response.data.password,
      meeting_time_ist: `${date} ${time}`,
      isActive: true,
      owner: owner,
      participants: participants,
      description: description,
      duration: duration
    };

    await CreateMeetingRecord(datas);

    response.status(200).json(datas);

  } catch (error) {
    console.error(error.response?.data || error.message);
    response.status(500).json({ message: error.message });
  }
};


export default CreateZoomMeeting;