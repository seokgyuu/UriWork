"""
백엔드 API 서버 (FastAPI)
예약 시스템의 모든 API 엔드포인트를 제공하는 백엔드 서버
Firebase Authentication, Firestore 데이터베이스 연동
사용자 인증, 예약 관리, 챗봇, 구독 등 모든 기능의 API 제공
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# FastAPI 앱 생성
app = FastAPI(title="Calendar Booking System API")

# 환경 변수에서 설정 가져오기
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Firebase 및 OpenAI 초기화 (선택적)
try:
    from utils import load_environment, setup_openai, initialize_firebase, set_db
    load_environment()
    setup_openai()
    db = initialize_firebase()
    set_db(db)
    print("✅ Firebase and OpenAI initialized")
except Exception as e:
    print(f"⚠️ Firebase/OpenAI initialization failed: {e}")
    db = None

# CORS 설정 (모든 origin 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 헬스 체크 엔드포인트
@app.get("/health")
async def health_check():
    """헬스체크 엔드포인트"""
    return {
        "status": "healthy",
        "environment": ENVIRONMENT,
        "message": "서버가 정상적으로 실행 중입니다.",
        "port": os.getenv("PORT", "8080")
    }

# 루트 엔드포인트
@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "Calendar Booking System API",
        "version": "1.0.0",
        "status": "running",
        "environment": ENVIRONMENT
    }

# 테스트 엔드포인트
@app.get("/test")
async def test():
    """테스트 엔드포인트"""
    return {
        "message": "API가 정상적으로 작동합니다!",
        "timestamp": "2024-01-01T00:00:00Z",
        "environment": ENVIRONMENT
    }

# 라우터들 import 및 등록
try:
    from auth import router as auth_router
    from business import router as business_router
    from worker import router as worker_router
    from booking import router as booking_router
    from chatbot import router as chatbot_router
    from ai_schedule import router as ai_schedule_router

    # 라우터들 등록
    app.include_router(auth_router)
    app.include_router(business_router)
    app.include_router(worker_router)
    app.include_router(booking_router)
    app.include_router(chatbot_router)
    app.include_router(ai_schedule_router)

    print("✅ 모든 라우터가 성공적으로 로드되었습니다!")
except Exception as e:
    print(f"❌ 라우터 로딩 실패: {e}")
    print("기본 엔드포인트만 사용합니다.")