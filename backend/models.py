"""
Pydantic 모델 정의
API 요청/응답에 사용되는 모든 데이터 모델들을 정의합니다.
"""

from pydantic import BaseModel
from typing import List, Optional


# 사용자 관련 모델들
class UserCreate(BaseModel):
    email: str
    password: str
    user_type: str  # "business" or "worker"
    name: str


class UserLogin(BaseModel):
    email: str
    password: str


# 예약 관련 모델들
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
