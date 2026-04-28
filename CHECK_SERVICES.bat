@echo off
REM ================================================
REM MediBook Service Health Check
REM Verifies all microservices are running
REM ================================================

echo.
echo =========================================
echo   MediBook Service Health Check
echo =========================================
echo.
echo Checking if all services are running...
echo.

setlocal enabledelayedexpansion

REM Define services and ports
set "services[1]=Eureka:8761"
set "services[2]=API Gateway:8080"
set "services[3]=Auth Service:8081"
set "services[4]=Provider Service:8082"
set "services[5]=Slot Service:8083"
set "services[6]=Appointment Service:8084"
set "services[7]=Payment Service:8085"
set "services[8]=Notification Service:8086"
set "services[9]=Review Service:8087"
set "services[10]=Record Service:8088"

set "up=0"
set "down=0"

for /L %%i in (1,1,10) do (
    set "service=!services[%%i]!"
    for /F "tokens=1,2 delims=:" %%A in ("!service!") do (
        set "name=%%A"
        set "port=%%B"
        
        REM Try to ping the service
        timeout /t 1 /nobreak > nul 2>&1
        
        powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:!port!' -ErrorAction Stop; exit 0 } catch { exit 1 }" 2>nul
        
        if !errorlevel! equ 0 (
            echo [UP]   !name! (Port !port!)
            set /a up+=1
        ) else (
            echo [DOWN] !name! (Port !port!)
            set /a down+=1
        )
    )
)

echo.
echo =========================================
echo Status Summary
echo =========================================
echo UP:   !up!/10
echo DOWN: !down!/10
echo.

if !down! equ 0 (
    echo SUCCESS: All services are running!
    echo.
    echo Quick Links:
    echo  - Eureka Dashboard:  http://localhost:8761
    echo  - API Gateway:       http://localhost:8080
    echo  - Frontend:          http://localhost:5173
    echo.
) else (
    echo WARNING: Some services are not running.
    echo Please check service logs and try again.
    echo.
    echo Startup order (must be exact):
    echo  1. eureka-server
    echo  2. api-gateway
    echo  3. auth-service
    echo  4. provider-service
    echo  5. slot-service
    echo  6. appointment-service
    echo  7. payment-service
    echo  8. notification-service
    echo  9. review-service
    echo 10. record-service
    echo.
)

pause
