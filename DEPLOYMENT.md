# UriWork 배포 가이드

## 백엔드 서버 배포

### 1. Heroku 배포 (추천 - 무료)

1. **Heroku CLI 설치**
   ```bash
   # macOS
   brew install heroku/brew/heroku
   
   # 또는 https://devcenter.heroku.com/articles/heroku-cli 에서 다운로드
   ```

2. **Heroku 앱 생성**
   ```bash
   cd backend
   heroku create your-app-name-backend
   ```

3. **환경 변수 설정**
   ```bash
   heroku config:set OPENAI_API_KEY=your_openai_api_key
   heroku config:set ENVIRONMENT=production
   heroku config:set HOST=0.0.0.0
   heroku config:set PORT=8001
   ```

4. **Firebase 서비스 계정 키 설정**
   ```bash
   # serviceAccountKey.json 파일을 base64로 인코딩
   base64 -i serviceAccountKey.json | pbcopy
   
   # Heroku에 환경 변수로 설정
   heroku config:set FIREBASE_SERVICE_ACCOUNT_KEY="$(cat serviceAccountKey.json | base64)"
   ```

5. **배포**
   ```bash
   git add .
   git commit -m "Deploy backend"
   git push heroku main
   ```

### 2. Railway 배포 (무료)

1. **Railway 계정 생성**: https://railway.app
2. **GitHub 저장소 연결**
3. **환경 변수 설정**:
   - `OPENAI_API_KEY`: OpenAI API 키
   - `ENVIRONMENT`: production
   - `FIREBASE_SERVICE_ACCOUNT_KEY`: base64 인코딩된 서비스 계정 키

### 3. Render 배포 (무료)

1. **Render 계정 생성**: https://render.com
2. **새 Web Service 생성**
3. **GitHub 저장소 연결**
4. **빌드 명령어**: `pip install -r requirements.txt`
5. **실행 명령어**: `gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker`
6. **환경 변수 설정** (위와 동일)

## 프론트엔드 앱 배포

### 1. iOS 앱 스토어 배포

1. **Xcode에서 프로젝트 열기**
   ```bash
   cd ios
   open App.xcworkspace
   ```

2. **API URL 업데이트**
   - `src/services/api.js`에서 `your-backend-server.com`을 실제 배포된 백엔드 URL로 변경

3. **앱 서명 및 업로드**
   - Xcode에서 Product → Archive
   - App Store Connect에 업로드

### 2. Android 앱 스토어 배포

1. **Android Studio에서 프로젝트 열기**
   ```bash
   cd android
   # Android Studio에서 열기
   ```

2. **API URL 업데이트** (위와 동일)

3. **APK/AAB 빌드 및 업로드**

## 환경 변수 설정

### 개발 환경 (.env 파일)
```env
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8001
OPENAI_API_KEY=your_openai_api_key
```

### 프로덕션 환경 (클라우드 서비스)
```env
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8001
OPENAI_API_KEY=your_openai_api_key
FIREBASE_SERVICE_ACCOUNT_KEY=base64_encoded_key
```

## 보안 고려사항

1. **API 키 보안**: 절대 코드에 하드코딩하지 말고 환경 변수 사용
2. **CORS 설정**: 프로덕션에서는 실제 도메인만 허용
3. **HTTPS 사용**: 프로덕션에서는 반드시 HTTPS 사용
4. **Firebase 보안 규칙**: Firestore 보안 규칙 적절히 설정

## 모니터링

1. **서버 상태 확인**: `/health` 엔드포인트 사용
2. **로그 모니터링**: 클라우드 서비스의 로그 기능 활용
3. **에러 추적**: Sentry 등 에러 추적 서비스 연동 고려

## 비용 예상

- **Heroku**: 무료 티어 (월 550시간), 유료는 $7/월부터
- **Railway**: 무료 티어 (월 $5 크레딧), 유료는 $5/월부터
- **Render**: 무료 티어 (제한적), 유료는 $7/월부터
- **Firebase**: 무료 티어 제공, 사용량에 따라 과금
- **OpenAI**: 사용량에 따라 과금 (토큰당)
