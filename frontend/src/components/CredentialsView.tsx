import React, { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ExternalLink, Eye, EyeOff, CalendarRange, KeyRound } from 'lucide-react';

interface CredentialsViewProps {
  credentialsQuery: UseQueryResult<any, any>;
}

export const CredentialsView: React.FC<CredentialsViewProps> = ({ credentialsQuery }) => {
  const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});

  const togglePassword = (idx: number) => {
    setShowPasswordMap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const accounts = credentialsQuery.data?.accounts || [];
  const exams = credentialsQuery.data?.exams || [];

  return (
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
        <div className="space-y-8">
          {/* Saved Credentials Table */}
          {accounts.length > 0 && (
            <div className="bg-bgCard border border-borderColor rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-bgPrimary/25 border-b border-borderColor">
                <h4 className="text-sm font-bold text-textMain flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-500" /> Saved System Logins
                </h4>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-textMain">
                  <thead className="text-xs text-textMuted uppercase bg-bgPrimary border-b border-borderColor font-bold">
                    <tr>
                      <th className="px-6 py-3.5">Service / Account</th>
                      <th className="px-6 py-3.5">Username</th>
                      <th className="px-6 py-3.5 w-48">Password</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderColor/60">
                    {accounts.map((acc: any, index: number) => (
                      <tr key={index} className="hover:bg-bgPrimary/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-textMain">
                          {acc.url && acc.url !== '#' ? (
                            <a 
                              href={acc.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[#0f5cf5] hover:underline flex items-center gap-1"
                            >
                              {acc.account} <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                            </a>
                          ) : (
                            acc.account
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs select-all">{acc.username}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center bg-bgPrimary rounded px-2.5 py-1.5 w-fit border border-borderColor">
                            <span 
                              onClick={() => togglePassword(index)}
                              className={`font-mono text-xs text-textMain mr-3 select-all min-w-[90px] cursor-pointer transition-all ${
                                !showPasswordMap[index] ? 'blur-[3px] select-none' : ''
                              }`}
                            >
                              {acc.password}
                            </span>
                            <button 
                              onClick={() => togglePassword(index)} 
                              className="text-textMuted hover:text-textMain transition-colors focus:outline-none cursor-pointer"
                              title="Toggle visibility"
                            >
                              {showPasswordMap[index] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Special Exam Credentials Table */}
          {exams.length > 0 && (
            <div className="bg-bgCard border border-borderColor rounded-xl shadow-sm overflow-hidden border-t-4 border-t-indigo-500">
              <div className="px-6 py-4 bg-indigo-50/40 dark:bg-indigo-950/10 border-b border-borderColor">
                <h4 className="text-sm font-bold text-[#0f5cf5] flex items-center gap-2">
                  <CalendarRange className="w-4 h-4" /> Upcoming Exam Schedule
                </h4>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-textMain">
                  <thead className="text-xs text-textMuted uppercase bg-bgPrimary border-b border-borderColor font-bold">
                    <tr>
                      <th className="px-6 py-3.5">Course / Exam</th>
                      <th className="px-6 py-3.5">Venue & Time</th>
                      <th className="px-6 py-3.5 text-center">Seat</th>
                      <th className="px-6 py-3.5 text-center">Password</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderColor/60">
                    {exams.map((ex: any, index: number) => (
                      <tr key={index} className="hover:bg-bgPrimary/30 transition-colors">
                        <td className="px-6 py-4 font-semibold text-textMain">
                          {ex.account}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded border border-amber-200 dark:border-amber-900/40 w-fit">
                            {ex.venue_date}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-textMain">{ex.seat}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="font-mono text-xs text-red-600 dark:text-red-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/30 px-3 py-1.5 rounded select-all inline-block font-bold">
                            {ex.password}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {accounts.length === 0 && exams.length === 0 && (
            <div className="bg-bgCard border border-borderColor rounded-xl p-8 text-center text-textMuted italic shadow-sm">
              No credentials or exam schedules found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
