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
          <div className="flex items-center justify-between bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm">
            <button
              onClick={() => {
                const prev = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
                setCalendarDate(prev);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all"
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
              className="px-3 py-1.5 text-xs font-bold bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain transition-all"
            >
              Next Month &gt;
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
