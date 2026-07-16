import React, { useState, useEffect } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface AttendanceCalculatorProps {
  attendanceQuery: UseQueryResult<any[], any>;
}

export const AttendanceCalculator: React.FC<AttendanceCalculatorProps> = ({ attendanceQuery }) => {
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [attended, setAttended] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [target, setTarget] = useState<number>(75);

  const courses = attendanceQuery.data || [];

  // When selected course changes, update inputs
  useEffect(() => {
    if (selectedCourseCode) {
      const course = courses.find(c => c.course_code === selectedCourseCode);
      if (course) {
        setAttended(parseInt(course.attended_classes, 10) || 0);
        setTotal(parseInt(course.total_classes, 10) || 0);
      }
    }
  }, [selectedCourseCode, courses]);

  // Calculations
  const currentPercentage = total > 0 ? Math.round((attended / total) * 10000) / 100 : 0;
  
  let resultMessage = '';
  let statusType: 'success' | 'warning' | 'error' = 'success';

  if (total === 0) {
    resultMessage = 'Enter total and attended lectures to calculate.';
    statusType = 'warning';
  } else if (currentPercentage >= target) {
    // Calculate how many they can miss
    // (attended) / (total + x) >= target / 100
    // attended >= (target/100) * (total + x)
    // (attended * 100 / target) - total >= x
    const maxMiss = Math.floor((attended * 100) / target) - total;
    if (maxMiss > 0) {
      resultMessage = `You are safe! You can miss up to ${maxMiss} classes consecutively and remain above ${target}%.`;
      statusType = 'success';
    } else {
      resultMessage = `You are exactly at or slightly above target. You cannot afford to miss the next class!`;
      statusType = 'warning';
    }
  } else {
    // Calculate how many they must attend consecutively
    // (attended + x) / (total + x) >= target / 100
    // 100 * attended + 100 * x >= target * total + target * x
    // x * (100 - target) >= target * total - 100 * attended
    // x = ceil( (target * total - 100 * attended) / (100 - target) )
    if (target === 100) {
      resultMessage = `To reach 100% attendance, you must attend all future classes without miss, but you have already missed some.`;
      statusType = 'error';
    } else {
      const reqClasses = Math.ceil((target * total - 100 * attended) / (100 - target));
      resultMessage = `You need to attend the next ${reqClasses} classes consecutively to reach ${target}%.`;
      statusType = 'error';
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-textMain">Attendance Calculator</h2>
          <p className="text-sm text-textMuted mt-1">Simulate class thresholds to plan leaves safely.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection / Input Panel */}
        <div className="lg:col-span-1 bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-accentColor border-b border-borderColor pb-2">Simulation Parameters</h3>

          <div>
            <label className="block text-xs font-bold text-textMuted mb-1.5 uppercase tracking-wide">Select Course</label>
            <select
              value={selectedCourseCode}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
              className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-600 text-textMain cursor-pointer"
            >
              <option value="">-- Select Course --</option>
              {courses.map(c => (
                <option key={c.course_code} value={c.course_code}>
                  {c.course_code} - {c.course_title} ({c.course_type})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-textMuted mb-1.5 uppercase tracking-wide">Attended</label>
              <input
                type="number"
                min="0"
                value={attended}
                onChange={(e) => setAttended(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 text-textMain"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-textMuted mb-1.5 uppercase tracking-wide">Total Lectures</label>
              <input
                type="number"
                min="0"
                value={total}
                onChange={(e) => setTotal(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-3 py-2 bg-bgPrimary border border-borderColor rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-600 text-textMain"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-textMuted mb-1.5 uppercase tracking-wide">
              <span>Target Attendance</span>
              <span className="text-accentColor font-mono">{target}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-bgPrimary border border-borderColor rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        {/* Results Screen */}
        <div className="lg:col-span-2 bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-accentColor border-b border-borderColor pb-2 mb-6">Calculation Results</h3>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="p-4 bg-bgPrimary border border-borderColor rounded-2xl text-center">
                <div className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1">Current Attendance</div>
                <div className={`text-3xl font-black ${currentPercentage >= target ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {currentPercentage}%
                </div>
              </div>
              <div className="p-4 bg-bgPrimary border border-borderColor rounded-2xl text-center">
                <div className="text-[10px] font-bold text-textMuted uppercase tracking-wider mb-1">Status</div>
                <div className={`text-xs font-bold mt-2.5 px-3 py-1 rounded-full inline-block ${
                  currentPercentage >= target
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 border border-rose-200 dark:border-rose-900/50'
                }`}>
                  {currentPercentage >= target ? 'Safe' : 'Critical'}
                </div>
              </div>
            </div>
          </div>

          <div className={`p-5 rounded-2xl border text-sm flex gap-3 items-start animate-in fade-in duration-300 ${
            statusType === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
              : statusType === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
          }`}>
            {statusType === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : statusType === 'warning' ? (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            ) : (
              <X className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5 bg-rose-100 dark:bg-rose-950 rounded-full p-0.5" />
            )}
            <div className="font-semibold leading-relaxed">{resultMessage}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
