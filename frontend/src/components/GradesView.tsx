import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';

interface GradesViewProps {
  gradesQuery: UseQueryResult<any, any>;
}

export const GradesView: React.FC<GradesViewProps> = ({ gradesQuery }) => {
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
              <div className="text-3xl font-black text-accentColor">{gradesQuery.data.gpa}</div>
            </div>
          )}

          {/* Grades Table */}
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
                  {gradesQuery.data?.grades?.map((g: any, index: number) => (
                    <tr key={index} className="border-b border-borderColor hover:bg-bgPrimary/55">
                      <td className="p-4 text-textMain">
                        <div className="font-extrabold text-accentColor">{g.code}</div>
                        <div className="font-semibold mt-0.5">{g.title}</div>
                      </td>
                      <td className="p-4 text-center text-textMuted">{g.type}</td>
                      <td className="p-4 text-center font-semibold text-textMain">{g.credits}</td>
                      <td className="p-4 text-center font-bold text-textMain">{g.total || '-'}</td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-accentColor bg-bgPrimary px-3 py-1 rounded-lg border border-borderColor">
                          {g.grade || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
