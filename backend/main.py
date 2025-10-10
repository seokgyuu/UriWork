"""
백엔드 API 서버 (FastAPI)
예약 시스템의 모든 API 엔드포인트를 제공하는 백엔드 서버
Firebase Authentication, Firestore 데이터베이스 연동
사용자 인증, 예약 관리, 챗봇, 구독 등 모든 기능의 API 제공
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from utils import load_environment, setup_openai, initialize_firebase, ENVIRONMENT

# 환경변수 로드
load_environment()

# OpenAI 설정
setup_openai()

# Firebase 초기화
db = initialize_firebase()

# 전역 db 변수 설정
from utils import set_db
set_db(db)

# FastAPI 앱 생성
app = FastAPI(title="캘린더 예약 시스템 API")

# 헬스 체크 엔드포인트
@app.get("/health")
async def health_check():
    """프로덕션용 헬스체크 엔드포인트"""
    import psutil
    import time
    
    try:
        # 시스템 리소스 체크
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Firebase 연결 체크
        firebase_status = "connected" if db is not None else "disconnected"
        
        # OpenAI API 체크
        openai_status = "configured" if openai.api_key else "not_configured"
        
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "environment": ENVIRONMENT,
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "disk_percent": disk.percent
            },
            "services": {
                "firebase": firebase_status,
                "openai": openai_status
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": time.time()
        }
# CORS 설정 (환경에 따라 다르게)
if ENVIRONMENT == "production":
    # 프로덕션 환경: 실제 도메인만 허용
    allowed_origins = [
        "http://52.78.180.64:8000",  # EC2 서버 자체
        "http://localhost:5173",      # 로컬 개발 서버
        "http://localhost:3000",      # 로컬 개발 서버
        "capacitor://localhost",      # Capacitor 앱
        "ionic://localhost",          # Ionic 앱
        "*"  # 임시로 모든 origin 허용 (보안상 나중에 제한 필요)
    ]
else:
    # 개발 환경: 로컬 주소들 허용
    allowed_origins = [
        "http://localhost:5173", 
        "http://localhost:3000", 
        "http://127.0.0.1:5173",
        "capacitor://localhost",
        "ionic://localhost",
        "http://localhost",
        "https://localhost",
        "*"  # 개발 환경에서는 모든 origin 허용
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터들 import 및 등록
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


# 서버 실행
if __name__ == "__main__":
    import uvicorn
    from utils import HOST, PORT
    uvicorn.run(app, host=HOST, port=PORT)