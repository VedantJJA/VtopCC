import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, User as UserIcon, Key, Users, Phone, Mail, UserCheck, MapPin, Home, Utensils } from 'lucide-react';

interface ProfileViewProps {
  profileQuery: UseQueryResult<any, any>;
  setActiveTab: (tab: any) => void;
  activeUser: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profileQuery, setActiveTab, activeUser }) => {
  return (
    <div className="space-y-6">
      {profileQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : profileQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to load student profile details. Please refresh.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left profile block */}
          <div className="xl:col-span-1 space-y-6">
            <div className="bg-bgCard border border-borderColor rounded-3xl p-6 text-center space-y-4 shadow-sm">
              <div className="h-28 w-28 rounded-full bg-bgPrimary border border-borderColor overflow-hidden mx-auto relative flex items-center justify-center">
                {profileQuery.data?.personal?.photo_url ? (
                  <img
                    src={profileQuery.data.personal.photo_url}
                    alt="Student"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-12 w-12 text-textMuted" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-textMain">{profileQuery.data?.personal?.name || 'N/A'}</h3>
                <p className="text-xs text-accentColor font-mono font-bold mt-1">
                  {activeUser || 'N/A'}
                </p>
              </div>
              <div className="pt-4 border-t border-borderColor text-left space-y-2.5 text-xs">
                <div className="flex justify-between"><span className="text-textMuted font-medium">Application No</span><span className="font-semibold text-textMain">{profileQuery.data?.personal?.app_no || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-textMuted font-medium">Blood Group</span><span className="font-semibold text-textMain">{profileQuery.data?.personal?.blood_group || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-textMuted font-medium">DOB</span><span className="font-semibold text-textMain">{profileQuery.data?.personal?.dob || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-textMuted font-medium">Native State</span><span className="font-semibold text-textMain">{profileQuery.data?.personal?.native_state || 'N/A'}</span></div>
              </div>

              {/* Wifi & Systems Settings Navigation Shortcut */}
              <div className="pt-2 border-t border-borderColor">
                <button
                  onClick={() => setActiveTab('credentials')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-bgPrimary hover:bg-borderColor border border-borderColor rounded-xl text-textMain transition-all cursor-pointer"
                >
                  <Key className="h-3.5 w-3.5 text-accentColor" />
                  WiFi & Systems Credentials
                </button>
              </div>
            </div>

            {/* Hostel Info Card */}
            {profileQuery.data?.hostel && (
              <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2 text-textMain">
                  <Home className="h-4 w-4 text-accentColor" /> Hostel Details
                </h4>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-textMuted font-medium">Block</span>
                    <span className="font-semibold text-textMain max-w-[150px] truncate" title={profileQuery.data.hostel.block}>{profileQuery.data.hostel.block || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-textMuted font-medium">Room No</span>
                    <span className="font-mono font-bold text-accentColor bg-bgPrimary border border-borderColor px-2 py-0.5 rounded">{profileQuery.data.hostel.room || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-textMuted font-medium">Bed Type</span>
                    <span className="font-semibold text-textMain">{profileQuery.data.hostel.bed_type || 'N/A'}</span>
                  </div>
                  <div className="pt-3 border-t border-borderColor">
                    <span className="text-[10px] text-textMuted block mb-1 uppercase tracking-wider">Mess Type</span>
                    <span className="font-bold text-textMain flex items-center gap-1.5">
                      <Utensils className="h-3.5 w-3.5 text-textMuted" /> {profileQuery.data.hostel.mess || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right details grids */}
          <div className="xl:col-span-2 space-y-6">
            {/* Personal Details list */}
            <div className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-borderColor bg-bgPrimary/30">
                <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2 text-textMain">
                  <UserIcon className="h-4 w-4 text-textMuted" /> Personal Information
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
                  <div>
                    <div className="text-textMuted mb-1 uppercase tracking-wider text-[10px]">Date of Birth</div>
                    <div className="font-bold text-textMain">{profileQuery.data?.personal?.dob || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-textMuted mb-1 uppercase tracking-wider text-[10px]">Native State</div>
                    <div className="font-bold text-textMain">{profileQuery.data?.personal?.native_state || 'N/A'}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-textMuted mb-1 uppercase tracking-wider text-[10px]">Personal Email</div>
                    <div className="font-bold text-textMain select-all">{profileQuery.data?.personal?.email || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-textMuted mb-1 uppercase tracking-wider text-[10px]">Mobile</div>
                    <div className="font-bold font-mono text-textMain">{profileQuery.data?.personal?.mobile || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Parents details */}
            {profileQuery.data?.family && (
              <div className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-borderColor bg-bgPrimary/30">
                  <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2 text-textMain">
                    <Users className="h-4 w-4 text-textMuted" /> Family Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-borderColor bg-bgCard">
                  {/* Father info */}
                  <div className="p-6 bg-blue-50/5 dark:bg-blue-950/5 space-y-4">
                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest border-b border-borderColor pb-2">Father</h4>
                    <div className="space-y-3.5 text-xs">
                      <div>
                        <span className="text-[10px] text-textMuted block mb-0.5 uppercase">Name</span>
                        <p className="font-bold text-textMain text-sm">{profileQuery.data.family.father?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-textMuted block mb-0.5 uppercase">Occupation</span>
                        <p className="font-bold text-textMain">{profileQuery.data.family.father?.occupation || 'N/A'}</p>
                        {profileQuery.data.family.father?.organization && (
                          <p className="text-textMuted mt-0.5 text-[11px]">{profileQuery.data.family.father.organization}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-textMuted block mb-0.5 uppercase">Contact</span>
                        <p className="font-bold font-mono text-textMain">{profileQuery.data.family.father?.mobile || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  {/* Mother info */}
                  <div className="p-6 bg-pink-50/5 dark:bg-pink-950/5 space-y-4">
                    <h4 className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase tracking-widest border-b border-borderColor pb-2">Mother</h4>
                    <div className="space-y-3.5 text-xs">
                      <div>
                        <span className="text-[10px] text-textMuted block mb-0.5 uppercase">Name</span>
                        <p className="font-bold text-textMain text-sm">{profileQuery.data.family.mother?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-textMuted block mb-0.5 uppercase">Occupation</span>
                        <p className="font-bold text-textMain">{profileQuery.data.family.mother?.occupation || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-textMuted block mb-0.5 uppercase">Contact</span>
                        <p className="font-bold font-mono text-textMain">{profileQuery.data.family.mother?.mobile || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Proctor details */}
            {profileQuery.data?.proctor && (
              <div className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-borderColor bg-indigo-50 dark:bg-indigo-950/10">
                  <h3 className="font-bold text-sm uppercase tracking-wide flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                    <UserCheck className="h-4 w-4" /> Proctor Information
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-bgCard">
                  <div className="flex items-start space-x-4">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-full text-indigo-600 dark:text-indigo-400">
                      <UserIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-textMain">{profileQuery.data.proctor.name || 'N/A'}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">{profileQuery.data.proctor.designation || 'N/A'}</p>
                      <div className="mt-2 flex items-center text-xs text-textMuted bg-bgPrimary border border-borderColor rounded px-2.5 py-1 w-fit">
                        <MapPin className="h-3 w-3 mr-1 text-accentColor" /> {profileQuery.data.proctor.cabin || 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3.5 pl-0 md:pl-6 border-l-0 md:border-l border-borderColor">
                    <div className="flex items-center group gap-3">
                      <div className="p-2 bg-green-100 dark:bg-green-950/20 rounded-lg text-green-700 dark:text-green-400 group-hover:bg-green-200 transition-colors">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-textMuted uppercase tracking-wider block">Mobile</span>
                        <span className="text-xs font-bold font-mono text-textMain">{profileQuery.data.proctor.mobile || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="flex items-center group gap-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-950/20 rounded-lg text-orange-700 dark:text-orange-400 group-hover:bg-orange-200 transition-colors">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[10px] text-textMuted uppercase tracking-wider block">Email</span>
                        <span className="text-xs font-bold text-textMain truncate block select-all" title={profileQuery.data.proctor.email}>{profileQuery.data.proctor.email || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
