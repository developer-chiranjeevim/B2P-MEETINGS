import axios from "axios";
import { CreateMeetingRecord } from "../utilities/CreateMeetingRecord.js";
import { UpdateStudentStats } from "../utilities/UpdateStudentStatus.js";
import { client } from "../db/dbConfig.js";
import { addDays, format, parse } from "date-fns";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const DAILY_API_BASE_URL = "https://api.daily.co/v1";

const CreateDailyMeeting = async (request, response) => {
  try {
    const { meetingName, date, time, owner, participants, description, duration } = request.body;

    if (!meetingName || !date || !time) {
      return response.status(400).json({
        error: "meetingName, date (YYYY-MM-DD) & time (HH:mm) are required"
      });
    }

    const createdMeetings = [];

    // Parse the base date
    const baseDate = parse(date, 'yyyy-MM-dd', new Date());

    // Create meetings for the next 48 days
    for (let dayOffset = 0; dayOffset < 48; dayOffset++) {
      // Add days without timezone issues
      const meetingDate = addDays(baseDate, dayOffset);
      
      // Format the date
      const formattedDate = format(meetingDate, 'yyyy-MM-dd');
      const meetingStartTime = `${formattedDate}T${time}:00`;
      
      // Include date in the meeting title
      const titleWithDate = `${meetingName} - ${formattedDate}`;
      
      // Create a unique room name (Daily requires URL-safe names)
      const roomName = `${meetingName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${formattedDate}-${time.replace(':', '')}`;

      // Calculate start time in Unix timestamp (seconds)
      const startTimeDate = new Date(`${formattedDate}T${time}:00+05:30`); // IST timezone
      const startTimeUnix = Math.floor(startTimeDate.getTime() / 1000);
      
      // Calculate expiry time (start time + duration in minutes)
      const expiryTimeUnix = startTimeUnix + (duration * 60);

      const daily_response = await axios.post(
        `${DAILY_API_BASE_URL}/rooms`,
        {
          name: roomName,
          properties: {
            start_audio_off: false,
            start_video_off: false,
            enable_screenshare: true,
            enable_chat: true,
            enable_knocking: false, // equivalent to join_before_host
            enable_prejoin_ui: true,
            enable_recording: "cloud", // auto cloud recording
            nbf: startTimeUnix, // not before - meeting start time
            exp: expiryTimeUnix, // expiry time
            max_participants: 50, // adjust as needed
          }
        },
        {
          headers: { 
            Authorization: `Bearer ${process.env.DAILY_CO_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const datas = {
        MEETING_ID: daily_response.data.name, // Daily uses room name as ID
        title: titleWithDate,
        url: daily_response.data.url,
        password: "", // Daily uses meeting tokens for security instead of passwords
        meeting_time_ist: `${formattedDate} ${time}`,
        isActive: true,
        owner: owner,
        participants: participants,
        description: description,
        duration: duration,
        room_name: daily_response.data.name,
        api_created: daily_response.data.api_created
      };

      await CreateMeetingRecord(datas);
      createdMeetings.push(datas);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await UpdateStudentStats(participants, false);

    response.status(200).json({
      message: `Successfully created ${createdMeetings.length} meetings`,
      meetings: createdMeetings
    });

  } catch (error) {
    console.error(error.response?.data || error.message);
    response.status(500).json({ message: error.message });
  }
};

const GetRecordingUrl = async (request, response) => {
  try {
    const { meetingId } = request.query;

    if (!meetingId) {
      return response.status(400).json({
        error: "meetingId (room name) is required"
      });
    }

    // Get recordings for the room
    const daily_response = await axios.get(
      `${DAILY_API_BASE_URL}/recordings`,
      {
        headers: { 
          Authorization: `Bearer ${process.env.DAILY_CO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        params: {
          room_name: meetingId,
          limit: 100
        }
      }
    );

    const recordings = daily_response.data.data || [];

    if (recordings.length === 0) {
      return response.status(404).json({ 
        message: "Recording not found. The meeting may not have been recorded yet." 
      });
    }

    // Get the most recent recording
    const latestRecording = recordings[0];

    // Extract recording URLs
    const recordingUrls = [];
    
    if (latestRecording.share_url) {
      recordingUrls.push({
        type: "share",
        url: latestRecording.share_url
      });
    }

    if (latestRecording.download_url) {
      recordingUrls.push({
        type: "download",
        url: latestRecording.download_url
      });
    }

    response.status(200).json({
      meeting_id: meetingId,
      room_name: latestRecording.room_name,
      share_url: latestRecording.share_url,
      download_url: latestRecording.download_url,
      duration: latestRecording.duration,
      start_ts: latestRecording.start_ts,
      status: latestRecording.status,
      recording_files: recordingUrls,
      all_recordings: recordings.map(rec => ({
        id: rec.id,
        share_url: rec.share_url,
        download_url: rec.download_url,
        duration: rec.duration,
        start_ts: rec.start_ts
      }))
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

const DeleteAllDailyMeetings = async (request, response) => {
  try {
    const deletedMeetings = [];
    const failedMeetings = [];

    // Step 1: Get all rooms from Daily.co
    const listResponse = await axios.get(
      `${DAILY_API_BASE_URL}/rooms`,
      {
        headers: { 
          Authorization: `Bearer ${process.env.DAILY_CO_API_KEY}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 100 // Adjust if you have more rooms
        }
      }
    );

    const rooms = listResponse.data.data || [];

    if (rooms.length === 0) {
      return response.status(200).json({
        message: "No meetings found to delete",
        deleted: 0,
        failed: 0
      });
    }

    // Step 2: Delete each room
    for (const room of rooms) {
      try {
        await axios.delete(
          `${DAILY_API_BASE_URL}/rooms/${room.name}`,
          {
            headers: { 
              Authorization: `Bearer ${process.env.DAILY_CO_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        deletedMeetings.push({
          id: room.id,
          name: room.name,
          url: room.url,
          created_at: room.created_at
        });

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to delete room ${room.name}:`, error.message);
        failedMeetings.push({
          id: room.id,
          name: room.name,
          error: error.message
        });
      }
    }

    response.status(200).json({
      message: `Deletion complete`,
      deleted: deletedMeetings.length,
      failed: failedMeetings.length,
      deletedMeetings: deletedMeetings,
      failedMeetings: failedMeetings.length > 0 ? failedMeetings : undefined
    });

  } catch (error) {
    console.error("Error deleting meetings:", error.response?.data || error.message);
    response.status(500).json({ 
      message: "Failed to delete meetings",
      error: error.message 
    });
  }
};

const UpdateMeetingOwnership = async(request, response) => {
  const current_owner = request.body.current_owner;
  const new_owner = request.body.new_owner;

  try {
    // Validate input
    if (!current_owner || !new_owner) {
      return response.status(400).json({
        error: "current_owner and new_owner are required"
      });
    }

    const tableName = process.env.DYNAMO_DB_MEETINGS_TABLE_NAME || "Meetings";
    
    // Step 1: Scan finds ALL meetings with current owner (not just one)
    const scanParams = {
      TableName: tableName,
      FilterExpression: "#owner = :currentOwner",
      ExpressionAttributeNames: {
        "#owner": "owner"
      },
      ExpressionAttributeValues: {
        ":currentOwner": current_owner
      }
    };

    const scanResult = await client.send(new ScanCommand(scanParams));
    const meetings = scanResult.Items || []; // This array contains ALL meetings for the owner

    if (meetings.length === 0) {
      return response.status(200).json({
        message: "No meetings found for the current owner",
        current_owner: current_owner,
        updated_count: 0
      });
    }

    // Step 2: Loop through and update EACH meeting found
    let updatedCount = 0;
    
    for (const meeting of meetings) {  // This loops through ALL meetings
      const updateParams = {
        TableName: tableName,
        Key: {
          MEETING_ID: meeting.MEETING_ID
        },
        UpdateExpression: "SET #owner = :newOwner",
        ExpressionAttributeNames: {
          "#owner": "owner"
        },
        ExpressionAttributeValues: {
          ":newOwner": new_owner
        }
      };

      await client.send(new UpdateCommand(updateParams));
      updatedCount++;  // Counts each successful update
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    response.status(200).json({
      message: "Meeting ownership updated successfully",
      current_owner: current_owner,
      new_owner: new_owner,
      updated_count: updatedCount  // Returns total number of meetings updated
    });

  } catch (error) {
    console.error("Error updating meeting ownership:", error.message);
    response.status(500).json({ message: error.message });
  }
};

export { CreateDailyMeeting, GetRecordingUrl, DeleteAllDailyMeetings, UpdateMeetingOwnership };