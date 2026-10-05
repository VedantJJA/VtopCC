import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Sparkles, Search, Calendar, MapPin, Users, IndianRupee, 
  ExternalLink, X, RefreshCw, User, AlertCircle, ChevronRight, Lock,
  Ticket, Award, FileText, CheckCircle2
} from 'lucide-react';
import { getEventHubEvents, getEventHubPreview, getEventHubProfile, registerEventHubFree } from '../lib/api';

interface EventsHubViewProps {
  activeUser?: string;
}

export const EventsHubView: React.FC<EventsHubViewProps> = ({ activeUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'paid' | 'vitian' | 'open'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedEid, setSelectedEid] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'registered' | 'profile'>('registered');

  const [registerStatus, setRegisterStatus] = useState<{ eid: string; type: 'success' | 'error'; message: string } | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  // Manual creds form state in case automatic cookie auth needs input
  const [authNeeded, setAuthNeeded] = useState(false);
  const [manualUser, setManualUser] = useState(activeUser || '');
  const [manualPass, setManualPass] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Fetch Events Query
  const eventsQuery = useQuery({
    queryKey: ['eventhub-events'],
    queryFn: async () => {
      const res = await getEventHubEvents(
        manualUser && manualPass ? { username: manualUser, password: manualPass } : undefined
      );
      if (res.status === 'auth_required') {
        setAuthNeeded(true);
        return { events: [], categories: [] };
      }
      setAuthNeeded(false);
      return res;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  // Fetch Event Preview Query
  const previewQuery = useQuery({
    queryKey: ['eventhub-preview', selectedEid],
    queryFn: async () => {
      if (!selectedEid) return null;
      const res = await getEventHubPreview(
        selectedEid,
        manualUser && manualPass ? { username: manualUser, password: manualPass } : undefined
      );
      return res.preview;
    },
    enabled: !!selectedEid,
    staleTime: 10 * 60 * 1000
  });

  // Fetch Profile Query
  const profileQuery = useQuery({
    queryKey: ['eventhub-profile'],
    queryFn: async () => {
      const res = await getEventHubProfile(
        manualUser && manualPass ? { username: manualUser, password: manualPass } : undefined
      );
      return res.profile;
    },
    enabled: isProfileOpen,
    staleTime: 10 * 60 * 1000
  });

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUser || !manualPass) {
      setAuthError('Please enter both your VTOP ID and password.');
      return;
    }
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const res = await getEventHubEvents({ username: manualUser, password: manualPass });
      if (res.status === 'success') {
        setAuthNeeded(false);
        eventsQuery.refetch();
      } else {
        setAuthError(res.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Network error during login.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegisterFree = async (eid: string) => {
    setIsRegistering(true);
    setRegisterStatus(null);
    try {
      const res = await registerEventHubFree(
        eid, 
        '1', 
        manualUser && manualPass ? { username: manualUser, password: manualPass } : undefined
      );
      if (res.status === 'success') {
        setRegisterStatus({ eid, type: 'success', message: res.message || 'Successfully registered for this event!' });
        profileQuery.refetch();
      } else {
        setRegisterStatus({ eid, type: 'error', message: res.message || 'Registration failed.' });
      }
    } catch (err: any) {
      setRegisterStatus({ eid, type: 'error', message: err.message || 'Network error during registration.' });
    } finally {
      setIsRegistering(false);
    }
  };

  const rawEvents: any[] = eventsQuery.data?.events || [];
  const categories: any[] = eventsQuery.data?.categories || [];

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return rawEvents.filter(event => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = event.title?.toLowerCase().includes(q);
        const matchesVenue = event.venue?.toLowerCase().includes(q);
        const matchesDate = event.date?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesVenue && !matchesDate) return false;
      }

      // 2. Type Filter
      if (filterType === 'free' && !event.isFree) return false;
      if (filterType === 'paid' && event.isFree) return false;
      if (filterType === 'vitian') {
        const pType = (event.participantType || '').toLowerCase();
        if (pType.includes('non-vitian') && !pType.includes('vitian/')) return false;
      }
      if (filterType === 'open') {
        const pType = (event.participantType || '').toLowerCase();
        if (!pType.includes('non-vitian')) return false;
      }

      // 3. Category Filter
      if (selectedCategory !== 'all') {
        const cat = selectedCategory.toLowerCase();
        const matchesCat = event.title?.toLowerCase().includes(cat) || event.venue?.toLowerCase().includes(cat);
        if (!matchesCat) return false;
      }

      return true;
    });
  }, [rawEvents, searchQuery, filterType, selectedCategory]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/80 via-purple-950/70 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 shadow-xl">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentColor/10 border border-accentColor/30 text-accentColor text-xs font-bold tracking-wide uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Campus Pulse</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              VIT Event Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Tech, Talent, Triumph & Festivity. Discover workshops, hackathons, guest lectures, and student club events all in one place.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold backdrop-blur-md transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <User className="h-4 w-4 text-accentColor" />
              <span>My Teams & Profile</span>
            </button>
            <button
              onClick={() => eventsQuery.refetch()}
              disabled={eventsQuery.isFetching}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Refresh Events"
            >
              <RefreshCw className={`h-4 w-4 ${eventsQuery.isFetching ? 'animate-spin' : ''}`} />
            </button>
            <a
              href="https://eventhubcc.vit.ac.in/EventHub/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <span>Portal</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. AUTHENTICATION REQUIRED MODAL / NOTICE */}
      {authNeeded && (
        <div className="p-6 bg-bgCard border border-amber-500/30 rounded-2xl shadow-lg space-y-4 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-amber-500">
            <Lock className="h-6 w-6" />
            <h3 className="font-bold text-base text-textMain">Event Hub Login Required</h3>
          </div>
          <p className="text-xs text-textMuted leading-relaxed">
            Please provide your VTOP username & password to establish a direct, encrypted session with the VIT Event Hub portal.
          </p>
          {authError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
          <form onSubmit={handleManualLogin} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-textMuted uppercase">VTOP Registration No.</label>
              <input
                type="text"
                value={manualUser}
                onChange={e => setManualUser(e.target.value.toUpperCase())}
                placeholder="e.g. 25BCE5232"
                className="w-full mt-1 px-3 py-2 text-xs bg-bgPrimary border border-borderColor rounded-xl text-textMain outline-none focus:border-accentColor font-mono"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-textMuted uppercase">VTOP Password</label>
              <input
                type="password"
                value={manualPass}
                onChange={e => setManualPass(e.target.value)}
                placeholder="Your VTOP Password"
                className="w-full mt-1 px-3 py-2 text-xs bg-bgPrimary border border-borderColor rounded-xl text-textMain outline-none focus:border-accentColor"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-2.5 px-4 bg-accentColor hover:bg-accentColor/90 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isAuthenticating ? 'Connecting to Event Hub...' : 'Login & Load Events'}
            </button>
          </form>
        </div>
      )}

      {/* 3. SEARCH & FILTERS BAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-textMuted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search events by title, venue, or date..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-bgCard border border-borderColor rounded-2xl text-textMain outline-none focus:border-accentColor shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar shrink-0">
          {(
            [
              { id: 'all', label: 'All Events' },
              { id: 'free', label: 'Free Only' },
              { id: 'paid', label: 'Paid' },
              { id: 'vitian', label: 'VITian' },
              { id: 'open', label: 'Open to All' }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === tab.id
                  ? 'bg-accentColor text-white shadow-xs'
                  : 'bg-bgCard text-textMuted hover:text-textMain border border-borderColor/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category Dropdown Filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-bgCard border border-borderColor text-textMain outline-none cursor-pointer shadow-xs"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4. EVENTS COUNT & ACTIVE STATS */}
      <div className="flex items-center justify-between text-xs text-textMuted px-1">
        <span>Showing <strong className="text-textMain font-mono">{filteredEvents.length}</strong> {filteredEvents.length === 1 ? 'event' : 'events'}</span>
        {rawEvents.length > 0 && (
          <span className="font-mono text-[11px]">Total available: {rawEvents.length}</span>
        )}
      </div>

      {/* 5. EVENTS GRID */}
      {eventsQuery.isPending && !eventsQuery.data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 rounded-2xl bg-bgCard border border-borderColor animate-pulse p-5 space-y-4">
              <div className="h-6 w-3/4 bg-bgPrimary rounded-lg" />
              <div className="h-4 w-1/2 bg-bgPrimary rounded-lg" />
              <div className="h-20 bg-bgPrimary/50 rounded-xl" />
              <div className="h-10 bg-bgPrimary rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-16 text-center bg-bgCard border border-dashed border-borderColor rounded-3xl space-y-3">
          <Calendar className="h-12 w-12 text-textMuted mx-auto opacity-40" />
          <h4 className="font-bold text-textMain text-base">No Events Found</h4>
          <p className="text-xs text-textMuted max-w-sm mx-auto">
            {searchQuery ? `No events match "${searchQuery}". Try adjusting your filters.` : 'No upcoming events listed at this time.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map((event, idx) => {
            return (
              <div
                key={event.eid || idx}
                onClick={() => event.eid && setSelectedEid(event.eid)}
                className="group relative flex flex-col justify-between bg-bgCard border border-borderColor hover:border-accentColor/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.99] overflow-hidden"
              >
                <div className="space-y-3.5">
                  {/* Top Row: Eligibility & Fee Pill */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 truncate">
                      {event.participantType}
                    </span>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border font-mono ${
                      event.isFree
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {event.isFree ? 'FREE' : `₹${event.fees}`}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-textMain text-base group-hover:text-accentColor transition-colors line-clamp-2 leading-snug">
                    {event.title}
                  </h3>

                  {/* Details (Date & Venue) */}
                  <div className="space-y-1.5 text-xs text-textMuted pt-1">
                    {event.date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-accentColor shrink-0" />
                        <span className="font-mono text-[11px] font-medium">{event.date}</span>
                      </div>
                    )}
                    {event.venue && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 text-textMuted shrink-0 mt-0.5" />
                        <span className="text-[11px] line-clamp-1">{event.venue}</span>
                      </div>
                    )}
                    {event.teamSize && (
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-textMuted shrink-0" />
                        <span className="text-[11px]">Team size: {event.teamSize}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom View Button */}
                <div className="pt-4 mt-4 border-t border-borderColor/50 flex items-center justify-between text-xs">
                  <span className="text-textMuted text-[11px]">ID: #{event.eid}</span>
                  <div className="flex items-center gap-1 font-bold text-accentColor group-hover:translate-x-1 transition-transform">
                    <span>View Details</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. EVENT PREVIEW MODAL */}
      {selectedEid && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-bgCard border border-borderColor rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-borderColor flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-accentColor/10 text-accentColor border border-accentColor/20 text-xs font-bold font-mono">
                  Event #{selectedEid}
                </span>
                <span className="text-xs text-textMuted font-medium">Details & Registration</span>
              </div>
              <button
                onClick={() => setSelectedEid(null)}
                className="p-1.5 text-textMuted hover:text-textMain rounded-xl border border-borderColor hover:bg-bgPrimary transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              {previewQuery.isPending ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="h-8 w-8 text-accentColor animate-spin mx-auto" />
                  <p className="text-xs text-textMuted">Loading event details from Event Hub...</p>
                </div>
              ) : previewQuery.isError || !previewQuery.data ? (
                <div className="p-6 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs space-y-2">
                  <AlertCircle className="h-6 w-6" />
                  <p className="font-bold">Failed to load event preview.</p>
                  <p className="text-textMuted">The event details might be temporarily unavailable on the server.</p>
                </div>
              ) : (
                (() => {
                  const p = previewQuery.data;
                  return (
                    <div className="space-y-6">
                      {/* Poster Image if available */}
                      {p.posterUrl && (
                        <div className="w-full max-h-72 rounded-2xl overflow-hidden bg-bgPrimary flex items-center justify-center border border-borderColor">
                          <img
                            src={p.posterUrl}
                            alt={p.title}
                            className="max-h-72 w-full object-contain"
                            onError={(e) => {
                              // Hide image if failed to load
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Title & Metadata */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                            {p.totalFees ? `Fee: ₹${p.totalFees}` : 'Free'}
                          </span>
                          {p.conductedBy && (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              By {p.conductedBy}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-textMain tracking-tight">
                          {p.title}
                        </h2>
                      </div>

                      {/* Description */}
                      {p.description && (
                        <div className="p-4 rounded-2xl bg-bgPrimary/60 border border-borderColor/60 text-xs sm:text-sm text-textMain leading-relaxed">
                          <p className="font-bold text-textMuted uppercase text-[10px] mb-1 tracking-wider">
                            Description
                          </p>
                          <p className="whitespace-pre-line">{p.description}</p>
                        </div>
                      )}

                      {/* Key Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-bgPrimary/40 border border-borderColor flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-accentColor shrink-0" />
                          <div>
                            <span className="text-[10px] text-textMuted uppercase font-bold block">Date & Time</span>
                            <span className="font-semibold text-textMain font-mono">{p.date} {p.time ? `• ${p.time}` : ''}</span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-bgPrimary/40 border border-borderColor flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-accentColor shrink-0" />
                          <div>
                            <span className="text-[10px] text-textMuted uppercase font-bold block">Venue</span>
                            <span className="font-semibold text-textMain truncate block max-w-[200px]" title={p.venue}>
                              {p.venue || 'TBA'}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-bgPrimary/40 border border-borderColor flex items-center gap-3">
                          <Users className="h-4 w-4 text-accentColor shrink-0" />
                          <div>
                            <span className="text-[10px] text-textMuted uppercase font-bold block">Participants</span>
                            <span className="font-semibold text-textMain">{p.participants}</span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-bgPrimary/40 border border-borderColor flex items-center gap-3">
                          <IndianRupee className="h-4 w-4 text-accentColor shrink-0" />
                          <div>
                            <span className="text-[10px] text-textMuted uppercase font-bold block">Registration Fee</span>
                            <span className="font-semibold text-textMain font-mono">{p.totalFees ? `₹${p.totalFees}` : 'Free'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Register Action & Feedback */}
                      {registerStatus && registerStatus.eid === p.eid && (
                        <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 shadow-xs ${
                          registerStatus.type === 'success' 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          {registerStatus.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                          )}
                          <div>
                            <span className="font-bold block">
                              {registerStatus.type === 'success' ? 'Registration Result' : 'Registration Notice'}
                            </span>
                            <span className="text-[11px] leading-snug">{registerStatus.message}</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-3 border-t border-borderColor flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <span className="text-xs font-bold text-textMain block">
                            {p.totalFees && !p.totalFees.toLowerCase().includes('free') && p.totalFees !== '0' 
                              ? `Paid Event (₹${p.totalFees})` 
                              : 'Free Event Registration'}
                          </span>
                          <span className="text-[10px] text-textMuted">
                            {p.totalFees && !p.totalFees.toLowerCase().includes('free') && p.totalFees !== '0'
                              ? 'Complete payment via VIT Event Hub portal'
                              : 'One-click registration with your VIT credentials'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {(!p.totalFees || p.totalFees.toLowerCase().includes('free') || p.totalFees === '0') ? (
                            <button
                              type="button"
                              disabled={isRegistering}
                              onClick={() => handleRegisterFree(p.eid)}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              {isRegistering ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  <span>Registering...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Register (Free)</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <a
                              href={`https://eventhubcc.vit.ac.in/EventHub/eventPreview?typeEvent=0&categoryType=&eid=${p.eid}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accentColor hover:bg-accentColor/90 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                            >
                              <span>Pay on Event Hub</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. PROFILE & TEAMS MODAL */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-bgCard border border-borderColor rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-borderColor flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-accentColor" />
                <h3 className="font-bold text-sm text-textMain">Event Hub Portal</h3>
              </div>
              <button
                onClick={() => setIsProfileOpen(false)}
                className="p-1.5 text-textMuted hover:text-textMain rounded-xl border border-borderColor hover:bg-bgPrimary transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Subtabs */}
            <div className="px-5 pt-2 pb-0 border-b border-borderColor flex items-center gap-2 bg-bgPrimary/20 shrink-0">
              <button
                type="button"
                onClick={() => setProfileTab('registered')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  profileTab === 'registered'
                    ? 'border-accentColor text-accentColor'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                Registered Events ({profileQuery.data?.registeredEvents?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setProfileTab('profile')}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  profileTab === 'profile'
                    ? 'border-accentColor text-accentColor'
                    : 'border-transparent text-textMuted hover:text-textMain'
                }`}
              >
                Profile & Teams
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
              {profileQuery.isPending ? (
                <div className="py-12 text-center space-y-2">
                  <RefreshCw className="h-6 w-6 text-accentColor animate-spin mx-auto" />
                  <p className="text-xs text-textMuted">Loading Event Hub profile...</p>
                </div>
              ) : profileQuery.isError || !profileQuery.data ? (
                <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl text-xs">
                  Failed to load Event Hub profile. Please make sure you are logged in.
                </div>
              ) : (
                (() => {
                  const prof = profileQuery.data;

                  if (profileTab === 'registered') {
                    const regEvents = prof.registeredEvents || [];
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-textMain flex items-center gap-1.5">
                            <Ticket className="h-3.5 w-3.5 text-accentColor" />
                            <span>My Registered Events ({regEvents.length})</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => profileQuery.refetch()}
                            className="text-[11px] text-accentColor hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" /> Refresh
                          </button>
                        </div>

                        {regEvents.length === 0 ? (
                          <div className="p-8 text-center bg-bgPrimary/30 rounded-2xl border border-borderColor/60 space-y-2">
                            <Ticket className="h-8 w-8 text-textMuted/40 mx-auto" />
                            <p className="text-xs text-textMuted">No events registered yet.</p>
                            <p className="text-[11px] text-textMuted/70">Browse events and click "Register (Free)" to enroll!</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {regEvents.map((ev: any, idx: number) => {
                              const isFree = ev.paymentStatus?.toLowerCase().includes('free');
                              const isPaid = ev.paymentStatus?.toLowerCase().includes('paid');
                              const isPayNow = ev.paymentStatus?.toLowerCase().includes('pay now');

                              return (
                                <div
                                  key={idx}
                                  className="p-4 rounded-2xl bg-bgPrimary/50 border border-borderColor hover:border-accentColor/30 transition-all space-y-2.5 shadow-xs"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h5 className="font-bold text-xs sm:text-sm text-textMain">
                                        {ev.eventName}
                                      </h5>
                                      <span className="text-[10px] text-textMuted font-mono">
                                        Order #{ev.orderId}
                                      </span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold font-mono tracking-tight uppercase border ${
                                      isFree
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : isPaid
                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                        : isPayNow
                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                        : 'bg-bgCard text-textMuted border-borderColor'
                                    }`}>
                                      {ev.paymentStatus}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-textMuted">
                                    <div className="flex items-center gap-1.5 font-mono">
                                      <Calendar className="h-3 w-3 text-accentColor shrink-0" />
                                      <span>{ev.eventDate} {ev.eventTime ? `• ${ev.eventTime}` : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 truncate">
                                      <MapPin className="h-3 w-3 text-accentColor shrink-0" />
                                      <span className="truncate" title={ev.eventVenue}>{ev.eventVenue}</span>
                                    </div>
                                  </div>

                                  {(ev.receiptUrl || ev.certificateUrl) && (
                                    <div className="pt-2 border-t border-borderColor/60 flex items-center gap-2">
                                      {ev.receiptUrl && (
                                        <a
                                          href={ev.receiptUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bgCard border border-borderColor hover:border-accentColor/40 text-[10px] font-semibold text-textMain transition-colors"
                                        >
                                          <FileText className="h-3 w-3 text-blue-400" />
                                          <span>Receipt</span>
                                        </a>
                                      )}
                                      {ev.certificateUrl && (
                                        <a
                                          href={ev.certificateUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-[10px] font-semibold text-emerald-400 transition-colors"
                                        >
                                          <Award className="h-3 w-3 text-emerald-400" />
                                          <span>Certificate</span>
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-5">
                      {/* User Info Card */}
                      <div className="p-4 rounded-2xl bg-bgPrimary/50 border border-borderColor space-y-3">
                        <div className="flex items-center justify-between border-b border-borderColor/60 pb-2">
                          <span className="text-[10px] font-bold text-textMuted uppercase">VTOP ID</span>
                          <span className="font-mono font-bold text-xs text-accentColor">{prof.userId}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-borderColor/60 pb-2">
                          <span className="text-[10px] font-bold text-textMuted uppercase">Name</span>
                          <span className="font-semibold text-xs text-textMain">{prof.name}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-borderColor/60 pb-2">
                          <span className="text-[10px] font-bold text-textMuted uppercase">Email</span>
                          <span className="text-xs text-textMuted font-mono truncate max-w-[220px]">{prof.email}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-borderColor/60 pb-2">
                          <span className="text-[10px] font-bold text-textMuted uppercase">Phone</span>
                          <span className="text-xs text-textMain font-mono">{prof.phone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-textMuted uppercase">Campus</span>
                          <span className="text-xs font-semibold text-textMain">{prof.college}</span>
                        </div>
                      </div>

                      {/* Teams Section */}
                      <div className="space-y-2.5">
                        <h4 className="font-bold text-xs text-textMain flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-accentColor" />
                          <span>My Teams ({prof.teams?.length || 0})</span>
                        </h4>

                        {!prof.teams || prof.teams.length === 0 ? (
                          <p className="text-xs text-textMuted italic p-3 bg-bgPrimary/30 rounded-xl text-center">
                            No teams created yet on Event Hub.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {prof.teams.map((t: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-bgPrimary border border-borderColor flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-textMain">{t.name}</span>
                                  <span className="text-[10px] text-textMuted font-mono block">ID: {t.id}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-lg bg-accentColor/10 text-accentColor border border-accentColor/20 font-bold text-[10px]">
                                  {t.size} {t.size === '1' ? 'Member' : 'Members'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
