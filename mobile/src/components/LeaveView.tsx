import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, MapPin, Clock, FileText, Send, CalendarCheck } from 'lucide-react';
import { fetchLeaveStatus, fetchLeaveHistory } from '../lib/api';

export default function LeaveView() {
  const [activeTab, setActiveTab] = useState<'apply' | 'status' | 'history'>('status');

  // Fetch Leave Status (/4) via POST
  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ['leaveStatus'],
    queryFn: async () => {
      const res = await fetchLeaveStatus();
      return res.raw_data;
    },
    enabled: activeTab === 'status'
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['leaveHistory'],
    queryFn: async () => {
      const res = await fetchLeaveHistory();
      return res.raw_data;
    },
    enabled: activeTab === 'history'
  });

  const getStatusBadge = (statusStr: string) => {
    const s = (statusStr || '').toLowerCase();
    if (s.includes('approved')) {
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
    if (s.includes('rejected')) {
      return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    }
    if (s.includes('pending') || s.includes('applied')) {
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
    return 'bg-bgPrimary text-textMuted border-borderColor';
  };

  const renderLeaveCards = (items: any[] | undefined, emptyText: string) => {
    if (!items || items.length === 0) {
      return (
        <div className="bg-bgCard border border-borderColor rounded-xl p-8 text-center space-y-2 shadow-sm">
          <CalendarCheck className="h-10 w-10 text-textMuted mx-auto opacity-50" />
          <h4 className="font-bold text-textMain text-sm">No Records Found</h4>
          <p className="text-xs text-textMuted">{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((leave: any, idx: number) => (
          <div
            key={idx}
            className="bg-bgCard border border-borderColor rounded-xl p-4 shadow-sm space-y-3 hover:border-accentColor/40 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-accentColor">{leave.leave_id || leave.leaveId || 'N/A'}</span>
                <span className="ml-2 text-[10px] font-bold bg-bgPrimary border border-borderColor text-textMuted px-2 py-0.5 rounded uppercase">
                  {leave.leave_type || leave.type || 'Leave'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${getStatusBadge(leave.status)}`}>
                {leave.status || 'Pending'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-textMain">
                <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                <span>{leave.visit_place || leave.visitPlace || 'Location Not Specified'}</span>
              </div>
              {leave.reason && (
                <p className="text-[11px] text-textMuted pl-5 italic">{leave.reason}</p>
              )}
            </div>

            <div className="pt-2 border-t border-borderColor/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-textMuted">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-accentColor shrink-0" />
                <span>From: <strong className="text-textMain font-mono">{leave.from || leave.fromDate || 'N/A'}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span>To: <strong className="text-textMain font-mono">{leave.to || leave.toDate || 'N/A'}</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-textMain">Leave Management</h2>
        <p className="text-xs sm:text-sm text-textMuted mt-1">Track pending requests, view past leaves, or submit new applications.</p>
      </div>

      {/* Segmented Pill Tab Bar */}
      <div className="flex bg-bgCard border border-borderColor p-1 rounded-xl shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'status'
              ? 'bg-textMain text-bgCard shadow-xs'
              : 'text-textMuted hover:text-textMain'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Active Status</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-textMain text-bgCard shadow-xs'
              : 'text-textMuted hover:text-textMain'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>History</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('apply')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'apply'
              ? 'bg-textMain text-bgCard shadow-xs'
              : 'text-textMuted hover:text-textMain'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>Apply</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'status' && (
          <div>
            {loadingStatus ? (
              <div className="h-48 flex items-center justify-center bg-bgCard border border-borderColor rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-accentColor" />
              </div>
            ) : (
              renderLeaveCards(statusData, 'You have no active leave requests.')
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {loadingHistory ? (
              <div className="h-48 flex items-center justify-center bg-bgCard border border-borderColor rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-accentColor" />
              </div>
            ) : (
              renderLeaveCards(historyData, 'No past leave records found.')
            )}
          </div>
        )}

        {activeTab === 'apply' && (
          <div className="bg-bgCard border border-borderColor rounded-xl p-8 text-center space-y-3 shadow-sm">
            <Send className="h-10 w-10 text-accentColor mx-auto opacity-70" />
            <h3 className="font-bold text-textMain text-base">Leave Application</h3>
            <p className="text-xs text-textMuted max-w-sm mx-auto leading-relaxed">
              Online leave application submissions are currently managed through your hostel proctor or warden office.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}