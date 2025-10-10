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
app = FastAPI(title="캘린더 예약 시스템 API")

# 환경 변수에서 설정 가져오기
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# 헬스 체크 엔드포인트 (간단한 버전)
@app.get("/health")
async def health_check():
    """간단한 헬스체크 엔드포인트"""
    return {
        "status": "healthy",
        "environment": ENVIRONMENT,
        "message": "서버가 정상적으로 실행 중입니다."
    }

# 루트 엔드포인트
@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "캘린더 예약 시스템 API",
        "version": "1.0.0",
        "status": "running"
    }