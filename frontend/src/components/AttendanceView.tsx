import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ChevronRight } from 'lucide-react';

interface AttendanceViewProps {
  attendanceQuery: UseQueryResult<any[], any>;
  selectedAttendanceCourse: any | null;
  setSelectedAttendanceCourse: (course: any | null) => void;
  attendanceDetailQuery: UseQueryResult<any[], any>;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  attendanceQuery,
  selectedAttendanceCourse,
  setSelectedAttendanceCourse,
  attendanceDetailQuery
}) => {
  return (
    <div className="space-y-6">
      {attendanceQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accentColor" />
        </div>
      ) : attendanceQuery.isError ? (
        <div className="p-4 bg-bgDanger text-accentDanger border border-accentDanger/20 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch attendance data. Please verify your connection.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {attendanceQuery.data.map((course: any, idx: number) => {
              const percent = parseFloat(course.percentage) || 0;
              const isSafe = percent >= 75;

              return (
                <div
                  key={idx}
                  className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-bgPrimary border border-borderColor font-bold px-2 py-0.5 rounded text-textMuted">{course.course_code}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isSafe
                          ? 'text-accentSuccess bg-bgSuccess border-accentSuccess/20'
                          : 'text-accentDanger bg-bgDanger border-accentDanger/20'
                        }`}>
                        {isSafe ? 'Attendance Safe' : 'Below 75%'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold line-clamp-1 text-textMain" title={course.course_title}>{course.course_title}</h4>
                    <p className="text-xs text-textMuted">{course.faculty}</p>
 
                    <div className="pt-2 flex justify-between items-end text-xs">
                      <div>
                        <span className="text-textMuted">Class Hours: </span>
                        <span className="font-bold text-textMain">{course.attended_classes}</span>
                        <span className="text-textMuted"> / </span>
                        <span className="font-bold text-textMain">{course.total_classes}</span>
                      </div>
                      <div className={`text-base font-black ${isSafe ? 'text-accentSuccess' : 'text-accentDanger'}`}>{course.percentage}%</div>
                    </div>
 
                    {/* Progress bar */}
                    <div className="w-full bg-bgPrimary h-2 rounded-full overflow-hidden mt-1 border border-borderColor">
                      <div
                        className={`h-full rounded-full ${isSafe ? 'bg-accentSuccess' : 'bg-accentDanger'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedAttendanceCourse(course)}
                    className="w-full py-2.5 mt-4 text-xs font-semibold bg-bgPrimary hover:bg-borderColor text-textMain border border-borderColor rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    View Attendance Log <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= ATTENDANCE HISTORY DRAWER/MODAL ================= */}
      {selectedAttendanceCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-end z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-bgCard h-full overflow-y-auto flex flex-col justify-between animate-slide-in shadow-xl p-6 md:p-8 border-l border-borderColor">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-borderColor pb-4">
                <div>
                  <span className="text-[10px] bg-bgPrimary border border-borderColor font-bold px-2 py-0.5 rounded text-textMuted uppercase">{selectedAttendanceCourse.course_code}</span>
                  <h3 className="text-lg font-bold text-textMain mt-1">{selectedAttendanceCourse.course_title}</h3>
                  <p className="text-xs text-textMuted mt-0.5">{selectedAttendanceCourse.faculty}</p>
                </div>
                <button
                  onClick={() => setSelectedAttendanceCourse(null)}
                  className="p-1 text-textMuted hover:text-textMain font-bold text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>              {/* Attendance Log Table */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-accentColor">Hourly Lecture History</h4>
 
                {attendanceDetailQuery.isPending ? (
                  <div className="h-32 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-accentColor" />
                  </div>
                ) : attendanceDetailQuery.isError ? (
                  <div className="p-4 bg-bgPrimary text-textMuted border border-borderColor rounded-2xl flex gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Failed to retrieve lecture history log.</span>
                  </div>
                ) : (
                  <div className="border border-borderColor rounded-2xl overflow-hidden text-xs">
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-bgPrimary border-b border-borderColor text-[10px] font-bold text-textMuted uppercase">
                            <th className="p-3">#</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Slot / Timing</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceDetailQuery.data?.map((log: any, logIdx: number) => {
                            const isPresent = log.status.toLowerCase() === 'present';
                            return (
                              <tr key={logIdx} className="border-b border-borderColor hover:bg-bgPrimary/55">
                                <td className="p-3 font-semibold text-textMuted">{log.sl_no}</td>
                                <td className="p-3 font-bold text-textMain">{log.date}</td>
                                <td className="p-3 text-textMain">
                                  <div>{log.slot}</div>
                                  <div className="text-[10px] text-textMuted mt-0.5">{log.timing}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${isPresent
                                      ? 'text-accentSuccess bg-bgSuccess border-accentSuccess/20'
                                      : 'text-accentDanger bg-bgDanger border-accentDanger/20'
                                    }`}>
                                    {log.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
 
            <button
              onClick={() => setSelectedAttendanceCourse(null)}
              className="w-full py-3 mt-6 bg-bgPrimary hover:bg-bgPrimary/85 text-textMain border border-borderColor font-semibold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close History Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
