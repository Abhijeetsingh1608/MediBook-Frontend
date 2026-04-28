@echo off
REM ================================================
REM MediBook Microservices Startup Script
REM Windows Batch File
REM ================================================
REM This script starts all microservices in the correct order
REM Requires: 10 terminal windows / cmd instances

echo.
echo =========================================
echo   MediBook Microservices Startup
echo =========================================
echo.
echo This script will open each microservice in a new terminal window
echo in the correct startup sequence.
echo.
echo Prerequisites:
echo  - MySQL databases created
echo  - All services in medibook-microservices folder
echo  - Maven installed
echo.
pause

REM Get the path to medibook-microservices directory
REM Change this path if your services are elsewhere
set SERVICES_PATH=C:\path\to\medibook-microservices

if not exist "%SERVICES_PATH%" (
    echo Error: Services directory not found at %SERVICES_PATH%
    echo Please edit this script and update SERVICES_PATH
    pause
    exit /b 1
)

echo Starting services in sequence...
echo.

REM 1. Eureka Server
echo [1/10] Starting Eureka Server (8761)...
start "Eureka Server" cmd /k "cd /d %SERVICES_PATH%\eureka-server && mvn spring-boot:run"
timeout /t 15 /nobreak

REM 2. API Gateway
echo [2/10] Starting API Gateway (8080)...
start "API Gateway" cmd /k "cd /d %SERVICES_PATH%\api-gateway && mvn spring-boot:run"
timeout /t 10 /nobreak

REM 3. Auth Service
echo [3/10] Starting Auth Service (8081)...
start "Auth Service" cmd /k "cd /d %SERVICES_PATH%\auth-service && mvn spring-boot:run"
timeout /t 8 /nobreak

REM 4. Provider Service
echo [4/10] Starting Provider Service (8082)...
start "Provider Service" cmd /k "cd /d %SERVICES_PATH%\provider-service && mvn spring-boot:run"
timeout /t 8 /nobreak

REM 5. Slot Service
echo [5/10] Starting Slot Service (8083)...
start "Slot Service" cmd /k "cd /d %SERVICES_PATH%\slot-service && mvn spring-boot:run"
timeout /t 8 /nobreak

REM 6. Appointment Service
echo [6/10] Starting Appointment Service (8084)...
start "Appointment Service" cmd /k "cd /d %SERVICES_PATH%\appointment-service && mvn spring-boot:run"
timeout /t 8 /nobreak

REM 7. Payment Service
echo [7/10] Starting Payment Service (8085)...
start "Payment Service" cmd /k "cd /d %SERVICES_PATH%\payment-service && mvn spring-boot:run"
timeout /t 8 /nobreak

REM 8. Notification Service
echo [8/10] Starting Notification Service (8086)...
start "Notification Service" cmd /k "cd /d %SERVICES_PATH%\notification-service && mvn spring-boot:run"
timeout /t 8 /nobreak

REM 9. Review Service
echo [9/10] Starting Review Service (8087)...
start "Review Service" cmd /k "cd /d %SERVICES_PATH%\review-service && mvn spring-boot:run"
timeout /t 8 /nobreak

REM 10. Record Service
echo [10/10] Starting Record Service (8088)...
start "Record Service" cmd /k "cd /d %SERVICES_PATH%\record-service && mvn spring-boot:run"
timeout /t 8 /nobreak

echo.
echo =========================================
echo All services launched!
echo =========================================
echo.
echo Verify startup:
echo  1. Check Eureka Dashboard: http://localhost:8761
echo  2. All services should show as UP
echo  3. Test API Gateway: http://localhost:8080
echo.
echo Once all services are up, start the frontend in another terminal:
echo  - cd medibook-ui
echo  - npm run dev
echo.
echo Then open the app: http://localhost:5173
echo.
pause
