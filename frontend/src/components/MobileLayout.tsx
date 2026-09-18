import React, { useRef } from 'react';
import { 
  LayoutDashboard, CalendarDays, Activity, Calculator, Grid, 
  RefreshCw, Sun, Moon, ArrowLeft, BookOpen, Award, FileText, 
  Home, Calendar, Search, Settings, Shield, User, LogOut, ChevronRight
} from 'lucide-react';
import { VtopLogo } from './VtopLogo';

export interface DockItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const DOCK_ITEMS_MAP: Record<string, DockItemConfig> = {
  dashboard: { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  timetable: { id: 'timetable', label: 'Timetable', icon: CalendarDays },
  attendance: { id: 'attendance', label: 'Attendance', icon: Activity },
  calendar: { id: 'calendar', label: 'Calendar', icon: Calendar },
  calculator: { id: 'calculator', label: 'Calc', icon: Calculator },
  marks: { id: 'marks', label: 'Marks', icon: Award },
  grades: { id: 'grades', label: 'Grades', icon: Award },
  exams: { id: 'exams', label: 'Exams', icon: FileText },
  courses: { id: 'courses', label: 'Courses', icon: BookOpen },
  faculty: { id: 'faculty', label: 'Faculty', icon: Search },
  'my-room': { id: 'my-room', label: 'Room', icon: Home },
  more: { id: 'more', label: 'More', icon: Grid }
};

export const DEFAULT_DOCK_TABS = ['dashboard', 'timetable', 'attendance', 'calendar', 'more'];

interface MobileLayoutProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  activeSemester?: string;
  activeUser: string;
  profileData: any;
  isAdmin?: boolean;
  onLogout: () => void;
  dockTabs?: string[];
  children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  activeTab,
  setActiveTab,
  theme,
  setTheme,
  isRefreshing,
  onRefresh,
  activeUser,
  profileData,
  isAdmin = false,
  onLogout,
  dockTabs: propDockTabs,
  children
}) => {
  const dockTabs = propDockTabs && propDockTabs.length > 0 ? propDockTabs : DEFAULT_DOCK_TABS;
  const swipableTabs = dockTabs.filter(t => t !== 'more');
  const isDockTab = dockTabs.includes(activeTab);

  // Swipe gesture tracking
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    // If user touches inside a component marked as no-swipe (like inner carousels), ignore
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-swipe="true"]')) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      isHorizontalSwipeRef.current = null;
      return;
    }

    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const dy = e.touches[0].clientY - touchStartYRef.current;

    // Determine swipe direction once threshold reached
    if (isHorizontalSwipeRef.current === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      if (Math.abs(dx) > Math.abs(dy) * 1.3) {
        isHorizontalSwipeRef.current = true;
      } else {
        isHorizontalSwipeRef.current = false;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null || !isHorizontalSwipeRef.current) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      isHorizontalSwipeRef.current = null;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartXRef.current;
    const dy = endY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isHorizontalSwipeRef.current = null;

    // Swipe threshold of 50px
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      const currentIdx = swipableTabs.indexOf(activeTab);
      if (currentIdx !== -1) {
        if (dx < 0) {
          // Swipe left -> next tab
          if (currentIdx < swipableTabs.length - 1) {
            setActiveTab(swipableTabs[currentIdx + 1]);
          }
        } else {
          // Swipe right -> prev tab
          if (currentIdx > 0) {
            setActiveTab(swipableTabs[currentIdx - 1]);
          }
        }
      }
    }
  };

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'timetable': return 'Timetable';
      case 'attendance': return 'Attendance';
      case 'calculator': return 'Calculator';
      case 'more': return 'Explore & More';
      case 'courses': return 'Registered Courses';
      case 'marks': return 'Marks';
      case 'grades': return 'Grades';
      case 'exams': return 'Exam Schedule';
      case 'calendar': return 'Academic Calendar';
      case 'my-room': return 'My Room';
      case 'leaves': return 'Leave Requests';
      case 'faculty': return 'Faculty Search';
      case 'settings': return 'Settings';
      case 'profile': return 'Student Profile';
      case 'admin': return 'Admin Panel';
      default: return activeTab.replace('-', ' ');
    }
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen bg-bgPrimary text-textMain overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Mobile Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-bgCard border-b border-borderColor z-30 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {!isDockTab ? (
            <button
              onClick={() => setActiveTab('more')}
              className="p-1.5 -ml-1 text-accentColor hover:bg-bgPrimary rounded-lg flex items-center gap-1 font-semibold text-xs cursor-pointer transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <VtopLogo size={24} />
              <span className="font-extrabold text-sm tracking-tight text-textMain hidden xs:inline">VTOP</span>
            </div>
          )}

          <h1 className="text-base font-bold text-textMain capitalize truncate">
            {getHeaderTitle()}
          </h1>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-textMuted hover:text-textMain bg-bgPrimary hover:bg-bgPrimary/80 border border-borderColor transition-all cursor-pointer disabled:opacity-50"
            title="Refresh VTOP Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-accentColor' : ''}`} />
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl text-textMuted hover:text-textMain bg-bgPrimary hover:bg-bgPrimary/80 border border-borderColor transition-all cursor-pointer"
            title="Toggle Light/Dark Theme"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-20 custom-scrollbar relative bg-bgPrimary">
        {activeTab === 'more' ? (
          <MobileMoreHub 
            setActiveTab={setActiveTab} 
            activeUser={activeUser}
            profileData={profileData}
            isAdmin={isAdmin}
            onLogout={onLogout}
          />
        ) : (
          children
        )}
      </main>

      {/* Fixed Bottom Tab Bar / Dock */}
      <nav className="fixed bottom-0 inset-x-0 bg-bgCard/95 backdrop-blur-md border-t border-borderColor z-40 px-2 py-1.5 flex items-center justify-around shadow-lg">
        {dockTabs.map((tabId) => {
          const config = DOCK_ITEMS_MAP[tabId] || { id: tabId, label: tabId, icon: Grid };
          const IconComponent = config.icon;
          const isTabActive = tabId === 'more' 
            ? (!dockTabs.includes(activeTab) || activeTab === 'more')
            : activeTab === tabId;

          return (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                isTabActive 
                  ? 'text-accentColor font-bold' 
                  : 'text-textMuted hover:text-textMain font-medium'
              }`}
            >
              <div className={`p-1 rounded-lg transition-transform ${isTabActive ? 'scale-110 bg-accentColor/10' : ''}`}>
                <IconComponent className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{config.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

interface MobileMoreHubProps {
  setActiveTab: (tab: any) => void;
  activeUser: string;
  profileData: any;
  isAdmin: boolean;
  onLogout: () => void;
}

const MobileMoreHub: React.FC<MobileMoreHubProps> = ({
  setActiveTab,
  activeUser,
  profileData,
  isAdmin,
  onLogout
}) => {
  const hubSections = [
    {
      title: 'Academics & Tools',
      items: [
        { id: 'courses', label: 'Registered Courses', icon: BookOpen, color: 'text-blue-500 bg-blue-500/10' },
        { id: 'calendar', label: 'Academic Calendar', icon: Calendar, color: 'text-emerald-500 bg-emerald-500/10' },
        { id: 'calculator', label: 'Attendance Calculator', icon: Calculator, color: 'text-sky-500 bg-sky-500/10' },
        { id: 'faculty', label: 'Faculty Search', icon: Search, color: 'text-purple-500 bg-purple-500/10' },
      ]
    },
    {
      title: 'Examinations & Marks',
      items: [
        { id: 'marks', label: 'Marks', icon: Award, color: 'text-amber-500 bg-amber-500/10' },
        { id: 'grades', label: 'Grades', icon: FileText, color: 'text-indigo-500 bg-indigo-500/10' },
        { id: 'exams', label: 'Exam Schedule', icon: CalendarDays, color: 'text-rose-500 bg-rose-500/10' },
      ]
    },
    {
      title: 'Hostel & Life',
      items: [
        { id: 'my-room', label: 'My Room', icon: Home, color: 'text-cyan-500 bg-cyan-500/10' },
        { id: 'leaves', label: 'Leave Requests', icon: FileText, color: 'text-teal-500 bg-teal-500/10' },
      ]
    },
    {
      title: 'Preferences & Account',
      items: [
        { id: 'profile', label: 'Student Profile', icon: User, color: 'text-indigo-500 bg-indigo-500/10' },
        { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-500 bg-slate-500/10' },
        ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: Shield, color: 'text-red-500 bg-red-500/10' }] : [])
      ]
    }
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Student Profile Quick Banner */}
      <div 
        onClick={() => setActiveTab('profile')}
        className="flex items-center gap-3 p-3.5 bg-bgCard border border-borderColor rounded-2xl cursor-pointer hover:bg-bgPrimary/60 transition-colors shadow-xs"
      >
        <div className="h-12 w-12 rounded-xl bg-accentColor/10 text-accentColor flex items-center justify-center font-bold text-base shrink-0 overflow-hidden border border-accentColor/20">
          {profileData?.personal?.photo_url ? (
            <img 
              src={`data:image/jpeg;base64,${profileData.personal.photo_url}`} 
              alt="Profile" 
              className="h-full w-full object-cover" 
            />
          ) : (
            activeUser.slice(0, 2).toUpperCase() || 'VT'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-textMain text-sm truncate">
            {profileData?.personal?.name || activeUser || 'Student'}
          </h3>
          <p className="text-xs text-textMuted font-mono truncate mt-0.5">
            {activeUser} {profileData?.academic?.program ? `| ${profileData.academic.program}` : ''}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-textMuted shrink-0" />
      </div>

      {/* Grid of Sections */}
      {hubSections.map((sec, sIdx) => (
        <div key={sIdx} className="space-y-2">
          <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider px-1">
            {sec.title}
          </h4>
          <div className="grid grid-cols-2 gap-2.5">
            {sec.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-bgCard border border-borderColor hover:bg-bgPrimary transition-all text-left cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <div className={`p-2.5 rounded-xl ${item.color} shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-textMain leading-tight truncate">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Logout Button */}
      <div className="pt-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 font-bold text-xs hover:bg-rose-500/20 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out of VTOP</span>
        </button>
      </div>
    </div>
  );
};
