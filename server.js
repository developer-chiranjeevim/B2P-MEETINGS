import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import HomeRouter from "./routes/HomeRoute.js";
import MeetingRoutes from "./routes/MeetingRoutes.js";
import AssingmentRoutes from "./routes/AssignmentRoutes.js";
import PaymentsRouter from "./routes/PaymentsRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;



app.use(cors());
app.use(express.json());

app.use("/apis", HomeRouter);
app.use("/apis", MeetingRoutes);
app.use("/apis", AssingmentRoutes);
app.use("/apis", PaymentsRouter);



app.listen(PORT, (error) => {
    if(error){
        console.log(error.message);
    }else{
        console.log(`SERVER STARTED ON PORT : ${PORT}`);
    };
});