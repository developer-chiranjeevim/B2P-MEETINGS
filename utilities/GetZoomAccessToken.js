import axios from "axios";
import dotenv from "dotenv";


dotenv.config();

const ZOOM_CONFIG = {
  accountId: process.env.ZOOM_ACCOUNT_ID,
  clientId: process.env.ZOOM_CLIENT_ID,
  clientSecret: process.env.ZOOM_CLIENT_SECRETE,
};



const GetZoomAccessToken = async() => {
    try{
         const response = await axios.post(
            "https://zoom.us/oauth/token",
            null,
            {
                params: {
                grant_type: "account_credentials",
                account_id: ZOOM_CONFIG.accountId,
                },
                auth: {
                username: ZOOM_CONFIG.clientId,
                password: ZOOM_CONFIG.clientSecret,
                },
            }
        );
        return response.data.access_token;


    }catch(error){
        return -1;
    };

};



export default GetZoomAccessToken;