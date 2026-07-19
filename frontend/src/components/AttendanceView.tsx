import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, ChevronRight, X, Clock } from 'lucide-react';

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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : attendanceQuery.isError || !attendanceQuery.data || attendanceQuery.data.length === 0 ? (
        <div className="p-8 bg-bgCard border border-borderColor rounded-3xl text-center space-y-2 shadow-sm">
          <Clock className="h-12 w-12 text-textMuted mx-auto" />
          <h4 className="font-bold text-textMain">Attendance Not Available</h4>
          <p className="text-xs text-textMuted">No attendance record found for this semester.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {attendanceQuery.data.map((course: any, idx: number) => {
            const percent = parseFloat(course.percentage) || 0;
            const isSafe = percent >= 75;

            return (
              <div
                key={idx}
                className="bg-bgCard border border-borderColor rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex justify-between items-stretch"
              >
                {/* Left Side: Course Info */}
                <div className="flex-1 flex flex-col justify-between pr-4 space-y-4">
                  <div className="space-y-2">
                    <h4 
                      className="text-base font-bold text-textMain leading-snug line-clamp-2" 
                      title={course.course_title}
                    >
                      {course.course_title}
                    </h4>
                    
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 font-bold px-2 py-0.5 rounded uppercase">
                        {course.course_code}
                      </span>
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded">
                        {course.slot}
                      </span>
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded">
                        {course.course_type}
                      </span>
                    </div>

                    <p className="text-xs text-textMuted line-clamp-1 mt-1" title={course.faculty}>
                      {course.faculty}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedAttendanceCourse(course)}
                    className="text-xs font-bold text-[#0f5cf5] hover:underline flex items-center gap-0.5 self-start cursor-pointer transition-colors"
                  >
                    View Details <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Right Side: Vertical Progress Bar */}
                <div className="flex flex-col items-center justify-center pl-4 border-l border-dashed border-borderColor shrink-0 w-20">
                  <div 
                    className={`relative h-24 w-3.5 rounded-full overflow-hidden flex items-end border border-borderColor/50 ${
                      isSafe ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-rose-50 dark:bg-rose-950/20'
                    }`}
                    title={`${course.percentage}%`}
                  >
                    <div
                      className={`w-full rounded-full transition-all duration-1000 ease-out ${
                        isSafe ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ height: `${percent}%` }}
                    />
                  </div>
                  
                  <div className="text-center mt-2.5">
                    <span className={`block font-bold text-sm leading-none ${
                      isSafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {course.percentage}%
                    </span>
                    <span className="block text-[10px] text-textMuted font-mono font-medium mt-1.5 whitespace-nowrap">
                      {course.attended_classes} / {course.total_classes}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
                  <span className="text-[10px] bg-blue-50 dark:bg-blue-900/25 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 font-bold px-2 py-0.5 rounded uppercase">
                    {selectedAttendanceCourse.course_code}
                  </span>
                  <h3 className="text-lg font-bold text-textMain mt-2 leading-snug">
                    {selectedAttendanceCourse.course_title}
                  </h3>
                  <p className="text-xs text-textMuted mt-1">
                    {selectedAttendanceCourse.faculty}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAttendanceCourse(null)}
                  className="p-1.5 text-textMuted hover:text-textMain border border-borderColor hover:bg-bgPrimary rounded-lg transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Attendance Log Table */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-[#0f5cf5] flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Hourly Lecture History
                </h4>

                {attendanceDetailQuery.isPending ? (
                  <div className="h-32 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : attendanceDetailQuery.isError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Failed to retrieve lecture history log.</span>
                  </div>
                ) : (
                  <div className="border border-borderColor rounded-xl overflow-hidden text-xs">
                    <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
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
                            const isOd = log.status.toLowerCase() === 'on duty' || log.status === 'On Duty';
                            
                            let badgeStyle = '';
                            if (isPresent) {
                              badgeStyle = 'bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400';
                            } else if (isOd) {
                              badgeStyle = 'bg-purple-50 dark:bg-purple-950/25 text-purple-600 dark:text-purple-400';
                            } else {
                              badgeStyle = 'bg-rose-50 dark:bg-rose-950/25 text-rose-600 dark:text-rose-400';
                            }

                            return (
                              <tr key={logIdx} className="border-b border-borderColor hover:bg-bgPrimary/30 transition-colors">
                                <td className="p-3 font-semibold text-textMuted">{log.sl_no}</td>
                                <td className="p-3 font-bold text-textMain">{log.date}</td>
                                <td className="p-3 text-textMain">
                                  <div>{log.slot}</div>
                                  <div className="text-[10px] text-textMuted mt-0.5">{log.timing}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${badgeStyle}`}>
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
              className="w-full py-3 mt-6 bg-[#0f5cf5] hover:bg-[#0d52db] text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
            >
              Close History Log
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
