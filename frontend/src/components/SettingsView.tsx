import React from 'react';
import { ChevronDown, Sun, Moon, Trash2 } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  activeSemester: string;
  setActiveSemester: (sem: string) => void;
  semestersQuery: UseQueryResult<any[], any>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  setTheme,
  activeSemester,
  setActiveSemester,
  semestersQuery
}) => {
  const handleClearCache = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('vtop_cache_'));
    keys.forEach(k => localStorage.removeItem(k));
    alert(`Cleared ${keys.length} cached entries. Refresh the page to reload fresh data.`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-extrabold text-textMain">Settings</h2>
        <p className="text-sm text-textMuted mt-1">Manage your app preferences and configuration.</p>
      </div>

      {/* Semester Selection */}
      <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">Semester</h3>
        <p className="text-xs text-textMuted">Select the active VTOP semester for all data views.</p>
        <div className="relative max-w-sm">
          <select
            value={activeSemester}
            onChange={(e) => setActiveSemester(e.target.value)}
            className="block w-full p-3 pr-10 text-sm font-semibold text-textMain border border-borderColor rounded-xl bg-bgPrimary focus:ring-2 focus:ring-accentColor focus:outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={semestersQuery.isPending || !semestersQuery.data || semestersQuery.data.length === 0}
          >
            {semestersQuery.isPending ? (
              <option>Loading semesters…</option>
            ) : !semestersQuery.data || semestersQuery.data.length === 0 ? (
              <option value="UNAVAILABLE">Unavailable</option>
            ) : (
              semestersQuery.data.map((sem: any) => (
                <option key={sem.id} value={sem.id}>{sem.name}</option>
              ))
            )}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-textMuted">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">Appearance</h3>
        <p className="text-xs text-textMuted">Switch between light and dark theme.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${theme === 'light'
              ? 'bg-accentColor text-white border-accentColor shadow-md'
              : 'bg-bgPrimary text-textMuted border-borderColor hover:bg-bgPrimary/60'
              }`}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${theme === 'dark'
              ? 'bg-accentColor text-white border-accentColor shadow-md'
              : 'bg-bgPrimary text-textMuted border-borderColor hover:bg-bgPrimary/60'
              }`}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
        </div>
      </div>

      {/* Cache Management */}
      <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">Cache</h3>
        <p className="text-xs text-textMuted">
          Cached data allows the app to work offline. Clear the cache to fetch fresh data on next load.
        </p>
        <button
          onClick={handleClearCache}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
        >
          <Trash2 className="h-4 w-4" /> Clear Cached Data
        </button>
      </div>

      {/* About */}
      <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-2">
        <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">About</h3>
        <p className="text-xs text-textMuted leading-relaxed">
          <strong className="text-textMain">VTOP Client CC</strong> — A personal VTOP client for VIT students.
          Built with React, TypeScript, Express, and Tailwind CSS.
        </p>
        <p className="text-[11px] text-textMuted font-mono">v2.0.0</p>
      </div>
    </div>
  );
};
