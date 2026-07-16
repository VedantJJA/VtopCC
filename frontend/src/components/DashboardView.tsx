import type { UseQueryResult } from '@tanstack/react-query';
import { TrendingUp, Clock, Loader2 } from 'lucide-react';

interface DashboardViewProps {
  attendanceQuery: UseQueryResult<any[], any>;
  timetableQuery: UseQueryResult<any, any>;
  TIMETABLE_SLOTS: any[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  attendanceQuery,
  timetableQuery,
  TIMETABLE_SLOTS
}) => {
  // Calculate overall attendance and on-duty counts
  const getAttendanceSummary = () => {
    if (!attendanceQuery.data || !Array.isArray(attendanceQuery.data)) {
      return { percentage: 0, od: 0, loading: attendanceQuery.isPending };
    }
    let totalAttended = 0;
    let totalClasses = 0;
    let odCount = 0;
    for (const course of attendanceQuery.data) {
      const attended = parseInt(course.attended, 10) || 0;
      const conducted = parseInt(course.conducted, 10) || 0;
      totalAttended += attended;
      totalClasses += conducted;
      if (course.on_duty) {
        odCount += parseInt(course.on_duty, 10) || 0;
      }
    }
    const percentage = totalClasses > 0 ? Math.floor((totalAttended / totalClasses) * 100) : 0;
    return { percentage, od: odCount, loading: false };
  };

  // Compute classes scheduled for today
  const getTodayClassesList = () => {
    if (!timetableQuery.data || !timetableQuery.data.timetable) {
      return { list: [], loading: timetableQuery.isPending };
    }
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayName = daysOfWeek[new Date().getDay()];
    const todayTimetable = timetableQuery.data.timetable[todayName] || {};
    
    const list = [];
    for (const slot of TIMETABLE_SLOTS) {
      if (slot.id === 'break') continue;
      const cellData = todayTimetable[slot.key];
      if (cellData) {
        const isLab = cellData.type?.includes('L') || cellData.type?.includes('Lab');
        list.push({
          slot: slot.name,
          time: isLab ? slot.labTime : slot.theoryTime,
          code: cellData.code,
          title: cellData.title,
          venue: cellData.venue
        });
      }
    }
    return { list, loading: false };
  };

  const attSum = getAttendanceSummary();
  const todayClasses = getTodayClassesList();

  return (
    <div className="space-y-6">
      {/* Dashboard stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Snapshot Card */}
        <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-textMain text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" /> Attendance Snapshot
            </h3>
            {attSum.loading ? (
              <div className="h-16 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-2">
                    <span className="text-textMuted">Average Attendance</span>
                    <span className="text-textMain font-bold">{attSum.percentage}%</span>
                  </div>
                  <div className="w-full bg-bgPrimary rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${attSum.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${attSum.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-borderColor/40">
                  <span className="text-textMuted">Total On-Duty (OD) Approved</span>
                  <span className="text-textMain font-bold">{attSum.od} Classes</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Today's Schedule Card */}
        <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm md:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-textMain text-lg mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" /> Today's Class Schedule
            </h3>
            {todayClasses.loading ? (
              <div className="h-24 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : todayClasses.list.length === 0 ? (
              <p className="text-sm text-textMuted italic py-4 text-center">No classes scheduled for today.</p>
            ) : (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {todayClasses.list.map((cls, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-bgPrimary rounded-xl border border-borderColor">
                    <div>
                      <div className="font-bold text-xs text-blue-600 dark:text-blue-400">{cls.code} - {cls.title}</div>
                      <div className="text-[10px] text-textMuted font-mono mt-0.5">{cls.time} | Venue: {cls.venue}</div>
                    </div>
                    <span className="text-[10px] font-bold bg-bgPrimary text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-md">{cls.slot}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
