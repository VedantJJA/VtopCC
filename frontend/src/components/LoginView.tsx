import React, { useState } from 'react';
import { 
  User as UserIcon, Lock, Eye, EyeOff, CheckCircle2, 
  AlertTriangle, Loader2, Sun, Moon
} from 'lucide-react';

interface LoginViewProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  message: { text: string; type: 'success' | 'error' | 'info' } | null;
  hasSavedCreds: boolean;
  showManualForm: boolean;
  setShowManualForm: (show: boolean) => void;
  username: string;
  setUsername: (username: string) => void;
  password: string;
  setPassword: (password: string) => void;
  captcha: string;
  setCaptcha: (captcha: string) => void;
  showCaptchaUI: boolean;
  captchaType: number;
  captchaImg: string | null;
  isPending: boolean;
  isCaptchaSolving: boolean;
  handleAutoLoginSubmit: (e: React.FormEvent) => void;
  handleLoginSubmit: (e: React.FormEvent) => void;
  recaptchaRef: React.RefObject<HTMLDivElement | null>;
}

export const LoginView: React.FC<LoginViewProps> = ({
  theme,
  setTheme,
  message,
  hasSavedCreds,
  showManualForm,
  setShowManualForm,
  username,
  setUsername,
  password,
  setPassword,
  captcha,
  setCaptcha,
  showCaptchaUI,
  captchaType,
  captchaImg,
  isPending,
  isCaptchaSolving,
  handleAutoLoginSubmit,
  handleLoginSubmit,
  recaptchaRef
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
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
          <p className="text-textMuted mt-2 text-sm font-medium">
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
            /* Auto login flow */
            <form onSubmit={handleAutoLoginSubmit} className="space-y-6">
              <p className="text-sm text-textMuted leading-relaxed font-semibold">
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
            /* Standard manual login flow */
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
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {showCaptchaUI && captchaType === 1 && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-textMain">CAPTCHA Verification</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-center bg-bgPrimary p-3 rounded-2xl border border-borderColor">
                      {captchaImg ? (
                        <img
                          src={captchaImg}
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

      {/* Google ReCAPTCHA container widget */}
      <div 
        id="recaptcha-widget"
        ref={recaptchaRef}
        className="g-recaptcha"
        data-sitekey="6Ld-UoIpAAAAAHk72Z8XhVp-g9H8qK8f1mQ9m_4W"
        data-callback="onRecaptchaSolved"
        data-size="invisible"
      />
    </div>
  );
};
