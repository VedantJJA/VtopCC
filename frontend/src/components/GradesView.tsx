import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, GraduationCap } from 'lucide-react';

interface GradesViewProps {
  gradesQuery: UseQueryResult<any, any>;
}

export const GradesView: React.FC<GradesViewProps> = ({ gradesQuery }) => {
  const getGradeStyle = (grade: string) => {
    const g = (grade || '').trim().toUpperCase();
    if (g === 'S') {
      return 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30';
    }
    if (g === 'A') {
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30';
    }
    if (g === 'B') {
      return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30';
    }
    if (g === 'C') {
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30';
    }
    // Rest (D, E, F, N, etc.)
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30';
  };

  return (
    <div className="space-y-6">
      {gradesQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : gradesQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch GPA / Course Grade details. Please refresh.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* GPA Top Banner */}
          {gradesQuery.data?.gpa && (
            <div className="p-6 bg-bgCard border border-borderColor rounded-3xl flex justify-between items-center shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">Academic Merit</span>
                <h3 className="text-lg font-black text-textMain">Cumulative Semester GPA</h3>
              </div>
              <div className="text-3xl font-black text-blue-600 dark:text-blue-500">{gradesQuery.data.gpa}</div>
            </div>
          )}

          {/* Grades Table or Empty Placeholder */}
          {gradesQuery.data?.grades && gradesQuery.data.grades.length > 0 ? (
            <div className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-bgPrimary border-b border-borderColor">
                      <th className="p-4 font-bold text-textMain">Course Info</th>
                      <th className="p-4 font-bold text-center text-textMain">Type</th>
                      <th className="p-4 font-bold text-center text-textMain">Credits</th>
                      <th className="p-4 font-bold text-center text-textMain">Total Marks</th>
                      <th className="p-4 font-bold text-center text-textMain">Grade Letter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradesQuery.data.grades.map((g: any, index: number) => (
                      <tr key={index} className="border-b border-borderColor hover:bg-bgPrimary/55">
                        <td className="p-4 text-textMain">
                          <div className="font-extrabold text-blue-600 dark:text-blue-500">{g.code}</div>
                          <div className="font-semibold mt-0.5">{g.title}</div>
                        </td>
                        <td className="p-4 text-center text-textMuted">{g.type}</td>
                        <td className="p-4 text-center font-semibold text-textMain">{g.credits}</td>
                        <td className="p-4 text-center font-bold text-textMain">{g.total || '-'}</td>
                        <td className="p-4 text-center">
                          <span className={`text-sm font-black px-3 py-1 rounded-lg ${getGradeStyle(g.grade)}`}>
                            {g.grade || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-bgCard border border-borderColor rounded-3xl p-8 text-center space-y-2 shadow-sm">
              <GraduationCap className="h-12 w-12 text-textMuted mx-auto" />
              <h4 className="font-bold text-textMain">No Grades Available</h4>
              <p className="text-xs text-textMuted">There are currently no active grades records for this semester.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
