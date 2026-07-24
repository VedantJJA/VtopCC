import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Generic Network-First, Fallback-to-Cache API Wrapper.
 * - Step A (Offline bypass): If navigator.onLine is false, immediately return cached data from localStorage.
 * - Step B & C: Attempt Axios POST request. On success, store res.data into localStorage under `cacheKey`.
 * - Step D: On network failure (error), check if cached data exists under `cacheKey`.
 *   If cached data exists, return { data: cached } to prevent crashing the UI.
 * - Step E: Only throw an error if no cached data exists.
 */
export async function fetchWithCache<T = any>(
  endpoint: string,
  payload?: any,
  cacheKey?: string
): Promise<{ data: T }> {
  // Step A: Quick offline bypass when navigator.onLine is false
  if (cacheKey && typeof navigator !== 'undefined' && !navigator.onLine) {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        console.log(`[Offline Bypass] Returning cached data for '${cacheKey}'`);
        return { data: JSON.parse(cached) };
      }
    } catch (e) {
      console.warn(`[Offline Bypass] Error reading cache key '${cacheKey}':`, e);
    }
  }

  // Step B & C: Attempt network request in try block
  try {
    const res = await api.post(endpoint, payload);
    if (cacheKey && res && res.data) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch (e) {
        console.warn(`[Cache] Error writing key '${cacheKey}':`, e);
      }
    }
    return res;
  } catch (error: any) {
    // Step D: Fallback to cache on network failure
    if (cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          console.warn(`[Network Failure Fallback] Returning cached data for '${cacheKey}' due to error:`, error?.message || error);
          return { data: JSON.parse(cached) };
        }
      } catch (e) {
        console.warn(`[Cache Fallback] Error reading key '${cacheKey}':`, e);
      }
    }
    // Step E: Only throw if we have no cached data to show
    throw error;
  }
}

// API functions wrapping endpoints with endpoint-specific cache keys
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
