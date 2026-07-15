import React, { useState, useEffect, useRef } from 'react';
import { 
  QueryClient, 
  QueryClientProvider, 
  useMutation,
  useQuery
} from '@tanstack/react-query';
import api from './lib/api';
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
  Calendar as CalendarIcon,
  BookOpen,
  FileText,
  Award,
  Clock,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Bug,
  Eye,
  EyeOff
} from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false
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

type DashboardTab = 'profile' | 'timetable' | 'attendance' | 'marks' | 'grades' | 'exams' | 'calendar' | 'credentials' | 'debug';

function VtopLoginDashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
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

  // Dashboard state
  const [activeTab, setActiveTab] = useState<DashboardTab>('profile');
  const [activeSemester, setActiveSemester] = useState<string>('');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  
  // Attendance detail state (for modal)
  const [selectedAttendanceCourse, setSelectedAttendanceCourse] = useState<any | null>(null);

  // Keep track of retry count across renders
  const autoLoginRetryCount = useRef(0);
  const manualLoginRetryCount = useRef(0);

  // Toggle theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
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
    const localSessionId = localStorage.getItem('vtop_session_id');
    if (localSessionId) {
      setMessage({ text: 'Verifying active session...', type: 'info' });
      api.post('/auth/check-session', { session_id: localSessionId })
        .then((res) => {
          if (res.data.status === 'success') {
            setSessionId(localSessionId);
            setIsLoggedIn(true);
            setActiveUser(res.data.username);
            setMessage(null);
          } else {
            localStorage.removeItem('vtop_session_id');
            startLoginFlow();
          }
        })
        .catch(() => {
          localStorage.removeItem('vtop_session_id');
          startLoginFlow();
        });
    } else {
      startLoginFlow();
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
  const startLoginFlow = async () => {
    setMessage({ text: 'Initializing secure connection to VTOP...', type: 'info' });
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
        setCaptcha('');
        setMessage(null);

        console.log(`[VTOP] Session initialized. Captcha type: ${currentCaptchaType === 2 ? 'Google ReCAPTCHA' : 'Text CAPTCHA'}`);

        if (currentCaptchaType === 1) {
          // Solve built-in CAPTCHA in background
          try {
            console.log("Running built-in CAPTCHA solver...");
            const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
            setCaptcha(solvedText);
            console.log("CAPTCHA solved successfully:", solvedText);
          } catch (solveError: any) {
            console.error("CAPTCHA solve failed:", solveError);
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

  // CAPTCHA Refresh / Silent loop helper for manual login (only used for built-in text captcha)
  const startLoginFlowAndRetry = async () => {
    try {
      const res = await api.post<StartLoginResponse>('/auth/start-login');
      if (res.data.status === 'captcha_ready') {
        setSessionId(res.data.session_id);
        setCaptchaImg(res.data.captcha_image_data);
        setHasSavedCreds(res.data.has_saved_creds);
        
        try {
          const solvedText = await solveCaptchaClient(res.data.captcha_image_data);
          setCaptcha(solvedText);
          console.log("Captcha solved silently in background:", solvedText);
          
          loginMutation.mutate({
            captchaText: solvedText,
            currentSessionId: res.data.session_id
          });
        } catch (solveError) {
          startLoginFlow();
        }
      }
    } catch (err) {
      startLoginFlow();
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
        }
        // Auto reset message after success
        setTimeout(() => setMessage(null), 3000);
      } else if (data.status === 'invalid_captcha') {
        console.log("Manual login CAPTCHA failed. Retrying...");
        safeResetRecaptcha();
        if (captchaType === 1 && manualLoginRetryCount.current < MAX_RETRIES) {
          manualLoginRetryCount.current++;
          startLoginFlowAndRetry();
        } else {
          manualLoginRetryCount.current = 0;
          setMessage({ text: 'Failed to solve CAPTCHA after 5 attempts. Please try again.', type: 'error' });
          startLoginFlow();
        }
      } else {
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
          // Fetch username to display
          api.post('/auth/check-session', { session_id: variables.currentSessionId })
            .then(res => {
              if (res.data.username) setActiveUser(res.data.username);
            });
        }
        setTimeout(() => setMessage(null), 3000);
      } else if (data.status === 'invalid_captcha' || data.status === 'error') {
        console.log("Auto-login error or CAPTCHA rejected. Retrying automatically...");
        safeResetRecaptcha();
        if (autoLoginRetryCount.current < MAX_RETRIES) {
          autoLoginRetryCount.current++;
          setTimeout(() => startLoginFlow(), 1000);
        } else {
          autoLoginRetryCount.current = 0;
          setMessage({ text: 'Auto-login timed out. Please log in manually.', type: 'error' });
          setShowManualForm(true);
          startLoginFlow();
        }
      } else {
        setMessage({ text: data.message || 'Auto-login failed.', type: 'error' });
        if (data.status === 'invalid_credentials') {
          setHasSavedCreds(false); // Stored credentials deleted
        }
        safeResetRecaptcha();
        setShowManualForm(true);
        startLoginFlow();
      }
    },
    onError: (err: any) => {
      setMessage({ 
        text: err.response?.data?.message || 'An error occurred during auto-login.', 
        type: 'error' 
      });
      safeResetRecaptcha();
      setShowManualForm(true);
      startLoginFlow();
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
      setMessage({ text: 'Successfully logged out.', type: 'success' });
      autoLoginRetryCount.current = 0;
      setShowManualForm(true);
      startLoginFlow();
    }
  });

  // Data Queries (Student Information)
  const semestersQuery = useQuery({
    queryKey: ['semesters', sessionId],
    queryFn: async () => {
      return [
        { id: 'CH20262701', name: 'Fall Semester 2026-27' },
        { id: 'CH20252605', name: 'Winter Semester 2025-26' },
        { id: 'CH20252601', name: 'Fall Semester 2025-26' }
      ];
    },
    enabled: isLoggedIn && !!sessionId
  });

  // Set default active semester when semesters list loads
  useEffect(() => {
    if (semestersQuery.data && semestersQuery.data.length && !activeSemester) {
      // Find currently selected semester or fallback to first option
      const currentSem = semestersQuery.data[0];
      setActiveSemester(currentSem.id);
    }
  }, [semestersQuery.data]);

  const profileQuery = useQuery({
    queryKey: ['profile', sessionId],
    queryFn: async () => {
      const res = await api.post('/data/profile');
      return res.data.raw_data;
    },
    enabled: isLoggedIn && !!sessionId && activeTab === 'profile'
  });

  const timetableQuery = useQuery({
    queryKey: ['timetable', sessionId, activeSemester],
    queryFn: async () => {
      const res = await api.post('/data/timetable', { semesterSubId: activeSemester });
      return res.data.raw_data;
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeTab === 'timetable'
  });

  const attendanceQuery = useQuery({
    queryKey: ['attendance', sessionId, activeSemester],
    queryFn: async () => {
      const res = await api.post('/data/attendance', { semesterSubId: activeSemester });
      return res.data.raw_data as any[];
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeTab === 'attendance'
  });

  const attendanceDetailQuery = useQuery({
    queryKey: ['attendance-detail', sessionId, activeSemester, selectedAttendanceCourse?.class_id, selectedAttendanceCourse?.slot_param],
    queryFn: async () => {
      const res = await api.post('/data/attendance-detail', {
        semesterSubId: activeSemester,
        classId: selectedAttendanceCourse.class_id,
        slot: selectedAttendanceCourse.slot_param
      });
      return res.data.raw_data as any[];
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && !!selectedAttendanceCourse
  });

  const marksQuery = useQuery({
    queryKey: ['marks', sessionId, activeSemester],
    queryFn: async () => {
      const res = await api.post('/data/marks', { semesterSubId: activeSemester });
      return res.data.raw_data;
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeTab === 'marks'
  });

  const gradesQuery = useQuery({
    queryKey: ['grades', sessionId, activeSemester],
    queryFn: async () => {
      const res = await api.post('/data/grades', { semesterSubId: activeSemester });
      return res.data.raw_data;
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeTab === 'grades'
  });

  const examsQuery = useQuery({
    queryKey: ['exams', sessionId, activeSemester],
    queryFn: async () => {
      const res = await api.post('/data/exams', { semesterSubId: activeSemester });
      return res.data.raw_data as any[];
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeTab === 'exams'
  });

  const calendarQuery = useQuery({
    queryKey: ['calendar', sessionId, activeSemester, calendarDate.getMonth(), calendarDate.getFullYear()],
    queryFn: async () => {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const dateStr = `01-${months[calendarDate.getMonth()]}-${calendarDate.getFullYear()}`;
      const res = await api.post('/data/calendar', {
        semesterSubId: activeSemester,
        calDate: dateStr
      });
      return res.data.raw_data;
    },
    enabled: isLoggedIn && !!sessionId && !!activeSemester && activeTab === 'calendar'
  });

  const credentialsQuery = useQuery({
    queryKey: ['credentials', sessionId],
    queryFn: async () => {
      const res = await api.post('/data/credentials');
      return res.data.raw_data;
    },
    enabled: isLoggedIn && !!sessionId && activeTab === 'credentials'
  });

  const debugQuery = useQuery({
    queryKey: ['debug', sessionId],
    queryFn: async () => {
      const res = await api.post('/data/debug');
      return res.data;
    },
    enabled: isLoggedIn && !!sessionId && activeTab === 'debug'
  });

  // Handle session expiration globally on query errors
  useEffect(() => {
    if (semestersQuery.isError || profileQuery.isError || timetableQuery.isError) {
      console.warn("API request failed. Session likely expired. Logging out...");
      setIsLoggedIn(false);
      setActiveUser('');
      localStorage.removeItem('vtop_session_id');
      setMessage({ text: 'Session expired. Please log in again.', type: 'error' });
      setShowManualForm(true);
      startLoginFlow();
    }
  }, [semestersQuery.isError, profileQuery.isError, timetableQuery.isError]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaType === 2) {
      triggerGoogleReCAPTCHA();
    } else {
      if (!username || !password || !captcha) {
        setMessage({ text: 'All fields are required.', type: 'error' });
        return;
      }
      if (sessionId) {
        loginMutation.mutate({
          captchaText: captcha,
          currentSessionId: sessionId
        });
      }
    }
  };

  const handleAutoLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaType === 2) {
      triggerGoogleReCAPTCHA();
    } else {
      if (!captcha) {
        setMessage({ text: 'CAPTCHA preparation in progress...', type: 'error' });
        return;
      }
      if (sessionId) {
        autoLoginMutation.mutate({
          captchaText: captcha,
          currentSessionId: sessionId
        });
      }
    }
  };

  // If CAPTCHA is loading/solving, disable buttons
  const isCaptchaSolving = captchaType === 1 && !captcha && !loginMutation.isError && !autoLoginMutation.isError;
  const isPending = loginMutation.isPending || autoLoginMutation.isPending;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      
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
            className="absolute top-6 right-6 p-3 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 text-blue-500" /> : <Moon className="h-5 w-5 text-slate-700" />}
          </button>

          <div className="w-full max-w-md">
            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-extrabold tracking-tight text-blue-600 dark:text-blue-500">
                VtopC
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                Decoupled VTOP Chennai Portal Dashboard
              </p>
            </div>

            {/* Error/Info Banner */}
            {message && (
              <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border text-sm shadow-sm transition-all duration-300 ${
                message.type === 'success' 
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
            <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-8 shadow-md">
              
              <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                {hasSavedCreds && !showManualForm ? 'Auto-Login Available' : 'Student Credentials'}
              </h2>

              {hasSavedCreds && !showManualForm ? (
                /* Auto login flow (CAPTCHA details are completely hidden) */
                <form onSubmit={handleAutoLoginSubmit} className="space-y-6">
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
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
                      className="w-full py-3 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      Sign In with Another Account
                    </button>
                  </div>
                </form>
              ) : (
                /* Standard manual login flow (CAPTCHA is completely hidden!) */
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Registration Number</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. 21BCE5001"
                        disabled={isPending}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-transparent focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isPending}
                        className="w-full pl-12 pr-12 py-3 rounded-xl border border-slate-200 dark:border-neutral-800 bg-transparent focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer outline-none"
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
                    {/* Return to Auto-Login button removed */}
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      ) : (
        /* ================= STUDENT DASHBOARD INTERFACE ================= */
        <div className="flex-1 flex flex-col md:flex-row">
          
          {/* SIDEBAR NAVIGATION */}
          <aside className="w-full md:w-64 bg-white dark:bg-neutral-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-neutral-800 flex flex-col justify-between shrink-0">
            <div className="p-6">
              {/* App logo inside sidebar */}
              <div className="flex items-center gap-3 mb-8">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-500">VtopC</span>
                <span className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">CC</span>
              </div>

              {/* Semester selector */}
              {semestersQuery.data && semestersQuery.data.length > 0 && (
                <div className="mb-6">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Semester</label>
                  <select 
                    value={activeSemester}
                    onChange={(e) => setActiveSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {semestersQuery.data.map(sem => (
                      <option key={sem.id} value={sem.id}>{sem.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Navigation Items */}
              <nav className="space-y-1">
                <button 
                  onClick={() => { setActiveTab('profile'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'profile' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <UserIcon className="h-4 w-4" /> Student Profile
                </button>
                <button 
                  onClick={() => { setActiveTab('timetable'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'timetable' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Clock className="h-4 w-4" /> Timetable Grid
                </button>
                <button 
                  onClick={() => { setActiveTab('attendance'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'attendance' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <UserCheck className="h-4 w-4" /> Class Attendance
                </button>
                <button 
                  onClick={() => { setActiveTab('marks'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'marks' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <FileText className="h-4 w-4" /> Course Marks
                </button>
                <button 
                  onClick={() => { setActiveTab('grades'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'grades' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Award className="h-4 w-4" /> Final Grades
                </button>
                <button 
                  onClick={() => { setActiveTab('exams'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'exams' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <CalendarIcon className="h-4 w-4" /> Exam Schedule
                </button>
                <button 
                  onClick={() => { setActiveTab('calendar'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'calendar' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <CalendarIcon className="h-4 w-4" /> Academic Calendar
                </button>
                <button 
                  onClick={() => { setActiveTab('credentials'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'credentials' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Lock className="h-4 w-4" /> WiFi & Systems
                </button>
                <button 
                  onClick={() => { setActiveTab('debug'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    activeTab === 'debug' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Bug className="h-4 w-4" /> Debug Window
                </button>
              </nav>
            </div>

            {/* User Profile Card & Sign Out at the Bottom */}
            <div className="p-4 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs uppercase border border-blue-200 dark:border-blue-900/60">
                  {activeUser ? activeUser.substring(0, 2) : 'ST'}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold truncate text-slate-800 dark:text-slate-200">{activeUser || 'Active Session'}</div>
                  <div className="text-[10px] text-slate-400 truncate font-mono">VTOP Chennai</div>
                </div>
              </div>
              <button 
                onClick={() => logoutMutation.mutate()} 
                title="Sign Out"
                disabled={logoutMutation.isPending}
                className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </aside>

          {/* MAIN DASHBOARD CONTENT AREA */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-6xl mx-auto w-full">
            
            {/* Header controls (Theme switcher and title) */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard Workspace</span>
                <h2 className="text-2xl font-black capitalize text-slate-900 dark:text-slate-50">{activeTab} View</h2>
              </div>
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-3 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4 text-blue-500" /> : <Moon className="h-4 w-4 text-slate-700" />}
              </button>
            </div>

            {/* TAB VIEWS IN ACTION */}
            
            {/* 1. PROFILE VIEW */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {profileQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : profileQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to load student profile details. Please refresh.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left profile block */}
                    <div className="md:col-span-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 text-center space-y-4 shadow-sm">
                      <div className="h-28 w-28 rounded-full bg-slate-100 dark:bg-black border border-slate-200 dark:border-neutral-800 overflow-hidden mx-auto relative flex items-center justify-center">
                        {profileQuery.data?.personal?.photo_url ? (
                          <img 
                            src={profileQuery.data.personal.photo_url} 
                            alt="Student" 
                            className="h-full w-full object-cover" 
                          />
                        ) : (
                          <UserIcon className="h-12 w-12 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{profileQuery.data?.personal?.name || 'N/A'}</h3>
                        <p className="text-xs text-blue-600 dark:text-blue-500 font-mono font-bold mt-1">
                          {profileQuery.data?.educational?.reg_no || 'N/A'}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-slate-100 dark:border-neutral-800 text-left space-y-2.5 text-xs">
                        <div className="flex justify-between"><span className="text-slate-400 font-medium">Application No</span><span className="font-semibold">{profileQuery.data?.personal?.app_no}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400 font-medium">Blood Group</span><span className="font-semibold">{profileQuery.data?.personal?.blood_group}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400 font-medium">DOB</span><span className="font-semibold">{profileQuery.data?.personal?.dob}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400 font-medium">Native State</span><span className="font-semibold">{profileQuery.data?.personal?.native_state}</span></div>
                      </div>
                    </div>

                    {/* Right details grids */}
                    <div className="md:col-span-2 space-y-6">
                      {/* Academic & Proctor Info */}
                      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold border-b border-slate-100 dark:border-neutral-800 pb-2 text-blue-600 dark:text-blue-500">Academic Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div><div className="text-slate-400 mb-1">School</div><div className="font-bold">{profileQuery.data?.educational?.school}</div></div>
                          <div><div className="text-slate-400 mb-1">Board</div><div className="font-bold">{profileQuery.data?.educational?.board}</div></div>
                          <div><div className="text-slate-400 mb-1">Medium</div><div className="font-bold">{profileQuery.data?.educational?.medium}</div></div>
                          <div><div className="text-slate-400 mb-1">Passing Year</div><div className="font-bold">{profileQuery.data?.educational?.year_passing}</div></div>
                        </div>
                      </div>

                      {/* Proctor details */}
                      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold border-b border-slate-100 dark:border-neutral-800 pb-2 text-blue-600 dark:text-blue-500">Proctor Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div><div className="text-slate-400 mb-1">Proctor Name</div><div className="font-bold">{profileQuery.data?.proctor?.name}</div></div>
                          <div><div className="text-slate-400 mb-1">Designation</div><div className="font-bold">{profileQuery.data?.proctor?.designation}</div></div>
                          <div><div className="text-slate-400 mb-1">Cabin</div><div className="font-bold font-mono">{profileQuery.data?.proctor?.cabin}</div></div>
                          <div><div className="text-slate-400 mb-1">Email</div><div className="font-bold truncate select-all">{profileQuery.data?.proctor?.email}</div></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. TIMETABLE VIEW */}
            {activeTab === 'timetable' && (
              <div className="space-y-6">
                {timetableQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : timetableQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to load student timetable. Please select another semester or check connection.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Courses Credit Stat Bar */}
                    <div className="p-4 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                        <span className="text-sm font-semibold">Registered Credits</span>
                      </div>
                      <div className="text-lg font-black text-blue-600 dark:text-blue-500">{timetableQuery.data?.total_credits}</div>
                    </div>

                    {/* Desktop Timetable grid */}
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs table-fixed min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-black border-b border-slate-200 dark:border-neutral-800">
                              <th className="p-4 font-bold w-20 text-center">Day</th>
                              {Object.keys(timetableQuery.data?.timetable?.MON || {}).map((slotKey) => (
                                <th key={slotKey} className="p-4 font-bold text-center overflow-hidden truncate" title={slotKey}>{slotKey}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {['MON', 'TUE', 'WED', 'THU', 'FRI'].map(day => (
                              <tr key={day} className="border-b border-slate-100 dark:border-neutral-800/40 hover:bg-slate-50/50 dark:hover:bg-neutral-800/20">
                                <td className="p-4 font-bold text-center bg-slate-50/40 dark:bg-black/35">{day}</td>
                                {Object.keys(timetableQuery.data?.timetable?.MON || {}).map((slotKey) => {
                                  const cellData = timetableQuery.data?.timetable[day]?.[slotKey];
                                  return (
                                    <td key={slotKey} className="p-2 border-r border-slate-100 dark:border-neutral-800/40 text-center">
                                      {cellData ? (
                                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-2 rounded-lg space-y-1">
                                          <div className="font-extrabold text-[10px] text-blue-600 dark:text-blue-500">{cellData.code}</div>
                                          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold truncate" title={cellData.title}>{cellData.title}</div>
                                          <div className="text-[9px] text-slate-400 font-mono">{cellData.venue}</div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300 dark:text-neutral-800">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. ATTENDANCE VIEW */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                {attendanceQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : attendanceQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to fetch attendance data. Please verify your connection.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Main Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {attendanceQuery.data.map((course: any, idx: number) => {
                        const percent = parseFloat(course.percentage) || 0;
                        const isSafe = percent >= 75;

                        return (
                          <div 
                            key={idx}
                            className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 font-bold px-2 py-0.5 rounded text-slate-500">{course.course_code}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isSafe 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                                }`}>
                                  {isSafe ? 'Attendance Safe' : 'Below 75%'}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold line-clamp-1 text-slate-800 dark:text-slate-100" title={course.course_title}>{course.course_title}</h4>
                              <p className="text-xs text-slate-400">{course.faculty}</p>
                              
                              <div className="pt-2 flex justify-between items-end text-xs">
                                <div>
                                  <span className="text-slate-400">Class Hours: </span>
                                  <span className="font-bold">{course.attended_classes}</span>
                                  <span className="text-slate-400"> / </span>
                                  <span className="font-bold">{course.total_classes}</span>
                                </div>
                                <div className="text-base font-black text-blue-600 dark:text-blue-500">{course.percentage}%</div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden mt-1">
                                <div 
                                  className={`h-full rounded-full ${isSafe ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>

                            <button 
                              onClick={() => setSelectedAttendanceCourse(course)}
                              className="w-full py-2.5 mt-4 text-xs font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-black dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              View Attendance Log <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. MARKS VIEW */}
            {activeTab === 'marks' && (
              <div className="space-y-6">
                {marksQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : marksQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to fetch course marks. Please refresh.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Estimated Consolidated Scores summary (if combined scores exist) */}
                    {marksQuery.data?.combined_scores?.length > 0 && (
                      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                          <h3 className="text-sm font-bold">Aggregated Subject Performance</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {marksQuery.data.combined_scores.map((cs: any, idx: number) => (
                            <div key={idx} className="p-4 bg-slate-50 dark:bg-black border border-slate-200 dark:border-neutral-800 rounded-2xl flex justify-between items-center text-xs">
                              <div>
                                <span className="font-extrabold text-blue-600 dark:text-blue-500">{cs.code}</span>
                                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cs.title}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-black text-slate-800 dark:text-slate-100">{cs.converted_score} / {cs.converted_max}</div>
                                <div className="text-[9px] text-slate-400">Total Credits: {cs.total_credits}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Raw assessments tables list */}
                    <div className="space-y-6">
                      {marksQuery.data?.courses?.map((course: any, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
                          <div className="flex justify-between items-start border-b border-slate-100 dark:border-neutral-800 pb-3">
                            <div>
                              <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 font-bold px-2 py-0.5 rounded text-slate-500 uppercase">{course.code} ({course.type})</span>
                              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1.5">{course.title}</h4>
                              <p className="text-xs text-slate-400 mt-0.5">{course.faculty}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-medium">Scored / Target Weightage</span>
                              <div className="text-lg font-black text-blue-600 dark:text-blue-500">{course.total_obtained} / {course.total_max_weightage}</div>
                            </div>
                          </div>

                          {/* Assessments Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="text-slate-400 font-bold border-b border-slate-100 dark:border-neutral-800/40">
                                  <th className="py-2.5">Assessment Name</th>
                                  <th className="py-2.5 text-center">Max Mark</th>
                                  <th className="py-2.5 text-center">Scored</th>
                                  <th className="py-2.5 text-center">Weightage %</th>
                                  <th className="py-2.5 text-center">Earned Wt</th>
                                  <th className="py-2.5 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {course.assessments.map((a: any, aIdx: number) => (
                                  <tr key={aIdx} className="border-b border-slate-100/50 dark:border-neutral-800/20 hover:bg-slate-50/40 dark:hover:bg-neutral-800/10">
                                    <td className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">{a.title}</td>
                                    <td className="py-2.5 text-center">{a.max_mark}</td>
                                    <td className="py-2.5 text-center font-bold">{a.scored || '-'}</td>
                                    <td className="py-2.5 text-center">{a.weightage_pct}%</td>
                                    <td className="py-2.5 text-center font-bold text-blue-600 dark:text-blue-400">{a.weightage_mark || '-'}</td>
                                    <td className="py-2.5 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        a.status.toLowerCase() === 'present' 
                                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                                          : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'
                                      }`}>{a.status}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. GRADES VIEW */}
            {activeTab === 'grades' && (
              <div className="space-y-6">
                {gradesQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : gradesQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to fetch GPA / Course Grade details. Please refresh.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* GPA Top Banner */}
                    {gradesQuery.data?.gpa && (
                      <div className="p-6 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl flex justify-between items-center shadow-sm">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Merit</span>
                          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Cumulative Semester GPA</h3>
                        </div>
                        <div className="text-3xl font-black text-blue-600 dark:text-blue-500">{gradesQuery.data.gpa}</div>
                      </div>
                    )}

                    {/* Grades Table */}
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-black border-b border-slate-200 dark:border-neutral-800">
                              <th className="p-4 font-bold">Course Info</th>
                              <th className="p-4 font-bold text-center">Type</th>
                              <th className="p-4 font-bold text-center">Credits</th>
                              <th className="p-4 font-bold text-center">Total Marks</th>
                              <th className="p-4 font-bold text-center">Grade Letter</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gradesQuery.data?.grades?.map((g: any, index: number) => (
                              <tr key={index} className="border-b border-slate-100 dark:border-neutral-800/40 hover:bg-slate-50/50 dark:hover:bg-neutral-800/20">
                                <td className="p-4">
                                  <div className="font-extrabold text-blue-600 dark:text-blue-500">{g.code}</div>
                                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{g.title}</div>
                                </td>
                                <td className="p-4 text-center text-slate-400">{g.type}</td>
                                <td className="p-4 text-center font-semibold">{g.credits}</td>
                                <td className="p-4 text-center font-bold">{g.total || '-'}</td>
                                <td className="p-4 text-center">
                                  <span className="text-sm font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-3 py-1 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                    {g.grade || '-'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. EXAMS VIEW */}
            {activeTab === 'exams' && (
              <div className="space-y-6">
                {examsQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : examsQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>No exam schedules found or session timed out. Please retry.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {examsQuery.data.length === 0 ? (
                      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-8 text-center space-y-2 shadow-sm">
                        <CalendarIcon className="h-12 w-12 text-slate-400 mx-auto" />
                        <h4 className="font-bold">No Exams Scheduled</h4>
                        <p className="text-xs text-slate-400">There are currently no active exam schedules for this semester.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {examsQuery.data.map((exam: any, idx: number) => (
                          <div 
                            key={idx}
                            className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6"
                          >
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">{exam.exam_type}</span>
                                <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 text-slate-500 font-bold px-2 py-0.5 rounded">{exam.course_code}</span>
                              </div>
                              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{exam.course_title}</h4>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
                                <div><div className="text-slate-400 mb-0.5">Date</div><div className="font-bold">{exam.exam_date}</div></div>
                                <div><div className="text-slate-400 mb-0.5">Session</div><div className="font-bold font-mono">{exam.exam_session}</div></div>
                                <div><div className="text-slate-400 mb-0.5">Time</div><div className="font-bold">{exam.exam_time}</div></div>
                                <div><div className="text-slate-400 mb-0.5 font-bold text-blue-600 dark:text-blue-500">Venue</div><div className="font-extrabold font-mono text-blue-600 dark:text-blue-500">{exam.venue}</div></div>
                              </div>
                            </div>

                            {/* Seating Location info box */}
                            <div className="bg-slate-50 dark:bg-black border border-slate-150 dark:border-neutral-800/80 rounded-2xl p-4 md:w-56 shrink-0 flex flex-col justify-center space-y-2.5 text-xs text-center">
                              <div>
                                <span className="text-slate-400 font-semibold">Seat Number</span>
                                <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">{exam.seat_no || 'N/A'}</div>
                              </div>
                              <div className="border-t border-slate-200 dark:border-neutral-800 pt-2">
                                <span className="text-slate-400 font-semibold">Room / Location</span>
                                <div className="font-bold text-blue-600 dark:text-blue-400 mt-0.5">{exam.seat_location || 'N/A'}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 7. CALENDAR VIEW */}
            {activeTab === 'calendar' && (
              <div className="space-y-6">
                {calendarQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : calendarQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to fetch Academic Calendar. Please retry.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Header Controls for Month */}
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm">
                      <button
                        onClick={() => {
                          const prev = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
                          setCalendarDate(prev);
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-50 hover:bg-slate-100 dark:bg-black dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg cursor-pointer text-slate-800 dark:text-slate-200"
                      >
                        ◀ Previous Month
                      </button>
                      <h3 className="font-extrabold text-blue-600 dark:text-blue-500 text-sm md:text-base">
                        {calendarQuery.data?.month_title || 'Calendar Month'}
                      </h3>
                      <button
                        onClick={() => {
                          const next = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
                          setCalendarDate(next);
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-slate-50 hover:bg-slate-100 dark:bg-black dark:hover:bg-neutral-800 border border-slate-200 dark:border-neutral-800 rounded-lg cursor-pointer text-slate-800 dark:text-slate-200"
                      >
                        Next Month ▶
                      </button>
                    </div>

                    {/* Calendar Grid */}
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
                      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-black font-bold text-center text-xs text-slate-500 py-3">
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                      </div>
                      <div className="grid grid-cols-7 auto-rows-[90px] md:auto-rows-[110px] divide-x divide-y divide-slate-100 dark:divide-neutral-800/40 border-l border-t border-slate-100 dark:divide-neutral-800/40">
                        {calendarQuery.data?.days?.map((dayObj: any, index: number) => {
                          const isPadding = dayObj.status === 'padding';
                          const isHoliday = dayObj.status === 'holiday';
                          const isWorking = dayObj.status === 'working';
                          const isDayOrder = dayObj.status === 'day_order';

                          let bgClass = 'bg-transparent';
                          if (isHoliday) bgClass = 'bg-rose-50/20 dark:bg-rose-950/5';
                          else if (isWorking) bgClass = 'bg-emerald-50/20 dark:bg-emerald-950/5';
                          else if (isDayOrder) bgClass = 'bg-amber-50/20 dark:bg-amber-950/5';

                          return (
                            <div key={index} className={`p-2 flex flex-col justify-between overflow-hidden text-left relative ${bgClass}`}>
                              {!isPadding && (
                                <>
                                  <div className="flex justify-between items-center">
                                    <span className={`text-xs font-extrabold ${
                                      isHoliday ? 'text-rose-600 dark:text-rose-400' :
                                      isWorking ? 'text-emerald-600 dark:text-emerald-400' :
                                      isDayOrder ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
                                    }`}>
                                      {dayObj.day}
                                    </span>
                                    {isDayOrder && (
                                      <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase">Day Ord</span>
                                    )}
                                  </div>
                                  <div className="flex-1 mt-1 flex flex-col justify-end space-y-0.5 max-h-[50px] overflow-y-auto">
                                    {dayObj.events?.map((e: any, eIdx: number) => (
                                      <div
                                        key={eIdx}
                                        className={`text-[9px] truncate px-1 py-0.5 rounded-sm font-semibold ${
                                          isHoliday ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' :
                                          isWorking ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' :
                                          isDayOrder ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' :
                                          'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300'
                                        }`}
                                        title={e.text}
                                      >
                                        {e.text}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 8. CREDENTIALS VIEW */}
            {activeTab === 'credentials' && (
              <div className="space-y-6">
                {credentialsQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : credentialsQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to fetch WiFi and Proctor System credentials from VTOP.</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Intro text */}
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-sm space-y-1.5">
                      <h3 className="text-sm font-bold text-blue-600 dark:text-blue-500">VTOP Stored System Logins</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        These credentials are automatically registered by Chennai Campus for your official lab computers, hostel WiFi access, and related university networks.
                      </p>
                    </div>

                    {/* WiFi / Account Credentials */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">WiFi & System Accounts</h4>
                      {credentialsQuery.data?.accounts?.length === 0 ? (
                        <div className="text-xs text-slate-400 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
                          No general system accounts found.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {credentialsQuery.data?.accounts?.map((acc: any, index: number) => (
                            <div
                              key={index}
                              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4 relative overflow-hidden"
                            >
                              <div className="flex justify-between items-start border-b border-slate-100 dark:border-neutral-800 pb-3">
                                <div>
                                  <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 font-bold px-2 py-0.5 rounded text-slate-500 uppercase">Account</span>
                                  <h4 className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-100">{acc.account}</h4>
                                </div>
                                {acc.url && acc.url !== '#' && (
                                  <a
                                    href={acc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] font-bold text-blue-600 hover:underline"
                                  >
                                    Login Portal ↗
                                  </a>
                                )}
                              </div>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Username</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold select-all">{acc.username}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(acc.username)}
                                      className="text-[10px] text-blue-600 dark:text-blue-500 hover:underline active:text-blue-850 cursor-pointer"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Password</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold select-all">{acc.password}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(acc.password)}
                                      className="text-[10px] text-blue-600 dark:text-blue-500 hover:underline active:text-blue-850 cursor-pointer"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Special Exam Credentials */}
                    <div className="space-y-4 pt-2">
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">Exam Network Credentials</h4>
                      {credentialsQuery.data?.exams?.length === 0 ? (
                        <div className="text-xs text-slate-400 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-4 text-center">
                          No active exam credentials found.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {credentialsQuery.data?.exams?.map((ex: any, index: number) => (
                            <div
                              key={index}
                              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4"
                            >
                              <div className="flex justify-between items-start border-b border-slate-100 dark:border-neutral-800 pb-3">
                                <div>
                                  <span className="text-[10px] bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded uppercase">Exam Seat</span>
                                  <h4 className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-100">{ex.account}</h4>
                                </div>
                                <div className="text-right text-[10px] text-slate-400">
                                  Seat Number: <strong className="text-slate-700 dark:text-slate-300 font-mono">{ex.seat}</strong>
                                </div>
                              </div>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Venue & Date</span>
                                  <span className="font-bold">{ex.venue_date}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Username</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold select-all">{ex.username}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(ex.username)}
                                      className="text-[10px] text-blue-600 dark:text-blue-500 hover:underline cursor-pointer"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Password</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold select-all">{ex.password}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(ex.password)}
                                      className="text-[10px] text-blue-600 dark:text-blue-500 hover:underline cursor-pointer"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* 9. DEBUG WINDOW VIEW */}
            {activeTab === 'debug' && (
              <div className="space-y-6">
                {debugQuery.isPending ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : debugQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2 animate-fade-in">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>Failed to load debug details from backend. Ensure your VTOP session is active.</span>
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    {/* Header */}
                    <div className="p-5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl shadow-sm space-y-2">
                      <h3 className="text-sm font-bold text-blue-600 dark:text-blue-500">VTOP Session Credentials (Debug)</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Below are the active session variables parsed by the backend after successful login, along with the raw HTML retrieved from the timetable menu route.
                      </p>
                    </div>

                    {/* Meta details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-3">
                        <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 font-bold px-2 py-0.5 rounded text-slate-500 uppercase">Authorized ID</span>
                        <div className="text-base font-mono font-extrabold text-slate-800 dark:text-slate-100 select-all">
                          {debugQuery.data?.authorizedId || 'N/A'}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          This is the internal VTOP student roll code. Note that it might be different than your login ID.
                        </p>
                      </div>

                      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-3">
                        <span className="text-[10px] bg-slate-100 dark:bg-neutral-800 font-bold px-2 py-0.5 rounded text-slate-500 uppercase">Active CSRF Token</span>
                        <div className="text-base font-mono font-extrabold text-slate-800 dark:text-slate-100 select-all truncate" title={debugQuery.data?.csrfToken}>
                          {debugQuery.data?.csrfToken || 'N/A'}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          The active cross-site request forgery protection token extracted from the /content page.
                        </p>
                      </div>
                    </div>

                    {/* Raw response html */}
                    <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-neutral-800 pb-3">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Timetable Endpoint Response HTML</h4>
                        <button
                          onClick={() => {
                            if (debugQuery.data?.rawHtml) {
                              navigator.clipboard.writeText(debugQuery.data.rawHtml);
                            }
                          }}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-500 hover:underline cursor-pointer"
                        >
                          Copy Full HTML
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        HTML output returned from requesting <code className="bg-slate-100 dark:bg-black font-mono px-1 rounded">academics/common/StudentTimeTableChn</code>:
                      </p>
                      <div className="bg-slate-50 dark:bg-black border border-slate-150 dark:border-neutral-800 rounded-2xl p-4 overflow-x-auto max-h-[400px] overflow-y-auto">
                        <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap select-all">
                          {debugQuery.data?.rawHtml || 'No HTML content returned.'}
                        </pre>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

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
                  ✕
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
                ) : (
                  <div className="border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden text-xs">
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
                            const isPresent = log.status.toLowerCase() === 'present';
                            return (
                              <tr key={logIdx} className="border-b border-slate-100 dark:border-neutral-800/40 hover:bg-slate-50/50 dark:hover:bg-neutral-800/20">
                                <td className="p-3 font-semibold text-slate-400">{log.sl_no}</td>
                                <td className="p-3 font-bold">{log.date}</td>
                                <td className="p-3">
                                  <div>{log.slot}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{log.timing}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    isPresent 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400' 
                                      : 'bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400'
                                  }`}>
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
