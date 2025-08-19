/**
 * 예약 폼 컴포넌트
 * 사용자가 서비스 예약을 할 수 있는 폼 페이지
 * 날짜, 시간, 서비스 종류, 노동자 선택 등을 포함
 * 예약 생성 후 확인 페이지로 이동
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { bookingAPI } from '../../services/api';
import { 
  ChevronLeft, 
  Calendar,
  Clock,
  User,
  Tag,
  Save
} from 'lucide-react';
import toast from 'react-hot-toast';

const BookingForm = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { businessId, selectedDate } = location.state || {};

  const [formData, setFormData] = useState({
    date: selectedDate || '',
    time: '',
    service_type: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [availableTimes] = useState([
    '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'
  ]);

  const serviceTypes = [
    '결근',
    '휴가'
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.date || !formData.time || !formData.service_type) {
      toast.error('모든 필수 항목을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      // Firestore에 직접 예약 데이터 저장
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const bookingData = {
        booking_id: bookingId,
        business_id: businessId,
        worker_id: currentUser.uid,
        worker_name: currentUser.displayName || currentUser.email?.split('@')[0],
        worker_email: currentUser.email,
        date: formData.date,
        time: formData.time,
        service_type: formData.service_type,
        notes: formData.notes || '',
        status: 'pending',
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'bookings', bookingId), bookingData);
      toast.success('예약이 성공적으로 생성되었습니다!');
      
      // 캘린더로 돌아가면서 새로고침 트리거
      navigate(`/calendar/${businessId}`, { 
        state: { refresh: true, newBooking: bookingData }
      });
    } catch (error) {
      console.error('예약 생성 에러:', error);
      toast.error('예약 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const selectedDate = e.target.value;
    setFormData({
      ...formData,
      date: selectedDate
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                뒤로
              </button>
              <h1 className="text-3xl font-bold text-gray-900">
                새 예약
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 날짜 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                날짜
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleDateChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* 시간 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                시간
              </label>
              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">시간을 선택하세요</option>
                {availableTimes.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            {/* 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="inline h-4 w-4 mr-1" />
                선택
              </label>
              <select
                name="service_type"
                value={formData.service_type}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">선택하세요</option>
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 노동자 정보 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                노동자
              </label>
              <input
                type="text"
                value={currentUser?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                메모 (선택사항)
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="예약에 대한 추가 정보를 입력하세요..."
              />
            </div>

            {/* 예약 정보 요약 */}
            {formData.date && formData.time && formData.service_type && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  예약 정보 요약
                </h3>
                <div className="space-y-1 text-sm text-blue-800">
                  <div>날짜: {formData.date}</div>
                  <div>시간: {formData.time}</div>
                  <div>선택: {formData.service_type}</div>
                  <div>노동자: {currentUser?.email}</div>
                </div>
              </div>
            )}

            {/* 제출 버튼 */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !formData.date || !formData.time || !formData.service_type}
                className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? '예약 중...' : '예약 생성'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default BookingForm; 