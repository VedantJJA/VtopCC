import type { UseQueryResult } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';

interface CredentialsViewProps {
  credentialsQuery: UseQueryResult<any, any>;
}

export const CredentialsView: React.FC<CredentialsViewProps> = ({ credentialsQuery }) => {
  return (
    <div className="space-y-6">
      {credentialsQuery.isPending ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : credentialsQuery.isError ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>Failed to fetch WiFi and Proctor System credentials from VTOP.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Intro text */}
          <div className="p-5 bg-bgCard border border-borderColor rounded-3xl shadow-sm space-y-1.5">
            <h3 className="text-sm font-bold text-accentColor">VTOP Stored System Logins</h3>
            <p className="text-xs text-textMuted leading-relaxed">
              These credentials are automatically registered by Chennai Campus for your official lab computers, hostel WiFi access, and related university networks.
            </p>
          </div>

          {/* WiFi / Account Credentials */}
          <div className="space-y-4">
            <h4 className="text-sm font-black text-textMain">WiFi & System Accounts</h4>
            {credentialsQuery.data?.accounts?.length === 0 ? (
              <div className="text-xs text-textMuted bg-bgCard border border-borderColor rounded-2xl p-4 text-center">
                No general system accounts found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {credentialsQuery.data?.accounts?.map((acc: any, index: number) => (
                  <div
                    key={index}
                    className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start border-b border-borderColor pb-3">
                      <div>
                        <span className="text-[10px] bg-bgPrimary border border-borderColor font-bold px-2 py-0.5 rounded text-textMuted uppercase">Account</span>
                        <h4 className="text-sm font-bold mt-1 text-textMain">{acc.account}</h4>
                      </div>
                      {acc.url && acc.url !== '#' && (
                        <a
                          href={acc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-accentColor hover:underline"
                        >
                          Login Portal ↗
                        </a>
                      )}
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-textMain">
                        <span className="text-textMuted">Username</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold select-all">{acc.username}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(acc.username)}
                            className="text-[10px] text-accentColor hover:underline active:text-accentColor/80 cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-textMain">
                        <span className="text-textMuted">Password</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold select-all">{acc.password}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(acc.password)}
                            className="text-[10px] text-accentColor hover:underline active:text-accentColor/80 cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Special Exam Credentials */}
          <div className="space-y-4 pt-2">
            <h4 className="text-sm font-black text-textMain">Exam Network Credentials</h4>
            {credentialsQuery.data?.exams?.length === 0 ? (
              <div className="text-xs text-textMuted bg-bgCard border border-borderColor rounded-2xl p-4 text-center">
                No active exam credentials found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {credentialsQuery.data?.exams?.map((ex: any, index: number) => (
                  <div
                    key={index}
                    className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4"
                  >
                    <div className="flex justify-between items-start border-b border-borderColor pb-3">
                      <div>
                        <span className="text-[10px] bg-bgPrimary border border-borderColor text-textMuted font-bold px-2 py-0.5 rounded uppercase">Exam Seat</span>
                        <h4 className="text-sm font-bold mt-1 text-textMain">{ex.account}</h4>
                      </div>
                      <div className="text-right text-[10px] text-textMuted">
                        Seat Number: <strong className="text-textMain font-mono">{ex.seat}</strong>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-center text-textMain">
                        <span className="text-textMuted">Venue & Date</span>
                        <span className="font-bold">{ex.venue_date}</span>
                      </div>
                      <div className="flex justify-between items-center text-textMain">
                        <span className="text-textMuted">Username</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold select-all">{ex.username}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(ex.username)}
                            className="text-[10px] text-accentColor hover:underline cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-textMain">
                        <span className="text-textMuted">Password</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold select-all">{ex.password}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(ex.password)}
                            className="text-[10px] text-accentColor hover:underline cursor-pointer"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
