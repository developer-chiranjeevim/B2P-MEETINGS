
const HomeController = async(request, response) => {
    response.status(200).json({message: "Hello, World from Server :)"});
};



export default HomeController;