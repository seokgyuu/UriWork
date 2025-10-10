"""
인증 관련 API 엔드포인트
사용자 등록, 로그인 등의 인증 기능을 제공합니다.
"""

from fastapi import APIRouter, HTTPException, Depends
from firebase_admin import auth
from datetime import datetime
from models import UserCreate, UserLogin
from utils import get_current_user

router = APIRouter(prefix="/auth", tags=["인증"])

# 사용자 등록
@router.post("/register")
async def register_user(user: UserCreate):
    """사용자를 등록합니다."""
    try:
        # Firebase Auth로 사용자 생성
        user_record = auth.create_user(
            email=user.email,
            password=user.password,
            display_name=user.name
        )
        
        # Firestore에 사용자 정보 저장
        from utils import db
        user_data = {
            "uid": user_record.uid,
            "email": user.email,
            "name": user.name,
            "user_type": user.user_type,
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("users").document(user_record.uid).set(user_data)
        
        return {"message": "사용자가 성공적으로 등록되었습니다", "uid": user_record.uid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 사용자 로그인
@router.post("/login")
async def login_user(user: UserLogin):
    """사용자 로그인을 처리합니다."""
    try:
        # Firebase Auth로 로그인 (실제로는 클라이언트에서 처리)
        return {"message": "로그인 성공"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
