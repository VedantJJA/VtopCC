import React, { useState, useEffect, useRef } from 'react';
import { 
  QueryClient, 
  QueryClientProvider, 
  useMutation, 
  useQuery 
} from '@tanstack/react-query';
import api, { 
  getSemesters, 
  getProfile, 
  getCredentials, 
  getTimetable, 
  getAttendance, 
  getODSnapshot, 
  getAttendanceDetail, 
  getMarks, 
  getGrades, 
  getExams 
} from './lib/api';
import { solveCaptchaClient } from './lib/solver';
import { 
  Menu, Sun, Moon, Loader2, AlertTriangle
} from 'lucide-react';

import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { ProfileView } from './components/ProfileView';
import { TimetableView } from './components/TimetableView';
import { AttendanceView } from './components/AttendanceView';
import { FacultyView } from './components/FacultyView';
import { MarksView } from './components/MarksView';
import { GradesView } from './components/GradesView';
import { ExamsView } from './components/ExamsView';
import { CalendarView } from './components/CalendarView';
import { CredentialsView } from './components/CredentialsView';
import { HostelView } from './components/HostelView';
import { AttendanceCalculator } from './components/AttendanceCalculator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  }
});

const TIMETABLE_SLOTS = [
  { id: 1, name: 'Slot 1', theoryTime: '08:00 - 08:50', labTime: '08:00 - 08:45', key: '08:00 - 08:50' },
  { id: 2, name: 'Slot 2', theoryTime: '08:55 - 09:45', labTime: '08:50 - 09:35', key: '08:55 - 09:45' },
  { id: 3, name: 'Slot 3', theoryTime: '09:50 - 10:40', labTime: '09:50 - 10:35', key: '09:50 - 10:40' },
  { id: 4, name: 'Slot 4', theoryTime: '10:45 - 11:35', labTime: '10:40 - 11:25', key: '10:45 - 11:35' },
  { id: 5, name: 'Slot 5', theoryTime: '11:40 - 12:30', labTime: '11:40 - 12:25', key: '11:40 - 12:30' },
  { id: 6, name: 'Slot 6', theoryTime: '12:35 - 13:25', labTime: '12:30 - 13:15', key: '12:35 - 13:25' },
  { id: 'break', name: 'Lunch', theoryTime: '13:25 - 14:00', labTime: '13:15 - 14:00', key: 'LUNCH' },
  { id: 8, name: 'Slot 7', theoryTime: '14:00 - 14:50', labTime: '14:00 - 14:45', key: '14:00 - 14:50' },
  { id: 9, name: 'Slot 8', theoryTime: '14:55 - 15:45', labTime: '14:50 - 15:35', key: '14:55 - 15:45' },
  { id: 10, name: 'Slot 9', theoryTime: '15:50 - 16:40', labTime: '15:50 - 16:35', key: '15:50 - 16:40' },
  { id: 11, name: 'Slot 10', theoryTime: '16:45 - 17:35', labTime: '16:40 - 17:25', key: '16:45 - 17:35' },
  { id: 12, name: 'Slot 11', theoryTime: '17:40 - 18:30', labTime: '17:40 - 18:25', key: '17:40 - 18:30' },
  { id: 13, name: 'Slot 12', theoryTime: '18:35 - 19:25', labTime: '18:10 - 18:55', key: '18:35 - 19:25' }
];

type DashboardTab = 'dashboard' | 'profile' | 'timetable' | 'attendance' | 'marks' | 'grades' | 'exams' | 'calendar' | 'credentials' | 'my-room' | 'calculator' | 'courses' | 'faculty';
type StartLoginResponse = {
  status: 'captcha_ready';
  session_id: string;
  captcha_type?: number;
  captcha_image_data?: string;
  has_saved_creds: boolean;
};

const MAX_RETRIES = 5;

function VtopLoginDashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as any) || 'dark';
  });

  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [activeSemester, setActiveSemester] = useState<string>('');
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('vtop_session_id');
  });
  const [activeUser, setActiveUser] = useState(() => {
    return localStorage.getItem('vtop_username') || '';
  });
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return localStorage.getItem('vtop_session_id');
  });
  
  const [showManualForm, setShowManualForm] = useState(false);
  const [showCaptchaUI, setShowCaptchaUI] = useState(false);
  const [captchaImg, setCaptchaImg] = useState<string | null>(null);
  const [captchaType, setCaptchaType] = useState<number>(1);
  const [isCaptchaSolving, setIsCaptchaSolving] = useState(false);
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedAttendanceCourse, setSelectedAttendanceCourse] = useState<any | null>(null);

  const recaptchaRef = useRef<HTMLDivElement>(null);
  const autoLoginRetryCount = useRef(0);
  const manualLoginRetryCount = useRef(0);
  const initRef = useRef(false);

  // Toggle theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Set up global ReCAPTCHA callback
  useEffect(() => {
    (window as any).onRecaptchaSolved = (token: string) => {
      console.log("[ReCAPTCHA] Solved, token received:", token);
      handleRecaptchaCallback(token);
    };
    return () => {
      delete (window as any).onRecaptchaSolved;
    };
  }, [sessionId, username, password, showManualForm, hasSavedCreds]);

  // Check session on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const localSessionId = localStorage.getItem('vtop_session_id');
    const localUsername = localStorage.getItem('vtop_username');
    const explicitLogout = localStorage.getItem('vtop_explicit_logout') === 'true';

    if (explicitLogout) {
      setIsLoggedIn(false);
      startLoginFlow(false);
      return;
    }

    if (localSessionId) {
      setSessionId(localSessionId);
      setIsLoggedIn(true);
      if (localUsername) {
        setActiveUser(localUsername);
      }
      
      // Verify session integrity
      api.post('/auth/check-session', { session_id: localSessionId })
        .then((res) => {
          if (res.data.status === 'success') {
            if (res.data.username) {
              setActiveUser(res.data.username);
              localStorage.setItem('vtop_username', res.data.username);
            }
          } else {
            console.log("Session verification failed, attempting silent background autologin...");
            setIsRestoringSession(true);
            triggerSilentAutoLoginAttempt();
          }
        })
        .catch((err) => {
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            console.log("Session expired on server (401), restoring silently...");
            setIsRestoringSession(true);
            triggerSilentAutoLoginAttempt();
          }
        });
    } else {
      setIsRestoringSession(true);
      startLoginFlow(true);
    }
  }, []);

  // Axios interceptor for live 401 recovery
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (
          error.response &&
          (error.response.status === 401 || error.response.status === 403) &&
          !originalRequest._retry &&
          isLoggedIn &&
          !isRestoringSession
        ) {
          originalRequest._retry = true;
          console.log("[Interceptor] VTOP session dropped. Recovering session in background...");
          setIsRestoringSession(true);
          try {
            await triggerSilentAutoLoginAttempt();
            return api(originalRequest);
          } catch (retryErr) {
            return Promise.reject(retryErr);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [isLoggedIn, isRestoringSession]);

  // Load dev credentials
  useEffect(() => {
    api.post('/auth/dev-creds')
      .then(res => {
        if (res.data.status === 'success') {
          setUsername(res.data.username || '');
          setPassword(res.data.password || '');
          console.log('[Dev] Local credentials loaded.');
        }
      })
      .catch(err => {
        console.warn('[Dev] Local credentials load bypassed:', err);
      });
  }, []);

  // Fetch CSRF & CAPTCHA
  const startLoginFlow = async (autoTriggerAfterInit = false) => {
    if (showCaptchaUI || manualLoginRetryCount.current === 0) {
      setMessage({ text: 'Initializing secure VTOP portal handshake...', type: 'info' });
    }
    try {
      const res = await api.post<StartLoginResponse>('/auth/start-login');
      if (res.data.status === 'captcha_ready') {
        const currentSessionId = res.data.session_id;
        const currentCaptchaType = res.data.captcha_type || 1;
        const credsAvailable = res.data.has_saved_creds;

        setSessionId(currentSessionId);
        setCaptchaType(currentCaptchaType);
        setCaptchaImg(res.data.captcha_image_data || '');
        setHasSavedCreds(credsAvailable);
        if (credsAvailable) {
          setShowManualForm(false);
        }
        setCaptcha('');
        if (showCaptchaUI || manualLoginRetryCount.current === 0) {
          setMessage(null);
        }

        if (currentCaptchaType === 1) {
          setIsCaptchaSolving(true);
          try {
            const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
            setCaptcha(solvedText);
            if (autoTriggerAfterInit && credsAvailable) {
              autoLoginMutation.mutate({
                captchaText: solvedText,
                currentSessionId: currentSessionId
              });
            }
          } catch (solveError: any) {
            console.error("CAPTCHA solve error:", solveError);
            setCaptcha('');
            if (autoTriggerAfterInit && credsAvailable) {
              triggerSilentAutoLoginAttempt();
            } else {
              setIsRestoringSession(false);
            }
          } finally {
            setIsCaptchaSolving(false);
          }
        } else {
          // If captcha is not type 1 (or recaptcha) and we have no saved creds, stop loader
          if (!credsAvailable) {
            setIsRestoringSession(false);
            setIsLoggedIn(false);
          }
        }
      }
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Failed to initialize connection.',
        type: 'error'
      });
      setIsRestoringSession(false);
    }
  };

  // Silent retry logic for manual login
  const triggerSilentLoginAttempt = async () => {
    try {
      setIsCaptchaSolving(true);
      const res = await api.post<StartLoginResponse>('/auth/start-login');
      if (res.data.status === 'captcha_ready') {
        setSessionId(res.data.session_id);
        setCaptchaImg(res.data.captcha_image_data || null);

        try {
          const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
          setCaptcha(solvedText);
          loginMutation.mutate({
            captchaText: solvedText,
            currentSessionId: res.data.session_id
          });
        } catch (solveErr) {
          if (manualLoginRetryCount.current < MAX_RETRIES) {
            manualLoginRetryCount.current++;
            triggerSilentLoginAttempt();
          } else {
            setShowCaptchaUI(true);
            setMessage({ text: 'CAPTCHA auto-verification failed. Please solve manually.', type: 'error' });
            setIsCaptchaSolving(false);
          }
        }
      }
    } catch (err) {
      console.error("Silent start-login failed:", err);
      setIsCaptchaSolving(false);
    }
  };

  // Silent retry logic for auto login
  const triggerSilentAutoLoginAttempt = async () => {
    try {
      setIsCaptchaSolving(true);
      const res = await api.post<StartLoginResponse>('/auth/start-login');
      if (res.data.status === 'captcha_ready') {
        setSessionId(res.data.session_id);
        setCaptchaImg(res.data.captcha_image_data || null);

        try {
          const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
          setCaptcha(solvedText);
          autoLoginMutation.mutate({
            captchaText: solvedText,
            currentSessionId: res.data.session_id
          });
        } catch (solveErr) {
          if (autoLoginRetryCount.current < MAX_RETRIES) {
            autoLoginRetryCount.current++;
            triggerSilentAutoLoginAttempt();
          } else {
            setIsRestoringSession(false);
            setIsLoggedIn(false);
            setShowManualForm(true);
            setShowCaptchaUI(true);
            setMessage({ text: 'Background CAPTCHA solving failed. Sign in manually.', type: 'error' });
            setIsCaptchaSolving(false);
          }
        }
      }
    } catch (err) {
      console.error("Silent auto start-login failed:", err);
      setIsRestoringSession(false);
    }
  };

  const triggerGoogleReCAPTCHA = () => {
    if ((window as any).grecaptcha) {
      try {
        (window as any).grecaptcha.reset();
        (window as any).grecaptcha.execute();
      } catch (err) {
        console.error("Failed to execute Google ReCAPTCHA:", err);
        setMessage({ text: 'ReCAPTCHA trigger failed. Please reload page.', type: 'error' });
      }
    } else {
      setTimeout(triggerGoogleReCAPTCHA, 1000);
    }
  };

  const safeResetRecaptcha = () => {
    if ((window as any).grecaptcha) {
      try {
        (window as any).grecaptcha.reset();
      } catch (err) {
        console.warn("ReCAPTCHA reset bypassed:", err);
      }
    }
  };

  const handleRecaptchaCallback = (token: string) => {
    if (!sessionId) return;
    if (hasSavedCreds && !showManualForm) {
      autoLoginMutation.mutate({
        captchaText: '',
        gResponse: token,
        currentSessionId: sessionId
      });
    } else {
      loginMutation.mutate({
        captchaText: '',
        gResponse: token,
        currentSessionId: sessionId
      });
    }
  };

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async ({ captchaText, gResponse, currentSessionId }: { captchaText: string; gResponse?: string; currentSessionId: string }) => {
      setMessage({ text: 'Authenticating with VTOP...', type: 'info' });
      const res = await api.post('/auth/login-attempt', {
        username,
        password,
        captcha: captchaText,
        gResponse,
        session_id: currentSessionId
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      if (data.status === 'success') {
        localStorage.removeItem('vtop_explicit_logout');
        setIsLoggedIn(true);
        setActiveUser(username);
        manualLoginRetryCount.current = 0;
        setMessage({ text: data.message, type: 'success' });
        if (variables.currentSessionId) {
          setSessionId(variables.currentSessionId);
          localStorage.setItem('vtop_session_id', variables.currentSessionId);
          localStorage.setItem('vtop_username', username);
        }
        setTimeout(() => setMessage(null), 3000);
      } else if (data.status === 'invalid_captcha') {
        safeResetRecaptcha();
        if (!showCaptchaUI && manualLoginRetryCount.current < MAX_RETRIES) {
          manualLoginRetryCount.current++;
          triggerSilentLoginAttempt();
        } else {
          setShowCaptchaUI(true);
          setMessage({ text: 'Verification failed. Solve the CAPTCHA manually.', type: 'error' });
          startLoginFlow();
        }
      } else {
        setShowCaptchaUI(true);
        setMessage({ text: data.message || 'Login failed.', type: 'error' });
        safeResetRecaptcha();
        startLoginFlow();
      }
    },
    onError: (err: any) => {
      setMessage({
        text: err.response?.data?.message || 'Connection failure.',
        type: 'error'
      });
      safeResetRecaptcha();
      startLoginFlow();
    }
  });

  // Auto Login mutation
  const autoLoginMutation = useMutation({
    mutationFn: async ({ captchaText, gResponse, currentSessionId }: { captchaText: string; gResponse?: string; currentSessionId: string }) => {
      setMessage({ text: 'Performing background autologin...', type: 'info' });
      const res = await api.post('/auth/auto-login', {
        captcha: captchaText,
        gResponse,
        session_id: currentSessionId
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      if (data.status === 'success') {
        localStorage.removeItem('vtop_explicit_logout');
        setIsLoggedIn(true);
        setIsRestoringSession(false);
        autoLoginRetryCount.current = 0;
        setMessage({ text: data.message, type: 'success' });
        if (variables.currentSessionId) {
          setSessionId(variables.currentSessionId);
          localStorage.setItem('vtop_session_id', variables.currentSessionId);
          api.post('/auth/check-session', { session_id: variables.currentSessionId })
            .then(res => {
              if (res.data.username) {
                setActiveUser(res.data.username);
                localStorage.setItem('vtop_username', res.data.username);
              }
            });
        }
        setTimeout(() => setMessage(null), 3000);
        
        // Refresh queries on dynamic session restore success!
        queryClient.refetchQueries();
      } else if (data.status === 'invalid_captcha') {
        safeResetRecaptcha();
        if (autoLoginRetryCount.current < MAX_RETRIES) {
          autoLoginRetryCount.current++;
          triggerSilentAutoLoginAttempt();
        } else {
          setIsRestoringSession(false);
          setIsLoggedIn(false);
          setShowManualForm(true);
          setShowCaptchaUI(true);
          setMessage({ text: 'Auto-login CAPTCHA solver failed. Sign in manually.', type: 'error' });
        }
      } else {
        setIsRestoringSession(false);
        setIsLoggedIn(false);
        setShowManualForm(true);
        setShowCaptchaUI(true);
        setMessage({ text: data.message || 'Auto-login expired.', type: 'error' });
        safeResetRecaptcha();
      }
    },
    onError: (err: any) => {
      setIsRestoringSession(false);
      setIsLoggedIn(false);
      setShowManualForm(true);
      setMessage({
        text: err.response?.data?.message || 'Auto-login network error.',
        type: 'error'
      });
      safeResetRecaptcha();
    }
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      setIsLoggedIn(false);
      setIsRestoringSession(false);
      setActiveUser('');
      localStorage.setItem('vtop_explicit_logout', 'true');
      localStorage.removeItem('vtop_session_id');
      localStorage.removeItem('vtop_username');

      // Clear cache on logout
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vtop_cache_')) {
          localStorage.removeItem(key);
        }
      }

      setMessage({ text: 'Successfully logged out.', type: 'success' });
      autoLoginRetryCount.current = 0;
      manualLoginRetryCount.current = 0;
      setShowCaptchaUI(false);
      setShowManualForm(true);
      startLoginFlow(false);
    }
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaType === 2) {
      triggerGoogleReCAPTCHA();
    } else {
      if (!captcha) return;
      loginMutation.mutate({
        captchaText: captcha,
        currentSessionId: sessionId || ''
      });
    }
  };

  const handleAutoLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaType === 2) {
      triggerGoogleReCAPTCHA();
    } else {
      if (isCaptchaSolving) return;
      autoLoginMutation.mutate({
        captchaText: captcha,
        currentSessionId: sessionId || ''
      });
    }
  };

  // Data Queries (Student Information)
  const semestersQuery = useQuery({
    queryKey: ['semesters', sessionId],
    queryFn: async () => {
      const res = await getSemesters();
      const sems = res.data.semesters || [];
      if (sems.length > 0) {
        localStorage.setItem('vtop_cache_semesters', JSON.stringify(sems));
      }
      return sems;
    },
    initialData: () => {
      const cached = localStorage.getItem('vtop_cache_semesters');
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !isRestoringSession
  });

  // Set default active semester when semesters list loads
  useEffect(() => {
    if (semestersQuery.data) {
      if (semestersQuery.data.length > 0) {
        const defaultSem = semestersQuery.data[0];
        if (defaultSem && (!activeSemester || activeSemester === 'UNAVAILABLE')) {
          setActiveSemester(defaultSem.id);
        }
      } else {
        setActiveSemester('UNAVAILABLE');
      }
    }
  }, [semestersQuery.data]);

  const profileQuery = useQuery({
    queryKey: ['profile', activeUser],
    queryFn: async () => {
      const res = await getProfile();
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem('vtop_cache_profile', JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      const cached = localStorage.getItem('vtop_cache_profile');
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !isRestoringSession
  });

  const timetableQuery = useQuery({
    queryKey: ['timetable', sessionId, activeSemester],
    queryFn: async () => {
      const res = await getTimetable(activeSemester);
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem(`vtop_cache_timetable_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      const cached = localStorage.getItem(`vtop_cache_timetable_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !isRestoringSession
  });

  const attendanceQuery = useQuery({
    queryKey: ['attendance', sessionId, activeSemester],
    queryFn: async () => {
      const res = await getAttendance(activeSemester);
      const data = res.data.raw_data || [];
      if (data.length > 0) {
        localStorage.setItem(`vtop_cache_attendance_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      const cached = localStorage.getItem(`vtop_cache_attendance_${activeSemester}`);
      return cached ? JSON.parse(cached) : [];
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !isRestoringSession
  });

  const attendanceDetailQuery = useQuery({
    queryKey: ['attendance-detail', sessionId, activeSemester, selectedAttendanceCourse?.class_id, selectedAttendanceCourse?.slot_param],
    queryFn: async () => {
      const res = await getAttendanceDetail(activeSemester, selectedAttendanceCourse.class_id, selectedAttendanceCourse.slot_param);
      return res.data.raw_data as any[];
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !!selectedAttendanceCourse && !isRestoringSession
  });

  const marksQuery = useQuery({
    queryKey: ['marks', sessionId, activeSemester],
    queryFn: async () => {
      const res = await getMarks(activeSemester);
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem(`vtop_cache_marks_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      const cached = localStorage.getItem(`vtop_cache_marks_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !isRestoringSession
  });

  const gradesQuery = useQuery({
    queryKey: ['grades', sessionId, activeSemester],
    queryFn: async () => {
      const res = await getGrades(activeSemester);
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem(`vtop_cache_grades_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      const cached = localStorage.getItem(`vtop_cache_grades_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !isRestoringSession
  });

  const examsQuery = useQuery({
    queryKey: ['exams', sessionId, activeSemester],
    queryFn: async () => {
      const res = await getExams(activeSemester);
      const data = res.data.raw_data || [];
      if (data.length > 0) {
        localStorage.setItem(`vtop_cache_exams_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      const cached = localStorage.getItem(`vtop_cache_exams_${activeSemester}`);
      return cached ? JSON.parse(cached) : [];
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !isRestoringSession
  });

  const credentialsQuery = useQuery({
    queryKey: ['credentials', activeUser],
    queryFn: async () => {
      const res = await getCredentials();
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem('vtop_cache_credentials', JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      const cached = localStorage.getItem('vtop_cache_credentials');
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !isRestoringSession
  });

  const odSnapshotQuery = useQuery({
    queryKey: ['od-snapshot', sessionId, activeSemester],
    queryFn: async () => {
      const res = await getODSnapshot(activeSemester);
      const count = res.data.total_od_count;
      localStorage.setItem(`vtop_cache_od_snapshot_${activeSemester}`, JSON.stringify(count));
      return { total_od_count: count };
    },
    initialData: () => {
      const cached = localStorage.getItem(`vtop_cache_od_snapshot_${activeSemester}`);
      return cached ? { total_od_count: JSON.parse(cached) } : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !isRestoringSession
  });

  const isMarksLocked = activeSemester === 'UNAVAILABLE' || (isLoggedIn && !!activeSemester && !marksQuery.isPending && (!marksQuery.data || !marksQuery.data.courses || marksQuery.data.courses.length === 0));
  const isGradesLocked = activeSemester === 'UNAVAILABLE' || (isLoggedIn && !!activeSemester && !gradesQuery.isPending && (!gradesQuery.data || !gradesQuery.data.grades || gradesQuery.data.grades.length === 0));
  const isExamsLocked = activeSemester === 'UNAVAILABLE' || (isLoggedIn && !!activeSemester && !examsQuery.isPending && (!examsQuery.data || examsQuery.data.length === 0));

  const isFormPending = loginMutation.isPending || autoLoginMutation.isPending;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bgPrimary select-none">
      {/* Background restore loader */}
      {isRestoringSession && (
        <div className="fixed top-4 right-4 bg-bgCard border border-borderColor rounded-2xl shadow-xl px-4 py-3 z-50 flex items-center gap-3 animate-in slide-in-from-top duration-300">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <div className="text-xs">
            <p className="font-bold text-textMain">Restoring VTOP Session</p>
            <p className="text-[10px] text-textMuted mt-0.5">Please wait, logging in silently...</p>
          </div>
        </div>
      )}

      {!isLoggedIn && !isRestoringSession ? (
        <LoginView
          theme={theme}
          setTheme={setTheme}
          message={message}
          hasSavedCreds={hasSavedCreds}
          showManualForm={showManualForm}
          setShowManualForm={setShowManualForm}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          captcha={captcha}
          setCaptcha={setCaptcha}
          showCaptchaUI={showCaptchaUI}
          captchaType={captchaType}
          captchaImg={captchaImg}
          isPending={isFormPending}
          isCaptchaSolving={isCaptchaSolving}
          handleAutoLoginSubmit={handleAutoLoginSubmit}
          handleLoginSubmit={handleLoginSubmit}
          recaptchaRef={recaptchaRef}
        />
      ) : (
        <div className="flex-1 flex h-screen overflow-hidden relative bg-bgPrimary text-textMain">
          {/* Mobile Overlay Backdrop */}
          {isMobileSidebarOpen && (
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-20 md:hidden transition-opacity duration-300"
            />
          )}

          {/* SIDEBAR NAVIGATION */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeSemester={activeSemester}
            setActiveSemester={setActiveSemester}
            semestersQuery={semestersQuery}
            isMarksLocked={isMarksLocked}
            isGradesLocked={isGradesLocked}
            isExamsLocked={isExamsLocked}
            logoutMutation={logoutMutation}
            activeUser={activeUser}
            profileData={profileQuery.data}
            isMobileSidebarOpen={isMobileSidebarOpen}
            setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          />

          {/* MAIN DASHBOARD CONTENT AREA */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bgPrimary">
            <header className="flex items-center justify-between px-6 py-4 bg-bgCard border-b border-borderColor text-textMain z-10 shrink-0">
              <div className="flex items-center">
                <button 
                  className="md:hidden mr-4 text-textMuted hover:text-textMain focus:outline-none cursor-pointer"
                  onClick={() => setIsMobileSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-bold text-textMain capitalize">
                  {activeTab === 'my-room' ? 'My Room' : activeTab === 'calculator' ? 'Attendance Calculator' : activeTab.replace('-', ' ')}
                </h1>
              </div>
              
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg text-textMuted bg-bgPrimary hover:bg-bgPrimary/60 border border-borderColor transition-colors cursor-pointer"
                  title="Toggle Light/Dark Theme"
                >
                  {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
              </div>
            </header>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative custom-scrollbar bg-bgPrimary text-textMain">
              {activeTab === 'dashboard' && (
                <DashboardView
                  attendanceQuery={attendanceQuery}
                  timetableQuery={timetableQuery}
                  odSnapshotQuery={odSnapshotQuery}
                  TIMETABLE_SLOTS={TIMETABLE_SLOTS}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView 
                  profileQuery={profileQuery} 
                  setActiveTab={setActiveTab}
                  activeUser={activeUser}
                />
              )}

              {activeTab === 'timetable' && (
                <TimetableView
                  timetableQuery={timetableQuery}
                  TIMETABLE_SLOTS={TIMETABLE_SLOTS}
                />
              )}

              {activeTab === 'attendance' && (
                <AttendanceView
                  attendanceQuery={attendanceQuery}
                  selectedAttendanceCourse={selectedAttendanceCourse}
                  setSelectedAttendanceCourse={setSelectedAttendanceCourse}
                  attendanceDetailQuery={attendanceDetailQuery}
                />
              )}

              {activeTab === 'marks' && (
                <MarksView marksQuery={marksQuery} />
              )}

              {activeTab === 'grades' && (
                <GradesView gradesQuery={gradesQuery} />
              )}

              {activeTab === 'exams' && (
                <ExamsView examsQuery={examsQuery} />
              )}

              {activeTab === 'calendar' && (
                <CalendarView
                  semesters={semestersQuery.data || []}
                  activeUser={activeUser}
                />
              )}

              {activeTab === 'credentials' && (
                <CredentialsView credentialsQuery={credentialsQuery} />
              )}

              {activeTab === 'my-room' && (
                <HostelView profileQuery={profileQuery} />
              )}

              {activeTab === 'calculator' && (
                <AttendanceCalculator 
                  attendanceQuery={attendanceQuery} 
                  timetableQuery={timetableQuery}
                />
              )}

              {activeTab === 'courses' && (
                <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-bgPrimary rounded-full p-6 mb-4 border border-borderColor shadow-sm">
                    <Loader2 className="w-12 h-12 text-textMuted animate-spin" />
                  </div>
                  <h2 className="text-2xl font-bold text-textMain mb-2 capitalize">{activeTab.replace('-', ' ')}</h2>
                  <p className="text-textMuted max-w-md">
                    This section is currently under construction. Please check back later when new updates are rolled out.
                  </p>
                </div>
              )}

              {activeTab === 'faculty' && (
                <FacultyView />
              )}
            </div>
          </main>
        </div>
      )}

      {/* ================= ATTENDANCE HISTORY DRAWER/MODAL ================= */}
      {selectedAttendanceCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 h-full overflow-y-auto flex flex-col justify-between animate-slide-in shadow-xl p-6 md:p-8">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-neutral-800 pb-4">
                <div>
                  <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 font-bold px-2 py-0.5 rounded text-slate-500 uppercase">{selectedAttendanceCourse.course_code}</span>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{selectedAttendanceCourse.course_title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedAttendanceCourse.faculty}</p>
                </div>
                <button
                  onClick={() => setSelectedAttendanceCourse(null)}
                  className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold text-lg leading-none cursor-pointer"
                >
                  X
                </button>
              </div>

              {/* Attendance Log Table */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-blue-600 dark:text-blue-500">Hourly Lecture History</h4>

                {attendanceDetailQuery.isPending ? (
                  <div className="h-32 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : attendanceDetailQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Failed to retrieve lecture history log.</span>
                  </div>
                ) : !attendanceDetailQuery.data || attendanceDetailQuery.data.length === 0 ? (
                  <div className="p-8 text-center text-xs text-textMuted bg-bgPrimary/30 rounded-2xl border border-borderColor/60 border-dashed">
                    No history log entries recorded.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden text-xs bg-bgCard">
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-black border-b border-slate-200 dark:border-neutral-800 text-[10px] font-bold text-slate-400 uppercase">
                            <th className="p-3">#</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Slot / Timing</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceDetailQuery.data.map((log: any, logIdx: number) => {
                            const statusLower = (log.status || '').toLowerCase();
                            const isPresent = statusLower === 'present';
                            const isOnDuty = statusLower === 'on duty' || statusLower === 'onduty' || statusLower === 'on-duty';
                            const badgeClass = isOnDuty
                              ? 'bg-yellow-50 dark:bg-yellow-950/25 text-yellow-600 dark:text-yellow-400'
                              : isPresent
                                ? 'bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400';
                            return (
                              <tr key={logIdx} className="border-b border-slate-100 dark:border-neutral-800/40 hover:bg-slate-50/50 dark:hover:bg-neutral-800/20">
                                <td className="p-3 font-semibold text-slate-400">{log.sl_no}</td>
                                <td className="p-3 font-bold text-textMain">{log.date}</td>
                                <td className="p-3 text-textMain">
                                  <div>{log.slot}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{log.timing}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${badgeClass}`}>
                                    {log.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-neutral-800 pt-4 mt-6 flex justify-end">
              <button
                onClick={() => setSelectedAttendanceCourse(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VtopLoginDashboard />
    </QueryClientProvider>
  );
}
