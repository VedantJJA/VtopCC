import React, { useState } from 'react';
import { 
  ChevronDown, Sun, Moon, HardDrive, RefreshCw, 
  Smartphone, BarChart2, CalendarDays, Activity, 
  Calendar, Calculator, Award, FileText, BookOpen, Search, Home, Sliders,
  Clock, CircleDot, LayoutGrid, Trash2
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { safeClearCachePrefix, getStorageUsage, safeStorageSet } from '../lib/cache';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  activeSemester: string;
  setActiveSemester: (sem: string) => void;
  semestersQuery: UseQueryResult<any[], any>;
  autoRefresh?: boolean;
  setAutoRefresh?: (val: boolean) => void;
  mobileOptimization?: boolean;
  setMobileOptimization?: (val: boolean) => void;
  showCardAttendance?: boolean;
  setShowCardAttendance?: (val: boolean) => void;
  showBlankSlots?: boolean;
  setShowBlankSlots?: (val: boolean) => void;
  circularAttendance?: boolean;
  setCircularAttendance?: (val: boolean) => void;
  timeFormat?: '12h' | '24h';
  setTimeFormat?: (val: '12h' | '24h') => void;
  showUniversalSearch?: boolean;
  setShowUniversalSearch?: (val: boolean) => void;
  dockTabs?: string[];
  setDockTabs?: (tabs: string[]) => void;
}

type SettingsCategory = 'all' | 'appearance' | 'academics' | 'sync' | 'dock';

const AVAILABLE_DOCK_ITEMS = [
  { id: 'timetable', label: 'Timetable', icon: CalendarDays },
  { id: 'attendance', label: 'Attendance', icon: Activity },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'calculator', label: 'Calc', icon: Calculator },
  { id: 'marks', label: 'Marks', icon: Award },
  { id: 'grades', label: 'Grades', icon: Award },
  { id: 'exams', label: 'Exams', icon: FileText },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'faculty', label: 'Faculty', icon: Search },
  { id: 'my-room', label: 'Room', icon: Home },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  setTheme,
  activeSemester,
  setActiveSemester,
  semestersQuery,
  autoRefresh = false,
  setAutoRefresh,
  mobileOptimization = false,
  setMobileOptimization,
  showCardAttendance = true,
  setShowCardAttendance,
  showBlankSlots = false,
  setShowBlankSlots,
  circularAttendance = false,
  setCircularAttendance,
  timeFormat = '24h',
  setTimeFormat,
  showUniversalSearch = true,
  setShowUniversalSearch,
  dockTabs = ['dashboard', 'timetable', 'attendance', 'calendar', 'more'],
  setDockTabs
}) => {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('all');
  const [storageInfo, setStorageInfo] = useState(() => getStorageUsage());

  const handleClearCache = () => {
    const cleared = safeClearCachePrefix('vtop_cache_');
    setStorageInfo(getStorageUsage());
    alert(`Cleared ${cleared} cached entries. Refresh the page to reload fresh data.`);
  };

  const handleUpdateMiddleDockSlot = (index: number, newId: string) => {
    if (!setDockTabs) return;
    const updated = [...dockTabs];
    updated[index] = newId;
    setDockTabs(updated);
    safeStorageSet('vtop_dock_tabs', JSON.stringify(updated));
  };

  const handleApplyDockPreset = (presetTabs: string[]) => {
    if (!setDockTabs) return;
    setDockTabs(presetTabs);
    safeStorageSet('vtop_dock_tabs', JSON.stringify(presetTabs));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div>
        <h2 className="text-2xl font-extrabold text-textMain">Settings</h2>
        <p className="text-sm text-textMuted mt-1">Manage display preferences, academic tools, sync options, and dock customization.</p>
      </div>

      {/* CATEGORY SWITCHER PILLS (MULTIPLE OPTIONS FOR DIFFERENT TYPES OF SETTINGS) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
            activeCategory === 'all'
              ? 'bg-accentColor text-white border-accentColor shadow-xs'
              : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
          }`}
        >
          All Options
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('appearance')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
            activeCategory === 'appearance'
              ? 'bg-accentColor text-white border-accentColor shadow-xs'
              : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
          }`}
        >
          Display & UI
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('academics')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
            activeCategory === 'academics'
              ? 'bg-accentColor text-white border-accentColor shadow-xs'
              : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
          }`}
        >
          Academics & Timetable
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('sync')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
            activeCategory === 'sync'
              ? 'bg-accentColor text-white border-accentColor shadow-xs'
              : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
          }`}
        >
          Sync & Cache
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('dock')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap border ${
            activeCategory === 'dock'
              ? 'bg-accentColor text-white border-accentColor shadow-xs'
              : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
          }`}
        >
          Mobile Dock
        </button>
      </div>

      {/* SECTION 1: DISPLAY & UI OPTIONS */}
      {(activeCategory === 'all' || activeCategory === 'appearance') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Sliders className="h-4 w-4 text-accentColor" />
            <h3 className="text-xs font-mono font-black text-textMuted uppercase tracking-wider">Display & Interface</h3>
          </div>

          {/* Appearance Theme */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">Theme Mode</h3>
            <p className="text-xs text-textMuted">Switch between high-contrast light and dark appearance.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border ${theme === 'light'
                  ? 'bg-accentColor text-white border-accentColor shadow-md'
                  : 'bg-bgPrimary text-textMuted border-borderColor hover:bg-bgPrimary/60'
                  }`}
              >
                <Sun className="h-4 w-4" /> Light
              </button>
              <button
                type="button"
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

          {/* Universal Search Toggle */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <Search className="h-4 w-4 text-accentColor" /> Universal Search
                </h3>
                <p className="text-xs text-textMuted leading-relaxed">
                  Display the instant universal search trigger in the header and enable the Ctrl+K command palette for fast navigation.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showUniversalSearch}
                onClick={() => {
                  if (setShowUniversalSearch) {
                    const next = !showUniversalSearch;
                    setShowUniversalSearch(next);
                    safeStorageSet('vtop_universal_search', String(next));
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-offset-2 ${
                  showUniversalSearch ? 'bg-accentColor' : 'bg-borderColor'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    showUniversalSearch ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] font-semibold text-textMuted flex items-center gap-2 pt-1 font-mono">
              <span className={`inline-block w-2 h-2 rounded-full ${showUniversalSearch ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span>Status: {showUniversalSearch ? 'Global search active (Header button & Ctrl+K)' : 'Disabled'}</span>
            </div>
          </div>

          {/* Mobile Optimization UI Toggle */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-accentColor" /> Mobile Optimization UI
                </h3>
                <p className="text-xs text-textMuted leading-relaxed">
                  Enable the mobile layout with bottom navigation dock and touch gestures between primary tabs.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={mobileOptimization}
                onClick={() => setMobileOptimization && setMobileOptimization(!mobileOptimization)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-offset-2 ${
                  mobileOptimization ? 'bg-accentColor' : 'bg-borderColor'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    mobileOptimization ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] font-semibold text-textMuted flex items-center gap-2 pt-1 font-mono">
              <span className={`inline-block w-2 h-2 rounded-full ${mobileOptimization ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span>Status: {mobileOptimization ? 'Mobile bottom dock & swipe active' : 'Standard sidebar layout'}</span>
            </div>
          </div>

          {/* Time Format (12h / 24h) */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-accentColor" /> Time Format
              </h3>
              <p className="text-xs text-textMuted leading-relaxed">
                Choose whether class slots, exams, and calendar hours display in 24-hour time or 12-hour AM/PM format.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setTimeFormat && setTimeFormat('24h')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                  timeFormat === '24h'
                    ? 'bg-accentColor text-white border-accentColor shadow-xs'
                    : 'bg-bgPrimary text-textMuted border-borderColor hover:bg-bgPrimary/60'
                }`}
              >
                24-Hour (Default)
              </button>
              <button
                type="button"
                onClick={() => setTimeFormat && setTimeFormat('12h')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                  timeFormat === '12h'
                    ? 'bg-accentColor text-white border-accentColor shadow-xs'
                    : 'bg-bgPrimary text-textMuted border-borderColor hover:bg-bgPrimary/60'
                }`}
              >
                12-Hour (AM/PM)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ACADEMICS & TIMETABLE OPTIONS */}
      {(activeCategory === 'all' || activeCategory === 'academics') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-accentColor" />
            <h3 className="text-xs font-mono font-black text-textMuted uppercase tracking-wider">Academics & Timetable</h3>
          </div>

          {/* Timetable Blank / Free Slots Toggle */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-accentColor" /> Timetable Free Slots
                </h3>
                <p className="text-xs text-textMuted leading-relaxed">
                  Display unoccupied periods as cards with a dotted border alongside scheduled classes in the timetable.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showBlankSlots}
                onClick={() => setShowBlankSlots && setShowBlankSlots(!showBlankSlots)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-offset-2 ${
                  showBlankSlots ? 'bg-accentColor' : 'bg-borderColor'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    showBlankSlots ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] font-semibold text-textMuted flex items-center gap-2 pt-1 font-mono">
              <span className={`inline-block w-2 h-2 rounded-full ${showBlankSlots ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span>Status: {showBlankSlots ? 'Showing free slots with dotted border' : 'Hidden (Only scheduled classes)'}</span>
            </div>
          </div>

          {/* Circular Attendance Indicator Toggle */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <CircleDot className="h-4 w-4 text-accentColor" /> Circular Attendance Indicator
                </h3>
                <p className="text-xs text-textMuted leading-relaxed">
                  Render attendance progress as prominent circular gauge rings on the right of course cards instead of linear bars.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={circularAttendance}
                onClick={() => setCircularAttendance && setCircularAttendance(!circularAttendance)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-offset-2 ${
                  circularAttendance ? 'bg-accentColor' : 'bg-borderColor'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    circularAttendance ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] font-semibold text-textMuted flex items-center gap-2 pt-1 font-mono">
              <span className={`inline-block w-2 h-2 rounded-full ${circularAttendance ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span>Status: {circularAttendance ? 'Prominent circular gauge rings active' : 'Linear bars (Default)'}</span>
            </div>
          </div>

          {/* Subject Card Attendance Info Toggle */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-accentColor" /> Subject Card Attendance Info
                </h3>
                <p className="text-xs text-textMuted leading-relaxed">
                  Display attendance percentage, margin (+1 / -1), and progress indicators on today's scheduled classes.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showCardAttendance}
                onClick={() => setShowCardAttendance && setShowCardAttendance(!showCardAttendance)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-offset-2 ${
                  showCardAttendance ? 'bg-accentColor' : 'bg-borderColor'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    showCardAttendance ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] font-semibold text-textMuted flex items-center gap-2 pt-1 font-mono">
              <span className={`inline-block w-2 h-2 rounded-full ${showCardAttendance ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span>Status: {showCardAttendance ? 'Attendance metrics shown on cards' : 'Hidden from class cards'}</span>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: SYNC & SESSION OPTIONS */}
      {(activeCategory === 'all' || activeCategory === 'sync') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <RefreshCw className="h-4 w-4 text-accentColor" />
            <h3 className="text-xs font-mono font-black text-textMuted uppercase tracking-wider">Sync & Session</h3>
          </div>

          {/* Semester Selection */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">Active Semester</h3>
            <p className="text-xs text-textMuted">Select the active VTOP semester for all data views. Changing semester automatically refetches records.</p>
            <div className="relative max-w-sm">
              <select
                value={activeSemester}
                onChange={(e) => setActiveSemester(e.target.value)}
                className="block w-full p-3 pr-10 text-sm font-semibold text-textMain border border-borderColor rounded-xl bg-bgPrimary focus:ring-2 focus:ring-accentColor focus:outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={semestersQuery.isPending || !semestersQuery.data || semestersQuery.data.length === 0}
              >
                {semestersQuery.isPending ? (
                  <option>Loading semesters...</option>
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

          {/* Auto Refresh Toggle */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-accentColor" /> Auto Refresh
                </h3>
                <p className="text-xs text-textMuted leading-relaxed">
                  When disabled (default), data won't refetch automatically in the background, only when you click the manual Refresh button beside the theme switch.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoRefresh}
                onClick={() => setAutoRefresh && setAutoRefresh(!autoRefresh)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accentColor focus:ring-offset-2 ${
                  autoRefresh ? 'bg-accentColor' : 'bg-borderColor'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    autoRefresh ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="text-[11px] font-semibold text-textMuted flex items-center gap-2 pt-1 font-mono">
              <span className={`inline-block w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span>Status: {autoRefresh ? 'Automatic background refresh enabled' : 'Manual refresh button only (Default)'}</span>
            </div>
          </div>

          {/* Cache Management */}
          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">Cache & Offline Storage</h3>
            <p className="text-xs text-textMuted">
              Cached data allows the app to work offline. Clear the cache to purge stored data and fetch fresh records.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-textMuted bg-bgPrimary px-3.5 py-2 rounded-xl border border-borderColor w-fit">
              <HardDrive className="h-4 w-4 text-blue-500" />
              <span>Storage Usage: <strong className="text-textMain">{storageInfo.usedFormatted}</strong> ({storageInfo.entryCount} entries)</span>
            </div>
            <button
              onClick={handleClearCache}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Clear Cached Data
            </button>
          </div>
        </div>
      )}

      {/* SECTION 4: MOBILE DOCK CUSTOMIZATION */}
      {(activeCategory === 'all' || activeCategory === 'dock') && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Sliders className="h-4 w-4 text-accentColor" />
            <h3 className="text-xs font-mono font-black text-textMuted uppercase tracking-wider">Mobile Dock Customization</h3>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-textMain uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4 text-accentColor" /> Pinned Dock Tabs
              </h3>
              <p className="text-xs text-textMuted leading-relaxed">
                Customize which navigation tabs are pinned to your mobile bottom dock. Slot 1 is always Home and Slot 5 is More.
              </p>
            </div>

            {/* Live Dock Preview */}
            <div className="p-3 bg-bgPrimary rounded-xl border border-borderColor/60 space-y-1.5">
              <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider font-mono">Live Dock Preview</span>
              <div className="flex items-center justify-around py-1.5 px-2 bg-bgCard rounded-lg border border-borderColor">
                {dockTabs.map((tabId, idx) => {
                  const item = AVAILABLE_DOCK_ITEMS.find(it => it.id === tabId);
                  const label = tabId === 'dashboard' ? 'Home' : tabId === 'more' ? 'More' : (item?.label || tabId);
                  return (
                    <div key={idx} className="flex flex-col items-center justify-center text-accentColor px-1">
                      <span className="text-[10px] font-bold tracking-tight">{label}</span>
                      <span className="text-[8px] text-textMuted font-mono">Slot {idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-textMain">Quick Presets</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyDockPreset(['dashboard', 'timetable', 'attendance', 'calendar', 'more'])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-bgPrimary hover:bg-bgPrimary/70 border border-borderColor text-textMain transition-colors cursor-pointer"
                >
                  Academic (Default)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDockPreset(['dashboard', 'timetable', 'attendance', 'marks', 'more'])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-bgPrimary hover:bg-bgPrimary/70 border border-borderColor text-textMain transition-colors cursor-pointer"
                >
                  Exam Focus
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyDockPreset(['dashboard', 'calendar', 'attendance', 'calculator', 'more'])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-bgPrimary hover:bg-bgPrimary/70 border border-borderColor text-textMain transition-colors cursor-pointer"
                >
                  Attendance & Tools
                </button>
              </div>
            </div>

            {/* Slot Selectors for Middle Slots (Slot 2, 3, 4) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {[1, 2, 3].map((slotIndex) => {
                const currentVal = dockTabs[slotIndex] || 'timetable';
                return (
                  <div key={slotIndex} className="space-y-1.5">
                    <label className="text-[11px] font-bold text-textMuted uppercase tracking-wider font-mono">
                      Slot {slotIndex + 1}
                    </label>
                    <div className="relative">
                      <select
                        value={currentVal}
                        onChange={(e) => handleUpdateMiddleDockSlot(slotIndex, e.target.value)}
                        className="block w-full p-2.5 pr-8 text-xs font-semibold text-textMain border border-borderColor rounded-xl bg-bgPrimary focus:ring-2 focus:ring-accentColor focus:outline-none transition-colors appearance-none cursor-pointer"
                      >
                        {AVAILABLE_DOCK_ITEMS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-textMuted">
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* About Section */}
      <div className="bg-bgCard border border-borderColor rounded-2xl p-5 space-y-2">
        <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">About</h3>
        <p className="text-xs text-textMuted leading-relaxed">
          <strong className="text-textMain">VTOP Client CC</strong> - Fast, modern, responsive client for VIT students.
        </p>
        <p className="text-[11px] text-textMuted font-mono">v2.1.0</p>
      </div>
    </div>
  );
};
