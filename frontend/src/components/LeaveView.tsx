import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
// import axios from 'axios';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leave Management</h1>
        <p className="text-zinc-400 text-sm">Apply for leaves, track active requests, and view past history.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('apply')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'apply' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
          }`}
        >
          Leave Apply
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'status' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
          }`}
        >
          Leave Status
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
          }`}
        >
          Leave History
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        {activeTab === 'apply' && (
          <div className="text-center py-12 text-zinc-400">
            <h3 className="text-lg font-medium text-white">Coming Soon</h3>
            <p className="text-sm mt-1">Leave application module is currently under development.</p>
          </div>
        )}

        {activeTab === 'status' && (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Active Leave Requests & Status</h3>
            {loadingStatus ? (
              <div className="text-zinc-400 text-center py-8">Loading status...</div>
            ) : !statusData || statusData.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">No active leave requests found.</div>
            ) : (
              <div className="overflow-x-auto">
                {/* Render your table or cards for statusData here */}
                <pre className="text-xs text-zinc-300">{JSON.stringify(statusData, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="text-lg font-medium text-white mb-4">Past Leave History</h3>
            {loadingHistory ? (
              <div className="text-zinc-400 text-center py-8">Loading history...</div>
            ) : !historyData || historyData.length === 0 ? (
              <div className="text-zinc-500 text-center py-8">No past leaves found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-zinc-300">
                  <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs">
                    <tr>
                      <th className="p-3">Leave ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Place</th>
                      <th className="p-3">From</th>
                      <th className="p-3">To</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {historyData.map((leave: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-800/50">
                        <td className="p-3 font-medium text-white">{leave.leave_id}</td>
                        <td className="p-3">{leave.leave_type}</td>
                        <td className="p-3">{leave.visit_place}</td>
                        <td className="p-3">{leave.from}</td>
                        <td className="p-3">{leave.to}</td>
                        <td className="p-3 text-emerald-400 font-medium">{leave.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}