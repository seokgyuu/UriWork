@echo off
echo 🚀 AWS Lambda 배포 시작...

REM AWS CLI 설치 확인
aws --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ AWS CLI가 설치되지 않았습니다!
    echo 💡 https://aws.amazon.com/cli/ 에서 다운로드하세요.
    pause
    exit /b 1
)

REM 환경변수 파일 확인
if not exist "production.env" (
    echo ❌ production.env 파일이 없습니다!
    pause
    exit /b 1
)

REM 배포 패키지 디렉토리 생성
if exist "lambda-deployment" rmdir /s /q lambda-deployment
mkdir lambda-deployment

REM 의존성 설치
echo 📦 의존성 설치 중...
pip install -r requirements-lambda.txt -t lambda-deployment/

REM 애플리케이션 코드 복사
echo 📋 코드 복사 중...
copy lambda_handler.py lambda-deployment\
copy main.py lambda-deployment\
copy production.env lambda-deployment\.env

REM ZIP 파일 생성
echo 📦 배포 패키지 생성 중...
cd lambda-deployment
powershell Compress-Archive -Path * -DestinationPath ../lambda-deployment.zip
cd ..

REM Lambda 함수 업데이트
echo 🚀 Lambda 함수 업데이트 중...
aws lambda update-function-code --function-name calendar-api --zip-file fileb://lambda-deployment.zip

REM 환경변수 설정
echo 🔧 환경변수 설정 중...
for /f "tokens=1,2 delims==" %%a in (production.env) do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        aws lambda update-function-configuration --function-name calendar-api --environment Variables={%%a=%%b}
    )
)

echo ✅ Lambda 배포 완료!
echo 🌐 API Gateway URL 확인: aws apigateway get-rest-apis

REM 정리
rmdir /s /q lambda-deployment
del lambda-deployment.zip

pause
