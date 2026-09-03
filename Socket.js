import {io} from "socket.io-client"

const socket = io("https://chatapp-backend-0y9j.onrender.com", {
    transports: ["websocket"],
});

export default socket;