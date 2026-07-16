import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';

interface CalendarViewProps {
  calendarQuery: UseQueryResult<any, any>;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  calendarQuery,
  calendarDate,
  setCalendarDate
}) => {
  return (
    <div className="space-y-6">
      {calendarQuery.isPending ? (
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
          {/* Header Controls for Month */}
          <div className="flex items-center justify-between bg-bgCard border border-borderColor rounded-2xl p-4 shadow-sm">
            <button
              onClick={() => {
                const prev = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
                setCalendarDate(prev);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain"
            >
              &lt; Previous Month
            </button>
            <h3 className="font-extrabold text-blue-600 dark:text-blue-500 text-sm md:text-base">
              {calendarQuery.data?.month_title || 'Calendar Month'}
            </h3>
            <button
              onClick={() => {
                const next = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
                setCalendarDate(next);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain"
            >
              Next Month &gt;
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-borderColor bg-bgPrimary font-bold text-center text-xs text-textMuted py-3">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>
            <div className="grid grid-cols-7 auto-rows-[90px] md:auto-rows-[110px] divide-x divide-y divide-borderColor/40 border-l border-t border-borderColor/40">
              {calendarQuery.data?.days?.map((dayObj: any, index: number) => {
                const isPadding = dayObj.status === 'padding';
                const isHoliday = dayObj.status === 'holiday';
                const isWorking = dayObj.status === 'working';
                const isDayOrder = dayObj.status === 'day_order';
                const isExam = dayObj.status === 'exam';

                let bgClass = 'bg-transparent';
                if (isHoliday) bgClass = 'bg-rose-50/20 dark:bg-rose-950/5';
                else if (isWorking) bgClass = 'bg-emerald-50/20 dark:bg-emerald-950/5';
                else if (isDayOrder) bgClass = 'bg-amber-50/20 dark:bg-amber-950/5';
                else if (isExam) bgClass = 'bg-blue-50/20 dark:bg-blue-950/5';

                return (
                  <div key={index} className={`p-2 flex flex-col justify-between overflow-hidden text-left relative ${bgClass}`}>
                    {!isPadding && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-extrabold ${
                              isHoliday ? 'text-rose-600 dark:text-rose-400' :
                              isWorking ? 'text-emerald-600 dark:text-emerald-400' :
                              isDayOrder ? 'text-amber-600 dark:text-amber-400' : 
                              isExam ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                            }`}>
                            {dayObj.day}
                          </span>
                          {isDayOrder && (
                            <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase">Day Ord</span>
                          )}
                          {isExam && (
                            <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase font-mono">Exam</span>
                          )}
                        </div>
                        <div className="flex-1 mt-1 flex flex-col justify-end space-y-0.5 max-h-[50px] overflow-y-auto">
                          {dayObj.events?.map((e: any, eIdx: number) => (
                            <div
                              key={eIdx}
                              className={`text-[9px] truncate px-1 py-0.5 rounded-sm font-semibold ${
                                  isHoliday ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' :
                                  isWorking ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' :
                                  isDayOrder ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' :
                                  isExam ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' :
                                  'bg-bgPrimary border border-borderColor text-textMain'
                                }`}
                              title={e.text}
                            >
                              {e.text}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
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
