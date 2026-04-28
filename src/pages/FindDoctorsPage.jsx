import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Grid, List, X } from 'lucide-react';
import { PublicNav, Stars, Loader } from '../components/Layout';
import { providerAPI, getUser, authAPI } from '../utils/api';

const SPECIALIZATIONS = [
  'All', 'Cardiology', 'Dermatology', 'Neurology', 'Orthopedics',
  'Pediatrics', 'Psychiatry', 'General Medicine', 'ENT', 'Gynecology', 'Ophthalmology'
];

const isProviderVerified = (provider) => {
  if (!provider) return false;
  if (typeof provider.isVerified !== 'undefined') return provider.isVerified === true;
  if (typeof provider.verified !== 'undefined') return provider.verified === true;

  const status = (
    provider.verificationStatus ||
    provider.providerStatus ||
    provider.status ||
    ''
  ).toString().toLowerCase();

  return status === 'verified' || status === 'approved' || status === 'active';
};

const isProviderAvailable = (provider) => {
  if (!provider) return false;
  if (typeof provider.isAvailable !== 'undefined') return provider.isAvailable === true;

  const status = (provider.availabilityStatus || '').toString().toLowerCase();
  return status === 'available' || status === 'online';
};

// Fuzzy search helper - matches partial words and substrings
const fuzzyMatch = (text, query) => {
  if (!text || !query) return false;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  
  // Exact substring match (highest priority)
  if (t.includes(q)) return true;
  
  // Word boundary match - e.g., "Cardiol" matches "Cardiology"
  const words = t.split(/\s+/);
  for (let word of words) {
    if (word.startsWith(q)) return true;
  }
  
  // Consecutive character match
  let queryIdx = 0;
  for (let char of t) {
    if (char === q[queryIdx]) queryIdx++;
    if (queryIdx === q.length) return true;
  }
  
  return false;
};

// Helper to get doctor name from various field names
const getDoctorName = (provider) => {
  return provider?.fullName || provider?.name || provider?.firstName || provider?.doctorName || 'Doctor';
};

export default function FindDoctorsPage() {
  const navigate = useNavigate();
  const user = getUser();
  const [searchParams] = useSearchParams();

  const [allProviders, setAllProviders] = useState([]);
  const [displayedCount, setDisplayedCount] = useState(12);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const searchTimeoutRef = useRef(null);
  const [activeSpec, setActiveSpec] = useState(searchParams.get('spec') || 'All');
  const [cityFilter, setCityFilter] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const cityTimeoutRef = useRef(null);
  const [sortBy, setSortBy] = useState('rating');
  const [showAll, setShowAll] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadAbortRef = useRef(null);

  // Debounce search input (wait 500ms after user stops typing)
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setDisplayedCount(12);
    }, 500);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [search]);

  // Debounce city filter (wait 500ms)
  useEffect(() => {
    if (cityTimeoutRef.current) clearTimeout(cityTimeoutRef.current);
    cityTimeoutRef.current = setTimeout(() => {
      setDebouncedCity(cityFilter);
      setDisplayedCount(12);
    }, 500);
    return () => clearTimeout(cityTimeoutRef.current);
  }, [cityFilter]);

  // Load all providers on mount - progressive/streaming approach
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        setLoadingMore(true);
        
        // Fetch all data but show progressively
        let allFetched = [];
        try {
          const availableRes = await providerAPI.getAvailable();
          allFetched = Array.isArray(availableRes.data) ? availableRes.data : [];
        } catch (err) {
          try {
            const allRes = await providerAPI.getAll();
            allFetched = Array.isArray(allRes.data) ? allRes.data : [];
          } catch (fallbackErr) {
            console.error('Failed to load providers:', fallbackErr);
            allFetched = [];
          }
        }
        
        // Enrich provider data with user profile if missing fullName
        console.log('📊 Sample provider data:', allFetched[0]);
        const enrichedProviders = await Promise.all(allFetched.map(async (provider) => {
          let providerWithName = { ...provider };
          
          // Check if fullName is missing
          if (!providerWithName.fullName) {
            // Try userId first
            const userIdToFetch = provider.userId || provider.user_id || provider.createdBy;
            
            if (userIdToFetch) {
              try {
                const userRes = await authAPI.getProfile(userIdToFetch);
                if (userRes.data && userRes.data.fullName) {
                  console.log(`✓ Enriched provider ${provider.providerId} with name: ${userRes.data.fullName}`);
                  providerWithName.fullName = userRes.data.fullName;
                }
              } catch (err) {
                console.warn(`⚠ Failed to enrich provider ${provider.providerId}:`, err.message);
              }
            } else {
              console.log(`⚠ Provider ${provider.providerId} missing fullName and userId`);
            }
          }
          
          return providerWithName;
        }));
        
        setAllProviders(enrichedProviders);
        setDisplayedCount(12);
        setLoading(false);
      } finally {
        setLoadingMore(false);
      }
    };
    loadProviders();
  }, []);

  const loadMore = () => {
    setDisplayedCount(prev => prev + 12);
  };

  const normalizedProviders = useMemo(() => {
    return allProviders
      .filter(isProviderVerified)
      .map((provider) => {
        const doctorName = getDoctorName(provider);
        const searchText = [
          doctorName,
          provider.specialization,
          provider.qualification,
          provider.clinicName,
          provider.clinicAddress,
          provider.city,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return {
          ...provider,
          _isAvailable: isProviderAvailable(provider),
          _searchText: searchText,
        };
      });
  }, [allProviders]);

  // Filter and sort providers
  const filteredProviders = useMemo(() => {
    let result = [...normalizedProviders];

    // Apply availability filter
    if (!showAll) {
      result = result.filter(p => p._isAvailable === true);
    }

    // Apply specialization filter
    if (activeSpec !== 'All') {
      result = result.filter(p => p.specialization === activeSpec);
    }

    // Apply search filter FIRST - check name AND specialization with fuzzy matching
    if (debouncedSearch.trim()) {
      const normalizedSearch = debouncedSearch.trim().toLowerCase();
      result = result.filter(p =>
        p._searchText.includes(normalizedSearch) ||
        fuzzyMatch(p.fullName, debouncedSearch) ||
        fuzzyMatch(p.specialization, debouncedSearch) ||
        fuzzyMatch(p.qualification, debouncedSearch)
      );
    }

    // Apply city filter
    if (debouncedCity.trim()) {
      const cityLower = debouncedCity.toLowerCase();
      result = result.filter(p =>
        (p.clinicAddress?.toLowerCase().includes(cityLower) ||
         p.clinicName?.toLowerCase().includes(cityLower) ||
         p.city?.toLowerCase().includes(cityLower))
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return (b.avgRating || 0) - (a.avgRating || 0);
        case 'price_low':
          return (a.consultationFee || 0) - (b.consultationFee || 0);
        case 'price_high':
          return (b.consultationFee || 0) - (a.consultationFee || 0);
        case 'experience':
          return (b.experienceYears || 0) - (a.experienceYears || 0);
        default:
          return 0;
      }
    });

    // Apply pagination: only show up to displayedCount
    return result.slice(0, displayedCount);
  }, [normalizedProviders, debouncedSearch, activeSpec, debouncedCity, sortBy, showAll, displayedCount]);

  const totalFilteredCount = useMemo(() => {
    let result = [...normalizedProviders];
    if (!showAll) result = result.filter(p => p._isAvailable === true);
    if (activeSpec !== 'All') result = result.filter(p => p.specialization === activeSpec);
    if (debouncedSearch.trim()) {
      const normalizedSearch = debouncedSearch.trim().toLowerCase();
      result = result.filter(p =>
        p._searchText.includes(normalizedSearch) ||
        fuzzyMatch(p.fullName, debouncedSearch) ||
        fuzzyMatch(p.specialization, debouncedSearch) ||
        fuzzyMatch(p.qualification, debouncedSearch)
      );
    }
    if (debouncedCity.trim()) {
      const cityLower = debouncedCity.toLowerCase();
      result = result.filter(p =>
        (p.clinicAddress?.toLowerCase().includes(cityLower) ||
         p.clinicName?.toLowerCase().includes(cityLower) ||
         p.city?.toLowerCase().includes(cityLower))
      );
    }
    return result.length;
  }, [normalizedProviders, debouncedSearch, activeSpec, debouncedCity, showAll]);

  const hasActiveFilters = debouncedSearch || activeSpec !== 'All' || debouncedCity;

  const clearAllFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActiveSpec('All');
    setCityFilter('');
    setDebouncedCity('');
  };

  const SkeletonCard = () => (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e5e7eb', margin: '0 auto' }} />
      <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4 }} />
      <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '80%', margin: '0 auto' }} />
      <div style={{ height: 10, background: '#e5e7eb', borderRadius: 4, width: '60%', margin: '0 auto' }} />
      <div style={{ height: 32, background: '#e5e7eb', borderRadius: 4, marginTop: 8 }} />
    </div>
  );

  return (
    <>
      <PublicNav />
      <div style={{ background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--bg) 100%)', paddingTop: 40, paddingBottom: 40 }}>
        <div className="container">
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Find Doctors</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            {loading ? 'Loading...' : `${filteredProviders.length} of ${totalFilteredCount} doctors found`}
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        {/* Search and City Filters */}
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
		  <div style={{ position: 'relative' }}>
			<Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
			<input
			  type="text"
			  className="form-input"
			  placeholder="Search by name..."
			  value={search}
			  onChange={(e) => setSearch(e.target.value)}
			  style={{ paddingLeft: 40, fontSize: 14 }}
			/>
		  </div>
		  <div style={{ position: 'relative' }}>
			<MapPin size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
			<input
			  type="text"
			  className="form-input"
			  placeholder="Filter by city..."
			  value={cityFilter}
			  onChange={(e) => setCityFilter(e.target.value)}
			  style={{ paddingLeft: 40, fontSize: 14 }}
			/>
		  </div>
		</div>

        {/* Specialization Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20, scrollBehavior: 'smooth' }}>
          {SPECIALIZATIONS.map(spec => (
            <button
              key={spec}
              className={activeSpec === spec ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => setActiveSpec(spec)}
              style={{ whiteSpace: 'nowrap', fontSize: 13, padding: '6px 12px' }}
            >
              {spec}
            </button>
          ))}
        </div>

        {/* Controls Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          {/* Show All Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
              <div style={{
                width: 44,
                height: 24,
                background: showAll ? 'var(--primary)' : 'var(--border)',
                borderRadius: 12,
                position: 'relative',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 20,
                  height: 20,
                  background: 'white',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: 2,
                  left: showAll ? 22 : 2,
                  transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {showAll ? 'All Doctors' : '✓ Available Only'}
              </span>
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Sort and View Toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: 'auto', minWidth: 120, fontSize: 13 }}
            >
              <option value="rating">Top Rated</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="experience">Most Experienced</option>
            </select>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
                style={{ padding: '8px 10px' }}
              >
                <Grid size={18} />
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('list')}
                title="List view"
                style={{ padding: '8px 10px' }}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
            {activeSpec !== 'All' && (
              <div className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}>
                Specialty: {activeSpec}
                <button
                  onClick={() => setActiveSpec('All')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  title="Clear"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {cityFilter && (
              <div className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}>
                City: {cityFilter}
                <button
                  onClick={() => setCityFilter('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  title="Clear"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {search && (
              <div className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13 }}>
                Search: {search}
                <button
                  onClick={() => setSearch('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  title="Clear"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <button
              className="btn btn-outline btn-sm"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results */}
        {loading && filteredProviders.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>n
            {Array(12).fill(0).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredProviders.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>No doctors found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Try adjusting your search or filters</p>
            <button
              className="btn btn-primary"
              onClick={clearAllFilters}
            >
              Clear all filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {filteredProviders.map(provider => (
                <ProviderGridCard key={provider.providerId} provider={provider} user={user} navigate={navigate} />
              ))}
              {loading && Array(4).fill(0).map((_, i) => (
                <SkeletonCard key={`skeleton-${i}`} />
              ))}
            </div>
            {filteredProviders.length < totalFilteredCount && (
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <button
                  className="btn btn-primary"
                  onClick={loadMore}
                  disabled={loading}
                  style={{ minWidth: 200 }}
                >
                  {loading ? 'Loading more doctors...' : `Load More (${totalFilteredCount - filteredProviders.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredProviders.map(provider => (
                <ProviderListCard key={provider.providerId} provider={provider} user={user} navigate={navigate} />
              ))}
            </div>
            {filteredProviders.length < totalFilteredCount && (
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <button
                  className="btn btn-primary"
                  onClick={loadMore}
                  disabled={loading}
                  style={{ minWidth: 200 }}
                >
                  {loading ? 'Loading more doctors...' : `Load More (${totalFilteredCount - filteredProviders.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Grid Card Component ──
function ProviderGridCard({ provider, user, navigate }) {
  const getInitial = (name) => name?.charAt(0).toUpperCase() || '?';
  const getInitialBg = (name) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };
  const doctorName = getDoctorName(provider);

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.2s',
        cursor: 'pointer',
        position: 'relative',
        padding: '14px',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Availability Indicator */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: provider.isAvailable ? '#10b981' : '#9ca3af',
        zIndex: 1,
      }} />

      {/* Profile Picture */}
      <div style={{ textAlign: 'center' }}>
        {provider.profilePicUrl ? (
          <img
            src={provider.profilePicUrl}
            alt={doctorName}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--border)',
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: getInitialBg(doctorName),
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              margin: '0 auto',
            }}
          >
            {getInitial(doctorName)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
          Dr. {doctorName}
        </div>
        <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
          {provider.specialization}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 6, lineHeight: 1.3 }}>
          {provider.qualification} • {provider.experienceYears || 0}y
        </div>

        {/* Rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Stars rating={provider.avgRating || 0} size={10} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {provider.avgRating ? provider.avgRating.toFixed(1) : 'New'}
          </span>
        </div>

        {/* Fee */}
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
          {provider.consultationFee ? `₹${provider.consultationFee}` : 'Fee N/A'}
        </div>

        {/* Location */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          <MapPin size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{provider.clinicName || provider.clinicAddress}</span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => navigate(`/doctor/${provider.providerId}`)}
          style={{ flex: 1, fontSize: 12 }}
        >
          View Profile
        </button>
        {user && user.role === 'Patient' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/patient/book/${provider.providerId}`)}
            style={{ flex: 1, fontSize: 12 }}
          >
            Book Now
          </button>
        )}
      </div>
    </div>
  );
}

// ── List Card Component ──
function ProviderListCard({ provider, user, navigate }) {
  const getInitial = (name) => name?.charAt(0).toUpperCase() || '?';
  const getInitialBg = (name) => {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };
  const doctorName = getDoctorName(provider);

  return (
    <div
      className="card"
      style={{
        display: 'grid',
        gridTemplateColumns: '70px 1fr',
        gap: 12,
        alignItems: 'start',
        padding: 12,
      }}
    >
      {/* Profile Picture */}
      <div style={{ position: 'relative' }}>
        {provider.profilePicUrl ? (
          <img
            src={provider.profilePicUrl}
            alt={doctorName}
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--border)',
            }}
          />
        ) : (
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: getInitialBg(doctorName),
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {getInitial(doctorName)}
          </div>
        )}
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: provider.isAvailable ? '#10b981' : '#9ca3af',
          border: '2px solid white',
        }} />
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Name and Spec */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Dr. {doctorName}
          </div>
          <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>
            {provider.specialization}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {provider.qualification}
          </div>
        </div>

        {/* Bio (truncated) */}
        {provider.bio && (
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {provider.bio}
          </div>
        )}

        {/* Rating, Fee, Location Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Stars rating={provider.avgRating || 0} size={10} />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {provider.avgRating ? provider.avgRating.toFixed(1) : 'New'}
            </span>
          </div>
          <div style={{ fontWeight: 600 }}>
            {provider.consultationFee ? `₹${provider.consultationFee}` : 'Fee N/A'}
          </div>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
            <MapPin size={12} />
            <span>{provider.clinicName || provider.clinicAddress || 'Address N/A'}</span>
          </div>
        </div>

        {/* Badges and Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {provider.isVerified && (
            <span className="badge badge-green" style={{ fontSize: 11, padding: '4px 8px' }}>✓ Verified</span>
          )}
          <span className={provider.isAvailable ? 'badge badge-green' : 'badge badge-gray'} style={{ fontSize: 11, padding: '4px 8px' }}>
            {provider.isAvailable ? '● Avail' : '● Unavail'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate(`/doctor/${provider.providerId}`)}
              style={{ fontSize: 12 }}
            >
              View
            </button>
            {user && user.role === 'Patient' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/patient/book/${provider.providerId}`)}
                style={{ fontSize: 12 }}
              >
                Book
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}