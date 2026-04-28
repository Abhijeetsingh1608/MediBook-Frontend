# MediBook Microservices Troubleshooting Guide

## 🔴 Common Issues & Solutions

### 1. **Service won't start / Port already in use**

**Error**: `Address already in use` or `Port 8080 in use`

**Solution**:
```bash
# Find what's using the port (Windows)
netstat -ano | findstr :8080

# Kill the process (Windows) - replace PID with the number from above
taskkill /PID <PID> /F

# Or just use a different port in application.properties
server.port=8090
```

---

### 2. **Database connection failed**

**Error**: `Failed to establish a database connection` or `Unknown database 'medibook_auth_db'`

**Solution**:
1. Verify MySQL is running
2. Create all databases:
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
3. Check credentials in `application.properties`:
   ```properties
   spring.datasource.url=jdbc:mysql://localhost:3306/medibook_auth_db
   spring.datasource.username=root
   spring.datasource.password=your_password
   ```

---

### 3. **Eureka shows services as "DOWN" or "UNAVAILABLE"**

**Issue**: Services registered but not responding

**Solutions**:
1. **Wait longer** - Services take 30-60 seconds to fully start
2. **Check service logs** - Look for startup errors
3. **Verify heartbeat** - Services should send heartbeats every 30 seconds
4. **Check service port** - Ensure service is actually running:
   ```bash
   curl http://localhost:8081/health  # Auth Service
   curl http://localhost:8082/health  # Provider Service
   ```

---

### 4. **Frontend can't connect to API Gateway**

**Error**: `Cannot reach localhost:8080` or CORS errors

**Solutions**:
1. **Verify API Gateway is running**:
   ```bash
   curl http://localhost:8080/health
   ```
2. **Check browser console** for specific errors
3. **Verify Eureka** - API Gateway should be registered in Eureka:
   ```
   http://localhost:8761
   ```
4. **Check CORS configuration** in API Gateway's `application.yml`:
   ```yaml
   spring.cloud.gateway.globalcors:
     corsConfigurations:
       '[/**]':
         allowedOrigins: "http://localhost:5173"
         allowedMethods: GET,POST,PUT,DELETE
         allowedHeaders: "*"
   ```

---

### 5. **Services can't communicate with each other**

**Error**: `Service not found` or `Cannot reach microservice`

**Solutions**:
1. **Verify Eureka is running** - Services discover each other through Eureka
   ```
   http://localhost:8761
   ```
2. **Check service names in `application.properties`**:
   ```properties
   spring.application.name=auth-service
   ```
3. **Verify service-to-service communication** - Check RestTemplate/WebClient configuration
4. **Check network** - All services should be on localhost with proper port mapping

---

### 6. **JWT token invalid / 401 Unauthorized**

**Issue**: Frontend gets 401 error even after login

**Solutions**:
1. **Check JWT secret** - Must be same across all services:
   ```properties
   app.jwtSecret=your_secret_key_here
   app.jwtExpirationMs=86400000  # 24 hours
   ```
2. **Verify token storage** - Frontend should store token:
   ```javascript
   localStorage.setItem('medibook_token', token);
   ```
3. **Check API interceptor** - Token should be sent in header:
   ```javascript
   api.interceptors.request.use((config) => {
     const token = localStorage.getItem('medibook_token');
     if (token) config.headers.Authorization = `Bearer ${token}`;
     return config;
   });
   ```

---

### 7. **Service startup is very slow**

**Normal behavior**: Services take 30-60 seconds to fully initialize

**If it's taking too long (>3 minutes)**:
1. Check CPU/memory usage
2. Check logs for errors/warnings
3. Verify database is responsive:
   ```bash
   mysql -u root -p
   SELECT 1;
   ```

---

### 8. **Maven build fails**

**Error**: `BUILD FAILURE` during startup

**Solutions**:
1. **Update Maven dependencies**:
   ```bash
   mvn clean install
   ```
2. **Check Java version** - Must be Java 11 or higher:
   ```bash
   java -version
   ```
3. **Clear Maven cache**:
   ```bash
   rmdir /s C:\Users\%USERNAME%\.m2\repository
   ```

---

### 9. **API calls getting 500 error**

**Issue**: Requests to API Gateway return 500 Internal Server Error

**Solutions**:
1. **Check service logs** - Look for actual error message
2. **Verify dependent services** - Check if all 10 services are running
3. **Check request format** - Ensure JSON is valid
4. **Test with Postman** - Isolate frontend vs backend issue

---

### 10. **Frontend shows "Network Error"**

**Issue**: Frontend can't reach any API

**Solutions**:
1. **Check browser console** - Ctrl+Shift+K for detailed error
2. **Verify API Gateway** is running on 8080
3. **Test manually**:
   ```bash
   curl -X GET http://localhost:8080/auth/health \
     -H "Content-Type: application/json"
   ```
4. **Check network** - Firewall might be blocking localhost:8080

---

## 📊 Quick Diagnostics

### Check all services running:
```bash
powershell -Command "1..10 | ForEach-Object { 'Testing port ' + $_ }"
```

### View Eureka Dashboard:
```
http://localhost:8761
```
All 10 services should show as UP

### Test API Gateway:
```bash
curl -X GET http://localhost:8080/health \
  -H "Content-Type: application/json"
```

### View service logs:
Look in STS console or terminal where you ran the service

---

## 🔧 Quick Fixes Checklist

- [ ] MySQL is running and all 8 databases exist
- [ ] All services started in correct order
- [ ] No service returned an error during startup
- [ ] Eureka Dashboard shows all 10 services as UP
- [ ] API Gateway responds to `http://localhost:8080/health`
- [ ] Frontend API token is stored in localStorage
- [ ] Browser console shows no CORS errors
- [ ] All service logs look clean (no red ERROR messages)

---

## 📞 Debug Command Cheat Sheet

```bash
# Check if port is in use
netstat -ano | findstr :8080

# Kill process on port
taskkill /PID <PID> /F

# Test API Gateway
curl http://localhost:8080/health

# Test Auth Service
curl http://localhost:8081/health

# List all Java processes
jps -l

# Kill Java process
taskkill /F /IM java.exe

# View MySQL databases
mysql -u root -p -e "SHOW DATABASES;"

# Clear Maven cache
mvn clean
```

---

## 💡 Pro Tips

1. **Use multiple terminals** - Keep each service in its own terminal for easy monitoring
2. **Check Eureka first** - If services show as DOWN, start them in order
3. **Restart slowly** - If things go wrong, wait 30 seconds between service restarts
4. **Check logs first** - Always look at service logs before assuming it's a network issue
5. **Test with curl** - Isolate frontend issues from backend issues using curl commands

---

**Last Updated**: April 16, 2026  
**For**: MediBook Microservices Architecture
