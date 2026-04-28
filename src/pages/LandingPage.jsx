import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, Clock, Star, ArrowRight, CheckCircle, Heart, Stethoscope, Brain, Eye, Bone, Baby, Smile, Activity } from 'lucide-react';
import { PublicNav } from '../components/Layout';

// Homepage background SVG as external file
import homepageBg from '../assets/homepage-bg.svg';

const SPECIALIZATIONS = [
  { icon: '❤️', name: 'Cardiologist' }, { icon: '🧠', name: 'Neurologist' },
  { icon: '👁️', name: 'Ophthalmologist' }, { icon: '🦷', name: 'Dentist' },
  { icon: '🦴', name: 'Orthopedist' }, { icon: '👶', name: 'Pediatrician' },
  { icon: '🩺', name: 'General Physician' }, { icon: '🧬', name: 'Dermatologist' },
];

const FEATURES = [
  { icon: '🔍', title: 'Find the Right Doctor', desc: 'Search by specialization, name, or location. Filter by rating, availability, and consultation mode.' },
  { icon: '📅', title: 'Easy Scheduling', desc: 'View real-time availability calendars and book appointments in under 2 minutes.' },
  { icon: '💊', title: 'Digital Medical Records', desc: 'Access your complete medical history, prescriptions, and follow-up reminders anytime.' },
  { icon: '🔒', title: 'Secure & Private', desc: 'HIPAA-compliant platform with AES-256 encryption for all medical data.' },
  { icon: '📱', title: 'Teleconsultation', desc: 'Consult from the comfort of your home via high-quality video calls.' },
  { icon: '💳', title: 'Flexible Payments', desc: 'Pay via UPI, Card, Wallet, or at the clinic. Instant refunds on cancellation.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/find-doctors${search ? `?q=${search}` : ''}`);
  };

  return (
    <div>
      <PublicNav />

      {/* Hero */}
      <section className="hero" style={{
        position: 'relative',
        minHeight: 420,
        background: `url(${homepageBg}) center/cover no-repeat`,
        filter: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* White overlay for readability */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(255,255,255,0.68)',
          zIndex: 1
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div className="hero-content" style={{ color: '#14532d', textShadow: '0 2px 12px rgba(0,0,0,0.10)' }}>
            <div className="hero-tag" style={{ background: 'rgba(255,255,255,0.18)', color: '#14532d', fontWeight: 700 }}>
              <CheckCircle size={14} /> Modern Health Connect
            </div>
            <h1 className="hero-title" style={{ fontWeight: 800, fontSize: 44, color: '#14532d', textShadow: '0 2px 12px rgba(0,0,0,0.13)' }}>
              Care. Connect.<br />
              <span style={{ color: '#22c55e', textShadow: '0 2px 12px rgba(0,0,0,0.13)' }}>Thrive Together</span>
            </h1>
            <p className="hero-sub" style={{ fontSize: 18, color: '#14532d', fontWeight: 500, textShadow: '0 2px 12px rgba(0,0,0,0.10)' }}>
              Find trusted doctors, book appointments, and manage your health journey with privacy and ease.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="hero-search">
              <Search size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search doctors, specializations, symptoms..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.85)' }}
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>

            {/* Stats */}
            <div className="hero-stats">
              {[
                { num: '700+', label: 'Expert Providers' },
                { num: '60k+', label: 'Satisfied Users' },
                { num: '25+', label: 'Specialties' },
                { num: '4.9★', label: 'Avg. User Rating' },
              ].map(s => (
                <div key={s.label}>
                  <div className="hero-stat-num">{s.num}</div>
                  <div className="hero-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Specializations */}
      <section className="section" style={{ background: '#fff' }}>
        <div className="container">
          <div className="text-center mb-4">
            <h2 className="section-title">Browse by Specialization</h2>
            <p className="section-sub">Find the right specialist for your needs</p>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 16 }}>
            {SPECIALIZATIONS.map(spec => (
              <div key={spec.name} className="spec-pill" onClick={() => navigate(`/find-doctors?spec=${spec.name}`)}>
                <span className="spec-pill-icon">{spec.icon}</span>
                <span className="spec-pill-name">{spec.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section">
        <div className="container">
          <div className="text-center mb-4">
            <h2 className="section-title">How It Works</h2>
            <p className="section-sub">Get care in 3 simple steps</p>
          </div>
          <div className="grid-3">
            {[
              { num: '01', title: 'Search & Find', desc: 'Browse expert providers by specialty, location, or name. Read real user reviews.' },
              { num: '02', title: 'Book Instantly', desc: 'Choose your preferred date and time from real-time availability. Select in-person or video.' },
              { num: '03', title: 'Consult & Track', desc: 'Attend your appointment and receive digital prescriptions and follow-up reminders.' },
            ].map(step => (
              <div key={step.num} className="card" style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--primary)', opacity: 0.2, marginBottom: 12 }}>{step.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section" style={{ background: '#fff' }}>
        <div className="container">
          <div className="text-center mb-4">
            <h2 className="section-title">Everything You Need</h2>
            <p className="section-sub">Comprehensive healthcare management at your fingertips</p>
          </div>
          <div className="grid-3">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ background: 'linear-gradient(135deg,#14532d,#22c55e)', color: '#fff' }}>
        <div className="container text-center">
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Ready to Take Charge of Your Wellbeing?</h2>
          <p style={{ fontSize: 16, opacity: 0.85, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
            Join a growing community making healthcare simpler, safer, and more personal.
          </p>
          <div className="flex justify-center gap-4" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-lg" style={{ background: '#fff', color: 'var(--primary)', fontWeight: 700 }}
              onClick={() => navigate('/register')}>
              Get Started Free <ArrowRight size={18} />
            </button>
            <button className="btn btn-lg btn-outline" style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
              onClick={() => navigate('/find-doctors')}>
              Find Providers
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--text)', color: 'rgba(255,255,255,0.6)', padding: '32px 0', textAlign: 'center' }}>
        <div className="container">
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>🏥 Health<span style={{ color: 'var(--primary)' }}>Sync</span></div>
          <p style={{ fontSize: 13 }}>Empowering Connections. Enabling Care.</p>
          <p style={{ fontSize: 12, marginTop: 16, opacity: 0.4 }}>© 2026 HealthSync Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
