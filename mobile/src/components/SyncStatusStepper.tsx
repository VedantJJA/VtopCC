import React from 'react';
import { 
  Loader2, CheckCircle2, AlertCircle, Sparkles, KeyRound, CalendarDays, BookOpen, X
} from 'lucide-react';

export type SyncStep = 
  | 'idle'
  | 'logging_in'
  | 'logged_in'
  | 'got_semesters'
  | 'got_schedule'
  | 'sync_complete'
  | 'sync_error';

interface SyncStatusStepperProps {
  step: SyncStep;
  message?: string;
  onDismiss?: () => void;
  isDesktop?: boolean;
}

export const SyncStatusStepper: React.FC<SyncStatusStepperProps> = ({
  step,
  message,
  onDismiss,
  isDesktop = false
}) => {
  if (step === 'idle') return null;

  // Determine stage progress percentage (similar to attendance progress bar)
  const getProgressPercentage = () => {
    switch (step) {
      case 'logging_in': return 25;
      case 'logged_in': return 50;
      case 'got_semesters': return 75;
      case 'got_schedule': return 92;
      case 'sync_complete': return 100;
      case 'sync_error': return 100;
      default: return 0;
    }
  };

  // Determine stage status
  const getStageStatus = (stage: 1 | 2 | 3) => {
    switch (step) {
      case 'logging_in':
        return stage === 1 ? 'active' : 'pending';
      case 'logged_in':
        return stage === 1 ? 'completed' : stage === 2 ? 'active' : 'pending';
      case 'got_semesters':
        return stage <= 2 ? 'completed' : 'active';
      case 'got_schedule':
      case 'sync_complete':
        return 'completed';
      case 'sync_error':
        return 'error';
      default:
        return 'pending';
    }
  };

  const getStepLabel = () => {
    switch (step) {
      case 'logging_in':
        return 'Logging in...';
      case 'logged_in':
        return 'Logged in';
      case 'got_semesters':
        return 'Got semesters';
      case 'got_schedule':
        return 'Got schedule';
      case 'sync_complete':
        return 'Sync complete';
      case 'sync_error':
        return message || 'Offline — using local cache';
      default:
        return message || '';
    }
  };

  const isError = step === 'sync_error';
  const isComplete = step === 'sync_complete';
  const percent = getProgressPercentage();

  return (
    <div 
      className={`w-full z-25 bg-bgCard/95 backdrop-blur-md border-b border-borderColor shadow-xs px-3.5 py-1.5 select-none animate-in fade-in slide-in-from-top-1 duration-200 ${
        isDesktop ? 'sticky top-0' : ''
      }`}
    >
      {/* Top Text & Step Badges */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {/* Left: Current Active Step */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 flex items-center justify-center">
            {step === 'logging_in' && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accentColor" />
            )}
            {step === 'logged_in' && (
              <KeyRound className="h-3.5 w-3.5 text-emerald-500" />
            )}
            {step === 'got_semesters' && (
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
            )}
            {step === 'got_schedule' && (
              <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
            )}
            {step === 'sync_complete' && (
              <Sparkles className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
            )}
            {step === 'sync_error' && (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>

          <span className="text-xs font-bold text-textMain truncate leading-none">
            {getStepLabel()}
          </span>

          <span className="text-[10px] text-textMuted font-mono hidden sm:inline">
            ({percent}%)
          </span>
        </div>

        {/* Right: Step Pills (Logging in -> Logged in -> Semesters -> Schedule) */}
        <div className="flex items-center gap-1 shrink-0">
          {[
            { id: 1, label: 'Login' },
            { id: 2, label: 'Semesters' },
            { id: 3, label: 'Schedule' }
          ].map((st) => {
            const status = getStageStatus(st.id as 1 | 2 | 3);
            return (
              <div
                key={st.id}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                  status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : status === 'active'
                      ? 'bg-accentColor text-white animate-pulse'
                      : status === 'error'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'bg-bgPrimary text-textMuted opacity-60'
                }`}
              >
                {status === 'completed' && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                <span>{st.label}</span>
              </div>
            );
          })}

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-textMuted hover:text-textMain p-1 ml-1 rounded-md cursor-pointer transition-colors"
              title="Dismiss status bar"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Attendance-style Progress Bar */}
      <div className="w-full bg-bgPrimary rounded-full h-1.5 overflow-hidden border border-borderColor/40">
        <div 
          className={`h-full rounded-full transition-all duration-400 ${
            isError 
              ? 'bg-amber-500' 
              : isComplete 
                ? 'bg-emerald-500' 
                : 'bg-accentColor'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export const SyncStatusBar = SyncStatusStepper;
