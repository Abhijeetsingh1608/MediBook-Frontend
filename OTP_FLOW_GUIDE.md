# OTP Verification Flow - Complete Implementation Guide

## Overview

The OTP (One-Time Password) verification flow has been fully implemented for MediBook. This enhances security by requiring users to verify their identity with a 6-digit code sent to their email after login.

---

## User Flows

### Flow 1: Normal Login → Phone Required → OTP Verification

```
LoginPage
  ↓ (user enters email/password)
  ↓ Backend checks: has phone number?
  ├─ NO → requiresPhone: true
  │         ↓
  │    AddPhonePage (enter +91 phone number)
  │         ↓ (save phone)
  │    OtpPage (verify 6-digit code)
  │         ↓ (success)
  │    PatientDashboard / ProviderDashboard / AdminDashboard
  │
  └─ YES → otpSent: true
            ↓
          OtpPage (verify 6-digit code)
            ↓ (success)
          PatientDashboard / ProviderDashboard / AdminDashboard
```

### Flow 2: Google OAuth → OTP Verification

```
LoginPage (click "Continue with Google")
  ↓
Google OAuth2 Authentication
  ↓
Redirect to /oauth2/select-role
  ↓ (user selects Patient/Provider/Doctor)
  ↓ Backend returns token + role
  ↓
OAuth2SelectRole redirects to OtpPage
  ↓ (verify 6-digit code)
  ↓ (success)
PatientDashboard / ProviderDashboard
```

---

## New Files Created

### 1. **src/pages/auth/OtpPage.jsx**
Handles OTP verification with:
- **6 separate input boxes** - each accepts 1 digit
- **Auto-focus** - automatically moves to next field when digit entered
- **Paste support** - spreads pasted digits across all 6 boxes
- **Countdown timer** - shows remaining time from 5:00
- **Resend OTP button** - appears when timer reaches 0:00
- **Email masking** - displays "pa*****@gmail.com"
- **Navigation** - redirects to dashboard based on user role after verification

**Key Features:**
```javascript
// 6 individual digit inputs
<input maxLength="1" type="text" inputMode="numeric" />

// Auto-focus on input
handleOtpChange() → inputRefs.current[index + 1]?.focus()

// Countdown from 5:00 to 0:00
useEffect(() => { setTimeLeft(t => t - 1) }, [])

// API calls:
// POST http://localhost:8080/auth/verify-otp
// POST http://localhost:8080/auth/resend-otp
```

### 2. **src/pages/auth/AddPhonePage.jsx**
Collects phone number when backend indicates requiresPhone:
- **Phone input with +91 prefix** - shows country code
- **10-digit validation** - only Indian phone numbers for now
- **Save & Continue button** - sends phone to backend then redirects to OTP

**Key Features:**
```javascript
// Phone input with country code prefix
<div>
  <div>+91</div>
  <input type="tel" placeholder="9876543210" maxLength="10" />
</div>

// API call:
// POST http://localhost:8080/auth/add-phone
// Body: { email, phone: "+91" + enteredNumber }
```

---

## Files Modified

### 1. **src/pages/auth/LoginPage.jsx**
Added new login flow logic:

**Before:**
```javascript
// After login, always save auth and navigate
const res = await authAPI.login(payload);
saveAuth(data.token, user);
navigate('/patient');
```

**After:**
```javascript
// Check for phone requirement first
if (res.data.requiresPhone === true) {
  navigate(`/add-phone?email=${encodedEmail}`);
  return;
}

// Check for OTP requirement
if (res.data.otpSent === true) {
  navigate(`/otp?email=${encodedEmail}&source=normal`);
  return;
}

// Fallback to normal login
if (res.data.token) {
  saveAuth(data.token, user);
  navigate('/patient');
}
```

**Important:** All `navigate()` calls now use `{ replace: true }` to prevent going back to login during auth flow.

### 2. **src/pages/auth/OAuth2SelectRole.jsx**
Changed Google OAuth flow:

**Before:**
```javascript
// After role selection, save auth and navigate to dashboard
const data = await response.json();
saveAuth(data.token, {...});
navigate('/patient');
```

**After:**
```javascript
// After role selection, redirect to OTP instead
const data = await response.json();
navigate(`/otp?email=${encodedEmail}&source=google&name=${encodedName}`);
// OtpPage will call saveAuth after verification
```

### 3. **src/App.jsx**
Added 2 new routes:

```javascript
// Imports
import OtpPage from './pages/auth/OtpPage';
import AddPhonePage from './pages/auth/AddPhonePage';

// Routes
<Route path="/otp" element={<OtpPage />} />
<Route path="/add-phone" element={<AddPhonePage />} />
```

---

## Backend API Contracts

### Already Implemented by Backend:

**POST /auth/login**
```javascript
Request:  { email, password }
Response: {
  // Scenario 1: No phone number
  { requiresPhone: true, email: "..." }
  
  // Scenario 2: Has phone, OTP sent
  { otpSent: true, email: "..." }
  
  // Scenario 3: Direct login (no OTP needed - edge case)
  { token: "jwt", userId: 123, role: "Patient", fullName: "..." }
}
```

### New APIs Required:

**POST /auth/add-phone**
```javascript
Request:  { email, phone: "+918765432109" }
Response: { success: true, message: "Phone added" }
```

**POST /auth/verify-otp**
```javascript
Request:  { email, otp: "123456" }
Response: {
  token: "jwt",
  userId: 123,
  fullName: "John Doe",
  role: "Patient",
  email: "john@example.com"
}
```

**POST /auth/resend-otp**
```javascript
Request:  { email }
Response: { success: true, message: "OTP resent to email" }
```

**POST /auth/google/complete**
```javascript
Request:  { email, fullName, picture, provider, role }
Response: {
  token: "jwt",
  userId: 123,
  fullName: "John Doe",
  role: "Patient"
  // Note: Skip saveAuth here - OtpPage will do it
}
```

---

## URL Parameters Explained

### OTP Page
```
/otp?email=john%40gmail.com&source=normal&name=John
     ↑                        ↑        ↑
     └─ Masked email          ├─ "normal" or "google"
                             └─ Name (only for google flow)
```

### Add Phone Page
```
/add-phone?email=john%40gmail.com
           ↑
           └─ Email from failed login
```

---

## Security Considerations

1. **No Token Before OTP** - Auth token is NOT saved until OTP is verified
2. **Email Masking** - User's full email not visible in form text (shows pa*****@gmail.com)
3. **OTP Timeout** - 5-minute window to verify, then must resend
4. **No Paste Validation** - Users can paste, but only digits extracted
5. **Replace Navigation** - Browser back button skipped during auth flows

---

## Testing Flow

### Test Scenario 1: Login with Phone Already on File
```
1. Go to /login
2. Enter: patient@demo.com / password123
3. Should redirect to /otp?email=patient%40demo.com&source=normal
4. Enter OTP (check browser console or email)
5. Should navigate to /patient dashboard
```

### Test Scenario 2: Login without Phone (Add Phone First)
```
1. Go to /login
2. Enter: newuser@example.com / password123
3. Should redirect to /add-phone?email=newuser%40example.com
4. Enter valid 10-digit phone: 9876543210
5. Click "Save & Continue"
6. Should redirect to /otp
7. Enter OTP
8. Should navigate to /patient dashboard
```

### Test Scenario 3: Google OAuth
```
1. Go to /login
2. Click "Continue with Google"
3. Select role (Patient/Provider)
4. Should redirect to /otp?email=...&source=google&name=...
5. Enter OTP
6. Should navigate to correct dashboard
```

---

## Browser Console Logs

The OTP code is printed to browser console for testing:

```javascript
console.log('OTP Code:', otp);  // Shows: OTP Code: 123456
```

This appears in your browser DevTools → Console tab.

---

## Styling & UI

All pages use existing CSS variables and classes:
- `.auth-page` - Main container
- `.auth-left` - Left panel (branding)
- `.auth-right` - Right panel (forms)
- `.auth-box` - Form container
- `.btn .btn-primary` - Primary button
- `.spinner` - Loading spinner
- `.alert .alert-error` - Error message
- `.alert .alert-success` - Success message
- `var(--primary)`, `var(--border)`, `var(--text-muted)`, etc.

All follow the exact same styling as LoginPage for consistency.

---

## No External Dependencies

This implementation uses:
- React hooks (useState, useEffect, useRef)
- fetch() API for HTTP requests
- URL parameters (useSearchParams from React Router)
- Existing utilities: saveAuth(), getUser()

**No new npm packages installed.**

---

## Next Steps (Backend)

Your backend needs to implement:
1. ✅ Modify `/auth/login` to check for phone requirement and send OTP
2. ✅ Implement POST `/auth/add-phone`
3. ✅ Implement POST `/auth/verify-otp`
4. ✅ Implement POST `/auth/resend-otp`
5. ✅ Modify `/auth/google/complete` to send OTP instead of returning token

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OTP page blank | Check URL params: `/otp?email=...&source=...` |
| Can't paste OTP | Only digits extracted from pasted text |
| Timer not counting down | Check browser console for errors |
| Resend button not appearing | Wait for 5:00 timer to complete |
| Wrong email masked | Email parameter in URL must be encoded |

