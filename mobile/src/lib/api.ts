import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { safeGetCache, safeSetCache, safeFindCachePrefix, safeGetCalendarCacheForMonth } from './cache';
import { 
  directStartLogin, 
  directLoginAttempt, 
  directCheckSession, 
  ensureDirectSession,
  directGetSemesters,
  directGetTimetable,
  directGetAttendance,
  directGetAttendanceDetail,
  directGetODSnapshot,
  directGetMarks,
  directGetGrades,
  directGetExams,
  directGetProfile,
  directGetCredentials,
  directGetCalendar,
  directSearchFaculty,
  directGetFacultyDirectory,
  directGetLeaveStatus,
  directGetLeaveHistory,
  directProbeVtop,
  clearDirectSession
} from '../services/vtopDirect';

import {
  directGetEventHubEvents,
  directGetEventHubPreview,
  directGetEventHubProfile,
  directRegisterEventHubFree
} from '../services/eventHubDirect';

// Helper to find cached item in localStorage safely
function getCachedData(cacheKey?: string): any {
  if (!cacheKey) return null;
  const exact = safeGetCache(cacheKey);
  if (exact !== undefined) return exact;

  // Exact calendar lookup for month and year
  if (cacheKey.startsWith('vtop_cache_calendar_')) {
    const parts = cacheKey.split('_');
    const year = parseInt(parts[parts.length - 1], 10);
    const month = parseInt(parts[parts.length - 2], 10);
    if (!isNaN(month) && !isNaN(year)) {
      const found = safeGetCalendarCacheForMonth(month, year);
      if (found !== undefined) return found;
    }
  }

  const prefixes = [
    'vtop_cache_timetable_',
    'vtop_cache_attendance_',
    'vtop_cache_marks_',
    'vtop_cache_grades_',
    'vtop_cache_exams_',
    'vtop_cache_od_snapshot_'
  ];

  for (const prefix of prefixes) {
    if (cacheKey.startsWith(prefix)) {
      const found = safeFindCachePrefix(prefix);
      if (found !== undefined) return found;
    }
  }
  return null;
}

// Normalizes cached data into a resilient Axios-compatible response
function wrapResponseData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === 'object' && ('status' in data || 'raw_data' in data || 'semesters' in data || 'directory' in data)) {
    return data;
  }
  return {
    status: 'success',
    raw_data: data,
    semesters: Array.isArray(data) ? data : undefined,
    directory: typeof data === 'object' && !Array.isArray(data) ? data : undefined,
    ...(typeof data === 'object' && !Array.isArray(data) ? data : {})
  };
}

// Atomic Network-First with Auto-Renew and Safe Cache-Fallback
async function runDirectWithCache<T = any>(
  fetcher: () => Promise<T>,
  cacheKey?: string
): Promise<{ data: T }> {
  const cachedData = getCachedData(cacheKey);

  // Offline bypass: if device reports offline, serve cache immediately without network delay
  if (cacheKey && typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cachedData !== null && cachedData !== undefined) {
      console.log(`[Direct Offline] Returning cached data for '${cacheKey}'`);
      return { data: wrapResponseData(cachedData) };
    }
  }

  try {
    const result = await fetcher();
    if (cacheKey && result) {
      const toCache = (result as any)?.raw_data ?? (result as any)?.semesters ?? (result as any)?.directory ?? result;
      safeSetCache(cacheKey, toCache);
    }
    return { data: result };
  } catch (error: any) {
    const isSessionDrop = error?.message?.includes('Session expired or invalid') || 
                          error?.message?.includes('vtopLoginForm') ||
                          error?.response?.status === 401;

    // If session expired and credentials exist, attempt silent auto-renewal once
    if (isSessionDrop) {
      console.log(`[Direct Auto-Renew] Session expired for '${cacheKey}', attempting recovery...`);
      try {
        const renewed = await ensureDirectSession(true);
        if (renewed) {
          console.log(`[Direct Auto-Renew] Retrying '${cacheKey}' with fresh session...`);
          const retryResult = await fetcher();
          if (cacheKey && retryResult) {
            const toCache = (retryResult as any)?.raw_data ?? (retryResult as any)?.semesters ?? (retryResult as any)?.directory ?? retryResult;
            safeSetCache(cacheKey, toCache);
          }
          return { data: retryResult };
        }
      } catch (renewErr) {
        console.warn(`[Direct Auto-Renew] Silent renewal attempt failed:`, renewErr);
      }
    }

    // Atomic fallback: keep current data completely intact if fetch or renewal fails
    if (cachedData !== null && cachedData !== undefined) {
      console.warn(`[Direct Fallback] Retaining cached data for '${cacheKey}' due to error:`, error?.message);
      return { data: wrapResponseData(cachedData) };
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

  if (url === '/data/leaves' || url === '/data/leave-status') {
    const res = await directGetLeaveStatus();
    return Promise.reject({
      isDirectMock: true,
      response: { data: { status: 'success', raw_data: res }, status: 200 }
    });
  }

  if (url === '/data/leave-history') {
    const res = await directGetLeaveHistory();
    return Promise.reject({
      isDirectMock: true,
      response: { data: { status: 'success', raw_data: res }, status: 200 }
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

export const getTimetable = (semesterId: string, isSaturday = true) =>
  runDirectWithCache(async () => {
    const tt = await directGetTimetable(semesterId, isSaturday);
    return { status: 'success', raw_data: tt };
  }, `vtop_cache_timetable_${semesterId}`);

export const getAttendance = (semesterId: string) =>
  runDirectWithCache(async () => {
    const att = await directGetAttendance(semesterId);
    return { status: 'success', raw_data: att };
  }, `vtop_cache_attendance_${semesterId}`);

export const getODSnapshot = (semesterId: string) =>
  runDirectWithCache(async () => {
    const snapshot = await directGetODSnapshot(semesterId);
    return snapshot;
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
    return { status: 'success', raw_data: cal, new_semester_id: cal?.new_semester_id };
  }, `vtop_cache_calendar_${semesterId}_${calDate}`);

export const searchFaculty = (empIdOrName: string) =>
  runDirectWithCache(async () => {
    const fac = await directSearchFaculty(empIdOrName);
    return { status: 'success', raw_data: fac };
  }, `vtop_cache_faculty_${empIdOrName}`);

export const getFacultyDirectory = () =>
  runDirectWithCache(async () => {
    const dir = directGetFacultyDirectory();
    return { status: 'success', directory: dir };
  }, 'vtop_cache_faculty_directory');

export const fetchLeaves = async () => {
  const data = await directGetLeaveStatus();
  return { status: 'success', raw_data: data };
};

export const fetchLeaveStatus = async () => {
  const data = await directGetLeaveStatus();
  return { status: 'success', raw_data: data };
};

export const fetchLeaveHistory = async () => {
  const data = await directGetLeaveHistory();
  return { status: 'success', raw_data: data };
};

// EventHub Functions directly executing on mobile phone
export const getEventHubEvents = async (creds?: { username?: string; password?: string }): Promise<any> => {
  return directGetEventHubEvents(creds);
};

export const getEventHubPreview = async (eid: string, creds?: { username?: string; password?: string }): Promise<any> => {
  return directGetEventHubPreview(eid, creds);
};

export const getEventHubProfile = async (creds?: { username?: string; password?: string }): Promise<any> => {
  return directGetEventHubProfile(creds);
};

export const registerEventHubFree = async (eid: string, typeOfEvent?: string, creds?: { username?: string; password?: string }): Promise<any> => {
  return directRegisterEventHubFree(eid, typeOfEvent, creds);
};

export const getUserCount = () => api.get('/admin/user-count');
export const getAdminStats = () => api.get('/admin/stats');
export const checkIsAdmin = () => api.get('/admin/check');
export const getVtopDebugInfo = () => directProbeVtop();

export default api;
