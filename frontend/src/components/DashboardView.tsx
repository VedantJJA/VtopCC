import React, { useState, useRef } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Activity, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardSkeleton, SkeletonBox } from './Skeleton';
import { formatTime } from '../lib/utils';

interface DashboardViewProps {
  attendanceQuery: UseQueryResult<any[], any>;
  timetableQuery: UseQueryResult<any, any>;
  odSnapshotQuery: UseQueryResult<any, any>;
  TIMETABLE_SLOTS: any[];
  setActiveTab?: (tab: any) => void;
  showCardAttendance?: boolean;
  circularAttendance?: boolean;
  timeFormat?: '12h' | '24h';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  attendanceQuery,
  timetableQuery,
  odSnapshotQuery,
  TIMETABLE_SLOTS: _TIMETABLE_SLOTS,
  setActiveTab,
  showCardAttendance = true,
  circularAttendance = false,
  timeFormat = '24h'
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);
  
  // Carousel Touch & Animation States
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchTranslateX, setTouchTranslateX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [targetOffsetPercent, setTargetOffsetPercent] = useState<number>(0);
  const [_isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isSnapReset, setIsSnapReset] = useState<boolean>(false);

  const isBusyRef = useRef(false);

  const triggerShift = (dir: 'left' | 'right') => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    
    setIsAnimating(true);
    setTouchTranslateX(0);
    setTargetOffsetPercent(dir === 'left' ? -33.333333 : 33.333333);

    setTimeout(() => {
      // 1. Instantly disable transition for seamless panel swap
      setIsSnapReset(true);
      setIsAnimating(false);
      setTargetOffsetPercent(0);
      
      // 2. Shift day offset state
      setSelectedDayOffset(prev => (dir === 'left' ? prev + 1 : prev - 1));

      // 3. Re-enable transitions after browser paints the swap
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsSnapReset(false);
          isBusyRef.current = false;
        });
      });
    }, 250);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isBusyRef.current) return;
    setTouchStartX(e.targetTouches[0].clientX);
    setIsDragging(true);
    setIsAnimating(false);
    setIsSnapReset(false);
    setTouchTranslateX(0);
    setTargetOffsetPercent(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || isBusyRef.current) return;
    const currentX = e.targetTouches[0].clientX;
    const deltaX = currentX - touchStartX;
    setTouchTranslateX(deltaX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || isBusyRef.current) return;
    
    const dragDistance = touchTranslateX;
    setTouchStartX(null);
    setIsDragging(false);

    if (dragDistance < -40) {
      triggerShift('left');
    } else if (dragDistance > 40) {
      triggerShift('right');
    } else {
      setIsAnimating(true);
      setTouchTranslateX(0);
      setTargetOffsetPercent(0);
      setTimeout(() => {
        setIsAnimating(false);
      }, 200);
    }
  };

  const getAttendanceSummary = () => {
    if (!attendanceQuery.data || !Array.isArray(attendanceQuery.data)) {
      return { percentage: 0, loading: attendanceQuery.isPending };
    }
    let totalAttended = 0;
    let totalConducted = 0;
    for (const course of attendanceQuery.data) {
      const attended = parseInt(course.attended_classes, 10);
      const total = parseInt(course.total_classes, 10);
      if (!isNaN(attended) && !isNaN(total)) {
        totalAttended += attended;
        totalConducted += total;
      }
    }
    const percentage = totalConducted > 0 ? Math.floor((totalAttended / totalConducted) * 100) : 0;
    return { percentage, loading: false };
  };

  const getClassesForOffset = (offset: number) => {
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const dayName = daysOfWeek[d.getDay()];
    const dateString = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    
    let displayTitle = dateString;
    if (offset === 0) displayTitle = `Today (${dateString})`;
    else if (offset === 1) displayTitle = `Tomorrow (${dateString})`;
    else if (offset === -1) displayTitle = `Yesterday (${dateString})`;

    if (!timetableQuery.data || !timetableQuery.data.timetable) {
      return { dayName, displayTitle, list: [], loading: timetableQuery.isPending };
    }
    
    const schedule = timetableQuery.data.timetable[dayName] || {};
    const time_slot_keys = [
      "08:00 - 08:50", "08:55 - 09:45", "09:50 - 10:40", "10:45 - 11:35",
      "11:40 - 12:30", "12:35 - 13:25", "LUNCH", "14:00 - 14:50",
      "14:55 - 15:45", "15:50 - 16:40", "16:45 - 17:35", "17:40 - 18:30",
      "18:35 - 19:25"
    ];

    const list = [];
    for (let i = 0; i < time_slot_keys.length; i++) {
      const slotKey = time_slot_keys[i];
      if (schedule[slotKey] && schedule[slotKey].rowspan) {
        const course = schedule[slotKey];
        const endTime = (time_slot_keys[i + course.rowspan - 1] || "N/A").split(' - ')[1];
        list.push({
          startTime: slotKey.split(' - ')[0],
          endTime,
          title: course.title,
          code: course.code,
          type: course.type,
          venue: course.venue
        });
      }
    }
    return { dayName, displayTitle, list, loading: false };
  };

  const prevDayInfo = getClassesForOffset(selectedDayOffset - 1);
  const currDayInfo = getClassesForOffset(selectedDayOffset);
  const nextDayInfo = getClassesForOffset(selectedDayOffset + 1);

  const attSum = getAttendanceSummary();
  const odCount = odSnapshotQuery.data?.total_od_count ?? 0;
  const isOdLoading = odSnapshotQuery.isPending;

  const transformStyle = targetOffsetPercent !== 0
    ? `translate3d(${targetOffsetPercent}%, 0, 0)`
    : `translate3d(${touchTranslateX}px, 0, 0)`;

  const transitionStyle = isSnapReset || isDragging
    ? 'none'
    : 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';

  const isInitialLoading = (attendanceQuery.isPending && !attendanceQuery.data) &&
    (timetableQuery.isPending && !timetableQuery.data);

  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bgCard border border-borderColor rounded-xl p-6 shadow-sm flex flex-col h-fit">
          <div>
            <h3 className="font-bold text-textMain text-base mb-6 flex items-center gap-2 border-b border-borderColor pb-3">
              <Activity className="h-5 w-5 text-indigo-500" /> Snapshot
            </h3>
            
            {attSum.loading ? (
              <div className="space-y-4 py-2">
                <SkeletonBox className="h-4 w-28" />
                <SkeletonBox className="h-2 w-full rounded-full" />
              </div>
            ) : (
              <div className="space-y-7">
                <div 
                  onClick={() => setActiveTab && setActiveTab('attendance')}
                  className="cursor-pointer group p-2 -m-2 rounded-lg hover:bg-bgPrimary/50 transition-all"
                  title="Click to view detailed attendance"
                >
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-textMuted group-hover:text-textMain transition-colors">Attendance</span>
                    <span className="text-textMain font-bold group-hover:text-accentColor transition-colors font-mono">{attSum.percentage}%</span>
                  </div>
                  <div className="w-full bg-bgPrimary rounded-full h-2 overflow-hidden border border-borderColor/40">
                    <div 
                      className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                      style={{ width: `${attSum.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-textMuted">On Duty</span>
                    <span className="text-textMain font-bold">
                      {isOdLoading ? '...' : odCount} / 40
                    </span>
                  </div>
                  <div className="w-full bg-bgPrimary rounded-full h-2 overflow-hidden border border-borderColor/40">
                    <div 
                      className="h-full rounded-full transition-all duration-500 bg-purple-500"
                      style={{ width: `${Math.min((odCount / 40) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div 
          data-no-swipe="true"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="bg-bgCard border border-borderColor rounded-xl p-6 shadow-sm md:col-span-2 flex flex-col h-fit select-none overflow-hidden touch-pan-y"
        >
          <div>
            <div className="flex justify-between items-center mb-6 border-b border-borderColor pb-3">
              <div className="flex items-center space-x-3">
                <h3 className="font-bold text-textMain text-base flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-indigo-500" /> Schedule
                </h3>
                
                <div className="flex items-center bg-bgPrimary border border-borderColor rounded-lg overflow-hidden shrink-0">
                  <button
                    onClick={() => triggerShift('right')}
                    className="p-1 hover:bg-borderColor text-textMuted hover:text-textMain transition-colors cursor-pointer"
                    title="Previous Day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (selectedDayOffset < 0) triggerShift('left');
                      else if (selectedDayOffset > 0) triggerShift('right');
                    }}
                    className="px-2 py-0.5 text-[10px] font-bold border-x border-borderColor hover:bg-borderColor text-textMuted hover:text-textMain transition-colors cursor-pointer"
                    title="Jump to Today"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => triggerShift('left')}
                    className="p-1 hover:bg-borderColor text-textMuted hover:text-textMain transition-colors cursor-pointer"
                    title="Next Day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <span className="px-2.5 py-1 text-xs font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-900/30 tracking-wide">
                {currDayInfo.displayTitle}
              </span>
            </div>

            <div className="w-full overflow-hidden">
              <div 
                style={{
                  transform: transformStyle,
                  transition: transitionStyle
                }}
                className="flex flex-row w-[300%] -ml-[100%]"
              >
                <div className="w-[33.333333%] shrink-0 px-2">
                  <SchedulePanel dayInfo={prevDayInfo} attendanceList={attendanceQuery.data || []} showCardAttendance={showCardAttendance} circularAttendance={circularAttendance} timeFormat={timeFormat} />
                </div>
                <div className="w-[33.333333%] shrink-0 px-2">
                  <SchedulePanel dayInfo={currDayInfo} attendanceList={attendanceQuery.data || []} showCardAttendance={showCardAttendance} circularAttendance={circularAttendance} timeFormat={timeFormat} />
                </div>
                <div className="w-[33.333333%] shrink-0 px-2">
                  <SchedulePanel dayInfo={nextDayInfo} attendanceList={attendanceQuery.data || []} showCardAttendance={showCardAttendance} circularAttendance={circularAttendance} timeFormat={timeFormat} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function findAttendanceForClass(cls: { code: string; type?: string }, attendanceList: any[]): any | null {
  if (!attendanceList || !Array.isArray(attendanceList) || !cls.code) return null;
  const matches = attendanceList.filter(
    (a) => a.course_code?.trim().toUpperCase() === cls.code.trim().toUpperCase()
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const clsType = (cls.type || '').toLowerCase();
  const isLab = clsType.includes('lab') || clsType.endsWith('la') || clsType === 'ela' || clsType === 'lo';
  const isTheory = clsType.includes('theory') || clsType.endsWith('th') || clsType === 'eth' || clsType === 'th';

  const exact = matches.find((a) => {
    const aType = (a.course_type || '').toLowerCase();
    if (isLab && (aType.includes('lab') || aType.endsWith('la') || aType === 'ela' || aType === 'lo')) return true;
    if (isTheory && (aType.includes('theory') || aType.endsWith('th') || aType === 'eth' || aType === 'th')) return true;
    return false;
  });

  return exact || matches[0];
}

function calculateAttendanceMetrics(att: any | null, isLabCourse: boolean = false) {
  if (!att) return null;
  const attended = parseInt(att.attended_classes, 10);
  const total = parseInt(att.total_classes, 10);
  const percentage = parseFloat(att.percentage) || 0;

  if (isNaN(attended) || isNaN(total) || total <= 0) {
    return {
      percentage,
      attended: 0,
      total: 0,
      canMiss: 0,
      needAttend: 0,
      status: 'safe' as const
    };
  }

  const courseType = ((att.course_type || '') + ' ' + (att.type || '')).toLowerCase();
  const isLab = isLabCourse || courseType.includes('lab') || courseType.endsWith('la') || courseType === 'ela' || courseType === 'lo';

  // Margin calculation based on standard 75% cutoff:
  const rawMargin = Math.floor((4 * attended - 3 * total) / 3);

  if (rawMargin > 0) {
    const canMiss = isLab ? Math.floor(rawMargin / 2) : rawMargin;
    return {
      percentage,
      attended,
      total,
      canMiss,
      needAttend: 0,
      status: 'safe' as const
    };
  } else if (rawMargin === 0) {
    return {
      percentage,
      attended,
      total,
      canMiss: 0,
      needAttend: 0,
      status: 'warning' as const
    };
  } else {
    // Under 75%: classes needed consecutively to reach 75%
    const rawNeed = Math.ceil(3 * total - 4 * attended);
    const needAttend = isLab ? Math.floor(rawNeed / 2) : Math.max(1, rawNeed);
    return {
      percentage,
      attended,
      total,
      canMiss: 0,
      needAttend,
      status: 'danger' as const
    };
  }
}

const SchedulePanel: React.FC<{ 
  dayInfo: { displayTitle: string; list: any[]; loading: boolean };
  attendanceList?: any[];
  showCardAttendance?: boolean;
  circularAttendance?: boolean;
  timeFormat?: '12h' | '24h';
}> = ({ dayInfo, attendanceList = [], showCardAttendance = true, timeFormat = '24h' }) => {
  if (dayInfo.loading) {
    return (
        <div className="space-y-3 py-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3.5 rounded-xl border border-borderColor/40 bg-bgPrimary/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 space-y-1">
                  <SkeletonBox className="h-4 w-12" />
                  <SkeletonBox className="h-3 w-8" />
                </div>
                <div className="space-y-1">
                  <SkeletonBox className="h-4 w-36" />
                  <SkeletonBox className="h-3 w-20" />
                </div>
              </div>
              <SkeletonBox className="h-6 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      );
    }

    if (dayInfo.list.length === 0) {
      return (
        <div className="py-8 text-center bg-bgPrimary/30 rounded-xl border border-dashed border-borderColor">
          <p className="text-sm font-semibold text-textMain">{dayInfo.displayTitle}</p>
          <p className="text-xs text-textMuted italic mt-1">No classes scheduled for this day.</p>
        </div>
      );
    }

    return (
      <div className={`space-y-3 ${dayInfo.list.length > 8 ? 'max-h-[520px] overflow-y-auto pr-1 custom-scrollbar' : ''}`}>
        {dayInfo.list.map((cls, idx) => {
          const isLab = (cls.type || '').toLowerCase().includes('l');
          const att = findAttendanceForClass(cls, attendanceList);
          const metrics = calculateAttendanceMetrics(att, isLab);

          return (
            <div 
              key={idx} 
              className="group relative flex flex-col rounded-xl bg-bgPrimary/60 hover:bg-bgPrimary transition-all border border-borderColor/40 hover:border-borderColor overflow-hidden shadow-xs"
            >
              <div className="flex items-center p-3 sm:p-3.5">
                {/* Time Slot */}
                <div className="w-16 text-center border-r border-borderColor pr-3 shrink-0">
                  <p className="font-bold text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm leading-tight font-mono">
                    {formatTime(cls.startTime, timeFormat)}
                  </p>
                  <p className="text-[10px] text-textMuted mt-0.5 leading-none font-mono">
                    {formatTime(cls.endTime, timeFormat)}
                  </p>
                </div>

                {/* Course Title & Details */}
                <div className="ml-3 sm:ml-4 flex-grow min-w-0 pr-2">
                  <p className="font-semibold text-textMain text-sm truncate" title={cls.title}>
                    {cls.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-textMuted flex-wrap">
                    <span className="font-mono">{cls.code}</span>
                    <span>-</span>
                    <span>{cls.type}</span>
                  </div>
                </div>

                {/* Venue & Number +/- Card on Right */}
                <div className="flex flex-col items-end justify-center shrink-0 pl-3">
                  <span className="text-xs font-semibold text-textMain mb-1">
                    {cls.venue}
                  </span>
                  {showCardAttendance && metrics && (
                    <span 
                      title={metrics.status === 'safe' ? `Can miss ${metrics.canMiss} classes` : metrics.status === 'warning' ? 'On margin (0)' : `Need ${metrics.needAttend} classes`}
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg border border-borderColor bg-bgCard/90 text-textMuted shadow-xs"
                    >
                      {metrics.status === 'safe' ? `+${metrics.canMiss}` : metrics.status === 'warning' ? '0' : `-${metrics.needAttend}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };