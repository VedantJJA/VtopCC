import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';

interface DebugViewProps {
  debugQuery: UseQueryResult<any, any>;
}

export const DebugView: React.FC<DebugViewProps> = ({ debugQuery }) => {
  return (
    <div className="space-y-6">
      {debugQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : debugQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2 animate-fade-in">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to load debug details from backend. Ensure your VTOP session is active.</span>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <div className="p-5 bg-bgCard border border-borderColor rounded-3xl shadow-sm space-y-2">
            <h3 className="text-sm font-bold text-blue-600 dark:text-blue-500">VTOP Session Credentials (Debug)</h3>
            <p className="text-xs text-textMuted leading-relaxed">
              Below are the active session variables parsed by the backend after successful login, along with the raw HTML retrieved from the timetable menu route.
            </p>
          </div>

          {/* Meta details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-3">
              <span className="text-[10px] bg-bgPrimary border border-borderColor font-bold px-2 py-0.5 rounded text-textMuted uppercase">Authorized ID</span>
              <div className="text-base font-mono font-extrabold text-textMain select-all">
                {debugQuery.data?.authorizedId || 'N/A'}
              </div>
              <p className="text-[10px] text-textMuted leading-relaxed">
                This is the internal VTOP student roll code. Note that it might be different than your login ID.
              </p>
            </div>

            <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-3">
              <span className="text-[10px] bg-bgPrimary border border-borderColor font-bold px-2 py-0.5 rounded text-textMuted uppercase">Active CSRF Token</span>
              <div className="text-base font-mono font-extrabold text-textMain select-all truncate" title={debugQuery.data?.csrfToken}>
                {debugQuery.data?.csrfToken || 'N/A'}
              </div>
              <p className="text-[10px] text-textMuted leading-relaxed">
                The active cross-site request forgery protection token extracted from the /content page.
              </p>
            </div>
          </div>

          {/* Raw response html */}
          <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-borderColor pb-3">
              <h4 className="text-sm font-bold text-textMain">Timetable Endpoint Response HTML</h4>
              <button
                onClick={() => {
                  if (debugQuery.data?.rawHtml) {
                    navigator.clipboard.writeText(debugQuery.data.rawHtml);
                  }
                }}
                className="text-xs font-semibold text-blue-600 dark:text-blue-500 hover:underline cursor-pointer"
              >
                Copy Full HTML
              </button>
            </div>
            <p className="text-xs text-textMuted leading-relaxed">
              HTML output returned from requesting <code className="bg-bgPrimary border border-borderColor font-mono px-1 rounded">academics/common/StudentTimeTableChn</code>:
            </p>
            <div className="bg-bgPrimary border border-borderColor rounded-2xl p-4 overflow-x-auto max-h-[400px] overflow-y-auto">
              <pre className="text-[10px] font-mono text-textMuted whitespace-pre-wrap select-all">
                {debugQuery.data?.rawHtml || 'No HTML content returned.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
