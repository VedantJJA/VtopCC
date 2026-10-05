import React, { useState } from 'react';
import { 
  User as UserIcon, Lock, Eye, EyeOff, CheckCircle2, 
  AlertTriangle, AlertCircle, Loader2, Sun, Moon, ShieldAlert,
  RotateCw, ShieldCheck
} from 'lucide-react';
import { VtopLogo } from './VtopLogo';

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
  isPending: boolean;
  isCaptchaSolving: boolean;
  handleAutoLoginSubmit: (e: React.FormEvent) => void;
  handleLoginSubmit: (e: React.FormEvent) => void;
  recaptchaRef: React.RefObject<HTMLDivElement | null>;
  captchaImageData?: string;
  captcha: string;
  setCaptcha: (val: string) => void;
  onRefreshCaptcha?: () => void;
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
  isPending,
  isCaptchaSolving,
  handleAutoLoginSubmit,
  handleLoginSubmit,
  recaptchaRef,
  captchaImageData,
  captcha,
  setCaptcha,
  onRefreshCaptcha
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const isInvalidCreds = message?.type === 'error' && (
    message.text.toLowerCase().includes('invalid loginid/password') || 
    message.text.toLowerCase().includes('invalid credentials') ||
    message.text.toLowerCase().includes('password')
  );

  const isInvalidCaptcha = message?.type === 'error' && (
    message.text.toLowerCase().includes('captcha')
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
      {/* Hidden container for ReCAPTCHA if needed */}
      <div ref={recaptchaRef} className="hidden" />

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
        <div className="text-center mb-8 flex flex-col items-center">
          <VtopLogo size={56} className="mb-3" />
          <h1 className="text-4xl font-extrabold tracking-tight text-blue-600 dark:text-blue-500">
            VtopC
          </h1>
          <p className="text-xs text-textMuted mt-1">
            Personal VTOP Client for VIT Students
          </p>
        </div>

        {/* Dedicated Error and Status Displays */}
        {message && (
          <>
            {isInvalidCreds ? (
              /* Specific Error Display: Invalid LoginId / Password */
              <div className="p-4 rounded-2xl mb-6 text-xs flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Invalid LoginId/Password</p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-normal">
                    The registration number or password you entered is incorrect. Please check your credentials.
                  </p>
                </div>
              </div>
            ) : isInvalidCaptcha ? (
              /* Specific Error Display: Invalid Captcha */
              <div className="p-4 rounded-2xl mb-6 text-xs flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-sm text-amber-900 dark:text-amber-200">Invalid Captcha</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 font-normal">
                    {message.text.includes('Retrying') ? message.text : 'Automatic CAPTCHA verification failed. Please try signing in again.'}
                  </p>
                </div>
              </div>
            ) : (
              /* Generic Message Banner */
              <div className={`p-4 rounded-2xl mb-6 text-xs flex items-center gap-3 font-semibold ${
                message.type === 'error' 
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 border border-rose-200 dark:border-rose-900' 
                  : message.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 dark:border-emerald-900'
                  : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 border border-blue-200 dark:border-blue-900'
              }`}>
                {message.type === 'error' ? (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
                ) : message.type === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Loader2 className="h-5 w-5 shrink-0 text-blue-500 animate-spin" />
                )}
                <span>{message.text}</span>
              </div>
            )}
          </>
        )}

        {/* Saved Credentials Card */}
        {hasSavedCreds && !showManualForm ? (
          <div className="bg-bgCard border border-borderColor rounded-2xl p-6 shadow-xl space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-textMain">Welcome Back!</h2>
              <p className="text-xs text-textMuted">You have saved VTOP credentials on this device.</p>
            </div>

            <form onSubmit={handleAutoLoginSubmit} className="space-y-4">
              {captchaImageData && (
                <div className="p-3 bg-bgPrimary/60 border border-borderColor rounded-xl flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={captchaImageData} 
                      alt="Fetched CAPTCHA" 
                      className="h-8 bg-white rounded-lg border border-borderColor/80 object-contain px-1.5 filter contrast-125 shadow-2xs" 
                    />
                    <div className="text-[11px] leading-tight font-mono text-textMuted">
                      <span className="block font-semibold text-textMain">{captcha ? `Detected: ${captcha}` : 'Fetched CAPTCHA'}</span>
                      <span className="text-[10px] text-textMuted/80">Auto-authenticating</span>
                    </div>
                  </div>
                  {isCaptchaSolving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                  ) : onRefreshCaptcha ? (
                    <button
                      type="button"
                      onClick={onRefreshCaptcha}
                      className="p-1 text-textMuted hover:text-textMain transition-colors cursor-pointer"
                      title="Fetch new CAPTCHA"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || isCaptchaSolving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isPending || isCaptchaSolving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isCaptchaSolving ? 'Solving CAPTCHA in background...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <span>Sign In with Saved Account</span>
                )}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowManualForm(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Sign in with a different registration number
              </button>
            </div>
          </div>
        ) : (
          /* Manual Login Form */
          <div className="bg-bgCard border border-borderColor rounded-2xl p-6 shadow-xl space-y-6">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textMain mb-1">
                  Registration Number / User ID
                </label>
                <div className="relative">
                  <UserIcon className={`absolute left-3.5 top-3 h-4 w-4 ${isInvalidCreds ? 'text-rose-400' : 'text-textMuted'}`} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toUpperCase())}
                    placeholder="e.g. 21BCE0001"
                    required
                    className={`w-full pl-10 pr-3 py-2.5 text-sm border rounded-2xl bg-bgPrimary text-textMain focus:ring-2 focus:outline-none font-mono uppercase ${
                      isInvalidCreds 
                        ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500' 
                        : 'border-borderColor focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-textMain mb-1">
                  VTOP Password
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3.5 top-3 h-4 w-4 ${isInvalidCreds ? 'text-rose-400' : 'text-textMuted'}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className={`w-full pl-10 pr-10 py-2.5 text-sm border rounded-2xl bg-bgPrimary text-textMain focus:ring-2 focus:outline-none ${
                      isInvalidCreds 
                        ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500' 
                        : 'border-borderColor focus:ring-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-textMuted hover:text-textMain cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-textMain">
                    CAPTCHA Verification
                  </label>
                  {onRefreshCaptcha && (
                    <button
                      type="button"
                      onClick={onRefreshCaptcha}
                      disabled={isPending || isCaptchaSolving}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 font-semibold"
                      title="Fetch a new CAPTCHA"
                    >
                      <RotateCw className={`h-3 w-3 ${isCaptchaSolving ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  )}
                </div>

                {/* Fetched Captcha Display */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-white rounded-xl border border-borderColor p-1 flex items-center justify-center min-h-[46px] min-w-[130px] shadow-xs">
                    {captchaImageData ? (
                      <img 
                        src={captchaImageData} 
                        alt="Fetched VTOP CAPTCHA" 
                        className="h-9 object-contain rounded select-none filter contrast-125" 
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-textMuted py-1 px-3">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                        <span>Fetching...</span>
                      </div>
                    )}
                  </div>

                  {isCaptchaSolving ? (
                    <span className="text-[11px] font-mono text-blue-500 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Auto-solving...
                    </span>
                  ) : captcha ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                      Auto-detected
                    </span>
                  ) : null}
                </div>

                {/* Captcha Input */}
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-3 h-4 w-4 text-textMuted" />
                  <input
                    type="text"
                    value={captcha}
                    onChange={(e) => setCaptcha(e.target.value.toUpperCase())}
                    placeholder="Enter CAPTCHA"
                    required
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-borderColor rounded-2xl bg-bgPrimary text-textMain focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono uppercase tracking-widest text-center font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || isCaptchaSolving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isPending || isCaptchaSolving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isCaptchaSolving ? 'Solving CAPTCHA in background...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {hasSavedCreds && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Use saved credentials
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
