import React from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { DoorOpen, Building, Bed, Utensils, Loader2, AlertTriangle, CalendarClock } from 'lucide-react';

interface HostelViewProps {
  profileQuery: UseQueryResult<any, any>;
  leavesQuery?: UseQueryResult<any[], any>; // Added leaves query
}

export const HostelView: React.FC<HostelViewProps> = ({ profileQuery, leavesQuery }) => {
  const hostel = profileQuery.data?.hostel || {};

  const stats = [
    { label: 'Room No', value: hostel.room || 'N/A', icon: DoorOpen },
    { label: 'Block', value: hostel.block || 'N/A', icon: Building },
    { label: 'Type', value: hostel.bed_type || 'N/A', icon: Bed },
    { label: 'Mess', value: hostel.mess || 'N/A', icon: Utensils },
  ];

  // Helper for status badge colors
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('approved')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (s.includes('rejected')) return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    if (s.includes('pending')) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-bgPrimary text-textMuted border-borderColor';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {profileQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : profileQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to load hostel details from profile. Please check connection.</span>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-textMain">Hostel & Mess</h2>
              <p className="text-xs sm:text-sm text-textMuted mt-1">Hostel allotment details and leave records.</p>
            </div>
          </div>

          {/* 2x2 or 4-col Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-bgCard rounded-xl p-4 sm:p-5 shadow-sm border border-borderColor flex flex-col justify-center items-center text-center hover:border-accentColor/40 transition-all duration-200">
                <span className="text-[10px] sm:text-[11px] font-bold text-textMuted uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <stat.icon className="w-3.5 h-3.5 text-accentColor" /> {stat.label}
                </span>
                <span className="text-lg sm:text-2xl font-black text-accentColor truncate max-w-full">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Allotment Summary Card */}
          <div className="bg-bgCard border border-borderColor rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-textMain flex items-center gap-2">
              <Building className="h-4 w-4 text-accentColor" /> Allotment Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between p-2.5 rounded-lg bg-bgPrimary/40 border border-borderColor/50">
                <span className="text-textMuted">Hostel Block</span>
                <span className="font-bold text-textMain">{hostel.block || 'Not Assigned'}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-bgPrimary/40 border border-borderColor/50">
                <span className="text-textMuted">Room Number</span>
                <span className="font-bold font-mono text-accentColor">{hostel.room || 'Not Assigned'}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-bgPrimary/40 border border-borderColor/50">
                <span className="text-textMuted">Bed Type</span>
                <span className="font-bold text-textMain">{hostel.bed_type || 'Standard'}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-bgPrimary/40 border border-borderColor/50">
                <span className="text-textMuted">Mess Facility</span>
                <span className="font-bold text-textMain">{hostel.mess || 'Not Assigned'}</span>
              </div>
            </div>
          </div>

          {/* Leaves Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm sm:text-base font-bold text-textMain flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-accentColor" /> Leave Requests
              </h3>
              {leavesQuery?.data && leavesQuery.data.length > 0 && (
                <span className="text-xs font-bold text-textMuted font-mono">
                  {leavesQuery.data.length} Total
                </span>
              )}
            </div>

            {leavesQuery?.isPending ? (
              <div className="p-8 bg-bgCard rounded-xl border border-borderColor flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : leavesQuery?.isError ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-xl text-xs border border-rose-200 dark:border-rose-900">
                Failed to load leave history.
              </div>
            ) : leavesQuery?.data && leavesQuery.data.length > 0 ? (
              <div className="space-y-3">
                {leavesQuery.data.map((leave, idx) => (
                  <div key={idx} className="bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-y-2.5 hover:border-accentColor/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-accentColor">{leave.leaveId}</span>
                        <span className="ml-2 text-[10px] font-bold bg-bgPrimary border border-borderColor text-textMuted px-2 py-0.5 rounded uppercase">
                          {leave.type}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(leave.status)}`}>
                        {leave.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-textMain">{leave.visitPlace}</p>
                      {leave.reason && (
                        <p className="text-[11px] text-textMuted italic">{leave.reason}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-borderColor/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-textMuted">
                      <span>From: <strong className="text-textMain font-mono">{leave.fromDate}</strong></span>
                      <span>To: <strong className="text-textMain font-mono">{leave.toDate}</strong></span>
                    </div>

                    {leave.remarks && (
                      <div className="text-[10px] bg-bgPrimary/60 border border-borderColor/40 rounded p-2 text-textMuted">
                        Remarks: {leave.remarks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-bgCard border border-borderColor rounded-xl p-8 text-center space-y-2 shadow-sm">
                <CalendarClock className="h-10 w-10 text-textMuted mx-auto opacity-50" />
                <h4 className="font-bold text-textMain text-sm">No Leave Records</h4>
                <p className="text-xs text-textMuted">You do not have any active or past leave requests.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};