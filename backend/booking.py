"""
예약 관련 API 엔드포인트
예약 생성, 조회 등의 예약 관리 기능을 제공합니다.
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import uuid
from .models import BookingCreate
from .utils import get_current_user

router = APIRouter(prefix="/booking", tags=["예약"])

# 예약 생성
@router.post("/create")
async def create_booking(booking: BookingCreate, current_user: dict = Depends(get_current_user)):
    """새로운 예약을 생성합니다."""
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
        
        from .utils import db
        db.collection("bookings").document(booking_id).set(booking_data)
        
        return {"message": "예약이 생성되었습니다", "booking_id": booking_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# 예약 목록 조회
@router.get("/{business_id}")
async def get_bookings(business_id: str, current_user: dict = Depends(get_current_user)):
    """특정 비즈니스의 예약 목록을 조회합니다."""
    try:
        # 권한 확인
        if current_user["uid"] != business_id:
            from .utils import db
            permission_doc = db.collection("permissions").document(f"{business_id}_{current_user['uid']}").get()
            if not permission_doc.exists:
                raise HTTPException(status_code=403, detail="권한이 없습니다")
        
        from .utils import db
        bookings = db.collection("bookings").where("business_id", "==", business_id).stream()
        booking_list = [doc.to_dict() for doc in bookings]
        
        return {"bookings": booking_list}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
