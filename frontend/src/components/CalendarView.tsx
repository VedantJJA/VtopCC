import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendar } from '../lib/api';
import { safeGetCache, safeSetCache } from '../lib/cache';

interface CalendarViewProps {
  semesters: any[];
  activeUser: string;
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

export const CalendarView: React.FC<CalendarViewProps> = ({ semesters: propSemesters, activeUser }) => {
  const semesters = propSemesters.length > 0 ? propSemesters : (safeGetCache('vtop_cache_semesters', []) || []);

  const [activeSemester, setActiveSemester] = useState<string>(() => {
    return semesters[0]?.id || '';
  });
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

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
        console.log(`[Calendar Auto-Switch] Month ${calendarDate.getMonth() + 1}/${calendarDate.getFullYear()} outside active semester. Auto-switching to: ${bestSemId}`);
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
      
      // Handle backend auto-switch
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

  // Background buffer pre-fetch for ±1 month after current month completes loading
  useEffect(() => {
    if (calendarQuery.data && !calendarQuery.isFetching && activeSemester && activeUser) {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

      const prefetchMonth = async (date: Date) => {
        const targetSemId = findBestSemesterForDate(date, semesters) || activeSemester;
        const monthIdx = date.getMonth();
        const year = date.getFullYear();
        const cacheKey = `vtop_cache_calendar_${targetSemId}_${monthIdx}_${year}`;
        const genericKey = `vtop_cache_calendar_latest_${monthIdx}_${year}`;

        if (!safeGetCache(cacheKey) && !safeGetCache(genericKey)) {
          try {
            const dateStr = `01-${months[monthIdx]}-${year}`;
            console.log(`[Calendar Buffer Pre-fetch] Background fetching calendar for ${months[monthIdx]} ${year}...`);
            const res = await getCalendar(targetSemId, dateStr);
            const data = res.data?.raw_data;
            if (data) {
              safeSetCache(cacheKey, data);
              safeSetCache(genericKey, data);
            }
          } catch (_err) {
            console.warn(`[Calendar Buffer Pre-fetch] Failed to pre-fetch calendar for ${months[monthIdx]} ${year}`);
          }
        }
      };

      const prevMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
      const nextMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);

      prefetchMonth(prevMonth);
      prefetchMonth(nextMonth);
    }
  }, [calendarQuery.data, calendarQuery.isFetching, calendarDate, activeSemester, activeUser, semesters]);

  // Touch Drag & Swipe Handlers
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
      // Swiped Left -> Smoothly animate to Next Month
      triggerShift('left');
    } else if (dragDistance > 40) {
      // Swiped Right -> Smoothly animate to Previous Month
      triggerShift('right');
    } else {
      // Release short -> Smoothly snap back to center
      setIsAnimating(true);
      setTouchTranslateX(0);
      setTargetOffsetPercent(0);
      setTimeout(() => {
        setIsAnimating(false);
      }, 200);
    }
  };

  // Helper function to load cached month data for adjacent panels
  const getMonthDataForDate = (date: Date) => {
    const isCurrent = date.getMonth() === calendarDate.getMonth() && date.getFullYear() === calendarDate.getFullYear();
    if (isCurrent && calendarQuery.data) {
      return calendarQuery.data;
    }
    const targetSemId = findBestSemesterForDate(date, semesters) || activeSemester;
    const cacheKey = `vtop_cache_calendar_${targetSemId}_${date.getMonth()}_${date.getFullYear()}`;
    const genericKey = `vtop_cache_calendar_latest_${date.getMonth()}_${date.getFullYear()}`;
    return safeGetCache(cacheKey) || safeGetCache(genericKey) || null;
  };

  const prevMonthDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  const nextMonthDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);

  const prevData = getMonthDataForDate(prevMonthDate);
  const currData = calendarQuery.data;
  const nextData = getMonthDataForDate(nextMonthDate);

  // Determine transform & transition styling
  const transformStyle = targetOffsetPercent !== 0
    ? `translate3d(${targetOffsetPercent}%, 0, 0)`
    : `translate3d(${touchTranslateX}px, 0, 0)`;

  const transitionStyle = isSnapReset || isDragging
    ? 'none'
    : 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="space-y-6 select-none overflow-hidden touch-pan-y"
    >
      {!activeSemester || activeSemester === 'UNAVAILABLE' ? (
        <div className="p-8 bg-bgCard border border-borderColor rounded-3xl text-center space-y-2 shadow-sm">
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
        <div className="space-y-6">
          {/* Header Controls for Month Selection */}
          <div className="flex justify-center items-center bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-x-6">
            <button
              onClick={() => triggerShift('right')}
              className="p-2 bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all flex items-center justify-center"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <h3 className="font-extrabold text-textMain text-sm sm:text-base md:text-lg text-center min-w-[150px] uppercase tracking-wide">
              {currData?.month_title || 'Calendar Month'}
            </h3>
            
            <button
              onClick={() => triggerShift('left')}
              className="p-2 bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all flex items-center justify-center"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
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
              <div className="w-[33.333333%] shrink-0 px-2">
                <CalendarMonthPanel data={prevData} />
              </div>

              {/* Current Month Panel */}
              <div className="w-[33.333333%] shrink-0 px-2">
                <CalendarMonthPanel data={currData} />
              </div>

              {/* Next Month Panel */}
              <div className="w-[33.333333%] shrink-0 px-2">
                <CalendarMonthPanel data={nextData} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component rendering a single month calendar grid
const CalendarMonthPanel: React.FC<{ data: any }> = ({ data }) => {
  if (!data || !data.days) {
    return (
      <div className="h-64 flex items-center justify-center bg-bgCard border border-borderColor rounded-xl">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-bgCard border border-borderColor rounded-xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-borderColor bg-bgPrimary font-bold text-center text-xs text-textMuted py-3">
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
                className="bg-bgPrimary/30 min-h-[100px]" 
              />
            );
          }

          let cellBg = 'bg-bgCard';
          let textCls = 'text-textMuted';
          let dateCls = 'text-textMuted/70';

          if (isExam) {
            cellBg = 'bg-orange-100 dark:bg-orange-950/20';
            textCls = 'text-orange-800 dark:text-orange-400';
            dateCls = 'text-orange-600 dark:text-orange-400/80';
          } else if (isWorking) {
            cellBg = 'bg-green-100 dark:bg-green-950/20';
            textCls = 'text-green-800 dark:text-green-400';
            dateCls = 'text-green-600 dark:text-green-400/80';
          } else if (isDayOrder) {
            cellBg = 'bg-yellow-100 dark:bg-yellow-950/20';
            textCls = 'text-yellow-800 dark:text-yellow-400';
            dateCls = 'text-yellow-600 dark:text-yellow-400/80';
          } else if (isHoliday) {
            cellBg = 'bg-red-100 dark:bg-red-950/20';
            textCls = 'text-red-800 dark:text-red-400';
            dateCls = 'text-red-600 dark:text-red-400/80';
          }

          return (
            <div 
              key={index} 
              className={`${cellBg} min-h-[100px] p-2 relative transition-all flex flex-col justify-between hover:brightness-95 dark:hover:brightness-110`}
            >
              <span className={`absolute top-2 left-2 text-sm font-extrabold ${dateCls}`}>
                {dayObj.day}
              </span>
              
              <div className="mt-6 flex-1 flex flex-col items-center justify-center space-y-1">
                {dayObj.events?.map((event: any, eventIdx: number) => (
                  <p 
                    key={eventIdx} 
                    className={`text-[10px] font-bold text-center leading-tight ${textCls}`}
                  >
                    {event.text}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
