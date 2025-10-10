#!/bin/bash
# Google Cloud Run 배포 스크립트

echo "🚀 Google Cloud Run에 FastAPI 배포 시작..."

# 프로젝트 설정
PROJECT_ID="calendar-8e1a2"
SERVICE_NAME="uriwork-fastapi"
REGION="asia-northeast3"

# 1. Google Cloud SDK 확인
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud SDK가 설치되지 않았습니다."
    echo "다음 명령어로 설치하세요:"
    echo "curl https://sdk.cloud.google.com | bash"
    exit 1
fi

# 2. 프로젝트 설정
echo "📋 프로젝트 설정: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# 3. 필요한 API 활성화
echo "🔧 필요한 API 활성화..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com

# 4. Docker 이미지 빌드 및 푸시
echo "🐳 Docker 이미지 빌드 및 푸시..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME ./backend

# 5. Cloud Run 서비스 배포
echo "🚀 Cloud Run 서비스 배포..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --timeout 300 \
    --concurrency 100 \
    --set-env-vars ENVIRONMENT=production \
    --set-env-vars OPENAI_API_KEY="your_openai_api_key" \
    --set-env-vars FIREBASE_PROJECT_ID="calendar-8e1a2"

echo "✅ 배포 완료!"
echo "🌐 서비스 URL: https://$SERVICE_NAME-$PROJECT_ID.a.run.app"
