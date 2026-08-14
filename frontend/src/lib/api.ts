import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Helper to find cached item in localStorage.
 * Handles exact key lookup and prefix fallback (e.g. if semester ID differs offline).
 */
function getCachedData(cacheKey?: string): any {
  if (!cacheKey) return null;
  try {
    const exact = localStorage.getItem(cacheKey);
    if (exact) {
      return JSON.parse(exact);
    }

    // Prefix fallbacks for dynamic keys
    const prefixes = [
      'vtop_cache_timetable_',
      'vtop_cache_attendance_',
      'vtop_cache_marks_',
      'vtop_cache_grades_',
      'vtop_cache_exams_',
      'vtop_cache_calendar_'
    ];

    for (const prefix of prefixes) {
      if (cacheKey.startsWith(prefix)) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const item = localStorage.getItem(key);
            if (item) {
              return JSON.parse(item);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn(`[Cache] Error reading key '${cacheKey}':`, e);
  }
  return null;
}

/**
 * Generic Network-First, Fallback-to-Cache API Wrapper.
 * 1. Step A (Offline bypass): If navigator.onLine is false, immediately return cached data.
 * 2. Step B & C: Attempt Axios POST request. On success & valid status, store res.data into localStorage under `cacheKey`.
 * 3. Step D: On network failure or session/server error, return cached data if available to prevent blank screens.
 * 4. Step E: Only throw error if no cached data is available.
 */
export async function fetchWithCache<T = any>(
  endpoint: string,
  payload?: any,
  cacheKey?: string
): Promise<{ data: T }> {
  const cachedData = getCachedData(cacheKey);

  // Step A: Quick offline bypass when navigator.onLine is false
  if (cacheKey && typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cachedData) {
      console.log(`[Offline Bypass] Returning cached data for '${cacheKey}'`);
      return { data: cachedData };
    }
  }

  // Step B & C: Attempt network request in try block
  try {
    const res = await api.post(endpoint, payload);

    // If server response indicates success, save to cache and return
    if (res && res.data && res.data.status !== 'error') {
      if (cacheKey) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {
          console.warn(`[Cache] Error writing key '${cacheKey}':`, e);
        }
      }
      return res;
    }

    // If server returned status: 'error' (e.g. session expired on VTOP), but we have cached data,
    // fallback to cached data so the UI remains visible instead of going blank
    if (cachedData) {
      console.warn(`[Server Error Fallback] Returning cached data for '${cacheKey}' due to server status: ${res?.data?.message}`);
      return { data: cachedData };
    }

    return res;
  } catch (error: any) {
    // Step D: Fallback to cache on network failure (offline / timeout / 500)
    if (cachedData) {
      console.warn(`[Network Failure Fallback] Returning cached data for '${cacheKey}' due to network error:`, error?.message || error);
      return { data: cachedData };
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

export const fetchLeaves = async () => {
  const response = await api.post('/data/leaves');
  return response.data;
};

export const fetchLeaveStatus = async () => {
  const response = await api.post('/data/leave-status', {});
  return response.data;
};

export const fetchLeaveHistory = async () => {
  const response = await api.post('/data/leave-history', {});
  return response.data;
};

// Admin API functions (GET requests, no caching)
export const getUserCount = () => api.get('/admin/user-count');
export const getAdminStats = () => api.get('/admin/stats');
export const checkIsAdmin = () => api.get('/admin/check');

export default api;
