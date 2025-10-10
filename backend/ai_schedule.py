"""
AI 스케줄 생성 관련 API 엔드포인트
AI를 사용한 스케줄 생성, 조회, 관리 등의 기능을 제공합니다.
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
import time
from typing import Optional
from models import AIScheduleRequest, GeneratedSchedule
from utils import get_current_user, call_openai_api

router = APIRouter(prefix="/ai/schedule", tags=["AI 스케줄"])

# AI 스케줄 생성 (개발 모드)
@router.post("/generate-dev")
async def generate_ai_schedule_for_employer_dev(schedule_request: AIScheduleRequest):
    """개발 모드에서 AI 스케줄을 생성합니다."""
    try:
        print(f"🚀 AI 스케줄 생성 요청 받음 (개발 모드): {schedule_request}")
        start_time = time.time()
        
        # AI 스케줄 생성 로직 (간단한 버전)
        schedule_id = str(uuid.uuid4())
        
        # 기본 스케줄 데이터 생성
        schedule_data = {
            "schedule_id": schedule_id,
            "business_id": schedule_request.business_id,
            "week_start_date": schedule_request.week_start_date,
            "week_end_date": schedule_request.week_end_date,
            "schedule_data": {},
            "total_workers": len(schedule_request.employee_preferences),
            "total_hours": 0,
            "satisfaction_score": 0.0,
            "created_at": datetime.now().isoformat(),
            "status": "completed"
        }
        
        # 각 직원별 스케줄 생성 (간단한 로직)
        for employee in schedule_request.employee_preferences:
            employee_schedule = {
                "employee_id": employee.worker_id,
                "department_id": employee.department_id,
                "work_fields": employee.work_fields,
                "schedule": {
                    "월": ["09:00-17:00"] if "월" in employee.preferred_work_days else [],
                    "화": ["09:00-17:00"] if "화" in employee.preferred_work_days else [],
                    "수": ["09:00-17:00"] if "수" in employee.preferred_work_days else [],
                    "목": ["09:00-17:00"] if "목" in employee.preferred_work_days else [],
                    "금": ["09:00-17:00"] if "금" in employee.preferred_work_days else [],
                    "토": ["10:00-16:00"] if "토" in employee.preferred_work_days else [],
                    "일": []
                }
            }
            schedule_data["schedule_data"][employee.worker_id] = employee_schedule
        
        # 만족도 점수 계산 (간단한 로직)
        total_preferences = len(schedule_request.employee_preferences)
        satisfied_preferences = sum(1 for emp in schedule_request.employee_preferences 
                                  if len(emp.preferred_work_days) > 0)
        schedule_data["satisfaction_score"] = satisfied_preferences / total_preferences if total_preferences > 0 else 0.0
        
        # 총 근무 시간 계산
        total_hours = 0
        for emp_schedule in schedule_data["schedule_data"].values():
            for day_schedule in emp_schedule["schedule"].values():
                total_hours += len(day_schedule) * 8  # 각 시간대를 8시간으로 가정
        schedule_data["total_hours"] = total_hours
        
        # 데이터베이스에 저장
        from utils import db
        if db:
            db.collection("ai_schedules").document(schedule_id).set(schedule_data)
        
        end_time = time.time()
        generation_time = end_time - start_time
        
        print(f"✅ AI 스케줄 생성 완료: {generation_time:.2f}초")
        
        return {
            "message": "AI 스케줄이 성공적으로 생성되었습니다",
            "schedule_id": schedule_id,
            "generation_time": generation_time,
            "schedule": schedule_data
        }
        
    except Exception as e:
        print(f"❌ AI 스케줄 생성 오류: {e}")
        raise HTTPException(status_code=500, detail=f"AI 스케줄 생성 중 오류가 발생했습니다: {str(e)}")

# AI 스케줄 생성 (일반 모드)
@router.post("/generate")
async def generate_ai_schedule_for_employer(schedule_request: AIScheduleRequest, current_user: dict = Depends(get_current_user)):
    """AI를 사용하여 스케줄을 생성합니다."""
    try:
        print(f"AI 스케줄 생성 요청 받음: {schedule_request}")
        print(f"현재 사용자: {current_user}")
        
        # 권한 검증
        if current_user["uid"] != schedule_request.business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        # AI 스케줄 생성 로직
        schedule_id = str(uuid.uuid4())
        
        # OpenAI를 사용한 스케줄 생성
        messages = [
            {
                "role": "system",
                "content": "당신은 직원 스케줄 관리 전문가입니다. 직원들의 선호도와 부서별 필요 인원을 고려하여 최적의 스케줄을 생성해주세요."
            },
            {
                "role": "user",
                "content": f"""
                다음 정보를 바탕으로 최적의 스케줄을 생성해주세요:
                
                비즈니스 ID: {schedule_request.business_id}
                주간 기간: {schedule_request.week_start_date} ~ {schedule_request.week_end_date}
                
                부서별 필요 인원:
                {schedule_request.department_staffing}
                
                직원 선호도:
                {schedule_request.employee_preferences}
                
                제약사항:
                {schedule_request.schedule_constraints}
                
                각 직원별로 요일별 근무 시간을 JSON 형태로 반환해주세요.
                """
            }
        ]
        
        try:
            ai_response = call_openai_api(messages)
            print(f"AI 응답: {ai_response}")
            
            # AI 응답을 파싱하여 스케줄 데이터 생성
            # 실제 구현에서는 더 정교한 파싱이 필요합니다.
            schedule_data = {
                "schedule_id": schedule_id,
                "business_id": schedule_request.business_id,
                "week_start_date": schedule_request.week_start_date,
                "week_end_date": schedule_request.week_end_date,
                "schedule_data": {},
                "total_workers": len(schedule_request.employee_preferences),
                "total_hours": 0,
                "satisfaction_score": 0.0,
                "created_at": datetime.now().isoformat(),
                "status": "completed",
                "ai_generated": True,
                "ai_response": ai_response
            }
            
            # 각 직원별 기본 스케줄 생성
            for employee in schedule_request.employee_preferences:
                employee_schedule = {
                    "employee_id": employee.worker_id,
                    "department_id": employee.department_id,
                    "work_fields": employee.work_fields,
                    "schedule": {
                        "월": ["09:00-17:00"] if "월" in employee.preferred_work_days else [],
                        "화": ["09:00-17:00"] if "화" in employee.preferred_work_days else [],
                        "수": ["09:00-17:00"] if "수" in employee.preferred_work_days else [],
                        "목": ["09:00-17:00"] if "목" in employee.preferred_work_days else [],
                        "금": ["09:00-17:00"] if "금" in employee.preferred_work_days else [],
                        "토": ["10:00-16:00"] if "토" in employee.preferred_work_days else [],
                        "일": []
                    }
                }
                schedule_data["schedule_data"][employee.worker_id] = employee_schedule
            
            # 데이터베이스에 저장
            from utils import db
            if db:
                db.collection("ai_schedules").document(schedule_id).set(schedule_data)
            
            return {
                "message": "AI 스케줄이 성공적으로 생성되었습니다",
                "schedule_id": schedule_id,
                "schedule": schedule_data
            }
            
        except Exception as ai_error:
            print(f"AI 처리 오류: {ai_error}")
            raise HTTPException(status_code=500, detail="AI 처리 중 오류가 발생했습니다")
            
    except Exception as e:
        print(f"스케줄 생성 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# 생성된 스케줄 조회
@router.get("/{schedule_id}")
async def get_generated_schedule(schedule_id: str, current_user: dict = Depends(get_current_user)):
    """생성된 스케줄을 조회합니다."""
    try:
        print(f"스케줄 조회 요청: {schedule_id}, 사용자: {current_user['uid']}")
        
        from utils import db
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 필요합니다")
        
        schedule_doc = db.collection("ai_schedules").document(schedule_id).get()
        
        if not schedule_doc.exists:
            raise HTTPException(status_code=404, detail="스케줄을 찾을 수 없습니다")
        
        schedule_data = schedule_doc.to_dict()
        
        # 권한 확인
        if current_user["uid"] != schedule_data.get("business_id"):
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        return {"schedule": schedule_data}
        
    except Exception as e:
        print(f"스케줄 조회 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# 비즈니스의 모든 스케줄 조회
@router.get("/schedules/{business_id}")
async def get_generated_schedules(business_id: str, current_user: dict = Depends(get_current_user)):
    """특정 비즈니스의 모든 생성된 스케줄을 조회합니다."""
    try:
        print(f"비즈니스 스케줄 목록 조회: {business_id}, 사용자: {current_user['uid']}")
        
        # 권한 확인
        if current_user["uid"] != business_id:
            raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        from utils import db
        if not db:
            raise HTTPException(status_code=500, detail="데이터베이스 연결이 필요합니다")
        
        schedules = db.collection("ai_schedules").where("business_id", "==", business_id).stream()
        schedule_list = []
        
        for schedule_doc in schedules:
            schedule_data = schedule_doc.to_dict()
            schedule_list.append({
                "schedule_id": schedule_doc.id,
                "week_start_date": schedule_data.get("week_start_date"),
                "week_end_date": schedule_data.get("week_end_date"),
                "total_workers": schedule_data.get("total_workers", 0),
                "total_hours": schedule_data.get("total_hours", 0),
                "satisfaction_score": schedule_data.get("satisfaction_score", 0.0),
                "created_at": schedule_data.get("created_at"),
                "status": schedule_data.get("status", "unknown")
            })
        
        return {"schedules": schedule_list}
        
    except Exception as e:
        print(f"스케줄 목록 조회 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# 스케줄 생성 가이드
@router.get("/guide")
async def get_schedule_generation_guide():
    """스케줄 생성 가이드 및 모범 사례를 제공합니다."""
    return {
        "title": "AI 스케줄 생성 가이드",
        "description": "효율적인 스케줄 생성을 위한 가이드입니다",
        "best_practices": [
            "직원들의 선호도를 정확히 입력하세요",
            "부서별 필요 인원을 현실적으로 설정하세요",
            "업무 시간과 휴무일을 명확히 구분하세요",
            "특별한 제약사항이 있다면 상세히 설명하세요"
        ],
        "tips": [
            "스케줄은 최소 1주일 전에 생성하는 것이 좋습니다",
            "직원들의 피드백을 수집하여 지속적으로 개선하세요",
            "AI가 생성한 스케줄은 검토 후 적용하세요"
        ]
    }
