# MediBook Microservices Startup Guide

## ✅ Frontend Configuration Status
Your frontend is **ready to go** — no changes needed!

- **API Gateway Base URL**: `http://localhost:8080`
- **API Configuration**: [src/utils/api.js](src/utils/api.js)
- **JWT Token**: Automatically attached to all requests
- **Authentication**: 401 errors handled globally (redirects to login)

---

## 📋 Prerequisites

### MySQL Database Setup
Create all 8 databases before starting any microservice:

```sql
CREATE DATABASE medibook_auth_db;
CREATE DATABASE medibook_provider_db;
CREATE DATABASE medibook_slot_db;
CREATE DATABASE medibook_appointment_db;
CREATE DATABASE medibook_payment_db;
CREATE DATABASE medibook_notification_db;
CREATE DATABASE medibook_review_db;
CREATE DATABASE medibook_record_db;
```

**Note:** `spring.jpa.hibernate.ddl-auto=update` will automatically create all tables on first service startup.

### Tools Required
- **STS (Spring Tool Suite)** or IntelliJ IDEA
- **Java 11+**
- **Maven**
- **MySQL Server** running

---

## 🚀 Startup Sequence (Strict Order)

Each service depends on the previous ones. Start them in this exact order:

| # | Service | Port | Command/Details |
|---|---------|------|-----------------|
| 1 | **eureka-server** | 8761 | Service registry — all other services register here |
| 2 | **api-gateway** | 8080 | Entry point for frontend (http://localhost:8080) |
| 3 | **auth-service** | 8081 | Authentication & authorization |
| 4 | **provider-service** | 8082 | Doctor/provider management |
| 5 | **slot-service** | 8083 | Appointment slot management |
| 6 | **appointment-service** | 8084 | Appointment booking & management |
| 7 | **payment-service** | 8085 | Payment processing (Razorpay) |
| 8 | **notification-service** | 8086 | Email/SMS notifications |
| 9 | **review-service** | 8087 | Ratings & reviews |
| 10 | **record-service** | 8088 | Medical records | Uses `AppointmentClient`, `UserClient`, `NotificationClient` |

---

## 📂 How to Open Each Service in STS

Each service is a separate Maven project. Repeat this for each service:

### Steps:
1. **File** → **Import**
2. Select **Existing Maven Projects**
3. **Browse** to: `medibook-microservices/{service-name}`
   - Example: `medibook-microservices/auth-service`
   - Example: `medibook-microservices/provider-service`
4. Click **Finish**
5. Each service opens as its own STS project

### Repeat for all 10 services:
```
medibook-microservices/
├── eureka-server/
├── api-gateway/
├── auth-service/
├── provider-service/
├── slot-service/
├── appointment-service/
├── payment-service/
├── notification-service/
├── review-service/
└── record-service/
```

---

## ▶️ Starting Each Service

### In STS:
1. Right-click on service project
2. **Run As** → **Spring Boot App** (or **Java Application**)
3. Wait for startup message in console

### In Terminal:
```bash
cd medibook-microservices/eureka-server
mvn spring-boot:run
```

**Wait for each service to fully start before starting the next one!**

---

## ✅ Verification Checklist

### After all services are running:

- [ ] **Eureka Dashboard**: http://localhost:8761
  - Should show all 10 services registered
  - Status should be "UP"

- [ ] **API Gateway**: http://localhost:8080
  - Should be accessible (test with browser or Postman)

- [ ] **Frontend**: 
  ```bash
  npm run dev
  # Starts on http://localhost:5173 (Vite)
  ```

- [ ] **Test API Call**:
  ```bash
  curl http://localhost:8080/auth/health
  ```

---

## 🔄 Service Dependencies & Ports

```
Frontend (Vite)
      ↓
http://localhost:5173
      ↓
API Gateway (8080) ← Entry Point
      ↓
   ┌──┴──┬───┬────┬──────┬─────┬────────┬────────┐
   ↓     ↓   ↓    ↓      ↓     ↓        ↓        ↓
Auth  Provider Slot Appointment Payment Notif  Review Record
(8081)(8082) (8083)(8084)   (8085)   (8086) (8087) (8088)
   ↓
 Eureka Registry (8761)
```

---

## 🛠️ Troubleshooting

### Service won't start?
1. **Check MySQL databases exist** (see Prerequisites)
2. **Check port isn't in use**: `netstat -ano | findstr :8080` (Windows)
3. **Check Java/Maven installed**: `java -version`, `mvn -version`
4. **Check service.properties** for correct database URL

### Eureka shows "UNAVAILABLE"?
- Service hasn't fully started yet — wait 30-60 seconds
- Check service logs for errors

### Frontend can't reach API?
1. **Verify API Gateway is running** on port 8080
2. **Check browser console** for CORS errors
3. **Test with curl**: `curl http://localhost:8080/auth/health`

### Database connection errors?
1. **Verify MySQL is running**
2. **Verify all 8 databases created** (see Prerequisites)
3. **Check `spring.datasource.url`** in each service's `application.properties`

---

## 📝 Environment Files

Ensure each service has its `application.properties` or `application.yml` configured:

### Common Settings:
```properties
spring.application.name=auth-service
spring.jpa.hibernate.ddl-auto=update
spring.datasource.url=jdbc:mysql://localhost:3306/medibook_auth_db
spring.datasource.username=root
spring.datasource.password=your_mysql_password
server.port=8081
eureka.client.service-url.defaultZone=http://localhost:8761/eureka
```

---

## 🎯 Start Command Summary

Open 10 terminals and run (in this order):

```bash
# Terminal 1 - Eureka
cd medibook-microservices/eureka-server && mvn spring-boot:run

# Terminal 2 - API Gateway  
cd medibook-microservices/api-gateway && mvn spring-boot:run

# Terminal 3 - Auth Service
cd medibook-microservices/auth-service && mvn spring-boot:run

# Terminal 4 - Provider Service
cd medibook-microservices/provider-service && mvn spring-boot:run

# Terminal 5 - Slot Service
cd medibook-microservices/slot-service && mvn spring-boot:run

# Terminal 6 - Appointment Service
cd medibook-microservices/appointment-service && mvn spring-boot:run

# Terminal 7 - Payment Service
cd medibook-microservices/payment-service && mvn spring-boot:run

# Terminal 8 - Notification Service
cd medibook-microservices/notification-service && mvn spring-boot:run

# Terminal 9 - Review Service
cd medibook-microservices/review-service && mvn spring-boot:run

# Terminal 10 - Record Service
cd medibook-microservices/record-service && mvn spring-boot:run

# Terminal 11 - Frontend (after all services are up)
cd medibook-ui && npm run dev
```

---

## 🎨 Frontend Commands

```bash
# Development server
npm run dev           # http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📞 API Endpoints (All through API Gateway @ 8080)

All calls go through the API Gateway to the appropriate service:

```
POST   http://localhost:8080/auth/login
GET    http://localhost:8080/providers/all
GET    http://localhost:8080/slots/available
POST   http://localhost:8080/appointments/book
POST   http://localhost:8080/payments/process
```

Your frontend's `api.js` already handles routing — no changes needed! 🎉

---

**Created**: April 16, 2026  
**Last Updated**: During microservices migration
