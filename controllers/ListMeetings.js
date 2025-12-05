import { client } from "../db/dbConfig.js";
import { ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import GetZoomAccessToken from "../utilities/GetZoomAccessToken.js";
import axios from "axios";


const ListMeetings = async(request, response) => {

    const params = {
        TableName: process.env.DYNAMO_DB_MEETINGS_TABLE_NAME
    };

    try{

        const dbResponse = await client.send(new ScanCommand(params));
        const now = new Date();
        
        // Transform meetings to match frontend interface
        const meetingsWithStatus = dbResponse.Items.map(meeting => {
            const meetingDateTime = new Date(meeting.meeting_time_ist);
            const duration = meeting.duration || 60;
            const meetingEndTime = new Date(meetingDateTime.getTime() + duration * 60000);

            let status;
            if (now < meetingDateTime) {
                status = 'scheduled';
            } else if (now >= meetingDateTime && now <= meetingEndTime) {
                status = 'ongoing';
            } else {
                status = 'completed';
            }

            // Extract date and time from meeting_time_ist
            const dateObj = new Date(meeting.meeting_time_ist);
            const date = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            const time = dateObj.toTimeString().slice(0, 5); // HH:MM

            // Get participant details (student IDs and names)
            const studentIds = meeting.participants || [];

            return {
                id: meeting.MEETING_ID,
                title: meeting.title || `Meeting ${meeting.MEETING_ID}`, // Generate title if not present
                description: meeting.description || '',
                date: date,
                time: time,
                duration: duration,
                teacherId: meeting.owner || '',
                teacherName: meeting.owner_name || meeting.owner || '', // Use owner_name if available
                studentIds: studentIds,
                meetingLink: meeting.url || '',
                status: status
            };
        });

        response.status(200).json({meetings: meetingsWithStatus});

    }catch(error){
        response.status(500).json({message: error.message});
    };

};



const DeleteMeeting = async(request, response) => {

    const { meeting_id } = request.body; 

    const token = await GetZoomAccessToken();

    if (!meeting_id) {
        return response.status(400).json({ message: "Meeting ID is required" });
    }
     
    await axios.delete(
      `https://api.zoom.us/v2/meetings/${meeting_id}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const params = {
        TableName: process.env.DYNAMO_DB_MEETINGS_TABLE_NAME,
        Key: {
            MEETING_ID: meeting_id
        }
    };

    try{
        await client.send(new DeleteCommand(params));
        response.status(200).json({ 
            message: "Meeting deleted successfully",
            meeting_id: meeting_id 
        });

    }catch(error){
        response.status(500).json({message: error.message});
    };
};

const GetMeetingStats = async(request, response) => {

    const params = {
        TableName: process.env.DYNAMO_DB_MEETINGS_TABLE_NAME
    };

    try{
        const dbResponse = await client.send(new ScanCommand(params));
        const meetings = dbResponse.Items;

        const now = new Date();
        
        let scheduled = 0;
        let ongoing = 0;
        let completed = 0;

        meetings.forEach(meeting => {
            const meetingTime = new Date(meeting.meeting_time_ist);
            const duration = meeting.duration || 60; // Default 60 minutes if not specified
            const meetingEndTime = new Date(meetingTime.getTime() + duration * 60000);

            if (now < meetingTime) {
                // Meeting hasn't started yet
                scheduled++;
            } else if (now >= meetingTime && now <= meetingEndTime) {
                // Meeting is currently happening
                ongoing++;
            } else {
                // Meeting has ended
                completed++;
            }
        });

        const total = meetings.length;

        response.status(200).json({
            stats: {
                scheduled,
                ongoing,
                completed,
                total
            }
        });

    }catch(error){
        response.status(500).json({message: error.message});
    };
};

const FetchTeachersMeetings = async(request, response) => {
    const owner = request.token.id.user_id;
    try{
        // Calculate this week's date range (Sunday to Saturday)
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Start of this week (Sunday at 00:00:00 UTC)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - currentDay);
        startOfWeek.setHours(0, 0, 0, 0);
        
        // End of this week (Saturday at 23:59:59 UTC)
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        const params = {
            TableName: process.env.DYNAMO_DB_MEETINGS_TABLE_NAME,
            FilterExpression: '#owner = :ownerValue AND meeting_time_ist BETWEEN :startDate AND :endDate',
            ExpressionAttributeNames: {
                '#owner': 'owner'
            },
            ExpressionAttributeValues: {
                ':ownerValue': owner,
                ':startDate': startOfWeek.toISOString(),
                ':endDate': endOfWeek.toISOString()
            }
        };

        const result = await client.send(new ScanCommand(params));
        
        // Add status to each meeting
        const nowTimestamp = now.getTime();
        
        const meetingsWithStatus = result.Items.map(meeting => {
            const meetingDateTime = new Date(meeting.meeting_time_ist);
            const duration = meeting.duration || 60;
            const meetingEndTime = new Date(meetingDateTime.getTime() + duration * 60000);
            
            const meetingStartTimestamp = meetingDateTime.getTime();
            const meetingEndTimestamp = meetingEndTime.getTime();
            
            let status;
            if (nowTimestamp < meetingStartTimestamp) {
                status = 'scheduled';
            } else if (nowTimestamp >= meetingStartTimestamp && nowTimestamp <= meetingEndTimestamp) {
                status = 'ongoing';
            } else {
                status = 'completed';
            }
            
            return {
                ...meeting,
                status: status
            };
        });
        
        // Sort by meeting time (earliest first)
        meetingsWithStatus.sort((a, b) => 
            new Date(a.meeting_time_ist).getTime() - new Date(b.meeting_time_ist).getTime()
        );
        
        response.status(200).json({
            message: "Meetings fetched successfully",
            data: meetingsWithStatus,
            count: meetingsWithStatus.length,
            weekRange: {
                start: startOfWeek.toISOString(),
                end: endOfWeek.toISOString()
            }
        });

    }catch(error){
        console.error('Error fetching meetings:', error);
        response.status(500).json({message: "Unable to fetch meetings"});
    };
};

const FetchAggregates = async(request, response) => {
    const owner = request.token.id.user_id;
    
    try{
        
       const now = new Date();
        const dayOfWeek = now.getDay(); 
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; 
        
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + mondayOffset);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        const formatTimestamp = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        };
        
        const startTimestamp = formatTimestamp(startOfWeek);
        const endTimestamp = formatTimestamp(endOfWeek);

        const params = {
            TableName: process.env.DYNAMO_DB_MEETINGS_TABLE_NAME,
            FilterExpression: '#owner = :ownerValue AND #meeting_time_ist BETWEEN :startDate AND :endDate',
            ExpressionAttributeNames: {
                '#owner': 'owner',
                '#meeting_time_ist': 'meeting_time_ist'
            },
            ExpressionAttributeValues: {
                ':ownerValue': owner,
                ':startDate': startTimestamp,
                ':endDate': endTimestamp
            },
            Select: 'COUNT'
        };

        const meetingsParams = {
            TableName: process.env.DYNAMO_DB_STUDENT_USERS_TABLE_NAME
        };



        const result = await client.send(new ScanCommand(params));
        const student_results = await client.send(new ScanCommand(meetingsParams))
       

        response.status(200).json({
           
            meetings_count: result.Count,
            student_count: student_results.Items.length
        });

    }catch(error){
        console.error('Error fetching weekly meetings count:', error);
        response.status(500).json({message: "Unable to fetch weekly meetings count"});
    };
};


const FetchHistoricalMeetings = async (request, response) => {
    const owner = request.token.id.user_id;

    try {
        const params = {
        TableName: process.env.DYNAMO_DB_MEETINGS_TABLE_NAME,

        // Since "owner" is NOT a partition key, use FilterExpression
        FilterExpression: "#owner = :ownerValue",
        ExpressionAttributeNames: {
            "#owner": "owner",
        },
        ExpressionAttributeValues: {
            ":ownerValue": owner,
        },
        };

        const DBResponse = await client.send(new ScanCommand(params));

        const now = new Date();
        
        // Transform meetings to match frontend interface
        const meetingsWithStatus = DBResponse.Items.map(meeting => {
            const meetingDateTime = new Date(meeting.meeting_time_ist);
            const duration = meeting.duration || 60;
            const meetingEndTime = new Date(meetingDateTime.getTime() + duration * 60000);

            let status;
            if (now < meetingDateTime) {
                status = 'scheduled';
            } else if (now >= meetingDateTime && now <= meetingEndTime) {
                status = 'ongoing';
            } else {
                status = 'completed';
            }

            // Extract date and time from meeting_time_ist
            const dateObj = new Date(meeting.meeting_time_ist);
            const date = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            const time = dateObj.toTimeString().slice(0, 5); // HH:MM

            // Get participant details (student IDs and names)
            const studentIds = meeting.participants || [];

            return {
                id: meeting.MEETING_ID,
                title: meeting.title || `Meeting ${meeting.MEETING_ID}`, // Generate title if not present
                description: meeting.description || '',
                date: date,
                time: time,
                duration: duration,
                teacherId: meeting.owner || '',
                teacherName: meeting.owner_name || meeting.owner || '', // Use owner_name if available
                studentIds: studentIds,
                meetingLink: meeting.url || '',
                status: status
            };
        });

        response.status(200).json({meetings: meetingsWithStatus});


    } catch (error) {
        console.error("Error fetching historic meetings:", error);
        return response
        .status(500)
        .json({ message: "Unable to fetch historical meetings" });
    }
};


const FetchStudentsHistoricMeetings = async(request, response) => {
  const studentId = request.token.id.student_id;
  const params = {
    TableName: process.env.DYNAMO_DB_MEETINGS_TABLE_NAME,
    FilterExpression: "contains(participants, :studentId)",
    ExpressionAttributeValues: {
      ":studentId": studentId
    }
  };

  try {
    const DBResponse = await client.send(new ScanCommand(params));
    
    // Always use UTC for comparisons
    const now = new Date(); // This is always in UTC internally

    const meetingsWithStatus = DBResponse.Items.map(meeting => {
      // Parse meeting time (stored as UTC)
      const meetingDateTime = new Date(meeting.meeting_time_ist);
      const duration = meeting.duration || 60;
      const meetingEndTime = new Date(meetingDateTime.getTime() + duration * 60000);
      
      // Compare using UTC timestamps (milliseconds since epoch)
      const nowTimestamp = now.getTime();
      const meetingStartTimestamp = meetingDateTime.getTime();
      const meetingEndTimestamp = meetingEndTime.getTime();
      
      let status;
      if (nowTimestamp < meetingStartTimestamp) {
        status = 'scheduled';
      } else if (nowTimestamp >= meetingStartTimestamp && nowTimestamp <= meetingEndTimestamp) {
        status = 'ongoing';
      } else {
        status = 'completed';
      }

      // Convert to IST for display purposes only
      const istDate = new Date(meetingDateTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const date = istDate.toISOString().split('T')[0];
      const time = istDate.toTimeString().slice(0, 5);

      const studentIds = meeting.participants || [];

      return {
        id: meeting.MEETING_ID,
        title: meeting.title || `Meeting ${meeting.MEETING_ID}`,
        description: meeting.description || '',
        date: date,
        time: time,
        duration: duration,
        teacherId: meeting.owner || '',
        teacherName: meeting.owner_name || meeting.owner || '',
        studentIds: studentIds,
        meetingLink: meeting.url || '',
        status: status
      };
    });

    response.status(200).json({meetings: meetingsWithStatus});
  } catch(error) {
    response.status(500).json({message: error.message});
  }
};


export {ListMeetings, DeleteMeeting, GetMeetingStats, FetchTeachersMeetings, FetchAggregates, FetchHistoricalMeetings, FetchStudentsHistoricMeetings};