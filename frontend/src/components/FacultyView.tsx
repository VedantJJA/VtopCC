import React, { useState, useEffect } from 'react';
import { Loader2, Search, Mail, MapPin, Building, Award, GraduationCap, AlertCircle } from 'lucide-react';
import { searchFaculty, getFacultyDirectory } from '../lib/api';

export const FacultyView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [empId, setEmpId] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faculty, setFaculty] = useState<any | null>(null);
  const [directory, setDirectory] = useState<Record<string, string>>(() => {
    // Load from cache optimistically for offline compatibility
    const cached = localStorage.getItem('vtop_cache_faculty_directory');
    return cached ? JSON.parse(cached) : {};
  });

  // Fetch full consolidated directory map from backend on mount
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const res = await getFacultyDirectory();
        if (res.data.status === 'success' && res.data.directory) {
          setDirectory(res.data.directory);
          localStorage.setItem('vtop_cache_faculty_directory', JSON.stringify(res.data.directory));
        }
      } catch (err) {
        console.error('Failed to load faculty directory from backend:', err);
      }
    };
    fetchDirectory();
  }, []);

  const triggerSearch = async (targetId: string) => {
    if (!targetId.trim()) return;

    setLoading(true);
    setError(null);
    setFaculty(null);

    try {
      const res = await searchFaculty(targetId.trim());
      if (res.data.status === 'success' && res.data.raw_data) {
        setFaculty(res.data.raw_data);
      } else {
        setError('Faculty details not found for this Employee ID.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Faculty details not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const searchTarget = empId || searchQuery;
    if (/^\d+$/.test(searchTarget.trim())) {
      triggerSearch(searchTarget);
    } else {
      setError('Please select a faculty member from the suggestion list or enter a numeric Employee ID.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    // If fully numeric, allow direct empId search
    if (/^\d+$/.test(value.trim())) {
      setEmpId(value.trim());
    } else {
      // Check if it matches a name in directory exactly
      const exactMatch = Object.entries(directory).find(
        ([name]) => name.toLowerCase() === value.trim().toLowerCase()
      );
      if (exactMatch) {
        setEmpId(exactMatch[1]);
      } else {
        setEmpId('');
      }
    }

    if (value.trim().length >= 2) {
      const query = value.toLowerCase();
      const matches = Object.entries(directory)
        .filter(([name, id]) => name.toLowerCase().includes(query) || id.includes(query))
        .slice(0, 10)
        .map(([name, id]) => ({ name, id }));
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const selectFaculty = (fac: { name: string; id: string }) => {
    setSearchQuery(fac.name);
    setEmpId(fac.id);
    setSuggestions([]);
    triggerSearch(fac.id);
  };

  const handleBlur = () => {
    // Delay slightly to let the click handler on suggestion register
    setTimeout(() => {
      setSuggestions([]);
    }, 200);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Search Header panel */}
      <div className="bg-bgCard border border-borderColor rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-textMain">Search Faculty Directory</h3>
        <p className="text-xs text-textMuted">
          Type a name or employee ID to query our live directory. Select from the dropdown for instant lookup.
        </p>
        <form onSubmit={handleSearchSubmit} className="flex gap-3 max-w-lg relative">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-textMuted" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) {
                  const query = searchQuery.toLowerCase();
                  const matches = Object.entries(directory)
                    .filter(([name, id]) => name.toLowerCase().includes(query) || id.includes(query))
                    .slice(0, 10)
                    .map(([name, id]) => ({ name, id }));
                  setSuggestions(matches);
                }
              }}
              onBlur={handleBlur}
              placeholder="e.g. Viswanathan or 50300"
              disabled={loading}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-borderColor bg-bgPrimary text-textMain focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-sm font-semibold"
            />

            {/* Suggestions Overlay Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-bgCard border border-borderColor rounded-2xl shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto divide-y divide-borderColor/60">
                {suggestions.map((fac) => (
                  <button
                    key={fac.id}
                    type="button"
                    onClick={() => selectFaculty(fac)}
                    className="w-full text-left px-4 py-3 text-xs hover:bg-bgPrimary text-textMain transition-colors flex justify-between items-center cursor-pointer font-medium"
                  >
                    <span>{fac.name}</span>
                    <span className="text-[10px] text-textMuted font-mono bg-bgPrimary border border-borderColor px-2 py-0.5 rounded">
                      {fac.id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || (!empId.trim() && !/^\d+$/.test(searchQuery.trim()))}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-700/50 text-white rounded-xl font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm text-sm shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 rounded-2xl flex gap-2 text-sm animate-in fade-in duration-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {faculty && (
        <div className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-borderColor">
          {/* Avatar side */}
          <div className="p-6 flex flex-col items-center justify-center space-y-4 bg-bgPrimary/20 md:col-span-1">
            <div className="h-32 w-32 rounded-2xl bg-bgCard border border-borderColor overflow-hidden relative shadow-inner flex items-center justify-center">
              {faculty.image ? (
                <img
                  src={faculty.image}
                  alt={faculty.name || 'Faculty Avatar'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <GraduationCap className="h-16 w-16 text-textMuted" />
              )}
            </div>
            <div className="text-center">
              <h4 className="font-bold text-textMain text-sm sm:text-base">{faculty.name || 'N/A'}</h4>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mt-1">{empId || faculty.email?.split('@')[0] || ''}</p>
            </div>
          </div>

          {/* Details side */}
          <div className="p-6 md:col-span-2 space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-textMuted border-b border-borderColor pb-2">Faculty Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="flex items-start space-x-3">
                <Award className="h-4 w-4 text-accentColor mt-0.5" />
                <div>
                  <span className="text-textMuted block mb-0.5">Designation</span>
                  <p className="font-bold text-textMain">{faculty.designation || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Building className="h-4 w-4 text-accentColor mt-0.5" />
                <div>
                  <span className="text-textMuted block mb-0.5">Department</span>
                  <p className="font-bold text-textMain">{faculty.department || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 sm:col-span-2">
                <GraduationCap className="h-4 w-4 text-accentColor mt-0.5" />
                <div>
                  <span className="text-textMuted block mb-0.5">School / Centre Name</span>
                  <p className="font-bold text-textMain">{faculty.school || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 sm:col-span-2">
                <Mail className="h-4 w-4 text-accentColor mt-0.5" />
                <div>
                  <span className="text-textMuted block mb-0.5">E-Mail ID</span>
                  <p className="font-bold text-textMain select-all">{faculty.email || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin className="h-4 w-4 text-accentColor mt-0.5" />
                <div>
                  <span className="text-textMuted block mb-0.5">Cabin Number</span>
                  <p className="font-bold text-textMain font-mono">{faculty.cabin || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
