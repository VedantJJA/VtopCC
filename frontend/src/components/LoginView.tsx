import React, { useState } from 'react';
import { 
  User as UserIcon, Lock, Eye, EyeOff, CheckCircle2, 
  AlertTriangle, AlertCircle, Loader2, Sun, Moon, ShieldAlert,
  RotateCw, ShieldCheck, Activity, ChevronDown, ChevronUp
} from 'lucide-react';
import { VtopLogo } from './VtopLogo';
import { getVtopDebugInfo } from '../lib/api';

export interface CaptchaErrorInfo {
  message: string;
  failedStep?: string;
  code?: string;
  vtopUrl?: string;
  timestamp?: string;
  status?: number;
  suggestion?: string;
  raw?: any;
}

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
  isCaptchaLoading?: boolean;
  captchaError?: CaptchaErrorInfo | null;
  handleAutoLoginSubmit: (e: React.FormEvent) => void;
  handleLoginSubmit: (e: React.FormEvent) => void;
  recaptchaRef: React.RefObject<HTMLDivElement | null>;
  captchaImageData?: string;
  captcha: string;
  setCaptcha: (val: string) => void;
  onRefreshCaptcha?: () => void;
}

const CaptchaDebugPanel: React.FC<{
  error: CaptchaErrorInfo;
  onRetry: () => void;
  isRetrying: boolean;
}> = ({ error, onRetry, isRetrying }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [probeData, setProbeData] = useState<any>(null);

  const handleProbe = async () => {
    setIsProbing(true);
    try {
      const res = await getVtopDebugInfo();
      setProbeData(res);
    } catch (err: any) {
      setProbeData({
        status: 'failed',
        errorMessage: err?.response?.data?.message || err.message || 'Probe request failed',
        errorCode: err?.code || 'CLIENT_NETWORK_ERROR'
      });
    } finally {
      setIsProbing(false);
    }
  };

  const isTimeout = error.code === 'ETIMEDOUT' || error.message?.toLowerCase().includes('timeout') || error.code === 'ECONNABORTED';
  const isConnectionRefused = error.code === 'ECONNREFUSED';
  const isFirewallSuspected = isTimeout || isConnectionRefused || error.failedStep === 'open/page';

  return (
    <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs mb-3 space-y-2.5 animate-in fade-in duration-200 text-left">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-rose-800 dark:text-rose-200 text-xs">
            CAPTCHA Failed to Load
          </p>
          <p className="text-[11px] text-rose-700/90 dark:text-rose-300/80 mt-0.5 break-words">
            {error.message}
          </p>
        </div>
      </div>

      {isFirewallSuspected && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
          <span className="font-bold block mb-0.5">⚠️ Hosted in Cloud / VPS?</span>
          VIT Chennai's firewall routinely drops connections from cloud datacenters (AWS, DigitalOcean, Hetzner, GCP, Oracle Cloud). Outbound requests to VTOP time out. Host locally or route through an Indian residential proxy to resolve.
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
        >
          <RotateCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Retrying...' : 'Retry CAPTCHA'}</span>
        </button>

        <button
          type="button"
          onClick={handleProbe}
          disabled={isProbing}
          className="px-2.5 py-1.5 rounded-lg bg-bgCard border border-borderColor hover:bg-bgPrimary text-textMain font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          title="Send a test ping directly to VTOP to check if firewall is blocking"
        >
          <Activity className={`h-3 w-3 text-blue-500 ${isProbing ? 'animate-spin' : ''}`} />
          <span>{isProbing ? 'Testing...' : 'Test Connection'}</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="ml-auto text-[11px] text-textMuted hover:text-textMain flex items-center gap-1 cursor-pointer font-medium"
        >
          <span>{showDetails ? 'Hide Debug' : 'Debug Info'}</span>
          {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Live Probe Result */}
      {probeData && (
        <div className={`p-2.5 rounded-xl border text-[11px] ${
          probeData.status === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'
        }`}>
          <div className="flex items-center justify-between font-semibold mb-1">
            <span>VTOP Ping Result: {probeData.status === 'success' ? 'Accessible' : 'Failed'}</span>
            <span className="font-mono text-[10px]">{probeData.latencyMs}ms</span>
          </div>
          {probeData.status === 'success' ? (
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
              VTOP server is reachable (HTTP {probeData.httpStatus}). The CAPTCHA issue may be temporary; try clicking "Retry CAPTCHA".
            </p>
          ) : (
            <div className="space-y-1 text-[10px]">
              <p>Error: {probeData.errorMessage || probeData.errorCode || 'Connection failure'}</p>
              {probeData.suggestion && (
                <p className="text-amber-700 dark:text-amber-400 font-medium">{probeData.suggestion}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Expanded Debug Information */}
      {showDetails && (
        <div className="p-2.5 rounded-xl bg-bgPrimary/80 border border-borderColor space-y-1.5 text-[10px] font-mono text-textMuted animate-in fade-in duration-150">
          <div className="flex justify-between">
            <span className="font-semibold text-textMain">Failed Step:</span>
            <span>{error.failedStep || 'Unknown'}</span>
          </div>
          {error.code && (
            <div className="flex justify-between">
              <span className="font-semibold text-textMain">Error Code:</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{error.code}</span>
            </div>
          )}
          {error.status && (
            <div className="flex justify-between">
              <span className="font-semibold text-textMain">HTTP Status:</span>
              <span>{error.status}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="font-semibold text-textMain">Target VTOP:</span>
            <span className="truncate max-w-[200px]" title={error.vtopUrl}>{error.vtopUrl || 'https://vtopcc.vit.ac.in/vtop/'}</span>
          </div>
          {error.timestamp && (
            <div className="flex justify-between">
              <span className="font-semibold text-textMain">Timestamp:</span>
              <span>{new Date(error.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
          {error.raw && (
            <div className="pt-1 mt-1 border-t border-borderColor/60">
              <span className="font-semibold text-textMain block mb-0.5">Raw Payload:</span>
              <pre className="p-1.5 bg-black/10 dark:bg-black/40 rounded overflow-x-auto text-[9px] max-h-24">
                {JSON.stringify(error.raw, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  isCaptchaLoading = false,
  captchaError = null,
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
              {captchaImageData ? (
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
              ) : captchaError ? (
                <CaptchaDebugPanel
                  error={captchaError}
                  onRetry={onRefreshCaptcha || (() => {})}
                  isRetrying={isCaptchaLoading || isCaptchaSolving}
                />
              ) : isCaptchaLoading ? (
                <div className="p-3 bg-bgPrimary/60 border border-borderColor rounded-xl flex items-center gap-2.5 text-xs text-textMuted shadow-xs">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                  <span>Loading CAPTCHA from VTOP...</span>
                </div>
              ) : null}

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
                      disabled={isPending || isCaptchaSolving || isCaptchaLoading}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 font-semibold"
                      title="Fetch a new CAPTCHA"
                    >
                      <RotateCw className={`h-3 w-3 ${isCaptchaSolving || isCaptchaLoading ? 'animate-spin' : ''}`} />
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
                    ) : isCaptchaLoading ? (
                      <div className="flex items-center gap-1.5 text-xs text-textMuted py-1 px-3">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                        <span>Fetching...</span>
                      </div>
                    ) : captchaError ? (
                      <div className="flex items-center gap-1.5 text-xs text-rose-500 py-1 px-3 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Failed to load</span>
                      </div>
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

                {/* Captcha Debug & Diagnostic Panel */}
                {captchaError && (
                  <CaptchaDebugPanel
                    error={captchaError}
                    onRetry={onRefreshCaptcha || (() => {})}
                    isRetrying={isCaptchaLoading || isCaptchaSolving}
                  />
                )}

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
