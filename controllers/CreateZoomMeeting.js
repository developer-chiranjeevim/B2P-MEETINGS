import axios from "axios";
import GetZoomAccessToken from "../utilities/GetZoomAccessToken.js";
import { CreateMeetingRecord } from "../utilities/CreateMeetingRecord.js";
import { UpdateStudentStats } from "../utilities/UpdateStudentStatus.js";


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
          recording_authentication: false,
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
    await UpdateStudentStats(datas.participants, false);


    response.status(200).json(datas);

  } catch (error) {
    console.error(error.response?.data || error.message);
    response.status(500).json({ message: error.message });
  }
};

const GetRecordingUrl = async (request, response) => {
  try {
    const { meetingId } = request.query ;

    if (!meetingId) {
      return response.status(400).json({
        error: "meetingId is required"
      });
    }

    const token = await GetZoomAccessToken();

    const zoom_response = await axios.get(
      `https://api.zoom.us/v2/meetings/${meetingId}/recordings`,
      {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Extract just the share URL (public viewing link)
    const recordingUrl = zoom_response.data.share_url;

    // Or if you want the download URLs for each file:
    const downloadUrls = zoom_response.data.recording_files?.map(file => ({
      type: file.recording_type,
      file_type: file.file_type,
      download_url: file.download_url,
      play_url: file.play_url
    })) || [];

    response.status(200).json({
      meeting_id: zoom_response.data.id,
      topic: zoom_response.data.topic,
      share_url: recordingUrl, // Main share URL
      recording_files: downloadUrls
    });

  } catch (error) {
    console.error('Error fetching recording URL:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return response.status(404).json({ 
        message: "Recording not found. The meeting may not have been recorded yet." 
      });
    }

    response.status(500).json({ 
      message: "Failed to retrieve recording URL",
      error: error.message 
    });
  }
};


export {CreateZoomMeeting, GetRecordingUrl};