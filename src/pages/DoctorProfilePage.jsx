import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Clock, Star, Calendar, Phone, ArrowLeft } from 'lucide-react';
import { PublicNav, Stars, Loader } from '../components/Layout';
import { providerAPI, reviewAPI, getUser, formatDate, authAPI } from '../utils/api';

// Helper to get doctor name from various field names
const getDoctorName = (provider) => {
  if (!provider) return 'Doctor';
  
  // Try common name fields
  if (provider.fullName && !provider.fullName.includes('Provider')) return provider.fullName;
  if (provider.name && !provider.name.includes('Provider')) return provider.name;
  if (provider.firstName && !provider.firstName.includes('Provider')) return provider.firstName;
  if (provider.doctorName && !provider.doctorName.includes('Provider')) return provider.doctorName;
  
  // Fallback
  return 'Doctor';
};

export default function DoctorProfilePage() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const [provider, setProvider] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Use allSettled so one slow request doesn't block others
        const results = await Promise.allSettled([
          providerAPI.getById(providerId),
          reviewAPI.getByProvider(providerId),
          reviewAPI.getAverage(providerId),
        ]);

        const providerResult = results[0];
        const reviewsResult = results[1];
        const avgResult = results[2];

        if (providerResult.status === 'fulfilled') {
          let providerData = providerResult.value.data;
          console.log('📊 DoctorProfilePage provider data:', providerData);
          
          // Log all fields for debugging
          if (providerData) {
            console.log('🔍 Provider fields:');
            Object.keys(providerData).forEach(key => {
              if (typeof providerData[key] !== 'object') {
                console.log(`   ${key}: ${providerData[key]}`);
              }
            });
          }
          
          // Enrich provider data with user profile if fullName is missing or is generic "Provider #X"
          const isGenericName = !providerData.fullName || 
                                providerData.fullName.includes('Provider') || 
                                providerData.fullName === 'Doctor';
          
          if (isGenericName) {
            // Try multiple possible userId field names
            const possibleUserIds = [
              providerData.userId,
              providerData.user_id,
              providerData.createdBy,
              providerData.createdById,
              providerData.owner_id,
              providerData.ownerId
            ];
            const userIdToFetch = possibleUserIds.find(id => id);
            
            console.log('🔑 User ID candidates:', {
              userId: providerData.userId,
              user_id: providerData.user_id,
              createdBy: providerData.createdBy,
              createdById: providerData.createdById,
              owner_id: providerData.owner_id,
              ownerId: providerData.ownerId,
              selected: userIdToFetch
            });
            
            if (userIdToFetch) {
              try {
                console.log(`🔄 Fetching user profile for userId: ${userIdToFetch}`);
                const userRes = await authAPI.getProfile(userIdToFetch);
                console.log('👤 User profile response:', userRes.data);
                
                if (userRes.data && userRes.data.fullName) {
                  console.log(`✅ SUCCESS! Enriched provider ${providerData.providerId} with name: ${userRes.data.fullName}`);
                  providerData = { ...providerData, fullName: userRes.data.fullName };
                } else {
                  console.warn(`⚠️ User profile returned but has no fullName:`, userRes.data);
                }
              } catch (err) {
                console.warn(`❌ Failed to fetch user profile:`, err.response?.data || err.message);
              }
            } else {
              console.warn(`⚠️ No userId found. Provider object keys:`, Object.keys(providerData));
            }
          } else {
            console.log(`✅ Provider already has good name: ${providerData.fullName}`);
          }
          
          setProvider(providerData);
        } else {
          console.error('Failed to load provider:', providerResult.reason);
          setError('Unable to load doctor information. Please refresh the page.');
        }

        if (reviewsResult.status === 'fulfilled') {
          setReviews(reviewsResult.value.data || []);
        }

        if (avgResult.status === 'fulfilled') {
          setAvgRating(avgResult.value.data.averageRating || 0);
        }
      } catch (err) {
        console.error('Error loading doctor profile:', err);
        setError('Error loading doctor information. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [providerId]);

  if (loading) return <div><PublicNav /><Loader /></div>;
  if (error) {
    return (
      <div>
        <PublicNav />
        <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Oops!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      </div>
    );
  }
  if (!provider) return <div><PublicNav /><div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>Doctor not found</div></div>;

  return (
    <div>
      <PublicNav />
      <div className="container" style={{ padding: '24px 0 48px' }}>
        <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Left */}
          <div>
            {/* Profile Card */}
            <div className="card mb-4">
              <div className="card-body">
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div className="provider-avatar" style={{ width: 88, height: 88, fontSize: 32 }}>
                    {(getDoctorName(provider) || 'D')[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Dr. {getDoctorName(provider)}</h1>
                      {provider.isVerified && <span className="badge badge-green">✓ Verified</span>}
                    </div>
                    <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 15, marginTop: 4 }}>{provider.specialization}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 2 }}>{provider.qualification}</p>
                    <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Stars rating={avgRating} />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{avgRating.toFixed(1)}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>({reviews.length} reviews)</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        🏥 {provider.experienceYears} years experience
                      </div>
                    </div>
                  </div>
                </div>

                {provider.bio && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>About</h3>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>{provider.bio}</p>
                  </div>
                )}

                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>CLINIC</p>
                    <p style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{provider.clinicName}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>ADDRESS</p>
                    <p style={{ fontSize: 14, marginTop: 4 }}>{provider.clinicAddress}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div className="card">
              <div className="card-header"><span className="card-title">Patient Reviews ({reviews.length})</span></div>
              <div className="card-body">
                {reviews.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                    No reviews yet. Be the first to review!
                  </div>
                ) : reviews.map(r => (
                  <div key={r.reviewId} style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <Stars rating={r.rating} size={13} />
                        <p style={{ fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>{r.comment}</p>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 12 }}>
                        {formatDate(r.reviewDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Book Panel */}
          <div>
            <div className="card" style={{ position: 'sticky', top: 80 }}>
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Book an Appointment</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                  Choose a convenient slot and consult {provider.isAvailable ? 'today' : 'when available'} with {getDoctorName(provider)}.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {provider.isAvailable ? (
                    <button className="btn btn-primary w-full" style={{ justifyContent: 'center', padding: 12 }}
                      onClick={() => user ? navigate(`/patient/book/${providerId}`) : navigate('/login')}>
                      <Calendar size={16} /> Book Appointment
                    </button>
                  ) : (
                    <div className="alert alert-warning" style={{ fontSize: 13 }}>
                      Doctor is currently unavailable for new appointments.
                    </div>
                  )}
                  {!user && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Please login to book an appointment</p>
                  )}
                </div>

                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)', textAlign: 'left' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { icon: '✓', label: 'Verified Doctor' },
                      { icon: '🎥', label: 'Video Consultation Available' },
                      { icon: '🔒', label: 'Secure Platform' },
                      { icon: '💊', label: 'Digital Prescriptions' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                        <span>{f.icon}</span><span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
