import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, Shield, AlertTriangle } from 'lucide-react';
import { getAdminStats } from '../lib/api';

export const AdminView: React.FC = () => {
  const statsQuery = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await getAdminStats();
      return res.data;
    },
    refetchInterval: 15000 // Refresh every 15 seconds
  });

  if (statsQuery.isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-in fade-in duration-300">
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-textMuted mt-3">Loading admin stats…</p>
      </div>
    );
  }

  if (statsQuery.isError) {
    return (
      <div className="max-w-2xl mx-auto py-12 animate-in fade-in duration-300">
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-600">Access Denied</h3>
            <p className="text-xs text-rose-500 mt-1">
              You do not have admin privileges to view this page. If you believe this is an error,
              contact the administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const data = statsQuery.data;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-extrabold text-textMain">Admin Panel</h2>
        </div>
        <p className="text-sm text-textMuted mt-1">Server statistics and user management.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-bgCard border border-borderColor rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-textMain">{data?.totalUsers ?? 0}</p>
              <p className="text-xs text-textMuted font-medium">Total Unique Users</p>
            </div>
          </div>
        </div>

        <div className="bg-bgCard border border-borderColor rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-textMain">Active</p>
              <p className="text-xs text-textMuted font-medium">Server Status</p>
            </div>
          </div>
        </div>
      </div>

      {/* User List Table */}
      <div className="bg-bgCard border border-borderColor rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-borderColor">
          <h3 className="text-sm font-bold text-textMain uppercase tracking-wider">Registered Users</h3>
          <p className="text-xs text-textMuted mt-0.5">All roll numbers that have logged in during this server session.</p>
        </div>
        {!data?.users || data.users.length === 0 ? (
          <div className="p-8 text-center text-xs text-textMuted">
            No users have logged in yet.
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-bgPrimary border-b border-borderColor">
                <tr>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-textMuted uppercase tracking-wider">#</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-textMuted uppercase tracking-wider">Roll Number</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-textMuted uppercase tracking-wider">First Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderColor">
                {data.users.map((user: any, i: number) => (
                  <tr key={user.rollNumber} className="hover:bg-bgPrimary/40 transition-colors">
                    <td className="px-5 py-3 text-xs text-textMuted font-mono">{i + 1}</td>
                    <td className="px-5 py-3 text-xs font-bold text-textMain font-mono">{user.rollNumber}</td>
                    <td className="px-5 py-3 text-xs text-textMuted">
                      {user.firstSeen !== 'unknown'
                        ? new Date(user.firstSeen).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
