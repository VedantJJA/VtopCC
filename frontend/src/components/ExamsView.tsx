import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';

interface ExamsViewProps {
  examsQuery: UseQueryResult<any[], any>;
}

export const ExamsView: React.FC<ExamsViewProps> = ({ examsQuery }) => {
  const exams = examsQuery.data || [];

  // Group by exam_type
  const groupedExams = exams.reduce((acc: Record<string, any[]>, exam: any) => {
    const type = exam.exam_type || 'Unknown Exam';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(exam);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {examsQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : examsQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>No exam schedules found or session timed out. Please retry.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {exams.length === 0 ? (
            <div className="bg-bgCard border border-borderColor rounded-3xl p-8 text-center space-y-2 shadow-sm">
              <CalendarIcon className="h-12 w-12 text-textMuted mx-auto" />
              <h4 className="font-bold text-textMain">No Exams Scheduled</h4>
              <p className="text-xs text-textMuted">There are currently no active exam schedules for this semester.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.keys(groupedExams).map((examType: string) => (
                <div key={examType} className="space-y-4">
                  <h3 className="text-lg font-bold text-textMain border-b border-borderColor pb-2 flex items-center justify-between animate-in slide-in-from-left duration-250">
                    <span>{examType}</span>
                    <span className="text-xs bg-bgPrimary px-2.5 py-1 border border-borderColor rounded-md text-textMuted font-bold">
                      {groupedExams[examType].length} {groupedExams[examType].length === 1 ? 'Exam' : 'Exams'}
                    </span>
                  </h3>

                  <div className="grid grid-cols-1 gap-6">
                    {groupedExams[examType].map((exam: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm flex flex-col md:flex-row justify-between gap-6 hover:border-accentColor/40 transition-all duration-200"
                      >
                        <div className="space-y-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/30">
                              {exam.course_type}
                            </span>
                            <span className="text-[10px] bg-bgPrimary border border-borderColor text-textMuted font-bold px-2 py-0.5 rounded">
                              {exam.course_code}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-textMain">{exam.course_title}</h4>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
                            <div>
                              <div className="text-textMuted mb-0.5">Date</div>
                              <div className="font-bold text-textMain">{exam.exam_date}</div>
                            </div>
                            <div>
                              <div className="text-textMuted mb-0.5">Session</div>
                              <div className="font-bold font-mono text-textMain">{exam.exam_session}</div>
                            </div>
                            <div>
                              <div className="text-textMuted mb-0.5">Time</div>
                              <div className="font-bold text-textMain">{exam.exam_time}</div>
                            </div>
                            <div>
                              <div className="text-textMuted mb-0.5 font-bold text-blue-600 dark:text-blue-500">Venue</div>
                              <div className="font-extrabold font-mono text-blue-600 dark:text-blue-500">{exam.venue}</div>
                            </div>
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
                            <div className="font-bold text-blue-600 dark:text-blue-400 mt-0.5">{exam.seat_location || 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
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
