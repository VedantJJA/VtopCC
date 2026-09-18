import React, { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ExternalLink, Eye, EyeOff, CalendarRange, KeyRound, Copy, Check } from 'lucide-react';

interface CredentialsViewProps {
  credentialsQuery: UseQueryResult<any, any>;
}

export const CredentialsView: React.FC<CredentialsViewProps> = ({ credentialsQuery }) => {
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const togglePassword = (idx: number) => {
    setShowPasswordMap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const accounts = credentialsQuery.data?.accounts || [];
  const exams = credentialsQuery.data?.exams || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-textMain">WiFi & System Logins</h2>
        <p className="text-xs sm:text-sm text-textMuted mt-1">Access credentials for campus WiFi, lab systems, and proctor portals.</p>
      </div>

      {credentialsQuery.isPending ? (
        <div className="h-64 flex items-center justify-center bg-bgCard border border-borderColor rounded-xl">
          <Loader2 className="h-8 w-8 animate-spin text-accentColor" />
        </div>
      ) : credentialsQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch WiFi and Proctor System credentials from VTOP.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Saved System Accounts */}
          {accounts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-accentColor" />
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">
                  Saved System Logins ({accounts.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {accounts.map((acc: any, index: number) => {
                  const userKey = `user-${index}`;
                  const passKey = `pass-${index}`;
                  const isUserCopied = copiedKey === userKey;
                  const isPassCopied = copiedKey === passKey;

                  return (
                    <div
                      key={index}
                      className="bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-y-3 hover:border-accentColor/40 transition-all duration-200"
                    >
                      {/* Service Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-borderColor/40 pb-2.5">
                        <span className="font-bold text-sm text-textMain truncate">
                          {acc.account}
                        </span>
                        {acc.url && acc.url !== '#' && (
                          <a
                            href={acc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-accentColor hover:underline flex items-center gap-1 shrink-0 font-medium"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Username Row */}
                      <div className="flex items-center justify-between gap-2 bg-bgPrimary/40 border border-borderColor/50 rounded-lg p-2.5 text-xs">
                        <div className="overflow-hidden">
                          <span className="block text-[10px] uppercase font-bold text-textMuted tracking-wider">Username</span>
                          <span className="font-mono font-semibold text-textMain truncate block select-all">{acc.username || 'N/A'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(acc.username, userKey)}
                          className="p-1.5 rounded-md hover:bg-borderColor/50 text-textMuted hover:text-textMain transition-colors shrink-0"
                          title="Copy username"
                        >
                          {isUserCopied ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Password Row */}
                      <div className="flex items-center justify-between gap-2 bg-bgPrimary/40 border border-borderColor/50 rounded-lg p-2.5 text-xs">
                        <div className="overflow-hidden flex-1">
                          <span className="block text-[10px] uppercase font-bold text-textMuted tracking-wider">Password</span>
                          <span
                            onClick={() => togglePassword(index)}
                            className={`font-mono font-bold text-textMain cursor-pointer block select-all transition-all ${
                              !showPasswordMap[index] ? 'blur-[4px] select-none' : ''
                            }`}
                          >
                            {acc.password || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => togglePassword(index)}
                            className="p-1.5 rounded-md hover:bg-borderColor/50 text-textMuted hover:text-textMain transition-colors"
                            title={showPasswordMap[index] ? 'Hide password' : 'Show password'}
                          >
                            {showPasswordMap[index] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(acc.password, passKey)}
                            className="p-1.5 rounded-md hover:bg-borderColor/50 text-textMuted hover:text-textMain transition-colors"
                            title="Copy password"
                          >
                            {isPassCopied ? (
                              <Check className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Exam Schedules and Passwords */}
          {exams.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-accentColor" />
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">
                  Upcoming Exam Passwords ({exams.length})
                </h3>
              </div>

              <div className="space-y-3">
                {exams.map((ex: any, index: number) => {
                  const examPassKey = `exampass-${index}`;
                  const isExamPassCopied = copiedKey === examPassKey;

                  return (
                    <div
                      key={index}
                      className="bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-y-3 hover:border-accentColor/40 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-textMain">{ex.account}</h4>
                          <div className="text-xs text-textMuted mt-0.5">{ex.venue_date}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[10px] uppercase font-bold text-textMuted tracking-wider">Seat</span>
                          <span className="text-xs font-black font-mono text-accentColor bg-bgPrimary border border-borderColor px-2 py-0.5 rounded">
                            {ex.seat || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Password Badge + Copy */}
                      <div className="flex items-center justify-between gap-2 bg-bgPrimary/40 border border-borderColor/50 rounded-lg p-2.5 text-xs">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-textMuted tracking-wider">Exam Password</span>
                          <span className="font-mono font-bold text-rose-500 text-sm select-all">{ex.password}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(ex.password, examPassKey)}
                          className="px-3 py-1.5 bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg text-xs font-bold text-textMain flex items-center gap-1.5 transition-colors"
                        >
                          {isExamPassCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {accounts.length === 0 && exams.length === 0 && (
            <div className="bg-bgCard border border-borderColor rounded-xl p-8 text-center space-y-2 shadow-sm">
              <KeyRound className="h-10 w-10 text-textMuted mx-auto opacity-50" />
              <h4 className="font-bold text-textMain text-sm">No Saved Credentials</h4>
              <p className="text-xs text-textMuted">No WiFi or system login credentials found for this account.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
