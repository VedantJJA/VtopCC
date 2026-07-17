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
  getODSnapshot
} from '../controllers/data.controller';

const router = Router();

// Middleware to map HttpOnly session cookie to req.body.session_id for scraping controllers
router.use((req: any, _res: any, next: any) => {
  if (req.cookies && req.cookies.vtop_session_id) {
    req.body = req.body || {};
    req.body.session_id = req.cookies.vtop_session_id;
  }
  next();
});

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

export default router;
