import axios from "axios";

const api = axios.create({
  baseURL: "https://chatapp-backend-0y9j.onrender.com/api",
});

export default api;