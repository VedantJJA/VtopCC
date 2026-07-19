import React, { useState } from 'react';
import { 
  ChevronDown, LogOut, LayoutDashboard, GraduationCap, 
  FileText, Home, PlusCircle
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  activeSemester: string;
  setActiveSemester: (sem: string) => void;
  semestersQuery: UseQueryResult<any[], any>;
  isMarksLocked: boolean;
  isGradesLocked: boolean;
  isExamsLocked: boolean;
  logoutMutation: any;
  activeUser: string;
  profileData: any;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeSemester,
  setActiveSemester,
  semestersQuery,
  isMarksLocked,
  isGradesLocked,
  isExamsLocked,
  logoutMutation,
  activeUser,
  profileData,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen
}) => {
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({
    academics: true,
    examinations: false,
    hostel: false,
    extra: false
  });

  return (
    <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-bgSidebar border-r border-borderColor flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* Logo area */}
      <div className="p-5 pb-4 shrink-0">
        <div className="text-xl font-bold text-textMain flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accentColor flex items-center justify-center text-white font-black">V</div>
          VTOP Client
        </div>
      </div>

      {/* Student Info Card */}
      <div className="px-4 pb-4 shrink-0">
        <button 
          onClick={() => { setActiveTab('profile'); setIsMobileSidebarOpen(false); }}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-bgPrimary border border-borderColor hover:bg-bgPrimary/60 transition-colors text-left focus:outline-none cursor-pointer"
        >
          <div className="h-10 w-10 rounded-full bg-bgCard border border-borderColor flex items-center justify-center text-accentColor font-bold shrink-0 overflow-hidden">
            {profileData?.personal?.photo_url ? (
              <img src={profileData.personal.photo_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              activeUser ? activeUser.substring(0, 1).toUpperCase() : 'S'
            )}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-sm font-semibold text-textMain truncate">{profileData?.personal?.name || activeUser || 'Active Session'}</p>
            {profileData?.personal?.name && (
              <p className="text-[11px] text-textMuted font-medium truncate font-mono">{activeUser}</p>
            )}
          </div>
        </button>
      </div>

      {/* Collapsible Nav Links */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-4 custom-scrollbar">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          {
            id: 'academics', label: 'Academics', icon: GraduationCap,
            children: [
              { id: 'timetable', label: 'Time Table' },
              { id: 'attendance', label: 'Attendance' },
              { id: 'calendar', label: 'Calendar' },
              { id: 'courses', label: 'Registered Courses' },
              { id: 'faculty', label: 'Faculty Search' }
            ]
          },
          {
            id: 'examinations', label: 'Examinations', icon: FileText,
            children: [
              { id: 'marks', label: 'Marks' },
              { id: 'grades', label: 'Grades' },
              { id: 'exams', label: 'Exam Schedule' }
            ]
          },
          {
            id: 'hostel', label: 'Hostel', icon: Home,
            children: [
              { id: 'my-room', label: 'My Room' }
            ]
          },
          {
            id: 'extra', label: 'Extra Options', icon: PlusCircle, divider: true,
            children: [
              { id: 'calculator', label: 'Attendance Calculator' }
            ]
          }
        ].map((item) => (
          <div key={item.id} className={item.divider ? "pt-3 mt-3 border-t border-borderColor" : ""}>
            {item.children ? (
              <div className="space-y-0.5 animate-in fade-in duration-200">
                <button 
                  onClick={() => setExpandedNav(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className="w-full flex justify-between items-center px-3 py-2 rounded-lg text-textMuted hover:bg-bgPrimary/40 hover:text-textMain transition-colors font-medium text-[13px] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 text-accentColor" /> {item.label}
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expandedNav[item.id] ? 'rotate-180' : ''}`} />
                </button>
                {expandedNav[item.id] && (
                  <div className="pl-9 pr-2 py-1 space-y-0.5">
                    {item.children.map(child => {
                      const isLocked = child.id === 'marks' ? isMarksLocked : child.id === 'grades' ? isGradesLocked : child.id === 'exams' ? isExamsLocked : false;
                      return (
                        <button
                          key={child.id}
                          disabled={isLocked}
                          onClick={() => { setActiveTab(child.id as any); setIsMobileSidebarOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                            isLocked 
                            ? 'opacity-40 cursor-not-allowed text-textMuted' 
                            : activeTab === child.id 
                              ? 'bg-accentColor text-textMain shadow-sm font-bold cursor-pointer' 
                              : 'text-textMuted hover:bg-bgPrimary/40 hover:text-textMain cursor-pointer'
                          }`}
                        >
                          <span>{child.label}</span>
                          {isLocked && (
                            <span className="text-[8px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider scale-90 origin-right">
                              NOT AVAILABLE
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => { setActiveTab(item.id as any); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors font-medium text-[13px] cursor-pointer ${
                  activeTab === item.id
                  ? 'bg-accentColor text-textMain shadow-sm font-bold'
                  : 'text-textMuted hover:bg-bgPrimary/40 hover:text-textMain'
                }`}
              >
                <item.icon className={`h-4 w-4 ${activeTab === item.id ? 'text-textMain' : 'text-accentColor'}`} /> {item.label}
              </button>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-borderColor shrink-0 space-y-3 mt-auto">
        <div>
          <label htmlFor="semester-select" className="block text-[11px] font-medium text-textMuted mb-1.5 uppercase tracking-wider">Semester</label>
          <div className="relative">
            <select
              id="semester-select"
              value={activeSemester}
              onChange={(e) => setActiveSemester(e.target.value)}
              className="block w-full p-2 pr-8 text-sm font-semibold text-textMain border border-borderColor rounded-lg bg-bgPrimary focus:ring-1 focus:ring-accentColor focus:outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={semestersQuery.isPending || !semestersQuery.data || semestersQuery.data.length === 0}
            >
              {semestersQuery.isPending ? (
                <option>Loading...</option>
              ) : !semestersQuery.data || semestersQuery.data.length === 0 ? (
                <option value="UNAVAILABLE">Unavailable</option>
              ) : (
                semestersQuery.data?.map((sem: any) => (
                  <option key={sem.id} value={sem.id}>{sem.name}</option>
                ))
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-textMuted">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>

        <button 
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="flex items-center justify-center w-full px-3 py-2.5 text-sm font-bold rounded-lg text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </button>
      </div>
    </aside>
  );
};
