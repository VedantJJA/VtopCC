import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Generic Stale-While-Revalidate & Offline Fallback caching wrapper.
 * 1. Checks localStorage for existing cached data under `cacheKey`.
 * 2. Fires network request via Axios.
 * 3. On network success: updates localStorage cache and returns fresh data.
 * 4. On network error (offline/timeout/server error): catches error, logs warning,
 *    and returns cached data if available to prevent UI crashes.
 */
export async function fetchWithCache<T = any>(
  endpoint: string,
  payload?: any,
  cacheKey?: string
): Promise<{ data: T }> {
  let cachedData: any = null;

  if (cacheKey) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        cachedData = JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[Cache] Error reading key '${cacheKey}':`, e);
    }
  }

  try {
    const res = await api.post(endpoint, payload);
    if (cacheKey && res && res.data) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch (e) {
        console.warn(`[Cache] Error saving key '${cacheKey}':`, e);
      }
    }
    return res;
  } catch (err: any) {
    console.warn(`[Network/Cache] Request to '${endpoint}' failed:`, err?.message || err);

    if (cachedData) {
      console.log(`[Cache] Returning stale cached response for '${cacheKey}'`);
      return { data: cachedData } as any;
    }

    throw err;
  }
}

// Data service API calls with Stale-While-Revalidate caching keys
export const getSemesters = () => 
  fetchWithCache('/data/semesters', undefined, 'vtop_cache_semesters');

export const getProfile = () => 
  fetchWithCache('/data/profile', undefined, 'vtop_cache_profile');

export const getCredentials = () => 
  fetchWithCache('/data/credentials', undefined, 'vtop_cache_credentials');

export const getTimetable = (semesterId: string) => 
  fetchWithCache('/data/timetable', { semesterId, isSaturday: true }, `vtop_cache_timetable_${semesterId}`);

export const getAttendance = (semesterId: string) => 
  fetchWithCache('/data/attendance', { semesterId }, `vtop_cache_attendance_${semesterId}`);

export const getODSnapshot = (semesterId: string) => 
  fetchWithCache('/data/get-od-snapshot', { semesterId }, `vtop_cache_od_snapshot_${semesterId}`);

export const getAttendanceDetail = (semesterId: string, classId: string, slot: string) => 
  fetchWithCache('/data/attendance-detail', { semesterId, classId, slot }, `vtop_cache_att_detail_${semesterId}_${classId}_${slot}`);

export const getMarks = (semesterId: string) => 
  fetchWithCache('/data/marks', { semesterId }, `vtop_cache_marks_${semesterId}`);

export const getGrades = (semesterId: string) => 
  fetchWithCache('/data/grades', { semesterId }, `vtop_cache_grades_${semesterId}`);

export const getExams = (semesterId: string) => 
  fetchWithCache('/data/exams', { semesterId }, `vtop_cache_exams_${semesterId}`);

export const getCalendar = (semesterId: string, calDate: string) => 
  fetchWithCache('/data/calendar', { semesterId, calDate }, `vtop_cache_calendar_${semesterId}_${calDate}`);

export const searchFaculty = (empId: string) => 
  fetchWithCache('/data/faculty', { empId }, `vtop_cache_faculty_${empId}`);

export const getFacultyDirectory = () => 
  fetchWithCache('/data/faculty-directory', undefined, 'vtop_cache_faculty_directory');

export default api;
