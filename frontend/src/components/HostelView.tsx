import React from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { DoorOpen, Building, Bed, Utensils, Users, Loader2, AlertTriangle } from 'lucide-react';

interface HostelViewProps {
  profileQuery: UseQueryResult<any, any>;
}

export const HostelView: React.FC<HostelViewProps> = ({ profileQuery }) => {
  const hostel = profileQuery.data?.hostel || {};

  const stats = [
    { label: 'Room No', value: hostel.room || 'N/A', icon: DoorOpen },
    { label: 'Block', value: hostel.block || 'N/A', icon: Building },
    { label: 'Type', value: hostel.bed_type || 'N/A', icon: Bed },
    { label: 'Mess', value: hostel.mess || 'N/A', icon: Utensils },
  ];

  // Dummy roommates fallback
  const roommates = [
    { name: 'John Smith', regNo: '23BCE9998', program: 'B.Tech CSE' },
    { name: 'David Miller', regNo: '23BCE9954', program: 'B.Tech ECE' }
  ];

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
              <h2 className="text-2xl font-bold text-textMain">My Room</h2>
              <p className="text-sm text-textMuted mt-1">Hostel allotment details and Mess info.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="bg-bgCard rounded-3xl p-6 shadow-sm border border-borderColor flex flex-col justify-center items-center text-center hover:-translate-y-1 transition-transform duration-200">
                <span className="text-[11px] font-bold text-textMuted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <stat.icon className="w-3.5 h-3.5 text-accentColor" /> {stat.label}
                </span>
                <span className="text-xl sm:text-2xl font-black text-accentColor">{stat.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-bold text-textMain mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-accentColor" /> Roommates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roommates.map((rm, i) => (
                <div key={i} className="p-5 bg-bgCard border border-borderColor rounded-3xl shadow-sm flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-bgPrimary flex items-center justify-center text-textMuted font-bold text-lg border border-borderColor">
                    {rm.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-textMain">{rm.name}</p>
                    <p className="text-xs font-mono text-textMuted mt-0.5">{rm.regNo} • {rm.program}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
