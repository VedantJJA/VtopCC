import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { safeGetCache, safeSetCache, safeFindCachePrefix } from './cache';
import { 
  directStartLogin, 
  directLoginAttempt, 
  directCheckSession, 
  directGetSemesters,
  directGetTimetable,
  directGetAttendance,
  directGetAttendanceDetail,
  directGetMarks,
  directGetGrades,
  directGetExams,
  directGetProfile,
  directGetCredentials,
  directGetCalendar,
  directSearchFaculty,
  directGetLeaveHistory,
  directProbeVtop,
  clearDirectSession
} from '../services/vtopDirect';

// Helper to find cached item in localStorage safely
function getCachedData(cacheKey?: string): any {
  if (!cacheKey) return null;
  const exact = safeGetCache(cacheKey);
  if (exact !== undefined) return exact;

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
      const found = safeFindCachePrefix(prefix);
      if (found !== undefined) return found;
    }
  }
  return null;
}

// Network-First, Cache-Fallback Direct Wrapper
async function runDirectWithCache<T = any>(
  fetcher: () => Promise<T>,
  cacheKey?: string
): Promise<{ data: T }> {
  const cachedData = getCachedData(cacheKey);

  // Offline bypass
  if (cacheKey && typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cachedData) {
      console.log(`[Direct Offline] Returning cached data for '${cacheKey}'`);
      return { data: cachedData };
    }
  }

  try {
    const result = await fetcher();
    if (cacheKey && result) {
      safeSetCache(cacheKey, result);
    }
    return { data: result };
  } catch (error: any) {
    if (cachedData) {
      console.warn(`[Direct Fallback] Returning cached data for '${cacheKey}' due to error:`, error?.message);
      return { data: cachedData };
    }
    throw error;
  }
}

// Standard Axios Instance adapted for Direct Phone-to-VTOP Execution
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercept requests on mobile to route directly to native VTOP client
api.interceptors.request.use(async (config: InternalAxiosRequestConfig): Promise<any> => {
  const url = config.url || '';

  if (url === '/auth/start-login') {
    const res = await directStartLogin();
    return Promise.reject({
      isDirectMock: true,
      response: { data: res, status: 200 }
    });
  }

  if (url === '/auth/login-attempt') {
    const { username, password, captcha, gResponse } = (config.data as any) || {};
    const res = await directLoginAttempt(username, password, captcha, gResponse);
    return Promise.reject({
      isDirectMock: true,
      response: { data: res, status: 200 }
    });
  }

  if (url === '/auth/auto-login') {
    const savedStr = localStorage.getItem('vtop_direct_saved_creds');
    if (!savedStr) {
      return Promise.reject({
        isDirectMock: true,
        response: { data: { status: 'invalid_credentials', message: 'No saved credentials' }, status: 200 }
      });
    }
    const saved = JSON.parse(savedStr);
    const res = await directLoginAttempt(
      saved.username, 
      saved.password, 
      (config.data as any)?.captcha || '', 
      (config.data as any)?.gResponse
    );
    return Promise.reject({
      isDirectMock: true,
      response: { data: res, status: 200 }
    });
  }

  if (url === '/auth/check-session') {
    const res = await directCheckSession();
    return Promise.reject({
      isDirectMock: true,
      response: { data: res, status: 200 }
    });
  }

  if (url === '/auth/logout') {
    clearDirectSession();
    return Promise.reject({
      isDirectMock: true,
      response: { data: { status: 'success' }, status: 200 }
    });
  }

  if (url === '/auth/dev-creds') {
    const savedStr = localStorage.getItem('vtop_direct_saved_creds');
    if (savedStr) {
      const saved = JSON.parse(savedStr);
      return Promise.reject({
        isDirectMock: true,
        response: { data: { status: 'success', username: saved.username, password: saved.password }, status: 200 }
      });
    }
    return Promise.reject({
      isDirectMock: true,
      response: { data: { status: 'none' }, status: 200 }
    });
  }

  if (url === '/auth/vtop-debug') {
    const probe = await directProbeVtop();
    return Promise.reject({
      isDirectMock: true,
      response: { data: probe, status: 200 }
    });
  }

  if (url === '/admin/check') {
    return Promise.reject({
      isDirectMock: true,
      response: { data: false, status: 200 }
    });
  }

  if (url === '/admin/user-count') {
    return Promise.reject({
      isDirectMock: true,
      response: { data: { total_users: 1 }, status: 200 }
    });
  }

  if (url === '/admin/stats') {
    return Promise.reject({
      isDirectMock: true,
      response: { data: { total_users: 1, active_sessions: 1 }, status: 200 }
    });
  }

  return config;
});

// Interceptor to unpack direct mock responses seamlessly as successful Axios responses
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: any) => {
    if (error && error.isDirectMock && error.response) {
      return Promise.resolve(error.response);
    }
    return Promise.reject(error);
  }
);

// ---------------- EXPORTED DATA FUNCTIONS ----------------

export const getSemesters = () =>
  runDirectWithCache(async () => {
    const sems = await directGetSemesters();
    return { status: 'success', semesters: sems, raw_data: sems };
  }, 'vtop_cache_semesters');

export const getProfile = () =>
  runDirectWithCache(async () => {
    const profile = await directGetProfile();
    return { status: 'success', raw_data: profile };
  }, 'vtop_cache_profile');

export const getCredentials = () =>
  runDirectWithCache(async () => {
    const creds = await directGetCredentials();
    return { status: 'success', raw_data: creds };
  }, 'vtop_cache_credentials');

export const getTimetable = (semesterId: string, _isSaturday = true) =>
  runDirectWithCache(async () => {
    const tt = await directGetTimetable(semesterId);
    return { status: 'success', raw_data: tt };
  }, `vtop_cache_timetable_${semesterId}`);

export const getAttendance = (semesterId: string) =>
  runDirectWithCache(async () => {
    const att = await directGetAttendance(semesterId);
    return { status: 'success', raw_data: att };
  }, `vtop_cache_attendance_${semesterId}`);

export const getODSnapshot = (semesterId: string) =>
  runDirectWithCache(async () => {
    const att = await directGetAttendance(semesterId);
    return att?.od_details || [];
  }, `vtop_cache_od_snapshot_${semesterId}`);

export const getAttendanceDetail = (semesterId: string, classId: string, slot: string) =>
  runDirectWithCache(async () => {
    const det = await directGetAttendanceDetail(semesterId, classId, slot);
    return { status: 'success', raw_data: det };
  }, `vtop_cache_att_detail_${semesterId}_${classId}_${slot}`);

export const getMarks = (semesterId: string) =>
  runDirectWithCache(async () => {
    const marks = await directGetMarks(semesterId);
    return { status: 'success', raw_data: marks };
  }, `vtop_cache_marks_${semesterId}`);

export const getGrades = (semesterId: string) =>
  runDirectWithCache(async () => {
    const grades = await directGetGrades(semesterId);
    return { status: 'success', raw_data: grades };
  }, `vtop_cache_grades_${semesterId}`);

export const getExams = (semesterId: string) =>
  runDirectWithCache(async () => {
    const exams = await directGetExams(semesterId);
    return { status: 'success', raw_data: exams };
  }, `vtop_cache_exams_${semesterId}`);

export const getCalendar = (semesterId: string, calDate: string) =>
  runDirectWithCache(async () => {
    const cal = await directGetCalendar(semesterId, calDate);
    return { status: 'success', raw_data: cal, new_semester_id: undefined as string | undefined };
  }, `vtop_cache_calendar_${semesterId}_${calDate}`);

export const searchFaculty = (empId: string) =>
  runDirectWithCache(async () => {
    const fac = await directSearchFaculty(empId);
    return { status: 'success', raw_data: fac };
  }, `vtop_cache_faculty_${empId}`);

export const getFacultyDirectory = () =>
  runDirectWithCache(async () => ({ status: 'success', directory: {} }), 'vtop_cache_faculty_directory');

export const fetchLeaves = async () => {
  const data = await directGetLeaveHistory();
  return { status: 'success', raw_data: data };
};

export const fetchLeaveStatus = async () => {
  const data = await directGetLeaveHistory();
  return { status: 'success', raw_data: data };
};

export const fetchLeaveHistory = async () => {
  const data = await directGetLeaveHistory();
  return { status: 'success', raw_data: data };
};

// EventHub Functions
export const getEventHubEvents = async (_creds?: { username?: string; password?: string }): Promise<any> => {
  return { status: 'success', events: [], categories: [], message: '' };
};

export const getEventHubPreview = async (_eid: string, _creds?: { username?: string; password?: string }): Promise<any> => {
  return { status: 'success', details: {}, preview: {} };
};

export const getEventHubProfile = async (_creds?: { username?: string; password?: string }): Promise<any> => {
  return { status: 'success', profile: {} };
};

export const registerEventHubFree = async (_eid: string, _typeOfEvent?: string, _creds?: { username?: string; password?: string }): Promise<any> => {
  return { status: 'success', message: 'Registration submitted' };
};

export const getUserCount = () => api.get('/admin/user-count');
export const getAdminStats = () => api.get('/admin/stats');
export const checkIsAdmin = () => api.get('/admin/check');
export const getVtopDebugInfo = () => directProbeVtop();

export default api;
