import React, { useState, useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, TrendingUp, Award, Search, X } from 'lucide-react';

interface MarksViewProps {
  marksQuery: UseQueryResult<any, any>;
}

export const MarksView: React.FC<MarksViewProps> = ({ marksQuery }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const courses: any[] = marksQuery.data?.courses || [];
  const combinedScores: any[] = marksQuery.data?.combined_scores || [];

  // Summary Metrics
  const summary = useMemo(() => {
    if (!courses || courses.length === 0) return null;
    let totalObtained = 0;
    let totalMax = 0;

    courses.forEach((c) => {
      const ob = parseFloat(c.total_obtained || 0);
      const mx = parseFloat(c.total_max_weightage || 0);
      if (!isNaN(ob) && !isNaN(mx) && mx > 0) {
        totalObtained += ob;
        totalMax += mx;
      }
    });

    const avgPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
    return {
      totalCourses: courses.length,
      avgPct,
      totalObtained: totalObtained.toFixed(1),
      totalMax: totalMax.toFixed(1)
    };
  }, [courses]);

  // Filtered courses by search query
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase();
    return courses.filter((c) => 
      c.title?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.faculty?.toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

  if (marksQuery.isPending && !marksQuery.data) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-accentColor" />
        <p className="text-xs text-textMuted">Loading course marks and weightages...</p>
      </div>
    );
  }

  if (marksQuery.isError && !marksQuery.data) {
    return (
      <div className="p-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex gap-2.5 text-xs">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>Failed to fetch course marks. Please refresh.</span>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="bg-bgCard border border-borderColor rounded-2xl p-8 text-center space-y-2 shadow-xs">
        <TrendingUp className="h-12 w-12 text-textMuted mx-auto opacity-50" />
        <h4 className="font-bold text-textMain text-sm">No Marks Available</h4>
        <p className="text-xs text-textMuted">There are currently no active marks records for this semester.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. HERO MARKS SUMMARY BANNER */}
      {summary && (
        <div className="bg-bgCard border border-borderColor rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">
                Overall Assessment Performance
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-black text-textMain tracking-tight">
                  {summary.avgPct}%
                </span>
                <span className="text-xs font-semibold text-textMuted">
                  ({summary.totalObtained} / {summary.totalMax} Wt)
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-accentColor/10 text-accentColor border border-accentColor/20 text-xs font-bold">
                <Award className="h-3.5 w-3.5" />
                <span>{summary.totalCourses} Courses</span>
              </span>
            </div>
          </div>

          <div className="w-full bg-bgPrimary rounded-full h-2 overflow-hidden border border-borderColor/40">
            <div
              className="h-full bg-accentColor rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(Math.max(summary.avgPct, 0), 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. AGGREGATED COMBINED SUBJECT PERFORMANCE (IF ANY) */}
      {combinedScores.length > 0 && (
        <div className="bg-bgCard border border-borderColor rounded-2xl p-4 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-accentColor" />
            <span>Consolidated Subject Scores</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {combinedScores.map((cs: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-bgPrimary/60 border border-borderColor rounded-xl flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <span className="font-extrabold text-accentColor">{cs.code}</span>
                  <div className="text-[11px] font-semibold text-textMain line-clamp-1">{cs.title}</div>
                  <div className="text-[10px] text-textMuted">{cs.total_credits} Credits</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-textMain">
                    {cs.converted_score} / {cs.converted_max}
                  </div>
                  <span className="text-[10px] text-textMuted font-mono">Normalized</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. SEARCH FILTER */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-textMuted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter marks by subject code or title..."
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-borderColor bg-bgCard text-textMain placeholder:text-textMuted/60 text-xs font-semibold outline-none focus:border-accentColor transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-textMuted hover:text-textMain p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 4. COURSE MARKS CARDS (MOBILE-OPTIMIZED) */}
      <div className="space-y-4">
        {filteredCourses.map((course: any, cIdx: number) => {
          const obtained = parseFloat(course.total_obtained || 0);
          const maxWeight = parseFloat(course.total_max_weightage || 0);
          const progressPct = maxWeight > 0 ? Math.min(Math.round((obtained / maxWeight) * 100), 100) : 0;

          return (
            <div
              key={cIdx}
              className="bg-bgCard border border-borderColor rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5"
            >
              {/* Course Header */}
              <div className="flex items-start justify-between gap-3 border-b border-borderColor/60 pb-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] bg-accentColor/10 text-accentColor border border-accentColor/20 font-bold px-2 py-0.5 rounded-lg uppercase">
                      {course.code}
                    </span>
                    <span className="text-[10px] bg-bgPrimary text-textMuted border border-borderColor font-semibold px-2 py-0.5 rounded-lg">
                      {course.type}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-textMain leading-snug">
                    {course.title}
                  </h4>
                  {course.faculty && (
                    <p className="text-xs text-textMuted truncate">
                      {course.faculty}
                    </p>
                  )}
                </div>

                {/* Scored Weightage Badge */}
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider block">
                    Earned Wt
                  </span>
                  <span className="text-base font-black text-accentColor">
                    {course.total_obtained || '0'} / {course.total_max_weightage || '0'}
                  </span>
                </div>
              </div>

              {/* Course Total Weightage Bar */}
              <div className="w-full bg-bgPrimary rounded-full h-1.5 overflow-hidden border border-borderColor/30">
                <div
                  className="h-full bg-accentColor rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Assessment Rows (Mobile Card Layout) */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider block px-1">
                  Components ({course.assessments?.length || 0})
                </span>

                {course.assessments && course.assessments.length > 0 ? (
                  course.assessments.map((a: any, aIdx: number) => {
                    const scoredVal = parseFloat(a.scored);
                    const maxMarkVal = parseFloat(a.max_mark);
                    const isPresent = (a.status || '').toLowerCase() === 'present';
                    const scorePct = !isNaN(scoredVal) && !isNaN(maxMarkVal) && maxMarkVal > 0 
                      ? Math.min(Math.round((scoredVal / maxMarkVal) * 100), 100) 
                      : 0;

                    return (
                      <div
                        key={aIdx}
                        className="p-3 rounded-xl bg-bgPrimary/50 border border-borderColor/60 space-y-2 text-xs"
                      >
                        {/* Title & Status */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-textMain truncate">
                            {a.title}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${
                            isPresent 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                              : 'bg-bgCard text-textMuted border-borderColor'
                          }`}>
                            {a.status}
                          </span>
                        </div>

                        {/* Scored & Weightage Metrics */}
                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <div>
                            <span className="text-textMuted text-[11px]">Scored: </span>
                            <span className="font-bold text-textMain">
                              {a.scored || '-'} / {a.max_mark}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-textMuted text-[11px]">Weight: </span>
                            <span className="font-bold text-accentColor">
                              {a.weightage_mark || '-'} ({a.weightage_pct}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar for Assessment */}
                        {!isNaN(scoredVal) && maxMarkVal > 0 && (
                          <div className="w-full bg-bgCard rounded-full h-1 overflow-hidden border border-borderColor/20">
                            <div
                              className="h-full bg-accentColor/80 rounded-full"
                              style={{ width: `${scorePct}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-textMuted italic px-1">No component evaluations posted yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
