import axios from 'axios';

// The base URL will point to /api so it uses the Vite proxy during dev
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
