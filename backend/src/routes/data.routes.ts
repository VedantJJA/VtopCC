import { Router } from 'express';
import {
  getSemesters,
  getTimetable,
  getAttendance,
  getAttendanceDetail,
  getMarks,
  getGrades,
  getExams,
  getProfile,
  getCalendar,
  getCredentials,
  getDebugData,
  getODSnapshot,
  searchFaculty,
  getFacultyDirectory,
  getLeaveStatus,   // <-- Added
  getLeaveHistory   // <-- Added
} from '../controllers/data.controller';
import {
  getEvents as getEventHubEvents,
  getPreview as getEventHubPreview,
  getProfile as getEventHubProfile,
  registerFree as registerEventHubFree
} from '../controllers/eventhub.controller';

const router = Router();

router.post('/semesters', getSemesters);
router.post('/timetable', getTimetable);
router.post('/attendance', getAttendance);
router.post('/attendance-detail', getAttendanceDetail);
router.post('/marks', getMarks);
router.post('/grades', getGrades);
router.post('/exams', getExams);
router.post('/profile', getProfile);
router.post('/calendar', getCalendar);
router.post('/credentials', getCredentials);
router.post('/debug', getDebugData);
router.post('/get-od-snapshot', getODSnapshot);
router.post('/faculty', searchFaculty);
router.post('/faculty-directory', getFacultyDirectory);
router.post('/leave-status', getLeaveStatus);   // <-- Endpoint for /hostels/student/leave/4
router.post('/leave-history', getLeaveHistory); // <-- Endpoint for /hostels/student/leave/6

// EventHub endpoints
router.post('/eventhub/events', getEventHubEvents);
router.post('/eventhub/preview', getEventHubPreview);
router.post('/eventhub/profile', getEventHubProfile);
router.post('/eventhub/register-free', registerEventHubFree);

export default router;