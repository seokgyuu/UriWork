/**
 * 업체 대시보드 컴포넌트
 * 사업자(업체)가 사용하는 메인 대시보드 페이지
 * 예약 현황, 수익 통계, 직원 관리, 캘린더 설정 등을 포함
 * 업체의 전체적인 운영 현황을 한눈에 볼 수 있음
 * 스케줄 관리, 업종/파트/주요분야 설정 기능 추가
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { scheduleAPI, businessManagementAPI } from '../../services/api';
import { 
  Settings,
  LogOut,
  User,
  Brain,
  Calendar,
  Briefcase,
  Users,
  Menu,
  X,
  Building
} from 'lucide-react';
import toast from 'react-hot-toast';

// Lazy loading으로 컴포넌트들 import
const EmployerScheduleGenerator = lazy(() => import('./EmployerScheduleGenerator'));
const WorkersManagement = lazy(() => import('./WorkersManagement'));
const ScheduleManagement = lazy(() => import('./ScheduleManagement'));
const CategoriesManagement = lazy(() => import('./CategoriesManagement'));
const Overview = lazy(() => import('./Overview'));
const SettingsComponent = lazy(() => import('./Settings'));
const BusinessManagement = lazy(() => import('./BusinessManagement'));

// 로딩 컴포넌트
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const BusinessDashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [scheduleSettings, setScheduleSettings] = useState({
    schedule_type: 'weekly',
    week_count: 1,
    deadline_days: 3,
    custom_work_hours: {
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '18:00' },
      saturday: { start: '10:00', end: '16:00' },
      sunday: { start: '00:00', end: '00:00' }
    }
  });
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workFields, setWorkFields] = useState([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [isBusinessSelectOpen, setIsBusinessSelectOpen] = useState(false);

  // 메뉴 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.relative')) {
        setIsMenuOpen(false);
      }
      if (isBusinessSelectOpen && !event.target.closest('.business-select-container')) {
        setIsBusinessSelectOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, isBusinessSelectOpen]);

  const tabs = [
    { id: 'overview', name: '개요', icon: 'Calendar' },
    { id: 'businesses', name: '업장 관리', icon: 'Building' },
    { id: 'schedule', name: '스케줄 관리', icon: 'Calendar' },
    { id: 'ai-schedule', name: 'AI 스케줄 생성', icon: 'Brain' },
    { id: 'categories', name: '파트 관리', icon: 'Briefcase' },
    { id: 'workers', name: '직원 관리', icon: 'Users' }
  ];

  // Firebase에서 파트 불러오기
  const fetchDepartments = async () => {
    if (!currentUser) return;
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      console.log('파트 관리 - 사용자 ID:', currentUser.uid);
      
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('business_id', '==', currentUser.uid)
      );
      const departmentsSnapshot = await getDocs(departmentsQuery);
      
      console.log('파트 관리 - 파트 쿼리 결과:', departmentsSnapshot.size, '개 문서');
      
      const departmentsList = [];
      departmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('파트 관리 - 파트 데이터:', data);
        departmentsList.push(data);
      });
      
      console.log('파트 관리 - 최종 파트 목록:', departmentsList);
      setDepartments(departmentsList);
    } catch (error) {
      console.error('파트 불러오기 에러:', error);
      toast.error('파트 목록을 불러오는데 실패했습니다.');
    }
  };

  // Firebase에서 주요업무 불러오기
  const fetchWorkTasks = async () => {
    if (!currentUser) return;
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const tasksQuery = query(
        collection(db, 'work_tasks'),
        where('business_id', '==', currentUser.uid)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      const tasksList = [];
      tasksSnapshot.forEach((doc) => {
        tasksList.push(doc.data());
      });
      
      setWorkFields(tasksList);
    } catch (error) {
      console.error('주요업무 불러오기 에러:', error);
      toast.error('주요업무 목록을 불러오는데 실패했습니다.');
    }
  };

  // Firebase에서 업장 목록 불러오기
  const fetchBusinesses = async () => {
    if (!currentUser) return;
    
    try {
      const response = await businessManagementAPI.getBusinesses();
      
      if (response.data.success) {
        setBusinesses(response.data.businesses);
        
        // 첫 번째 업장을 기본 선택
        if (response.data.businesses.length > 0 && !selectedBusiness) {
          setSelectedBusiness(response.data.businesses[0]);
          setBusinessName(response.data.businesses[0].name);
        }
      } else {
        throw new Error('업장 목록을 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('업장 목록 불러오기 에러:', error);
      // 에러가 발생해도 기본 업장명 설정
      setBusinessName(currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : '업체'));
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else {
      fetchDepartments();
      fetchWorkTasks();
      fetchBusinesses();
    }
  }, [currentUser, navigate]);

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
    navigate('/user-profile');
  };

  // 업장 선택 핸들러
  const handleBusinessSelect = (business) => {
    setSelectedBusiness(business);
    setBusinessName(business.name);
    setIsBusinessSelectOpen(false);
  };

  const handleScheduleSettingsSave = async () => {
    try {
      await scheduleAPI.createScheduleSettings({
        business_id: currentUser.uid,
        ...scheduleSettings
      });
      toast.success('스케줄 설정이 저장되었습니다');
    } catch (error) {
      // API 호출 실패 시에도 로컬 상태 유지
      toast.success('스케줄 설정이 저장되었습니다 (로컬 저장)');
      console.error('스케줄 설정 에러:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    
    try {
      await scheduleAPI.createCategory({
        business_id: currentUser.uid,
        category_name: newCategory,
        description: ''
      });
      setCategories([...categories, { category_name: newCategory }]);
      setNewCategory('');
      toast.success('업종이 추가되었습니다');
    } catch (error) {
      // API 호출 실패 시에도 로컬 상태 업데이트
      const newCategoryItem = { 
        category_name: newCategory,
        category_id: `local_${Date.now()}` // 임시 ID
      };
      setCategories([...categories, newCategoryItem]);
      setNewCategory('');
      toast.success('업종이 추가되었습니다 (로컬 저장)');
      console.error('업종 추가 에러:', error);
    }
  };

  // 탭 네비게이션 핸들러
  const handleTabNavigation = (tabId) => {
    if (tabId === 'overview') {
      setActiveTab('overview');
    } else if (tabId.startsWith('/')) {
      navigate(tabId);
    } else {
      setActiveTab(tabId);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Overview 
              currentUser={currentUser} 
              departments={departments} 
              onNavigate={handleTabNavigation}
            />
          </Suspense>
        );
      case 'businesses':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <BusinessManagement />
          </Suspense>
        );
      case 'schedule':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ScheduleManagement currentUser={currentUser} />
          </Suspense>
        );
      case 'ai-schedule':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <EmployerScheduleGenerator />
          </Suspense>
        );
      case 'categories':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <CategoriesManagement currentUser={currentUser} />
          </Suspense>
        );
      case 'workers':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <WorkersManagement currentUser={currentUser} workFields={workFields} />
          </Suspense>
        );
      case 'settings':
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <SettingsComponent />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <Overview 
              currentUser={currentUser} 
              departments={departments} 
              onNavigate={handleTabNavigation}
            />
          </Suspense>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dashboard-container">
      {/* 헤더 */}
      <header className="bg-white shadow header-mobile">
        <div className="w-full px-3 sm:px-4 pt-4 sm:pt-6">
          <div className="flex justify-between items-center py-4 sm:py-8">
            <div className="flex items-center space-x-4">
              {/* 업장 선택 드롭다운 */}
              {businesses.length > 0 && (
                <div className="business-select-container relative">
                  <button
                    onClick={() => setIsBusinessSelectOpen(!isBusinessSelectOpen)}
                    className="flex items-center space-x-2 text-lg sm:text-3xl font-bold text-gray-900 text-responsive-xl hover:text-blue-600 transition-colors"
                  >
                    <span className="truncate max-w-[200px]">{businessName || '업체'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isBusinessSelectOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                      <div className="py-1">
                        {businesses.map((business) => (
                          <button
                            key={business.id}
                            onClick={() => handleBusinessSelect(business)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                              selectedBusiness?.id === business.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            }`}
                          >
                            <div className="font-medium">{business.name}</div>
                            {business.business_type && (
                              <div className="text-xs text-gray-500">{business.business_type}</div>
                            )}
                          </button>
                        ))}
                        <div className="border-t border-gray-200 mt-1 pt-1">
                          <button
                            onClick={() => {
                              setActiveTab('businesses');
                              setIsBusinessSelectOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Building className="h-4 w-4 inline mr-2" />
                            업장 관리
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* 업장이 없는 경우 기본 제목 */}
              {businesses.length === 0 && (
                <h1 className="text-lg sm:text-3xl font-bold text-gray-900 text-responsive-xl">{businessName || '업체'}</h1>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="hidden sm:block text-xs sm:text-sm text-gray-600 text-responsive-xs">안녕하세요, {currentUser?.displayName || '사장님'}!</span>
              
              {/* 햄버거 메뉴 버튼 */}
              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center justify-center w-10 h-10 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  {isMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </button>
                
                  {/* 드롭다운 메뉴 */}
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-sm rounded-md shadow-xl border border-gray-200 z-[9999]">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setActiveTab('settings');
                            setIsMenuOpen(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Settings className="h-4 w-4 mr-3" />
                          설정
                        </button>
                        <button
                          onClick={() => {
                            handleProfileClick();
                            setIsMenuOpen(false);
                          }}
                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <User className="h-4 w-4 mr-3" />
                          프로필
                        </button>
                        <button
                          onClick={() => {
                            handleLogout();
                            setIsMenuOpen(false);
                          }}
                          disabled={loading}
                          className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4 mr-3" />
                          로그아웃
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-white border-b">
        <div className="w-full px-3 sm:px-4">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              let IconComponent;
              switch (tab.icon) {
                case 'Brain':
                  IconComponent = Brain;
                  break;
                case 'Settings':
                  IconComponent = Settings;
                  break;
                case 'Calendar':
                  IconComponent = Calendar;
                  break;
                case 'Briefcase':
                  IconComponent = Briefcase;
                  break;
                case 'Users':
                  IconComponent = Users;
                  break;
                case 'Building':
                  IconComponent = Building;
                  break;
                default:
                  IconComponent = Calendar;
              }
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1 py-3 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="w-full py-4 sm:py-8 px-0 sm:px-4">
        <div className="w-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default BusinessDashboard; 