# Forgot Password & Reset Password Flow - Implementation Guide

## Overview

The Forgot Password flow has been fully implemented for MediBook with two new pages and updates to the LoginPage:

1. **ForgotPasswordPage** - Request a password reset link
2. **ResetPasswordPage** - Verify OTP and set new password  
3. **LoginPage** - Updated with forgot password link and success message

---

## User Journey

```
LoginPage
  ↓ (click "Forgot Password?")
/forgot-password
  ↓ (enter email)
  ↓ (click "Send Reset Link")
  ↓ (backend sends email with reset link)
Show success message: "Check your email"
  ↓ (user clicks link in email)
/reset-password?token=xyz
  ↓ (STEP 1: Verify OTP)
  ↓ (enter 6-digit OTP)
  ↓ (click "Verify OTP")
  ↓ (STEP 2: Set new password)
  ↓ (enter new password + confirm)
  ↓ (click "Reset Password")
  ↓ (backend updates password)
  ↓ Navigate to /login?reset=success
LoginPage (shows success alert)
  ↓ (user logs in with new password)
Dashboard
```

---

## Files Created & Modified

### New Files

**1. src/pages/auth/ForgotPasswordPage.jsx**

Features:
- Email input with Mail icon
- "Send Reset Link" button
- Left panel with Lock icon and 3 info boxes
- Success state shows CheckCircle icon with message
- Displays masked email in success message
- "Back to Login" link on both form and success states

API Call:
```javascript
POST /auth/forgot-password
{
  email: "user@example.com"
}
Response:
{
  sent: true,  // or error message
  message: "Reset link sent"
}
```

**2. src/pages/auth/ResetPasswordPage.jsx**

Two-Step Flow:

**STEP 1: OTP Verification**
- 6 separate digit inputs (auto-focus, backspace, paste support)
- Countdown timer from 15:00 (15 minutes)
- When timer hits 0: Shows "Reset link expired" with button to request new link
- "Verify OTP" button calls verify-reset-otp endpoint
- On success: Transition to STEP 2 (same page, no navigation)

**STEP 2: New Password**
- New Password input with Lock icon + show/hide toggle
- Confirm Password input with Lock icon + show/hide toggle
- Password strength indicator bar:
  * Red: < 6 characters
  * Yellow: 6-8 characters
  * Green: > 8 characters
- "Reset Password" button
- On success: Navigate to `/login?reset=success` with `replace: true`

API Calls:
```javascript
// Step 1: Verify OTP
POST /auth/verify-reset-otp
{
  token: "xyz",
  otp: "123456"
}
Response: { success: true }

// Step 2: Reset Password
POST /auth/reset-password
{
  token: "xyz",
  newPassword: "NewPassword123"
}
Response: { success: true, message: "Password reset successful" }
```

### Modified Files

**LoginPage.jsx**

Changes:
1. Added import for `useSearchParams`
2. Added state for `resetSuccess` and `params`
3. Added useEffect to check URL for `?reset=success` parameter
4. Added success alert that shows for 5 seconds
5. Updated Password label to include "Forgot Password?" link
   - Link styled to match design
   - Clickable → navigates to `/forgot-password`

```javascript
// New imports
import { useSearchParams } from 'react-router-dom';

// New state
const [params] = useSearchParams();
const [resetSuccess, setResetSuccess] = useState(false);

// New effect
useEffect(() => {
  if (params.get('reset') === 'success') {
    setResetSuccess(true);
    const timer = setTimeout(() => setResetSuccess(false), 5000);
    return () => clearTimeout(timer);
  }
}, [params]);

// In JSX - added password label with link
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <label className="form-label">Password</label>
  <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
    Forgot Password?
  </Link>
</div>
```

**App.jsx**

Changes:
1. Added 2 imports:
   ```javascript
   import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
   import ResetPasswordPage from './pages/auth/ResetPasswordPage';
   ```

2. Added 2 routes in `<Routes>`:
   ```javascript
   <Route path="/forgot-password" element={<ForgotPasswordPage />} />
   <Route path="/reset-password" element={<ResetPasswordPage />} />
   ```

---

## Styling & UI

All pages follow LoginPage design:
- Same `.auth-page` layout (left + right panels)
- Same `.auth-left` with icon, title, subtitle, 3 info boxes
- Same `.auth-right` → `.auth-box` styling
- Same `form-group`, `form-label`, `form-input` classes
- Same `btn btn-primary` styling
- Same color variables: `var(--primary)`, `var(--border)`, etc.
- Same spinner loading indicator
- Same alert styling: `.alert .alert-error`, `.alert .alert-success`

**Password Strength Indicator:**
- Div with `height: 6px`, `background: var(--border)`
- Dynamic width % based on password length
- Colors:
  * `#ef4444` (Red) - < 6 chars (33%)
  * `#eab308` (Yellow) - 6-8 chars (66%)
  * `#22c55e` (Green) - > 8 chars (100%)

---

## URL Parameters

### Forgot Password Page
No parameters needed.

### Reset Password Page
```
/reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                ↑
                Required: Token from email link
```

### Login Page (Success)
```
/login?reset=success
      ↑
      Optional: Shows success alert for 5 seconds
```

---

## Security Features

1. **Token-based reset** - Reset link contains unique token valid for 15 minutes
2. **OTP verification** - Second factor of authentication (security)
3. **No passwords in logs** - Password only sent when resetting
4. **Timer expiration** - Reset link expires after 15 minutes
5. **Password validation** - Must be 6+ characters
6. **Password confirmation** - Must match to proceed
7. **Replace navigation** - Browser back button disabled during reset

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| No email entered | Show "Please enter your email address" |
| Email not found | Backend returns error message |
| Invalid/expired token on page load | Show error + "Request New Link" button |
| Wrong OTP entered | Show "OTP verification failed" alert |
| OTP timer expires | Show "Reset link expired" message |
| Passwords don't match | Show "Passwords do not match" alert |
| Password too short | Show "Password must be at least 6 characters" |
| Password reset fails | Show backend error message |

---

## Testing Scenarios

### Test 1: Forgot Password Flow
```
1. Go to /login
2. Click "Forgot Password?" link
3. Should navigate to /forgot-password
4. Enter email: test@example.com
5. Click "Send Reset Link"
6. Should show success message with email
```

### Test 2: Reset Password Flow
```
1. Click reset link from email (with token)
2. Should navigate to /reset-password?token=...
3. Enter 6-digit OTP from email
4. Click "Verify OTP"
5. Form changes to password entry
6. Enter new password (min 6 chars)
7. Confirm password (must match)
8. Click "Reset Password"
9. Should navigate to /login?reset=success
10. Should see success alert for 5 seconds
```

### Test 3: Expired Link
```
1. Click reset link with expired token
2. Should show "Invalid reset link"
3. Click "Request New Link"
4. Should navigate to /forgot-password
```

### Test 4: Invalid Token
```
1. Go to /reset-password (no token)
2. Should show "Invalid reset link"
```

---

## Browser Console Logs

OTP code is printed for testing:
```javascript
console.log('OTP Code:', otp);  // Shows: OTP Code: 123456
```

---

## No External Dependencies

Uses only:
- React hooks (useState, useEffect, useRef)
- fetch() API for HTTP requests  
- React Router (useNavigate, Link, useSearchParams)
- Icons from lucide-react (already installed)
- Existing CSS variables and classes

---

## Backend API Requirements

Your backend needs to implement:

1. **POST /auth/forgot-password**
   - Request: `{ email }`
   - Response: `{ sent: true, message: "Check your email" }`
   - Action: Generate reset token + OTP, send email with reset link

2. **POST /auth/verify-reset-otp**
   - Request: `{ token, otp }`
   - Response: `{ success: true }`
   - Action: Validate OTP, mark token as verified

3. **POST /auth/reset-password**
   - Request: `{ token, newPassword }`
   - Response: `{ success: true, message: "Password updated" }`
   - Action: Update password in database

---

## Next Steps

Backend TODO:
- [ ] Implement POST /auth/forgot-password (send email with reset link + OTP)
- [ ] Implement POST /auth/verify-reset-otp (validate OTP)
- [ ] Implement POST /auth/reset-password (update password)
- [ ] Generate unique reset tokens valid for 15 minutes
- [ ] Send HTML emails with reset link + OTP code
- [ ] Add token expiration logic
- [ ] Track OTP attempts to prevent brute force

---

## Files Summary

| File | Status | Purpose |
|------|--------|---------|
| ForgotPasswordPage.jsx | ✅ Created | Request password reset |
| ResetPasswordPage.jsx | ✅ Created | OTP verification + password reset |
| LoginPage.jsx | ✅ Modified | Added forgot link + success message |
| App.jsx | ✅ Modified | Added 2 new routes |

