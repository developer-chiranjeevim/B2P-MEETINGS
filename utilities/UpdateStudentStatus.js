import dotenv from "dotenv";
import { client } from "../db/dbConfig.js";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";

dotenv.config();

const UpdateStudentStats = async(participants, status) => {
    try{
        // Use Promise.allSettled to handle individual failures
        const results = await Promise.allSettled(
            participants.map(async(student) => {
                console.log(student);
                let params = {
                    TableName: process.env.DYNAMO_DB_STUDENT_USERS_TABLE_NAME,
                    Key: {
                        student_id: student
                    },
                    UpdateExpression: "SET #availStatus = :statusValue",
                    ExpressionAttributeNames: {
                        "#availStatus": "availStatus"
                    },
                    ExpressionAttributeValues: {
                        ":statusValue": status
                    },
                    ReturnValues: "ALL_NEW"
                };

                return await client.send(new UpdateCommand(params));
            })
        );

        // Check results
        const succeeded = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        console.log(`✓ ${succeeded.length} succeeded, ✗ ${failed.length} failed`);
        
        if (failed.length > 0) {
            failed.forEach((f, i) => {
                console.error(`Failed update ${i}:`, f.reason.message);
            });
        }

        return succeeded.length === participants.length;

    }catch(error){
        console.log("Unexpected error:", error);
        return false;
    }
};

export {UpdateStudentStats};