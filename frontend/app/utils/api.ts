import axios from "axios";

const api = axios.create({
  baseURL: "http://172.20.10.2:8000", // ⬅️ replace with your FastAPI or backend URL
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
