import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react';

interface MarksViewProps {
  marksQuery: UseQueryResult<any, any>;
}

export const MarksView: React.FC<MarksViewProps> = ({ marksQuery }) => {
  return (
    <div className="space-y-6">
      {marksQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : marksQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch course marks. Please refresh.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Estimated Consolidated Scores summary (if combined scores exist) */}
          {marksQuery.data?.combined_scores?.length > 0 && (
            <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                <h3 className="text-sm font-bold text-textMain">Aggregated Subject Performance</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {marksQuery.data.combined_scores.map((cs: any, idx: number) => (
                  <div key={idx} className="p-4 bg-bgPrimary border border-borderColor rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-extrabold text-blue-600 dark:text-blue-500">{cs.code}</span>
                      <div className="text-[10px] text-textMuted mt-0.5 line-clamp-1">{cs.title}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-textMain">{cs.converted_score} / {cs.converted_max}</div>
                      <div className="text-[9px] text-textMuted">Total Credits: {cs.total_credits}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw assessments tables list or Empty Placeholder */}
          {marksQuery.data?.courses && marksQuery.data.courses.length > 0 ? (
            <div className="space-y-6">
              {marksQuery.data.courses.map((course: any, idx: number) => (
                <div key={idx} className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-start border-b border-borderColor pb-3">
                    <div>
                      <span className="text-[10px] bg-bgPrimary border border-borderColor font-bold px-2 py-0.5 rounded text-textMuted uppercase">{course.code} ({course.type})</span>
                      <h4 className="text-base font-bold text-textMain mt-1.5">{course.title}</h4>
                      <p className="text-xs text-textMuted mt-0.5">{course.faculty}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-textMuted font-medium">Scored / Target Weightage</span>
                      <div className="text-lg font-black text-blue-600 dark:text-blue-500">{course.total_obtained} / {course.total_max_weightage}</div>
                    </div>
                  </div>

                  {/* Assessments Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-textMuted font-bold border-b border-borderColor/40">
                          <th className="py-2.5">Assessment Name</th>
                          <th className="py-2.5 text-center">Max Mark</th>
                          <th className="py-2.5 text-center">Scored</th>
                          <th className="py-2.5 text-center">Weightage %</th>
                          <th className="py-2.5 text-center">Earned Wt</th>
                          <th className="py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {course.assessments.map((a: any, aIdx: number) => (
                          <tr key={aIdx} className="border-b border-borderColor/20 hover:bg-bgPrimary/40">
                            <td className="py-2.5 font-semibold text-textMain">{a.title}</td>
                            <td className="py-2.5 text-center text-textMain">{a.max_mark}</td>
                            <td className="py-2.5 text-center font-bold text-textMain">{a.scored || '-'}</td>
                            <td className="py-2.5 text-center text-textMain">{a.weightage_pct}%</td>
                            <td className="py-2.5 text-center font-bold text-blue-600 dark:text-blue-400">{a.weightage_mark || '-'}</td>
                            <td className="py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status.toLowerCase() === 'present'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-bgPrimary border border-borderColor text-textMuted'
                                }`}>{a.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-bgCard border border-borderColor rounded-3xl p-8 text-center space-y-2 shadow-sm">
              <TrendingUp className="h-12 w-12 text-textMuted mx-auto" />
              <h4 className="font-bold text-textMain">No Marks Available</h4>
              <p className="text-xs text-textMuted">There are currently no active marks records for this semester.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
