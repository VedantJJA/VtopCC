import React, { useState, useEffect } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ArrowRight, Calendar, Calculator } from 'lucide-react';

interface AttendanceCalculatorProps {
  attendanceQuery: UseQueryResult<any[], any>;
  timetableQuery: UseQueryResult<any, any>;
}

export const AttendanceCalculator: React.FC<AttendanceCalculatorProps> = ({ 
  attendanceQuery,
  timetableQuery
}) => {
  const [activeTab, setActiveTab] = useState<'subject' | 'days'>('subject');

  // Tab 1: Subject Wise States
  const [selectedCourseIdx, setSelectedCourseIdx] = useState<string>('');
  const [attendNext, setAttendNext] = useState<number>(0);
  const [missNext, setMissNext] = useState<number>(0);

  // Tab 2: Days / Dates States
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dayStatus, setDayStatus] = useState<'present' | 'absent'>('present');
  const [daysPrediction, setDaysPrediction] = useState<any[]>([]);
  const [hasCalculatedDays, setHasCalculatedDays] = useState<boolean>(false);

  const courses = attendanceQuery.data || [];

  // Initialize selected course index
  useEffect(() => {
    if (courses.length > 0 && selectedCourseIdx === '') {
      setSelectedCourseIdx('0');
    }
  }, [courses, selectedCourseIdx]);

  // Reset calculator states when tab changes
  useEffect(() => {
    setAttendNext(0);
    setMissNext(0);
  }, [activeTab]);

  // Subject Wise Calculations
  const getSubjectPrediction = () => {
    const idx = parseInt(selectedCourseIdx, 10);
    const course = courses[idx];
    if (!course) return null;

    let multiplier = 1;
    const isLab = course.course_type?.toUpperCase().includes('LAB');
    if (isLab) {
      multiplier = 2;
    }

    const attend = attendNext * multiplier;
    const miss = missNext * multiplier;

    const currentAttended = parseInt(course.attended_classes, 10) || 0;
    const currentTotal = parseInt(course.total_classes, 10) || 0;

    const newAttended = currentAttended + attend;
    const newTotal = currentTotal + attend + miss;
    const newPerc = newTotal > 0 ? (Math.floor((newAttended / newTotal * 100) * 100) / 100).toFixed(2) : '0.00';
    const isSafe = parseFloat(newPerc) >= 75;

    return {
      course,
      isLab,
      currentAttended,
      currentTotal,
      currentPerc: course.percentage,
      newAttended,
      newTotal,
      newPerc,
      isSafe
    };
  };

  const subjectPrediction = getSubjectPrediction();

  // Days/Dates calculations
  const calculateDaysPrediction = () => {
    if (!startDate || !endDate) {
      alert("Please select dates.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      alert("Start Date must be before or equal to End Date.");
      return;
    }

    const timetable = timetableQuery.data?.timetable || {};
    // Deep clone attendance summaries
    const tempAttendance = JSON.parse(JSON.stringify(courses));
    const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayName = dayMap[d.getDay()];
      const daySchedule = timetable[dayName];
      if (daySchedule) {
        // Find all unique course codes in schedule for this day
        const coursesInDay = new Set<string>();
        Object.values(daySchedule).forEach((slot: any) => {
          if (slot.code) coursesInDay.add(slot.code);
        });

        coursesInDay.forEach(code => {
          const courseIdx = tempAttendance.findIndex((c: any) => c.course_code === code);
          if (courseIdx !== -1) {
            let classesInDay = 0;
            Object.values(daySchedule).forEach((s: any) => {
              if (s.code === code) classesInDay++;
            });

            // Lab minimum slot multiplier
            const isLab = tempAttendance[courseIdx].course_type?.toUpperCase().includes('LAB');
            if (isLab && classesInDay < 2) {
              classesInDay = 2;
            }

            tempAttendance[courseIdx].total_classes = (parseInt(tempAttendance[courseIdx].total_classes, 10) || 0) + classesInDay;
            if (dayStatus === 'present') {
              tempAttendance[courseIdx].attended_classes = (parseInt(tempAttendance[courseIdx].attended_classes, 10) || 0) + classesInDay;
            }
          }
        });
      }
    }

    const list: any[] = [];
    tempAttendance.forEach((course: any) => {
      const original = courses.find(c => c.course_code === course.course_code);
      if (original && parseInt(original.total_classes, 10) !== parseInt(course.total_classes, 10)) {
        const total = parseInt(course.total_classes, 10);
        const newPerc = total > 0 ? (Math.floor((course.attended_classes / total * 100) * 100) / 100).toFixed(2) : '0.00';
        
        list.push({
          courseCode: course.course_code,
          courseTitle: course.course_title,
          originalPerc: original.percentage,
          originalRatio: `${original.attended_classes}/${original.total_classes}`,
          newPerc,
          newRatio: `${course.attended_classes}/${course.total_classes}`
        });
      }
    });

    setDaysPrediction(list);
    setHasCalculatedDays(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-borderColor pb-4">
        <div>
          <h2 className="text-2xl font-bold text-textMain">Attendance Calculator</h2>
          <p className="text-sm text-textMuted mt-1">Predict how upcoming lectures or leaves impact your score.</p>
        </div>
      </div>

      <div className="bg-bgCard rounded-xl shadow-sm border border-borderColor overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-borderColor bg-bgPrimary/30">
          <button
            onClick={() => setActiveTab('subject')}
            className={`flex-1 py-4 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'subject'
                ? 'text-[#0f5cf5] border-b-2 border-[#0f5cf5] bg-bgCard'
                : 'text-textMuted hover:text-textMain'
            }`}
          >
            <Calculator className="h-4 w-4" /> Subject Wise
          </button>
          <button
            onClick={() => setActiveTab('days')}
            className={`flex-1 py-4 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'days'
                ? 'text-[#0f5cf5] border-b-2 border-[#0f5cf5] bg-bgCard'
                : 'text-textMuted hover:text-textMain'
            }`}
          >
            <Calendar className="h-4 w-4" /> Days / Dates
          </button>
        </div>

        {/* 1. Subject Wise View */}
        {activeTab === 'subject' && (
          <div className="p-6 space-y-6">
            {courses.length === 0 ? (
              <div className="p-8 text-center text-textMuted italic">No course summaries loaded.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-textMuted mb-2 uppercase tracking-wide">Select Subject</label>
                    <select
                      value={selectedCourseIdx}
                      onChange={(e) => setSelectedCourseIdx(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-[#0f5cf5] focus:outline-none text-xs font-semibold cursor-pointer"
                    >
                      {courses.map((course, idx) => (
                        <option key={course.course_code} value={idx}>
                          {course.course_code} - {course.course_title}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-textMuted mb-2 uppercase tracking-wide">Attend Next (Sessions)</label>
                      <input
                        type="number"
                        min="0"
                        value={attendNext || ''}
                        onChange={(e) => setAttendNext(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full p-2 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-[#0f5cf5] focus:outline-none text-xs font-bold text-center"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-textMuted mb-2 uppercase tracking-wide">Miss Next (Sessions)</label>
                      <input
                        type="number"
                        min="0"
                        value={missNext || ''}
                        onChange={(e) => setMissNext(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full p-2 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-[#0f5cf5] focus:outline-none text-xs font-bold text-center"
                      />
                    </div>
                  </div>
                </div>

                {subjectPrediction && (
                  <div className="p-5 bg-bgPrimary/40 border border-borderColor rounded-xl space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <span className="text-xs text-textMuted font-medium uppercase tracking-wide">Current Metrics</span>
                        <div className="text-sm font-bold text-textMain mt-1">
                          {subjectPrediction.currentPerc}% ({subjectPrediction.currentAttended}/{subjectPrediction.currentTotal} Hours)
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-textMuted font-medium uppercase tracking-wide">Predicted Attendance</span>
                        <span className={`text-lg font-black ${subjectPrediction.isSafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {subjectPrediction.newPerc}% <span className="text-xs text-textMuted font-medium font-mono">({subjectPrediction.newAttended}/{subjectPrediction.newTotal})</span>
                        </span>
                        {subjectPrediction.isLab && (
                          <span className="text-[9px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 px-1.5 py-0.5 rounded uppercase">
                            Lab (x2)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border flex gap-3 items-start text-xs ${
                      subjectPrediction.isSafe
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-300'
                    }`}>
                      {subjectPrediction.isSafe ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                      )}
                      <div className="font-semibold leading-relaxed">
                        {subjectPrediction.isSafe
                          ? `With this prediction, your attendance is SAFE at ${subjectPrediction.newPerc}%, which is above the 75% requirement.`
                          : `WARNING: Your predicted attendance of ${subjectPrediction.newPerc}% falls below the mandatory 75% registration limit.`
                        }
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 2. Days / Dates View */}
        {activeTab === 'days' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-textMuted mb-2 uppercase tracking-wide">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-[#0f5cf5] focus:outline-none text-xs font-semibold cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-textMuted mb-2 uppercase tracking-wide">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-[#0f5cf5] focus:outline-none text-xs font-semibold cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-textMuted mb-2 uppercase tracking-wide">Leave Status</label>
                <select
                  value={dayStatus}
                  onChange={(e) => setDayStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-borderColor bg-bgPrimary text-textMain focus:ring-1 focus:ring-[#0f5cf5] focus:outline-none text-xs font-semibold cursor-pointer"
                >
                  <option value="present">Attend All Classes</option>
                  <option value="absent">Miss All Classes</option>
                </select>
              </div>
            </div>

            <button
              onClick={calculateDaysPrediction}
              className="w-full md:w-auto px-6 py-2.5 bg-[#0f5cf5] hover:bg-[#0d52db] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              Calculate Prediction
            </button>

            {hasCalculatedDays && (
              <div className="pt-4 border-t border-borderColor space-y-4">
                <h4 className="text-sm font-bold text-textMain">Predicted Impact on Courses</h4>
                {daysPrediction.length === 0 ? (
                  <p className="text-sm text-textMuted italic text-center py-6">
                    No classes found in schedule for these dates.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {daysPrediction.map((p, idx) => {
                      const isSafe = parseFloat(p.newPerc) >= 75;
                      return (
                        <div
                          key={idx}
                          className="bg-bgPrimary/30 border border-borderColor p-4 rounded-lg flex justify-between items-center shadow-xs"
                        >
                          <div className="overflow-hidden pr-2">
                            <p className="font-bold text-xs text-textMain truncate" title={p.courseTitle}>
                              {p.courseCode} - {p.courseTitle}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-textMuted mt-1">
                              <span>{p.originalPerc}%</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span className={`font-bold ${isSafe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {p.newPerc}%
                              </span>
                            </div>
                          </div>
                          <div className="text-xs font-mono text-textMuted shrink-0 text-right">
                            <span className="block font-semibold text-textMain">{p.newRatio}</span>
                            <span className="block text-[10px] opacity-75 mt-0.5">({p.originalRatio})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
