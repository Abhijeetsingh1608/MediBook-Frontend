import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PatientSidebar, Topbar, Loader, Stars } from '../../components/Layout';
import { providerAPI, slotAPI, appointmentAPI, paymentAPI, authAPI, getUser, formatTime, formatDate } from '../../utils/api';

const MODES = ['IN_PERSON', 'TELECONSULTATION'];
const SERVICE_TYPES = ['General Consultation', 'Follow-Up', 'Specialist Consultation', 'Emergency', 'Dental Checkup', 'Eye Checkup'];
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY || '';
const IS_RAZORPAY_TEST_MODE = RAZORPAY_KEY.startsWith('rzp_test_');
const PAY_METHODS = [{ key: 'ONLINE', icon: '💳', label: 'Online Payment (Razorpay)' }, { key: 'COD', icon: '💵', label: 'Cash on Delivery' }];

// Dynamically load Razorpay script if not already loaded
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BookAppointmentPage() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const [provider, setProvider] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [mode, setMode] = useState('IN_PERSON');
  const [serviceType, setServiceType] = useState('General Consultation');
  const [notes, setNotes] = useState('');
  const [payMethod, setPayMethod] = useState('ONLINE');
  const [amount, setAmount] = useState(500);
  const [step, setStep] = useState(1); // 1=pick slot, 2=details, 3=payment, 4=success
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookedAppt, setBookedAppt] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    providerAPI.getById(providerId).then(async (r) => {
      const providerData = r.data;
      console.log('Provider API response:', providerData);
      
      // Determine the name to use - check multiple possible field names
      const determineName = (data) => {
        return data.fullName || data.name || data.firstName || data.doctorName || 'Doctor';
      };
      
      try {
        const userRes = await authAPI.getProfile(providerData.userId);
        const userData = userRes.data;
        console.log('User profile response:', userData);
        const fullName = userData.fullName || userData.name || userData.firstName || determineName(providerData);
        setProvider({ ...providerData, fullName });
      } catch (err) {
        console.warn('Failed to fetch user profile for provider:', err);
        // Fallback: use whatever name field is available in provider data
        const fullName = determineName(providerData);
        setProvider({ ...providerData, fullName });
      }
    }).catch((err) => {
      console.error('Failed to fetch provider:', err);
      setError('Unable to load doctor information. Please refresh the page.');
    });
  }, [providerId]);

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    
    // Fetch available slots (backend already excludes PENDING_PAYMENT appointments)
    slotAPI.getAvailable(providerId, selectedDate)
      .then(r => {
        // Backend returns slots with isBooked = true only for CONFIRMED appointments
        setSlots(r.data || []);
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, providerId]);

  const rollbackFailedOnlineBooking = async (appointmentId) => {
    if (!appointmentId) return false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await appointmentAPI.cancel(appointmentId);
      } catch (rollbackError) {
        console.warn(`Rollback attempt ${attempt + 1} failed:`, rollbackError);
      }

      try {
        const refreshed = await appointmentAPI.getById(appointmentId);
        if (refreshed?.data?.status === 'CANCELLED') {
          return true;
        }
      } catch (statusError) {
        console.warn(`Could not verify rollback attempt ${attempt + 1}:`, statusError);
      }

      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    return false;
  };

  const openRazorpay = async (appointmentId, razorpayOrderId) => {
    const razorpayKey = RAZORPAY_KEY;

    console.log('Opening Razorpay checkout...');
    console.log('Key:', razorpayKey);
    console.log('Order ID:', razorpayOrderId);
    console.log('Amount (paise):', parseInt(amount) * 100);

    const options = {
      key: razorpayKey,
      amount: parseInt(amount) * 100,
      currency: 'INR',
      name: 'MediBook',
      description: 'Consultation Fee',
      order_id: razorpayOrderId,
      prefill: {
        name: user.fullName || '',
        email: user.email || '',
        contact: user.phone || ''
      },
      theme: {
        color: '#0ea5e9'
      },
      modal: {
        ondismiss: async function () {
          console.log('User closed payment modal');
          const released = await rollbackFailedOnlineBooking(appointmentId);
          setLoading(false);
          setError(
            released
              ? 'Payment cancelled. The booked slot has been released.'
              : 'Payment cancelled, but the slot release could not be confirmed automatically. Please check My Appointments and cancel it once if it still shows booked.'
          );
        }
      },
      handler: async function (response) {
        console.log('Payment successful!');
        console.log('Razorpay Payment ID:', response.razorpay_payment_id);

        try {
          console.log('Verifying payment with backend...');
          await paymentAPI.verify({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          });
          console.log('Payment verified');
        } catch (verifyErr) {
          console.warn('Verification failed (continuing anyway):', verifyErr.message);
        }

        try {
          console.log('Confirming appointment...');
          await appointmentAPI.updateStatus(appointmentId, 'CONFIRMED');
          console.log('Appointment confirmed');
          setPaymentId(response.razorpay_payment_id);
        } catch (confirmErr) {
          console.error('Failed to confirm appointment:', confirmErr.message);
          setError('Payment received but appointment confirmation failed. Please contact support.');
        }

        setLoading(false);
        setStep(4);
      }
    };

    const rzp = new window.Razorpay(options);

    rzp.on('payment.failed', async function (response) {
      console.error('Razorpay rejected payment:');
      console.error('Error Code:', response.error.code);
      console.error('Error Description:', response.error.description);
      console.error('Error Source:', response.error.source);
      console.error('Error Step:', response.error.step);
      console.error('Error Reason:', response.error.reason);

      const released = await rollbackFailedOnlineBooking(appointmentId);
      setLoading(false);
      const errMsg = response.error?.description || 'Payment failed';
      const failureHelp = IS_RAZORPAY_TEST_MODE
        ? ' Razorpay is in test mode here, so please use the test UPI IDs shown below or choose COD for local testing.'
        : '';
      setError(
        released
          ? `Payment failed: ${errMsg}.${failureHelp} The booked slot has been released.`
          : `Payment failed: ${errMsg}.${failureHelp} The slot release could not be confirmed automatically, so please check My Appointments once.`
      );
    });

    rzp.open();
  };

  const book = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    let appointmentId = null;

    try {
      if (payMethod === 'ONLINE') {
        const razorpayKey = RAZORPAY_KEY;
        if (!razorpayKey) {
          throw new Error('Razorpay key is not configured in medibook-frontend/.env.');
        }

        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error('Razorpay script failed to load. Check your internet connection.');
        }
      }

      const apptRes = await appointmentAPI.book({
        patientId: user.userId,
        providerId: parseInt(providerId),
        slotId: selectedSlot.slotId,
        serviceType,
        appointmentDate: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        modeOfConsultation: mode,
        notes,
        paymentMethod: payMethod,
      });

      appointmentId = apptRes.data.appointmentId;
      setBookedAppt(apptRes.data);

      if (payMethod === 'COD') {
        await appointmentAPI.updateStatus(appointmentId, 'CONFIRMED');
        setLoading(false);
        setStep(4);
        return;
      }

      const payRes = await paymentAPI.initiate({
        appointmentId: appointmentId,
        patientId: user.userId,
        amount: parseInt(amount),
        paymentMethod: 'ONLINE',
        currency: 'INR',
      });

      const razorpayOrderId = payRes.data?.razorpayOrderId;

      if (!razorpayOrderId) {
        console.error('Backend returned no order ID. Response:', payRes.data);
        const released = await rollbackFailedOnlineBooking(appointmentId);
        appointmentId = null;
        if (!released) {
          throw new Error('Backend configuration error: No Razorpay order created, and automatic slot release could not be confirmed.');
        }
        throw new Error('Backend configuration error: No Razorpay order created. The booked slot has been released.');
      }

      console.log('Order ID ready:', razorpayOrderId);
      await openRazorpay(appointmentId, razorpayOrderId);

    } catch (e) {
      let released = false;
      if (payMethod === 'ONLINE' && appointmentId) {
        released = await rollbackFailedOnlineBooking(appointmentId);
      }
      setLoading(false);
      console.error('BOOKING ERROR:');
      console.error('Full error object:', e);
      console.error('Response status:', e.response?.status);
      console.error('Response data:', e.response?.data);
      console.error('Error message:', e.message);

      let errorMsg = 'Booking failed.';
      const backendMessage = [
        e.response?.data?.message,
        e.response?.data?.error,
        typeof e.response?.data === 'string' ? e.response.data : '',
        e.message,
      ]
        .filter(Boolean)
        .join(' ');

      if (/connectexception|connection refused|getsockopt/i.test(backendMessage)) {
        errorMsg = released
          ? 'Payment service connection failed before Razorpay could open. The booked slot has been released. Please verify your backend services and try again.'
          : 'Payment service connection failed before Razorpay could open. Automatic slot release could not be confirmed, so please check My Appointments once.';
      } else if (e.response?.status === 500) {
        errorMsg = released
          ? 'Backend Error: Payment order could not be created. The booked slot has been released.'
          : 'Backend Error: Payment order could not be created, and automatic slot release could not be confirmed.';
      } else if (e.response?.data?.message) {
        errorMsg = e.response.data.message;
      } else if (e.response?.data?.error) {
        errorMsg = e.response.data.error;
      } else if (e.message) {
        errorMsg = e.message;
      }

      setError(errorMsg);
      alert(errorMsg);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  if (!provider) return (
    <div className="dashboard-layout">
      <PatientSidebar />
      <div className="dashboard-main"><Topbar title="Book Appointment" /><Loader /></div>
    </div>
  );

  return (
    <div className="dashboard-layout">
      <PatientSidebar />
      <div className="dashboard-main">
        <Topbar title="Book Appointment" />
        <div className="page-content fade-in">

          <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>

          {/* Provider card */}
          <div className="card mb-4">
            <div style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
              <div className="provider-avatar" style={{ width: 60, height: 60, fontSize: 22 }}>
                {(provider.fullName || 'D')[0]}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800 }}>Dr. {provider.fullName}</h2>
                <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>{provider.specialization}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{provider.clinicName} · {provider.clinicAddress}</p>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Stars rating={provider.avgRating || 0} />
              </div>
            </div>
          </div>

          {/* Step indicator */}
          {step < 4 && (
            <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
              {['Select Slot', 'Details', 'Payment'].map((s, i) => (
                <React.Fragment key={s}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
                      background: step > i + 1 ? 'var(--secondary)' : step === i + 1 ? 'var(--primary)' : 'var(--bg)',
                      color: step >= i + 1 ? '#fff' : 'var(--text-muted)',
                      border: step < i + 1 ? '2px solid var(--border)' : 'none',
                    }}>
                      {step > i + 1 ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: step === i + 1 ? 700 : 500, color: step === i + 1 ? 'var(--text)' : 'var(--text-muted)' }}>
                      {s}
                    </span>
                  </div>
                  {i < 2 && (
                    <div style={{ flex: 1, height: 2, background: step > i + 1 ? 'var(--secondary)' : 'var(--border)', alignSelf: 'center', margin: '0 12px' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ── Step 1: Select Slot ── */}
          {step === 1 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Select Date &amp; Time Slot</span></div>
              <div className="card-body">
                <div className="form-group mb-4">
                  <label className="form-label" style={{ fontWeight: 900, fontSize: 15, color: 'var(--primary)', letterSpacing: 0.5 }}>📅 SELECT DATE</label>
                  <input className="form-input" type="date" min={minDate}
                    value={selectedDate}
                    onChange={e => { setSelectedDate(e.target.value); setSelectedSlot(null); }}
                    style={{ maxWidth: 280, fontWeight: 800, fontSize: 15, padding: '12px 14px', backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)', borderWidth: 2, color: 'var(--primary)' }} />
                </div>

                {selectedDate && (
                  <>
                    <label className="form-label mb-3" style={{ fontWeight: 900, fontSize: 15, color: 'var(--secondary)', letterSpacing: 0.5 }}>⏰ AVAILABLE TIME SLOTS FOR {formatDate(selectedDate).toUpperCase()}</label>
                    {slotsLoading ? <Loader text="Loading slots..." /> : slots.length === 0 ? (
                      <div className="alert alert-warning">❌ No available slots for this date. Try another date.</div>
                    ) : (
                      <div className="slot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 12, marginBottom: 12 }}>
                        {slots.map(s => (
                          <button key={s.slotId}
                            className={`slot-btn ${selectedSlot?.slotId === s.slotId ? 'selected' : s.isBooked ? 'booked' : 'available'}`}
                            disabled={s.isBooked}
                            onClick={() => setSelectedSlot(s)}
                            style={{
                              padding: '14px 12px',
                              borderRadius: 10,
                              border: s.isBooked ? '2px solid #ccc' : selectedSlot?.slotId === s.slotId ? '3px solid var(--primary)' : '3px solid var(--secondary)',
                              background: s.isBooked ? '#f5f5f5' : selectedSlot?.slotId === s.slotId ? 'var(--primary)' : 'var(--secondary)',
                              color: s.isBooked ? '#999' : selectedSlot?.slotId === s.slotId ? '#fff' : '#fff',
                              cursor: s.isBooked ? 'not-allowed' : 'pointer',
                              fontWeight: s.isBooked ? 500 : 800,
                              fontSize: s.isBooked ? 12 : 13,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              transition: 'all 0.2s',
                              opacity: s.isBooked ? 0.5 : 1,
                              textDecoration: s.isBooked ? 'line-through' : 'none',
                            }}>
                            <div style={{ fontSize: s.isBooked ? 14 : 18, fontWeight: 900 }}>
                              {s.isBooked ? '✗' : '✓'}
                            </div>
                            <div style={{ fontSize: s.isBooked ? 11 : 12, fontWeight: 800, letterSpacing: 0.5 }}>
                              {formatTime(s.startTime)}
                            </div>
                            <div style={{ fontSize: 9, opacity: 0.85, fontWeight: 600 }}>
                              {s.durationMinutes}min
                            </div>
                            <div style={{ fontSize: 8, opacity: 0.7, fontWeight: 600, marginTop: 2 }}>
                              {s.isBooked ? 'BOOKED' : '🟢 FREE'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Legend */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, background: 'var(--secondary)', borderRadius: 6, border: '3px solid var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900 }}>✓</div>
                        <span style={{ fontWeight: 600 }}>🟢 FREE - Click to select</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 24, height: 24, background: '#f5f5f5', borderRadius: 6, border: '2px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontWeight: 700, fontSize: 10 }}>✗</div>
                        <span style={{ fontWeight: 600, color: '#999' }}>BOOKED - Not available</span>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" disabled={!selectedSlot} onClick={() => setStep(2)}>
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Appointment Details ── */}
          {step === 2 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Appointment Details</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="alert alert-info">
                  📅 {formatDate(selectedDate)} at {formatTime(selectedSlot?.startTime)} – {formatTime(selectedSlot?.endTime)}
                </div>

                <div className="form-group">
                  <label className="form-label">Consultation Mode</label>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {MODES.map(m => (
                      <div key={m} onClick={() => setMode(m)}
                        style={{
                          flex: 1, padding: '12px 16px', borderRadius: 8,
                          border: `2px solid ${mode === m ? 'var(--primary)' : 'var(--border)'}`,
                          background: mode === m ? 'var(--primary-light)' : '#fff',
                          cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                        }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{m === 'IN_PERSON' ? '🏥' : '🎥'}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: mode === m ? 'var(--primary)' : 'var(--text)' }}>
                          {m === 'IN_PERSON' ? 'In Person' : 'Teleconsultation'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Service Type</label>
                  <select className="form-select" value={serviceType} onChange={e => setServiceType(e.target.value)}>
                    {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Additional Notes (optional)</label>
                  <textarea className="form-textarea" placeholder="Describe your symptoms or reason for visit..."
                    value={notes} onChange={e => setNotes(e.target.value)} />
                </div>

                {IS_RAZORPAY_TEST_MODE && payMethod === 'ONLINE' && (
                  <div className="alert alert-warning" style={{ fontSize: 13 }}>
                    Razorpay is running in test mode. Real cards may be rejected here, so prefer the test UPI IDs below or use COD while testing locally.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={() => setStep(3)}>Continue →</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Payment ── */}
          {step === 3 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Payment</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* Error message */}
                {error && (
                  <div className="alert alert-danger" style={{ fontSize: 13 }}>
                    ❌ {error}
                  </div>
                )}

                {/* Booking summary */}
                <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                  <p style={{ fontWeight: 700, marginBottom: 10 }}>Booking Summary</p>
                  {[
                    { label: 'Doctor', value: `Dr. ${provider.fullName}` },
                    { label: 'Date & Time', value: `${formatDate(selectedDate)} at ${formatTime(selectedSlot?.startTime)}` },
                    { label: 'Mode', value: mode === 'IN_PERSON' ? '🏥 In Person' : '🎥 Teleconsultation' },
                    { label: 'Service', value: serviceType },
                  ].map(f => (
                    <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                      <span style={{ fontWeight: 600 }}>{f.value}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700 }}>Consultation Fee</span>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 18 }}>₹{amount}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Consultation Fee (₹)</label>
                  <input className="form-input" type="number" value={amount}
                    onChange={e => setAmount(e.target.value)} min="1" />
                </div>

    {/* Payment Method */}
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                    {PAY_METHODS.map(m => (
                      <div key={m.key}
                        className={`pay-option ${payMethod === m.key ? 'selected' : ''}`}
                        onClick={() => { setPayMethod(m.key); setError(null); }}
                        style={{ flexDirection: 'column', textAlign: 'center', padding: '12px 8px' }}>
                        <span style={{ fontSize: 24 }}>{m.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {payMethod === 'COD' ? (
                  <div className="alert alert-info" style={{ fontSize: 13 }}>
                    💵 Pay ₹{amount} at the clinic during your appointment.
                  </div>
                ) : (
                  <div className="alert alert-info" style={{ fontSize: 13 }}>
                    🔒 You will be redirected to Razorpay's secure payment page to complete payment.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => { setStep(2); setError(null); }} disabled={loading}>← Back</button>
                  <button className="btn btn-primary btn-lg" onClick={book} disabled={loading}>
                    {loading
                      ? <><span className="spinner" /> Processing…</>
                      : payMethod === 'COD'
                        ? 'Confirm & Pay at Clinic'
                        : `Pay ₹${amount} via Razorpay`
                    }
                  </button>
                </div>

                {/* Test Credentials Helper (only in test mode for ONLINE) */}
                {IS_RAZORPAY_TEST_MODE && payMethod === 'ONLINE' && (
                  <div style={{
                    marginTop: 16,
                    padding: 12,
                    background: 'var(--warning-light)',
                    border: '1px solid var(--warning)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    color: 'var(--text)',
                  }}>
                    <p style={{ fontWeight: 600, marginBottom: 8 }}>🧪 Test Mode - Use these UPI IDs:</p>
                    <p>✓ <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4 }}>success@razorpay</code> - for successful payment</p>
                    <p>✗ <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 4 }}>failure@razorpay</code> - for failed payment</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Success ── */}
          {step === 4 && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--secondary)' }}>
                Appointment Confirmed!
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 15, lineHeight: 1.7 }}>
                Your appointment with Dr. {provider.fullName} has been booked successfully.
                {payMethod === 'COD' && ' Please pay ₹' + amount + ' at the clinic.'}
                {payMethod === 'ONLINE' && ' Payment processed via Razorpay.'}
              </p>
              <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 20, maxWidth: 380, margin: '0 auto 28px', textAlign: 'left' }}>
                {[
                  { label: 'Date', value: formatDate(selectedDate) },
                  { label: 'Time', value: formatTime(selectedSlot?.startTime) },
                  { label: 'Mode', value: mode === 'IN_PERSON' ? 'In Person' : 'Teleconsultation' },
                  { label: 'Service', value: serviceType },
                  payMethod === 'ONLINE' ? { label: 'Amount Paid', value: `₹${amount} via Razorpay` } : { label: 'Amount to Pay', value: `₹${amount} at clinic (COD)` },
                  paymentId && payMethod === 'ONLINE' ? { label: 'Payment ID', value: paymentId } : null,
                ].filter(Boolean).map(f => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{f.label}</span>
                    <span style={{ fontWeight: 600 }}>{f.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={() => navigate('/patient/appointments')}>View Appointments</button>
                <button className="btn btn-primary" onClick={() => navigate('/find-doctors')}>Book Another</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}



