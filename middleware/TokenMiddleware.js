import jwt from "jsonwebtoken";

const tokenMiddleware = async(request, response, next) => {
    let token;
    
    if(request.headers.authorization && request.headers.authorization.startsWith("Bearer")){
        try{
            token = request.headers.authorization.split(" ")[1];
            const decoded_token = jwt.verify(token, process.env.JWT_SECRET_KEY);
            const now = Date.now(); 
            const expiryTime = decoded_token.exp * 1000;

            if(now > expiryTime){
                return response.status(401).json({message: "Token Expired"}); // Added 'return'
            }
            
            if(decoded_token){
                request.token = decoded_token;
                next();
            }else{
                response.status(401).json({message: "Token Revoked or Expired"});
            }
           
        }catch(error){
            response.status(400).json({message: error.message});
        }

    }else{
        return response.status(401).json({message: "Not Authorized, Token Not Found"});
    }
};

export default tokenMiddleware;