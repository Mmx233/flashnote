import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  timeout: 30_000,
});

export default api;
