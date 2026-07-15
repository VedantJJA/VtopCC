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
  getDebugData
} from '../controllers/data.controller';

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

export default router;
