import axios from 'axios';

const resolveDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8080';
  }

  const protocol = window.location.protocol || 'http:';
  const hostname = window.location.hostname || 'localhost';
  return `${protocol}//${hostname}:8080`;
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || resolveDefaultApiBaseUrl();
export const OAUTH_BASE_URL = import.meta.env.VITE_OAUTH_BASE_URL || 'http://localhost:8081';
export const API_V1_PREFIX = '/api/v1';
export const OAUTH_GOOGLE_URL = `${OAUTH_BASE_URL}/oauth2/authorization/google`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
  timeout: 30000,
});

const retryRequest = async (fn, maxRetries = 3, delayMs = 1000) => {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isNetworkError = !err.response;
      const isServerError = err.response?.status >= 500;
      const shouldRetry = isTimeout || isNetworkError || isServerError;

      if (!shouldRetry || attempt === maxRetries - 1) {
        throw err;
      }

      const waitMs = delayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
};

const providerListCache = new Map();
const providerPendingRequests = new Map();
const providerProfileCache = new Map();

const normalizeRole = (role) => {
  if (!role) return role;
  const upper = String(role).toUpperCase();
  if (upper === 'PATIENT') return 'Patient';
  if (upper === 'PROVIDER') return 'Provider';
  if (upper === 'ADMIN') return 'Admin';
  return role;
};

const getCachedProviderList = (cacheKey, fetcher, ttlMs = 60000) => {
  const now = Date.now();
  const cachedEntry = providerListCache.get(cacheKey);

  if (cachedEntry && now - cachedEntry.ts < ttlMs) {
    return Promise.resolve(cachedEntry.response);
  }

  const pendingRequest = providerPendingRequests.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const request = retryRequest(fetcher, 3, 500)
    .then((response) => {
      providerListCache.set(cacheKey, { ts: Date.now(), response });
      return response;
    })
    .finally(() => {
      providerPendingRequests.delete(cacheKey);
    });

  providerPendingRequests.set(cacheKey, request);
  return request;
};

const getCachedProviderProfile = (providerId, fetcher, ttlMs = 120000) => {
  const now = Date.now();
  const cachedEntry = providerProfileCache.get(providerId);

  if (cachedEntry && now - cachedEntry.ts < ttlMs) {
    return Promise.resolve(cachedEntry.response);
  }

  return retryRequest(fetcher, 3, 500).then((response) => {
    providerProfileCache.set(providerId, { ts: Date.now(), response });
    return response;
  });
};

const invalidateProviderListCache = () => {
  providerListCache.clear();
  providerPendingRequests.clear();
};

const invalidateProviderProfile = (providerId) => {
  providerProfileCache.delete(providerId);
};

const getStoredToken = () => localStorage.getItem('medibook_token');

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

const mapPaymentStatus = (status) => {
  if (!status) return status;
  if (status === 'PAID') return 'SUCCESS';
  return status;
};

const wrapData = (data) => ({ data });

const expandRecurringSlots = (payload) => {
  const slots = [];
  const startDate = new Date(payload.date);
  const endDate = new Date(payload.recurrenceEndDate);
  const stepDays = payload.recurrence === 'WEEKLY' ? 7 : 1;

  for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + stepDays)) {
    const slotDate = date.toISOString().split('T')[0];
    slots.push({
      providerId: payload.providerId,
      slotDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
    });
  }

  return slots;
};

export const authAPI = {
  register: (data) =>
    api.post(`${API_V1_PREFIX}/auth/register`, {
      ...data,
      role: String(data.role || '').toUpperCase(),
    }),

  login: async (data) => {
    const response = await api.post(`${API_V1_PREFIX}/auth/login`, data);
    sessionStorage.setItem(
      'medibook_pending_login',
      JSON.stringify({
        email: data.email,
        password: data.password,
        adminSecretKey: data.adminSecretKey || '',
      })
    );
    return {
      ...response,
      data: {
        ...response.data,
        otpSent: true,
      },
    };
  },

  verifyLoginOtp: (data) => api.post(`${API_V1_PREFIX}/auth/verify-login-otp`, data),
  verifyEmail: (data) => api.post(`${API_V1_PREFIX}/auth/verify-email`, data),
  resendVerificationOtp: (data) => api.post(`${API_V1_PREFIX}/auth/resend-verification-otp`, data),
  forgotPassword: (data) => api.post(`${API_V1_PREFIX}/auth/forgot-password`, data),
  verifyOtp: (data) => api.post(`${API_V1_PREFIX}/auth/verify-otp`, data),
  resetPassword: (data) => api.post(`${API_V1_PREFIX}/auth/reset-password`, data),
  logout: async () => wrapData({ success: true }),
  getCurrentUser: () => api.get(`${API_V1_PREFIX}/auth/me`),
  getAllUsers: () => api.get(`${API_V1_PREFIX}/auth/users`),
  getProfile: (userId) => api.get(`${API_V1_PREFIX}/auth/users/${userId}`),
  updateProfile: (userId, data) => api.put(`${API_V1_PREFIX}/auth/users/${userId}`, data),
  changePassword: (userId, password) =>
    api.put(`${API_V1_PREFIX}/auth/users/${userId}/password`, { password }),
  deactivate: (userId) => api.put(`${API_V1_PREFIX}/auth/users/${userId}/deactivate`),
  activate: (userId) => api.put(`${API_V1_PREFIX}/auth/users/${userId}/activate`),
  updateRole: (userId, role) =>
    api.put(`${API_V1_PREFIX}/auth/users/${userId}/role`, { role: String(role || '').toUpperCase() }),
};

export const providerAPI = {
  register: (data) => {
    invalidateProviderListCache();
    return retryRequest(
      () =>
        api.post(`${API_V1_PREFIX}/providers`, {
          ...data,
          experienceYears: parseInt(data.experienceYears || 0, 10),
        }),
      2,
      500
    );
  },

  getAll: () =>
    getCachedProviderList('providers_all', () => api.get(`${API_V1_PREFIX}/providers`)),

  getAvailable: () =>
    getCachedProviderList('providers_available', () =>
      api.get(`${API_V1_PREFIX}/providers/available`, { params: { value: true } })
    ),

  getById: (id) =>
    getCachedProviderProfile(id, () => api.get(`${API_V1_PREFIX}/providers/${id}`)),

  getByUserId: (uid) =>
    retryRequest(() => api.get(`${API_V1_PREFIX}/providers/user/${uid}`), 3, 500),

  getBySpecialization: (spec) =>
    retryRequest(() => api.get(`${API_V1_PREFIX}/providers/specialization/${spec}`), 2, 500),

  search: (keyword) =>
    retryRequest(
      () => api.get(`${API_V1_PREFIX}/providers/search`, { params: { keyword } }),
      2,
      500
    ),

  update: (id, data) => {
    invalidateProviderListCache();
    invalidateProviderProfile(id);
    return retryRequest(() => api.put(`${API_V1_PREFIX}/providers/${id}`, data), 2, 500);
  },

  verify: (id, verified = true) => {
    invalidateProviderListCache();
    invalidateProviderProfile(id);
    return retryRequest(
      () => api.put(`${API_V1_PREFIX}/providers/${id}/verify`, null, { params: { verified } }),
      2,
      500
    );
  },

  setAvailability: (id, val) => {
    invalidateProviderListCache();
    invalidateProviderProfile(id);
    return retryRequest(
      () => api.put(`${API_V1_PREFIX}/providers/${id}/availability`, null, { params: { available: val } }),
      2,
      500
    );
  },

  delete: (id) => {
    invalidateProviderListCache();
    invalidateProviderProfile(id);
    return retryRequest(() => api.delete(`${API_V1_PREFIX}/providers/${id}`), 2, 500);
  },

  reject: (id, note = '') => {
    invalidateProviderListCache();
    invalidateProviderProfile(id);
    return retryRequest(
      () => api.put(`${API_V1_PREFIX}/providers/${id}/reject`, null, { params: { note } }),
      2,
      500
    );
  },

  // Upload PDF document to Cloudinary (unsigned preset, free tier)
  // IMPORTANT: Your Cloudinary upload preset must be set to "Unsigned" and
  // resource type must be "Raw" (or "Auto") to allow PDF uploads.
  // Go to: Cloudinary Dashboard → Settings → Upload → Upload presets → medibook_docs
  // Set: Signing Mode = Unsigned, Resource type = Raw (or Auto)
  uploadDocument: async (file) => {
    const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'medibook_docs';
    const MAX_SIZE_MB = 10;

    if (!CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary cloud name is not configured. Check your .env file.');
    if (!file) throw new Error('No file selected');
    if (file.type !== 'application/pdf') throw new Error('Only PDF files are allowed');
    if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`File must be under ${MAX_SIZE_MB}MB`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    // NOTE: resource_type goes in the URL path, NOT as a FormData field
    // Using 'auto' so Cloudinary auto-detects PDFs correctly
    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

    const res = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Cloudinary error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(`Cloudinary: ${data.error.message}`);
    return data.secure_url;
  },

  // Save only the documentUrl to the backend (avoids overwriting other fields)
  updateDocumentUrl: (id, documentUrl) => {
    invalidateProviderListCache();
    invalidateProviderProfile(id);
    return retryRequest(
      () => api.put(`${API_V1_PREFIX}/providers/${id}`, { documentUrl }),
      2,
      500
    );
  },
};

export const slotAPI = {
  add: (data) =>
    retryRequest(
      () =>
        api.post(`${API_V1_PREFIX}/slots`, {
          providerId: data.providerId,
          slotDate: data.slotDate || data.date,
          startTime: data.startTime,
          endTime: data.endTime,
        }),
      2,
      500
    ),

  addBulk: async (slots) => {
    const requests = slots.map((slot) => slotAPI.add(slot));
    const responses = await Promise.all(requests);
    return wrapData(responses.map((response) => response.data));
  },

  generateRecurring: async (data) => {
    const requests = expandRecurringSlots(data).map((slot) => slotAPI.add(slot));
    const responses = await Promise.all(requests);
    return wrapData(responses.map((response) => response.data));
  },

  getByProvider: (pid) =>
    retryRequest(() => api.get(`${API_V1_PREFIX}/slots/provider/${pid}`), 2, 500),

  getAvailable: (pid, date) =>
    retryRequest(
      () => api.get(`${API_V1_PREFIX}/slots/provider/${pid}/available`, { params: { date } }),
      2,
      500
    ),

  getById: (id) =>
    retryRequest(() => api.get(`${API_V1_PREFIX}/slots/${id}`), 2, 500),

  update: (id, data) =>
    retryRequest(
      () =>
        api.put(`${API_V1_PREFIX}/slots/${id}`, {
          providerId: data.providerId,
          slotDate: data.slotDate || data.date,
          startTime: data.startTime,
          endTime: data.endTime,
        }),
      2,
      500
    ),

  block: (id) =>
    retryRequest(
      () => api.put(`${API_V1_PREFIX}/slots/${id}/status`, null, { params: { status: 'BLOCKED' } }),
      2,
      500
    ),

  unblock: (id) =>
    retryRequest(
      () => api.put(`${API_V1_PREFIX}/slots/${id}/status`, null, { params: { status: 'AVAILABLE' } }),
      2,
      500
    ),

  delete: (id) =>
    retryRequest(() => api.delete(`${API_V1_PREFIX}/slots/${id}`), 2, 500),
};

export const appointmentAPI = {
  book: (data) =>
    retryRequest(
      () =>
        api.post(`${API_V1_PREFIX}/appointments`, {
          providerId: parseInt(data.providerId, 10),
          slotId: data.slotId,
          reason: data.notes || data.reason || data.serviceType || 'Appointment booking',
        }),
      2,
      500
    ),

  getAll: () => retryRequest(() => api.get(`${API_V1_PREFIX}/appointments`), 2, 500),

  getById: (id) =>
    retryRequest(() => api.get(`${API_V1_PREFIX}/appointments/${id}`), 2, 500),

  getByPatient: (pid) =>
    retryRequest(() => api.get(`${API_V1_PREFIX}/appointments/patient/${pid}`), 2, 500),

  getUpcoming: async (pid) => {
    const response = await appointmentAPI.getByPatient(pid);
    const now = new Date();
    return wrapData(
      (response.data || []).filter((appt) => {
        const appointmentDate = appt.appointmentDate || appt.createdAt;
        return appointmentDate ? new Date(appointmentDate) >= now && appt.status !== 'CANCELLED' : false;
      })
    );
  },

  getByProvider: (pid) =>
    retryRequest(() => api.get(`${API_V1_PREFIX}/appointments/provider/${pid}`), 2, 500),

  getByProviderDate: async (pid, date) => {
    const response = await appointmentAPI.getByProvider(pid);
    return wrapData((response.data || []).filter((appt) => appt.appointmentDate === date));
  },

  cancel: (id) =>
    retryRequest(() => api.put(`${API_V1_PREFIX}/appointments/${id}/cancel`), 2, 500),

  reschedule: async () => {
    throw new Error('Reschedule is not supported by the current backend yet.');
  },

  complete: (id) =>
    retryRequest(() => api.put(`${API_V1_PREFIX}/appointments/${id}/complete`), 2, 500),

  updateStatus: async (id, status) => {
    if (status === 'COMPLETED') return appointmentAPI.complete(id);
    if (status === 'CANCELLED') return appointmentAPI.cancel(id);
    return appointmentAPI.getById(id);
  },

  getCount: async (pid) => {
    const response = await appointmentAPI.getByProvider(pid);
    return wrapData({ count: (response.data || []).length });
  },
};

export const paymentAPI = {
  initiate: (data) =>
    api.post(`${API_V1_PREFIX}/payments/orders`, {
      appointmentId: parseInt(data.appointmentId, 10),
      amount: parseFloat(data.amount),
    }),

  verify: (data) => api.post(`${API_V1_PREFIX}/payments/verify`, data),
  downloadInvoice: (paymentId) =>
    api.get(`${API_V1_PREFIX}/payments/${paymentId}/invoice`, { responseType: 'blob' }),

  getByAppointment: async (id) => {
    const response = await api.get(`${API_V1_PREFIX}/payments`);
    const payment = (response.data || []).find((item) => item.appointmentId === Number(id));
    return wrapData(payment || null);
  },

  getById: (id) => api.get(`${API_V1_PREFIX}/payments/${id}`),

  getByPatient: async (pid) => {
    const response = await api.get(`${API_V1_PREFIX}/payments/patient/${pid}`);
    return wrapData((response.data || []).map((payment) => ({ ...payment, status: mapPaymentStatus(payment.status) })));
  },

  getByProvider: async (pid) => {
    const response = await api.get(`${API_V1_PREFIX}/payments/provider/${pid}`);
    return wrapData((response.data || []).map((payment) => ({ ...payment, status: mapPaymentStatus(payment.status) })));
  },

  refund: (id) => api.put(`${API_V1_PREFIX}/payments/${id}/refund`),

  getByStatus: async (status) => {
    const response = await api.get(`${API_V1_PREFIX}/payments`);
    const desired = status === 'SUCCESS' ? 'PAID' : status;
    return wrapData(
      (response.data || [])
        .filter((payment) => payment.status === desired)
        .map((payment) => ({ ...payment, status: mapPaymentStatus(payment.status) }))
    );
  },

  getTotalRevenue: async () => {
    const response = await api.get(`${API_V1_PREFIX}/payments`);
    const totalRevenue = (response.data || [])
      .filter((payment) => payment.status === 'PAID')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return wrapData({ totalRevenue });
  },

  updateStatus: (id, status) => {
    if (status === 'FAILED') return api.put(`${API_V1_PREFIX}/payments/${id}/failed`);
    if (status === 'REFUNDED') return api.put(`${API_V1_PREFIX}/payments/${id}/refund`);
    return api.get(`${API_V1_PREFIX}/payments/${id}`);
  },
};

export const reviewAPI = {
  submit: (data) => api.post(`${API_V1_PREFIX}/reviews`, data),
  getAll: () => api.get(`${API_V1_PREFIX}/reviews`),
  getByProvider: (pid) => api.get(`${API_V1_PREFIX}/reviews/provider/${pid}`),
  getByPatient: (pid) => api.get(`${API_V1_PREFIX}/reviews/patient/${pid}`),
  getById: (id) => api.get(`${API_V1_PREFIX}/reviews/${id}`),
  update: (id, data) => api.put(`${API_V1_PREFIX}/reviews/${id}`, data),
  delete: (id) => api.delete(`${API_V1_PREFIX}/reviews/${id}`),
  getAverage: async (pid) => {
    const response = await api.get(`${API_V1_PREFIX}/reviews/provider/${pid}`);
    const reviews = response.data || [];
    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    const average = reviews.length ? total / reviews.length : 0;
    return wrapData({ averageRating: average, count: reviews.length });
  },
  getCount: async (pid) => {
    const response = await api.get(`${API_V1_PREFIX}/reviews/provider/${pid}`);
    return wrapData({ count: (response.data || []).length });
  },
};

export const notifAPI = {
  send: (data) => {
    if (data.channel === 'APP') {
      return api.post(`${API_V1_PREFIX}/notifications/app`, {
        userId: data.recipientId || data.userId,
        recipientName: data.recipientName || data.name || '',
        title: data.title || 'MediBook Notification',
        message: data.message,
      });
    }

    const recipientEmail = data.recipientEmail || data.email;
    if (!recipientEmail) {
      return Promise.resolve(wrapData({ skipped: true }));
    }

    return api.post(`${API_V1_PREFIX}/notifications/email`, {
      userId: data.recipientId || data.userId,
      recipientEmail,
      recipientName: data.recipientName || data.name || '',
      subject: data.title || 'MediBook Notification',
      message: data.message,
    });
  },

  getAll: () => api.get(`${API_V1_PREFIX}/notifications`),
  getByRecipient: (id) => api.get(`${API_V1_PREFIX}/notifications/user/${id}`),
  getUnreadCount: async (id) => {
    const response = await api.get(`${API_V1_PREFIX}/notifications/user/${id}/unread`);
    return wrapData({ unreadCount: (response.data || []).length });
  },
  markRead: (id) => api.post(`${API_V1_PREFIX}/notifications/${id}/read`),
  markAllRead: async (id) => {
    const response = await api.get(`${API_V1_PREFIX}/notifications/user/${id}/unread`);
    const unread = response.data || [];
    await Promise.all(unread.map((notification) => api.post(`${API_V1_PREFIX}/notifications/${notification.notificationId}/read`)));
    return wrapData({ success: true, count: unread.length });
  },
  delete: async () => {
    throw new Error('Delete notification is not supported by the current backend.');
  },
};

export const recordAPI = {
  create: (data) => api.post(`${API_V1_PREFIX}/records/medical`, data),
  getAll: () => api.get(`${API_V1_PREFIX}/records/medical`),
  getByAppointment: async (id) => {
    const response = await api.get(`${API_V1_PREFIX}/records/medical`);
    const record = (response.data || []).find((item) => item.appointmentId === Number(id));
    return wrapData(record || null);
  },
  getByPatient: (pid) => api.get(`${API_V1_PREFIX}/records/medical/patient/${pid}`),
  getByProvider: (pid) => api.get(`${API_V1_PREFIX}/records/medical/provider/${pid}`),
  getById: (id) => api.get(`${API_V1_PREFIX}/records/medical/${id}`),
  update: (id, data) => api.put(`${API_V1_PREFIX}/records/medical/${id}`, data),
  delete: (id) => api.delete(`${API_V1_PREFIX}/records/medical/${id}`),
  attach: (id, url) => api.put(`${API_V1_PREFIX}/records/medical/${id}`, { reportFileUrl: url }),
  getFollowUps: async (pid) => {
    const response = await api.get(`${API_V1_PREFIX}/records/medical/patient/${pid}`);
    return wrapData((response.data || []).filter((record) => Boolean(record.followUpDate)));
  },
  getTodayFollowUps: async () => {
    const response = await api.get(`${API_V1_PREFIX}/records/medical`);
    const today = new Date().toISOString().split('T')[0];
    return wrapData((response.data || []).filter((record) => record.followUpDate === today));
  },
  getCount: async (pid) => {
    const response = await api.get(`${API_V1_PREFIX}/records/medical/patient/${pid}`);
    return wrapData({ count: (response.data || []).length });
  },
};

export const getUser = () => {
  try {
    const raw = localStorage.getItem('medibook_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (user?.role) user.role = normalizeRole(user.role);
    return user;
  } catch {
    return null;
  }
};

export const getToken = () => getStoredToken();

export const saveAuth = (token, user) => {
  const normalizedUser = {
    ...user,
    role: normalizeRole(user?.role),
  };
  localStorage.setItem('medibook_token', token);
  localStorage.setItem('medibook_user', JSON.stringify(normalizedUser));
};

export const clearAuth = () => {
  localStorage.removeItem('medibook_token');
  localStorage.removeItem('medibook_user');
  sessionStorage.removeItem('medibook_pending_login');
};

export const formatDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hh = parseInt(h, 10);
  return `${hh > 12 ? hh - 12 : hh}:${m} ${hh >= 12 ? 'PM' : 'AM'}`;
};

export const getStatusBadge = (status) => {
  const map = {
    SCHEDULED: 'badge-blue',
    COMPLETED: 'badge-green',
    CANCELLED: 'badge-red',
    NO_SHOW: 'badge-yellow',
    Pending: 'badge-yellow',
    SUCCESS: 'badge-green',
    FAILED: 'badge-red',
    REFUNDED: 'badge-gray',
  };
  return map[status] || 'badge-gray';
};

export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default api;
