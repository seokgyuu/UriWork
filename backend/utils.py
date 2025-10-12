"""
유틸리티 함수들
공통으로 사용되는 헬퍼 함수들과 설정들을 정의합니다.
"""

import os
from dotenv import load_dotenv
import openai
import firebase_admin
from firebase_admin import credentials, firestore, auth
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# 환경변수 로드 (여러 경로에서 시도)
def load_environment():
    """환경변수를 로드합니다."""
    env_paths = [
        ".env",
        "backend/.env", 
        "../.env",
        os.path.join(os.path.dirname(__file__), ".env")
    ]

    for env_path in env_paths:
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"환경 변수 파일 로드됨: {env_path}")
            break
    else:
        print("⚠️ .env 파일을 찾을 수 없습니다. 시스템 환경 변수를 사용합니다.")

# 환경 설정
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8080))  # Cloud Run 기본 포트로 변경

# OpenAI API 설정
def setup_openai():
    """OpenAI API를 설정합니다."""
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        print("⚠️ OpenAI API 키가 설정되지 않았습니다. AI 기능이 제한됩니다.")
        print("💡 환경 변수 OPENAI_API_KEY를 설정하거나 .env 파일을 생성하세요.")
        print("💡 .env 파일 예시:")
        print("   OPENAI_API_KEY=your_api_key_here")
        print("   HOST=0.0.0.0")
        print("   PORT=8080")
    else:
        print("✅ OpenAI API 키가 설정되었습니다.")

# OpenAI API 호출 헬퍼 함수 (버전 호환성)
def call_openai_api(messages, model="gpt-3.5-turbo", temperature=0.1, max_tokens=2000):
    """OpenAI API 호출을 버전에 관계없이 처리하는 헬퍼 함수"""
    try:
        # 최신 버전 (1.0.0+) 시도
        from openai import OpenAI
        client = OpenAI(api_key=openai.api_key)
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    except ImportError:
        # 구버전 (0.28.x) 사용
        response = openai.ChatCompletion.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"OpenAI API 호출 실패: {e}")
        raise e

# Firebase 초기화
def initialize_firebase():
    """Firebase를 초기화합니다."""
    db = None
    try:
        if not firebase_admin._apps:
            # 서비스 계정 키 파일 경로들 확인
            service_account_paths = [
                "serviceAccountKey.json",
                "firebase-service-account.json",
                "calendar-8e1a2-firebase-adminsdk.json"
            ]
            
            cred = None
            for path in service_account_paths:
                try:
                    if os.path.exists(path):
                        cred = credentials.Certificate(path)
                        print(f"Firebase 서비스 계정 키 로드됨: {path}")
                        break
                except Exception as e:
                    print(f"서비스 계정 키 로드 실패 ({path}): {e}")
                    continue
            
            if cred:
                firebase_admin.initialize_app(cred)
            else:
                # 서비스 계정 키가 없으면 기본 초기화 (개발용)
                print("서비스 계정 키를 찾을 수 없습니다. 기본 초기화를 시도합니다.")
                firebase_admin.initialize_app()
        
        # Firestore 클라이언트 초기화
        db = firestore.client()
        print("Firebase 초기화 성공")
    except Exception as e:
        print(f"Firebase 초기화 실패: {e}")
        print("Firebase 없이 실행됩니다.")
        db = None
    
    return db

# 인증 함수
security = HTTPBearer()

# 전역 db 변수 (main.py에서 설정됨)
db = None

def set_db(database):
    """전역 db 변수를 설정합니다."""
    global db
    db = database

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """현재 사용자를 인증합니다."""
    try:
        token = credentials.credentials
        
        # 개발 모드 토큰 확인 (Firebase가 있더라도 개발 토큰 허용)
        if token == "dev_token_123":
            return {"uid": "dev_user_123", "email": "dev@example.com"}
        
        # Firebase가 있으면 실제 토큰 검증
        if db is not None:
            decoded_token = auth.verify_id_token(token)
            return decoded_token
        else:
            # Firebase가 없고 개발 토큰이 아니면 오류
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Firebase 인증이 필요합니다"
            )
    except Exception as e:
        try:
            if token == "dev_token_123":
                # 개발 모드에서는 더미 사용자 정보 반환
                return {"uid": "dev_user_123", "email": "dev@example.com"}
        except NameError:
            # token 변수가 정의되지 않은 경우
            pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다"
        )
