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
          <Loader2 className="h-8 w-8 animate-spin text-accentColor" />
        </div>
      ) : calendarQuery.isError ? (
        <div className="p-4 bg-bgDanger text-accentDanger border border-accentDanger/20 rounded-2xl flex gap-2">
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
              ◀ Previous Month
            </button>
            <h3 className="font-extrabold text-accentColor text-sm md:text-base">
              {calendarQuery.data?.month_title || 'Calendar Month'}
            </h3>
            <button
              onClick={() => {
                const next = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
                setCalendarDate(next);
              }}
              className="px-3 py-1.5 text-xs font-bold bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-lg cursor-pointer text-textMain"
            >
              Next Month ▶
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
            <div className="grid grid-cols-7 auto-rows-[90px] md:auto-rows-[110px] divide-x divide-y divide-borderColor border-l border-t border-borderColor">
              {calendarQuery.data?.days?.map((dayObj: any, index: number) => {
                const isPadding = dayObj.status === 'padding';
                const isHoliday = dayObj.status === 'holiday';
                const isWorking = dayObj.status === 'working';
                const isDayOrder = dayObj.status === 'day_order';
                const isExam = dayObj.status === 'exam';

                let bgClass = 'bg-transparent';
                if (isHoliday) bgClass = 'bg-bgDanger/45';
                else if (isWorking) bgClass = 'bg-bgSuccess/45';
                else if (isDayOrder) bgClass = 'bg-bgWarning/45';
                else if (isExam) bgClass = 'bg-bgInfo/45';

                return (
                  <div key={index} className={`p-2 flex flex-col justify-between overflow-hidden text-left relative ${bgClass}`}>
                    {!isPadding && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className={`text-xs font-extrabold ${
                              isHoliday ? 'text-accentDanger' :
                              isWorking ? 'text-accentSuccess' :
                              isDayOrder ? 'text-accentWarning' : 
                              isExam ? 'text-accentInfo' : 'text-textMuted'
                            }`}>
                            {dayObj.day}
                          </span>
                          {isDayOrder && (
                            <span className="text-[8px] font-bold text-accentWarning uppercase">Day Ord</span>
                          )}
                          {isExam && (
                            <span className="text-[8px] font-bold text-accentInfo uppercase font-mono">Exam</span>
                          )}
                        </div>
                        <div className="flex-1 mt-1 flex flex-col justify-end space-y-0.5 max-h-[50px] overflow-y-auto">
                          {dayObj.events?.map((e: any, eIdx: number) => (
                            <div
                              key={eIdx}
                              className={`text-[9px] truncate px-1 py-0.5 rounded-sm font-semibold bg-bgCard border ${
                                  isHoliday ? 'border-accentDanger/25 text-accentDanger' :
                                  isWorking ? 'border-accentSuccess/25 text-accentSuccess' :
                                  isDayOrder ? 'border-accentWarning/25 text-accentWarning' :
                                  isExam ? 'border-accentInfo/25 text-accentInfo' :
                                  'border-borderColor text-textMain'
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
