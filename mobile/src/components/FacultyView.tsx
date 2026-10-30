import React, { useState, useEffect, useRef } from 'react';
import { 
  Loader2, Search, Mail, MapPin, Building, Award, GraduationCap, 
  AlertCircle, X, ChevronRight, Copy, Check, ArrowLeft 
} from 'lucide-react';
import { searchFaculty, getFacultyDirectory } from '../lib/api';
import { safeGetCache, safeSetCache } from '../lib/cache';
import { facultyDirectory } from '../data/facultyDirectory';

export const FacultyView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [empId, setEmpId] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; id: string }[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faculty, setFaculty] = useState<any | null>(null);
  const [searchResults, setSearchResults] = useState<{ name: string; id: string }[]>([]);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [directory, setDirectory] = useState<Record<string, string>>(() => {
    // Optimistic offline loading from bundled directory or cache
    const cached = safeGetCache<Record<string, string>>('vtop_cache_faculty_directory');
    const valid = cached && typeof cached === 'object' && !('status' in cached) && Object.keys(cached).length > 0
      ? cached
      : (cached && typeof cached === 'object' && (cached as any).directory ? (cached as any).directory : null);
    return valid || facultyDirectory;
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Background directory refresh
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const res = await getFacultyDirectory();
        const resData: any = res?.data;
        const dir = resData?.directory || (resData?.status === 'success' ? resData?.raw_data : resData);
        if (dir && typeof dir === 'object' && !('status' in dir) && Object.keys(dir).length > 0) {
          setDirectory(dir);
          safeSetCache('vtop_cache_faculty_directory', dir);
        }
      } catch (err) {
        console.warn('Faculty directory background sync bypassed:', err);
      }
    };
    fetchDirectory();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerSearch = async (targetId: string, facultyNameHint?: string) => {
    if (!targetId.trim()) return;

    setLoading(true);
    setError(null);
    setFaculty(null);
    setIsDropdownOpen(false);

    try {
      const res = await searchFaculty(targetId.trim());
      const data = res.data?.raw_data || (res.data?.status === 'success' ? res.data.raw_data : res.data);
      if (data && (data.name || data.email)) {
        setFaculty({
          ...data,
          empId: targetId.trim()
        });
        setEmpId(targetId.trim());
      } else {
        // Fallback check in local directory
        const lower = targetId.trim().toLowerCase();
        let fallbackName = facultyNameHint || '';
        let fallbackId = targetId.trim();
        if (!fallbackName) {
          for (const [name, id] of Object.entries(directory)) {
            if (id === fallbackId || name.toLowerCase() === lower) {
              fallbackName = name;
              fallbackId = id;
              break;
            }
          }
        }
        if (fallbackName) {
          setFaculty({
            name: fallbackName,
            empId: fallbackId,
            designation: 'Faculty Member',
            department: 'VIT Chennai',
            school: 'VIT Chennai',
            email: `${fallbackId}@vit.ac.in`,
            cabin: 'Connect to VTOP for cabin',
            image: null,
            isOfflineRecord: true
          });
          setEmpId(fallbackId);
        } else {
          setError('Faculty details not found for this query.');
        }
      }
    } catch (err: any) {
      console.warn('Faculty live search failed, trying local directory:', err);
      const lower = targetId.trim().toLowerCase();
      let fallbackName = facultyNameHint || '';
      let fallbackId = targetId.trim();
      if (!fallbackName) {
        for (const [name, id] of Object.entries(directory)) {
          if (id === fallbackId || name.toLowerCase() === lower) {
            fallbackName = name;
            fallbackId = id;
            break;
          }
        }
      }
      if (fallbackName) {
        setFaculty({
          name: fallbackName,
          empId: fallbackId,
          designation: 'Faculty Member',
          department: 'VIT Chennai',
          school: 'VIT Chennai',
          email: `${fallbackId}@vit.ac.in`,
          cabin: 'Connect to VTOP for cabin',
          image: null,
          isOfflineRecord: true
        });
        setEmpId(fallbackId);
      } else {
        setError(err.response?.data?.message || err.message || 'Faculty details not found.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsDropdownOpen(false);

    // 1. Direct Employee ID (Numeric)
    if (/^\d+$/.test(query)) {
      setSearchResults([]);
      setEmpId(query);
      triggerSearch(query);
      return;
    }

    // 2. Query directory for all matches
    const lower = query.toLowerCase();
    const matches = Object.entries(directory)
      .filter(([name, id]) => name.toLowerCase().includes(lower) || id.includes(lower))
      .map(([name, id]) => ({ name, id }));

    if (matches.length === 1) {
      // Single match -> load directly
      setSearchResults([]);
      selectFaculty(matches[0]);
    } else if (matches.length > 1) {
      // Multiple matches -> show search results list
      setFaculty(null);
      setError(null);
      setSearchResults(matches);
    } else {
      // No directory match -> query server directly
      setSearchResults([]);
      triggerSearch(query);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim().length >= 2) {
      const query = value.toLowerCase();
      const matches = Object.entries(directory)
        .filter(([name, id]) => name.toLowerCase().includes(query) || id.includes(query))
        .slice(0, 10)
        .map(([name, id]) => ({ name, id }));
      setSuggestions(matches);
      setIsDropdownOpen(true);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  };

  const selectFaculty = (fac: { name: string; id: string }) => {
    setSearchQuery(fac.name);
    setEmpId(fac.id);
    setIsDropdownOpen(false);
    triggerSearch(fac.id, fac.name);
  };

  const copyEmailToClipboard = (email: string) => {
    if (!email) return;
    try {
      navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (_e) {}
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Search Header panel */}
      <div className="bg-bgCard border border-borderColor rounded-2xl p-5 shadow-xs space-y-3">
        <div>
          <h3 className="text-base font-bold text-textMain">Faculty Directory Search</h3>
          <p className="text-xs text-textMuted mt-0.5">
            Search by faculty name or 5-digit employee ID (e.g. "Vinitha" or "50143")
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2.5 relative">
          <div ref={searchContainerRef} className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-textMuted" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchQuery.trim().length >= 2 && suggestions.length > 0) {
                  setIsDropdownOpen(true);
                }
              }}
              placeholder="e.g. Vinitha, Ramesh, or 50143"
              disabled={loading}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-borderColor bg-bgPrimary text-textMain focus:ring-2 focus:ring-accentColor focus:border-transparent outline-none transition-all text-xs sm:text-sm font-semibold"
            />

            {/* Clear Button */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setEmpId('');
                  setSuggestions([]);
                  setIsDropdownOpen(false);
                  setSearchResults([]);
                  setFaculty(null);
                  setError(null);
                }}
                className="absolute right-3 top-3 text-textMuted hover:text-textMain p-0.5 rounded transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Suggestions Dropdown (Touch-friendly Pointer events) */}
            {isDropdownOpen && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-bgCard border border-borderColor rounded-2xl shadow-2xl overflow-hidden z-40 max-h-64 overflow-y-auto divide-y divide-borderColor/60 overscroll-contain">
                {suggestions.map((fac) => (
                  <button
                    key={fac.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      selectFaculty(fac);
                    }}
                    className="w-full text-left px-4 py-3 text-xs hover:bg-bgPrimary text-textMain transition-colors flex justify-between items-center cursor-pointer font-medium active:bg-accentColor/10"
                  >
                    <span className="font-semibold truncate mr-2">{fac.name}</span>
                    <span className="text-[10px] text-textMuted font-mono bg-bgPrimary border border-borderColor px-2 py-0.5 rounded shrink-0">
                      {fac.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="px-5 py-2.5 bg-accentColor hover:bg-accentColor/90 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-xs sm:text-sm shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-xs animate-in fade-in duration-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <div className="flex-1">
            <p className="font-bold">Search Notice</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Multiple Matching Faculty Members Selection List */}
      {searchResults.length > 0 && !faculty && !loading && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider">
              Found {searchResults.length} matches for "{searchQuery}"
            </h4>
            <span className="text-[11px] text-textMuted">Tap a faculty member to view details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {searchResults.map((fac) => (
              <button
                key={fac.id}
                type="button"
                onClick={() => selectFaculty(fac)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-bgCard border border-borderColor hover:bg-bgPrimary transition-all text-left cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-accentColor/10 text-accentColor flex items-center justify-center font-bold text-xs shrink-0 border border-accentColor/20">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-xs text-textMain truncate">{fac.name}</h5>
                    <p className="text-[11px] text-textMuted font-mono mt-0.5">Emp ID: {fac.id}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-textMuted shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Faculty Profile View */}
      {faculty && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {searchResults.length > 1 && (
            <button
              onClick={() => setFaculty(null)}
              className="inline-flex items-center gap-1.5 text-xs text-accentColor font-bold hover:underline cursor-pointer px-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to all {searchResults.length} search results</span>
            </button>
          )}

          <div className="bg-bgCard border border-borderColor rounded-2xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-borderColor">
            {/* Avatar & Key Identification */}
            <div className="p-6 flex flex-col items-center justify-center space-y-4 bg-bgPrimary/30 md:col-span-1 text-center">
              <div className="h-28 w-28 rounded-2xl bg-bgCard border border-borderColor overflow-hidden relative shadow-inner flex items-center justify-center">
                {faculty.image ? (
                  <img
                    src={faculty.image}
                    alt={faculty.name || 'Faculty Avatar'}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <GraduationCap className="h-12 w-12 text-textMuted" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-textMain text-sm sm:text-base leading-snug">
                  {faculty.name || 'Faculty Member'}
                </h4>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accentColor/10 border border-accentColor/20 text-accentColor text-xs font-mono font-bold">
                  <span>ID: {faculty.empId || empId || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Faculty Specifications */}
            <div className="p-6 md:col-span-2 space-y-5">
              <div className="flex items-center justify-between border-b border-borderColor pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-textMuted">
                  Faculty Profile Details
                </h3>
                {faculty.isOfflineRecord && (
                  <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    Directory Record
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                {/* Designation */}
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shrink-0 mt-0.5">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-textMuted block text-[11px] mb-0.5">Designation</span>
                    <p className="font-bold text-textMain">{faculty.designation || 'Faculty Member'}</p>
                  </div>
                </div>

                {/* Department */}
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shrink-0 mt-0.5">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-textMuted block text-[11px] mb-0.5">Department</span>
                    <p className="font-bold text-textMain">{faculty.department || 'VIT Chennai'}</p>
                  </div>
                </div>

                {/* School */}
                <div className="flex items-start space-x-3 sm:col-span-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0 mt-0.5">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-textMuted block text-[11px] mb-0.5">School / Centre</span>
                    <p className="font-bold text-textMain">{faculty.school || 'VIT Chennai'}</p>
                  </div>
                </div>

                {/* E-Mail */}
                <div className="flex items-start space-x-3 sm:col-span-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shrink-0 mt-0.5">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-textMuted block text-[11px] mb-0.5">E-Mail Address</span>
                    <div className="flex items-center gap-2">
                      <a 
                        href={`mailto:${faculty.email}`} 
                        className="font-bold text-textMain hover:text-accentColor transition-colors truncate select-all underline decoration-dotted"
                      >
                        {faculty.email || `${faculty.empId || empId}@vit.ac.in`}
                      </a>
                      <button
                        type="button"
                        onClick={() => copyEmailToClipboard(faculty.email || `${faculty.empId || empId}@vit.ac.in`)}
                        className="p-1 rounded-lg text-textMuted hover:text-textMain bg-bgPrimary border border-borderColor cursor-pointer transition-colors"
                        title="Copy email"
                      >
                        {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cabin */}
                <div className="flex items-start space-x-3 sm:col-span-2">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-textMuted block text-[11px] mb-0.5">Cabin Location</span>
                    <p className="font-bold text-textMain font-mono">{faculty.cabin || 'Visit School Office'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
