"""
챗봇 관련 API 엔드포인트
AI 챗봇 메시지 처리, 스케줄 파싱, 예약 생성 등의 챗봇 기능을 제공합니다.
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta
import uuid
import re
from utils import get_current_user, call_openai_api

router = APIRouter(prefix="/chatbot", tags=["챗봇"])

# 챗봇 메시지 처리
@router.post("/message")
async def process_chatbot_message(message: str, current_user: dict = Depends(get_current_user)):
    """챗봇 메시지를 처리하고 응답을 생성합니다."""
    try:
        # 간단한 챗봇 응답 로직
        response = "안녕하세요! AI 스케줄 생성 챗봇입니다. 🗓️\n\n스케줄을 생성하거나 예약 관련 문의를 도와드릴 수 있습니다."
        
        if "예약" in message:
            response = "예약을 원하시면 자연어로 입력해주세요. 예: '내일 오후 2시 미용실 예약'"
        elif "취소" in message:
            response = "예약 취소는 예약 목록에서 해당 예약을 선택하여 취소할 수 있습니다."
        elif "시간" in message:
            response = "운영 시간은 평일 09:00-18:00, 토요일 10:00-16:00입니다."
        elif "스케줄" in message:
            response = "스케줄을 생성하거나 수정할 수 있습니다. 원하는 날짜와 시간을 알려주세요."
        
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 스케줄 요청 파싱
@router.post("/parse-schedule")
async def parse_schedule_request(user_input: dict, current_user: dict = Depends(get_current_user)):
    """사용자의 자연어 입력을 파싱하여 스케줄 요청을 생성합니다."""
    try:
        text = user_input["userInput"].lower()
        
        # 날짜 패턴 매칭
        date_patterns = [
            {"pattern": r"(오늘|금일)", "value": datetime.now()},
            {"pattern": r"(내일|명일)", "value": datetime.now() + timedelta(days=1)},
            {"pattern": r"(모레|내일모레)", "value": datetime.now() + timedelta(days=2)},
            {"pattern": r"(다음주|다음 주)", "value": datetime.now() + timedelta(days=7)},
        ]
        
        parsed_date = None
        for pattern_info in date_patterns:
            if re.search(pattern_info["pattern"], text):
                parsed_date = pattern_info["value"].strftime("%Y-%m-%d")
                break
        
        # 시간 패턴 매칭
        time_patterns = [
            r"(\d{1,2})시",
            r"(\d{1,2}):(\d{2})",
            r"오전\s*(\d{1,2})",
            r"오후\s*(\d{1,2})",
        ]
        
        parsed_time = None
        for pattern in time_patterns:
            match = re.search(pattern, text)
            if match:
                if "오전" in text:
                    hour = int(match.group(1))
                    if hour == 12:
                        hour = 0
                    parsed_time = f"{hour:02d}:00"
                elif "오후" in text:
                    hour = int(match.group(1))
                    if hour != 12:
                        hour += 12
                    parsed_time = f"{hour:02d}:00"
                else:
                    hour = int(match.group(1))
                    if hour < 12 and "오후" in text:
                        hour += 12
                    parsed_time = f"{hour:02d}:00"
                break
        
        # 서비스 타입 추출
        service_types = ["미용실", "카페", "레스토랑", "헬스장", "병원", "은행"]
        parsed_service = None
        for service in service_types:
            if service in text:
                parsed_service = service
                break
        
        return {
            "parsed_date": parsed_date,
            "parsed_time": parsed_time,
            "parsed_service": parsed_service,
            "original_text": text
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 챗봇을 통한 예약 생성
@router.post("/create-booking")
async def create_chatbot_booking(booking_data: dict, current_user: dict = Depends(get_current_user)):
    """챗봇을 통해 예약을 생성합니다."""
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
        
        from utils import db
        db.collection("chatbot_bookings").document(booking_id).set(booking)
        
        return {"message": "예약이 생성되었습니다", "booking_id": booking_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 챗봇을 통한 스케줄 생성
@router.post("/generate-schedule")
async def generate_chatbot_schedule(schedule_request: dict, current_user: dict = Depends(get_current_user)):
    """챗봇을 통해 스케줄을 생성합니다."""
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
        
        from utils import db
        schedule_id = str(uuid.uuid4())
        db.collection("chatbot_schedules").document(schedule_id).set(schedule)
        
        return {"message": "스케줄이 생성되었습니다", "schedule_id": schedule_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# AI를 통한 스케줄 수정
@router.post("/edit-schedule")
async def edit_schedule_with_ai(edit_request: dict, current_user: dict = Depends(get_current_user)):
    """AI를 사용하여 스케줄을 수정합니다."""
    try:
        print(f"AI 스케줄 수정 요청 받음: {edit_request}")
        
        schedule_id = edit_request.get("scheduleId")
        edit_request_text = edit_request.get("editRequest")
        current_schedule = edit_request.get("currentSchedule")
        business_id = edit_request.get("businessId")
        
        if not all([schedule_id, edit_request_text, current_schedule, business_id]):
            raise HTTPException(status_code=400, detail="필수 필드가 누락되었습니다")
        
        # AI를 사용하여 스케줄 수정 제안 생성
        messages = [
            {
                "role": "system",
                "content": "당신은 스케줄 관리 전문가입니다. 사용자의 요청에 따라 기존 스케줄을 수정해주세요."
            },
            {
                "role": "user",
                "content": f"""
                현재 스케줄: {current_schedule}
                수정 요청: {edit_request_text}
                
                위 스케줄을 사용자의 요청에 맞게 수정해주세요.
                수정된 스케줄을 JSON 형태로 반환해주세요.
                """
            }
        ]
        
        try:
            ai_response = call_openai_api(messages)
            # AI 응답을 파싱하여 수정된 스케줄 생성
            # 실제 구현에서는 더 정교한 파싱이 필요합니다.
            
            from utils import db
            # 수정된 스케줄을 데이터베이스에 저장
            updated_schedule = {
                **current_schedule,
                "ai_modified": True,
                "modification_request": edit_request_text,
                "ai_suggestion": ai_response,
                "updated_at": datetime.now().isoformat()
            }
            
            db.collection("ai_schedules").document(schedule_id).update(updated_schedule)
            
            return {
                "message": "스케줄이 AI에 의해 수정되었습니다",
                "modified_schedule": updated_schedule,
                "ai_suggestion": ai_response
            }
            
        except Exception as ai_error:
            print(f"AI 처리 오류: {ai_error}")
            raise HTTPException(status_code=500, detail="AI 처리 중 오류가 발생했습니다")
            
    except Exception as e:
        print(f"스케줄 수정 오류: {e}")
        raise HTTPException(status_code=400, detail=str(e))
