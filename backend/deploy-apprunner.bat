@echo off
echo 🚀 AWS App Runner 배포 시작...

REM AWS CLI 설치 확인
aws --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS CLI가 설치되지 않았습니다!
    pause
    exit /b 1
)

echo 📋 App Runner 배포 방법:
echo.
echo 1. AWS 콘솔에서 App Runner 서비스로 이동
echo 2. "Create service" 클릭
echo 3. Source 설정:
echo    - Source type: Source code repository
echo    - Repository: GitHub 연결 후 선택
echo    - Branch: main
echo    - Configuration file: apprunner.yaml
echo.
echo 4. Service 설정:
echo    - Service name: calendar-api
echo    - Virtual CPU: 0.25 vCPU
echo    - Virtual memory: 0.5 GB
echo.
echo 5. Environment variables 설정:
echo    - ENVIRONMENT: production
echo    - OPENAI_API_KEY: your_openai_key
echo    - FIREBASE_PROJECT_ID: your_project_id
echo    - FIREBASE_PRIVATE_KEY: your_private_key
echo    - FIREBASE_CLIENT_EMAIL: your_client_email
echo.
echo 6. Auto-deploy 설정:
echo    - Enable auto-deploy: Yes
echo.
echo 7. Create service 클릭하여 배포 시작
echo.
echo 💡 배포 완료 후 제공되는 URL을 사용하세요!

pause
