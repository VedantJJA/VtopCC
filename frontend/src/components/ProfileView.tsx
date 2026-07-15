import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle, User as UserIcon } from 'lucide-react';

interface ProfileViewProps {
  profileQuery: UseQueryResult<any, any>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profileQuery }) => {
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left profile block */}
          <div className="md:col-span-1 bg-bgCard border border-borderColor rounded-3xl p-6 text-center space-y-4 shadow-sm">
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
              <h3 className="text-lg font-bold">{profileQuery.data?.personal?.name || 'N/A'}</h3>
              <p className="text-xs text-accentColor font-mono font-bold mt-1">
                {profileQuery.data?.educational?.reg_no || 'N/A'}
              </p>
            </div>
            <div className="pt-4 border-t border-borderColor text-left space-y-2.5 text-xs">
              <div className="flex justify-between"><span className="text-textMuted font-medium">Application No</span><span className="font-semibold">{profileQuery.data?.personal?.app_no}</span></div>
              <div className="flex justify-between"><span className="text-textMuted font-medium">Blood Group</span><span className="font-semibold">{profileQuery.data?.personal?.blood_group}</span></div>
              <div className="flex justify-between"><span className="text-textMuted font-medium">DOB</span><span className="font-semibold">{profileQuery.data?.personal?.dob}</span></div>
              <div className="flex justify-between"><span className="text-textMuted font-medium">Native State</span><span className="font-semibold">{profileQuery.data?.personal?.native_state}</span></div>
            </div>
          </div>

          {/* Right details grids */}
          <div className="md:col-span-2 space-y-6">
            {/* Academic & Proctor Info */}
            <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold border-b border-borderColor pb-2 text-accentColor">Academic Details</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><div className="text-textMuted mb-1">School</div><div className="font-bold">{profileQuery.data?.educational?.school}</div></div>
                <div><div className="text-textMuted mb-1">Board</div><div className="font-bold">{profileQuery.data?.educational?.board}</div></div>
                <div><div className="text-textMuted mb-1">Medium</div><div className="font-bold">{profileQuery.data?.educational?.medium}</div></div>
                <div><div className="text-textMuted mb-1">Passing Year</div><div className="font-bold">{profileQuery.data?.educational?.year_passing}</div></div>
              </div>
            </div>

            {/* Proctor details */}
            <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold border-b border-borderColor pb-2 text-accentColor">Proctor Details</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><div className="text-textMuted mb-1">Proctor Name</div><div className="font-bold">{profileQuery.data?.proctor?.name}</div></div>
                <div><div className="text-textMuted mb-1">Designation</div><div className="font-bold">{profileQuery.data?.proctor?.designation}</div></div>
                <div><div className="text-textMuted mb-1">Cabin</div><div className="font-bold font-mono">{profileQuery.data?.proctor?.cabin}</div></div>
                <div><div className="text-textMuted mb-1">Email</div><div className="font-bold truncate select-all">{profileQuery.data?.proctor?.email}</div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
