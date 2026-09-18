import React, { useState, useRef } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Activity, CalendarDays, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface DashboardViewProps {
  attendanceQuery: UseQueryResult<any[], any>;
  timetableQuery: UseQueryResult<any, any>;
  odSnapshotQuery: UseQueryResult<any, any>;
  TIMETABLE_SLOTS: any[];
  setActiveTab?: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  attendanceQuery,
  timetableQuery,
  odSnapshotQuery,
  setActiveTab
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bgCard border border-borderColor rounded-xl p-6 shadow-sm flex flex-col h-fit">
          <div>
            <h3 className="font-bold text-textMain text-base mb-6 flex items-center gap-2 border-b border-borderColor pb-3">
              <Activity className="h-5 w-5 text-indigo-500" /> Snapshot
            </h3>
            
            {attSum.loading ? (
              <div className="h-16 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
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
                    <span className="text-textMain font-bold group-hover:text-accentColor transition-colors">{attSum.percentage}%</span>
                  </div>
                  <div className="w-full bg-bgPrimary rounded-full h-2 overflow-hidden border border-borderColor/40">
                    <div 
                      className="h-full rounded-full transition-all duration-500 bg-yellow-500"
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
                  <SchedulePanel dayInfo={prevDayInfo} attendanceList={attendanceQuery.data || []} />
                </div>
                <div className="w-[33.333333%] shrink-0 px-2">
                  <SchedulePanel dayInfo={currDayInfo} attendanceList={attendanceQuery.data || []} />
                </div>
                <div className="w-[33.333333%] shrink-0 px-2">
                  <SchedulePanel dayInfo={nextDayInfo} attendanceList={attendanceQuery.data || []} />
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

function calculateAttendanceMetrics(att: any | null) {
  if (!att) return null;
  const attended = parseInt(att.attended_classes, 10);
  const total = parseInt(att.total_classes, 10);
  if (isNaN(attended) || isNaN(total) || total === 0) {
    const parsedPercent = parseFloat(att.percentage);
    return {
      percentage: isNaN(parsedPercent) ? 0 : parsedPercent,
      attended: 0,
      total: 0,
      canMiss: 0,
      needAttend: 0,
      status: 'no_data' as const
    };
  }

  const rawPercent = (attended / total) * 100;
  const percentage = parseFloat(att.percentage) || Math.round(rawPercent * 10) / 10;

  // Formula for classes that can be missed while staying >= 75%:
  // attended / (total + m) >= 0.75 => m <= (4 * attended - 3 * total) / 3
  const margin = Math.floor((4 * attended - 3 * total) / 3);

  if (margin > 0) {
    return {
      percentage,
      attended,
      total,
      canMiss: margin,
      needAttend: 0,
      status: 'safe' as const
    };
  } else if (margin === 0) {
    return {
      percentage,
      attended,
      total,
      canMiss: 0,
      needAttend: 0,
      status: 'warning' as const
    };
  } else {
    // Under 75%: classes needed consecutively to reach 75%:
    // (attended + x) / (total + x) >= 0.75 => x >= 3 * total - 4 * attended
    const need = Math.ceil(3 * total - 4 * attended);
    return {
      percentage,
      attended,
      total,
      canMiss: 0,
      needAttend: Math.max(1, need),
      status: 'danger' as const
    };
  }
}

const SchedulePanel: React.FC<{ 
  dayInfo: { displayTitle: string; list: any[]; loading: boolean };
  attendanceList?: any[];
}> = ({ dayInfo, attendanceList = [] }) => {
  if (dayInfo.loading) {
    return (
      <div className="h-24 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
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
        const att = findAttendanceForClass(cls, attendanceList);
        const metrics = calculateAttendanceMetrics(att);

        let barColor = 'bg-emerald-500';
        if (metrics) {
          if (metrics.status === 'danger') barColor = 'bg-rose-500';
          else if (metrics.status === 'warning') barColor = 'bg-amber-500';
          else barColor = 'bg-emerald-500';
        }

        return (
          <div 
            key={idx} 
            className="group relative flex flex-col rounded-xl bg-bgPrimary/60 hover:bg-bgPrimary transition-all border border-borderColor/40 hover:border-borderColor overflow-hidden shadow-xs"
          >
            <div className="flex items-center p-3 sm:p-3.5">
              {/* Time Slot */}
              <div className="w-16 text-center border-r border-borderColor pr-3 shrink-0">
                <p className="font-bold text-indigo-600 dark:text-indigo-400 text-sm leading-tight">
                  {cls.startTime}
                </p>
                <p className="text-[10px] text-textMuted mt-0.5 leading-none">
                  {cls.endTime}
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

              {/* Venue & Percentage + Margin Badge */}
              <div className="flex flex-col items-end shrink-0 pl-2">
                <span className="text-xs font-semibold text-textMain">
                  {cls.venue}
                </span>
                {metrics ? (
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-lg border ${
                      metrics.status === 'safe'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : metrics.status === 'warning'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}>
                      {metrics.percentage}%
                    </span>
                    <span 
                      title={metrics.status === 'safe' ? `+${metrics.canMiss}` : metrics.status === 'warning' ? '0' : `-${metrics.needAttend}`}
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-lg border ${
                        metrics.status === 'safe'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : metrics.status === 'warning'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {metrics.status === 'safe' ? `+${metrics.canMiss}` : metrics.status === 'warning' ? '0' : `-${metrics.needAttend}`}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Bottom Border-like Attendance Loading / Progress Bar */}
            {metrics && (
              <div 
                className="w-full h-1 bg-borderColor/40 overflow-hidden" 
                title={`Attendance: ${metrics.percentage}% (${metrics.attended}/${metrics.total})`}
              >
                <div 
                  className={`h-full ${barColor} transition-all duration-500 ease-out`}
                  style={{ width: `${Math.min(Math.max(metrics.percentage, 0), 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};