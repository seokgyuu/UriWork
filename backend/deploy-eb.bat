@echo off
echo 🚀 AWS Elastic Beanstalk 배포 시작...

REM EB CLI 설치 확인
eb --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ EB CLI가 설치되지 않았습니다!
    echo 💡 다음 명령어로 설치하세요:
    echo pip install awsebcli
    pause
    exit /b 1
)

REM 환경변수 파일 확인
if not exist "production.env" (
    echo ❌ production.env 파일이 없습니다!
    echo 💡 production.env 파일을 생성하고 필요한 환경변수를 설정하세요.
    pause
    exit /b 1
)

REM EB 초기화 (처음 한 번만)
if not exist ".elasticbeanstalk" (
    echo 📋 EB 환경 초기화 중...
    eb init --platform python-3.11 --region ap-northeast-2
)

REM 환경변수 설정
echo 🔧 환경변수 설정 중...
for /f "tokens=1,2 delims==" %%a in (production.env) do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        eb setenv %%a=%%b
    )
)

REM 배포 실행
echo 🚀 배포 실행 중...
eb deploy

if %errorlevel% equ 0 (
    echo ✅ 배포 성공!
    echo 🌐 애플리케이션 URL 확인: eb status
    eb status
) else (
    echo ❌ 배포 실패!
    echo 📋 로그 확인: eb logs
)

pause
