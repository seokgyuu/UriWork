"""
비즈니스 관련 API 엔드포인트
비즈니스 관리, 캘린더, 카테고리, 부서, 업무 분야 등의 기능을 제공합니다.
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
import uuid
from .models import (
    BusinessCategory, Department, WorkField, WorkSchedule, 
    Business, CalendarPermission, SubscriptionCreate
)
from .utils import get_current_user

router = APIRouter(prefix="/business", tags=["비즈니스"])

# 업자 캘린더 생성
@router.post("/calendar")
async def create_business_calendar(current_user: dict = Depends(get_current_user)):
    """비즈니스 캘린더를 생성합니다."""
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
        
        from .utils import db
        db.collection("calendars").document(business_id).set(calendar_data)
        return {"message": "캘린더가 생성되었습니다", "calendar_id": business_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 노동자 코드 생성
@router.post("/generate-code")
async def generate_worker_code(current_user: dict = Depends(get_current_user)):
    """직원 초대 코드를 생성합니다."""
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
        
        from .utils import db
        db.collection("worker_codes").document(code).set(code_data)
        return {"code": code, "expires_at": code_data["expires_at"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 업종 관리
@router.post("/category")
async def create_business_category(category: BusinessCategory, current_user: dict = Depends(get_current_user)):
    """비즈니스 업종을 생성합니다."""
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
        
        from .utils import db
        db.collection("business_categories").document(category_id).set(category_data)
        return {"message": "업종이 생성되었습니다", "category_id": category_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 파트 관리
@router.post("/department")
async def create_department(department: Department, current_user: dict = Depends(get_current_user)):
    """비즈니스 부서를 생성합니다."""
    try:
        if current_user["uid"] != department.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        department_id = str(uuid.uuid4())
        department_data = {
            "department_id": department_id,
            "business_id": department.business_id,
            "department_name": department.department_name,
            "description": department.description,
            "required_staff_count": department.required_staff_count,
            "created_at": datetime.now().isoformat()
        }
        
        from .utils import db
        db.collection("departments").document(department_id).set(department_data)
        return {"message": "파트가 생성되었습니다", "department_id": department_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 주요분야 관리
@router.post("/workfield")
async def create_work_field(work_field: WorkField, current_user: dict = Depends(get_current_user)):
    """비즈니스 주요분야를 생성합니다."""
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
        
        from .utils import db
        db.collection("work_fields").document(field_id).set(field_data)
        return {"message": "주요분야가 생성되었습니다", "field_id": field_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 스케줄 설정
@router.post("/schedule-settings")
async def create_schedule_settings(schedule: WorkSchedule, current_user: dict = Depends(get_current_user)):
    """비즈니스 스케줄 설정을 저장합니다."""
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
        
        from .utils import db
        db.collection("work_schedules").document(schedule.business_id).set(schedule_data)
        return {"message": "스케줄 설정이 저장되었습니다"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 구독 생성
@router.post("/subscription/create")
async def create_subscription(subscription: SubscriptionCreate, current_user: dict = Depends(get_current_user)):
    """비즈니스 구독을 생성합니다."""
    try:
        subscription_id = str(uuid.uuid4())
        subscription_data = {
            "subscription_id": subscription_id,
            "business_id": subscription.business_id,
            "plan_type": subscription.plan_type,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
        
        from .utils import db
        db.collection("subscriptions").document(subscription_id).set(subscription_data)
        return {"message": "구독이 생성되었습니다", "subscription_id": subscription_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
