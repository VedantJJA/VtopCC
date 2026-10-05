import React, { useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, GraduationCap } from 'lucide-react';

interface GradesViewProps {
  gradesQuery: UseQueryResult<any, any>;
}

export const GradesView: React.FC<GradesViewProps> = ({ gradesQuery }) => {
  const getGradeStyle = (grade: string) => {
    const g = (grade || '').trim().toUpperCase();
    if (g === 'S') {
      return 'text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/30';
    }
    if (g === 'A') {
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
    if (g === 'B') {
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    }
    if (g === 'C') {
      return 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
    return 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const grades: any[] = gradesQuery.data?.grades || [];
  const gpa = gradesQuery.data?.gpa;

  // Grade breakdown stats
  const stats = useMemo(() => {
    if (!grades || grades.length === 0) return null;
    let totalCredits = 0;
    const gradeCounts: Record<string, number> = {};

    grades.forEach((g) => {
      const cr = parseFloat(g.credits || 0);
      if (!isNaN(cr)) totalCredits += cr;
      const letter = (g.grade || 'N/A').toUpperCase();
      gradeCounts[letter] = (gradeCounts[letter] || 0) + 1;
    });

    return {
      totalCourses: grades.length,
      totalCredits: totalCredits.toFixed(1),
      gradeCounts
    };
  }, [grades]);

  if (gradesQuery.isPending && !gradesQuery.data) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-accentColor" />
        <p className="text-xs text-textMuted">Loading course grades and GPA...</p>
      </div>
    );
  }

  if (gradesQuery.isError && !gradesQuery.data) {
    return (
      <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex gap-2.5 text-xs">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>Failed to fetch GPA / Course Grade details. Please refresh.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. HERO GPA & MERIT BANNER */}
      {gpa && (
        <div className="bg-bgCard border border-borderColor rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
                Academic Standing
              </span>
              <h3 className="text-sm font-bold text-textMain mt-0.5">
                Cumulative Grade Point Average
              </h3>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-accentColor tracking-tight">
                {gpa}
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {stats && (
            <div className="pt-2 border-t border-borderColor/60 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-textMuted font-medium">
                Total Credits: <strong className="text-textMain font-bold">{stats.totalCredits}</strong>
              </span>

              {/* Grade distribution chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['S', 'A', 'B'].map((letter) => {
                  const count = stats.gradeCounts[letter] || 0;
                  if (count === 0) return null;
                  return (
                    <span
                      key={letter}
                      className="px-2 py-0.5 rounded-md bg-bgPrimary border border-borderColor text-[10px] font-bold text-textMain"
                    >
                      {count} {letter}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. COURSE GRADE CARDS (MOBILE-OPTIMIZED) */}
      {grades.length > 0 ? (
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block px-1">
            Graded Courses ({grades.length})
          </span>

          {grades.map((g: any, index: number) => {
            const gradeLetter = (g.grade || '-').trim();
            const gradeStyle = getGradeStyle(gradeLetter);

            return (
              <div
                key={index}
                className="bg-bgCard border border-borderColor rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3 hover:border-accentColor/40 transition-all"
              >
                {/* Left: Course Info */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] bg-accentColor/10 text-accentColor border border-accentColor/20 font-bold px-2 py-0.5 rounded-lg uppercase">
                      {g.code}
                    </span>
                    <span className="text-[10px] bg-bgPrimary text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded-lg">
                      {g.type}
                    </span>
                    <span className="text-[10px] bg-bgPrimary text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded-lg">
                      {g.credits} Credits
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-textMain leading-snug line-clamp-2 pt-0.5">
                    {g.title}
                  </h4>

                  {g.total && (
                    <p className="text-[11px] text-textMuted font-mono">
                      Total Marks: <span className="font-bold text-textMain">{g.total}</span>
                    </p>
                  )}
                </div>

                {/* Right: Large Grade Letter Badge */}
                <div className="shrink-0 text-center">
                  <div className={`h-12 w-12 rounded-xl border flex items-center justify-center font-black text-xl shadow-xs ${gradeStyle}`}>
                    {gradeLetter}
                  </div>
                  <span className="text-[9px] text-textMuted uppercase font-bold tracking-wider mt-1 block">
                    Grade
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-bgCard border border-borderColor rounded-2xl p-8 text-center space-y-2 shadow-xs">
          <GraduationCap className="h-12 w-12 text-textMuted mx-auto opacity-50" />
          <h4 className="font-bold text-textMain text-sm">No Grades Available</h4>
          <p className="text-xs text-textMuted">There are currently no active grades records for this semester.</p>
        </div>
      )}
    </div>
  );
};
