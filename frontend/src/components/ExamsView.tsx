import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';

interface ExamsViewProps {
  examsQuery: UseQueryResult<any[], any>;
}

export const ExamsView: React.FC<ExamsViewProps> = ({ examsQuery }) => {
  return (
    <div className="space-y-6">
      {examsQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accentColor" />
        </div>
      ) : examsQuery.isError ? (
        <div className="p-4 bg-bgDanger text-accentDanger border border-accentDanger/20 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>No exam schedules found or session timed out. Please retry.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {examsQuery.data.length === 0 ? (
            <div className="bg-bgCard border border-borderColor rounded-3xl p-8 text-center space-y-2 shadow-sm">
              <CalendarIcon className="h-12 w-12 text-textMuted mx-auto" />
              <h4 className="font-bold text-textMain">No Exams Scheduled</h4>
              <p className="text-xs text-textMuted">There are currently no active exam schedules for this semester.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {examsQuery.data.map((exam: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-bgInfo text-accentInfo font-bold px-2 py-0.5 rounded border border-accentInfo/25">{exam.exam_type}</span>
                      <span className="text-[10px] bg-bgPrimary border border-borderColor text-textMuted font-bold px-2 py-0.5 rounded">{exam.course_code}</span>
                    </div>
                    <h4 className="text-base font-bold text-textMain">{exam.course_title}</h4>
 
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
                      <div><div className="text-textMuted mb-0.5">Date</div><div className="font-bold text-textMain">{exam.exam_date}</div></div>
                      <div><div className="text-textMuted mb-0.5">Session</div><div className="font-bold font-mono text-textMain">{exam.exam_session}</div></div>
                      <div><div className="text-textMuted mb-0.5">Time</div><div className="font-bold text-textMain">{exam.exam_time}</div></div>
                      <div><div className="text-textMuted mb-0.5 font-bold text-accentInfo">Venue</div><div className="font-extrabold font-mono text-accentInfo">{exam.venue}</div></div>
                    </div>
                  </div>
 
                  {/* Seating Location info box */}
                  <div className="bg-bgPrimary border border-borderColor rounded-2xl p-4 md:w-56 shrink-0 flex flex-col justify-center space-y-2.5 text-xs text-center">
                    <div>
                      <span className="text-textMuted font-semibold">Seat Number</span>
                      <div className="text-lg font-black text-textMain mt-0.5">{exam.seat_no || 'N/A'}</div>
                    </div>
                    <div className="border-t border-borderColor pt-2">
                      <span className="text-textMuted font-semibold">Room / Location</span>
                      <div className="font-bold text-accentInfo mt-0.5">{exam.seat_location || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
