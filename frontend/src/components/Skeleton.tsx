import React from 'react';

export const SkeletonBox: React.FC<{
  className?: string;
  rounded?: string;
}> = ({ className = 'h-4 w-full', rounded = 'rounded-lg' }) => {
  return (
    <div
      className={`animate-skeleton bg-bgCard/60 border border-borderColor/30 ${rounded} ${className}`}
    />
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Snapshot Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-borderColor bg-bgCard space-y-2">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-7 w-16" />
        </div>
        <div className="p-4 rounded-xl border border-borderColor bg-bgCard space-y-2">
          <SkeletonBox className="h-3 w-20" />
          <SkeletonBox className="h-7 w-24" />
        </div>
      </div>

      {/* Schedule Panel */}
      <div className="rounded-xl border border-borderColor bg-bgCard p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-5 w-28" />
          <div className="flex gap-1.5">
            <SkeletonBox className="h-8 w-8 rounded-lg" />
            <SkeletonBox className="h-8 w-16 rounded-lg" />
            <SkeletonBox className="h-8 w-8 rounded-lg" />
          </div>
        </div>

        {/* Schedule Class Card Skeletons */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-borderColor/40 bg-bgPrimary/40 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 space-y-1.5">
                  <SkeletonBox className="h-4 w-12" />
                  <SkeletonBox className="h-3 w-10" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <SkeletonBox className="h-4 w-48 max-w-[200px]" />
                  <SkeletonBox className="h-3 w-28" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <SkeletonBox className="h-3 w-14" />
                <div className="flex gap-1">
                  <SkeletonBox className="h-5 w-10 rounded-lg" />
                  <SkeletonBox className="h-5 w-7 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TimetableSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="p-4 bg-bgCard border border-borderColor rounded-xl flex justify-between items-center">
        <div className="flex items-center gap-2">
          <SkeletonBox className="h-4 w-24" />
          <SkeletonBox className="h-5 w-10" />
        </div>
        <SkeletonBox className="h-8 w-28 rounded-xl" />
      </div>

      {/* Day Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <SkeletonBox key={i} className="h-9 w-16 shrink-0 rounded-xl" />
        ))}
      </div>

      {/* Class Cards */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-borderColor bg-bgCard space-y-3"
          >
            <div className="flex justify-between items-center">
              <SkeletonBox className="h-4 w-32" />
              <SkeletonBox className="h-5 w-16 rounded-lg" />
            </div>
            <SkeletonBox className="h-5 w-3/4" />
            <div className="flex gap-3">
              <SkeletonBox className="h-3 w-20" />
              <SkeletonBox className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AttendanceSkeleton: React.FC = () => {
  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-borderColor bg-bgCard space-y-3"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1.5 min-w-0 flex-1">
              <SkeletonBox className="h-4 w-28" />
              <SkeletonBox className="h-5 w-3/4" />
            </div>
            <SkeletonBox className="h-7 w-14 rounded-lg" />
          </div>
          <div className="flex justify-between text-xs">
            <SkeletonBox className="h-3 w-24" />
            <SkeletonBox className="h-3 w-20" />
          </div>
          <SkeletonBox className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
};
