"""
직원 관련 API 엔드포인트
직원 코드 사용, 스케줄 선호도 설정 등의 직원 기능을 제공합니다.
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models import WorkerSchedule
from utils import get_current_user

router = APIRouter(prefix="/worker", tags=["직원"])

# 노동자 코드 사용
@router.post("/use-code/{code}")
async def use_worker_code(code: str, current_user: dict = Depends(get_current_user)):
    """직원 초대 코드를 사용하여 비즈니스에 참여합니다."""
    try:
        worker_id = current_user["uid"]
        
        # 코드 확인
        from utils import db
        code_doc = db.collection("worker_codes").document(code).get()
        if not code_doc.exists:
            raise HTTPException(status_code=404, detail="유효하지 않은 코드입니다")
        
        code_data = code_doc.to_dict()
        
        # 코드 만료 확인
        if code_data.get("used", False):
            raise HTTPException(status_code=400, detail="이미 사용된 코드입니다")
        
        # 코드 사용 처리
        db.collection("worker_codes").document(code).update({"used": True, "used_by": worker_id})
        
        # 권한 설정
        permission_data = {
            "business_id": code_data["business_id"],
            "worker_id": worker_id,
            "permission_level": "read",
            "created_at": datetime.now().isoformat()
        }
        
        db.collection("permissions").document(f"{code_data['business_id']}_{worker_id}").set(permission_data)
        
        return {"message": "코드가 성공적으로 사용되었습니다", "business_id": code_data["business_id"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 직원 스케줄 선호도 설정
@router.post("/schedule-preferences")
async def set_worker_schedule_preferences(worker_schedule: WorkerSchedule, current_user: dict = Depends(get_current_user)):
    """직원의 스케줄 선호도를 설정합니다."""
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
            "preferred_work_days": worker_schedule.preferred_work_days,
            "preferred_work_hours": worker_schedule.preferred_work_hours,
            "availability_score": worker_schedule.availability_score,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        from utils import db
        doc_id = f"{worker_schedule.worker_id}_{worker_schedule.business_id}"
        db.collection("worker_schedules").document(doc_id).set(schedule_data)
        
        return {"message": "스케줄 선호도가 설정되었습니다"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 직원 개인 스케줄 조회
@router.get("/my-schedule/{business_id}/{worker_id}")
async def get_worker_my_schedule(business_id: str, worker_id: str, current_user: dict = Depends(get_current_user)):
    """직원의 개인 스케줄을 조회합니다."""
    try:
        # 데이터 검증
        if not business_id or not worker_id:
            raise HTTPException(status_code=422, detail="비즈니스 ID와 노동자 ID가 필요합니다")
        
        # 권한 검증 - 노동자 본인만 조회 가능
        if current_user["uid"] != worker_id:
            raise HTTPException(status_code=403, detail="본인의 스케줄만 조회할 수 있습니다")
        
        from utils import db
        # AI 생성된 스케줄에서 해당 직원의 스케줄 조회
        schedules = db.collection("ai_schedules").where("business_id", "==", business_id).stream()
        
        worker_schedules = []
        for schedule_doc in schedules:
            schedule_data = schedule_doc.to_dict()
            if worker_id in schedule_data.get("schedule_data", {}):
                worker_schedules.append({
                    "schedule_id": schedule_doc.id,
                    "week_start_date": schedule_data.get("week_start_date"),
                    "week_end_date": schedule_data.get("week_end_date"),
                    "my_schedule": schedule_data["schedule_data"][worker_id],
                    "created_at": schedule_data.get("created_at")
                })
        
        return {"worker_schedules": worker_schedules}
    except Exception as e:
        print(f"직원 스케줄 조회 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# 직원 선호도 기반 스케줄 조회
@router.get("/preference-schedule/{business_id}/{worker_id}")
async def get_worker_preference_schedule(business_id: str, worker_id: str, current_user: dict = Depends(get_current_user)):
    """직원의 선호도 기반 스케줄을 조회합니다."""
    try:
        # 데이터 검증
        if not business_id or not worker_id:
            raise HTTPException(status_code=422, detail="비즈니스 ID와 노동자 ID가 필요합니다")
        
        # 권한 검증 - 노동자 본인만 조회 가능
        if current_user["uid"] != worker_id:
            raise HTTPException(status_code=403, detail="본인의 선호도만 조회할 수 있습니다")
        
        from utils import db
        # 직원의 선호도 조회
        doc_id = f"{worker_id}_{business_id}"
        preference_doc = db.collection("worker_schedules").document(doc_id).get()
        
        if preference_doc.exists:
            preference_data = preference_doc.to_dict()
            return {"preference": preference_data}
        else:
            return {"preference": None}
    except Exception as e:
        print(f"직원 선호도 조회 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))
