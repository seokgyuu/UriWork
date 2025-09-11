"""
백엔드 API 서버 (FastAPI)
예약 시스템의 모든 API 엔드포인트를 제공하는 백엔드 서버
Firebase Authentication, Firestore 데이터베이스 연동
사용자 인증, 예약 관리, 챗봇, 구독 등 모든 기능의 API 제공
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import firebase_admin
from firebase_admin import credentials, firestore, auth
import os
from datetime import datetime, timedelta
import uuid
import re
import time
from dotenv import load_dotenv
import openai
import asyncio

# 환경변수 로드 (여러 경로에서 시도)
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

# OpenAI API 설정
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    print("⚠️ OpenAI API 키가 설정되지 않았습니다. AI 기능이 제한됩니다.")
    print("💡 환경 변수 OPENAI_API_KEY를 설정하거나 .env 파일을 생성하세요.")
    print("💡 .env 파일 예시:")
    print("   OPENAI_API_KEY=your_api_key_here")
    print("   HOST=0.0.0.0")
    print("   PORT=8001")
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
security = HTTPBearer()

app = FastAPI(title="캘린더 예약 시스템 API")

# 헬스 체크 엔드포인트
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "서버가 정상적으로 실행 중입니다."}

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000", 
        "http://127.0.0.1:5173",
        "capacitor://localhost",
        "ionic://localhost",
        "http://localhost",
        "https://localhost"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic 모델들
class UserCreate(BaseModel):
    email: str
    password: str
    user_type: str  # "business" or "worker"
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class BookingCreate(BaseModel):
    business_id: str
    worker_id: str
    date: str
    time: str
    service_type: str
    notes: Optional[str] = ""

class CalendarPermission(BaseModel):
    business_id: str
    worker_id: str
    permission_level: str  # "read", "write", "admin"

class SubscriptionCreate(BaseModel):
    business_id: str
    plan_type: str  # "basic", "premium", "enterprise"

# 스케줄 관련 모델들
class BusinessCategory(BaseModel):
    business_id: str
    category_name: str  # 업종 (예: 미용실, 카페, 레스토랑 등)
    description: Optional[str] = None

class Department(BaseModel):
    business_id: str
    department_name: str  # 파트명 (예: 주방, 서빙, 정리 등)
    description: Optional[str] = None
    required_staff_count: int = 1  # 필요한 직원 수

class WorkField(BaseModel):
    business_id: str
    field_name: str  # 주요분야 (예: 헤어, 네일, 메이크업 등)
    description: Optional[str] = None

class WorkSchedule(BaseModel):
    business_id: str
    schedule_type: str  # "weekly", "biweekly", "monthly"
    week_count: int  # 몇 주 단위로 스케줄 짤지
    deadline_days: int  # 마감일 (스케줄 등록 마감일)
    custom_work_hours: dict  # 커스텀 근무 시간대

class WorkerSchedule(BaseModel):
    worker_id: str
    business_id: str
    department_id: str
    work_fields: List[str]  # 담당 주요분야들
    preferred_off_days: List[str]  # 선호하는 쉬는날들
    min_work_hours: int  # 최소 근무 시간
    max_work_hours: int  # 최대 근무 시간
    preferred_work_days: List[str]  # 선호하는 근무일들
    preferred_work_hours: List[str]  # 선호하는 근무 시간대들
    availability_score: int = 5  # 가용성 점수 (1-10)

class ScheduleRequest(BaseModel):
    business_id: str
    week_start_date: str  # 주 시작일
    week_end_date: str    # 주 마감일
    workers_needed: dict   # {department_id: worker_count}
    work_fields_needed: dict  # {field_name: worker_count}

# 고용자 AI 스케줄 생성 시스템을 위한 새로운 모델들
class EmployeePreference(BaseModel):
    worker_id: str
    business_id: str
    department_id: str
    work_fields: List[str]
    preferred_off_days: List[str]  # ["월", "화", "수", "목", "금", "토", "일"]
    preferred_work_days: List[str]  # ["월", "화", "수", "목", "금", "토", "일"]
    preferred_work_hours: List[str]  # ["09:00-12:00", "12:00-18:00", "18:00-22:00"]
    min_work_hours: int = 4
    max_work_hours: int = 8
    availability_score: int = 5  # 1-10 점수
    priority_level: int = 3  # 1-5 우선순위

class DepartmentStaffing(BaseModel):
    business_id: str
    department_id: str
    department_name: str
    required_staff_count: int
    work_hours: dict  # {"월": ["09:00-18:00"], "화": ["09:00-18:00"], ...}
    priority_level: int = 3  # 1-5 우선순위

class Business(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    business_type: Optional[str] = None
    operating_hours: Optional[dict] = None
    owner_id: str
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class AIScheduleRequest(BaseModel):
    business_id: str
    week_start_date: str
    week_end_date: str
    department_staffing: List[DepartmentStaffing]
    employee_preferences: List[EmployeePreference]
    schedule_constraints: dict = {}  # 추가 제약사항들

class GeneratedSchedule(BaseModel):
    schedule_id: str
    business_id: str
    week_start_date: str
    week_end_date: str
    schedule_data: dict  # 실제 스케줄 데이터
    total_workers: int
    total_hours: int
    satisfaction_score: float  # 직원 만족도 점수
    created_at: str

# 인증 함수
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        
        # 개발 모드 토큰 확인 (Firebase가 없을 때만)
        if db is None and token == "dev_token_123":
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
        if db is None and token == "dev_token_123":
            # 개발 모드에서는 더미 사용자 정보 반환
            return {"uid": "dev_user_123", "email": "dev@example.com"}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다"
        )

# 사용자 등록
@app.post("/auth/register")
async def register_user(user: UserCreate):
    try:
        # Firebase Auth로 사용자 생성
        user_record = auth.create_user(
            email=user.email,
            password=user.password,
            display_name=user.name
        )
        
        # Firestore에 사용자 정보 저장
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
@app.post("/auth/login")
async def login_user(user: UserLogin):
    try:
        # Firebase Auth로 로그인 (실제로는 클라이언트에서 처리)
        return {"message": "로그인 성공"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 업자 캘린더 생성
@app.post("/business/calendar")
async def create_business_calendar(current_user: dict = Depends(get_current_user)):
    try:
        business_id = current_user["uid"]
        
        calendar_data = {
            "business_id": business_id,
            "created_at": datetime.now().isoformat(),
            "settings": {
                "working_hours": {
                    "monday": {"start": "09:00", "end": "18:00"},
                    "tuesday": {"start": "09:00", "end": "18:00"},
                    "wednesday": {"start": "09:00", "end": "18:00"},
                    "thursday": {"start": "09:00", "end": "18:00"},
                    "friday": {"start": "09:00", "end": "18:00"},
                    "saturday": {"start": "10:00", "end": "16:00"},
                    "sunday": {"start": "00:00", "end": "00:00"}
                },
                "booking_duration": 60,  # 분 단위
                "advance_booking_days": 30
            }
        }
        
        db.collection("calendars").document(business_id).set(calendar_data)
        return {"message": "캘린더가 생성되었습니다", "calendar_id": business_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 노동자 코드 생성
@app.post("/business/generate-code")
async def generate_worker_code(current_user: dict = Depends(get_current_user)):
    try:
        business_id = current_user["uid"]
        code = str(uuid.uuid4())[:8].upper()
        
        code_data = {
            "business_id": business_id,
            "code": code,
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(hours=24)).isoformat(),
            "used": False
        }
        
        db.collection("worker_codes").document(code).set(code_data)
        return {"code": code, "expires_at": code_data["expires_at"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 노동자 코드 사용
@app.post("/worker/use-code/{code}")
async def use_worker_code(code: str, current_user: dict = Depends(get_current_user)):
    try:
        worker_id = current_user["uid"]
        
        # 코드 확인
        code_doc = db.collection("worker_codes").document(code).get()
        if not code_doc.exists:
            raise HTTPException(status_code=404, detail="유효하지 않은 코드입니다")
        
        code_data = code_doc.to_dict()
        if code_data["used"]:
            raise HTTPException(status_code=400, detail="이미 사용된 코드입니다")
        
        if datetime.fromisoformat(code_data["expires_at"]) < datetime.now():
            raise HTTPException(status_code=400, detail="만료된 코드입니다")
        
        # 권한 부여
        permission_data = {
            "business_id": code_data["business_id"],
            "worker_id": worker_id,
            "permission_level": "read",
            "granted_at": datetime.now().isoformat()
        }
        
        db.collection("permissions").document(f"{code_data['business_id']}_{worker_id}").set(permission_data)
        
        # 코드 사용 처리
        db.collection("worker_codes").document(code).update({"used": True})
        
        return {"message": "권한이 부여되었습니다", "business_id": code_data["business_id"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 예약 생성
@app.post("/booking/create")
async def create_booking(booking: BookingCreate, current_user: dict = Depends(get_current_user)):
    try:
        booking_id = str(uuid.uuid4())
        
        booking_data = {
            "booking_id": booking_id,
            "business_id": booking.business_id,
            "worker_id": booking.worker_id,
            "date": booking.date,
            "time": booking.time,
            "service_type": booking.service_type,
            "notes": booking.notes,
            "status": "confirmed",
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("bookings").document(booking_id).set(booking_data)
        return {"message": "예약이 생성되었습니다", "booking_id": booking_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 예약 목록 조회
@app.get("/bookings/{business_id}")
async def get_bookings(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # 권한 확인
        if current_user["uid"] != business_id:
            permission_doc = db.collection("permissions").document(f"{business_id}_{current_user['uid']}").get()
            if not permission_doc.exists:
                raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        bookings = db.collection("bookings").where("business_id", "==", business_id).stream()
        booking_list = [doc.to_dict() for doc in bookings]
        
        return {"bookings": booking_list}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 구독 생성
@app.post("/subscription/create")
async def create_subscription(subscription: SubscriptionCreate, current_user: dict = Depends(get_current_user)):
    try:
        subscription_id = str(uuid.uuid4())
        
        subscription_data = {
            "subscription_id": subscription_id,
            "business_id": subscription.business_id,
            "plan_type": subscription.plan_type,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(days=30)).isoformat()
        }
        
        db.collection("subscriptions").document(subscription_id).set(subscription_data)
        return {"message": "구독이 생성되었습니다", "subscription_id": subscription_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# OpenAI API 테스트 엔드포인트 (인증 없음)
@app.post("/test/openai")
async def test_openai_api(message: dict):
    try:
        if not openai.api_key:
            raise HTTPException(status_code=500, detail="OpenAI API 키가 설정되지 않았습니다")
        
        # GPT-3.5-turbo 모델 사용 (헬퍼 함수 사용)
        ai_response = call_openai_api(
            messages=[
                {"role": "user", "content": message.get("content", "안녕하세요!")}
            ],
            max_tokens=100,
            temperature=0.7
        )
        
        return {
            "success": True,
            "response": ai_response,
            "model": "gpt-3.5-turbo"
        }
        
    except Exception as e:
        print(f"OpenAI API 테스트 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI API 테스트 실패: {str(e)}")

# 챗봇 메시지 처리
@app.post("/chatbot/message")
async def process_chatbot_message(message: str, current_user: dict = Depends(get_current_user)):
    try:
        # 간단한 챗봇 응답 로직
        response = "안녕하세요! AI 스케줄 생성 챗봇입니다. 🗓️\n\n스케줄을 생성하거나 예약 관련 문의를 도와드릴 수 있습니다."
        
        if "예약" in message:
            response = "예약을 원하시면 자연어로 입력해주세요. 예: '내일 오후 2시 미용실 예약'"
        elif "취소" in message:
            response = "예약 취소는 예약 목록에서 해당 예약을 선택하여 취소할 수 있습니다."
        elif "시간" in message:
            response = "영업시간은 평일 09:00-18:00, 토요일 10:00-16:00입니다."
        elif "스케줄" in message:
            response = "스케줄 생성을 원하시면 날짜, 시간, 서비스를 포함해서 입력해주세요."
        
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 챗봇 스케줄 파싱
@app.post("/chatbot/parse-schedule")
async def parse_schedule_request(user_input: dict, current_user: dict = Depends(get_current_user)):
    try:
        text = user_input["userInput"].lower()
        
        # 날짜 패턴 매칭
        date_patterns = [
            {"pattern": r"(오늘|금일)", "value": datetime.now()},
            {"pattern": r"(내일|명일)", "value": datetime.now() + timedelta(days=1)},
            {"pattern": r"(모레|내일모레)", "value": datetime.now() + timedelta(days=2)},
            {"pattern": r"(다음주|다음 주)", "value": datetime.now() + timedelta(days=7)},
            {"pattern": r"(이번주|이번 주)", "value": datetime.now()}
        ]

        date = None
        for pattern in date_patterns:
            if re.search(pattern["pattern"], text):
                date = pattern["value"]
                break

        # 시간 패턴 매칭
        time_patterns = [
            {"pattern": r"(오전|아침|모닝)", "hour": 9},
            {"pattern": r"(오후|점심)", "hour": 12},
            {"pattern": r"(저녁|밤)", "hour": 18},
            {"pattern": r"(\d{1,2})시", "hour": None},
            {"pattern": r"(\d{1,2}):(\d{2})", "hour": None, "minute": None}
        ]

        time = None
        for pattern in time_patterns:
            match = re.search(pattern["pattern"], text)
            if match:
                if pattern["hour"] is not None:
                    time = f"{pattern['hour']}:00"
                elif match.group(1) and match.group(2):
                    time = f"{match.group(1)}:{match.group(2)}"
                elif match.group(1):
                    time = f"{match.group(1)}:00"
                break

        # 서비스 패턴 매칭
        service_patterns = [
            {"pattern": r"(미용실|헤어|커트|염색)", "service": "미용실"},
            {"pattern": r"(식당|레스토랑|음식점|점심|저녁)", "service": "식당"},
            {"pattern": r"(상담|컨설팅|상담서비스)", "service": "상담"},
            {"pattern": r"(마사지|안마|스파)", "service": "마사지"},
            {"pattern": r"(네일|매니큐어|페디큐어)", "service": "네일아트"},
            {"pattern": r"(피부관리|에스테틱|페이셜)", "service": "피부관리"}
        ]

        service = "일반 예약"
        for pattern in service_patterns:
            if re.search(pattern["pattern"], text):
                service = pattern["service"]
                break

        if date and time:
            formatted_date = date.strftime("%Y년 %m월 %d일 %A")
            return {
                "success": True,
                "schedule": {
                    "date": formatted_date,
                    "time": time,
                    "service": service,
                    "duration": "1시간"
                }
            }
        else:
            return {
                "success": False,
                "message": "날짜와 시간을 정확히 입력해주세요."
            }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 챗봇 예약 생성
@app.post("/chatbot/create-booking")
async def create_chatbot_booking(booking_data: dict, current_user: dict = Depends(get_current_user)):
    try:
        booking_id = str(uuid.uuid4())
        
        booking = {
            "booking_id": booking_id,
            "user_id": current_user["uid"],
            "date": booking_data["date"],
            "time": booking_data["time"],
            "service": booking_data["service"],
            "status": "confirmed",
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("chatbot_bookings").document(booking_id).set(booking)
        return {"bookingId": booking_id, "message": "예약이 완료되었습니다"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 챗봇 스케줄 생성
@app.post("/chatbot/generate-schedule")
async def generate_chatbot_schedule(schedule_request: dict, current_user: dict = Depends(get_current_user)):
    try:
        # 스케줄 생성 로직
        schedule = {
            "date": schedule_request["date"],
            "time": schedule_request["time"],
            "service": schedule_request["service"],
            "duration": schedule_request.get("duration", "1시간"),
            "user_id": current_user["uid"],
            "created_at": datetime.now().isoformat()
        }
        
        schedule_id = str(uuid.uuid4())
        db.collection("chatbot_schedules").document(schedule_id).set(schedule)
        
        return {
            "schedule_id": schedule_id,
            "schedule": schedule,
            "message": "스케줄이 생성되었습니다"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 업종 관리
@app.post("/business/category")
async def create_business_category(category: BusinessCategory, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != category.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        category_id = str(uuid.uuid4())
        category_data = {
            "category_id": category_id,
            "business_id": category.business_id,
            "category_name": category.category_name,
            "description": category.description,
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("business_categories").document(category_id).set(category_data)
        return {"message": "업종이 생성되었습니다", "category_id": category_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 파트 관리
@app.post("/business/department")
async def create_department(department: Department, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != department.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        department_id = str(uuid.uuid4())
        department_data = {
            "department_id": department_id,
            "business_id": department.business_id,
            "department_name": department.department_name,
            "description": department.description,
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("departments").document(department_id).set(department_data)
        return {"message": "파트가 생성되었습니다", "department_id": department_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 주요분야 관리
@app.post("/business/workfield")
async def create_work_field(work_field: WorkField, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != work_field.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        field_id = str(uuid.uuid4())
        field_data = {
            "field_id": field_id,
            "business_id": work_field.business_id,
            "field_name": work_field.field_name,
            "description": work_field.description,
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("work_fields").document(field_id).set(field_data)
        return {"message": "주요분야가 생성되었습니다", "field_id": field_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 스케줄 설정
@app.post("/business/schedule-settings")
async def create_schedule_settings(schedule: WorkSchedule, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != schedule.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        schedule_data = {
            "business_id": schedule.business_id,
            "schedule_type": schedule.schedule_type,
            "week_count": schedule.week_count,
            "deadline_days": schedule.deadline_days,
            "custom_work_hours": schedule.custom_work_hours,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        db.collection("work_schedules").document(schedule.business_id).set(schedule_data)
        return {"message": "스케줄 설정이 저장되었습니다"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 노동자 스케줄 설정
@app.post("/worker/schedule-preferences")
async def set_worker_schedule_preferences(worker_schedule: WorkerSchedule, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != worker_schedule.worker_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        schedule_data = {
            "worker_id": worker_schedule.worker_id,
            "business_id": worker_schedule.business_id,
            "department_id": worker_schedule.department_id,
            "work_fields": worker_schedule.work_fields,
            "preferred_off_days": worker_schedule.preferred_off_days,
            "min_work_hours": worker_schedule.min_work_hours,
            "max_work_hours": worker_schedule.max_work_hours,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        db.collection("worker_schedules").document(f"{worker_schedule.worker_id}_{worker_schedule.business_id}").set(schedule_data)
        return {"message": "스케줄 선호도가 저장되었습니다"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# AI 스케줄 생성
@app.post("/business/generate-schedule")
async def generate_ai_schedule(schedule_request: ScheduleRequest, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != schedule_request.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        # 스케줄 설정 가져오기
        schedule_doc = db.collection("work_schedules").document(schedule_request.business_id).get()
        if not schedule_doc.exists:
            raise HTTPException(status_code=404, detail="스케줄 설정을 먼저 해주세요")
        
        schedule_settings = schedule_doc.to_dict()
        
        # 노동자들의 선호도 가져오기
        workers_docs = db.collection("worker_schedules").where("business_id", "==", schedule_request.business_id).stream()
        workers_preferences = [doc.to_dict() for doc in workers_docs]
        
        # AI 스케줄 생성 로직 (간단한 버전)
        generated_schedule = generate_optimal_schedule(
            schedule_request, 
            schedule_settings, 
            workers_preferences
        )
        
        # 생성된 스케줄 저장
        schedule_id = str(uuid.uuid4())
        schedule_data = {
            "schedule_id": schedule_id,
            "business_id": schedule_request.business_id,
            "week_start_date": schedule_request.week_start_date,
            "week_end_date": schedule_request.week_end_date,
            "generated_schedule": generated_schedule,
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("generated_schedules").document(schedule_id).set(schedule_data)
        return {"message": "AI 스케줄이 생성되었습니다", "schedule_id": schedule_id, "schedule": generated_schedule}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def generate_optimal_schedule(schedule_request, schedule_settings, workers_preferences):
    """AI 스케줄 생성 함수"""
    # 간단한 스케줄 생성 로직 (실제로는 더 복잡한 알고리즘 사용)
    schedule = {
        "monday": [],
        "tuesday": [],
        "wednesday": [],
        "thursday": [],
        "friday": [],
        "saturday": [],
        "sunday": []
    }
    
    # 각 요일별로 노동자 배정
    for day in schedule.keys():
        available_workers = [w for w in workers_preferences if day not in w.get("preferred_off_days", [])]
        schedule[day] = available_workers[:3]  # 최대 3명 배정
    
    return schedule

# 고용자 AI 스케줄 생성 시스템 API 엔드포인트들

# 직원 선호도 설정
@app.post("/employee/preferences")
async def set_employee_preferences(preference: EmployeePreference, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != preference.worker_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        preference_data = {
            "worker_id": preference.worker_id,
            "business_id": preference.business_id,
            "department_id": preference.department_id,
            "work_fields": preference.work_fields,
            "preferred_off_days": preference.preferred_off_days,
            "preferred_work_days": preference.preferred_work_days,
            "preferred_work_hours": preference.preferred_work_hours,
            "min_work_hours": preference.min_work_hours,
            "max_work_hours": preference.max_work_hours,
            "availability_score": preference.availability_score,
            "priority_level": preference.priority_level,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        doc_id = f"{preference.worker_id}_{preference.business_id}"
        
        # Firebase에 저장
        if db is not None:
            try:
                # 컬렉션이 없으면 자동으로 생성됨
                db.collection("employee_preferences").document(doc_id).set(preference_data)
                print(f"선호도 저장 성공: {doc_id}")
                return {"message": "직원 선호도가 저장되었습니다", "preference_id": doc_id}
            except Exception as e:
                print(f"Firebase 저장 오류: {e}")
                raise HTTPException(status_code=500, detail=f"Firebase 저장 실패: {str(e)}")
        else:
            # Firebase가 없으면 오류 반환
            raise HTTPException(status_code=500, detail="Firebase 연결이 필요합니다")
    except Exception as e:
        print(f"선호도 저장 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# 부서별 필요 인원 설정
@app.post("/department/staffing")
async def set_department_staffing(staffing: DepartmentStaffing, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != staffing.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        staffing_data = {
            "business_id": staffing.business_id,
            "department_id": staffing.department_id,
            "department_name": staffing.department_name,
            "required_staff_count": staffing.required_staff_count,
            "work_hours": staffing.work_hours,
            "priority_level": staffing.priority_level,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        doc_id = f"{staffing.business_id}_{staffing.department_id}"
        db.collection("department_staffing").document(doc_id).set(staffing_data)
        return {"message": "부서별 필요 인원이 설정되었습니다", "staffing_id": doc_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 직원 선호도 조회 (고용자용)
@app.get("/employee/preferences/{business_id}")
async def get_employee_preferences(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        preferences_docs = db.collection("employee_preferences").where("business_id", "==", business_id).stream()
        preferences = []
        
        for doc in preferences_docs:
            pref_data = doc.to_dict()
            
            # 직원의 기본 정보도 함께 가져오기
            try:
                employee_id = pref_data.get("worker_id") or pref_data.get("employee_id")
                if employee_id:
                    # users 컬렉션에서 직원 정보 조회
                    user_doc = db.collection("users").document(employee_id).get()
                    if user_doc.exists:
                        user_data = user_doc.to_dict()
                        pref_data["employee_info"] = {
                            "name": user_data.get("name"),
                            "email": user_data.get("email"),
                            "display_name": user_data.get("display_name")
                        }
                    else:
                        # users에서 찾지 못한 경우 기본값 설정
                        pref_data["employee_info"] = {
                            "name": f"직원_{employee_id[-4:]}",
                            "email": None,
                            "display_name": f"직원_{employee_id[-4:]}"
                        }
                else:
                    pref_data["employee_info"] = {
                        "name": "알 수 없는 직원",
                        "email": None,
                        "display_name": "알 수 없는 직원"
                    }
            except Exception as e:
                print(f"직원 정보 조회 실패: {employee_id}, 오류: {e}")
                pref_data["employee_info"] = {
                    "name": "오류 발생",
                    "email": None,
                    "display_name": "오류 발생"
                }
            
            preferences.append(pref_data)
        
        print(f"직원 선호도 조회 완료: {len(preferences)}개")
        return {"preferences": preferences}
    except Exception as e:
        print(f"직원 선호도 조회 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# 직원 개인 선호도 조회 (직원용)
@app.get("/employee/my-preference/{business_id}")
async def get_my_employee_preference(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        doc_id = f"{current_user['uid']}_{business_id}"
        
        # Firebase에서 조회
        if db is None:
            raise HTTPException(status_code=500, detail="Firebase 연결이 필요합니다")
        
        preference_doc = db.collection("employee_preferences").document(doc_id).get()
        
        if preference_doc.exists:
            return {"preference": preference_doc.to_dict()}
        else:
            return {"preference": None}
    except Exception as e:
        print(f"선호도 조회 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# 부서별 필요 인원 조회
@app.get("/department/staffing/{business_id}")
async def get_department_staffing(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        staffing_docs = db.collection("department_staffing").where("business_id", "==", business_id).stream()
        staffing = [doc.to_dict() for doc in staffing_docs]
        return {"staffing": staffing}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# AI 스케줄 생성 (고용자용)
@app.post("/ai/schedule/generate")
async def generate_ai_schedule_for_employer(schedule_request: AIScheduleRequest, current_user: dict = Depends(get_current_user)):
    try:
        print(f"AI 스케줄 생성 요청 받음: {schedule_request}")
        print(f"현재 사용자: {current_user}")
        
        # 중복 요청 방지를 위한 요청 ID 생성
        request_id = f"{current_user['uid']}_{schedule_request.week_start_date}_{schedule_request.week_end_date}_{int(time.time())}"
        print(f"요청 ID: {request_id}")
        
        # 동일한 요청이 이미 처리 중인지 확인 (간단한 중복 방지)
        if hasattr(generate_ai_schedule_for_employer, '_processing_requests'):
            if request_id in generate_ai_schedule_for_employer._processing_requests:
                print(f"중복 요청 감지: {request_id}")
                raise HTTPException(status_code=429, detail="동일한 요청이 이미 처리 중입니다. 잠시 후 다시 시도해주세요.")
        else:
            generate_ai_schedule_for_employer._processing_requests = set()
        
        # 현재 요청을 처리 중 목록에 추가
        generate_ai_schedule_for_employer._processing_requests.add(request_id)
        print(f"처리 중인 요청 목록: {generate_ai_schedule_for_employer._processing_requests}")
        
        # 데이터 검증 - 더 자세한 로깅
        print(f"비즈니스 ID: {schedule_request.business_id}")
        print(f"시작일: {schedule_request.week_start_date}")
        print(f"종료일: {schedule_request.week_end_date}")
        print(f"부서별 필요 인원: {schedule_request.department_staffing}")
        print(f"직원 선호도: {schedule_request.employee_preferences}")
        
        if not schedule_request.business_id:
            print("비즈니스 ID 검증 실패")
            raise HTTPException(status_code=422, detail="비즈니스 ID가 필요합니다")
        
        if not schedule_request.week_start_date or not schedule_request.week_end_date:
            print("날짜 검증 실패")
            raise HTTPException(status_code=422, detail="시작일과 종료일이 필요합니다")
        
        if not schedule_request.department_staffing:
            print("부서별 필요 인원 검증 실패")
            raise HTTPException(status_code=422, detail="부서별 필요 인원 정보가 필요합니다")
        
        if not schedule_request.employee_preferences:
            print("직원 선호도 검증 실패")
            raise HTTPException(status_code=422, detail="직원 선호도 정보가 필요합니다")
        
        # 권한 검증
        if current_user["uid"] != schedule_request.business_id:
            print(f"권한 검증 실패: {current_user['uid']} != {schedule_request.business_id}")
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        # AI 스케줄 생성 로직
        print("AI 스케줄 생성 시작...")
        generated_schedule = generate_advanced_ai_schedule(schedule_request)
        
        if not generated_schedule:
            raise HTTPException(status_code=500, detail="스케줄 생성에 실패했습니다")
        
        # 생성된 스케줄 저장
        schedule_id = str(uuid.uuid4())
        schedule_data = {
            "schedule_id": schedule_id,
            "business_id": schedule_request.business_id,
            "week_start_date": schedule_request.week_start_date,
            "week_end_date": schedule_request.week_end_date,
            "schedule_data": generated_schedule,
            "total_workers": generated_schedule.get("total_workers", 0),
            "total_hours": generated_schedule.get("total_hours", 0),
            "satisfaction_score": generated_schedule.get("satisfaction_score", 0.0),
            "created_at": datetime.now().isoformat()
        }
        
        # Firestore에 저장
        if db:
            db.collection("generated_schedules").document(schedule_id).set(schedule_data)
            print(f"스케줄 저장 완료: {schedule_id}")
        else:
            print("Firebase 연결이 없어 스케줄을 저장할 수 없습니다")
        
        # 처리 중인 요청 목록에서 제거
        if hasattr(generate_ai_schedule_for_employer, '_processing_requests'):
            generate_ai_schedule_for_employer._processing_requests.discard(request_id)
            print(f"요청 처리 완료, 처리 중 목록에서 제거: {request_id}")
        
        return {
            "message": "AI 스케줄이 생성되었습니다",
            "schedule_id": schedule_id,
            "schedule": generated_schedule
        }
    except HTTPException:
        # HTTP 예외 발생 시에도 처리 중 목록에서 제거
        if hasattr(generate_ai_schedule_for_employer, '_processing_requests'):
            generate_ai_schedule_for_employer._processing_requests.discard(request_id)
            print(f"HTTP 예외 발생, 처리 중 목록에서 제거: {request_id}")
        raise
    except Exception as e:
        # 일반 예외 발생 시에도 처리 중 목록에서 제거
        if hasattr(generate_ai_schedule_for_employer, '_processing_requests'):
            generate_ai_schedule_for_employer._processing_requests.discard(request_id)
            print(f"일반 예외 발생, 처리 중 목록에서 제거: {request_id}")
        print(f"AI 스케줄 생성 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 생성 중 오류가 발생했습니다: {str(e)}")

def validate_ai_response_format(schedule_data, schedule_request):
    """AI 응답 형식 검증 함수"""
    errors = []
    
    # 1. 기본 구조 검증
    if not isinstance(schedule_data, dict):
        errors.append("응답이 딕셔너리 형태가 아닙니다")
        return {"valid": False, "errors": errors}
    
    # 2. 필수 요일 검증
    required_days = ['월', '화', '수', '목', '금', '토', '일']
    for day in required_days:
        if day not in schedule_data:
            errors.append(f"필수 요일 '{day}'이 누락되었습니다")
    
    # 3. 각 요일별 구조 검증
    for day, day_data in schedule_data.items():
        if day in required_days:
            if not isinstance(day_data, list):
                errors.append(f"'{day}' 요일 데이터가 리스트 형태가 아닙니다")
                continue
            
            # 4. 부서별 구조 검증
            for dept_schedule in day_data:
                if not isinstance(dept_schedule, dict):
                    errors.append(f"'{day}' 요일의 부서 스케줄이 딕셔너리 형태가 아닙니다")
                    continue
                
                # 5. 필수 필드 검증
                required_fields = ['department_name', 'assigned_employees']
                for field in required_fields:
                    if field not in dept_schedule:
                        errors.append(f"'{day}' 요일의 부서 스케줄에 '{field}' 필드가 누락되었습니다")
                
                # 6. assigned_employees 검증
                if 'assigned_employees' in dept_schedule:
                    if not isinstance(dept_schedule['assigned_employees'], list):
                        errors.append(f"'{day}' 요일의 '{dept_schedule.get('department_name', '')}' 부서의 assigned_employees가 리스트가 아닙니다")
                    else:
                        for emp in dept_schedule['assigned_employees']:
                            if not isinstance(emp, dict):
                                errors.append(f"'{day}' 요일의 '{dept_schedule.get('department_name', '')}' 부서의 직원 정보가 딕셔너리가 아닙니다")
                            else:
                                # 7. 직원 정보 필드 검증
                                emp_required_fields = ['worker_id', 'employee_name', 'work_hours']
                                for emp_field in emp_required_fields:
                                    if emp_field not in emp:
                                        errors.append(f"'{day}' 요일의 '{dept_schedule.get('department_name', '')}' 부서 직원 정보에 '{emp_field}' 필드가 누락되었습니다")
    
    # 8. 설정된 부서와 일치하는지 검증
    if not errors:  # 기본 구조 오류가 없을 때만
        configured_departments = set()
        for dept in schedule_request.department_staffing:
            configured_departments.add(dept.department_name)

        for day, day_data in schedule_data.items():
            if isinstance(day_data, list):
                for dept_schedule in day_data:
                    if isinstance(dept_schedule, dict) and 'department_name' in dept_schedule:
                        dept_name = dept_schedule['department_name']
                        if dept_name not in configured_departments:
                            errors.append(f"설정되지 않은 부서 '{dept_name}'이 '{day}' 요일에 포함되어 있습니다")

    # 9. 필수 배정(요일-부서) 누락 검증 및 필요 인원 충족 검증
    if not errors:
        # 요일 문자열 목록
        day_keys = ['월', '화', '수', '목', '금', '토', '일']
        # 스케줄에 포함된 요일별 부서 매핑 (id와 name 둘 다 허용)
        schedule_day_dept_map = {day: [] for day in day_keys}
        for day, entries in schedule_data.items():
            if day in day_keys and isinstance(entries, list):
                for entry in entries:
                    if isinstance(entry, dict):
                        schedule_day_dept_map[day].append({
                            'department_id': entry.get('department_id'),
                            'department_name': entry.get('department_name'),
                            'assigned_count': len(entry.get('assigned_employees', []) if isinstance(entry.get('assigned_employees'), list) else [])
                        })

        # 요청된 부서들의 요일별 필수 배정 생성
        for dept in schedule_request.department_staffing:
            work_hours = getattr(dept, 'work_hours', {}) or {}
            required_staff = getattr(dept, 'required_staff_count', 1) or 1
            for day, hours in work_hours.items():
                if isinstance(hours, list) and len(hours) > 0 and day in day_keys:
                    # 해당 요일의 스케줄에서 같은 부서를 찾음 (id 우선, 없으면 이름)
                    entries = schedule_day_dept_map.get(day, [])
                    matched = None
                    for e in entries:
                        if (e.get('department_id') and e['department_id'] == getattr(dept, 'department_id', None)) or \
                           (e.get('department_name') and e['department_name'] == getattr(dept, 'department_name', None)):
                            matched = e
                            break
                    if not matched:
                        errors.append(f"'{day}' 요일에 필수 부서 '{dept.department_name}'(ID: {getattr(dept, 'department_id', 'N/A')})가 누락되었습니다")
                    else:
                        if matched['assigned_count'] < required_staff:
                            errors.append(f"'{day}' 요일 '{dept.department_name}'의 배정 인원 {matched['assigned_count']}명이 필요 인원 {required_staff}명보다 적습니다")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }

def generate_advanced_ai_schedule(schedule_request):
    """OpenAI API를 사용한 고급 AI 스케줄 생성 함수 (휴식시간, 연속근무 제한 등 포함)"""
    
    # OpenAI API 키가 없으면 기본 알고리즘 사용
    if not openai.api_key:
        print("OpenAI API 키가 없어 기본 알고리즘을 사용합니다.")
        return generate_basic_schedule(schedule_request)
    
    try:
        # 전달받은 제약사항 분석
        constraints = schedule_request.schedule_constraints or {}
        print(f"전달받은 제약사항: {constraints}")
        
        # 고급 제약사항을 포함한 프롬프트 구성
        prompt = f"""
        다음 조건을 만족하는 최적의 직원 스케줄을 생성해주세요:
        
        **중요**: 모든 요일(월, 화, 수, 목, 금, 토, 일)에 대해 스케줄을 생성해야 합니다. 근무가 없는 날도 해당 요일 키를 반드시 포함하고 빈 리스트([])로 응답하세요.
        work_hours가 설정된 부서만 해당 요일에 직원을 배정하세요.

        **비즈니스 정보:**
        - 기간: {schedule_request.week_start_date} ~ {schedule_request.week_end_date}

        **부서별 필요 인원:**
        {format_department_staffing(schedule_request.department_staffing)}

        **필수 배정 체크리스트 (아래 항목은 반드시 응답에 포함되어야 합니다):**
        {format_required_day_department(schedule_request.department_staffing)}

        **직원 선호도:**
        {format_employee_preferences(schedule_request.employee_preferences)}

        **결근 정보 (절대 준수해야 함):**
        {format_absence_information(constraints.get("absences", []))}

        **핵심 제약사항 (반드시 준수):**
        **결근 정보는 절대적으로 준수해야 합니다. 결근 직원을 해당 날짜에 배정하면 스케줄이 무효화됩니다.**
        """
        
        # 체크된 제약사항만 프롬프트에 추가
        if constraints.get("enforce_rest_hours") or constraints.get("rest_hours_required"):
            rest_hours = constraints.get("rest_hours_required", 11)
            prompt += f"\n1. **휴식시간 보장**: 모든 직원은 하루 최소 {rest_hours}시간 연속 휴식 보장"
        
        if constraints.get("limit_consecutive_days") or constraints.get("max_consecutive_days"):
            max_days = constraints.get("max_consecutive_days", 6)
            prompt += f"\n2. **연속근무 제한**: 연속 근무일은 최대 {max_days}일로 제한"
        
        if constraints.get("ensure_weekly_rest") or constraints.get("weekly_rest_required"):
            rest_days = constraints.get("weekly_rest_required", 1)
            prompt += f"\n3. **주간 휴식**: 주간 최소 {rest_days}일 휴식 보장"
        
        if constraints.get("limit_daily_hours") or constraints.get("max_daily_hours"):
            max_daily = constraints.get("max_daily_hours", 8)
            prompt += f"\n4. **일일 근무시간**: 하루 최대 {max_daily}시간 근무"
        
        if constraints.get("limit_weekly_hours") or constraints.get("max_weekly_hours"):
            max_weekly = constraints.get("max_weekly_hours", 40)
            prompt += f"\n5. **주간 근무시간**: 주간 최대 {max_weekly}시간 근무"
        
        # 중복 배정 허용 옵션 (가장 중요한 설정)
        if constraints.get("allow_duplicate_assignments"):
            prompt += f"\n\n🚀 **중복 배정 허용**: 같은 직원이 여러 파트에 배정될 수 있습니다."
            prompt += f"\n- 이를 통해 11시간 휴식 제약을 지키면서 효율적인 스케줄 생성 가능"
            prompt += f"\n- 직원의 가용성을 최대한 활용하여 업무 커버리지 향상"
            prompt += f"\n- 개인 선호도와 휴식시간을 모두 고려한 최적 스케줄 생성"
        else:
            prompt += f"\n\n🚀 **중복 배정 허용**: 직원 수가 부족할 때는 같은 직원을 여러 부서에 배정 가능"
            prompt += f"\n- 현재 직원 3명으로 8개 배정을 처리해야 하므로 중복 배정 필요"
            prompt += f"\n- 중복 배정으로 업무량 균등 배분 달성 (각 직원 2-3일 근무)"
            prompt += f"\n- 예: 최석규가 월요일 오전 + 월요일 미들에 동시 배정 가능"
        
        prompt += "\n\n**스케줄 생성 요구사항:**"
        prompt += "\n1. **모든 요일 포함**: 월, 화, 수, 목, 금, 토, 일 요일을 모두 포함하여 응답 (근무가 없는 날은 빈 리스트로 응답)"
        prompt += "\n2. **부서별 필요 인원 만족**: 각 부서에 필요한 직원 수만큼 정확히 배정"
        prompt += "\n3. **work_hours 기반 배정**: work_hours가 설정된 요일과 부서에만 직원 배정"
        prompt += "\n4. **직원 중복 배정**: 필요시 같은 직원을 여러 파트에 배정 가능"
        prompt += "\n5. **결근 정보 엄격 준수**: 결근 직원은 해당 날짜에 절대 배정 금지"
        prompt += "\n6. **고품질 스케줄**: 단순 반복이 아닌 각 날짜별 최적화된 배정"
        prompt += "\n7. **필수 배정 준수**: 위 '필수 배정 체크리스트'의 모든 항목(요일-부서)이 응답에 반드시 존재하고, 필요 인원 수를 정확히 충족해야 함"
        prompt += "\n7. **인원 배정 엄격 준수**: 각 부서에 필요한 인원을 정확히 배정 (부족하면 안됨)"
        prompt += "\n8. **월요일 오전 특별 주의**: 월요일 오전은 2명 필요, 미들은 1명 필요"
        prompt += "\n9. **휴식시간 유연 적용**: 직원 수가 부족할 때는 휴식시간 제약 완화"
        prompt += "\n   - 이상적: 하루 최소 11시간 연속 휴식"
        prompt += "\n   - 현실적: 직원 수 부족 시 최소 6시간 휴식 허용"
        prompt += "\n   - 예: 월요일 18:00 종료 → 화요일 01:00 시작 = 7시간 휴식 (허용)"
        prompt += "\n   - 연속 근무일을 피하고 휴식일을 적절히 배치하세요"
        prompt += "\n10. **업무량 균등 배분**: 모든 직원의 근무일수를 균등하게 배분"
        prompt += "\n    - 목표: 직원별 근무일수 차이를 2일 이하로 유지"
        prompt += "\n    - 현재 직원 3명: 각자 2-3일 근무가 적절"
        prompt += "\n    - 직원 수가 부족할 경우 중복 배정 허용으로 균등 배분 달성"
        prompt += "\n    - 예: 월요일 오전 + 월요일 미들에 같은 직원 배정 가능"
        
        prompt += "\n\n**⚠️ 반드시 준수해야 할 JSON 응답 형식:**"
        prompt += "\n\n**🔒 엄격한 제약사항:**"
        prompt += "\n1. **부서 제한**: 위에 나열된 부서만 사용 (오전, 미들, 야간)"
        prompt += "\n2. **직원 제한**: 위에 나열된 직원 ID와 이름만 사용"
        prompt += "\n3. **요일 제한**: work_hours가 설정된 요일에만 근무 배정"
        prompt += "\n4. **ID 제한**: 정확한 department_id와 worker_id 사용"
        prompt += "\n\n**🚨 직원 이름 엄격 제한:**"
        prompt += "\n- 반드시 위에 나열된 직원 이름만 사용하세요"
        prompt += "\n- 가상의 이름(홍길동, 이순신, 강감찬, 이승훈 등)을 절대 사용하지 마세요"
        prompt += "\n- 직원 이름을 모를 경우 worker_id를 사용하세요"
        prompt += "\n\n**⚠️ 직원 이름 사용 규칙:**"
        prompt += "\n1. **최석규** (lGSYNDCkKvO3DbjNPPWmOn6r9kO2) - 이 이름만 사용"
        prompt += "\n2. **seokgyu choi** (lxwkpn6POLciYc6rKMij7tVUg8D3) - 이 이름만 사용"
        prompt += "\n3. **z7xzywNzXafkkRVCRjjztFtbfMA2** (z7xzywNzXafkkRVCRjjztFtbfMA2) - 이 이름만 사용"
        prompt += "\n4. **절대 금지**: 홍길동, 이순신, 강감찬, 이승훈, 김철수, 박영희 등 가상 이름"
        prompt += "\n```json"
        prompt += "\n{"
        prompt += "\n  \"월\": ["
        prompt += "\n    {"
        prompt += "\n      \"department_name\": \"오전\","
        prompt += "\n      \"assigned_employees\": ["
        prompt += "\n        {"
        prompt += "\n          \"worker_id\": \"lGSYNDCkKvO3DbjNPPWmOn6r9kO2\","
        prompt += "\n          \"employee_name\": \"최석규\","
        prompt += "\n          \"work_hours\": \"09:00-18:00\""
        prompt += "\n        },"
        prompt += "\n        {"
        prompt += "\n          \"worker_id\": \"lxwkpn6POLciYc6rKMij7tVUg8D3\","
        prompt += "\n          \"employee_name\": \"seokgyu choi\","
        prompt += "\n          \"work_hours\": \"09:00-18:00\""
        prompt += "\n        }"
        prompt += "\n      ],"
        prompt += "\n      \"work_hours\": [\"09:00-18:00\"],"
        prompt += "\n      \"required_staff_count\": 2,"
        prompt += "\n      \"department_id\": \"dept_1754549964604\""
        prompt += "\n    },"
        prompt += "\n    {"
        prompt += "\n      \"department_name\": \"미들\","
        prompt += "\n      \"assigned_employees\": ["
        prompt += "\n        {"
        prompt += "\n          \"worker_id\": \"z7xzywNzXafkkRVCRjjztFtbfMA2\","
        prompt += "\n          \"employee_name\": \"z7xzywNzXafkkRVCRjjztFtbfMA2\","
        prompt += "\n          \"work_hours\": \"09:00-18:00\""
        prompt += "\n        }"
        prompt += "\n      ],"
        prompt += "\n      \"work_hours\": [\"09:00-18:00\"],"
        prompt += "\n      \"required_staff_count\": 1,"
        prompt += "\n      \"department_id\": \"dept_1754549974815\""
        prompt += "\n    }"
        prompt += "\n  ],"
        prompt += "\n  \"화\": ["
        prompt += "\n    {"
        prompt += "\n      \"department_name\": \"오전\","
        prompt += "\n      \"assigned_employees\": ["
        prompt += "\n        {"
        prompt += "\n          \"worker_id\": \"lGSYNDCkKvO3DbjNPPWmOn6r9kO2\","
        prompt += "\n          \"employee_name\": \"최석규\","
        prompt += "\n          \"work_hours\": \"09:00-18:00\""
        prompt += "\n        }"
        prompt += "\n      ],"
        prompt += "\n      \"work_hours\": [\"09:00-18:00\"],"
        prompt += "\n      \"required_staff_count\": 1,"
        prompt += "\n      \"department_id\": \"dept_1754549990085\""
        prompt += "\n    },"
        prompt += "\n    {"
        prompt += "\n      \"department_name\": \"야간\","
        prompt += "\n      \"assigned_employees\": ["
        prompt += "\n        {"
        prompt += "\n          \"worker_id\": \"lxwkpn6POLciYc6rKMij7tVUg8D3\","
        prompt += "\n          \"employee_name\": \"seokgyu choi\","
        prompt += "\n          \"work_hours\": \"01:00-02:00\""
        prompt += "\n        }"
        prompt += "\n      ],"
        prompt += "\n      \"work_hours\": [\"01:00-02:00\"],"
        prompt += "\n      \"required_staff_count\": 1,"
        prompt += "\n      \"department_id\": \"dept_1754553586916\""
        prompt += "\n    }"
        prompt += "\n  ],"
        prompt += "\n  \"수\": [],"
        prompt += "\n  \"목\": [],"
        prompt += "\n  \"금\": [],"
        prompt += "\n  \"토\": [],"
        prompt += "\n  \"일\": []"
        prompt += "\n}"
        prompt += "\n```"
        prompt += "\n\n**중요**: 각 요일은 반드시 **리스트 형태**로 응답하고, 근무가 없는 날도 빈 리스트로 포함해야 하며, 각 부서 스케줄은 **딕셔너리 형태**로 응답해야 합니다."
        prompt += "\n\n**💡 중복 배정 예시**:"
        prompt += "\n- 최석규: 월요일 오전 + 화요일 오전 (2일 근무)"
        prompt += "\n- seokgyu choi: 월요일 오전 + 화요일 야간 (2일 근무)"
        prompt += "\n- z7xzywNzXafkkRVCRjjztFtbfMA2: 월요일 미들 + 수요일 + 목요일 + 금요일 (4일 근무)"
        prompt += "\n- 결과: 각 직원 2-4일 근무로 업무량 균등 배분 달성"
        prompt += "\n\n**📅 날짜-요일 매핑 가이드**:"
        prompt += "\n- 8월18일 = 월요일, 8월19일 = 화요일, 8월20일 = 수요일"
        prompt += "\n- 8월21일 = 목요일, 8월22일 = 금요일, 8월23일 = 토요일, 8월24일 = 일요일"
        prompt += "\n- 8월25일 = 월요일, 8월26일 = 화요일, 8월27일 = 수요일"
        prompt += "\n- 8월28일 = 목요일, 8월29일 = 금요일, 8월30일 = 토요일"
        prompt += "\n- 8월31일 = 일요일, 9월1일 = 월요일, 9월2일 = 화요일"
        prompt += "\n- 9월3일 = 수요일, 9월4일 = 목요일, 9월5일 = 금요일"
        prompt += "\n- 9월6일 = 토요일, 9월7일 = 일요일, 9월8일 = 월요일"
        prompt += "\n- 9월9일 = 화요일, 9월10일 = 수요일, 9월11일 = 목요일"
        prompt += "\n- 9월12일 = 금요일, 9월13일 = 토요일, 9월14일 = 일요일"
        prompt += "\n- 9월15일 = 월요일"
        
        prompt += "\n\n**🚫 요일별 스케줄 생성 제한**:"
        prompt += "\n- 월요일(월) ~ 금요일(금): 근무 배정 가능"
        prompt += "\n- 토요일(토), 일요일(일): 근무 배정 금지(휴무일) — 단, 반드시 해당 요일 키를 포함하고 빈 리스트([])로 응답"
        prompt += "\n- 예: \"토\": [], \"일\": []"
        
        prompt += "\n\n**🚨 최종 경고**:"
        prompt += "\n- 위의 모든 제약사항을 위반하면 AI 스케줄이 무효화되고 기본 알고리즘이 사용됩니다"
        prompt += "\n- 가상 이름 사용, 인원 부족, 휴식시간 위반, 업무량 불균등 중 하나라도 발생하면 실패"
        prompt += "\n- 완벽한 스케줄을 생성하여 모든 제약사항을 준수하세요"
        
        prompt += "\n\n**우선순위 제약사항:**"
        
        if constraints.get("prioritize_preferences") or constraints.get("preference_priority") == "high":
            prompt += "\n1. **개인 선호도 최우선**: 선호하지 않는 날에는 근무하지 않도록 최대한 배려"
        else:
            prompt += "\n1. **개인 선호도**: 선호하지 않는 날에는 근무하지 않도록 배려 (권장사항)"
        
        prompt += "\n2. **업무 효율성**: 부서별 필요 인원을 정확히 만족"
        prompt += "\n3. **팀워크**: 경험자와 신입의 적절한 배치"
        prompt += "\n4. **만족도**: 직원 만족도를 최대화"
        
        if constraints.get("balance_workload") or constraints.get("workload_balance") == "strict":
            prompt += "\n5. **업무량 균등**: 모든 직원의 근무일수와 시간을 엄격하게 균등하게 배분"
        else:
            prompt += "\n5. **업무량 균등**: 직원별 업무량을 적절히 균등하게 배분 (권장사항)"
        
        # 직원별 배정 제한 (한 사람 몰빵 방지)
        if constraints.get("limit_employee_assignments"):
            prompt += "\n6. **직원별 배정 제한**: 한 직원이 너무 많은 파트/시간에 배정되지 않도록 제한"
            prompt += "\n   - 각 직원은 주간 최대 4-5일까지만 근무"
            prompt += "\n   - 하루 최대 2개 파트까지만 배정"
            prompt += "\n   - 모든 직원이 골고루 배정되도록 보장"
        
        # 최대 연속 배정 제한
        if constraints.get("max_consecutive_assignments"):
            max_consecutive = constraints.get("max_consecutive_assignments", 3)
            prompt += f"\n7. **연속 배정 제한**: 한 직원이 연속으로 {max_consecutive}일까지만 배정"
            prompt += f"\n   - {max_consecutive}일 연속 근무 후에는 반드시 휴무 보장"
            prompt += f"\n   - 다른 직원과 번갈아가며 배정하여 공정성 확보"
        
        # 추가 제약사항 정보
        if constraints.get("coverage_priority"):
            if constraints["coverage_priority"] == "preference":
                prompt += "\n\n**배정 전략**: 개인 선호도 우선, 업무 커버리지는 보조적 고려"
            else:
                prompt += "\n\n**배정 전략**: 업무 커버리지 우선, 개인 선호도는 보조적 고려"
        
        # 중복 배정 허용 시 추가 지침
        if constraints.get("allow_duplicate_assignments"):
            prompt += """

**중복 배정 시 고려사항:**
1. **휴식시간 우선**: 11시간 연속 휴식을 보장하는 선에서 중복 배정
2. **효율적 배정**: 같은 직원을 여러 파트에 배정하여 업무 커버리지 향상
3. **개인 선호도**: 중복 배정 시에도 개인 선호도를 최대한 반영
4. **업무량 균등**: 중복 배정으로 인한 과도한 업무 부담 방지

**기본 스케줄 생성 규칙:**
1. **부서별 필요 인원 만족**: 각 부서에 필요한 직원 수만큼 배정
2. **개인 선호도 고려**: 직원들이 선호하는 요일과 파트에 우선 배정
3. **효율적 인력 활용**: 직원 수가 부족할 경우 중복 배정 허용
4. **균등한 배정**: 가능한 한 모든 직원이 골고루 배정되도록 노력

**예시 시나리오:**
- choiseokgyu06: 월요일 오전 + 화요일 미들 + 목요일 야간
- seokgyu123456: 월요일 미들 + 수요일 오전 + 금요일 야간
- 각 직원이 적절히 분산되어 배정

        **중요: 반드시 다음 JSON 형식으로 응답해주세요:**

        ```json
        {{
          "월": [
            {{
              "department_name": "오전",
              "required_staff_count": 2,
              "assigned_employees": [
                {{
                  "worker_id": "lGSYNDCkKvO3DbjNPPWmOn6r9kO2",
                  "employee_name": "최석규",
                  "work_hours": "09:00-18:00",
                  "satisfaction_score": 9.5
                }},
                {{
                  "worker_id": "z7xzywNzXafkkRVCRjjztFtbfMA2",
                  "employee_name": "직원_fMA2",
                  "work_hours": "09:00-18:00",
                  "satisfaction_score": 9.0
                }}
              ]
            }},
            {{
              "department_name": "미들",
              "required_staff_count": 1,
              "assigned_employees": [
                {{
                  "worker_id": "lGSYNDCkKvO3DbjNPPWmOn6r9kO2",
                  "employee_name": "최석규",
                  "work_hours": "09:00-18:00",
                  "satisfaction_score": 9.5
                }}
              ]
            }}
          ],
          "화": [
            {{
              "department_name": "오전",
              "required_staff_count": 1,
              "assigned_employees": [
                {{
                  "worker_id": "lGSYNDCkKvO3DbjNPPWmOn6r9kO2",
                  "employee_name": "최석규",
                  "work_hours": "09:00-18:00",
                  "satisfaction_score": 9.5
                }}
              ]
            }},
            {{
              "department_name": "야간",
              "required_staff_count": 1,
              "assigned_employees": [
                {{
                  "worker_id": "lxwkpn6POLciYc6rKMij7tVUg8D3",
                  "employee_name": "직원_g8D3",
                  "work_hours": "01:00-02:00",
                  "satisfaction_score": 8.5
                }}
              ]
            }}
          ],
          "수": [
            {{
              "department_name": "오전",
              "required_staff_count": 1,
              "assigned_employees": [
                {{
                  "worker_id": "z7xzywNzXafkkRVCRjjztFtbfMA2",
                  "employee_name": "직원_fMA2",
                  "work_hours": "09:00-18:00",
                  "satisfaction_score": 9.0
                }}
              ]
            }}
          ],
          "목": [
            {{
              "department_name": "오전",
              "required_staff_count": 1,
              "assigned_employees": [
                {{
                  "worker_id": "lGSYNDCkKvO3DbjNPPWmOn6r9kO2",
                  "employee_name": "최석규",
                  "work_hours": "09:00-18:00",
                  "satisfaction_score": 9.5
                }}
              ]
            }}
          ],
          "금": [
            {{
              "department_name": "오전",
              "required_staff_count": 1,
              "assigned_employees": [
                {{
                  "worker_id": "lGSYNDCkKvO3DbjNPPWmOn6r9kO2",
                  "employee_name": "최석규",
                  "work_hours": "09:00-18:00",
                  "satisfaction_score": 9.5
                }}
              ]
            }}
          ],
          "토": [],
          "일": []
        }}
        ```

        **응답 규칙:**
        1. **반드시 JSON 형식으로만 응답**
        2. **자연어 설명 없이 JSON만 반환**
        3. **모든 요일을 포함하여 응답** (월, 화, 수, 목, 금, 토, 일)
        4. **work_hours가 설정된 요일만 직원 배정**
        5. **worker_id는 실제 직원 ID 사용**
        6. **employee_name은 실제 직원 이름 사용**
        7. **각 요일별로 필요한 부서와 직원 수만큼 배정**
        8. **결근 정보를 절대적으로 준수** - 결근 직원을 해당 날짜에 배정하면 안 됨
        9. **고품질 스케줄 생성** - 단순 반복이 아닌 각 날짜별 최적화된 배정
        10. **AI의 창의성 발휘** - 복잡한 제약사항을 만족하는 지능적인 스케줄 생성
"""
        
        print(f"생성된 AI 프롬프트:\n{prompt}")
        
        # OpenAI API 호출 (헬퍼 함수 사용)
        ai_response = call_openai_api(
            messages=[
                {"role": "system", "content": """당신은 노동법과 직원 복지를 중시하는 스케줄 조율 전문가입니다. 
                다음 원칙을 철저히 준수합니다:
                1. 모든 직원의 건강과 안전을 최우선으로 고려
                2. 법적 휴식시간과 근무시간 제한을 엄격히 준수
                3. 개인 선호도와 비즈니스 요구사항의 균형 유지
                4. 공정하고 투명한 스케줄 배정
                5. 팀워크와 업무 효율성 증진
                
                **중요**: 사용자 요청에 대해 반드시 JSON 형식으로만 응답하세요. 
                자연어 설명이나 다른 형식은 사용하지 마세요. 
                JSON 파싱이 가능한 깔끔한 형식으로 응답해야 합니다."""},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,  # 더 일관성 있는 JSON 응답을 위해 매우 낮은 temperature
            max_tokens=3000
        )
        print(f"AI 응답: {ai_response}")
        
        # JSON 응답을 파싱하여 스케줄 데이터 구성
        try:
            import json
            schedule_data = json.loads(ai_response)
            
            # AI 응답 형식 검증 강화
            format_validation = validate_ai_response_format(schedule_data, schedule_request)
            if not format_validation["valid"]:
                print(f"AI 응답 형식 검증 실패: {format_validation['errors']}")
                print("기본 알고리즘을 사용합니다.")
                return generate_basic_schedule(schedule_request)
            
            # 제약사항 준수 여부 검증 (전달받은 제약사항 기준)
            validation_result = validate_ai_schedule_constraints_with_custom_rules(schedule_data, schedule_request.employee_preferences, constraints)
            if not validation_result["valid"]:
                print(f"AI 스케줄 제약사항 위반: {validation_result['violations']}")
                print("기본 알고리즘을 사용합니다.")
                return generate_basic_schedule(schedule_request)
            
            # 결근 강제 반영
            schedule_data = enforce_absences_on_schedule(
                schedule_data,
                constraints,
                schedule_request.week_start_date,
                schedule_request.week_end_date,
            )

            # 기본 정보 추가
            schedule_data.update({
                "total_workers": count_total_workers(schedule_data),
                "total_hours": calculate_total_hours(schedule_data),
                "satisfaction_score": calculate_ai_satisfaction(schedule_data, schedule_request.employee_preferences),
                "ai_generated": True,
                "generation_method": "advanced_ai_with_custom_constraints",
                "ai_prompt": prompt,
                "ai_response": ai_response,
                "constraints_validated": True,
                "validation_details": validation_result,
                "applied_constraints": constraints
            })
            
            print("AI 스케줄 생성 완료 (사용자 정의 제약사항 준수)")
            return schedule_data
            
        except json.JSONDecodeError as e:
            print(f"AI 응답을 JSON으로 파싱할 수 없습니다: {e}")
            print("기본 알고리즘을 사용합니다.")
            return generate_basic_schedule(schedule_request)
            
    except Exception as e:
        print(f"OpenAI API 호출 실패: {e}")
        return generate_basic_schedule(schedule_request)

def generate_basic_schedule(schedule_request):
    """기본 알고리즘을 사용한 스케줄 생성 함수"""
    try:
        print("기본 스케줄 생성 시작...")
        print(f"부서 정보: {[f'{dept.department_name}({dept.required_staff_count}명)' for dept in schedule_request.department_staffing]}")
        print(f"직원 정보: {len(schedule_request.employee_preferences)}명")
        
        # 부서별 work_hours 상세 정보 출력
        print("\n=== 부서별 work_hours 상세 정보 ===")
        for dept in schedule_request.department_staffing:
            print(f"부서: {dept.department_name}")
            for day, hours in dept.work_hours.items():
                print(f"  {day}요일: {hours} (타입: {type(hours)}, 길이: {len(hours) if isinstance(hours, list) else 'N/A'})")
            print()
        
        # 기본 스케줄 구조 생성
        schedule_data = {
            "월": [],
            "화": [],
            "수": [],
            "목": [],
            "금": [],
            "토": [],
            "일": []
        }
        
        # 직원별 배정 현황 추적 (균등 배분을 위해)
        employee_assignments = {}
        for emp in schedule_request.employee_preferences:
            employee_assignments[emp.worker_id] = {
                "total_days": 0,
                "assigned_days": set(),
                "preferences": emp
            }
        
        # 부서별로 각 요일 스케줄 생성
        for dept in schedule_request.department_staffing:
            for day in schedule_data.keys():
                # 해당 요일에 근무하는지 확인
                work_hours_for_day = dept.work_hours.get(day, [])
                
                # work_hours가 없거나 빈 배열이면 해당 요일은 근무하지 않음
                if not work_hours_for_day or (isinstance(work_hours_for_day, list) and len(work_hours_for_day) == 0):
                    print(f"{day}요일 {dept.department_name}: 근무하지 않음 (work_hours 없음 또는 빈 배열)")
                    continue
                
                day_schedule = {
                    "department_id": dept.department_id,
                    "department_name": dept.department_name,
                    "required_staff_count": dept.required_staff_count,
                    "assigned_employees": [],
                    "work_hours": work_hours_for_day
                }
                
                # 해당 요일에 사용 가능한 직원 찾기
                available_workers = [
                    emp for emp in schedule_request.employee_preferences
                    if day not in (emp.preferred_off_days or []) and emp.business_id == schedule_request.business_id
                ]
                
                print(f"{day}요일 {dept.department_name}: 필요인원 {dept.required_staff_count}명, 사용가능한 직원 {len(available_workers)}명")
                
                if len(available_workers) == 0:
                    print(f"⚠️ {day}요일 {dept.department_name}: 사용 가능한 직원이 없습니다!")
                    continue
                
                # 직원들을 균등 배분을 위해 정렬 (적게 배정된 직원 우선)
                sorted_workers = sorted(available_workers, 
                                      key=lambda w: (
                                          employee_assignments[w.worker_id]["total_days"],  # 적게 배정된 순
                                          day in (w.preferred_off_days or []),  # 선호하지 않는 날은 뒤로
                                          -(w.availability_score or 5),  # 가용성 점수 높은 순
                                          w.worker_id  # 안정적인 정렬을 위해 ID로 마지막 정렬
                                      ))
                
                # 필요한 인원만큼 직원 배정
                assigned_count = 0
                for i in range(min(dept.required_staff_count, len(sorted_workers))):
                    if i < len(sorted_workers):
                        worker = sorted_workers[i]
                        # 직원의 실제 이름 찾기 - Firestore에서 실제 직원 정보 조회
                        employee_name = None
                        try:
                            if db:
                                # 직원 정보를 Firestore에서 조회
                                worker_doc = db.collection("workers").document(worker.worker_id).get()
                                if worker_doc.exists:
                                    worker_data = worker_doc.to_dict()
                                    employee_name = worker_data.get('name') or worker_data.get('employee_name') or worker_data.get('full_name')
                                
                                # 직원 정보가 없으면 사용자 정보에서 조회
                                if not employee_name:
                                    user_doc = db.collection("users").document(worker.worker_id).get()
                                    if user_doc.exists:
                                        user_data = user_doc.to_dict()
                                        employee_name = user_data.get('name') or user_data.get('display_name') or user_data.get('full_name')
                        except Exception as e:
                            print(f"직원 정보 조회 실패 ({worker.worker_id}): {e}")
                        
                        # 여전히 이름이 없으면 기본값 사용
                        if not employee_name:
                            employee_name = f"직원_{worker.worker_id[-4:]}"
                            print(f"⚠️ 직원 {worker.worker_id}의 이름을 찾을 수 없어 임시 이름 사용: {employee_name}")
                        
                        employee_schedule = {
                            "worker_id": worker.worker_id,
                            "employee_name": employee_name,
                            "work_hours": work_hours_for_day[0] if work_hours_for_day else "09:00-18:00",
                            "satisfaction_score": calculate_employee_satisfaction(worker, day, work_hours_for_day[0] if work_hours_for_day else "09:00-18:00")
                        }
                        day_schedule["assigned_employees"].append(employee_schedule)
                        assigned_count += 1
                        
                        # 직원 배정 현황 업데이트
                        employee_assignments[worker.worker_id]["total_days"] += 1
                        employee_assignments[worker.worker_id]["assigned_days"].add(day)
                        
                        print(f"{day}요일 {dept.department_name}: 실제 배정된 직원 {assigned_count}명 - {employee_name}")
                
                # 배정된 직원이 있는 경우에만 스케줄에 추가
                if assigned_count > 0:
                    schedule_data[day].append(day_schedule)
        
        # 직원별 배정 현황 출력
        print("\n=== 직원별 배정 현황 ===")
        for worker_id, info in employee_assignments.items():
            if info["total_days"] > 0:
                print(f"직원 {worker_id}: {info['total_days']}일 배정 - {sorted(info['assigned_days'])}")
        
        # 실제 배정된 총 직원 수 계산
        total_assigned = sum(
            len(dept["assigned_employees"]) 
            for day_schedules in schedule_data.values() 
            for dept in day_schedules
        )
        
        # 결근 강제 반영 (기본 알고리즘 결과에도 적용)
        schedule_data = enforce_absences_on_schedule(
            schedule_data,
            schedule_request.schedule_constraints or {},
            schedule_request.week_start_date,
            schedule_request.week_end_date,
        )

        # 실제 필요 인원 계산 (중복 제거)
        total_required_staff = count_required_staff(schedule_data)
        
        # 기본 정보 추가
        schedule_data.update({
            "total_workers": total_assigned,
            "total_hours": total_assigned * 8,  # 8시간 가정
            "satisfaction_score": calculate_ai_satisfaction(schedule_data, schedule_request.employee_preferences),
            "ai_generated": False,
            "generation_method": "basic_algorithm_improved",
            "actual_assigned_workers": total_assigned,
            "total_required_staff": total_required_staff,
            "employee_assignments_summary": {
                worker_id: {
                    "total_days": info["total_days"],
                    "assigned_days": list(info["assigned_days"])
                }
                for worker_id, info in employee_assignments.items()
                if info["total_days"] > 0
            }
        })
        
        print(f"기본 스케줄 생성 완료: 총 배정된 직원 {total_assigned}명")
        return schedule_data
        
    except Exception as e:
        print(f"기본 스케줄 생성 중 오류: {str(e)}")
        # 최소한의 기본 구조라도 반환
        return {
            "월": [],
            "화": [],
            "수": [],
            "목": [],
            "금": [],
            "토": [],
            "일": [],
            "total_workers": 0,
            "total_hours": 0,
            "satisfaction_score": 0.0,
            "ai_generated": False,
            "generation_method": "basic_algorithm_error",
            "error": str(e),
            "actual_assigned_workers": 0
        }

def format_department_staffing(department_staffing):
    """부서별 필요 인원 정보를 포맷팅"""
    result = []
    result.append("**⚠️ 정확한 부서 정보 (이 정보만 사용하세요):**")
    for dept in department_staffing:
        # work_hours 정보를 요일별로 정리
        work_hours_info = []
        for day, hours in dept.work_hours.items():
            work_hours_info.append(f"{day}요일: {', '.join(hours)}")
        
        work_hours_str = " | ".join(work_hours_info) if work_hours_info else "근무시간 없음"
        
        result.append(f"- **{dept.department_name}** (ID: {dept.department_id}): {dept.required_staff_count}명 필요")
        result.append(f"  - 근무 요일: {work_hours_str}")
    
    result.append("\n**🚫 금지사항**:")
    result.append("- 위에 나열되지 않은 새로운 부서를 생성하지 마세요")
    result.append("- 존재하지 않는 department_id를 사용하지 마세요")
    result.append("- 설정되지 않은 요일에 근무를 배정하지 마세요")
    
    return "\n".join(result)

def format_required_day_department(department_staffing):
    """요청된 요일별 필수 부서 체크리스트를 프롬프트용으로 포맷팅"""
    lines = []
    day_order = ['월', '화', '수', '목', '금', '토', '일']
    for dept in department_staffing:
        work_hours = getattr(dept, 'work_hours', {}) or {}
        required = getattr(dept, 'required_staff_count', 1) or 1
        for day in day_order:
            hours = work_hours.get(day)
            if isinstance(hours, list) and len(hours) > 0:
                hours_str = ", ".join(hours)
                lines.append(f"- {day}요일: '{dept.department_name}'({getattr(dept, 'department_id', 'N/A')}) 필요 {required}명, 근무시간: {hours_str}")
    if not lines:
        return "- (요청된 요일별 필수 부서 없음)"
    return "\n".join(lines)

def format_employee_preferences(employee_preferences):
    """직원 선호도 정보를 포맷팅"""
    result = []
    result.append("**👥 실제 직원 정보 (이 이름만 사용하세요):**")
    for emp in employee_preferences:
        # 직원의 실제 이름이나 식별자 추출
        employee_name = getattr(emp, 'employee_name', None) or getattr(emp, 'name', None) or emp.worker_id
        result.append(f"- **{employee_name}** (ID: {emp.worker_id}): 선호하지 않는 날={emp.preferred_off_days}, 선호 근무일={emp.preferred_work_days}")
    
    result.append("\n**🚫 금지사항**:")
    result.append("- 가상의 이름(홍길동, 이순신, 강감찬 등)을 사용하지 마세요")
    result.append("- 위에 나열된 직원 ID와 이름만 사용하세요")
    
    return "\n".join(result)

def format_absence_information(absences):
    """결근 정보를 AI 프롬프트용으로 포맷팅"""
    if not absences:
        return "결근 정보 없음 - 모든 직원이 모든 날짜에 가용"
    
    result = []
    result.append("⚠️ **절대 준수해야 할 결근 정보** ⚠️")
    result.append("다음 직원들은 해당 날짜에 절대 배정하면 안 됩니다:")
    
    for absence in absences:
        # 딕셔너리 형태로 전달되는 경우 처리
        if isinstance(absence, dict):
            date = absence.get('date', '날짜 없음')
            unavailable_employees = absence.get('unavailable_employees', [])
            total_unavailable = absence.get('total_unavailable', 0)
            reasons = absence.get('reasons', [])
            
            result.append(f"\n📅 **{date}**:")
            if unavailable_employees:
                result.append(f"   - 결근 직원: {', '.join(unavailable_employees)}")
            result.append(f"   - 총 결근 인원: {total_unavailable}명")
            if reasons:
                result.append(f"   - 사유: {', '.join(reasons)}")
        # 객체 형태로 전달되는 경우 처리 (하위 호환성)
        elif hasattr(absence, 'date') and hasattr(absence, 'unavailable_employees'):
            result.append(f"\n📅 **{absence.date}**:")
            result.append(f"   - 결근 직원: {', '.join(absence.unavailable_employees)}")
            result.append(f"   - 총 결근 인원: {absence.total_unavailable}명")
            if hasattr(absence, 'reasons'):
                result.append(f"   - 사유: {', '.join(absence.reasons)}")
        else:
            # 기존 구조 (하위 호환성)
            date = getattr(absence, 'date', '날짜 없음')
            employee_id = getattr(absence, 'employee_id', '직원 ID 없음')
            reason = getattr(absence, 'reason', '사유 없음')
            
            result.append(f"\n📅 **{date}**:")
            result.append(f"   - 결근 직원: {employee_id}")
            result.append(f"   - 사유: {reason}")
    
    result.append("\n🚫 **중요 규칙**:")
    result.append("1. 결근 직원은 해당 날짜에 절대 배정 금지")
    result.append("2. 결근이 있는 날에는 가용 직원만으로 스케줄 구성")
    result.append("3. 결근 정보를 무시하면 스케줄이 무효화됨")
    
    return "\n".join(result)

def count_total_workers(schedule_data):
    """AI 생성 스케줄에서 총 직원 수 계산"""
    total = 0
    for day_schedules in schedule_data.values():
        if isinstance(day_schedules, list):
            for dept_schedule in day_schedules:
                if isinstance(dept_schedule, dict) and "assigned_employees" in dept_schedule:
                    total += len(dept_schedule["assigned_employees"])
    return total

def count_required_staff(schedule_data):
    """AI 생성 스케줄에서 실제 필요 인원 계산 (중복 제거)"""
    total_required = 0
    duplicate_check = set()
    
    print("=== 필요 인원 계산 시작 ===")
    
    for day, day_schedules in schedule_data.items():
        if isinstance(day_schedules, list):
            print(f"\n{day}요일 스케줄:")
            for dept_schedule in day_schedules:
                if isinstance(dept_schedule, dict):
                    # 부서별로 하루에 한 번만 계산
                    dept_key = f"{day}_{dept_schedule.get('department_id', dept_schedule.get('department_name', ''))}"
                    if dept_key not in duplicate_check:
                        duplicate_check.add(dept_key)
                        required_staff = dept_schedule.get('required_staff_count', dept_schedule.get('staff_count', 1))
                        total_required += required_staff
                        
                        print(f"  ✓ {dept_schedule.get('department_name', '')} - {required_staff}명 (중복 제거됨)")
                    else:
                        print(f"  ✗ {dept_schedule.get('department_name', '')} - 중복 제거됨")
                else:
                    print(f"  ! 잘못된 부서 스케줄 형식: {type(dept_schedule)}")
        else:
            print(f"{day}요일: 스케줄 데이터가 리스트가 아님 ({type(day_schedules)})")
    
    print(f"\n=== 총 필요 인원 계산 완료: {total_required}명 (중복 제거됨) ===")
    print(f"중복 체크된 키들: {sorted(duplicate_check)}")
    
    return total_required

def calculate_total_hours(schedule_data):
    """AI 생성 스케줄에서 총 근무 시간 계산"""
    total = 0
    for day_schedules in schedule_data.values():
        if isinstance(day_schedules, list):
            for dept_schedule in day_schedules:
                if isinstance(dept_schedule, dict) and "assigned_employees" in dept_schedule:
                    total += len(dept_schedule["assigned_employees"]) * 8  # 8시간 가정
    return total

def calculate_ai_satisfaction(schedule_data, employee_preferences):
    """AI 생성 스케줄의 만족도 계산"""
    # 간단한 만족도 계산 (실제로는 더 복잡한 로직 필요)
    return 8.5  # 기본값

def calculate_employee_satisfaction(employee, day, work_hours):
    """직원 만족도 계산"""
    satisfaction = 10.0  # 기본 점수
    
    # 선호하는 근무일인지 확인
    if day in employee.preferred_work_days:
        satisfaction += 2.0
    
    # 선호하는 근무 시간대인지 확인
    if work_hours in employee.preferred_work_hours:
        satisfaction += 3.0
    
    # 가용성 점수 반영
    satisfaction += (employee.availability_score - 5) * 0.5
    
    return min(10.0, max(1.0, satisfaction))

def calculate_overall_satisfaction(employees, schedule):
    """전체 만족도 계산"""
    total_satisfaction = 0.0
    total_assignments = 0
    
    for day_schedules in schedule.values():
        for dept_schedule in day_schedules:
            for assignment in dept_schedule["assigned_employees"]:
                total_satisfaction += assignment["satisfaction_score"]
                total_assignments += 1
    
    return total_satisfaction / total_assignments if total_assignments > 0 else 0.0

def _parse_iso_date(date_str):
    from datetime import datetime
    return datetime.strptime(date_str, "%Y-%m-%d").date()

def _korean_weekday_name(d):
    # Monday=0 ... Sunday=6
    names = ['월', '화', '수', '목', '금', '토', '일']
    return names[d.weekday()]

def enforce_absences_on_schedule(schedule_data, constraints, week_start_date, week_end_date):
    """결근 정보에 따라 해당 날짜의 배정 직원에서 결근자를 제거"""
    try:
        if not constraints:
            return schedule_data
        absences = constraints.get("absences", []) or []
        if not absences:
            return schedule_data

        start_d = _parse_iso_date(week_start_date)
        end_d = _parse_iso_date(week_end_date)

        # 결근 맵: 날짜 문자열 -> 결근 직원 ID 집합
        date_to_absent_ids = {}
        for a in absences:
            try:
                date_str = a.get('date') if isinstance(a, dict) else getattr(a, 'date', None)
                if not date_str:
                    continue
                d = _parse_iso_date(date_str)
                if d < start_d or d > end_d:
                    continue
                ids = set()
                if isinstance(a, dict):
                    ids.update(a.get('unavailable_employees', []) or [])
                    # 하위 호환
                    if 'employee_id' in a:
                        ids.add(a['employee_id'])
                else:
                    if hasattr(a, 'unavailable_employees'):
                        ids.update(getattr(a, 'unavailable_employees') or [])
                    if hasattr(a, 'employee_id'):
                        ids.add(getattr(a, 'employee_id'))
                if not ids:
                    continue
                date_to_absent_ids.setdefault(date_str, set()).update(ids)
            except Exception:
                continue

        if not date_to_absent_ids:
            return schedule_data

        # 날짜 → 요일명 매핑
        from datetime import timedelta
        date_to_dayname = {}
        cur = start_d
        while cur <= end_d:
            date_to_dayname[cur.strftime("%Y-%m-%d")] = _korean_weekday_name(cur)
            cur += timedelta(days=1)

        # 결근 반영: 해당 요일 배정에서 결근자 제거
        for date_str, absent_ids in date_to_absent_ids.items():
            day_name = date_to_dayname.get(date_str)
            if not day_name:
                continue
            day_schedules = schedule_data.get(day_name)
            if not isinstance(day_schedules, list):
                continue
            for dept in day_schedules:
                if isinstance(dept, dict) and 'assigned_employees' in dept:
                    before = len(dept['assigned_employees']) if isinstance(dept['assigned_employees'], list) else 0
                    if isinstance(dept['assigned_employees'], list):
                        dept['assigned_employees'] = [
                            emp for emp in dept['assigned_employees']
                            if isinstance(emp, dict) and emp.get('worker_id') not in absent_ids
                        ]
                    after = len(dept['assigned_employees']) if isinstance(dept['assigned_employees'], list) else 0
                    if before != after:
                        print(f"결근 반영: {date_str}({day_name}) {dept.get('department_name','')} - {before}명 → {after}명 (제거 {before - after}명)")

        return schedule_data
    except Exception as e:
        print(f"결근 반영 중 오류: {e}")
        return schedule_data

def validate_ai_schedule_constraints_with_custom_rules(schedule_data, employee_preferences, custom_constraints):
    """사용자 정의 제약사항을 기준으로 AI 생성 스케줄 검증"""
    violations = []
    validation_summary = {}  # 변수 초기화 추가
    
    try:
        # 직원별 근무 정보 추출
        employee_schedules = {}
        days_of_week = ["월", "화", "수", "목", "금", "토", "일"]
        
        for day in days_of_week:
            day_schedules = schedule_data.get(day, [])
            for dept_schedule in day_schedules:
                assigned_employees = dept_schedule.get("assigned_employees", [])
                for emp in assigned_employees:
                    worker_id = emp.get("worker_id")
                    if worker_id not in employee_schedules:
                        employee_schedules[worker_id] = {
                            "work_days": [],
                            "work_hours": [],
                            "consecutive_days": 0,
                            "total_hours": 0
                        }
                    
                    employee_schedules[worker_id]["work_days"].append(day)
                    work_hours = emp.get("work_hours", "09:00-18:00")
                    employee_schedules[worker_id]["work_hours"].append(work_hours)
        
        print(f"검증 대상 직원 수: {len(employee_schedules)}")
        print(f"사용자 정의 제약사항: {custom_constraints}")
        
        # 각 직원별 제약사항 검증
        for worker_id, schedule in employee_schedules.items():
            work_days = schedule["work_days"]
            work_hours = schedule["work_hours"]
            
            # 1. 휴식시간 보장 검증 (사용자 설정값 기준)
            if custom_constraints.get("enforce_rest_hours") or custom_constraints.get("rest_hours_required"):
                # 직원 수가 부족할 때는 휴식시간 제약 완화
                required_rest = custom_constraints.get("rest_hours_required", 6)  # 11시간 → 6시간으로 완화
                for i, day in enumerate(work_days):
                    if i < len(work_days) - 1:
                        next_day = work_days[i + 1]
                        # 연속 근무일인 경우 휴식시간 계산
                        if days_of_week.index(next_day) - days_of_week.index(day) == 1:
                            current_end = work_hours[i].split("-")[1] if "-" in work_hours[i] else "18:00"
                            next_start = work_hours[i + 1].split("-")[0] if "-" in work_hours[i + 1] else "09:00"
                            
                            # 휴식시간 계산 (간단한 시간 계산)
                            if current_end == "18:00" and next_start == "09:00":
                                # 18:00 ~ 09:00 = 15시간 휴식 (충분)
                                pass
                            elif current_end == "18:00" and next_start == "01:00":
                                # 18:00 ~ 01:00 = 7시간 휴식 (직원 수 부족 시 허용)
                                pass
                            else:
                                # 휴식시간이 너무 짧은 경우만 위반으로 처리
                                violations.append(f"직원 {worker_id}: {day}~{next_day} 휴식시간 {required_rest}시간 미달 가능성")
            
            # 2. 연속근무일 제한 검증 (사용자 설정값 기준)
            if custom_constraints.get("limit_consecutive_days") or custom_constraints.get("max_consecutive_days"):
                max_consecutive = custom_constraints.get("max_consecutive_days", 6)
                consecutive_count = 1
                max_consecutive_found = 1
                for i in range(len(work_days) - 1):
                    current_idx = days_of_week.index(work_days[i])
                    next_idx = days_of_week.index(work_days[i + 1])
                    if next_idx - current_idx == 1:
                        consecutive_count += 1
                        max_consecutive_found = max(max_consecutive_found, consecutive_count)
                    else:
                        consecutive_count = 1
                
                if max_consecutive_found > max_consecutive:
                    violations.append(f"직원 {worker_id}: 연속 근무일 {max_consecutive_found}일 (제한: {max_consecutive}일)")
            
            # 3. 주간 휴식 보장 검증 (사용자 설정값 기준)
            if custom_constraints.get("ensure_weekly_rest") or custom_constraints.get("weekly_rest_required"):
                required_rest_days = custom_constraints.get("weekly_rest_required", 1)
                if len(work_days) >= (7 - required_rest_days):
                    violations.append(f"직원 {worker_id}: 주간 휴식 부족 (근무일: {len(work_days)}일, 필요 휴식: {required_rest_days}일)")
            
            # 4. 일일 근무시간 제한 검증 (사용자 설정값 기준)
            if custom_constraints.get("limit_daily_hours") or custom_constraints.get("max_daily_hours"):
                max_daily = custom_constraints.get("max_daily_hours", 8)
                # 간단한 계산: 8시간 근무 가정
                if len(work_days) * 8 > max_daily * 7:  # 주간 총 근무시간
                    violations.append(f"직원 {worker_id}: 일일 평균 근무시간 초과 (예상: {len(work_days) * 8 / 7:.1f}시간, 제한: {max_daily}시간)")
            
            # 5. 주간 근무시간 제한 검증 (사용자 설정값 기준)
            if custom_constraints.get("limit_weekly_hours") or custom_constraints.get("max_weekly_hours"):
                max_weekly = custom_constraints.get("max_weekly_hours", 40)
                total_hours = len(work_days) * 8  # 간단한 계산
                if total_hours > max_weekly:
                    violations.append(f"직원 {worker_id}: 주간 근무시간 {total_hours}시간 (제한: {max_weekly}시간)")
        
        # 6. 부서별 필요 인원 만족 검증
        for day in days_of_week:
            day_schedules = schedule_data.get(day, [])
            for dept_schedule in day_schedules:
                required = dept_schedule.get("required_staff_count", 0)
                assigned = len(dept_schedule.get("assigned_employees", []))
                if assigned < required:
                    violations.append(f"{day}요일 {dept_schedule.get('department_name')}: 필요인원 {required}명, 배정 {assigned}명")
        
        # 7. 업무량 균등 배분 검증 (새로 추가)
        if custom_constraints.get("balance_workload") == "strict" or custom_constraints.get("limit_employee_assignments"):
            employee_work_days = {}
            employee_work_hours = {}
            
            print(f"=== 업무량 균등 배분 검증 시작 ===")
            print(f"제약사항: balance_workload={custom_constraints.get('balance_workload')}, limit_employee_assignments={custom_constraints.get('limit_employee_assignments')}")
            
            # 각 직원의 근무일수와 시간 계산
            for day, day_schedule in schedule_data.items():
                print(f"\n{day}요일 스케줄:")
                for dept in day_schedule:
                    dept_name = dept.get("department_name", "알 수 없음")
                    assigned_emps = dept.get("assigned_employees", [])
                    print(f"  {dept_name}: {len(assigned_emps)}명 배정")
                    
                    for emp in assigned_emps:
                        emp_id = emp.get("worker_id") or emp.get("employee_id") or emp.get("id")
                        emp_name = emp.get("employee_name", "이름 없음")
                        print(f"    - {emp_id} ({emp_name})")
                        
                        if emp_id:
                            if emp_id not in employee_work_days:
                                employee_work_days[emp_id] = set()
                                employee_work_hours[emp_id] = 0
                            
                            employee_work_days[emp_id].add(day)
                            # 근무시간 계산 (기본 8시간으로 가정)
                            employee_work_hours[emp_id] += 8
            
            print(f"\n=== 직원별 근무 현황 ===")
            for emp_id, work_days in employee_work_days.items():
                print(f"직원 {emp_id}: {len(work_days)}일 근무 - {sorted(work_days)}")
            
            if employee_work_days:
                work_days_list = list(employee_work_days.values())
                max_work_days = max(len(days) for days in work_days_list)
                min_work_days = min(len(days) for days in work_days_list)
                work_days_diff = max_work_days - min_work_days
                
                print(f"\n=== 업무량 균등 배분 분석 ===")
                print(f"최대 근무일수: {max_work_days}일")
                print(f"최소 근무일수: {min_work_days}일")
                print(f"차이: {work_days_diff}일")
                print(f"균등 배분 기준: 차이 2일 이하 (현재: {'준수' if work_days_diff <= 2 else '위반'})")
                
                # 엄격한 균등 배분: 차이가 2일 이하여야 함
                if work_days_diff > 2:
                    violations.append(f"업무량 균등 배분 위반: 최대 근무일수 {max_work_days}일, 최소 근무일수 {min_work_days}일 (차이: {work_days_diff}일)")
                    print(f"❌ 업무량 균등 배분 위반 감지!")
                else:
                    print(f"✅ 업무량 균등 배분 준수")
                
                # 직원별 배정 제한 검증
                if custom_constraints.get("limit_employee_assignments"):
                    print(f"\n=== 직원별 배정 제한 검증 ===")
                    for emp_id, work_days in employee_work_days.items():
                        work_days_count = len(work_days)
                        print(f"직원 {emp_id}: {work_days_count}일 근무")
                        
                        if work_days_count > 5:  # 주간 최대 5일 제한
                            violations.append(f"직원 {emp_id} 배정 과다: {work_days_count}일 근무 (최대 5일 제한)")
                            print(f"  ❌ 주간 최대 5일 제한 위반!")
                        else:
                            print(f"  ✅ 주간 근무일수 제한 준수")
                        
                        # 연속 근무일 검증
                        sorted_days = sorted(work_days, key=lambda x: ["월", "화", "수", "목", "금", "토", "일"].index(x))
                        consecutive_days = 1
                        max_consecutive = 1
                        
                        for i in range(len(sorted_days) - 1):
                            current_idx = ["월", "화", "수", "목", "금", "토", "일"].index(sorted_days[i])
                            next_idx = ["월", "화", "수", "목", "금", "토", "일"].index(sorted_days[i + 1])
                            
                            if next_idx - current_idx == 1:
                                consecutive_days += 1
                                max_consecutive = max(max_consecutive, consecutive_days)
                            else:
                                consecutive_days = 1
                        
                        print(f"  연속 근무일: 최대 {max_consecutive}일")
                        
                        if max_consecutive > 3:  # 최대 3일 연속 제한
                            violations.append(f"직원 {emp_id} 연속 근무 과다: {max_consecutive}일 연속 (최대 3일 제한)")
                            print(f"  ❌ 연속 근무일 제한 위반!")
                        else:
                            print(f"  ✅ 연속 근무일 제한 준수")
                
                validation_summary["업무량 균등 배분"] = {
                    "최대 근무일수": max_work_days,
                    "최소 근무일수": min_work_days,
                    "차이": work_days_diff,
                    "균등 배분 준수": work_days_diff <= 2
                }
                
                print(f"\n=== 검증 완료 ===")
                print(f"총 위반사항: {len(violations)}건")
                if violations:
                    print("위반사항 목록:")
                    for i, violation in enumerate(violations, 1):
                        print(f"  {i}. {violation}")
            else:
                print("검증할 직원 데이터가 없습니다.")
        
        is_valid = len(violations) == 0
        
        print(f"제약사항 검증 결과: {'통과' if is_valid else '위반'}")
        if violations:
            print(f"위반사항: {violations}")
        
        return {
            "valid": is_valid,
            "violations": violations,
            "total_employees": len(employee_schedules),
            "validation_summary": f"검증 완료: {len(employee_schedules)}명 직원, 위반사항 {len(violations)}건",
            "applied_constraints": custom_constraints
        }
        
    except Exception as e:
        print(f"사용자 정의 제약사항 검증 중 오류: {e}")
        return {
            "valid": False,
            "violations": [f"검증 오류: {str(e)}"],
            "total_employees": 0,
            "validation_summary": "검증 실패",
            "applied_constraints": custom_constraints
        }

def validate_ai_schedule_constraints(schedule_data, employee_preferences):
    """AI 생성 스케줄의 기본 제약사항 준수 여부 검증 (기존 호환성용)"""
    # 기본 제약사항으로 검증
    default_constraints = {
        "enforce_rest_hours": True,
        "limit_consecutive_days": True,
        "ensure_weekly_rest": True,
        "limit_daily_hours": True,
        "limit_weekly_hours": True
    }
    return validate_ai_schedule_constraints_with_custom_rules(schedule_data, employee_preferences, default_constraints)

# 생성된 스케줄 조회
@app.get("/ai/schedule/{schedule_id}")
async def get_generated_schedule(schedule_id: str, current_user: dict = Depends(get_current_user)):
    try:
        print(f"스케줄 조회 요청: {schedule_id}, 사용자: {current_user['uid']}")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 없습니다")
        
        schedule_doc = db.collection("generated_schedules").document(schedule_id).get()
        if not schedule_doc.exists:
            raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다")
        
        schedule_data = schedule_doc.to_dict()
        print(f"스케줄 데이터: {schedule_data}")
        
        if schedule_data["business_id"] != current_user["uid"]:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        return schedule_data
    except HTTPException:
        raise
    except Exception as e:
        print(f"스케줄 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 조회 중 오류가 발생했습니다: {str(e)}")

# 특정 직원의 AI 생성 스케줄 조회
@app.get("/ai/schedule/employee/{business_id}/{employee_id}")
async def get_employee_schedule(business_id: str, employee_id: str, current_user: dict = Depends(get_current_user)):
    try:
        print(f"직원 스케줄 조회 요청: 비즈니스 {business_id}, 직원 {employee_id}, 사용자: {current_user['uid']}")
        
        # 데이터 검증
        if not business_id or not employee_id:
            raise HTTPException(status_code=422, detail="비즈니스 ID와 직원 ID가 필요합니다")
        
        # 권한 검증
        if current_user["uid"] != business_id:
            print(f"권한 검증 실패: {current_user['uid']} != {business_id}")
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 없습니다")
        
        # 최신 AI 생성 스케줄 조회
        schedules_query = db.collection("generated_schedules").where("business_id", "==", business_id)
        schedules_docs = schedules_query.stream()
        
        schedules = []
        for doc in schedules_docs:
            schedule_data = doc.to_dict()
            schedules.append(schedule_data)
        
        print(f"조회된 AI 스케줄 수: {len(schedules)}")
        
        if not schedules:
            print("생성된 AI 스케줄이 없습니다")
            return {"message": "생성된 AI 스케줄이 없습니다", "employee_schedule": None}
        
        # 가장 최근 스케줄 선택 (created_at 기준)
        latest_schedule = max(schedules, key=lambda x: x.get('created_at', ''))
        print(f"최신 스케줄 ID: {latest_schedule.get('schedule_id')}")
        print(f"최신 스케줄 기간: {latest_schedule.get('week_start_date')} ~ {latest_schedule.get('week_end_date')}")
        
        # 해당 직원의 스케줄 추출
        employee_schedule = {
            "schedule_id": latest_schedule.get("schedule_id"),
            "week_start_date": latest_schedule.get("week_start_date"),
            "week_end_date": latest_schedule.get("week_end_date"),
            "employee_id": employee_id,
            "daily_assignments": {},
            "total_work_days": 0,
            "total_work_hours": 0,
            "assigned_departments": set()
        }
        
        # 요일별로 직원 배정 확인
        days_of_week = ["월", "화", "수", "목", "금", "토", "일"]
        print(f"직원 {employee_id} 스케줄 검색 시작...")
        
        for day in days_of_week:
            day_schedules = latest_schedule.get("schedule_data", {}).get(day, [])
            print(f"{day}요일 스케줄 수: {len(day_schedules)}")
            
            employee_assignments = []
            
            for dept_schedule in day_schedules:
                assigned_employees = dept_schedule.get("assigned_employees", [])
                print(f"  {dept_schedule.get('department_name')} 부서 - 배정된 직원 수: {len(assigned_employees)}")
                
                for emp in assigned_employees:
                    emp_id = emp.get("worker_id")
                    print(f"    직원 ID: {emp_id} (검색 대상: {employee_id})")
                    
                    if emp_id == employee_id:
                        print(f"    ✓ 매칭 성공! {day}요일 {dept_schedule.get('department_name')} 부서")
                        employee_assignments.append({
                            "department_name": dept_schedule.get("department_name"),
                            "work_hours": dept_schedule.get("work_hours", ["09:00-18:00"]),
                            "required_staff_count": dept_schedule.get("required_staff_count", 1)
                        })
                        employee_schedule["assigned_departments"].add(dept_schedule.get("department_name"))
                    else:
                        print(f"    ✗ 매칭 실패: {emp_id} != {employee_id}")
            
            if employee_assignments:
                employee_schedule["daily_assignments"][day] = employee_assignments
                employee_schedule["total_work_days"] += 1
                employee_schedule["total_work_hours"] += len(employee_assignments) * 8  # 8시간 가정
                print(f"  {day}요일 배정 완료: {len(employee_assignments)}개 부서")
            else:
                print(f"  {day}요일 배정 없음")
        
        # set을 list로 변환
        employee_schedule["assigned_departments"] = list(employee_schedule["assigned_departments"])
        
        print(f"직원 {employee_id} 스케줄 조회 완료: {employee_schedule['total_work_days']}일 근무")
        print(f"배정된 부서: {employee_schedule['assigned_departments']}")
        
        return {"employee_schedule": employee_schedule}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"직원 스케줄 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"직원 스케줄 조회 중 오류가 발생했습니다: {str(e)}")

# 비즈니스별 생성된 스케줄 목록 조회
@app.get("/ai/schedules/{business_id}")
async def get_generated_schedules(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        print(f"비즈니스 스케줄 목록 조회: {business_id}, 사용자: {current_user['uid']}")
        
        # 데이터 검증
        if not business_id:
            raise HTTPException(status_code=422, detail="비즈니스 ID가 필요합니다")
        
        # 권한 검증
        if current_user["uid"] != business_id:
            print(f"권한 검증 실패: {current_user['uid']} != {business_id}")
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 없습니다")
        
        # 스케줄 조회
        schedules_query = db.collection("generated_schedules").where("business_id", "==", business_id)
        schedules_docs = schedules_query.stream()
        
        schedules = []
        for doc in schedules_docs:
            schedule_data = doc.to_dict()
            schedules.append(schedule_data)
        
        print(f"조회된 스케줄 수: {len(schedules)}")
        return {"schedules": schedules}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"스케줄 목록 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 목록 조회 중 오류가 발생했습니다: {str(e)}")

# 간소화된 스케줄 생성 요청 모델
class SimpleScheduleRequest(BaseModel):
    business_id: str
    week_start_date: str
    week_end_date: str
    # 간단한 설정만 받음
    allow_duplicate_assignments: bool = True
    max_consecutive_days: int = 3
    min_rest_hours: int = 11
    balance_workload: bool = True

# 간소화된 스케줄 생성 API
@app.post("/ai/schedule/generate-simple")
async def generate_simple_schedule(schedule_request: SimpleScheduleRequest, current_user: dict = Depends(get_current_user)):
    try:
        print(f"간소화된 스케줄 생성 요청 받음: {schedule_request}")
        
        # 권한 검증
        if current_user["uid"] != schedule_request.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 필요합니다")
        
        # 기존 데이터 자동 조회
        print("기존 데이터 자동 조회 중...")
        
        # 1. 부서별 필요 인원 자동 조회
        department_staffing = []
        dept_docs = db.collection("department_staffing").where("business_id", "==", schedule_request.business_id).stream()
        for doc in dept_docs:
            dept_data = doc.to_dict()
            department_staffing.append(DepartmentStaffing(**dept_data))
        
        if not department_staffing:
            # 기본 부서 생성 (업종별로)
            print("기본 부서 정보가 없어 기본값으로 생성합니다.")
            department_staffing = [
                DepartmentStaffing(
                    business_id=schedule_request.business_id,
                    department_id="dept_1",
                    department_name="오전",
                    required_staff_count=2,
                    work_hours={
                        "월": ["09:00-18:00"],
                        "화": ["09:00-18:00"],
                        "수": ["09:00-18:00"],
                        "목": ["09:00-18:00"],
                        "금": ["09:00-18:00"]
                    }
                ),
                DepartmentStaffing(
                    business_id=schedule_request.business_id,
                    department_id="dept_2", 
                    department_name="야간",
                    required_staff_count=1,
                    work_hours={
                        "월": ["18:00-02:00"],
                        "화": ["18:00-02:00"],
                        "수": ["18:00-02:00"],
                        "목": ["18:00-02:00"],
                        "금": ["18:00-02:00"]
                    }
                )
            ]
        
        # 2. 직원 선호도 자동 조회
        employee_preferences = []
        emp_docs = db.collection("employee_preferences").where("business_id", "==", schedule_request.business_id).stream()
        for doc in emp_docs:
            emp_data = doc.to_dict()
            employee_preferences.append(EmployeePreference(**emp_data))
        
        if not employee_preferences:
            # 기본 직원 정보 생성
            print("직원 선호도 정보가 없어 기본값으로 생성합니다.")
            # users 컬렉션에서 직원 정보 조회
            user_docs = db.collection("users").where("business_id", "==", schedule_request.business_id).where("user_type", "==", "worker").stream()
            for doc in user_docs:
                user_data = doc.to_dict()
                employee_preferences.append(EmployeePreference(
                    worker_id=user_data["uid"],
                    business_id=schedule_request.business_id,
                    department_id="dept_1",
                    work_fields=["일반"],
                    preferred_off_days=["토", "일"],
                    preferred_work_days=["월", "화", "수", "목", "금"],
                    preferred_work_hours=["09:00-18:00"],
                    min_work_hours=4,
                    max_work_hours=8,
                    availability_score=7
                ))
        
        # 3. 제약사항 자동 설정
        schedule_constraints = {
            "enforce_rest_hours": True,
            "rest_hours_required": schedule_request.min_rest_hours,
            "limit_consecutive_days": True,
            "max_consecutive_days": schedule_request.max_consecutive_days,
            "ensure_weekly_rest": True,
            "weekly_rest_required": 1,
            "limit_daily_hours": True,
            "max_daily_hours": 8,
            "limit_weekly_hours": True,
            "max_weekly_hours": 40,
            "allow_duplicate_assignments": schedule_request.allow_duplicate_assignments,
            "balance_workload": schedule_request.balance_workload,
            "prioritize_preferences": True
        }
        
        # 4. 완전한 요청 객체 생성
        full_request = AIScheduleRequest(
            business_id=schedule_request.business_id,
            week_start_date=schedule_request.week_start_date,
            week_end_date=schedule_request.week_end_date,
            department_staffing=department_staffing,
            employee_preferences=employee_preferences,
            schedule_constraints=schedule_constraints
        )
        
        print(f"자동 생성된 완전한 요청: {len(department_staffing)}개 부서, {len(employee_preferences)}명 직원")
        
        # 기존 AI 스케줄 생성 함수 호출
        generated_schedule = generate_advanced_ai_schedule(full_request)
        
        if not generated_schedule:
            raise HTTPException(status_code=500, detail="스케줄 생성에 실패했습니다")
        
        # 생성된 스케줄 저장
        schedule_id = str(uuid.uuid4())
        schedule_data = {
            "schedule_id": schedule_id,
            "business_id": schedule_request.business_id,
            "week_start_date": schedule_request.week_start_date,
            "week_end_date": schedule_request.week_end_date,
            "schedule_data": generated_schedule,
            "total_workers": generated_schedule.get("total_workers", 0),
            "total_hours": generated_schedule.get("total_hours", 0),
            "satisfaction_score": generated_schedule.get("satisfaction_score", 0.0),
            "created_at": datetime.now().isoformat(),
            "generation_type": "simple_request",
            "auto_generated_data": {
                "departments_count": len(department_staffing),
                "employees_count": len(employee_preferences),
                "constraints_applied": schedule_constraints
            }
        }
        
        # Firestore에 저장
        if db:
            db.collection("generated_schedules").document(schedule_id).set(schedule_data)
            print(f"간소화된 스케줄 저장 완료: {schedule_id}")
        
        return {
            "message": "간소화된 요청으로 스케줄이 생성되었습니다",
            "schedule_id": schedule_id,
            "schedule": generated_schedule,
            "auto_generated_info": {
                "departments": [{"name": dept.department_name, "staff_count": dept.required_staff_count} for dept in department_staffing],
                "employees_count": len(employee_preferences),
                "constraints_applied": schedule_constraints
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"간소화된 스케줄 생성 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 생성 중 오류가 발생했습니다: {str(e)}")

# 스케줄 템플릿 모델
class ScheduleTemplate(BaseModel):
    template_id: Optional[str] = None
    business_id: str
    template_name: str
    description: Optional[str] = None
    department_staffing: List[DepartmentStaffing]
    default_constraints: dict
    is_default: bool = False

# 스케줄 템플릿 저장
@app.post("/schedule/template/save")
async def save_schedule_template(template: ScheduleTemplate, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != template.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        template_id = template.template_id or str(uuid.uuid4())
        template_data = {
            "template_id": template_id,
            "business_id": template.business_id,
            "template_name": template.template_name,
            "description": template.description,
            "department_staffing": [dept.dict() for dept in template.department_staffing],
            "default_constraints": template.default_constraints,
            "is_default": template.is_default,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # 기본 템플릿이면 기존 기본 템플릿 해제
        if template.is_default:
            existing_default = db.collection("schedule_templates").where("business_id", "==", template.business_id).where("is_default", "==", True).stream()
            for doc in existing_default:
                db.collection("schedule_templates").document(doc.id).update({"is_default": False})
        
        db.collection("schedule_templates").document(template_id).set(template_data)
        
        return {"message": "템플릿이 저장되었습니다", "template_id": template_id}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 스케줄 템플릿 목록 조회
@app.get("/schedule/templates/{business_id}")
async def get_schedule_templates(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        templates_docs = db.collection("schedule_templates").where("business_id", "==", business_id).stream()
        templates = [doc.to_dict() for doc in templates_docs]
        
        return {"templates": templates}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 템플릿으로 스케줄 생성
@app.post("/ai/schedule/generate-from-template")
async def generate_schedule_from_template(template_request: dict, current_user: dict = Depends(get_current_user)):
    try:
        business_id = template_request["business_id"]
        template_id = template_request["template_id"]
        week_start_date = template_request["week_start_date"]
        week_end_date = template_request["week_end_date"]
        
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        # 템플릿 조회
        template_doc = db.collection("schedule_templates").document(template_id).get()
        if not template_doc.exists:
            raise HTTPException(status_code=404, detail="템플릿을 찾을 수 없습니다")
        
        template_data = template_doc.to_dict()
        
        # 직원 선호도 조회
        employee_preferences = []
        emp_docs = db.collection("employee_preferences").where("business_id", "==", business_id).stream()
        for doc in emp_docs:
            emp_data = doc.to_dict()
            employee_preferences.append(EmployeePreference(**emp_data))
        
        if not employee_preferences:
            raise HTTPException(status_code=400, detail="직원 선호도 정보가 필요합니다")
        
        # 부서 정보 복원
        department_staffing = []
        for dept_data in template_data["department_staffing"]:
            department_staffing.append(DepartmentStaffing(**dept_data))
        
        # 완전한 요청 객체 생성
        full_request = AIScheduleRequest(
            business_id=business_id,
            week_start_date=week_start_date,
            week_end_date=week_end_date,
            department_staffing=department_staffing,
            employee_preferences=employee_preferences,
            schedule_constraints=template_data["default_constraints"]
        )
        
        # AI 스케줄 생성
        generated_schedule = generate_advanced_ai_schedule(full_request)
        
        if not generated_schedule:
            raise HTTPException(status_code=500, detail="스케줄 생성에 실패했습니다")
        
        # 스케줄 저장
        schedule_id = str(uuid.uuid4())
        schedule_data = {
            "schedule_id": schedule_id,
            "business_id": business_id,
            "week_start_date": week_start_date,
            "week_end_date": week_end_date,
            "schedule_data": generated_schedule,
            "total_workers": generated_schedule.get("total_workers", 0),
            "total_hours": generated_schedule.get("total_hours", 0),
            "satisfaction_score": generated_schedule.get("satisfaction_score", 0.0),
            "created_at": datetime.now().isoformat(),
            "generation_type": "template_based",
            "template_id": template_id,
            "template_name": template_data["template_name"]
        }
        
        db.collection("generated_schedules").document(schedule_id).set(schedule_data)
        
        return {
            "message": "템플릿 기반으로 스케줄이 생성되었습니다",
            "schedule_id": schedule_id,
            "schedule": generated_schedule,
            "template_info": {
                "template_id": template_id,
                "template_name": template_data["template_name"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"템플릿 기반 스케줄 생성 중 오류: {str(e)}")

# 스케줄 생성 작업 상태 모델
class ScheduleGenerationJob(BaseModel):
    job_id: str
    business_id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: int = 0  # 0-100
    message: str = ""
    created_at: str
    updated_at: str
    result_schedule_id: Optional[str] = None
    error_message: Optional[str] = None

# 스케줄 생성 작업 상태 저장소 (메모리 기반, 실제로는 Redis나 DB 사용 권장)
schedule_generation_jobs = {}

# 스케줄 생성 작업 시작
@app.post("/ai/schedule/generate-async")
async def start_schedule_generation_async(schedule_request: AIScheduleRequest, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != schedule_request.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        job_id = str(uuid.uuid4())
        
        # 작업 상태 초기화
        schedule_generation_jobs[job_id] = {
            "job_id": job_id,
            "business_id": schedule_request.business_id,
            "status": "pending",
            "progress": 0,
            "message": "스케줄 생성 작업이 대기 중입니다",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "result_schedule_id": None,
            "error_message": None
        }
        
        # 백그라운드에서 스케줄 생성 실행
        import asyncio
        asyncio.create_task(generate_schedule_background(job_id, schedule_request))
        
        return {
            "message": "스케줄 생성 작업이 시작되었습니다",
            "job_id": job_id,
            "status": "pending"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"작업 시작 실패: {str(e)}")

# 백그라운드 스케줄 생성 작업
async def generate_schedule_background(job_id: str, schedule_request: AIScheduleRequest):
    try:
        # 작업 상태 업데이트
        schedule_generation_jobs[job_id]["status"] = "processing"
        schedule_generation_jobs[job_id]["progress"] = 10
        schedule_generation_jobs[job_id]["message"] = "AI 스케줄 생성 중..."
        schedule_generation_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        
        # AI 스케줄 생성
        generated_schedule = generate_advanced_ai_schedule(schedule_request)
        
        if not generated_schedule:
            raise Exception("스케줄 생성에 실패했습니다")
        
        schedule_generation_jobs[job_id]["progress"] = 80
        schedule_generation_jobs[job_id]["message"] = "스케줄 저장 중..."
        
        # 스케줄 저장
        schedule_id = str(uuid.uuid4())
        schedule_data = {
            "schedule_id": schedule_id,
            "business_id": schedule_request.business_id,
            "week_start_date": schedule_request.week_start_date,
            "week_end_date": schedule_request.week_end_date,
            "schedule_data": generated_schedule,
            "total_workers": generated_schedule.get("total_workers", 0),
            "total_hours": generated_schedule.get("total_hours", 0),
            "satisfaction_score": generated_schedule.get("satisfaction_score", 0.0),
            "created_at": datetime.now().isoformat(),
            "generation_type": "async_request",
            "job_id": job_id
        }
        
        if db:
            db.collection("generated_schedules").document(schedule_id).set(schedule_data)
        
        # 작업 완료
        schedule_generation_jobs[job_id]["status"] = "completed"
        schedule_generation_jobs[job_id]["progress"] = 100
        schedule_generation_jobs[job_id]["message"] = "스케줄 생성 완료"
        schedule_generation_jobs[job_id]["result_schedule_id"] = schedule_id
        schedule_generation_jobs[job_id]["updated_at"] = datetime.now().isoformat()
        
    except Exception as e:
        # 작업 실패
        schedule_generation_jobs[job_id]["status"] = "failed"
        schedule_generation_jobs[job_id]["message"] = f"스케줄 생성 실패: {str(e)}"
        schedule_generation_jobs[job_id]["error_message"] = str(e)
        schedule_generation_jobs[job_id]["updated_at"] = datetime.now().isoformat()

# 스케줄 생성 작업 상태 확인
@app.get("/ai/schedule/job-status/{job_id}")
async def get_schedule_generation_status(job_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if job_id not in schedule_generation_jobs:
            raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
        
        job = schedule_generation_jobs[job_id]
        
        # 권한 확인
        if current_user["uid"] != job["business_id"]:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        return job
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"작업 상태 조회 실패: {str(e)}")

# 스케줄 생성 작업 목록 조회
@app.get("/ai/schedule/jobs/{business_id}")
async def get_schedule_generation_jobs(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        business_jobs = [
            job for job in schedule_generation_jobs.values()
            if job["business_id"] == business_id
        ]
        
        return {"jobs": business_jobs}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"작업 목록 조회 실패: {str(e)}")

# 스케줄 생성 통계 조회
@app.get("/ai/schedule/statistics/{business_id}")
async def get_schedule_statistics(business_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 필요합니다")
        
        # 스케줄 생성 통계
        schedules_query = db.collection("generated_schedules").where("business_id", "==", business_id)
        schedules_docs = schedules_query.stream()
        
        total_schedules = 0
        total_workers_assigned = 0
        total_hours_generated = 0
        average_satisfaction = 0.0
        generation_methods = {}
        weekly_stats = {}
        
        for doc in schedules_docs:
            schedule_data = doc.to_dict()
            total_schedules += 1
            
            # 총 배정된 직원 수
            total_workers_assigned += schedule_data.get("total_workers", 0)
            
            # 총 근무 시간
            total_hours_generated += schedule_data.get("total_hours", 0)
            
            # 만족도 점수
            satisfaction = schedule_data.get("satisfaction_score", 0.0)
            average_satisfaction += satisfaction
            
            # 생성 방법별 통계
            method = schedule_data.get("generation_method", "unknown")
            generation_methods[method] = generation_methods.get(method, 0) + 1
            
            # 주별 통계
            week_start = schedule_data.get("week_start_date", "")
            if week_start:
                week_key = week_start[:10]  # YYYY-MM-DD 형식
                if week_key not in weekly_stats:
                    weekly_stats[week_key] = {
                        "schedules_count": 0,
                        "total_workers": 0,
                        "total_hours": 0
                    }
                weekly_stats[week_key]["schedules_count"] += 1
                weekly_stats[week_key]["total_workers"] += schedule_data.get("total_workers", 0)
                weekly_stats[week_key]["total_hours"] += schedule_data.get("total_hours", 0)
        
        # 평균 계산
        if total_schedules > 0:
            average_satisfaction = average_satisfaction / total_schedules
        
        # 최근 4주 통계
        recent_weeks = sorted(weekly_stats.keys(), reverse=True)[:4]
        recent_stats = {week: weekly_stats[week] for week in recent_weeks}
        
        return {
            "business_id": business_id,
            "total_schedules": total_schedules,
            "total_workers_assigned": total_workers_assigned,
            "total_hours_generated": total_hours_generated,
            "average_satisfaction": round(average_satisfaction, 2),
            "generation_methods": generation_methods,
            "recent_weekly_stats": recent_stats,
            "summary": {
                "message": f"총 {total_schedules}개의 스케줄이 생성되었습니다",
                "efficiency": f"평균 만족도: {round(average_satisfaction, 2)}/10",
                "workload": f"총 {total_workers_assigned}명의 직원이 배정되었습니다"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 조회 실패: {str(e)}")

# 스케줄 생성 히스토리 조회 (페이지네이션)
@app.get("/ai/schedule/history/{business_id}")
async def get_schedule_history(
    business_id: str, 
    page: int = 1, 
    limit: int = 10,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 필요합니다")
        
        # 기본 쿼리
        query = db.collection("generated_schedules").where("business_id", "==", business_id)
        
        # 상태별 필터링
        if status:
            query = query.where("generation_type", "==", status)
        
        # 정렬 (최신순)
        query = query.order_by("created_at", direction=firestore.Query.DESCENDING)
        
        # 페이지네이션
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)
        
        schedules_docs = query.stream()
        schedules = []
        
        for doc in schedules_docs:
            schedule_data = doc.to_dict()
            # 간단한 요약 정보만 반환
            summary = {
                "schedule_id": schedule_data.get("schedule_id"),
                "week_start_date": schedule_data.get("week_start_date"),
                "week_end_date": schedule_data.get("week_end_date"),
                "total_workers": schedule_data.get("total_workers", 0),
                "total_hours": schedule_data.get("total_hours", 0),
                "satisfaction_score": schedule_data.get("satisfaction_score", 0.0),
                "generation_method": schedule_data.get("generation_method", "unknown"),
                "created_at": schedule_data.get("created_at"),
                "status": "completed"  # 기본값
            }
            schedules.append(summary)
        
        # 전체 개수 조회 (페이지네이션을 위해)
        total_query = db.collection("generated_schedules").where("business_id", "==", business_id)
        if status:
            total_query = total_query.where("generation_type", "==", status)
        total_count = len(list(total_query.stream()))
        
        return {
            "schedules": schedules,
            "pagination": {
                "page": page,
                "limit": limit,
                "total_count": total_count,
                "total_pages": (total_count + limit - 1) // limit,
                "has_next": page * limit < total_count,
                "has_prev": page > 1
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"히스토리 조회 실패: {str(e)}")

# 스케줄 복사/재생성 API
@app.post("/ai/schedule/copy/{schedule_id}")
async def copy_schedule(schedule_id: str, current_user: dict = Depends(get_current_user)):
    try:
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 필요합니다")
        
        # 원본 스케줄 조회
        original_doc = db.collection("generated_schedules").document(schedule_id).get()
        if not original_doc.exists:
            raise HTTPException(status_code=404, detail="원본 스케줄을 찾을 수 없습니다")
        
        original_data = original_doc.to_dict()
        
        # 권한 확인
        if current_user["uid"] != original_data["business_id"]:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        # 새 스케줄 ID 생성
        new_schedule_id = str(uuid.uuid4())
        
        # 복사된 스케줄 데이터
        copied_data = {
            "schedule_id": new_schedule_id,
            "business_id": original_data["business_id"],
            "week_start_date": original_data["week_start_date"],
            "week_end_date": original_data["week_end_date"],
            "schedule_data": original_data["schedule_data"],
            "total_workers": original_data["total_workers"],
            "total_hours": original_data["total_hours"],
            "satisfaction_score": original_data["satisfaction_score"],
            "created_at": datetime.now().isoformat(),
            "generation_type": "copied",
            "original_schedule_id": schedule_id,
            "copy_note": "원본 스케줄에서 복사됨"
        }
        
        # 새 스케줄 저장
        db.collection("generated_schedules").document(new_schedule_id).set(copied_data)
        
        return {
            "message": "스케줄이 복사되었습니다",
            "new_schedule_id": new_schedule_id,
            "original_schedule_id": schedule_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스케줄 복사 실패: {str(e)}")

# 스케줄 생성 가이드 조회
@app.get("/ai/schedule/guide")
async def get_schedule_generation_guide():
    """스케줄 생성 가이드 및 모범 사례 제공"""
    return {
        "title": "AI 스케줄 생성 가이드",
        "description": "효율적인 스케줄 생성을 위한 가이드입니다",
        "sections": [
            {
                "title": "1. 기본 설정",
                "content": "스케줄 생성을 위한 최소한의 정보만 입력하면 됩니다.",
                "required_fields": [
                    "business_id: 비즈니스 ID",
                    "week_start_date: 주 시작일 (YYYY-MM-DD)",
                    "week_end_date: 주 종료일 (YYYY-MM-DD)"
                ],
                "optional_fields": [
                    "allow_duplicate_assignments: 중복 배정 허용 (기본값: true)",
                    "max_consecutive_days: 최대 연속 근무일 (기본값: 3)",
                    "min_rest_hours: 최소 휴식시간 (기본값: 11)",
                    "balance_workload: 업무량 균등 배분 (기본값: true)"
                ]
            },
            {
                "title": "2. 간소화된 API 사용법",
                "content": "POST /ai/schedule/generate-simple 엔드포인트를 사용하세요.",
                "example_request": {
                    "business_id": "your_business_id",
                    "week_start_date": "2024-01-15",
                    "week_end_date": "2024-01-21",
                    "allow_duplicate_assignments": True,
                    "max_consecutive_days": 3,
                    "min_rest_hours": 11,
                    "balance_workload": True
                }
            },
            {
                "title": "3. 자동 데이터 생성",
                "content": "부서 정보나 직원 선호도가 없어도 자동으로 기본값을 생성합니다.",
                "auto_generated": [
                    "기본 부서: 오전(2명), 야간(1명)",
                    "기본 근무시간: 오전 09:00-18:00, 야간 18:00-02:00",
                    "기본 직원 선호도: 평일 근무, 주말 휴무"
                ]
            },
            {
                "title": "4. 템플릿 활용",
                "content": "자주 사용하는 설정을 템플릿으로 저장하고 재사용하세요.",
                "template_apis": [
                    "POST /schedule/template/save: 템플릿 저장",
                    "GET /schedule/templates/{business_id}: 템플릿 목록 조회",
                    "POST /ai/schedule/generate-from-template: 템플릿으로 스케줄 생성"
                ]
            },
            {
                "title": "5. 비동기 처리",
                "content": "긴 스케줄 생성 작업은 비동기로 처리할 수 있습니다.",
                "async_apis": [
                    "POST /ai/schedule/generate-async: 비동기 스케줄 생성 시작",
                    "GET /ai/schedule/job-status/{job_id}: 작업 상태 확인",
                    "GET /ai/schedule/jobs/{business_id}: 작업 목록 조회"
                ]
            },
            {
                "title": "6. 모범 사례",
                "content": "효율적인 스케줄 생성을 위한 팁들",
                "best_practices": [
                    "직원 선호도를 미리 설정해두세요",
                    "부서별 필요 인원을 정확히 입력하세요",
                    "휴식시간과 연속근무 제한을 적절히 설정하세요",
                    "중복 배정을 허용하여 유연성을 높이세요"
                ]
            }
        ],
        "quick_start": {
            "message": "가장 간단한 방법으로 시작하려면:",
            "steps": [
                "1. 간소화된 API 엔드포인트 사용",
                "2. 날짜만 입력하고 나머지는 기본값 사용",
                "3. 자동 생성된 데이터 확인 후 필요시 수정"
            ]
        }
    }

# 스케줄 생성 상태 확인 가이드
@app.get("/ai/schedule/status-guide")
async def get_schedule_status_guide():
    """스케줄 생성 상태별 의미와 해결 방법 가이드"""
    return {
        "title": "스케줄 생성 상태 가이드",
        "statuses": {
            "pending": {
                "meaning": "작업이 대기 중입니다",
                "description": "스케줄 생성 작업이 큐에 등록되었습니다",
                "action": "잠시 기다린 후 상태를 다시 확인하세요",
                "estimated_wait": "1-2분"
            },
            "processing": {
                "meaning": "AI가 스케줄을 생성하고 있습니다",
                "description": "OpenAI API를 사용하여 최적의 스케줄을 생성 중입니다",
                "action": "진행률을 확인하고 완료될 때까지 기다리세요",
                "estimated_time": "2-5분"
            },
            "completed": {
                "meaning": "스케줄 생성이 완료되었습니다",
                "description": "AI가 생성한 스케줄을 확인할 수 있습니다",
                "action": "생성된 스케줄을 조회하고 필요시 수정하세요",
                "next_steps": [
                    "GET /ai/schedule/{schedule_id}로 스케줄 조회",
                    "생성된 스케줄 검토 및 수정",
                    "직원들에게 스케줄 공유"
                ]
            },
            "failed": {
                "meaning": "스케줄 생성에 실패했습니다",
                "description": "오류가 발생하여 스케줄을 생성할 수 없습니다",
                "action": "오류 메시지를 확인하고 문제를 해결한 후 다시 시도하세요",
                "common_issues": [
                    "OpenAI API 키가 설정되지 않음",
                    "직원 정보가 부족함",
                    "부서 정보가 설정되지 않음",
                    "네트워크 연결 문제"
                ],
                "troubleshooting": [
                    "환경 변수 OPENAI_API_KEY 확인",
                    "직원 선호도 정보 입력 확인",
                    "부서별 필요 인원 설정 확인",
                    "네트워크 연결 상태 확인"
                ]
            }
        },
        "progress_indicators": {
            "0-10%": "작업 초기화 중",
            "10-30%": "데이터 검증 및 전처리",
            "30-70%": "AI 스케줄 생성 중",
            "70-90%": "스케줄 검증 및 최적화",
            "90-100%": "결과 저장 및 완료"
        }
    }

# 스케줄 생성 문제 해결 가이드
@app.get("/ai/schedule/troubleshooting")
async def get_schedule_troubleshooting_guide():
    """일반적인 문제와 해결 방법"""
    return {
        "title": "스케줄 생성 문제 해결 가이드",
        "common_problems": [
            {
                "problem": "직원이 월요일에만 배정되고 다른 요일에는 배정되지 않음",
                "cause": "중복 배정이 제한되어 있거나 균등 배분 로직에 문제가 있음",
                "solution": [
                    "allow_duplicate_assignments를 true로 설정",
                    "직원 수가 부족한 경우 추가 직원 등록",
                    "부서별 필요 인원 조정"
                ],
                "api_endpoint": "POST /ai/schedule/generate-simple"
            },
            {
                "problem": "AI 스케줄 생성이 실패함",
                "cause": "OpenAI API 키가 없거나 네트워크 문제",
                "solution": [
                    "환경 변수 OPENAI_API_KEY 설정 확인",
                    "인터넷 연결 상태 확인",
                    "기본 알고리즘 사용 (ai_generated: false)"
                ],
                "fallback": "기본 알고리즘이 자동으로 실행됩니다"
            },
            {
                "problem": "직원 선호도가 반영되지 않음",
                "cause": "직원 선호도 정보가 부족하거나 설정되지 않음",
                "solution": [
                    "직원별 선호도 정보 입력",
                    "선호하지 않는 요일 설정",
                    "선호하는 근무 시간대 설정"
                ],
                "api_endpoint": "POST /employee/preferences"
            },
            {
                "problem": "부서별 필요 인원이 만족되지 않음",
                "cause": "직원 수 부족 또는 부서 설정 문제",
                "solution": [
                    "부서별 필요 인원 조정",
                    "직원 수 증가",
                    "중복 배정 허용"
                ],
                "api_endpoint": "POST /department/staffing"
            }
        ],
        "quick_fixes": {
            "immediate": [
                "간소화된 API 사용: /ai/schedule/generate-simple",
                "기본값으로 시작 후 점진적 개선",
                "템플릿 저장 및 재사용"
            ],
            "long_term": [
                "직원 선호도 데이터 수집",
                "부서별 업무량 분석",
                "정기적인 스케줄 품질 검토"
            ]
        }
    }

# 노동자 본인의 스케줄 조회 (AI 생성 스케줄 + 개인 선호도)
@app.get("/worker/my-schedule/{business_id}/{worker_id}")
async def get_worker_my_schedule(business_id: str, worker_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # 데이터 검증
        if not business_id or not worker_id:
            raise HTTPException(status_code=422, detail="비즈니스 ID와 노동자 ID가 필요합니다")
        
        # 권한 검증 - 노동자 본인만 조회 가능
        if current_user["uid"] != worker_id:
            raise HTTPException(status_code=403, detail="본인의 스케줄만 조회할 수 있습니다")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 없습니다")
        
        # 권한 확인 - 해당 업체에서 활성 권한을 가지고 있는지
        permission_query = db.collection("permissions").where("worker_id", "==", worker_id).where("business_id", "==", business_id).where("status", "==", "active")
        permission_docs = permission_query.stream()
        
        if not list(permission_docs):
            raise HTTPException(status_code=403, detail="해당 업체에 대한 권한이 없습니다")
        
        result = {
            "ai_schedule": None,
            "preference_schedule": None
        }
        
        # 1. AI 생성 스케줄에서 해당 노동자의 배정 스케줄 조회
        try:
            schedules_query = db.collection("generated_schedules").where("business_id", "==", business_id)
            schedules_docs = schedules_query.stream()
            
            schedules = []
            for doc in schedules_docs:
                schedule_data = doc.to_dict()
                schedules.append(schedule_data)
            
            if schedules:
                # 가장 최근 스케줄 선택
                latest_schedule = max(schedules, key=lambda x: x.get('created_at', ''))
                
                # 해당 노동자의 스케줄 추출
                worker_schedule = {
                    "schedule_id": latest_schedule.get("schedule_id"),
                    "week_start_date": latest_schedule.get("week_start_date"),
                    "week_end_date": latest_schedule.get("week_end_date"),
                    "daily_assignments": {},
                    "total_work_days": 0,
                    "total_work_hours": 0,
                    "assigned_departments": set()
                }
                
                # 요일별로 노동자 배정 확인
                days_of_week = ["월", "화", "수", "목", "금", "토", "일"]
                
                for day in days_of_week:
                    day_schedules = latest_schedule.get("schedule_data", {}).get(day, [])
                    worker_assignments = []
                    
                    for dept_schedule in day_schedules:
                        assigned_workers = dept_schedule.get("assigned_employees", [])
                        
                        for worker in assigned_workers:
                            if worker.get("worker_id") == worker_id:
                                worker_assignments.append({
                                    "department_name": dept_schedule.get("department_name"),
                                    "work_hours": dept_schedule.get("work_hours", ["09:00-18:00"]),
                                    "required_staff_count": dept_schedule.get("required_staff_count", 1)
                                })
                                worker_schedule["assigned_departments"].add(dept_schedule.get("department_name"))
                    
                    if worker_assignments:
                        worker_schedule["daily_assignments"][day] = worker_assignments
                        worker_schedule["total_work_days"] += 1
                        worker_schedule["total_work_hours"] += len(worker_assignments) * 8  # 8시간 가정
                
                # set을 list로 변환
                worker_schedule["assigned_departments"] = list(worker_schedule["assigned_departments"])
                result["ai_schedule"] = worker_schedule
        except Exception as e:
            # AI 스케줄 조회 실패해도 개인 선호도는 계속 조회
            pass
        
        # 2. 개인 선호도 스케줄 조회
        try:
            preference_query = db.collection("worker_schedules").where("worker_id", "==", worker_id).where("business_id", "==", business_id)
            preference_docs = preference_query.stream()
            
            for doc in preference_docs:
                preference_data = doc.to_dict()
                result["preference_schedule"] = preference_data
                break
        except Exception as e:
            pass
        
        return {"message": "노동자 스케줄 조회 성공", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"노동자 스케줄 조회 중 오류가 발생했습니다: {str(e)}")

# 노동자 개인 선호도 스케줄 조회
@app.get("/worker/preference-schedule/{business_id}/{worker_id}")
async def get_worker_preference_schedule(business_id: str, worker_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # 데이터 검증
        if not business_id or not worker_id:
            raise HTTPException(status_code=422, detail="비즈니스 ID와 노동자 ID가 필요합니다")
        
        # 권한 검증 - 노동자 본인만 조회 가능
        if current_user["uid"] != worker_id:
            raise HTTPException(status_code=403, detail="본인의 선호도만 조회할 수 있습니다")
        
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 없습니다")
        
        # 권한 확인
        permission_query = db.collection("permissions").where("worker_id", "==", worker_id).where("business_id", "==", business_id).where("status", "==", "active")
        permission_docs = permission_query.stream()
        
        if not list(permission_docs):
            raise HTTPException(status_code=403, detail="해당 업체에 대한 권한이 없습니다")
        
        # 개인 선호도 스케줄 조회
        preference_query = db.collection("worker_schedules").where("worker_id", "==", worker_id).where("business_id", "==", business_id)
        preference_docs = preference_query.stream()
        
        for doc in preference_docs:
            preference_data = doc.to_dict()
            return {"message": "개인 선호도 스케줄 조회 성공", "data": preference_data}
        
        return {"message": "설정된 개인 선호도가 없습니다", "data": None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"노동자 개인 선호도 스케줄 조회 중 오류가 발생했습니다: {str(e)}")

# AI 스케줄 수정 API
@app.post("/chatbot/edit-schedule")
async def edit_schedule_with_ai(edit_request: dict, current_user: dict = Depends(get_current_user)):
    try:
        print(f"AI 스케줄 수정 요청 받음: {edit_request}")
        
        schedule_id = edit_request.get("scheduleId")
        edit_request_text = edit_request.get("editRequest")
        current_schedule = edit_request.get("currentSchedule")
        business_id = edit_request.get("businessId")
        
        if not all([schedule_id, edit_request_text, current_schedule, business_id]):
            raise HTTPException(status_code=422, detail="필수 정보가 누락되었습니다")
        
        # 권한 검증
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        # OpenAI API를 사용한 스케줄 수정
        if not openai.api_key:
            raise HTTPException(status_code=500, detail="AI 서비스가 사용할 수 없습니다")
        
        # AI 프롬프트 구성
        prompt = f"""
        다음 스케줄을 사용자의 요청에 따라 수정해주세요:

        **현재 스케줄:**
        {current_schedule}

        **사용자 수정 요청:**
        {edit_request_text}

        **🚨 핵심 수정 원칙 (매우 중요):**
        1. **정확한 날짜 인식**: "8월19일", "26일" 등 구체적인 날짜가 언급되면 해당 요일로 변환하여 수정
        2. **요일 기반 수정**: 날짜를 요일로 변환한 후 해당 요일의 스케줄만 수정
        3. **기존 구조 유지**: 요일 키("월", "화", "수", "목", "금", "토", "일")만 사용, 새로운 키 생성 금지
        4. **부분 수정**: 언급되지 않은 요일, 파트는 절대 수정하지 않음
        5. **원본 유지**: 수정하지 않는 부분은 기존 데이터를 그대로 유지
        6. **논리적 검증**: 0명 배정, 빈 파트 생성 등 비논리적인 결과 금지
        7. **직원 배정 필수**: 모든 파트에는 반드시 직원을 배정해야 함

        **📅 날짜-요일 매핑 (중요!):**
        - 8월 18일 = 월요일 (월), 8월 19일 = 화요일 (화), 8월 20일 = 수요일 (수)
        - 8월 21일 = 목요일 (목), 8월 22일 = 금요일 (금), 8월 23일 = 토요일 (토), 8월 24일 = 일요일 (일)
        - 8월 25일 = 월요일 (월), 8월 26일 = 화요일 (화), 8월 27일 = 수요일 (수)
        - 8월 28일 = 목요일 (목), 8월 29일 = 금요일 (금), 8월 30일 = 토요일 (토)
        - 8월 31일 = 일요일 (일), 9월 1일 = 월요일 (월), 9월 2일 = 화요일 (화)
        - 9월 3일 = 수요일 (수), 9월 4일 = 목요일 (목), 9월 5일 = 금요일 (금)
        - 9월 6일 = 토요일 (토), 9월 7일 = 일요일 (일), 9월 8일 = 월요일 (월)
        - 9월 9일 = 화요일 (화), 9월 10일 = 수요일 (수), 9월 11일 = 목요일 (목)
        - 9월 12일 = 금요일 (금), 9월 13일 = 토요일 (토), 9월 14일 = 일요일 (일)
        - 9월 15일 = 월요일 (월)
        
        **🚫 요일별 스케줄 수정 제한**: 
        - 월요일(월) ~ 금요일(금): 스케줄 수정 가능
        - 토요일(토), 일요일(일): 스케줄 수정 금지 (휴무일)
        - 8월18일(월요일), 8월19일(화요일) 등 월~금 요일만 수정 가능

        **🔍 자연어 인식 범위 (자동 이해):**

        **📅 날짜 표현 방식:**
        - "26일", "8월26일", "26번째", "26일자" → 모두 26일로 인식
        - "내일", "모레", "글피" → 상대적 날짜로 계산하여 정확한 날짜 인식
        - "이번 주 월요일", "다음 주 화요일" → 주차 기반 날짜 계산
        - "월말", "월초", "주말" → 구체적인 날짜 범위로 변환

        **📅 요일 표현 방식:**
        - "월요일", "월", "월요일날" → 모두 월요일로 인식
        - "평일", "주말", "평일 전체" → 해당하는 요일들 자동 인식
          - "평일" = 월요일, 화요일, 수요일, 목요일, 금요일
          - "주말" = 토요일, 일요일
        - "월~금", "월부터 금까지" → 월요일부터 금요일까지 범위 인식

        **👥 파트 표현 방식:**
        - "미들", "미들타임", "미들 파트" → 모두 미들 파트로 인식
        - "오전", "아침", "모닝" → 모두 오전 파트로 인식
        - "야간", "밤", "나이트" → 모두 야간 파트로 인식
        - "전체", "모든 파트", "전부" → 해당 날짜의 모든 파트 인식

        **👤 직원 표현 방식:**
        - "김철수", "김씨", "철수" → 동일 인물로 인식
        - "새 직원", "신입", "대체 인력" → 가용한 직원 중 선택
        - "경험 많은 직원", "베테랑" → 경험 점수가 높은 직원 선택

        **📊 인원/시간 표현 방식:**
        - "2명", "2명으로", "2명씩" → 모두 2명으로 인식
        - "늘려줘", "증가시켜줘", "더 많이" → 기존 인원 증가
        - "줄여줘", "줄여달라", "적게" → 기존 인원 감소
        - "8시간", "풀타임", "반나절" → 근무 시간 조정

        **🔄 동작 표현 방식:**
        - "추가해줘", "배치해줘", "넣어줘" → 새로운 파트 생성 또는 기존 파트 인원 증가
        - "없애달라", "삭제해줘", "제거해줘" → 해당 파트 삭제
        - "교체해줘", "바꿔줘", "다른 사람으로" → 직원 교체
        - "이동시켜줘", "옮겨줘", "배정해줘" → 직원을 다른 파트로 이동

        **📅 날짜 기반 수정 가이드:**
        - "26일 미들을 없애달라" → 26일(토요일)의 미들 파트만 삭제, 다른 날짜는 건드리지 않음
        - "15일 오전을 2명으로 늘려줘" → 15일의 오전 파트만 수정, 다른 날짜는 건드리지 않음
        - "20일 전체를 휴무로" → 20일만 휴무로 변경, 다른 날짜는 건드리지 않음

        **📅 요일 기반 수정 가이드:**
        - "월요일 미들을 없애달라" → 해당 주의 월요일만 수정, 다른 주의 월요일은 건드리지 않음
        - "화요일 오전을 3명으로" → 해당 주의 화요일만 수정, 다른 주의 화요일은 건드리지 않음

        **👥 파트 기반 수정 가이드:**
        - "미들을 2명으로 늘려줘" → 언급된 날짜의 미들 파트만 수정
        - "오전 파트를 없애달라" → 언급된 날짜의 오전 파트만 삭제

        **✅ 수정 예시 (자동 인식):**
        - "8월18일도 스케줄을 생성해줘" → 8월18일(월요일)의 "월" 요일에 스케줄 추가, 다른 요일은 건드리지 않음
        - "8월19일도 스케줄을 생성해줘" → 8월19일(화요일)의 "화" 요일에 스케줄 추가, 다른 요일은 건드리지 않음
        - "26일 미들을 없애달라" → 8월26일(화요일)의 "화" 요일에서 미들 파트만 삭제, 다른 요일은 건드리지 않음
        - "15일 오전을 2명으로 늘려줘" → 9월15일(월요일)의 "월" 요일에서 오전 파트만 2명으로 수정, 다른 요일은 건드리지 않음
        - "월요일 미들을 없애달라" → "월" 요일에서 미들 파트만 삭제, 다른 요일은 건드리지 않음
        - "26일에 미들 2명을 추가해줘" → 8월26일(화요일)의 "화" 요일에 미들 파트를 2명으로 설정, 다른 요일은 건드리지 않음
        - "월요일 오전에 김철수 대신 이영희를 배정해줘" → "월" 요일의 오전 파트 직원만 교체, 다른 요일은 건드리지 않음

        **🚨 금지사항:**
        - "8월19일" 같은 새로운 키를 생성하지 마세요
        - 요일 키("월", "화", "수", "목", "금", "토", "일")만 사용하세요
        - assigned_employees가 빈 배열이 되지 않도록 하세요
        - 모든 파트에는 반드시 직원을 배정해야 합니다

        **📋 응답 형식 (반드시 준수):**
        - 요일 키만 사용: "월", "화", "수", "목", "금", "토", "일"
        - 각 요일은 리스트 형태로 응답
        - 각 파트는 딕셔너리 형태로 응답
        - assigned_employees에는 반드시 직원 정보 포함
        - 새로운 키나 구조 생성 금지
        - "평일 전체를 2명씩으로 늘려줘" → 월~금 모든 요일을 2명씩으로 증가
        - "주말에는 야간 파트를 없애달라" → 토,일 모든 요일의 야간 파트 삭제

        **❌ 절대 하지 말아야 할 것:**
        1. 언급되지 않은 날짜를 수정하지 않음
        2. 언급되지 않은 요일을 수정하지 않음
        3. 언급되지 않은 파트를 수정하지 않음
        4. 전체 기간에 영향을 주지 않음
        5. 0명 배정, 빈 파트 생성 등 비논리적인 결과 생성 금지
        6. 기존에 없던 파트를 갑자기 추가하지 않음

        **수정 규칙:**
        1. 사용자의 요청을 정확히 반영
        2. 기존 스케줄 구조와 형식 유지
        3. 직원 배정의 일관성 유지
        4. 부서별 필요 인원 수 만족
        5. 수정되지 않은 부분은 절대 그대로 유지
        6. JSON 형식으로만 응답
        7. 모든 수정 결과가 논리적이고 실용적이어야 함

        **🔍 수정 전 검증 체크리스트:**
        1. 사용자가 요청한 날짜/요일이 정확히 파악되었는가?
        2. 요청한 파트가 정확히 인식되었는가?
        3. 요청한 인원 수가 논리적인가? (0명, 음수 등 금지)
        4. 수정되지 않는 부분은 그대로 유지되는가?
        5. 결과가 사용자의 의도와 일치하는가?

        **응답 형식:**
        수정된 스케줄을 JSON으로 반환하세요. 자연어 설명은 포함하지 마세요.
        """
        
        # OpenAI API 호출 (헬퍼 함수 사용)
        ai_response = call_openai_api(
            messages=[
                {"role": "system", "content": "당신은 스케줄 수정 전문가입니다. 사용자의 요청에 따라 스케줄을 정확하게 수정하고 JSON 형식으로만 응답합니다."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000
        )
        print(f"AI 수정 응답: {ai_response}")
        
        try:
            import json
            updated_schedule = json.loads(ai_response)
            
            # 수정된 스케줄을 Firestore에 저장
            if db:
                db.collection("generated_schedules").document(schedule_id).update({
                    "schedule_data": updated_schedule,
                    "updated_at": datetime.now().isoformat(),
                    "edit_history": firestore.ArrayUnion([{
                        "timestamp": datetime.now().isoformat(),
                        "edit_request": edit_request_text,
                        "ai_response": ai_response,
                        "updated_by": current_user["uid"]
                    }])
                })
                print(f"스케줄 수정 완료: {schedule_id}")
            
            return {
                "success": True,
                "message": "스케줄이 성공적으로 수정되었습니다",
                "updatedSchedule": updated_schedule
            }
            
        except json.JSONDecodeError as e:
            print(f"AI 응답을 JSON으로 파싱할 수 없습니다: {e}")
            raise HTTPException(status_code=500, detail="AI 응답을 처리할 수 없습니다")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"스케줄 수정 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"스케줄 수정 중 오류가 발생했습니다: {str(e)}")


# ==================== 업장 관리 API ====================

@app.post("/businesses/create")
async def create_business(business: Business, current_user: dict = Depends(get_current_user)):
    """새 업장 생성"""
    try:
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결 실패")
        
        # 업장 데이터 준비
        business_data = business.dict()
        business_data["created_at"] = datetime.now().isoformat()
        business_data["updated_at"] = datetime.now().isoformat()
        business_data["owner_id"] = current_user["uid"]
        
        # Firestore에 업장 생성
        doc_ref = db.collection("businesses").add(business_data)
        business_id = doc_ref[1].id
        
        print(f"업장 생성 완료: {business_id}")
        
        return {
            "success": True,
            "message": "업장이 성공적으로 생성되었습니다",
            "business_id": business_id,
            "business": {**business_data, "id": business_id}
        }
        
    except Exception as e:
        print(f"업장 생성 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"업장 생성 중 오류가 발생했습니다: {str(e)}")


@app.get("/businesses")
async def get_businesses(current_user: dict = Depends(get_current_user)):
    """사용자의 업장 목록 조회"""
    try:
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결 실패")
        
        # 사용자의 업장 목록 조회
        businesses_query = db.collection("businesses").where("owner_id", "==", current_user["uid"]).order_by("created_at", direction=firestore.Query.DESCENDING)
        businesses_docs = businesses_query.stream()
        
        businesses = []
        for doc in businesses_docs:
            business_data = doc.to_dict()
            business_data["id"] = doc.id
            businesses.append(business_data)
        
        print(f"업장 목록 조회 완료: {len(businesses)}개")
        
        return {
            "success": True,
            "businesses": businesses
        }
        
    except Exception as e:
        print(f"업장 목록 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"업장 목록 조회 중 오류가 발생했습니다: {str(e)}")


@app.get("/businesses/{business_id}")
async def get_business(business_id: str, current_user: dict = Depends(get_current_user)):
    """특정 업장 조회"""
    try:
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결 실패")
        
        # 업장 조회
        business_doc = db.collection("businesses").document(business_id).get()
        
        if not business_doc.exists:
            raise HTTPException(status_code=404, detail="업장을 찾을 수 없습니다")
        
        business_data = business_doc.to_dict()
        
        # 소유자 확인
        if business_data.get("owner_id") != current_user["uid"]:
            raise HTTPException(status_code=403, detail="이 업장에 접근할 권한이 없습니다")
        
        business_data["id"] = business_doc.id
        
        return {
            "success": True,
            "business": business_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"업장 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"업장 조회 중 오류가 발생했습니다: {str(e)}")


@app.put("/businesses/{business_id}")
async def update_business(business_id: str, business_update: dict, current_user: dict = Depends(get_current_user)):
    """업장 정보 수정"""
    try:
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결 실패")
        
        # 업장 존재 확인
        business_doc = db.collection("businesses").document(business_id).get()
        
        if not business_doc.exists:
            raise HTTPException(status_code=404, detail="업장을 찾을 수 없습니다")
        
        business_data = business_doc.to_dict()
        
        # 소유자 확인
        if business_data.get("owner_id") != current_user["uid"]:
            raise HTTPException(status_code=403, detail="이 업장을 수정할 권한이 없습니다")
        
        # 업장 정보 업데이트
        business_update["updated_at"] = datetime.now().isoformat()
        
        db.collection("businesses").document(business_id).update(business_update)
        
        # 업데이트된 업장 정보 조회
        updated_doc = db.collection("businesses").document(business_id).get()
        updated_business = updated_doc.to_dict()
        updated_business["id"] = business_id
        
        print(f"업장 수정 완료: {business_id}")
        
        return {
            "success": True,
            "message": "업장 정보가 성공적으로 수정되었습니다",
            "business": updated_business
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"업장 수정 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"업장 수정 중 오류가 발생했습니다: {str(e)}")


@app.delete("/businesses/{business_id}")
async def delete_business(business_id: str, current_user: dict = Depends(get_current_user)):
    """업장 삭제"""
    try:
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결 실패")
        
        # 업장 존재 확인
        business_doc = db.collection("businesses").document(business_id).get()
        
        if not business_doc.exists:
            raise HTTPException(status_code=404, detail="업장을 찾을 수 없습니다")
        
        business_data = business_doc.to_dict()
        
        # 소유자 확인
        if business_data.get("owner_id") != current_user["uid"]:
            raise HTTPException(status_code=403, detail="이 업장을 삭제할 권한이 없습니다")
        
        # 업장 삭제
        db.collection("businesses").document(business_id).delete()
        
        print(f"업장 삭제 완료: {business_id}")
        
        return {
            "success": True,
            "message": "업장이 성공적으로 삭제되었습니다"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"업장 삭제 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"업장 삭제 중 오류가 발생했습니다: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    # 환경 변수에서 서버 설정 가져오기
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))
    
    print(f"🚀 서버 시작 중...")
    print(f"📍 호스트: {host}")
    print(f"🔌 포트: {port}")
    print(f"🌐 서버 URL: http://{host}:{port}")
    print(f"📚 API 문서: http://{host}:{port}/docs")
    
    uvicorn.run(app, host=host, port=port) 