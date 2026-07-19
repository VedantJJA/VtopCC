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
  Lock,
  User as UserIcon,
  Loader2,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon,
  FileText,
  Eye,
  EyeOff,
  Menu,
  LayoutDashboard,
  GraduationCap,
  Home,
  PlusCircle,
  ChevronDown
} from 'lucide-react';

import { DashboardView } from './components/DashboardView';
import { ProfileView } from './components/ProfileView';
import { TimetableView } from './components/TimetableView';
import { AttendanceView } from './components/AttendanceView';
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
      retry: false,
      staleTime: 10 * 60 * 1000 // 10 minutes cache freshness
    }
  }
});

interface StartLoginResponse {
  status: string;
  session_id: string;
  captcha_type: number; // 1 = built-in text, 2 = google invisible recaptcha
  captcha_image_data: string;
  has_saved_creds: boolean;
}

const MAX_RETRIES = 5;

const TIMETABLE_SLOTS = [
  { id: 1, name: 'Slot 1', theoryTime: '08:00 - 08:50', labTime: '08:00 - 08:45', key: '08:00 - 08:50' },
  { id: 2, name: 'Slot 2', theoryTime: '08:55 - 09:45', labTime: '08:50 - 09:35', key: '08:55 - 09:45' },
  { id: 3, name: 'Slot 3', theoryTime: '09:50 - 10:40', labTime: '09:40 - 10:25', key: '09:50 - 10:40' },
  { id: 4, name: 'Slot 4', theoryTime: '10:45 - 11:35', labTime: '10:30 - 11:15', key: '10:45 - 11:35' },
  { id: 5, name: 'Slot 5', theoryTime: '11:40 - 12:30', labTime: '11:20 - 12:05', key: '11:40 - 12:30' },
  { id: 6, name: 'Slot 6', theoryTime: '12:35 - 13:25', labTime: '12:10 - 12:55', key: '12:35 - 13:25' },
  { id: 'break', name: 'LUNCH', theoryTime: '13:25 - 14:00', labTime: '12:55 - 14:00', key: 'LUNCH' },
  { id: 7, name: 'Slot 7', theoryTime: '14:00 - 14:50', labTime: '14:00 - 14:45', key: '14:00 - 14:50' },
  { id: 8, name: 'Slot 8', theoryTime: '14:55 - 15:45', labTime: '14:50 - 15:35', key: '14:55 - 15:45' },
  { id: 9, name: 'Slot 9', theoryTime: '15:50 - 16:40', labTime: '15:40 - 16:25', key: '15:50 - 16:40' },
  { id: 10, name: 'Slot 10', theoryTime: '16:45 - 17:35', labTime: '16:30 - 17:15', key: '16:45 - 17:35' },
  { id: 11, name: 'Slot 11', theoryTime: '17:40 - 18:30', labTime: '17:20 - 18:05', key: '17:40 - 18:30' },
  { id: 12, name: 'Slot 12', theoryTime: '18:35 - 19:25', labTime: '18:10 - 18:55', key: '18:35 - 19:25' }
];

type DashboardTab = 'dashboard' | 'profile' | 'timetable' | 'attendance' | 'marks' | 'grades' | 'exams' | 'calendar' | 'credentials' | 'my-room' | 'calculator' | 'courses';

function VtopLoginDashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auth states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captchaType, setCaptchaType] = useState<number>(1);
  const [_captchaImg, setCaptchaImg] = useState<string>('');
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeUser, setActiveUser] = useState('');
  const [showManualForm, setShowManualForm] = useState(true);
  const [isCaptchaSolving, setIsCaptchaSolving] = useState(false);
  const [showCaptchaUI, setShowCaptchaUI] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({
    'academics': true,
    'my-info': true
  });
  const [activeSemester, setActiveSemester] = useState<string>('');

  // Attendance detail state (for modal)
  const [selectedAttendanceCourse, setSelectedAttendanceCourse] = useState<any | null>(null);

  // Keep track of retry count across renders
  const autoLoginRetryCount = useRef(0);
  const manualLoginRetryCount = useRef(0);
  const initRef = useRef(false);
  const isRestoringRef = useRef(false);

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

  // Check if session already exists on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const localSessionId = localStorage.getItem('vtop_session_id');
    const localUsername = localStorage.getItem('vtop_username');
    if (localSessionId) {
      // Optimistically log in instantly to show cached data
      setSessionId(localSessionId);
      setIsLoggedIn(true);
      if (localUsername) {
        setActiveUser(localUsername);
      }
      
      // Verify in background
      api.post('/auth/check-session', { session_id: localSessionId })
        .then((res) => {
          if (res.data.status === 'success') {
            if (res.data.username) {
              setActiveUser(res.data.username);
              localStorage.setItem('vtop_username', res.data.username);
            }
          } else {
            // Explicit auth failure, clear active session
            localStorage.removeItem('vtop_session_id');
            localStorage.removeItem('vtop_username');
            setIsLoggedIn(false);
            setSessionId(null);
            startLoginFlow(true);
          }
        })
        .catch((err) => {
          // If we got an explicit 401/403 auth error, discard session.
          // Otherwise (e.g. network offline), KEEP active session using cached data!
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            localStorage.removeItem('vtop_session_id');
            localStorage.removeItem('vtop_username');
            setIsLoggedIn(false);
            setSessionId(null);
            startLoginFlow(true);
          }
        });
    } else {
      startLoginFlow(true);
    }
  }, []);

  // Load dev credentials on mount
  useEffect(() => {
    api.post('/auth/dev-creds')
      .then(res => {
        if (res.data.status === 'success') {
          setUsername(res.data.username || '');
          setPassword(res.data.password || '');
          console.log('[Dev] Credentials auto-loaded from .idpass successfully.');
        }
      })
      .catch(err => {
        console.warn('[Dev] Failed to load local .idpass credentials:', err);
      });
  }, []);

  // Fetch CSRF & CAPTCHA
  const startLoginFlow = async (autoTriggerAfterInit = false) => {
    console.log("[VTOP] Initializing session, showCaptchaUI:", showCaptchaUI);
    // Only show loading message if we aren't silently retrying in background
    if (showCaptchaUI || manualLoginRetryCount.current === 0) {
      setMessage({ text: 'Initializing secure connection to VTOP...', type: 'info' });
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

        console.log(`[VTOP] Session initialized. Captcha type: ${currentCaptchaType === 2 ? 'Google ReCAPTCHA' : 'Text CAPTCHA'}`);

        if (currentCaptchaType === 1) {
          setIsCaptchaSolving(true);
          try {
            console.log("Running built-in CAPTCHA solver in background...");
            const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
            setCaptcha(solvedText);
            console.log("CAPTCHA solved successfully:", solvedText);

            if (autoTriggerAfterInit && credsAvailable) {
              console.log("[AUTO-RESTORE] Restoring VTOP session automatically...");
              autoLoginMutation.mutate({
                captchaText: solvedText,
                currentSessionId: currentSessionId
              });
            }
          } catch (solveError: any) {
            console.error("CAPTCHA solve failed:", solveError);
            setCaptcha('');
            if (autoTriggerAfterInit && credsAvailable) {
              triggerSilentAutoLoginAttempt();
            }
          } finally {
            setIsCaptchaSolving(false);
          }
        }
      }
    } catch (err: any) {
      setMessage({
        text: err.response?.data?.message || 'Failed to connect to VTOP server.',
        type: 'error'
      });
    }
  };

  // Silent retry logic for manual login
  const triggerSilentLoginAttempt = async () => {
    try {
      setIsCaptchaSolving(true);
      const res = await api.post<StartLoginResponse>('/auth/start-login');
      if (res.data.status === 'captcha_ready') {
        setSessionId(res.data.session_id);
        setCaptchaImg(res.data.captcha_image_data);

        try {
          const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
          setCaptcha(solvedText);

          loginMutation.mutate({
            captchaText: solvedText,
            currentSessionId: res.data.session_id
          });
        } catch (solveErr) {
          console.error("Silent solve failed, checking retries...");
          if (manualLoginRetryCount.current < MAX_RETRIES) {
            manualLoginRetryCount.current++;
            triggerSilentLoginAttempt();
          } else {
            setShowCaptchaUI(true);
            setMessage({ text: 'Automated CAPTCHA verification failed. Please enter the code manually.', type: 'error' });
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
        setCaptchaImg(res.data.captcha_image_data);

        try {
          const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
          setCaptcha(solvedText);

          autoLoginMutation.mutate({
            captchaText: solvedText,
            currentSessionId: res.data.session_id
          });
        } catch (solveErr) {
          console.error("Silent auto-solve failed, checking retries...");
          if (autoLoginRetryCount.current < MAX_RETRIES) {
            autoLoginRetryCount.current++;
            triggerSilentAutoLoginAttempt();
          } else {
            setShowManualForm(true);
            setShowCaptchaUI(true);
            setMessage({ text: 'Automated CAPTCHA verification failed. Please enter the code manually.', type: 'error' });
            setIsCaptchaSolving(false);
          }
        }
      }
    } catch (err) {
      console.error("Silent auto start-login failed:", err);
      setIsCaptchaSolving(false);
    }
  };

  // Helper to trigger Google ReCAPTCHA verification
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

  // Callback triggered when invisible recaptcha solves successfully
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
      setMessage({ text: 'Logging into VTOP...', type: 'info' });
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
          console.log(`Manual login CAPTCHA failed. Retrying silently (${manualLoginRetryCount.current}/${MAX_RETRIES})...`);
          triggerSilentLoginAttempt();
        } else {
          // Exceeded silent retries, or already in manual mode
          setShowCaptchaUI(true);
          setMessage({ text: 'Automated CAPTCHA verification failed. Please enter the code manually.', type: 'error' });
          startLoginFlow();
        }
      } else {
        // e.g. invalid_credentials (wrong username or password)
        setShowCaptchaUI(true);
        setMessage({ text: data.message || 'Login failed.', type: 'error' });
        safeResetRecaptcha();
        startLoginFlow();
      }
    },
    onError: (err: any) => {
      setMessage({
        text: err.response?.data?.message || 'An error occurred during login.',
        type: 'error'
      });
      safeResetRecaptcha();
      startLoginFlow();
    }
  });

  // Auto Login mutation
  const autoLoginMutation = useMutation({
    mutationFn: async ({ captchaText, gResponse, currentSessionId }: { captchaText: string; gResponse?: string; currentSessionId: string }) => {
      setMessage({ text: 'Logging in with saved credentials...', type: 'info' });
      const res = await api.post('/auth/auto-login', {
        captcha: captchaText,
        gResponse,
        session_id: currentSessionId
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      if (data.status === 'success') {
        setIsLoggedIn(true);
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
      } else if (data.status === 'invalid_captcha') {
        safeResetRecaptcha();
        if (autoLoginRetryCount.current < MAX_RETRIES) {
          autoLoginRetryCount.current++;
          console.log(`Auto-login CAPTCHA failed. Retrying silently (${autoLoginRetryCount.current}/${MAX_RETRIES})...`);
          triggerSilentAutoLoginAttempt();
        } else {
          logoutMutation.mutate();
          setShowManualForm(true);
          setShowCaptchaUI(true);
          setMessage({ text: 'Auto-login CAPTCHA failed. Please sign in manually.', type: 'error' });
        }
      } else {
        // e.g. invalid_credentials (wrong credentials saved)
        logoutMutation.mutate();
        setShowManualForm(true);
        setShowCaptchaUI(true);
        setMessage({ text: data.message || 'Auto-login failed. Please sign in again.', type: 'error' });
        safeResetRecaptcha();
      }
    },
    onError: (err: any) => {
      logoutMutation.mutate();
      setMessage({
        text: err.response?.data?.message || 'An error occurred during auto-login.',
        type: 'error'
      });
      safeResetRecaptcha();
      setShowManualForm(true);
    }
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      setIsLoggedIn(false);
      setActiveUser('');
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
      startLoginFlow();
    }
  });

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
    enabled: isLoggedIn && !!sessionId
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
    enabled: isLoggedIn && !!sessionId && (activeTab === 'profile' || activeTab === 'my-room')
  });

  const timetableQuery = useQuery({
    queryKey: ['timetable', activeUser, activeSemester],
    queryFn: async () => {
      const res = await getTimetable(activeSemester);
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem(`vtop_cache_timetable_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (!activeSemester) return undefined;
      const cached = localStorage.getItem(`vtop_cache_timetable_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && (activeTab === 'timetable' || activeTab === 'dashboard')
  });

  const attendanceQuery = useQuery({
    queryKey: ['attendance', activeUser, activeSemester],
    queryFn: async () => {
      const res = await getAttendance(activeSemester);
      const data = res.data.raw_data as any[];
      if (data) {
        localStorage.setItem(`vtop_cache_attendance_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (!activeSemester) return undefined;
      const cached = localStorage.getItem(`vtop_cache_attendance_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && (activeTab === 'attendance' || activeTab === 'dashboard' || activeTab === 'calculator')
  });

  const odSnapshotQuery = useQuery({
    queryKey: ['od-snapshot', activeUser, activeSemester],
    queryFn: async () => {
      const res = await getODSnapshot(activeSemester);
      const data = res.data;
      if (data) {
        localStorage.setItem(`vtop_cache_od_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (!activeSemester) return undefined;
      const cached = localStorage.getItem(`vtop_cache_od_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && activeTab === 'dashboard'
  });

  const attendanceDetailQuery = useQuery({
    queryKey: ['attendance-detail', sessionId, activeSemester, selectedAttendanceCourse?.class_id, selectedAttendanceCourse?.slot_param],
    queryFn: async () => {
      const res = await getAttendanceDetail(activeSemester, selectedAttendanceCourse.class_id, selectedAttendanceCourse.slot_param);
      return res.data.raw_data as any[];
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE' && !!selectedAttendanceCourse
  });

  const marksQuery = useQuery({
    queryKey: ['marks', activeUser, activeSemester],
    queryFn: async () => {
      const res = await getMarks(activeSemester);
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem(`vtop_cache_marks_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (!activeSemester) return undefined;
      const cached = localStorage.getItem(`vtop_cache_marks_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE'
  });

  const gradesQuery = useQuery({
    queryKey: ['grades', activeUser, activeSemester],
    queryFn: async () => {
      const res = await getGrades(activeSemester);
      const data = res.data.raw_data;
      if (data) {
        localStorage.setItem(`vtop_cache_grades_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (!activeSemester) return undefined;
      const cached = localStorage.getItem(`vtop_cache_grades_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE'
  });

  const examsQuery = useQuery({
    queryKey: ['exams', activeUser, activeSemester],
    queryFn: async () => {
      const res = await getExams(activeSemester);
      const data = res.data.raw_data as any[];
      if (data) {
        localStorage.setItem(`vtop_cache_exams_${activeSemester}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (!activeSemester) return undefined;
      const cached = localStorage.getItem(`vtop_cache_exams_${activeSemester}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeSemester !== 'UNAVAILABLE'
  });

  const isMarksLocked = activeSemester === 'UNAVAILABLE' || (isLoggedIn && !!activeSemester && !marksQuery.isPending && (!marksQuery.data || !marksQuery.data.courses || marksQuery.data.courses.length === 0));
  const isGradesLocked = activeSemester === 'UNAVAILABLE' || (isLoggedIn && !!activeSemester && !gradesQuery.isPending && (!gradesQuery.data || !gradesQuery.data.grades || gradesQuery.data.grades.length === 0));
  const isExamsLocked = activeSemester === 'UNAVAILABLE' || (isLoggedIn && !!activeSemester && !examsQuery.isPending && (!examsQuery.data || examsQuery.data.length === 0));

  // Calendar state and query moved locally to CalendarView.tsx

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
    enabled: isLoggedIn && !!sessionId && activeTab === 'credentials'
  });

  useEffect(() => {
    const isAnyError = semestersQuery.isError || profileQuery.isError || timetableQuery.isError || attendanceQuery.isError || marksQuery.isError || gradesQuery.isError || examsQuery.isError;
    
    if (isAnyError) {
      if (isRestoringRef.current) return; // If already restoring, ignore subsequent query failures
      
      console.warn("Session expired. Locking queries and attempting auto-restoration...");
      isRestoringRef.current = true;
      
      localStorage.removeItem('vtop_session_id');
      localStorage.removeItem('vtop_username');
      setSessionId(null);

      if (hasSavedCreds) {
        setMessage({ text: 'Session expired. Restoring VTOP session silently...', type: 'info' });
        // The silent login function must set isRestoringRef.current = false in its finally block!
        startLoginFlow(true).finally(() => {
            setTimeout(() => { isRestoringRef.current = false; }, 2000); // Unlock after a delay
        });
      } else {
        setIsLoggedIn(false);
        setActiveUser('');
        setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
        setShowManualForm(true);
        startLoginFlow().finally(() => { isRestoringRef.current = false; });
      }
    }
  }, [semestersQuery.isError, profileQuery.isError, timetableQuery.isError, attendanceQuery.isError, marksQuery.isError, gradesQuery.isError, examsQuery.isError]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setMessage({ text: 'All fields are required.', type: 'error' });
      return;
    }

    if (showCaptchaUI) {
      // Manual mode submission
      if (!captcha) {
        setMessage({ text: 'Please enter the CAPTCHA code.', type: 'error' });
        return;
      }
      if (sessionId) {
        loginMutation.mutate({
          captchaText: captcha,
          currentSessionId: sessionId
        });
      }
    } else {
      // Start silent login workflow
      manualLoginRetryCount.current = 1;
      setMessage({ text: 'Preparing secure VTOP session...', type: 'info' });

      // Auto-solve the current CAPTCHA
      if (captcha) {
        // If already solved (or pre-filled), submit it
        if (sessionId) {
          loginMutation.mutate({
            captchaText: captcha,
            currentSessionId: sessionId
          });
        }
      } else {
        // Solve and submit
        try {
          setIsCaptchaSolving(true);
          const solvedText = await solveCaptchaClient(_captchaImg);
          setCaptcha(solvedText);
          if (sessionId) {
            loginMutation.mutate({
              captchaText: solvedText,
              currentSessionId: sessionId
            });
          }
        } catch (err) {
          console.error("Initial solver failed. Retrying silently...", err);
          triggerSilentLoginAttempt();
        } finally {
          setIsCaptchaSolving(false);
        }
      }
    }
  };

  const handleAutoLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (showCaptchaUI) {
      if (!captcha) {
        setMessage({ text: 'Please enter the CAPTCHA code.', type: 'error' });
        return;
      }
      if (sessionId) {
        autoLoginMutation.mutate({
          captchaText: captcha,
          currentSessionId: sessionId
        });
      }
    } else {
      autoLoginRetryCount.current = 1;
      setMessage({ text: 'Preparing secure VTOP session...', type: 'info' });

      if (captcha) {
        if (sessionId) {
          autoLoginMutation.mutate({
            captchaText: captcha,
            currentSessionId: sessionId
          });
        }
      } else {
        try {
          setIsCaptchaSolving(true);
          const solvedText = await solveCaptchaClient(_captchaImg);
          setCaptcha(solvedText);
          if (sessionId) {
            autoLoginMutation.mutate({
              captchaText: solvedText,
              currentSessionId: sessionId
            });
          }
        } catch (err) {
          console.error("Initial auto-solver failed. Retrying silently...", err);
          triggerSilentAutoLoginAttempt();
        } finally {
          setIsCaptchaSolving(false);
        }
      }
    }
  };

  const isPending = loginMutation.isPending || autoLoginMutation.isPending;

  return (
    <div className={`${isLoggedIn ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-bgPrimary text-textMain flex flex-col font-sans transition-colors duration-300`}>
      <GlobalScrollbarStyles />

      {/* Global Google ReCAPTCHA element */}
      <div
        id="recaptcha"
        className="g-recaptcha"
        data-sitekey="6Ld1VmQaAAAAAGQCz6k_jbG4l1s-ncpVHzS_F5iy"
        data-size="invisible"
        data-callback="onRecaptchaSolved"
      />

      {!isLoggedIn ? (
        /* ================= AUTHENTICATION CONTAINER ================= */
        <div className="flex-1 flex flex-col items-center justify-center p-4 relative">

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="absolute top-6 right-6 p-3 bg-bgCard border border-borderColor rounded-full hover:bg-bgPrimary transition-colors shadow-sm cursor-pointer"
            title={`Switch theme (Current: ${theme})`}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-blue-500" /> : <Moon className="h-5 w-5 text-slate-700" />}
          </button>

          <div className="w-full max-w-md">
            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-extrabold tracking-tight text-blue-600 dark:text-blue-500">
                VtopC
              </h1>
              <p className="text-textMuted mt-2 text-sm">
                Decoupled VTOP Chennai Portal Dashboard
              </p>
            </div>

            {/* Error/Info Banner */}
            {message && (
              <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border text-sm shadow-sm transition-all duration-300 ${message.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                  : message.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
                    : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300'
                }`}>
                {message.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />}
                {message.type === 'error' && <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />}
                {message.type === 'info' && <Loader2 className="h-5 w-5 shrink-0 mt-0.5 animate-spin text-blue-600 dark:text-blue-400" />}
                <span>{message.text}</span>
              </div>
            )}

            {/* Form Box */}
            <div className="bg-bgCard border border-borderColor rounded-3xl p-8 shadow-md">

              <h2 className="text-2xl font-bold mb-6 text-textMain">
                {hasSavedCreds && !showManualForm ? 'Auto-Login Available' : 'Student Credentials'}
              </h2>

              {hasSavedCreds && !showManualForm ? (
                /* Auto login flow (CAPTCHA details are completely hidden) */
                <form onSubmit={handleAutoLoginSubmit} className="space-y-6">
                  <p className="text-sm text-textMuted leading-relaxed">
                    VTOP is initializing securely. The built-in solver is decoding the captcha silently. Click below to enter your workspace.
                  </p>

                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={isPending || isCaptchaSolving}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-700/50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {isPending || isCaptchaSolving ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {isCaptchaSolving ? 'Preparing CAPTCHA...' : 'Logging in...'}
                        </>
                      ) : (
                        'Unlock & Enter Dashboard'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualForm(true)}
                      className="w-full py-3 text-sm text-textMuted hover:text-textMain transition-colors cursor-pointer"
                    >
                      Sign In with Another Account
                    </button>
                  </div>
                </form>
              ) : (
                /* Standard manual login flow (CAPTCHA is completely hidden!) */
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-textMain">Registration Number</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-textMuted" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. 21BCE5001"
                        disabled={isPending}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-borderColor bg-transparent focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-textMain"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-textMain">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-3.5 h-5 w-5 text-textMuted" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isPending}
                        className="w-full pl-12 pr-12 py-3 rounded-xl border border-borderColor bg-transparent focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-textMain"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute right-4 top-3.5 text-textMuted hover:text-textMain cursor-pointer outline-none"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {showCaptchaUI && captchaType === 1 && (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-textMain">CAPTCHA Verification</label>
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-center bg-bgPrimary p-3 rounded-2xl border border-borderColor">
                          {_captchaImg ? (
                            <img
                              src={_captchaImg}
                              alt="CAPTCHA"
                              className="h-12 object-contain"
                            />
                          ) : (
                            <div className="h-12 w-32 animate-pulse bg-bgPrimary rounded-xl" />
                          )}
                        </div>
                        <input
                          type="text"
                          value={captcha}
                          onChange={(e) => setCaptcha(e.target.value)}
                          placeholder="Enter CAPTCHA code"
                          disabled={isPending}
                          className="w-full px-4 py-3 rounded-xl border border-borderColor bg-transparent focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all uppercase text-center font-bold tracking-widest text-lg text-textMain"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={isPending || isCaptchaSolving || !username || !password}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-700/50 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {isPending || isCaptchaSolving ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          {isCaptchaSolving ? 'Preparing VTOP Session...' : 'Logging in...'}
                        </>
                      ) : (
                        'Sign In to VTOP'
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      ) : (
        /* ================= STUDENT DASHBOARD INTERFACE ================= */
        <div className={`flex-1 flex h-screen overflow-hidden relative transition-colors duration-300 bg-bgPrimary text-textMain`}>
          
          {/* Mobile Overlay Backdrop */}
          {isMobileSidebarOpen && (
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-20 md:hidden transition-opacity duration-300"
            />
          )}

          {/* SIDEBAR NAVIGATION */}
          <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-bgSidebar border-r border-borderColor flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            {/* Logo area */}
            <div className="p-5 pb-4 shrink-0">
              <div className="text-xl font-bold text-textMain flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accentColor flex items-center justify-center text-white font-black">V</div>
                VTOP Client
              </div>
            </div>

            {/* Student Info Card */}
            <div className="px-4 pb-4 shrink-0">
              <button 
                onClick={() => setActiveTab('profile')}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-bgPrimary border border-borderColor hover:bg-bgPrimary/60 transition-colors text-left focus:outline-none cursor-pointer"
              >
                <div className="h-10 w-10 rounded-full bg-bgCard border border-borderColor flex items-center justify-center text-accentColor font-bold shrink-0 overflow-hidden">
                  {profileQuery.data?.personal?.photo_url ? (
                    <img src={profileQuery.data.personal.photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    activeUser ? activeUser.substring(0, 1).toUpperCase() : 'S'
                  )}
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-semibold text-textMain truncate">{profileQuery.data?.personal?.name || activeUser || 'Active Session'}</p>
                  {profileQuery.data?.personal?.name && (
                    <p className="text-[11px] text-textMuted font-medium truncate font-mono">{activeUser}</p>
                  )}
                </div>
              </button>
            </div>

            {/* Collapsible Nav Links */}
            <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-4 custom-scrollbar">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                {
                  id: 'academics', label: 'Academics', icon: GraduationCap,
                  children: [
                    { id: 'timetable', label: 'Time Table' },
                    { id: 'attendance', label: 'Attendance' },
                    { id: 'calendar', label: 'Calendar' }
                  ]
                },
                {
                  id: 'examinations', label: 'Examinations', icon: FileText,
                  children: [
                    { id: 'marks', label: 'Marks' },
                    { id: 'grades', label: 'Grades' },
                    { id: 'exams', label: 'Exam Schedule' }
                  ]
                },
                {
                  id: 'hostel', label: 'Hostel', icon: Home,
                  children: [
                    { id: 'my-room', label: 'My Room' }
                  ]
                },
                {
                  id: 'extra', label: 'Extra Options', icon: PlusCircle, divider: true,
                  children: [
                    { id: 'calculator', label: 'Attendance Calculator' }
                  ]
                }
              ].map((item) => (
                <div key={item.id} className={item.divider ? "pt-3 mt-3 border-t border-borderColor" : ""}>
                  {item.children ? (
                    <div className="space-y-0.5 animate-in fade-in duration-200">
                      <button 
                        onClick={() => setExpandedNav(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        className="w-full flex justify-between items-center px-3 py-2 rounded-lg text-textMuted hover:bg-bgPrimary/40 hover:text-textMain transition-colors font-medium text-[13px] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4 text-accentColor" /> {item.label}
                        </div>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expandedNav[item.id] ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedNav[item.id] && (
                        <div className="pl-9 pr-2 py-1 space-y-0.5">
                          {item.children.map(child => {
                            const isLocked = child.id === 'marks' ? isMarksLocked : child.id === 'grades' ? isGradesLocked : child.id === 'exams' ? isExamsLocked : false;
                            return (
                              <button
                                key={child.id}
                                disabled={isLocked}
                                onClick={() => { setActiveTab(child.id as any); setIsMobileSidebarOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                                  isLocked 
                                  ? 'opacity-40 cursor-not-allowed text-textMuted' 
                                  : activeTab === child.id 
                                    ? 'bg-accentColor text-textMain shadow-sm font-bold cursor-pointer' 
                                    : 'text-textMuted hover:bg-bgPrimary/40 hover:text-textMain cursor-pointer'
                                }`}
                              >
                                <span>{child.label}</span>
                                {isLocked && (
                                  <span className="text-[8px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider scale-90 origin-right">
                                    NOT AVAILABLE
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setActiveTab(item.id as any); setIsMobileSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors font-medium text-[13px] cursor-pointer ${
                        activeTab === item.id
                        ? 'bg-accentColor text-textMain shadow-sm font-bold'
                        : 'text-textMuted hover:bg-bgPrimary/40 hover:text-textMain'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-textMain' : 'text-accentColor'}`} /> {item.label}
                    </button>
                  )}
                </div>
              ))}
            </nav>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-borderColor shrink-0 space-y-3 mt-auto">
              <div>
                <label htmlFor="semester-select" className="block text-[11px] font-medium text-textMuted mb-1.5 uppercase tracking-wider">Semester</label>
                <div className="relative">
                  <select
                    id="semester-select"
                    value={activeSemester}
                    onChange={(e) => setActiveSemester(e.target.value)}
                    className="block w-full p-2 pr-8 text-sm font-semibold text-textMain border border-borderColor rounded-lg bg-bgPrimary focus:ring-1 focus:ring-accentColor focus:outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={semestersQuery.isPending || !semestersQuery.data || semestersQuery.data.length === 0}
                  >
                    {semestersQuery.isPending ? (
                      <option>Loading...</option>
                    ) : !semestersQuery.data || semestersQuery.data.length === 0 ? (
                      <option value="UNAVAILABLE">Unavailable</option>
                    ) : (
                      semestersQuery.data?.map((sem: any) => (
                        <option key={sem.id} value={sem.id}>{sem.name}</option>
                      ))
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-textMuted">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="flex items-center justify-center w-full px-3 py-2.5 text-sm font-bold rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </button>
            </div>
          </aside>

          {/* MAIN DASHBOARD CONTENT AREA */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bgPrimary">
            {/* Header controls (Theme switcher and title) */}
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

            {/* 1. DASHBOARD VIEW */}
            {activeTab === 'dashboard' && (
              <DashboardView
                attendanceQuery={attendanceQuery}
                timetableQuery={timetableQuery}
                odSnapshotQuery={odSnapshotQuery}
                TIMETABLE_SLOTS={TIMETABLE_SLOTS}
              />
            )}

            {/* 1. PROFILE VIEW */}
            {activeTab === 'profile' && (
              <ProfileView 
                profileQuery={profileQuery} 
                setActiveTab={setActiveTab}
                activeUser={activeUser}
              />
            )}

            {/* 2. TIMETABLE VIEW */}
            {activeTab === 'timetable' && (
              <TimetableView
                timetableQuery={timetableQuery}
                TIMETABLE_SLOTS={TIMETABLE_SLOTS}
              />
            )}

            {/* 3. ATTENDANCE VIEW */}
            {activeTab === 'attendance' && (
              <AttendanceView
                attendanceQuery={attendanceQuery}
                selectedAttendanceCourse={selectedAttendanceCourse}
                setSelectedAttendanceCourse={setSelectedAttendanceCourse}
                attendanceDetailQuery={attendanceDetailQuery}
              />
            )}

            {/* 4. MARKS VIEW */}
            {activeTab === 'marks' && (
              <MarksView marksQuery={marksQuery} />
            )}

            {/* 5. GRADES VIEW */}
            {activeTab === 'grades' && (
              <GradesView gradesQuery={gradesQuery} />
            )}

            {/* 6. EXAMS VIEW */}
            {activeTab === 'exams' && (
              <ExamsView examsQuery={examsQuery} />
            )}

            {/* 7. CALENDAR VIEW */}
            {activeTab === 'calendar' && (
              <CalendarView
                semesters={semestersQuery.data || []}
                activeUser={activeUser}
              />
            )}

            {/* 8. CREDENTIALS VIEW */}
            {activeTab === 'credentials' && (
              <CredentialsView credentialsQuery={credentialsQuery} />
            )}

            {/* 9. MY ROOM (HOSTEL) VIEW */}
            {activeTab === 'my-room' && (
              <HostelView profileQuery={profileQuery} />
            )}

            {/* 10. ATTENDANCE CALCULATOR VIEW */}
            {activeTab === 'calculator' && (
              <AttendanceCalculator 
                attendanceQuery={attendanceQuery} 
                timetableQuery={timetableQuery}
              />
            )}

            {/* 11. REGISTERED COURSES (UNDER CONSTRUCTION) */}
            {activeTab === 'courses' && (
              <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-bgPrimary rounded-full p-6 mb-4 border border-borderColor shadow-sm">
                  <PlusCircle className="w-12 h-12 text-textMuted" />
                </div>
                <h2 className="text-2xl font-bold text-textMain mb-2 capitalize">{activeTab.replace('-', ' ')}</h2>
                <p className="text-textMuted max-w-md">
                  This section is currently under construction. Please check back later when new updates are rolled out.
                </p>
              </div>
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

            <button
              onClick={() => setSelectedAttendanceCourse(null)}
              className="w-full py-3 mt-6 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-black text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close History Drawer
            </button>
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



// Global generic styles for scrollbars
function GlobalScrollbarStyles() {
  return (
    <style dangerouslySetInnerHTML={{__html: `
      .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; }
      .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
    `}} />
  );
}
