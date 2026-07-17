import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getSemesters = () => api.post('/data/semesters');
export const getProfile = () => api.post('/data/profile');
export const getCredentials = () => api.post('/data/credentials');

export const getTimetable = (semesterId: string) => 
  api.post('/data/timetable', { semesterId, isSaturday: true });

export const getAttendance = (semesterId: string) => 
  api.post('/data/attendance', { semesterId });

export const getODSnapshot = (semesterId: string) => 
  api.post('/data/get-od-snapshot', { semesterId });

export const getAttendanceDetail = (semesterId: string, classId: string, slot: string) => 
  api.post('/data/attendance-detail', { semesterId, classId, slot });

export const getMarks = (semesterId: string) => 
  api.post('/data/marks', { semesterId });

export const getGrades = (semesterId: string) => 
  api.post('/data/grades', { semesterId });

export const getExams = (semesterId: string) => 
  api.post('/data/exams', { semesterId });

export const getCalendar = (semesterId: string, calDate: string) => 
  api.post('/data/calendar', { semesterId, calDate });

export default api;
