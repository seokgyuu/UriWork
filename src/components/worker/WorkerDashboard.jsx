/**
 * 노동자 대시보드 컴포넌트
 * 피고용자의 메인 대시보드 페이지
 * 권한이 없으면 권한 요청 화면을 보여주고, 권한이 있으면 기능들을 사용할 수 있음
 * 스케줄 확인, 선호도 설정, 프로필 관리 등의 기능 제공
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Calendar, 
  Clock, 
  User, 
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  LogOut,
  Key,
  Building2,
  Plus,
  Trash2,
  RefreshCw,
  Briefcase
} from 'lucide-react';
import toast from 'react-hot-toast';
import WorkerPreference from './WorkerPreference';
import api, { workerScheduleAPI } from '../../services/api';

const WorkerDashboard = () => {
  try { console.log('[WorkerDashboard] render start'); } catch (_) {}
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [schedulePreferences, setSchedulePreferences] = useState({
    workFields: [],
    preferredOffDays: [],
    minWorkHours: 20,
    maxWorkHours: 40
  });
  const [departments] = useState([]);
  const [workFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [businessCode, setBusinessCode] = useState('');
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [mySchedule, setMySchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  // 자동 이동 제거: 권한이 active여도 대시보드 우선 표시

  // 권한 상태 확인 (동일 상태면 불필요한 업데이트 방지)
  const checkPermission = async () => {
    if (!currentUser) return;

    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');

      // 현재 사용자의 권한 확인 (active 우선)
      const permissionQuery = query(
        collection(db, 'permissions'),
        where('worker_id', '==', currentUser.uid),
        where('status', '==', 'active')
      );
      const permissionSnapshot = await getDocs(permissionQuery);

      if (!permissionSnapshot.empty) {
        const permission = permissionSnapshot.docs[0].data();
        setPermissionStatus(prev => {
          const next = {
            status: 'active',
            businessId: permission.business_id,
            businessName: permission.business_name
          };
          // 변경 없으면 그대로 유지해 렌더 방지
          if (
            prev?.status === next.status &&
            prev?.businessId === next.businessId &&
            prev?.businessName === next.businessName
          ) {
            return prev;
          }
          return next;
        });

        // 로컬 스토리지에 권한 정보 저장 (변경 여부와 무관, 경량)
        try {
          localStorage.setItem(
            `worker_permission_${currentUser.uid}`,
            JSON.stringify({
              businessId: permission.business_id,
              businessName: permission.business_name
            })
          );
        } catch (_) {}

        return;
      }

      // 대기 중인 권한 확인
      const pendingPermissionQuery = query(
        collection(db, 'permissions'),
        where('worker_id', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const pendingPermissionSnapshot = await getDocs(pendingPermissionQuery);

      setPermissionStatus(prev => {
        // pending이든 없든 UI는 대기 표시, 동일 상태면 업데이트 생략
        if (prev?.status === 'pending') return prev;
        return { status: 'pending' };
      });
    } catch (error) {
      console.error('권한 확인 에러:', error);
      setPermissionStatus(prev => (prev?.status === 'error' ? prev : { status: 'error' }));
    }
  };

  useEffect(() => {
    checkPermission();
  }, [currentUser]);

  // 권한이 pending 상태일 때 주기적으로 확인 (폴링 주기 완화)
  useEffect(() => {
    if (permissionStatus?.status === 'pending') {
      const interval = setInterval(() => {
        checkPermission();
      }, 3000); // 3초마다 확인

      return () => clearInterval(interval);
    }
  }, [permissionStatus?.status]);

  // 자동 캘린더 이동 로직 제거됨

  // 자동 이동 화면 표시 제거

  // 권한이 활성화되면 스케줄도 주기적으로 새로고침
  useEffect(() => {
    if (permissionStatus?.status === 'active') {
      // 5분마다 상태 확인
      const interval = setInterval(() => {
        // 상태 확인 로직
      }, 5 * 60 * 1000); // 5분

      return () => clearInterval(interval);
    }
  }, [permissionStatus?.status]);



  // 할당된 주요업무 불러오기
  const fetchAssignedTasks = async () => {
    if (!currentUser || !permissionStatus?.businessId) return;
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const profileQuery = query(
        collection(db, 'worker_profiles'),
        where('worker_id', '==', currentUser.uid),
        where('business_id', '==', permissionStatus.businessId)
      );
      const profileSnapshot = await getDocs(profileQuery);
      
      if (!profileSnapshot.empty) {
        const profileData = profileSnapshot.docs[0].data();
        setAssignedTasks(profileData.assigned_tasks || []);
      }
    } catch (error) {
      console.error('할당된 주요업무 불러오기 에러:', error);
    }
  };

  // 내 스케줄 불러오기
  const fetchMySchedule = async () => {
    if (!currentUser || !permissionStatus?.businessId) return;
    
    try {
      setLoadingSchedule(true);
      const response = await workerScheduleAPI.getMySchedule(permissionStatus.businessId, currentUser.uid);
      
      if (response.data && response.data.data) {
        setMySchedule(response.data.data);
        
        // 스케줄이 로드되면 현재 월을 스케줄 기간에 맞게 설정
        if (response.data.data?.ai_schedule?.week_start_date) {
          const scheduleStartDate = new Date(response.data.data.ai_schedule.week_start_date);
          setCurrentMonth(scheduleStartDate);
        }
      }
    } catch (error) {
      console.error('내 스케줄 불러오기 에러:', error);
      toast.error('스케줄을 불러오는데 실패했습니다.');
    } finally {
      setLoadingSchedule(false);
    }
  };

  // 권한이 active 상태일 때 로그 출력 및 할당된 업무 불러오기
  useEffect(() => {
    if (permissionStatus?.status === 'active') {
      toast.success(`${permissionStatus.businessName} 업체에 권한이 부여되었습니다!`);
      fetchAssignedTasks();
      fetchMySchedule();
    }
  }, [permissionStatus]);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
      toast.success('로그아웃되었습니다.');
      navigate('/login');
    } catch (error) {
      console.error('로그아웃 에러:', error);
      toast.error('로그아웃 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  // 권한 요청 처리
  const handlePermissionRequest = async () => {
    if (!businessCode.trim()) {
      toast.error('업체 고유번호를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const { collection, query, where, getDocs, doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');

      // 업체 고유번호로 업체 찾기
      const businessQuery = query(
        collection(db, 'users'),
        where('uniqueCode', '==', businessCode.trim()),
        where('user_type', '==', 'business')
      );
      const businessSnapshot = await getDocs(businessQuery);

      if (businessSnapshot.empty) {
        toast.error('유효하지 않은 업체 고유번호입니다.');
        return;
      }

      const businessDoc = businessSnapshot.docs[0];
      const businessData = businessDoc.data();

      // 권한 요청 저장
      await setDoc(doc(db, 'permissions', `${currentUser.uid}_${businessData.uid}`), {
        worker_id: currentUser.uid,
        business_id: businessData.uid,
        business_name: businessData.name || businessData.email?.split('@')[0],
        worker_name: currentUser.displayName || currentUser.email?.split('@')[0],
        worker_email: currentUser.email,
        status: 'pending',
        requested_at: new Date().toISOString()
      });

      toast.success('권한 요청이 전송되었습니다. 관리자의 승인을 기다려주세요.');
      setBusinessCode('');
      setPermissionStatus({ status: 'pending' });
      
      // 권한 상태 다시 확인
      setTimeout(() => {
        checkPermission();
      }, 1000);
    } catch (error) {
      console.error('권한 요청 에러:', error);
      toast.error('권한 요청 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 권한 요청 화면 표시 여부 (훅 순서 고정: 최종 JSX에서 분기)
  const showPermissionRequestScreen = !permissionStatus || permissionStatus?.status === 'pending' || permissionStatus?.status === 'error';

  const renderPermissionRequestScreen = () => (
    <div className="min-h-screen bg-gray-50 dashboard-container">
      {/* 헤더 */}
      {renderHeaderSafe()}

      {/* 권한 요청 화면 */}
      <main className="max-w-4xl mx-auto py-3 sm:py-6 px-2 sm:px-6 lg:px-8 container-responsive">
        <div className="bg-white rounded-lg shadow p-4 sm:p-8 card-padding-responsive">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <Key className="h-6 w-6 text-yellow-600" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">업체 접근 권한 필요</h2>
            <p className="mt-2 text-gray-600">
              업체의 캘린더와 스케줄을 확인하려면 관리자로부터 권한을 받아야 합니다.
            </p>
          </div>

          <div className="mt-8 max-w-md mx-auto">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  업체 고유번호
                </label>
                <input
                  type="text"
                  value={businessCode}
                  onChange={(e) => setBusinessCode(e.target.value.toUpperCase())}
                  placeholder="업체에서 받은 고유번호를 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">
                  업체 관리자에게 고유번호를 요청하세요.
                </p>
              </div>

              <button
                onClick={handlePermissionRequest}
                disabled={loading || !businessCode.trim()}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    권한 요청
                  </>
                )}
              </button>
            </div>

            {permissionStatus?.status === 'pending' && (
              <div className="mt-6 p-4 bg-blue-50 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm text-blue-800 font-medium">
                      {permissionStatus.businessName 
                        ? `${permissionStatus.businessName} 업체의 권한 승인을 기다리고 있습니다.`
                        : '권한 요청이 전송되었습니다. 관리자의 승인을 기다려주세요.'
                      }
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      승인 완료 시 자동으로 스케줄을 확인할 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );

  // 권한이 있는 경우 기존 대시보드
  const handleSchedulePreferencesSave = async () => {
    try {
      setLoading(true);
      // await workerScheduleAPI.setSchedulePreferences(schedulePreferences); // This line was removed as per the new_code
      toast.success('선호도가 저장되었습니다!');
    } catch (error) {
      console.error('선호도 저장 에러:', error);
      toast.error('선호도 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorkField = (field) => {
    if (!schedulePreferences.workFields.includes(field)) {
      setSchedulePreferences(prev => ({
        ...prev,
        workFields: [...prev.workFields, field]
      }));
    }
  };

  const handleRemoveWorkField = (field) => {
    setSchedulePreferences(prev => ({
      ...prev,
      workFields: prev.workFields.filter(f => f !== field)
    }));
  };

  const handleToggleOffDay = (day) => {
    setSchedulePreferences(prev => ({
      ...prev,
      preferredOffDays: prev.preferredOffDays.includes(day)
        ? prev.preferredOffDays.filter(d => d !== day)
        : [...prev.preferredOffDays, day]
    }));
  };

  const tabs = [
    { id: 'overview', name: '개요', icon: Calendar },
    { id: 'schedule', name: '내 스케줄', icon: Calendar },
    { id: 'preferences', name: '선호도 설정', icon: Settings },
    { id: 'profile', name: '프로필', icon: User }
  ];

  const SafeIcon = ({ Icon, className }) => {
    try {
      return typeof Icon === 'function' ? <Icon className={className} /> : <span className={className} />;
    } catch (_) {
      return <span className={className} />;
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'schedule':
        return renderMySchedule();
      case 'preferences':
        return renderPreferences();
      case 'profile':
        return renderProfile();
      default:
        return renderOverview();
    }
  };

  // 헤더/탭도 방어적으로 렌더링 (크래시 지점 추적)
  const renderHeaderSafe = () => {
    try {
      return (
        <header className="bg-white shadow sticky-header safe-area-top">
          <div className="max-w-7xl mx-auto container-responsive">
            <div className="flex justify-between items-start sm:items-center py-3 sm:py-4 gap-3 touch-target">
              <h1 className="text-responsive-2xl sm:text-3xl font-bold text-gray-900 truncate max-w-[60vw] sm:max-w-none">
                {permissionStatus?.businessName || '피고용자'}
              </h1>
              <div className="flex items-center flex-wrap gap-2 sm:gap-4 justify-end min-w-0">
                <span className="hidden sm:inline text-responsive-xs sm:text-sm text-gray-600 max-w-[40vw] truncate">안녕하세요, {currentUser?.displayName || '직원님'}!</span>
                <button
                  onClick={handleProfileClick}
                  className="flex items-center px-2 sm:px-3 py-2 text-responsive-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 whitespace-nowrap"
                >
                  <User className="h-4 w-4 mr-2" />
                  프로필
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  className="flex items-center px-2 sm:px-3 py-2 text-responsive-xs sm:text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </header>
      );
    } catch (e) {
      try { console.error('[WorkerDashboard] header render error', e, { currentUserPresent: !!currentUser }); } catch (_) {}
      return (
        <header className="bg-white shadow"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">대시보드</div></header>
      );
    }
  };

  const renderTabsSafe = () => {
    try {
      return (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto container-responsive">
            <nav className="flex space-x-4 sm:space-x-6 responsive-tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                try { console.log('[WorkerDashboard] tab entry', { id: tab.id, hasIcon: typeof Icon === 'function' }); } catch (_) {}
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center px-2 sm:px-3 py-3 sm:py-4 text-responsive-sm sm:text-sm font-medium border-b-2 whitespace-nowrap shrink-0 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <SafeIcon Icon={Icon} className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      );
    } catch (e) {
      try { console.error('[WorkerDashboard] tabs render error', e, { activeTab }); } catch (_) {}
      return null;
    }
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 grid-gap-responsive">
      {(() => { try { console.log('[WorkerDashboard] renderOverview'); } catch (_) {} return null; })()}
      <div 
        className="bg-white card-padding-responsive rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => setActiveTab('schedule')}
      >
        <div className="flex items-center">
          <SafeIcon Icon={Calendar} className="h-8 w-8 text-blue-500" />
          <div className="ml-4">
            <p className="text-responsive-sm font-medium text-gray-600">내 스케줄</p>
            <p className="text-responsive-xl font-bold text-gray-900">확인</p>
            <p className="text-responsive-xs text-blue-600 mt-1">내 스케줄 →</p>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white card-padding-responsive rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => {
          if (permissionStatus?.status === 'active' && permissionStatus?.businessId) {
            navigate(`/calendar/${permissionStatus.businessId}`);
          } else if (permissionStatus?.status === 'pending') {
            toast.error('권한 승인을 기다려주세요.');
          } else {
            toast.error('업체 캘린더에 접근할 권한이 없습니다.');
          }
        }}
      >
        <div className="flex items-center">
          <SafeIcon Icon={Calendar} className="h-8 w-8 text-green-500" />
          <div className="ml-4">
            <p className="text-responsive-sm font-medium text-gray-600">업체 캘린더</p>
            <p className="text-responsive-xl font-bold text-gray-900">보기</p>
            <p className="text-responsive-xs text-green-600 mt-1">
              {permissionStatus?.status === 'active' ? '쉬는날 선택하기 →' : '권한 필요'}
            </p>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white card-padding-responsive rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => setActiveTab('preferences')}
      >
        <div className="flex items-center">
          <SafeIcon Icon={Clock} className="h-8 w-8 text-purple-500" />
          <div className="ml-4">
            <p className="text-responsive-sm font-medium text-gray-600">선호도</p>
            <p className="text-responsive-xl font-bold text-gray-900">설정</p>
            <p className="text-responsive-xs text-purple-600 mt-1">선호도 설정 →</p>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-white card-padding-responsive rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow duration-200"
        onClick={() => setActiveTab('profile')}
      >
        <div className="flex items-center">
          <SafeIcon Icon={Building2} className="h-8 w-8 text-orange-500" />
          <div className="ml-4 min-w-0">
            <p className="text-responsive-sm font-medium text-gray-600">소속 업체</p>
            <p className="text-responsive-xl font-bold text-gray-900 truncate">{permissionStatus?.businessName || '미설정'}</p>
            <p className="text-responsive-xs text-orange-600 mt-1 truncate">
              {assignedTasks.length > 0 ? `${assignedTasks.length}개 업무` : '프로필 확인 →'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const [scheduleView, setScheduleView] = useState('list'); // 'list' 또는 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date()); // 현재 표시할 월

  // 캘린더 날짜 렌더링 함수
  const renderCalendarDays = () => {
    if (!mySchedule?.ai_schedule) return null;
    
    const { week_start_date, week_end_date } = mySchedule.ai_schedule;
    const startDate = new Date(week_start_date);
    const endDate = new Date(week_end_date);
    
    // 현재 표시할 월의 첫 번째 날과 마지막 날
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // 첫 번째 날이 속한 주의 첫 번째 날 (일요일)
    const firstDayOfWeek = new Date(firstDayOfMonth);
    firstDayOfMonth.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());
    
    // 마지막 날이 속한 주의 마지막 날 (토요일)
    const lastDayOfWeek = new Date(lastDayOfMonth);
    lastDayOfWeek.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()));
    
    const days = [];
    const currentDate = new Date(firstDayOfWeek);
    
    while (currentDate <= lastDayOfWeek) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days.map((date, index) => {
      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
      const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
      const isInScheduleRange = date >= startDate && date <= endDate;
      const isToday = date.toDateString() === new Date().toDateString();
      
      // 해당 날짜의 스케줄 찾기
      let daySchedule = null;
      if (isInScheduleRange && mySchedule.ai_schedule.daily_assignments) {
        const raw = mySchedule.ai_schedule.daily_assignments[dayOfWeek];
        daySchedule = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
      }
      
      return (
        <div
          key={index}
          className={`min-h-[80px] p-2 border border-gray-200 rounded-lg ${
            isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'
          } ${!isCurrentMonth ? 'opacity-30' : ''} ${!isInScheduleRange ? 'opacity-50' : ''}`}
        >
          {/* 날짜 표시 */}
          <div className={`text-xs font-medium mb-1 ${
            isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-600' : 'text-gray-400'
          }`}>
            {date.getDate()}
            {isToday && <span className="ml-1 text-blue-500">●</span>}
          </div>
          
          {/* 스케줄 내용 */}
          {isInScheduleRange && Array.isArray(daySchedule) && daySchedule.length > 0 ? (
            <div className="space-y-1">
              {daySchedule.map((assignment, idx) => (
                <div key={idx} className="p-1 bg-purple-100 rounded text-xs border border-purple-200">
                  <div className="font-medium text-purple-800 truncate">
                    {assignment.department_name}
                  </div>
                  <div className="text-purple-600 text-xs">
                    {assignment.work_hours?.[0] || '09:00-18:00'}
                  </div>
                </div>
              ))}
            </div>
          ) : isInScheduleRange ? (
            <div className="text-purple-400 text-xs italic text-center pt-2">휴무</div>
          ) : (
            <div className="text-gray-300 text-xs text-center pt-2">-</div>
          )}
        </div>
      );
    });
  };

  const renderMySchedule = () => (
    <div className="space-y-6">
      <div className="bg-white card-padding-responsive rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-responsive-lg sm:text-lg font-medium text-gray-900">내 스케줄</h3>
          <div className="flex items-center space-x-2">
            {/* 뷰 선택 탭 */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
              <button
                onClick={() => setScheduleView('list')}
                className={`flex items-center px-3 py-1 rounded-md transition-colors text-responsive-xs sm:text-sm ${
                  scheduleView === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-4 h-4 mr-1" />
                목록 보기
              </button>
              <button
                onClick={() => setScheduleView('calendar')}
                className={`flex items-center px-3 py-1 rounded-md transition-colors text-responsive-xs sm:text-sm ${
                  scheduleView === 'calendar'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-4 h-4 mr-1" />
                캘린더 보기
              </button>
            </div>
            <button 
              onClick={fetchMySchedule}
              disabled={loadingSchedule}
              className="flex items-center text-responsive-xs sm:text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingSchedule ? 'animate-spin' : ''}`} />
              {loadingSchedule ? '새로고침 중...' : '새로고침'}
            </button>
          </div>
        </div>
        
        {loadingSchedule ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">스케줄을 불러오는 중...</p>
          </div>
        ) : mySchedule ? (
          <div className="space-y-6">
            {/* AI 생성 스케줄 표시 */}
            {mySchedule.ai_schedule && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 card-padding-responsive rounded-lg border border-purple-200">
                <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                  <Briefcase className="w-4 h-4 mr-2" />
                  AI 생성 스케줄 배정 현황
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 grid-gap-responsive text-responsive-xs sm:text-sm mb-4">
                  <div>
                    <span className="text-purple-600">기간:</span>
                    <span className="ml-2 font-medium">
                      {mySchedule.ai_schedule.week_start_date} ~ {mySchedule.ai_schedule.week_end_date}
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-600">총 근무일:</span>
                    <span className="ml-2 font-medium text-purple-800">
                      {mySchedule.ai_schedule.total_work_days}일
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-600">총 근무시간:</span>
                    <span className="ml-2 font-medium text-purple-800">
                      {mySchedule.ai_schedule.total_work_hours}시간
                    </span>
                  </div>
                  <div>
                    <span className="text-purple-600">배정 파트:</span>
                    <span className="ml-2 font-medium text-purple-800">
                      {mySchedule.ai_schedule.assigned_departments?.length || 0}개
                    </span>
                  </div>
                </div>
                
                {/* 뷰에 따른 스케줄 표시 */}
                {scheduleView === 'list' ? (
                                     /* 목록 보기 - 일요일부터 시작하도록 수정 */
                   <div className="grid grid-cols-7 gap-2 text-xs">
                     {['일', '월', '화', '수', '목', '금', '토'].map(day => {
                       const raw = mySchedule.ai_schedule.daily_assignments?.[day];
                       const dayAssignments = Array.isArray(raw) ? raw : (raw ? Object.values(raw) : []);
                       return (
                         <div key={day} className="text-center">
                           <div className="font-medium text-purple-700 mb-1">{day}</div>
                           <div className="bg-white rounded p-2 min-h-[60px] border border-purple-200">
                             {dayAssignments.length > 0 ? (
                               dayAssignments.map((assignment, index) => (
                                 <div key={index} className="mb-1 p-1 bg-purple-100 rounded text-xs">
                                   <div className="font-medium text-purple-800">
                                     {assignment.department_name}
                                   </div>
                                   <div className="text-purple-600 text-xs">
                                     {assignment.work_hours?.[0] || '09:00-18:00'}
                                   </div>
                                 </div>
                               ))
                             ) : (
                               <div className="text-purple-400 text-xs italic">휴무</div>
                             )}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                ) : (
                  /* 캘린더 보기 - 월간 캘린더 형태 */
                  <div className="bg-white rounded-lg border border-purple-200 card-padding-responsive">
                    {/* 월 네비게이션 */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => {
                          const prevMonth = new Date(currentMonth);
                          prevMonth.setMonth(prevMonth.getMonth() - 1);
                          setCurrentMonth(prevMonth);
                        }}
                        className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h4 className="text-lg font-medium text-purple-900">
                        {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                      </h4>
                      <button
                        onClick={() => {
                          const nextMonth = new Date(currentMonth);
                          nextMonth.setMonth(nextMonth.getMonth() + 1);
                          setCurrentMonth(nextMonth);
                        }}
                        className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 text-responsive-xs">
                      {/* 요일 헤더 */}
                      {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                        <div key={day} className="text-center py-2 font-medium text-purple-700 bg-purple-50 rounded">
                          {day}
                        </div>
                      ))}
                      
                      {/* 날짜별 스케줄 */}
                      {renderCalendarDays()}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 개인 선호도 스케줄 표시 */}
            {mySchedule.preference_schedule && (
              <div className="bg-gradient-to-r from-blue-50 to-green-50 card-padding-responsive rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                  <Calendar className="w-4 h-4 mr-2" />
                  내 선호도 스케줄
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 grid-gap-responsive text-responsive-xs sm:text-sm mb-4">
                  <div>
                    <span className="text-blue-600">총 근무일:</span>
                    <span className="ml-2 font-medium">
                      {Object.values(mySchedule.preference_schedule.daily_preferences || {}).filter(day => day.length > 0).length}일
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600">선호 파트:</span>
                    <span className="ml-2 font-medium">
                      {new Set(Object.values(mySchedule.preference_schedule.daily_preferences || {}).flat()).size}개
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-600">상태:</span>
                    <span className="ml-2 font-medium text-green-600">활성</span>
                  </div>
                  <div>
                    <span className="text-blue-600">마지막 업데이트:</span>
                    <span className="ml-2 font-medium">
                      {mySchedule.preference_schedule.updated_at ? 
                        new Date(mySchedule.preference_schedule.updated_at).toLocaleDateString('ko-KR') : 
                        '정보 없음'
                      }
                    </span>
                  </div>
                </div>
                
                {/* 요일별 선호도 표시 */}
                <div className="grid grid-cols-7 gap-2 text-responsive-xs">
                  {['월', '화', '수', '목', '금', '토', '일'].map(day => {
                    const dayPreferences = mySchedule.preference_schedule.daily_preferences?.[day];
                    const selectedDepartments = dayPreferences?.selected_departments || [];
                    
                    return (
                      <div key={day} className="text-center">
                        <div className="font-medium text-blue-700 mb-1">{day}</div>
                        <div className="bg-white rounded p-2 min-h-[60px] border border-blue-200">
                          {selectedDepartments.length > 0 ? (
                            (() => {
                              const maxVisible = 6;
                              const visible = selectedDepartments.slice(0, maxVisible);
                              const extraCount = selectedDepartments.length - visible.length;
                              return (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {visible.map((deptId, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] sm:text-xs max-w-[72px] sm:max-w-[110px] truncate"
                                      title={String(deptId)}
                                    >
                                      {deptId}
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] sm:text-xs">
                                      +{extraCount}
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-blue-400 text-xs italic">선택 없음</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 추가 정보 */}
            {mySchedule.preference_schedule?.additional_preferences && (
              <div className="bg-gray-50 card-padding-responsive rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">추가 선호사항</h4>
                <div className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                  {typeof mySchedule.preference_schedule.additional_preferences === 'string'
                    ? mySchedule.preference_schedule.additional_preferences
                    : JSON.stringify(mySchedule.preference_schedule.additional_preferences, null, 2)
                  }
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">아직 설정된 스케줄이 없습니다.</p>
            <p className="text-sm text-gray-500 mt-2">
              {permissionStatus?.status === 'active' 
                ? '업체에서 AI 스케줄을 생성하거나 선호도를 설정하면 여기에 표시됩니다.'
                : '권한이 활성화되면 스케줄을 확인할 수 있습니다.'
              }
            </p>
            {permissionStatus?.status === 'active' && (
              <div className="mt-4 space-x-3">
                <button 
                  onClick={() => setActiveTab('preferences')}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  선호도 설정하기
                </button>
                <button 
                  onClick={() => {
                    if (permissionStatus?.status === 'active' && permissionStatus?.businessId) {
                      navigate(`/calendar/${permissionStatus.businessId}`);
                    }
                  }}
                  className="text-sm text-green-600 hover:text-green-800 underline"
                >
                  업체 캘린더 보기
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* 디버그 정보 (개발용) */}
        {process.env.NODE_ENV === 'development' && false && (
          <div className="mt-6 p-3 bg-gray-100 rounded text-xs">
            <p className="font-medium mb-2">디버그 정보:</p>
            <p>권한 상태: {permissionStatus?.status}</p>
            <p>비즈니스 ID: {permissionStatus?.businessId}</p>
            <p>사용자 ID: {currentUser?.uid}</p>
            <p>스케줄 데이터: {mySchedule ? '있음' : '없음'}</p>
            <p>로딩 상태: {loadingSchedule ? '로딩 중' : '완료'}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPreferences = () => (
    <WorkerPreference />
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">내 정보</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">이름</label>
            <p className="text-gray-900">{currentUser?.displayName || '미설정'}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">이메일</label>
            <p className="text-gray-900">{currentUser?.email}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">소속 업체</label>
            <p className="text-gray-900">{permissionStatus?.businessName || '미설정'}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">권한 상태</label>
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-green-700">활성</span>
            </div>
          </div>
        </div>
      </div>

      {/* 할당된 주요업무 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">할당된 주요업무</h3>
        
        {assignedTasks.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-3">
              고용자가 설정한 주요업무입니다. 이 업무들에 배정될 수 있습니다.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {assignedTasks.map((task, index) => (
                <div key={index} className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-sm font-medium text-blue-800">
                      {task.task_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-600">아직 할당된 주요업무가 없습니다.</p>
            <p className="text-sm text-gray-500 mt-1">
              고용자가 주요업무를 설정하면 여기에 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // 안전한 콘텐츠 생성
  let safeMainContent;
  try {
    safeMainContent = renderContent();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[WorkerDashboard] renderContent error', e, {
      activeTab,
      permissionStatus,
      mySchedulePresent: !!mySchedule,
      preferenceSchedulePresent: !!mySchedule?.preference_schedule,
      aiSchedulePresent: !!mySchedule?.ai_schedule
    });
    safeMainContent = (
      <div className="p-6 bg-red-50 border border-red-200 rounded text-red-700">
        화면을 그리는 동안 문제가 발생했습니다. 다시 시도해 주세요.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dashboard-container">
      {showPermissionRequestScreen ? (
        renderPermissionRequestScreen()
      ) : (
        <>
          {renderHeaderSafe()}
          {renderTabsSafe()}
          <main className="w-full py-3 sm:py-6 px-2 sm:px-4">
            <div className="w-full">
              {safeMainContent}
            </div>
          </main>
        </>
      )}
    </div>
  );
};

export default WorkerDashboard; 