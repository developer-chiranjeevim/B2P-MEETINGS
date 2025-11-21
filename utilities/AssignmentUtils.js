import dotenv from "dotenv";
import { client } from "../db/dbConfig.js";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

dotenv.config();

const CreateAssignment = async(datas) => {

    console.log(process.env.DYNAMO_DB_ASSIGNMENTS_TABLE_NAME);
    const params = {
        TableName:process.env.DYNAMO_DB_ASSIGNMENTS_TABLE_NAME,
        Item: datas
    };

    try{

        await client.send(new PutCommand(params));
        return 1

    }catch(error){
        console.log(error.message);
        return 0;
    };
};



export {CreateAssignment};