@echo off
echo 🚀 AWS EC2 배포 시작...

REM 환경변수 파일 확인
if not exist "production.env" (
    echo ❌ production.env 파일이 없습니다!
    pause
    exit /b 1
)

echo 📋 EC2 서버 설정 명령어들:
echo.
echo 1. EC2 인스턴스에 접속 후 다음 명령어들을 실행하세요:
echo.
echo # 시스템 업데이트
echo sudo apt update && sudo apt upgrade -y
echo.
echo # Python 3.11 설치
echo sudo apt install python3.11 python3.11-venv python3.11-dev python3-pip -y
echo.
echo # Nginx 설치
echo sudo apt install nginx -y
echo.
echo # 프로젝트 디렉토리 생성
echo mkdir -p /var/www/calendar-api
echo cd /var/www/calendar-api
echo.
echo # Git에서 코드 클론 (또는 SCP로 업로드)
echo git clone https://github.com/your-username/your-repo.git .
echo cd backend
echo.
echo # 가상환경 생성 및 활성화
echo python3.11 -m venv venv
echo source venv/bin/activate
echo.
echo # 의존성 설치
echo pip install -r requirements.txt
echo.
echo # 환경변수 설정
echo cp production.env .env
echo nano .env  # 실제 값으로 수정
echo.
echo # Gunicorn으로 실행
echo gunicorn main:app --bind 0.0.0.0:8000 --daemon
echo.
echo # Nginx 설정
echo sudo nano /etc/nginx/sites-available/calendar-api
echo.
echo # Nginx 활성화
echo sudo ln -s /etc/nginx/sites-available/calendar-api /etc/nginx/sites-enabled/
echo sudo nginx -t
echo sudo systemctl restart nginx
echo.
echo # 방화벽 설정
echo sudo ufw allow 22
echo sudo ufw allow 80
echo sudo ufw allow 443
echo sudo ufw enable
echo.
echo 2. Nginx 설정 파일 내용:
echo.
echo server {
echo     listen 80;
echo     server_name your-domain.com;
echo.
echo     location / {
echo         proxy_pass http://127.0.0.1:8000;
echo         proxy_set_header Host $host;
echo         proxy_set_header X-Real-IP $remote_addr;
echo         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
echo         proxy_set_header X-Forwarded-Proto $scheme;
echo     }
echo }
echo.
echo 3. SSL 인증서 설정 (Let's Encrypt):
echo sudo apt install certbot python3-certbot-nginx -y
echo sudo certbot --nginx -d your-domain.com

pause
