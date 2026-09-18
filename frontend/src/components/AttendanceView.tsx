import React, { useState, useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { 
  Clock, AlertTriangle, ChevronRight, X, Search, CheckCircle2, 
  BookOpen, ShieldAlert 
} from 'lucide-react';
import { AttendanceSkeleton } from './Skeleton';

interface AttendanceViewProps {
  attendanceQuery: UseQueryResult<any[], any>;
  selectedAttendanceCourse: any | null;
  setSelectedAttendanceCourse: (course: any | null) => void;
  attendanceDetailQuery: UseQueryResult<any[], any>;
  circularAttendance?: boolean;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceQuery,
  selectedAttendanceCourse,
  setSelectedAttendanceCourse,
  attendanceDetailQuery,
  circularAttendance = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'warning' | 'theory' | 'lab'>('all');

  const courses = attendanceQuery.data || [];

  // Calculate Overall Aggregate Attendance Metrics
  const summary = useMemo(() => {
    let totalAttended = 0;
    let totalConducted = 0;
    let warningCount = 0;

    for (const c of courses) {
      const att = parseInt(c.attended_classes, 10) || 0;
      const tot = parseInt(c.total_classes, 10) || 0;
      const pct = parseFloat(c.percentage) || 0;
      totalAttended += att;
      totalConducted += tot;
      if (pct < 75) {
        warningCount++;
      }
    }

    const overallPct = totalConducted > 0 
      ? Math.floor((totalAttended / totalConducted) * 100) 
      : 0;

    return {
      totalAttended,
      totalConducted,
      overallPct,
      warningCount,
      totalCourses: courses.length
    };
  }, [courses]);

  // Filtered Courses
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = course.course_title?.toLowerCase().includes(q);
        const matchesCode = course.course_code?.toLowerCase().includes(q);
        const matchesFaculty = course.faculty?.toLowerCase().includes(q);
        const matchesSlot = course.slot?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesFaculty && !matchesSlot) {
          return false;
        }
      }

      // 2. Tab filter
      const pct = parseFloat(course.percentage) || 0;
      const type = (course.course_type || '').toUpperCase();

      if (filterType === 'warning') {
        return pct < 75;
      }
      if (filterType === 'theory') {
        return type.includes('TH') || type.includes('ETH') || type.includes('THEORY');
      }
      if (filterType === 'lab') {
        return type.includes('LO') || type.includes('ELA') || type.includes('LAB');
      }

      return true;
    });
  }, [courses, searchQuery, filterType]);

  if (attendanceQuery.isPending && !attendanceQuery.data) {
    return <AttendanceSkeleton />;
  }

  if (!attendanceQuery.data || attendanceQuery.data.length === 0) {
    return (
      <div className="p-8 bg-bgCard border border-borderColor rounded-2xl text-center space-y-2 shadow-sm">
        <Clock className="h-12 w-12 text-textMuted mx-auto" />
        <h4 className="font-bold text-textMain">Attendance Not Available</h4>
        <p className="text-xs text-textMuted">No attendance record found for this semester.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. HERO ATTENDANCE KPI CARD */}
      <div className="bg-bgCard border border-borderColor rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
              Overall Attendance
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-textMain tracking-tight">
                {summary.overallPct}%
              </span>
              <span className="text-xs font-semibold text-textMuted">
                ({summary.totalAttended} / {summary.totalConducted} hrs)
              </span>
            </div>
          </div>

          <div className="text-right">
            {summary.warningCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{summary.warningCount} &lt; 75%</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>All Safe (&gt;=75%)</span>
              </span>
            )}
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-bgPrimary rounded-full h-2.5 overflow-hidden border border-borderColor/50">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              summary.overallPct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(Math.max(summary.overallPct, 0), 100)}%` }}
          />
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="space-y-2.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-textMuted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code, title, slot..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-borderColor bg-bgCard text-textMain placeholder:text-textMuted/60 text-xs font-semibold outline-none focus:border-accentColor transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-textMuted hover:text-textMain p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              filterType === 'all'
                ? 'bg-accentColor text-white border-accentColor shadow-xs'
                : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
            }`}
          >
            All ({courses.length})
          </button>
          {summary.warningCount > 0 && (
            <button
              onClick={() => setFilterType('warning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                filterType === 'warning'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                  : 'bg-bgCard text-rose-500 border-rose-500/30 hover:bg-rose-500/10'
              }`}
            >
              Needs Attention ({summary.warningCount})
            </button>
          )}
          <button
            onClick={() => setFilterType('theory')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              filterType === 'theory'
                ? 'bg-accentColor text-white border-accentColor shadow-xs'
                : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
            }`}
          >
            Theory
          </button>
          <button
            onClick={() => setFilterType('lab')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              filterType === 'lab'
                ? 'bg-accentColor text-white border-accentColor shadow-xs'
                : 'bg-bgCard text-textMuted border-borderColor hover:text-textMain'
            }`}
          >
            Lab
          </button>
        </div>
      </div>

      {/* 3. COURSE ATTENDANCE CARDS */}
      {filteredCourses.length === 0 ? (
        <div className="p-8 bg-bgCard border border-dashed border-borderColor rounded-2xl text-center space-y-2">
          <BookOpen className="h-10 w-10 text-textMuted mx-auto opacity-50" />
          <h4 className="font-bold text-textMain text-sm">No Matching Courses</h4>
          <p className="text-xs text-textMuted">Try refining your search or active filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCourses.map((course: any, idx: number) => {
            const percent = parseFloat(course.percentage) || 0;
            const isSafe = percent >= 75;
            const attended = parseInt(course.attended_classes, 10) || 0;
            const total = parseInt(course.total_classes, 10) || 0;
            const courseType = (course.course_type || '').toUpperCase();
            const isLab = courseType.includes('LO') || courseType.includes('ELA') || courseType.includes('LAB');

            let marginText = '0';
            if (total > 0) {
              const rawMargin = Math.floor((4 * attended - 3 * total) / 3);
              if (rawMargin > 0) {
                const val = isLab ? Math.floor(rawMargin / 2) : rawMargin;
                marginText = `+${val}`;
              } else if (rawMargin < 0) {
                const rawNeed = Math.ceil(3 * total - 4 * attended);
                const val = isLab ? Math.floor(rawNeed / 2) : Math.max(1, rawNeed);
                marginText = `-${val}`;
              }
            }

            return (
              <div
                key={idx}
                onClick={() => setSelectedAttendanceCourse(course)}
                className="bg-bgCard border border-borderColor rounded-2xl p-4 shadow-xs hover:border-accentColor/40 transition-all cursor-pointer active:scale-[0.99] space-y-3"
              >
                {/* Header Row: Badges & Attendance % */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-accentColor/10 text-accentColor border border-accentColor/20 font-bold px-2 py-0.5 rounded-lg uppercase">
                        {course.course_code}
                      </span>
                      <span className="text-[10px] bg-bgPrimary text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded-lg">
                        {course.slot}
                      </span>
                      <span className="text-[10px] bg-bgPrimary text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded-lg">
                        {course.course_type}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-textMain leading-snug pt-0.5 line-clamp-2">
                      {course.course_title}
                    </h4>
                  </div>

                  {/* Percentage & Margin Pill */}
                  {circularAttendance ? (
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="relative flex items-center justify-center w-11 h-11">
                        {(() => {
                          const radius = 17;
                          const circ = 2 * Math.PI * radius;
                          const offset = circ - (Math.min(Math.max(percent, 0), 100) / 100) * circ;
                          return (
                            <>
                              <svg className="w-11 h-11 transform -rotate-90">
                                <circle
                                  cx="22"
                                  cy="22"
                                  r={radius}
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="transparent"
                                  className="text-borderColor/40"
                                />
                                <circle
                                  cx="22"
                                  cy="22"
                                  r={radius}
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  fill="transparent"
                                  strokeDasharray={circ}
                                  strokeDashoffset={offset}
                                  strokeLinecap="round"
                                  className={`transition-all duration-700 ease-out ${
                                    isSafe ? 'text-emerald-500' : 'text-rose-500'
                                  }`}
                                />
                              </svg>
                              <span className="absolute text-[10px] font-black font-mono text-textMain">
                                {Math.round(percent)}%
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex flex-col items-end">
                        <span 
                          title={marginText}
                          className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-lg border border-borderColor bg-bgPrimary text-textMuted"
                        >
                          {marginText}
                        </span>
                        <span className="text-[10px] text-textMuted font-mono font-medium mt-0.5">
                          {course.attended_classes}/{course.total_classes}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-black text-textMain font-mono">
                          {course.percentage}%
                        </span>
                        <span 
                          title={marginText}
                          className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-lg border border-borderColor bg-bgPrimary text-textMuted"
                        >
                          {marginText}
                        </span>
                      </div>
                      <span className="text-[10px] text-textMuted font-mono font-medium mt-0.5">
                        {course.attended_classes} / {course.total_classes} hrs
                      </span>
                    </div>
                  )}
                </div>

                {/* Horizontal Progress Bar */}
                {!circularAttendance && (
                  <div className="w-full bg-bgPrimary rounded-full h-1.5 overflow-hidden border border-borderColor/30">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
                    />
                  </div>
                )}

                {/* Footer: Faculty & History Hint */}
                <div className="flex items-center justify-between text-xs text-textMuted pt-0.5">
                  <span className="truncate max-w-[220px] text-[11px]">
                    {course.faculty || 'Faculty TBA'}
                  </span>
                  <span className="text-[11px] font-bold text-accentColor flex items-center gap-0.5 shrink-0">
                    <span>History</span>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MOBILE LECTURE HISTORY BOTTOM SHEET */}
      {selectedAttendanceCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-bgCard border-t sm:border border-borderColor rounded-t-3xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-250 pb-safe"
          >
            {/* Grab Handle for Mobile */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1 bg-borderColor rounded-full" />
            </div>

            {/* Sheet Header */}
            <div className="p-4 sm:p-5 border-b border-borderColor flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-accentColor/10 text-accentColor border border-accentColor/20 font-bold px-2 py-0.5 rounded-lg uppercase">
                    {selectedAttendanceCourse.course_code}
                  </span>
                  <span className="text-[10px] bg-bgPrimary text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded-lg">
                    {selectedAttendanceCourse.slot}
                  </span>
                </div>
                <h3 className="text-base font-bold text-textMain leading-snug">
                  {selectedAttendanceCourse.course_title}
                </h3>
                <p className="text-xs text-textMuted truncate">
                  {selectedAttendanceCourse.faculty}
                </p>
              </div>

              <button
                onClick={() => setSelectedAttendanceCourse(null)}
                className="p-2 text-textMuted hover:text-textMain border border-borderColor hover:bg-bgPrimary rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Lecture History Log List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
              <div className="flex justify-between items-center text-xs font-bold text-textMain">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-accentColor" />
                  <span>Hourly Lecture Log</span>
                </span>
                <span className="text-textMuted font-mono text-[11px]">
                  {selectedAttendanceCourse.attended_classes} Attended / {selectedAttendanceCourse.total_classes} Total
                </span>
              </div>

              {attendanceDetailQuery.isPending ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <Clock className="h-6 w-6 text-accentColor animate-spin" />
                  <span className="text-xs text-textMuted">Loading lecture log...</span>
                </div>
              ) : attendanceDetailQuery.isError ? (
                <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl flex gap-2 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Failed to retrieve lecture history log.</span>
                </div>
              ) : !attendanceDetailQuery.data || attendanceDetailQuery.data.length === 0 ? (
                <div className="p-6 text-center text-textMuted text-xs">
                  No lecture entries found for this course.
                </div>
              ) : (
                <div className="space-y-2">
                  {attendanceDetailQuery.data.map((log: any, logIdx: number) => {
                    const statusLower = (log.status || '').toLowerCase();
                    const isPresent = statusLower === 'present';
                    const isOd = statusLower === 'on duty' || statusLower.includes('duty');

                    let statusClass = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
                    if (isPresent) {
                      statusClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                    } else if (isOd) {
                      statusClass = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
                    }

                    return (
                      <div
                        key={logIdx}
                        className="p-3 bg-bgPrimary/50 border border-borderColor rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[11px] text-textMuted w-5">
                            #{log.sl_no}
                          </span>
                          <div>
                            <div className="font-bold text-textMain">{log.date}</div>
                            <div className="text-[10px] text-textMuted font-mono mt-0.5">
                              {log.slot} | {log.timing}
                            </div>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${statusClass}`}>
                          {log.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Close Action */}
            <div className="p-4 border-t border-borderColor bg-bgCard">
              <button
                onClick={() => setSelectedAttendanceCourse(null)}
                className="w-full py-2.5 bg-accentColor hover:bg-accentColor/90 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
