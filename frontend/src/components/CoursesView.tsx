import React from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { BookOpen, User, MapPin, Clock, Award, Loader2 } from 'lucide-react';
import { getSubjectColor } from '../lib/utils';

interface CoursesViewProps {
  timetableQuery: UseQueryResult<any, any>;
  attendanceQuery?: UseQueryResult<any[], any>;
}

export const CoursesView: React.FC<CoursesViewProps> = ({ timetableQuery, attendanceQuery }) => {
  const courses: any[] = timetableQuery.data?.courses || [];

  // Map attendance by course code
  const attendanceMap: Record<string, any> = {};
  if (attendanceQuery?.data && Array.isArray(attendanceQuery.data)) {
    for (const item of attendanceQuery.data) {
      if (item.course_code) {
        attendanceMap[item.course_code] = item;
      }
    }
  }

  if (timetableQuery.isPending && !timetableQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-textMuted mt-3">Loading registered courses…</p>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="bg-bgCard border border-borderColor rounded-3xl p-12 text-center space-y-3 max-w-lg mx-auto my-12 shadow-sm animate-in fade-in duration-300">
        <BookOpen className="h-12 w-12 text-textMuted mx-auto" />
        <h3 className="font-bold text-textMain text-lg">No Registered Courses</h3>
        <p className="text-xs text-textMuted leading-relaxed">
          No registered course details were found for this semester.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bgCard border border-borderColor rounded-2xl p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-textMain">Registered Courses</h2>
          <p className="text-xs text-textMuted mt-0.5">
            {courses.length} {courses.length === 1 ? 'Subject' : 'Subjects'} enrolled this semester
          </p>
        </div>
        <div className="flex items-center gap-2 bg-bgPrimary border border-borderColor px-4 py-2 rounded-xl text-sm font-bold text-textMain self-start sm:self-auto">
          <Award className="h-4 w-4 text-accentColor" />
          <span>Total Credits: <strong className="text-accentColor font-black">{timetableQuery.data?.total_credits || '0'}</strong></span>
        </div>
      </div>

      {/* Grid of Subject Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course: any, idx: number) => {
          const colorClass = getSubjectColor(course.course_code || `course-${idx}`);
          const attInfo = attendanceMap[course.course_code];

          return (
            <div
              key={idx}
              className="bg-bgCard border border-borderColor rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-accentColor/40 transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${colorClass}`}>
                      {course.course_code}
                    </span>
                    {course.course_type && (
                      <span className="text-[10px] font-bold bg-bgPrimary border border-borderColor text-textMuted px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {course.course_type}
                      </span>
                    )}
                  </div>
                  {course.credits && (
                    <span className="text-[11px] font-bold text-textMuted font-mono">
                      {course.credits} {parseFloat(course.credits) === 1 ? 'Credit' : 'Credits'}
                    </span>
                  )}
                </div>

                {/* Course Title */}
                <h3 className="font-bold text-textMain text-base leading-snug line-clamp-2" title={course.course_title}>
                  {course.course_title}
                </h3>
              </div>

              <div className="space-y-3 border-t border-borderColor/60 pt-3 text-xs">
                {/* Faculty */}
                {course.faculty && (
                  <div className="flex items-start gap-2 text-textMuted">
                    <User className="h-3.5 w-3.5 text-accentColor shrink-0 mt-0.5" />
                    <span className="font-medium truncate" title={course.faculty}>{course.faculty}</span>
                  </div>
                )}

                {/* Slot & Venue */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {course.slot && (
                    <div className="flex items-center gap-1.5 bg-bgPrimary/60 border border-borderColor/40 px-2.5 py-1.5 rounded-lg">
                      <Clock className="h-3 w-3 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-textMain font-mono truncate">{course.slot}</span>
                    </div>
                  )}
                  {course.venue && (
                    <div className="flex items-center gap-1.5 bg-bgPrimary/60 border border-borderColor/40 px-2.5 py-1.5 rounded-lg">
                      <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                      <span className="font-semibold text-textMain truncate">{course.venue}</span>
                    </div>
                  )}
                </div>

                {/* Attendance bar if matching */}
                {attInfo && (
                  <div className="bg-bgPrimary/80 border border-borderColor/50 rounded-xl p-2.5 space-y-1 mt-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-textMuted">Attendance</span>
                      <span className={`${
                        parseFloat(attInfo.percentage) >= 75 ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {attInfo.percentage}% ({attInfo.attended_classes}/{attInfo.total_classes})
                      </span>
                    </div>
                    <div className="w-full bg-bgPrimary rounded-full h-1.5 overflow-hidden border border-borderColor/40">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          parseFloat(attInfo.percentage) >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(parseFloat(attInfo.percentage) || 0, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
