import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Loader2, AlertTriangle, ChevronLeft, ChevronRight, LayoutGrid, 
  CalendarDays, Plus, Trash2, Clock, MapPin, X 
} from 'lucide-react';
import { getCalendar } from '../lib/api';
import { safeGetCache, safeSetCache } from '../lib/cache';
import { formatTime } from '../lib/utils';
import { 
  getCustomSchedules, 
  addCustomSchedule, 
  deleteCustomSchedule, 
  PRESET_SCHEDULE_COLORS, 
  type CustomScheduleItem 
} from '../services/customScheduleService';

interface CalendarViewProps {
  semesters: any[];
  activeUser: string;
  mobileOptimization?: boolean;
  timeFormat?: '12h' | '24h';
}

// Function to find best matching semester ID for a given Date
function findBestSemesterForDate(targetDate: Date, semesters: any[]): string {
  if (!semesters || semesters.length === 0) return '';

  const targetMonth = targetDate.getMonth() + 1; // 1-12
  const targetYear = targetDate.getFullYear();
  const targetYearString = targetYear.toString();

  // 1. Exact match on semester patterns
  const isWinter = targetMonth >= 1 && targetMonth <= 5;
  const isFall = targetMonth >= 6 && targetMonth <= 11;

  let bestMatch = semesters.find(sem => {
    const nameUpper = sem.name.toUpperCase();
    const matchesYear = nameUpper.includes(targetYearString);
    if (isWinter && matchesYear && (nameUpper.includes('WIN') || nameUpper.includes('WS') || nameUpper.includes('WINTER'))) {
      return true;
    }
    if (isFall && matchesYear && (nameUpper.includes('FALL') || nameUpper.includes('FS') || nameUpper.includes('MONSOON'))) {
      return true;
    }
    return false;
  });

  // 2. Fallback: target year
  if (!bestMatch) {
    bestMatch = semesters.find(sem => {
      return sem.name.includes(targetYearString);
    });
  }

  // 3. Last fallback: return the first semester
  return bestMatch ? bestMatch.id : semesters[0].id;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  semesters: propSemesters, 
  activeUser,
  mobileOptimization = false,
  timeFormat = '24h'
}) => {
  const semesters = propSemesters.length > 0 ? propSemesters : (safeGetCache('vtop_cache_semesters', []) || []);

  const [activeSemester, setActiveSemester] = useState<string>(() => {
    return semesters[0]?.id || '';
  });
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'agenda' | 'grid'>(() => mobileOptimization ? 'agenda' : 'grid');

  // Custom schedules subscription
  const [customSchedulesList, setCustomSchedulesList] = useState<CustomScheduleItem[]>(getCustomSchedules);

  useEffect(() => {
    const handleUpdate = () => setCustomSchedulesList(getCustomSchedules());
    window.addEventListener('vtop_custom_schedules_updated', handleUpdate);
    return () => window.removeEventListener('vtop_custom_schedules_updated', handleUpdate);
  }, []);

  // Modal State for Adding Custom Schedule
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [customTitle, setCustomTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [customDayOfWeek, setCustomDayOfWeek] = useState('MON');
  const [customDate, setCustomDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [customStartTime, setCustomStartTime] = useState('17:00');
  const [customEndTime, setCustomEndTime] = useState('18:00');
  const [customVenue, setCustomVenue] = useState('');
  const [customColor, setCustomColor] = useState(PRESET_SCHEDULE_COLORS[0].hex);

  // Carousel Touch & Animation States
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchTranslateX, setTouchTranslateX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [targetOffsetPercent, setTargetOffsetPercent] = useState<number>(0);
  const [_isAnimating, setIsAnimating] = useState<boolean>(false);
  const [isSnapReset, setIsSnapReset] = useState<boolean>(false);
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

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

      // 2. Advance calendar month state
      setCalendarDate(prev => {
        const nextMonthOffset = dir === 'left' ? 1 : -1;
        return new Date(prev.getFullYear(), prev.getMonth() + nextMonthOffset, 1);
      });

      // 3. Re-enable transitions after browser paints the swap
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsSnapReset(false);
          isBusyRef.current = false;
        });
      });
    }, 250);
  };

  // Initialize activeSemester on load
  useEffect(() => {
    if (semesters.length > 0 && !activeSemester) {
      setActiveSemester(semesters[0].id);
    }
  }, [semesters]);

  // Auto-switch active semester based on currently viewed calendar month
  useEffect(() => {
    if (semesters.length > 0) {
      const bestSemId = findBestSemesterForDate(calendarDate, semesters);
      if (bestSemId && bestSemId !== activeSemester) {
        setActiveSemester(bestSemId);
      }
    }
  }, [calendarDate, semesters]);

  // Calendar query for currently selected month
  const calendarQuery = useQuery({
    queryKey: ['calendar', activeUser, activeSemester, calendarDate.getMonth(), calendarDate.getFullYear()],
    queryFn: async () => {
      if (!activeSemester) return null;
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const dateStr = `01-${months[calendarDate.getMonth()]}-${calendarDate.getFullYear()}`;
      const res = await getCalendar(activeSemester, dateStr);
      
      if (res.data.new_semester_id && res.data.new_semester_id !== activeSemester) {
        setTimeout(() => {
          setActiveSemester(res.data.new_semester_id);
        }, 0);
      }
      
      const data = res.data.raw_data;
      if (data) {
        safeSetCache(`vtop_cache_calendar_${activeSemester}_${calendarDate.getMonth()}_${calendarDate.getFullYear()}`, data);
        safeSetCache(`vtop_cache_calendar_latest_${calendarDate.getMonth()}_${calendarDate.getFullYear()}`, data);
      }
      return data;
    },
    initialData: () => {
      const specificCache = activeSemester ? safeGetCache(`vtop_cache_calendar_${activeSemester}_${calendarDate.getMonth()}_${calendarDate.getFullYear()}`) : null;
      const genericCache = safeGetCache(`vtop_cache_calendar_latest_${calendarDate.getMonth()}_${calendarDate.getFullYear()}`);
      return specificCache || genericCache || undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: !!activeSemester && activeSemester !== 'UNAVAILABLE' && !!activeUser
  });

  // Background buffer pre-fetch for +/- 1 month after current month completes loading
  useEffect(() => {
    if (calendarQuery.data && !calendarQuery.isFetching && activeSemester && activeUser) {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      const prefetchMonth = async (date: Date) => {
        const targetSemId = findBestSemesterForDate(date, semesters) || activeSemester;
        const cacheKey = `vtop_cache_calendar_${targetSemId}_${date.getMonth()}_${date.getFullYear()}`;
        if (!safeGetCache(cacheKey)) {
          try {
            const dateStr = `01-${months[date.getMonth()]}-${date.getFullYear()}`;
            const res = await getCalendar(targetSemId, dateStr);
            if (res.data.raw_data) {
              safeSetCache(cacheKey, res.data.raw_data);
            }
          } catch (e) {
            console.debug('[Calendar Buffer] Prefetch failed silently', e);
          }
        }
      };

      const prev = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
      const next = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
      prefetchMonth(prev);
      prefetchMonth(next);
    }
  }, [calendarQuery.data, calendarQuery.isFetching, calendarDate, activeSemester, activeUser]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isBusyRef.current) return;
    setTouchStartX(e.targetTouches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || isBusyRef.current) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStartX;
    setTouchTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || isBusyRef.current) return;
    setIsDragging(false);

    const threshold = 60;
    if (touchTranslateX > threshold) {
      triggerShift('right');
    } else if (touchTranslateX < -threshold) {
      triggerShift('left');
    } else {
      setTouchTranslateX(0);
    }
    setTouchStartX(null);
  };

  // Helper to read cached month data
  const getMonthDataForDate = (date: Date) => {
    const targetSemId = findBestSemesterForDate(date, semesters) || activeSemester;
    const specific = targetSemId ? safeGetCache(`vtop_cache_calendar_${targetSemId}_${date.getMonth()}_${date.getFullYear()}`) : null;
    const generic = safeGetCache(`vtop_cache_calendar_latest_${date.getMonth()}_${date.getFullYear()}`);
    return specific || generic || null;
  };

  const prevMonthDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  const nextMonthDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);

  const prevData = getMonthDataForDate(prevMonthDate);
  const currData = calendarQuery.data;
  const nextData = getMonthDataForDate(nextMonthDate);

  // Auto-select current day or first active day on month change
  useEffect(() => {
    if (currData?.days) {
      const todayNum = new Date().getDate().toString();
      const isThisMonth = new Date().getMonth() === calendarDate.getMonth() && new Date().getFullYear() === calendarDate.getFullYear();
      const defaultDay = (isThisMonth ? currData.days.find((d: any) => d.day === todayNum && d.status !== 'padding') : null)
        || currData.days.find((d: any) => d.day && d.status !== 'padding')
        || null;
      setSelectedDay(defaultDay);
    }
  }, [currData, calendarDate]);

  // Selected date string YYYY-MM-DD
  const selectedDateStr = selectedDay?.day 
    ? `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.day).padStart(2, '0')}`
    : '';

  // Filter custom events for currently selected day
  const dayCustomEvents = selectedDateStr 
    ? customSchedulesList.filter(item => {
        if (item.isRecurring) {
          const targetDate = new Date(selectedDateStr);
          const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          return item.dayOfWeek === days[targetDate.getDay()];
        }
        return item.date === selectedDateStr;
      })
    : [];

  // Determine transform & transition styling
  const transformStyle = targetOffsetPercent !== 0
    ? `translate3d(${targetOffsetPercent}%, 0, 0)`
    : `translate3d(${touchTranslateX}px, 0, 0)`;

  const transitionStyle = isSnapReset || isDragging
    ? 'none'
    : 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';

  const handleCreateCustomSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;

    addCustomSchedule({
      title: customTitle.trim(),
      isRecurring,
      dayOfWeek: isRecurring ? customDayOfWeek : undefined,
      date: !isRecurring ? customDate : undefined,
      startTime: customStartTime,
      endTime: customEndTime,
      venue: customVenue.trim() || undefined,
      color: customColor
    });

    setIsAddModalOpen(false);
    setCustomTitle('');
    setCustomVenue('');
  };

  return (
    <div 
      data-no-swipe="true"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="space-y-5 select-none overflow-hidden touch-pan-y"
    >
      {!activeSemester || activeSemester === 'UNAVAILABLE' ? (
        <div className="p-8 bg-bgCard border border-borderColor rounded-xl text-center space-y-2 shadow-sm">
          <AlertTriangle className="h-12 w-12 text-textMuted mx-auto" />
          <h4 className="font-bold text-textMain">Calendar Not Available</h4>
          <p className="text-xs text-textMuted">No academic calendar can be loaded without an active semester selection.</p>
        </div>
      ) : calendarQuery.isPending && !calendarQuery.data ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : calendarQuery.isError && !calendarQuery.data ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch Academic Calendar. Please retry.</span>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header Controls: Month Selection, View Mode Icons Beside it, & Add Schedule */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-bgCard border border-borderColor rounded-xl p-2.5 sm:p-3.5 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Month Navigation */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => triggerShift('right')}
                  className="p-1.5 sm:p-2 bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all flex items-center justify-center"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <h3 className="font-extrabold text-textMain text-xs sm:text-sm md:text-base text-center min-w-[110px] sm:min-w-[130px] uppercase tracking-wide font-mono">
                  {currData?.month_title || 'Calendar Month'}
                </h3>
                
                <button
                  type="button"
                  onClick={() => triggerShift('left')}
                  className="p-1.5 sm:p-2 bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all flex items-center justify-center"
                  title="Next Month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* View Switcher: Icons Only beside Month Switcher */}
              <div className="flex items-center p-0.5 sm:p-1 bg-bgPrimary border border-borderColor rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('agenda')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'agenda'
                      ? 'bg-bgCard text-accentColor shadow-xs border border-borderColor/60'
                      : 'text-textMuted hover:text-textMain'
                  }`}
                  title="Agenda View"
                  aria-label="Agenda View"
                >
                  <CalendarDays className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-bgCard text-accentColor shadow-xs border border-borderColor/60'
                      : 'text-textMuted hover:text-textMain'
                  }`}
                  title="Grid View"
                  aria-label="Grid View"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Add Custom Schedule Button */}
            <button
              type="button"
              onClick={() => {
                if (selectedDateStr) setCustomDate(selectedDateStr);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accentColor hover:bg-accentColor/90 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
              title="Add Custom Schedule"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Schedule</span>
            </button>
          </div>

          {/* 3-Panel Continuous Calendar Track Container */}
          <div className="w-full overflow-hidden">
            <div 
              style={{
                transform: transformStyle,
                transition: transitionStyle
              }}
              className="flex flex-row w-[300%] -ml-[100%]"
            >
              {/* Previous Month Panel */}
              <div className="w-[33.333333%] shrink-0 px-1 sm:px-2">
                <CalendarMonthPanel 
                  data={prevData} 
                  calendarDate={prevMonthDate} 
                  customSchedules={customSchedulesList} 
                  isLegacyGrid={viewMode === 'grid'} 
                />
              </div>

              {/* Current Month Panel */}
              <div className="w-[33.333333%] shrink-0 px-1 sm:px-2">
                <CalendarMonthPanel 
                  data={currData} 
                  calendarDate={calendarDate}
                  customSchedules={customSchedulesList}
                  selectedDay={selectedDay} 
                  onSelectDay={setSelectedDay} 
                  isLegacyGrid={viewMode === 'grid'}
                />
              </div>

              {/* Next Month Panel */}
              <div className="w-[33.333333%] shrink-0 px-1 sm:px-2">
                <CalendarMonthPanel 
                  data={nextData} 
                  calendarDate={nextMonthDate}
                  customSchedules={customSchedulesList} 
                  isLegacyGrid={viewMode === 'grid'} 
                />
              </div>
            </div>
          </div>

          {/* Selected Day Agenda Card */}
          {selectedDay && selectedDay.day && (
            <div className="bg-bgCard border border-borderColor rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5 animate-in fade-in duration-300">
              <div className="flex items-start justify-between gap-3 border-b border-borderColor/50 pb-2.5">
                <div>
                  <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Selected Date</span>
                  <h4 className="text-base sm:text-lg font-black text-textMain mt-0.5">
                    Day {selectedDay.day} - {currData?.month_title || 'Current Month'}
                  </h4>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${
                  selectedDay.status === 'working' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                  selectedDay.status === 'holiday' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                  selectedDay.status === 'exam' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                  selectedDay.status === 'day_order' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' :
                  'bg-bgPrimary text-textMuted border-borderColor'
                }`}>
                  {selectedDay.status === 'working' ? 'Instructional Day' :
                   selectedDay.status === 'holiday' ? 'Holiday / Off' :
                   selectedDay.status === 'exam' ? 'Exam Session' :
                   selectedDay.status === 'day_order' ? 'Day Order' : 'Scheduled Day'}
                </span>
              </div>

              {/* Academic Calendar Events */}
              {selectedDay.events && selectedDay.events.length > 0 && (
                <div className="space-y-2">
                  {selectedDay.events.map((event: any, i: number) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-bgPrimary/50 border border-borderColor/50 text-xs font-semibold text-textMain">
                      <span className="w-2 h-2 rounded-full bg-accentColor shrink-0" />
                      <span>{event.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Schedules for this Day */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-textMuted uppercase tracking-wider">Custom Schedules</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDateStr) setCustomDate(selectedDateStr);
                      setIsAddModalOpen(true);
                    }}
                    className="text-xs text-accentColor font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add</span>
                  </button>
                </div>

                {dayCustomEvents.length > 0 ? (
                  <div className="space-y-2">
                    {dayCustomEvents.map((cs) => (
                      <div 
                        key={cs.id}
                        className="flex items-center justify-between p-3 rounded-xl border bg-bgPrimary/40 transition-all"
                        style={{ borderLeftWidth: '4px', borderLeftColor: cs.color }}
                      >
                        <div className="space-y-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-textMain">{cs.title}</span>
                            <span 
                              style={{ backgroundColor: `${cs.color}20`, color: cs.color, borderColor: `${cs.color}50` }}
                              className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase"
                            >
                              {cs.isRecurring ? 'Weekly' : 'Custom'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-textMuted font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(cs.startTime, timeFormat)} - {formatTime(cs.endTime, timeFormat)}
                            </span>
                            {cs.venue && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {cs.venue}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteCustomSchedule(cs.id)}
                          className="p-1.5 text-textMuted hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          title="Delete schedule"
                          aria-label="Delete schedule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-textMuted italic py-1">
                    No custom schedule entries added for this date.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Calendar Status Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[11px] font-semibold text-textMuted">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Instructional Day</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Exam</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Day Order</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Custom Schedule */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-bgCard border border-borderColor rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-borderColor pb-3">
              <h3 className="text-base font-bold text-textMain flex items-center gap-2">
                <Plus className="h-4 w-4 text-accentColor" />
                <span>Add Custom Schedule</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-textMuted hover:text-textMain hover:bg-bgPrimary transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomSchedule} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-textMuted mb-1">
                  Schedule Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Club Meeting, Robotics Practice, Gym"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-sm text-textMain focus:outline-hidden focus:border-accentColor"
                />
              </div>

              {/* Recurring vs Specific Date */}
              <div className="flex items-center gap-4 text-xs font-semibold text-textMain">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={!isRecurring}
                    onChange={() => setIsRecurring(false)}
                    className="accent-accentColor"
                  />
                  <span>Specific Date</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={isRecurring}
                    onChange={() => setIsRecurring(true)}
                    className="accent-accentColor"
                  />
                  <span>Recurring Weekly</span>
                </label>
              </div>

              {isRecurring ? (
                <div>
                  <label className="block text-xs font-semibold text-textMuted mb-1">
                    Day of Week
                  </label>
                  <select
                    value={customDayOfWeek}
                    onChange={(e) => setCustomDayOfWeek(e.target.value)}
                    className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-sm text-textMain focus:outline-hidden focus:border-accentColor cursor-pointer"
                  >
                    <option value="MON">Monday</option>
                    <option value="TUE">Tuesday</option>
                    <option value="WED">Wednesday</option>
                    <option value="THU">Thursday</option>
                    <option value="FRI">Friday</option>
                    <option value="SAT">Saturday</option>
                    <option value="SUN">Sunday</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-textMuted mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-sm text-textMain focus:outline-hidden focus:border-accentColor"
                  />
                </div>
              )}

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-textMuted mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-sm text-textMain font-mono focus:outline-hidden focus:border-accentColor"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-textMuted mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-sm text-textMain font-mono focus:outline-hidden focus:border-accentColor"
                  />
                </div>
              </div>

              {/* Venue */}
              <div>
                <label className="block text-xs font-semibold text-textMuted mb-1">
                  Venue / Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SJT 401 or Online"
                  value={customVenue}
                  onChange={(e) => setCustomVenue(e.target.value)}
                  className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-sm text-textMain focus:outline-hidden focus:border-accentColor"
                />
              </div>

              {/* Custom Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-textMuted mb-1.5">
                  Schedule Color
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {PRESET_SCHEDULE_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setCustomColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer shadow-xs ${
                        customColor === c.hex ? 'ring-2 ring-offset-2 ring-accentColor scale-110' : 'hover:scale-105'
                      }`}
                      title={c.name}
                    />
                  ))}
                  <div className="flex items-center gap-1.5 pl-1">
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border border-borderColor bg-bgPrimary p-0.5 cursor-pointer"
                      title="Custom Color"
                    />
                    <span className="font-mono text-xs text-textMuted uppercase">{customColor}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-borderColor">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-textMuted hover:text-textMain rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-accentColor hover:bg-accentColor/90 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component rendering a single month calendar grid
const CalendarMonthPanel: React.FC<{ 
  data: any;
  calendarDate: Date;
  customSchedules?: CustomScheduleItem[];
  selectedDay?: any;
  onSelectDay?: (dayObj: any) => void;
  isLegacyGrid?: boolean;
}> = ({ data, calendarDate, customSchedules = [], selectedDay, onSelectDay, isLegacyGrid = false }) => {
  if (!data || !data.days) {
    return (
      <div className="h-64 flex items-center justify-center bg-bgCard border border-borderColor rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-bgCard border border-borderColor rounded-xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-borderColor bg-bgPrimary font-bold text-center text-xs text-textMuted py-2.5">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>
      
      <div className="grid grid-cols-7 bg-borderColor dark:bg-borderColor/40 gap-px">
        {data.days.map((dayObj: any, index: number) => {
          const isPadding = dayObj.status === 'padding' || !dayObj.day;
          const isHoliday = dayObj.status === 'holiday';
          const isWorking = dayObj.status === 'working';
          const isDayOrder = dayObj.status === 'day_order';
          const isExam = dayObj.status === 'exam';

          if (isPadding) {
            return (
              <div 
                key={index} 
                className={`bg-bgPrimary/30 ${isLegacyGrid ? 'min-h-[90px] sm:min-h-[110px]' : 'min-h-[48px] sm:min-h-[85px]'}`} 
              />
            );
          }

          const isSelected = selectedDay && selectedDay.day === dayObj.day && selectedDay.status === dayObj.status;

          // Check for custom schedules on this day
          const dayDateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(dayObj.day).padStart(2, '0')}`;
          const matchingCustom = customSchedules.filter(item => {
            if (item.isRecurring) {
              const d = new Date(dayDateStr);
              const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
              return item.dayOfWeek === dayNames[d.getDay()];
            }
            return item.date === dayDateStr;
          });

          let cellBg = 'bg-bgCard';
          let textCls = 'text-textMuted';
          let dateCls = 'text-textMuted/80';

          if (isExam) {
            cellBg = 'bg-amber-500/10';
            textCls = 'text-amber-600 dark:text-amber-400';
            dateCls = 'text-amber-600 dark:text-amber-400';
          } else if (isWorking) {
            cellBg = 'bg-emerald-500/10';
            textCls = 'text-emerald-700 dark:text-emerald-400';
            dateCls = 'text-emerald-700 dark:text-emerald-400';
          } else if (isDayOrder) {
            cellBg = 'bg-yellow-500/10';
            textCls = 'text-yellow-700 dark:text-yellow-400';
            dateCls = 'text-yellow-700 dark:text-yellow-400';
          } else if (isHoliday) {
            cellBg = 'bg-rose-500/10';
            textCls = 'text-rose-700 dark:text-rose-400';
            dateCls = 'text-rose-700 dark:text-rose-400';
          }

          return (
            <div 
              key={index} 
              onClick={() => onSelectDay && onSelectDay(dayObj)}
              className={`${cellBg} ${isLegacyGrid ? 'min-h-[90px] sm:min-h-[110px]' : 'min-h-[48px] sm:min-h-[85px]'} p-1.5 sm:p-2 relative transition-all flex flex-col justify-between cursor-pointer hover:brightness-95 dark:hover:brightness-110 ${
                isSelected ? 'ring-2 ring-accentColor shadow-md z-10' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs sm:text-sm font-extrabold ${dateCls}`}>
                  {dayObj.day}
                </span>
                {matchingCustom.length > 0 && (
                  <span 
                    style={{ backgroundColor: matchingCustom[0].color }}
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shadow-xs"
                    title={`Custom: ${matchingCustom[0].title}`}
                  />
                )}
              </div>

              {isLegacyGrid ? (
                <div className="mt-1 flex-1 flex flex-col items-center justify-start space-y-1 overflow-hidden">
                  {matchingCustom.map((cs, cIdx) => (
                    <p 
                      key={`c-${cIdx}`} 
                      style={{ backgroundColor: cs.color }}
                      className="text-[9px] font-bold text-center leading-tight line-clamp-1 px-1 py-0.5 rounded text-white w-full truncate"
                    >
                      {cs.title}
                    </p>
                  ))}
                  {dayObj.events?.map((event: any, eventIdx: number) => (
                    <p 
                      key={eventIdx} 
                      className={`text-[9px] sm:text-[10px] font-bold text-center leading-tight line-clamp-2 ${textCls}`}
                    >
                      {event.text}
                    </p>
                  ))}
                </div>
              ) : (
                <>
                  {/* Mobile compact dot badges */}
                  <div className="flex items-center justify-center gap-1 mt-1 sm:hidden flex-wrap">
                    {matchingCustom.length > 0 && (
                      <span 
                        style={{ backgroundColor: matchingCustom[0].color }}
                        className="w-1.5 h-1.5 rounded-full" 
                      />
                    )}
                    {isWorking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    {isHoliday && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                    {isExam && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    {isDayOrder && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                  </div>
                  
                  {/* Desktop full event labels */}
                  <div className="hidden sm:flex mt-2 flex-1 flex-col items-center justify-center space-y-1 overflow-hidden">
                    {matchingCustom.map((cs, cIdx) => (
                      <p 
                        key={`c-${cIdx}`} 
                        style={{ backgroundColor: cs.color }}
                        className="text-[9px] font-bold text-center leading-tight line-clamp-1 px-1 py-0.5 rounded text-white w-full truncate"
                      >
                        {cs.title}
                      </p>
                    ))}
                    {dayObj.events?.map((event: any, eventIdx: number) => (
                      <p 
                        key={eventIdx} 
                        className={`text-[10px] font-bold text-center leading-tight line-clamp-2 ${textCls}`}
                      >
                        {event.text}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
