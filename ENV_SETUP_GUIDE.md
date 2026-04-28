# Environment Variables Setup Guide

## What was changed?

The hardcoded Razorpay API key that was visible in the code has been moved to a **secure environment file** (`.env`).

---

## How it works?

### **Before (INSECURE ❌)**
```jsx
// Hardcoded key visible in source code - BAD!
const razorpayKey = 'rzp_test_ScG8qIqdjoBOCH';
```
- Anyone looking at your code could see the key
- Code is committed to Git with sensitive data
- Risk of unauthorized API usage

### **After (SECURE ✅)**
```jsx
// Reads from .env file - SAFE!
const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY;
```
- Key is stored in `.env` file (not committed to Git)
- Only loaded at runtime in your local environment
- Production has its own separate `.env` file

---

## Files Created

### 1. `.env` (DO NOT COMMIT)
```
VITE_RAZORPAY_KEY=rzp_test_ScG8qIqdjoBOCH
```
- **Location**: Root of your project (`d:\Desktop\medibook-ui\.env`)
- **Contains**: Your actual API keys
- **Git Status**: Already in `.gitignore` (won't be committed)
- **Who sees it**: Only you on your local machine

### 2. `.env.example` (SAFE TO COMMIT)
```
VITE_RAZORPAY_KEY=your_razorpay_test_key_here
```
- **Location**: Root of your project
- **Purpose**: Template showing what keys are needed
- **Git Status**: Safe to commit (doesn't have real keys)
- **For team**: Developers copy this to `.env` and fill in their own keys

### 3. `.gitignore` (Already existed, now updated)
- **Added**: `.env` file exclusion
- **Result**: `.env` never gets committed to Git

---

## How Vite reads the variable?

Vite (your build tool) has a special way to access environment variables:

```javascript
import.meta.env.VITE_RAZORPAY_KEY
```

**Rules:**
- Must start with `VITE_` prefix
- Available at **runtime** in your app
- Not visible in browser console (processed at build time)
- Different from `process.env` (which is for Node.js)

---

## For Multiple Environments

### **Development (Your machine)**
```
# .env file (local, not committed)
VITE_RAZORPAY_KEY=rzp_test_ScG8qIqdjoBOCH     # Test key
```

### **Production (Live server)**
```
# Server's .env file (set separately)
VITE_RAZORPAY_KEY=rzp_live_actual_production_key  # Live key
```

Each environment handles its own `.env` file - the same code works everywhere!

---

## Security Checklist

✅ Hardcoded key removed from source code  
✅ `.env` file added to `.gitignore`  
✅ `.env.example` template created for team  
✅ Error message added if key is missing  
✅ No existing functionality changed  

---

## What if the key is missing?

If someone tries to run the app without configuring `.env`:
```
Razorpay key not configured. Contact admin.
❌ VITE_RAZORPAY_KEY is not set in .env file
```

---

## For your team (if you have one)

1. Share the `.env.example` file with your team
2. Each developer creates their own `.env` file locally
3. Never commit `.env` to Git
4. Each deployment has its own `.env` on the server

