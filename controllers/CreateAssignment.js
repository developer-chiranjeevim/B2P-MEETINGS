import { CreateAssignment } from "../utilities/AssignmentUtils.js";

const createAssignment = async(request, response) => {
    try{

        const teacher_id = request.body.teacher_id;
        const questions = request.body.questions;
        const assignment_id = `teacher_id${1}`;
        
        await CreateAssignment({assignment_id, teacher_id, questions});
        response.status(200).json({message: "meeting created successfully"});
        
    }catch(error){
        response.status(500).json({message: error.message});
    };
};



export { createAssignment };