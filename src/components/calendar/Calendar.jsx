import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { bookingAPI } from '../../services/api';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  User,
  Calendar as CalendarIcon,
  Check,
  X,
  Plus,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const Calendar = () => {
  const { businessId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isBusinessOwner, setIsBusinessOwner] = useState(false);
  const [absences, setAbsences] = useState([]);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceReason, setAbsenceReason] = useState('');
  const [showAbsenceCancelModal, setShowAbsenceCancelModal] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState(null);
  const [absenceCancelReason, setAbsenceCancelReason] = useState('');

  // 현재 월의 첫 번째 날과 마지막 날 계산
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

  // 캘린더 그리드 생성
  const calendarDays = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    calendarDays.push(date);
  }

  // 이전/다음 월 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // 권한 확인 및 데이터 로딩 순서 수정
  useEffect(() => {
    const initCalendar = async () => {
      console.log('캘린더 초기화 시작');
      
      // 권한 확인
      const permissionResult = await checkPermission();
      console.log('권한 확인 결과:', permissionResult);
      
      if (permissionResult) {
        console.log('권한 있음, 데이터 로딩 시작');
        // 순차적으로 데이터 로딩
        await fetchBookings();
        await fetchAbsences();
        console.log('초기 데이터 로딩 완료');
      }
    };
    
    initCalendar();
  }, [businessId, currentUser?.uid]); // currentUser.uid로 변경

  // 권한이 변경될 때마다 데이터 다시 로딩
  useEffect(() => {
    if (hasPermission) {
      console.log('권한 변경으로 인한 데이터 재로딩');
      fetchBookings();
      fetchAbsences();
    }
  }, [hasPermission, businessId]); // businessId 추가

  // 권한 확인 함수 수정 - 상태 설정 순서 변경
  const checkPermission = async () => {
    if (!businessId || !currentUser) {
      console.log('권한 확인 실패: businessId 또는 currentUser 없음', { businessId, currentUser });
      return false;
    }
    
    console.log('권한 확인 시작:', {
      businessId,
      currentUserUid: currentUser.uid,
      isBusinessOwner: businessId === currentUser.uid
    });
    
    // 고용자 본인인 경우
    if (businessId === currentUser.uid) {
      console.log('고용자 권한 확인됨');
      setIsBusinessOwner(true);
      setHasPermission(true);
      return true;
    }
    
    // 피고용자인 경우 Firebase에서 권한 확인
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const permissionQuery = query(
        collection(db, 'permissions'),
        where('worker_id', '==', currentUser.uid),
        where('business_id', '==', businessId),
        where('status', '==', 'active')
      );
      const permissionSnapshot = await getDocs(permissionQuery);
      
      console.log('피고용자 권한 확인:', {
        permissionCount: permissionSnapshot.size,
        hasPermission: !permissionSnapshot.empty,
        permissions: permissionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      });
      
      if (!permissionSnapshot.empty) {
        console.log('피고용자 권한 확인됨');
        setIsBusinessOwner(false);
        setHasPermission(true);
        return true;
      }
    } catch (error) {
      console.error('권한 확인 에러:', error);
    }
    
    console.log('권한 없음');
    setIsBusinessOwner(false);
    setHasPermission(false);
    return false;
  };

  // 예약 목록 가져오기 - 에러 처리 강화
  const fetchBookings = async () => {
    if (!hasPermission || !businessId) {
      console.log('권한이 없거나 businessId가 없어서 예약 목록을 가져올 수 없습니다.', { hasPermission, businessId });
      return;
    }
    
    console.log('예약 목록 가져오기 시작');
    setLoading(true);
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      let bookingsQuery;
      
      if (isBusinessOwner) {
        // 고용자는 모든 직원의 예약을 볼 수 있음
        bookingsQuery = query(collection(db, 'bookings'), where('business_id', '==', businessId));
        console.log('고용자용 예약 쿼리 생성:', businessId);
      } else {
        // 피고용자는 자신의 예약만 볼 수 있음
        bookingsQuery = query(
          collection(db, 'bookings'), 
          where('business_id', '==', businessId),
          where('worker_id', '==', currentUser.uid)
        );
        console.log('피고용자용 예약 쿼리 생성:', { businessId, workerId: currentUser.uid });
      }
      
      console.log('Firestore 쿼리 실행 중...');
      const bookingsSnapshot = await getDocs(bookingsQuery);
      console.log('Firestore 쿼리 결과:', {
        size: bookingsSnapshot.size,
        empty: bookingsSnapshot.empty,
        query: bookingsQuery
      });
      
      const bookingsList = [];
      bookingsSnapshot.forEach((doc) => {
        const data = doc.data();
        // 문서 ID를 포함하여 저장
        const bookingWithId = {
          id: doc.id, // Firestore 문서 ID
          ...data
        };
        console.log('예약 데이터:', bookingWithId);
        bookingsList.push(bookingWithId);
      });
      
      console.log('예약 목록 로딩 완료:', {
        totalCount: bookingsList.length,
        bookings: bookingsList
      });
      
      setBookings(bookingsList);
    } catch (error) {
      toast.error('예약 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('예약 목록 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  // 결근 목록 가져오기 - 에러 처리 강화
  const fetchAbsences = async () => {
    if (!hasPermission || !businessId) {
      console.log('권한이 없거나 businessId가 없어서 결근 목록을 가져올 수 없습니다.', { hasPermission, businessId });
      return;
    }
    
    console.log('결근 목록 가져오기 시작');
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      let bookingsQuery;
      
      if (isBusinessOwner) {
        // 고용자는 모든 직원의 결근을 볼 수 있음
        bookingsQuery = query(collection(db, 'bookings'), where('business_id', '==', businessId));
        console.log('고용자용 결근 쿼리 생성:', businessId);
      } else {
        // 피고용자는 자신의 결근만 볼 수 있음
        bookingsQuery = query(
          collection(db, 'bookings'), 
          where('business_id', '==', businessId),
          where('worker_id', '==', currentUser.uid)
        );
        console.log('피고용자용 결근 쿼리 생성:', { businessId, workerId: currentUser.uid });
      }
      
      console.log('Firestore 결근 쿼리 실행 중...');
      const bookingsSnapshot = await getDocs(bookingsQuery);
      console.log('Firestore 결근 쿼리 결과:', {
        size: bookingsSnapshot.size,
        empty: bookingsSnapshot.empty,
        query: bookingsQuery
      });
      
      const absencesList = [];
      bookingsSnapshot.forEach((doc) => {
        const booking = doc.data();
        console.log('예약 데이터 확인:', { id: doc.id, ...booking });
        
        if (booking.type === 'absence') {
          // 문서 ID를 포함하여 저장
          const absenceWithId = {
            id: doc.id, // Firestore 문서 ID
            ...booking
          };
          console.log('결근 데이터 발견:', absenceWithId);
          absencesList.push(absenceWithId);
        }
      });
      
      console.log('결근 목록 로딩 완료:', {
        totalCount: absencesList.length,
        absences: absencesList
      });
      
      setAbsences(absencesList);
    } catch (error) {
      console.error('결근 목록 에러:', error);
      toast.error('결근 목록을 불러오는 중 오류가 발생했습니다.');
    }
  };

  // 예약 생성 후 돌아왔을 때 새로고침
  useEffect(() => {
    if (location.state?.refresh && hasPermission) {
      fetchBookings();
      // 새로고침 상태 초기화
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, hasPermission]);

  // 특정 날짜의 예약 가져오기
  const getBookingsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const filteredBookings = bookings.filter(booking => booking.date === dateStr);
    console.log('특정 날짜 예약 필터링:', {
      date: dateStr,
      totalBookings: bookings.length,
      filteredBookings: filteredBookings
    });
    return filteredBookings;
  };

  // 특정 날짜의 결근 가져오기 - 디버깅 추가
  const getAbsencesForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const filteredAbsences = absences.filter(absence => absence.date === dateStr);
    
    console.log('특정 날짜 결근 필터링:', {
      date: dateStr,
      totalAbsences: absences.length,
      filteredAbsences: filteredAbsences,
      allAbsences: absences
    });
    
    return filteredAbsences;
  };

  // 날짜가 현재 월에 속하는지 확인
  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // 날짜가 오늘인지 확인
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // 날짜가 선택된 날짜인지 확인
  const isSelected = (date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
  };

  // 결근 표시 - 즉시 상태 업데이트
  const handleMarkAbsence = async () => {
    if (!selectedDate) {
      toast.error('결근을 표시할 날짜를 선택해주세요.');
      return;
    }

    if (!absenceReason.trim()) {
      toast.error('결근 사유를 입력해주세요.');
      return;
    }

    try {
      console.log('결근 표시 시작:', {
        selectedDate: selectedDate.toISOString().split('T')[0],
        reason: absenceReason.trim(),
        businessId,
        workerId: currentUser.uid
      });

      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');

      const absenceData = {
        business_id: businessId,
        worker_id: currentUser.uid,
        worker_name: currentUser.displayName || currentUser.email?.split('@')[0],
        worker_email: currentUser.email,
        date: selectedDate.toISOString().split('T')[0],
        time: '결근',
        service_type: '결근',
        notes: absenceReason.trim(),
        status: 'pending',
        type: 'absence',
        created_at: new Date().toISOString()
      };

      console.log('결근 데이터 준비 완료:', absenceData);

      // addDoc을 사용하여 자동 ID 생성
      const docRef = await addDoc(collection(db, 'bookings'), absenceData);
      console.log('결근 저장 완료, 문서 ID:', docRef.id);
      
      // 즉시 로컬 상태에 추가 (새로고침 전까지 유지)
      const newAbsence = {
        id: docRef.id,
        ...absenceData
      };
      
      setAbsences(prev => [...prev, newAbsence]);
      setBookings(prev => [...prev, newAbsence]);
      
      toast.success('결근이 표시되었습니다!');
      setShowAbsenceModal(false);
      setAbsenceReason('');
      
      // 백그라운드에서 데이터 새로고침
      setTimeout(async () => {
        console.log('백그라운드 데이터 새로고침 시작');
        await fetchBookings();
        await fetchAbsences();
        console.log('백그라운드 데이터 새로고침 완료');
      }, 1000);
      
    } catch (error) {
      console.error('결근 표시 에러:', error);
      toast.error('결근 표시 중 오류가 발생했습니다.');
    }
  };

  // 결근 해제 - 문서 ID로 삭제
  const handleRemoveAbsence = async (absence) => {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');

      // absence.id를 사용하여 삭제
      await deleteDoc(doc(db, 'bookings', absence.id));
      toast.success('결근이 해제되었습니다!');
      
      // 즉시 로컬 상태에서 제거
      setAbsences(prev => prev.filter(a => a.id !== absence.id));
      setBookings(prev => prev.filter(b => b.id !== absence.id));
      
      // 백그라운드에서 데이터 새로고침
      setTimeout(async () => {
        await fetchBookings();
        await fetchAbsences();
      }, 1000);
      
    } catch (error) {
      console.error('결근 해제 에러:', error);
      toast.error('결근 해제 중 오류가 발생했습니다.');
    }
  };

  // 결근 확정 - 문서 ID로 업데이트
  const handleConfirmAbsence = async (absence) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // absence.id를 사용하여 업데이트
      await updateDoc(doc(db, 'bookings', absence.id), {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: currentUser.uid
      });
      
      // 즉시 로컬 상태 업데이트
      setAbsences(prev => prev.map(a => 
        a.id === absence.id ? { ...a, status: 'confirmed' } : a
      ));
      setBookings(prev => prev.map(b => 
        b.id === absence.id ? { ...b, status: 'confirmed' } : b
      ));
      
      toast.success('결근이 확정되었습니다!');
      
      // 백그라운드에서 데이터 새로고침
      setTimeout(async () => {
        await fetchBookings();
        await fetchAbsences();
      }, 1000);
      
    } catch (error) {
      toast.error('결근 확정 중 오류가 발생했습니다.');
      console.error('결근 확정 에러:', error);
    }
  };

  // 결근 취소 모달 열기
  const handleCancelAbsence = (absence) => {
    setSelectedAbsence(absence);
    setAbsenceCancelReason('');
    setShowAbsenceCancelModal(true);
  };

  // 결근 취소 실행 - 문서 ID로 업데이트
  const handleConfirmAbsenceCancel = async () => {
    if (!absenceCancelReason.trim()) {
      toast.error('취소 사유를 입력해주세요.');
      return;
    }

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // selectedAbsence.id를 사용하여 업데이트
      await updateDoc(doc(db, 'bookings', selectedAbsence.id), {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: currentUser.uid,
        cancel_reason: absenceCancelReason.trim()
      });
      
      // 즉시 로컬 상태 업데이트
      setAbsences(prev => prev.map(a => 
        a.id === selectedAbsence.id ? { ...a, status: 'cancelled' } : a
      ));
      setBookings(prev => prev.map(b => 
        b.id === selectedAbsence.id ? { ...b, status: 'cancelled' } : b
      ));
      
      toast.success('결근이 취소되었습니다!');
      setShowAbsenceCancelModal(false);
      setSelectedAbsence(null);
      setAbsenceCancelReason('');
      
      // 백그라운드에서 데이터 새로고침
      setTimeout(async () => {
        await fetchBookings();
        await fetchAbsences();
      }, 1000);
      
    } catch (error) {
      toast.error('결근 취소 중 오류가 발생했습니다.');
      console.error('결근 취소 에러:', error);
    }
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long'
    }).format(date);
  };

  // 권한이 없는 경우
  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h2>
          <p className="text-gray-600 mb-6">
            이 업체의 캘린더에 접근할 권한이 없습니다.<br />
            업체 관리자에게 권한을 요청하거나, 프로필에서 업체 고유번호를 입력해주세요.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/profile')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-3"
            >
              프로필로 이동
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              뒤로 가기
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                {isBusinessOwner ? '관리자 캘린더' : '캘린더'}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {!isBusinessOwner && (
                <button
                  onClick={() => setShowAbsenceModal(true)}
                  disabled={!selectedDate}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4 mr-2" />
                  결근 표시
                </button>
              )}
              {isBusinessOwner && (
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-600">
                    총 {absences.length}개의 결근
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow">
          {/* 캘린더 헤더 */}
          <div className="flex items-center justify-between p-6 border-b">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {formatDate(currentDate)}
            </h2>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-900">
                {day}
              </div>
            ))}
          </div>

          {/* 캘린더 그리드 */}
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {calendarDays.map((date, index) => {
              const dayBookings = getBookingsForDate(date);
              const dayAbsences = getAbsencesForDate(date);
              const hasBookings = dayBookings.length > 0;
              const hasAbsences = dayAbsences.length > 0;
              
              if (hasBookings || hasAbsences) {
                console.log('캘린더 날짜:', date.toISOString().split('T')[0], {
                  dayBookings,
                  dayAbsences,
                  hasBookings,
                  hasAbsences
                });
              }

              return (
                <div
                  key={index}
                  className={`min-h-32 bg-white p-2 cursor-pointer hover:bg-gray-50 ${
                    !isCurrentMonth(date) ? 'text-gray-400' : ''
                  } ${isToday(date) ? 'bg-blue-50' : ''} ${
                    isSelected(date) ? 'ring-2 ring-primary-500' : ''
                  }`}
                  onClick={() => handleDateClick(date)}
                >
                  <div className="text-sm font-medium mb-1">
                    {date.getDate()}
                  </div>
                  
                  {hasAbsences && (
                    <div className="space-y-1 mb-1">
                      {dayAbsences.map((absence, absenceIndex) => (
                        <div
                          key={absenceIndex}
                          className="text-xs px-1 py-0.5 rounded truncate bg-red-100 text-red-800"
                          title={`결근: ${absence.worker_name || absence.worker_email} - ${absence.notes}`}
                        >
                          ❌ {absence.worker_name || absence.worker_email}
                        </div>
                      ))}
                      {dayAbsences.length > 1 && (
                        <div className="text-xs text-red-600 font-medium">
                          +{dayAbsences.length}명 결근
                        </div>
                      )}
                    </div>
                  )}
                  
                  {hasBookings && (
                    <div className="space-y-1">
                      {dayBookings.slice(0, 3).map((booking, bookingIndex) => (
                        <div
                          key={bookingIndex}
                          className={`text-xs px-1 py-0.5 rounded truncate ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}
                          title={`${booking.time} - ${booking.service_type} - ${booking.worker_name || booking.worker_email} (${booking.status === 'confirmed' ? '확정' : booking.status === 'cancelled' ? '취소' : '보류'})`}
                        >
                          {booking.time}
                        </div>
                      ))}
                      {dayBookings.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{dayBookings.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 선택된 날짜의 결근 목록 (관리자만 표시) */}
        {selectedDate && isBusinessOwner && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {selectedDate.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })} 결근 목록
            </h3>
            {getAbsencesForDate(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getAbsencesForDate(selectedDate).map((absence) => (
                  <div
                    key={absence.id} // booking_id 대신 id 사용
                    className="flex items-center justify-between p-3 bg-red-50 rounded-md"
                  >
                    <div className="flex items-center space-x-3">
                      <X className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-red-800">{absence.worker_name || absence.worker_email}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-sm text-gray-600">{absence.notes}</span>
                      {/* 결근 상태 표시 */}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        absence.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        absence.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {absence.status === 'confirmed' ? '확정' :
                         absence.status === 'cancelled' ? '취소' : '보류'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* 확정/취소 버튼들 */}
                      {absence.status !== 'confirmed' && absence.status !== 'cancelled' && (
                        <>
                          <button
                            onClick={() => handleConfirmAbsence(absence)}
                            className="p-1 text-green-600 hover:text-green-800 hover:bg-green-100 rounded"
                            title="결근 확정"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancelAbsence(absence)}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded"
                            title="결근 취소"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                이 날짜에는 결근이 없습니다.
              </p>
            )}
          </div>
        )}

        {/* 결근 모달 */}
        {showAbsenceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  결근 표시
                </h3>
                <button
                  onClick={() => setShowAbsenceModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  {selectedDate?.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}에 결근을 표시하시겠습니까?
                </p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  결근 사유
                </label>
                <textarea
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="결근 사유를 입력해주세요..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAbsenceModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleMarkAbsence}
                  disabled={!absenceReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  결근 표시
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 결근 취소 모달 */}
        {showAbsenceCancelModal && selectedAbsence && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  결근 취소
                </h3>
                <button
                  onClick={() => setShowAbsenceCancelModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  다음 결근을 취소하시겠습니까?
                </p>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="text-sm">
                    <div><strong>날짜:</strong> {selectedAbsence.date}</div>
                    <div><strong>직원:</strong> {selectedAbsence.worker_name || selectedAbsence.worker_email}</div>
                    <div><strong>사유:</strong> {selectedAbsence.notes}</div>
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  취소 사유
                </label>
                <textarea
                  value={absenceCancelReason}
                  onChange={(e) => setAbsenceCancelReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="취소 사유를 입력해주세요..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAbsenceCancelModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmAbsenceCancel}
                  disabled={!absenceCancelReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  결근 취소
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Calendar;