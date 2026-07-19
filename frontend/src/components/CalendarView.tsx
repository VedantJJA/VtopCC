import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCalendar } from '../lib/api';

interface CalendarViewProps {
  semesters: any[];
  activeUser: string;
}

function findBestSemesterForDate(date: Date, semesters: any[]): string | null {
  if (semesters.length === 0) return null;
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 11 = Dec

  // Fall: July (6) to Dec (11)
  // Winter: Jan (0) to June (5)
  const isFall = month >= 6 && month <= 11;

  let targetYearStart: number;
  let targetYearEnd: number;
  let semType: 'Fall' | 'Winter' | 'Summer';

  if (isFall) {
    targetYearStart = year;
    targetYearEnd = year + 1;
    semType = 'Fall';
  } else {
    targetYearStart = year - 1;
    targetYearEnd = year;
    semType = 'Winter';
  }

  const targetYearString = `${targetYearStart}-${String(targetYearEnd).substring(2)}`;
  
  // 1. Precise Match (Year and Type)
  let bestMatch = semesters.find(sem => {
    const name = sem.name.toUpperCase();
    return name.includes(targetYearString) && name.includes(semType.toUpperCase());
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

export const CalendarView: React.FC<CalendarViewProps> = ({ semesters, activeUser }) => {
  const [activeSemester, setActiveSemester] = useState<string>(() => {
    return semesters[0]?.id || '';
  });
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

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

  // Calendar query
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
        localStorage.setItem(`vtop_cache_calendar_${activeSemester}_${calendarDate.getMonth()}_${calendarDate.getFullYear()}`, JSON.stringify(data));
      }
      return data;
    },
    initialData: () => {
      if (!activeSemester) return undefined;
      const cached = localStorage.getItem(`vtop_cache_calendar_${activeSemester}_${calendarDate.getMonth()}_${calendarDate.getFullYear()}`);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
    enabled: !!activeSemester && activeSemester !== 'UNAVAILABLE' && !!activeUser
  });

  return (
    <div className="space-y-6">
      {!activeSemester || activeSemester === 'UNAVAILABLE' ? (
        <div className="p-8 bg-bgCard border border-borderColor rounded-3xl text-center space-y-2 shadow-sm">
          <AlertTriangle className="h-12 w-12 text-textMuted mx-auto" />
          <h4 className="font-bold text-textMain">Calendar Not Available</h4>
          <p className="text-xs text-textMuted">No academic calendar can be loaded without an active semester selection.</p>
        </div>
      ) : calendarQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : calendarQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch Academic Calendar. Please retry.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Controls for Month Selection */}
          <div className="flex justify-center items-center bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-x-6">
            <button
              onClick={() => {
                const prev = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
                setCalendarDate(prev);
              }}
              className="p-2 bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all flex items-center justify-center"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <h3 className="font-extrabold text-textMain text-sm sm:text-base md:text-lg text-center min-w-[150px] uppercase tracking-wide">
              {calendarQuery.data?.month_title || 'Calendar Month'}
            </h3>
            
            <button
              onClick={() => {
                const next = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
                setCalendarDate(next);
              }}
              className="p-2 bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all flex items-center justify-center"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Calendar Grid */}
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
              {calendarQuery.data?.days?.map((dayObj: any, index: number) => {
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
        </div>
      )}
    </div>
  );
};
