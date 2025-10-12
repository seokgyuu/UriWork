import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { employerScheduleAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Trash2,
  Settings,
  BarChart3,
  Briefcase,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import CalendarView from './CalendarView';

const EmployerScheduleGenerator = () => {
  const { currentUser } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [employeePreferences, setEmployeePreferences] = useState([]);
  const [generatedSchedules, setGeneratedSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');
  const [selectedPreference, setSelectedPreference] = useState(null);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [userNames, setUserNames] = useState({});
  const [confirmedAbsences, setConfirmedAbsences] = useState([]); // 확정된 결근 목록
  const [scheduleView, setScheduleView] = useState('list'); // 스케줄 뷰 모드 (list/calendar)
  const [departmentStaffing, setDepartmentStaffing] = useState([]); // 파트별 필요 인원 및 근무 시간
  const [showAdvancedConstraints, setShowAdvancedConstraints] = useState(false); // 고급 제약사항 표시 여부

  // 요일 배열
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

  // 현재 날짜 관련 상태
  const [currentDate, setCurrentDate] = useState(new Date());

  // 스케줄 생성 상태
  const [scheduleRequest, setScheduleRequest] = useState({
    business_id: '',
    week_start_date: '',
    week_end_date: '',
    department_staffing: [],
    employee_preferences: [],
    schedule_constraints: {
      enforce_rest_hours: true,        // 휴식시간 보장 (11시간)
      limit_consecutive_days: true,    // 연속근무일 제한 (6일)
      ensure_weekly_rest: true,       // 주간 휴식 보장 (1일)
      limit_daily_hours: true,        // 일일 근무시간 제한 (8시간)
      limit_weekly_hours: true,       // 주간 근무시간 제한 (40시간)
      prioritize_preferences: true,   // 개인 선호도 우선
      balance_workload: true,        // 업무량 균등 배분
      auto_adjust_constraints: false, // 직원수 부족 시 제약사항 자동 완화
      allow_duplicate_assignments: false, // 중복 배정 허용
      limit_employee_assignments: true, // 직원별 배정 제한
      max_consecutive_assignments: true, // 최대 연속 배정 제한
    }
  });

  // 현재 날짜 업데이트 (매일 자정에 갱신)
  useEffect(() => {
    const updateCurrentDate = () => {
      setCurrentDate(new Date());
    };

    // 초기 설정
    updateCurrentDate();

    // 매일 자정에 업데이트
    const interval = setInterval(updateCurrentDate, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // 날짜가 과거인지 확인하는 함수
  const isPastDate = (dateString) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    
    // 시간을 제거하고 날짜만 비교
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return targetDateOnly < todayOnly;
  };

  // 날짜가 오늘인지 확인하는 함수
  const isToday = (dateString) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    
    // 시간을 제거하고 날짜만 비교
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return targetDateOnly.getTime() === todayOnly.getTime();
  };

  // 날짜가 미래인지 확인하는 함수
  const isFutureDate = (dateString) => {
    const targetDate = new Date(dateString);
    const today = new Date();
    
    // 시간을 제거하고 날짜만 비교
    const targetDateOnly = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return targetDateOnly > todayOnly;
  };

  // 과거 날짜 필터링된 결근 정보
  const filteredConfirmedAbsences = useMemo(() => {
    return confirmedAbsences.filter(absence => {
      // 과거 날짜의 결근은 제외
      if (isPastDate(absence.date)) {
        return false;
      }
      return true;
    });
  }, [confirmedAbsences, currentDate]);

  // 과거 날짜 필터링된 스케줄 목록
  const filteredGeneratedSchedules = useMemo(() => {
    return generatedSchedules.filter(schedule => {
      // 과거 날짜의 스케줄은 제외
      if (isPastDate(schedule.week_end_date)) {
        return false;
      }
      return true;
    });
  }, [generatedSchedules, currentDate]);

  useEffect(() => {
    if (currentUser) {
      console.log('AI 스케줄 생성 - 컴포넌트 마운트, 사용자:', currentUser.uid);
      loadData();
    }
  }, [currentUser]);

  // departments 상태 변경 감지
  useEffect(() => {
    console.log('AI 스케줄 생성 - departments 상태 변경:', departments.length, '개');
  }, [departments]);

  // generatedSchedules 상태 변경 감지
  useEffect(() => {
    console.log('AI 스케줄 생성 - generatedSchedules 상태 변경:', generatedSchedules);
    console.log('AI 스케줄 생성 - generatedSchedules 타입:', typeof generatedSchedules);
    console.log('AI 스케줄 생성 - generatedSchedules 배열 여부:', Array.isArray(generatedSchedules));
  }, [generatedSchedules]);

  // userNames 상태 변경 감지
  useEffect(() => {
    console.log('AI 스케줄 생성 - userNames 상태 변경:', userNames);
    console.log('AI 스케줄 생성 - userNames 키 개수:', Object.keys(userNames).length);
  }, [userNames]);

  // confirmedAbsences 상태 변경 감지
  useEffect(() => {
    console.log('AI 스케줄 생성 - confirmedAbsences 상태 변경:', confirmedAbsences);
    console.log('AI 스케줄 생성 - confirmedAbsences 개수:', confirmedAbsences.length);
  }, [confirmedAbsences]);

  // 사용 가능한 직원 수 계산 (중복 제거)
  const availableWorkers = useMemo(() => {
    if (!employeePreferences || employeePreferences.length === 0) return 0;
    
    // 고유한 직원 ID 추출 (우선순위: employee_id > worker_id > id)
    const uniqueWorkerIds = new Set();
    employeePreferences.forEach(pref => {
      const workerId = pref.employee_id || pref.worker_id || pref.id;
      if (workerId) {
        uniqueWorkerIds.add(workerId);
      }
    });
    
    return uniqueWorkerIds.size;
  }, [employeePreferences]);

  // totalRequiredStaff 계산 (컴포넌트 레벨에서)
  const totalRequiredStaff = useMemo(() => {
    if (!departments || departments.length === 0) return 0;
    
    return departments.reduce((total, dept) => {
      const dailyRequired = dept.required_staff_count || dept.staff_count || 1;
      // 사용자가 실제로 설정한 근무일 수만 계산
      const workDays = Object.keys(dept.work_hours || {}).filter(day => {
        const dayConfig = dept.work_hours[day];
        if (typeof dayConfig === 'boolean' && dayConfig) return true;
        if (dayConfig && typeof dayConfig === 'object' && dayConfig.enabled) return true;
        return false;
      }).length;
      const weeklyRequired = dailyRequired * workDays; // 실제 근무일 수 × 필요 인원
      return total + weeklyRequired;
    }, 0);
  }, [departments]);

  // 확정된 결근 데이터 가져오기
  const loadConfirmedAbsences = async () => {
    try {
      console.log('확정된 결근 데이터 로딩 시작');
      
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // 확정된 결근만 가져오기 (status === 'confirmed')
      const absencesQuery = query(
        collection(db, 'bookings'),
        where('business_id', '==', currentUser.uid),
        where('type', '==', 'absence'),
        where('status', '==', 'confirmed')
      );
      
      const absencesSnapshot = await getDocs(absencesQuery);
      console.log('확정된 결근 쿼리 결과:', absencesSnapshot.size, '개 문서');
      
      const absencesList = [];
      absencesSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('확정된 결근 데이터:', { id: doc.id, ...data });
        absencesList.push({
          id: doc.id,
          ...data
        });
      });
      
      console.log('확정된 결근 목록 로딩 완료:', {
        totalCount: absencesList.length,
        absences: absencesList
      });
      
      setConfirmedAbsences(absencesList);
    } catch (error) {
      console.error('확정된 결근 데이터 로딩 실패:', error);
      setConfirmedAbsences([]);
    }
  };



  const loadData = async () => {
    try {
      setLoading(true);
      
      // Firebase에서 파트 정보 가져오기
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      console.log('AI 스케줄 생성 - 사용자 ID:', currentUser.uid);
      
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('business_id', '==', currentUser.uid)
      );
      const departmentsSnapshot = await getDocs(departmentsQuery);
      
      console.log('AI 스케줄 생성 - 파트 쿼리 결과:', departmentsSnapshot.size, '개 문서');
      
      const departmentsList = [];
      departmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('AI 스케줄 생성 - 파트 데이터:', data);
        departmentsList.push(data);
      });
      
      console.log('AI 스케줄 생성 - 최종 파트 목록:', departmentsList);
      console.log('AI 스케줄 생성 - 파트 개수:', departmentsList.length);
      setDepartments(departmentsList);

      // Firebase에서 직원 선호도 가져오기
      const preferencesQuery = query(
        collection(db, 'employee_preferences'),
        where('business_id', '==', currentUser.uid)
      );
      const preferencesSnapshot = await getDocs(preferencesQuery);
      
      console.log('AI 스케줄 생성 - 직원 선호도 쿼리 결과:', preferencesSnapshot.size, '개 문서');
      
      const preferencesList = [];
      preferencesSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('AI 스케줄 생성 - 직원 선호도 데이터:', data);
        preferencesList.push(data);
      });
      
      console.log('AI 스케줄 생성 - 최종 직원 선호도 목록:', preferencesList);
      console.log('AI 스케줄 생성 - 직원 선호도 개수:', preferencesList.length);
      
      // 사용자 이름을 먼저 로드
      await loadUserNames(preferencesList);
      
      // 그 다음에 직원 선호도 상태 설정
      setEmployeePreferences(preferencesList);

      // 확정된 결근 데이터 로드
      await loadConfirmedAbsences();

      // 생성된 스케줄 가져오기 (실패해도 계속 진행)
      try {
        await loadGeneratedSchedules();
      } catch (scheduleError) {
        console.warn('생성된 스케줄 로드 실패 (계속 진행):', scheduleError);
        // 스케줄 로드 실패는 전체 로딩을 중단시키지 않음
      }
      
    } catch (error) {
      console.error('AI 스케줄 생성 - 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGeneratedSchedules = async () => {
    try {
      if (!currentUser?.uid) return;
      
      const response = await employerScheduleAPI.getSchedules(currentUser.uid);
      console.log('AI 스케줄 생성 - 전체 응답:', response);
      console.log('AI 스케줄 생성 - response.data:', response.data);
      console.log('AI 스케줄 생성 - response.data 타입:', typeof response.data);
      console.log('AI 스케줄 생성 - response.data 키들:', Object.keys(response.data || {}));
      
      // 백엔드 응답 구조에 따라 schedules 필드 확인
      if (response.data.schedules && Array.isArray(response.data.schedules)) {
        console.log('schedules 필드에서 데이터 로드:', response.data.schedules.length, '개');
        setGeneratedSchedules(response.data.schedules);
      } else if (response.data.data && Array.isArray(response.data.data)) {
        console.log('data 필드에서 데이터 로드:', response.data.data.length, '개');
        setGeneratedSchedules(response.data.data);
      } else if (response.data.results && Array.isArray(response.data.results)) {
        console.log('results 필드에서 데이터 로드:', response.data.results.length, '개');
        setGeneratedSchedules(response.data.results);
      } else if (Array.isArray(response.data)) {
        console.log('response.data가 직접 배열:', response.data.length, '개');
        setGeneratedSchedules(response.data);
      } else {
        console.warn('스케줄 데이터를 찾을 수 없습니다. 응답 구조:', response.data);
        setGeneratedSchedules([]);
      }
    } catch (error) {
      console.error('AI 스케줄 생성 - 스케줄 목록 로드 실패:', error);
      setGeneratedSchedules([]);
      
      // 네트워크 에러나 타임아웃 에러인 경우 사용자에게 알림
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        console.warn('백엔드 서버 연결에 실패했습니다. 서버가 실행 중인지 확인해주세요.');
      }
    }
  };

  const handleGenerateSchedule = async () => {
    // 중복 요청 방지
    if (loading) {
      console.log('이미 스케줄 생성 중입니다. 중복 요청을 무시합니다.');
      return;
    }
    
    try {
      setLoading(true);
      
      console.log('AI 스케줄 생성 시작 - departments:', departments);
      console.log('AI 스케줄 생성 시작 - employeePreferences:', employeePreferences);
      console.log('AI 스케줄 생성 시작 - confirmedAbsences:', confirmedAbsences);
      
      // AI 스케줄 생성 전 검증을 위한 콘솔 로그
      const totalRequiredStaffForValidation = departments.reduce((total, dept) => {
        const requiredStaff = dept.required_staff_count || dept.staff_count || 1;
        const workDays = Object.keys(dept.work_hours || {}).filter(day => {
          const dayConfig = dept.work_hours[day];
          if (typeof dayConfig === 'boolean' && dayConfig) return true;
          if (dayConfig && typeof dayConfig === 'object' && dayConfig.enabled) return true;
          return false;
        }).length;
        return total + (requiredStaff * workDays);
      }, 0);
      
      const dailyMinRequiredForValidation = Math.ceil(totalRequiredStaffForValidation / 7);
      
      console.log('AI 스케줄 생성 전 검증 - 파트 데이터:', departments);
      console.log('AI 스케줄 생성 전 검증 - 총 주간 필요 인원 (totalRequiredStaffForValidation):', totalRequiredStaffForValidation);
      console.log('AI 스케줄 생성 전 검증 - 일일 최소 인원 (dailyMinRequiredForValidation):', dailyMinRequiredForValidation);
      console.log('AI 스케줄 생성 전 검증 - 확정된 결근:', confirmedAbsences);
      
      // 데이터 검증
      if (!departments || departments.length === 0) {
        alert('파트 정보가 필요합니다. 먼저 파트를 생성해주세요.');
        return;
      }
       
       // 파트별 근무일 설정 확인
       const departmentsWithoutWorkDays = departments.filter(dept => {
         if (!dept.work_hours) return true;
         
         const activeDays = Object.keys(dept.work_hours).filter(day => {
           const dayConfig = dept.work_hours[day];
           if (typeof dayConfig === 'boolean') return dayConfig;
           if (dayConfig && typeof dayConfig === 'object') return dayConfig.enabled;
           return false;
         });
         
         return activeDays.length === 0;
       });
       
       if (departmentsWithoutWorkDays.length > 0) {
         const deptNames = departmentsWithoutWorkDays.map(dept => dept.department_name).join(', ');
         if (!confirm(`다음 파트들의 근무일이 설정되지 않았습니다:\n\n${deptNames}\n\n근무일을 설정하지 않으면 모든 요일에 근무하게 됩니다.\n\n계속 진행하시겠습니까?`)) {
           return;
         }
       }
      
      if (!employeePreferences || employeePreferences.length === 0) {
        alert('직원 선호도 정보가 필요합니다. 먼저 직원 선호도를 설정해주세요.');
        return;
      }
      
      // 날짜 검증 및 자동 설정
      let startDate = scheduleRequest.week_start_date;
      let endDate = scheduleRequest.week_end_date;
      
      if (!startDate || !endDate) {
        // 날짜가 없으면 자동으로 설정
        const today = new Date();
        startDate = today.toISOString().split('T')[0];
        endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        setScheduleRequest(prev => ({
          ...prev,
          week_start_date: startDate,
          week_end_date: endDate
        }));
      }
      
      // 날짜 형식 검증
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        alert('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.');
        return;
      }
      
      // 시작일이 종료일보다 늦은 경우
      if (new Date(startDate) > new Date(endDate)) {
        alert('시작일은 종료일보다 빨라야 합니다.');
        return;
      }

      // 과거 날짜 검증 - 시작일이 오늘보다 이전인 경우
      if (isPastDate(startDate)) {
        alert('과거 날짜에는 스케줄을 생성할 수 없습니다. 오늘 또는 미래 날짜를 선택해주세요.');
        return;
      }

      // 시작일이 오늘인 경우 경고
      if (isToday(startDate)) {
        if (!confirm('오늘부터 시작하는 스케줄을 생성하시겠습니까?\n\n오늘은 이미 진행 중이므로 일부 시간대는 스케줄에 반영되지 않을 수 있습니다.')) {
          return;
        }
      }
      
      // 파트 정보를 AI 스케줄 생성에 맞는 형태로 변환
       const newDepartmentStaffing = departments.map(dept => {
         // 파트별 필요 인원 수 가져오기 (파트관리에서 설정한 값)
         const requiredStaff = dept.required_staff_count || dept.staff_count || 1;
         
                   // 파트별 근무 시간 설정 (파트관리에서 설정한 값이 있으면 사용, 없으면 기본값)
          let workHours = {};
          
          if (dept.work_hours) {
            // 파트관리의 work_hours 구조를 AI 스케줄 생성에 맞게 변환
            Object.keys(dept.work_hours).forEach(day => {
              const dayConfig = dept.work_hours[day];
              
              if (typeof dayConfig === 'boolean') {
                // 기존 boolean 구조 - true인 경우만 포함
                if (dayConfig) {
                  workHours[day] = ["09:00-18:00"];
                }
                // false인 경우는 workHours에 포함시키지 않음
              } else if (dayConfig && typeof dayConfig === 'object' && dayConfig.enabled) {
                // 새로운 object 구조 (enabled: true인 경우만)
                const timeRange = `${dayConfig.start_time}-${dayConfig.end_time}`;
                workHours[day] = [timeRange];
              }
              // 비활성화된 요일은 work_hours에 포함시키지 않음
            });
          }
          
          // 사용자가 설정하지 않은 요일은 work_hours에 포함시키지 않음
          // (토,일을 기본적으로 비활성화하는 것이 아니라, 사용자 설정만 반영)
          
          console.log(`파트 "${dept.department_name}" work_hours 원본:`, dept.work_hours);
          console.log(`파트 "${dept.department_name}" work_hours 변환 후:`, workHours);
          console.log(`파트 "${dept.department_name}" 활성 근무일:`, Object.keys(workHours).filter(day => workHours[day].length > 0));
         
         // 디버깅: 파트별 근무일 설정 확인
         console.log(`파트 "${dept.department_name}" 근무일 설정:`, {
           original: dept.work_hours,
           converted: workHours,
           activeDays: Object.keys(workHours).filter(day => workHours[day].length > 0)
         });
         
         // 파트별 우선순위 (필요 인원이 많을수록 높은 우선순위)
         const priorityLevel = requiredStaff >= 3 ? 1 : requiredStaff >= 2 ? 2 : 3;
         
                   console.log(`파트 "${dept.department_name}" 설정: 필요인원 ${requiredStaff}명, 우선순위 ${priorityLevel}`);
          console.log(`파트 "${dept.department_name}" work_hours 원본:`, dept.work_hours);
          console.log(`파트 "${dept.department_name}" work_hours 변환 후:`, workHours);
         
         return {
        business_id: currentUser.uid,
           department_id: dept.department_id || dept.id || `dept_${Date.now()}_${Math.random()}`,
           department_name: dept.department_name || dept.name || '기본 파트',
           required_staff_count: requiredStaff,
           work_hours: workHours,
           priority_level: priorityLevel
         };
       });
      
      // departmentStaffing 상태 업데이트
      setDepartmentStaffing(newDepartmentStaffing);
      
      // department_staffing이 비어있지 않은지 확인
      if (newDepartmentStaffing.length === 0) {
        alert('파트 정보가 없습니다. 먼저 파트를 생성해주세요.');
        return;
      }

      // 직원 선호도를 AI 스케줄 생성에 맞는 형태로 변환 (확정된 결근 제외)
      const employeePrefs = employeePreferences
        .filter(pref => {
          // 활성 직원만 포함 (회원 탈퇴한 직원 제외)
          const workerId = pref.employee_id || pref.worker_id || pref.id;
          if (!workerId) {
            console.warn('직원 ID가 없는 선호도 제외:', pref);
            return false;
          }
          
          // 직원이 활성 상태인지 확인 (추가 검증 로직)
          const isActiveEmployee = userNames[workerId] && userNames[workerId] !== 'Unknown User';
          if (!isActiveEmployee) {
            console.warn(`비활성 직원 제외: ${workerId} (${userNames[workerId] || 'Unknown'})`);
            return false;
          }
          
          return true;
        })
        .map(pref => {
        // 직원의 선호도 데이터 분석
        const dailyPreferences = pref.daily_preferences || {};
        const preferredDays = Object.keys(dailyPreferences).filter(day => 
          dailyPreferences[day]?.selected_departments?.length > 0
        );
        
        // 선호하는 파트 ID들 추출
        const preferredDepartments = Object.values(dailyPreferences).reduce((depts, day) => {
          if (day?.selected_departments) {
            depts.push(...day.selected_departments);
          }
          return depts;
        }, []);
        
        // 중복 제거
        const uniquePreferredDepts = [...new Set(preferredDepartments)];
        
        // 선호도 점수 계산 (선택된 파트 수와 요일 수 기반)
        const preferenceScore = (preferredDays.length * 2) + (uniquePreferredDepts.length * 3);
        
        // 가용성 점수 (선호하는 요일이 많을수록 높음)
        const availabilityScore = Math.min(10, preferenceScore);
        
        // 올바른 worker_id 결정 (우선순위: employee_id > worker_id > id)
        const workerId = pref.employee_id || pref.worker_id || pref.id;
        
        if (!workerId) {
          console.error('직원 ID를 찾을 수 없습니다:', pref);
          return null; // ID가 없는 경우 제외
        }
        
        // 직원의 실제 이름 추출 (우선순위: userNames > employee_name > name > worker_id)
        let employeeName = userNames[workerId] || pref.employee_name || pref.name;
        
        // 이름이 없으면 기본값 설정
        if (!employeeName || employeeName === workerId) {
          // 이메일에서 이름 추출 시도
          if (pref.email) {
            employeeName = pref.email.split('@')[0];
          } else {
            // 최후 수단: ID의 마지막 4자리로 직원명 생성
            employeeName = `직원_${workerId.slice(-4)}`;
          }
        }
        
        console.log(`직원 ${workerId} 선호도 분석:`);
        console.log(`- 직원 이름: ${employeeName}`);
        console.log(`- 선호 요일: ${preferredDays.join(', ') || '없음'}`);
        console.log(`- 선호 파트: ${uniquePreferredDepts.length}개`);
        console.log(`- 선호도 점수: ${preferenceScore}, 가용성 점수: ${availabilityScore}`);
        console.log(`- 사용할 worker_id: ${workerId}`);
        
        return {
          worker_id: workerId, // 실제 직원 ID 사용
          employee_name: employeeName, // 실제 직원 이름 추가
          business_id: currentUser.uid,
          department_id: pref.department_id || departments[0]?.department_id || departments[0]?.id || newDepartmentStaffing[0]?.department_id,
          work_fields: pref.work_fields || ["일반"],
          preferred_off_days: pref.unavailable_days || [],
          preferred_work_days: preferredDays.length > 0 ? preferredDays : ["월", "화", "수", "목", "금", "토", "일"],
          preferred_work_hours: pref.preferred_hours || ["09:00-18:00"],
          preferred_departments: uniquePreferredDepts, // 선호하는 파트 ID들
          daily_preferences: dailyPreferences, // 요일별 상세 선호도
          min_work_hours: 4,
          max_work_hours: 8,
          availability_score: availabilityScore, // 계산된 가용성 점수
          priority_level: availabilityScore >= 8 ? 1 : availabilityScore >= 5 ? 2 : 3 // 가용성에 따른 우선순위
        };
      }).filter(Boolean); // null 값 제거
      
        // 사용 가능한 직원 수 계산 (중복 제거)
        // const availableWorkers = new Set(employeePrefs.map(pref => pref.worker_id)).size; // 이 부분은 위에서 대체됨
        console.log('사용 가능한 직원 수:', availableWorkers);
        console.log('직원 선호도 데이터:', employeePrefs);
             // employee_preferences가 비어있지 않은지 확인
       if (employeePrefs.length === 0) {
         alert('직원 선호도 정보가 없습니다. 먼저 직원 선호도를 설정해주세요.');
         return;
       }
       
      // 파트별 필요 인원과 직원 수 비교 검증
      // const totalRequiredStaff = departmentStaffing.reduce((total, dept) => { // 이 부분은 위에서 대체됨
      //   const dailyRequired = dept.required_staff_count || 1;
      //   // 사용자가 실제로 설정한 근무일 수만 계산
      //   const workDays = Object.keys(dept.work_hours || {}).filter(day => {
      //     const dayConfig = dept.work_hours[day];
      //     if (typeof dayConfig === 'boolean' && dayConfig) return true;
      //     if (dayConfig && typeof dayConfig === 'object' && dayConfig.enabled) return true;
      //         return false;
      //   }).length;
      //   const weeklyRequired = dailyRequired * workDays; // 실제 근무일 수 × 필요 인원
      //   console.log(`파트 "${dept.department_name}": 일일 필요인원 ${dailyRequired}명, 근무일 ${workDays}일, 주간 총 필요인원 ${weeklyRequired}명`);
      //   return total + weeklyRequired;
      // }, 0);
      
      console.log(`스케줄 생성 검증:`);
      console.log(`- 총 필요 인원 (주간, 실제 근무일 기준): ${totalRequiredStaff}명`);
      console.log(`- 사용 가능한 직원: ${availableWorkers}명`);
      
      // 직원 수가 부족한 경우 선호도 기반 배정 전략 사용
      if (availableWorkers < Math.ceil(totalRequiredStaff / 7)) {
        const minRequired = Math.ceil(totalRequiredStaff / 7);
        console.warn(`직원 수가 부족합니다. 선호도 기반 배정 전략을 사용합니다.`);
        console.warn(`일일 최소 필요 인원: ${minRequired}명, 현재 직원: ${availableWorkers}명`);
        
        // 경고 메시지 표시 (차단하지 않음)
        if (!confirm(`직원 수가 부족합니다!\n\n` +
                    `일일 최소 필요 인원: ${minRequired}명\n` +
                    `현재 직원 수: ${availableWorkers}명\n\n` +
                    `선호도에 가깝게 남은 자리에 배정하여 진행하시겠습니까?`)) {
          return;
        }
      }
      
      if (availableWorkers < totalRequiredStaff / 7) {
        console.log(`선호도 기반 배정 전략: 직원들이 선호하는 파트와 요일에 우선 배정됩니다.`);
      }
      
      // 모든 필수 필드가 있는지 확인
      const missingFields = employeePrefs.filter(pref => 
        !pref.worker_id || !pref.business_id || !pref.department_id
      );
      
      if (missingFields.length > 0) {
        console.error('누락된 필드가 있는 직원 선호도:', missingFields);
        alert('일부 직원 선호도 정보에 누락된 필드가 있습니다. 다시 설정해주세요.');
        return;
      }

             // 선호도 기반 배정 전략 설정
       const usePreferenceBasedAssignment = availableWorkers < totalRequiredStaff / 7;

      // 선택한 스케줄 기간 내 결근만 포함
      const startRange = new Date(scheduleRequest.week_start_date);
      const endRange = new Date(scheduleRequest.week_end_date);
      const isWithinRange = (isoDate) => {
        const d = new Date(isoDate);
        return d >= startRange && d <= endRange;
      };

      const absencesInRange = confirmedAbsences.filter(a => isWithinRange(a.date));

      // 확정된 결근 정보를 AI 스케줄 생성 요청에 포함 (기간 내만)
      const confirmedAbsencesForAI = absencesInRange.map(absence => ({
        worker_id: absence.worker_id,
        worker_name: absence.worker_name || absence.worker_email,
        date: absence.date,
        reason: absence.notes || '결근',
        status: 'confirmed'
      }));

      console.log('확정된 결근 정보 (기간 내, AI 스케줄 생성용):', confirmedAbsencesForAI);

      // 기간 확장은 하지 않음: 사용자가 설정한 기간만 사용
      const adjustedStartDate = scheduleRequest.week_start_date;
      const adjustedEndDate = scheduleRequest.week_end_date;

      // 결근 정보가 있는 직원들의 가용성 분석
      const workersWithAbsences = new Set();
      const absenceByDate = {};
      
      absencesInRange.forEach(absence => {
        workersWithAbsences.add(absence.worker_id);
        if (!absenceByDate[absence.date]) {
          absenceByDate[absence.date] = [];
        }
        absenceByDate[absence.date].push(absence);
      });
      
      console.log('결근이 있는 직원들:', Array.from(workersWithAbsences));
      console.log('날짜별 결근 정보:', absenceByDate);
      
      // 결근 정보를 고려한 직원 선호도 조정
      const adjustedEmployeePrefs = employeePreferences.map(pref => {
        const workerId = pref.worker_id;
        const workerAbsences = absencesInRange.filter(absence => absence.worker_id === workerId);
        
        if (workerAbsences.length > 0) {
          // 결근이 있는 직원의 경우 해당 날짜들을 unavailable_days에 추가
          const unavailableDates = workerAbsences.map(absence => absence.date);
          const adjustedPref = {
            ...pref,
            unavailable_dates: [...(pref.unavailable_days || []), ...unavailableDates],
            // 결근 날짜에는 선호도 점수 감소
            availability_score: Math.max(1, pref.availability_score - (workerAbsences.length * 2))
          };
          
          console.log(`직원 ${workerId} 결근 정보 반영:`, {
            original_score: pref.availability_score,
            adjusted_score: adjustedPref.availability_score,
            unavailable_dates: adjustedPref.unavailable_dates
          });
          
          return adjustedPref;
        }
        
        return pref;
      });

      // 백엔드 AI가 처리할 수 있는 가장 기본적인 구조로 완전 단순화
      // 데이터 검증 및 필터링 강화
      const validDepartments = newDepartmentStaffing.filter(dept => 
        dept.department_name && dept.required_staff_count > 0
      );
      
      // 파트 설정 데이터 상세 로깅
      console.log('🔍 파트 설정 데이터 분석:');
      console.log('- 원본 newDepartmentStaffing:', newDepartmentStaffing);
      console.log('- 필터링된 validDepartments:', validDepartments);
      
      validDepartments.forEach((dept, index) => {
        console.log(`  파트 ${index + 1}: ${dept.department_name}`);
        console.log(`    - required_staff_count: ${dept.required_staff_count}`);
        console.log(`    - work_hours 존재: ${!!dept.work_hours}`);
        console.log(`    - work_hours 타입: ${typeof dept.work_hours}`);
        if (dept.work_hours) {
          console.log(`    - work_hours 키들: ${Object.keys(dept.work_hours)}`);
          console.log(`    - work_hours 내용:`, dept.work_hours);
        } else {
          console.log(`    - work_hours: 없음 (기본값 사용 예정)`);
        }
      });
      
      // 직원 선호도 데이터 상세 분석
      console.log('🔍 직원 선호도 데이터 분석:');
      adjustedEmployeePrefs.forEach((pref, index) => {
        console.log(`직원 ${index + 1}:`, {
          worker_id: pref.worker_id,
          employee_name: pref.employee_name,
          availability_score: pref.availability_score,
          has_name: !!pref.employee_name,
          has_score: pref.availability_score > 0,
          score_type: typeof pref.availability_score,
          score_value: pref.availability_score
        });
      });
      
      // 필터링 조건 완화: employee_name이 있거나 worker_id가 있으면 포함
      const validEmployees = adjustedEmployeePrefs.filter(pref => 
        (pref.employee_name && pref.employee_name.trim() !== '') || 
        (pref.worker_id && pref.worker_id.trim() !== '')
      );
      
      const validAbsences = confirmedAbsences.filter(absence => 
        absence.date && (absence.worker_name || absence.worker_email)
      );
      
      console.log('🔍 데이터 검증 결과:');
      console.log('- 유효한 파트:', validDepartments.length, '/', newDepartmentStaffing.length);
      console.log('- 유효한 직원:', validEmployees.length, '/', adjustedEmployeePrefs.length);
      console.log('- 유효한 결근:', validAbsences.length, '/', confirmedAbsences.length);
      
      // 직원 정보가 없는 경우 경고
      if (validEmployees.length === 0) {
        console.warn('⚠️ 유효한 직원 정보가 없습니다!');
        console.log('원본 직원 선호도:', employeePreferences);
        console.log('조정된 직원 선호도:', adjustedEmployeePrefs);
        alert('직원 선호도 정보가 없습니다. 직원 정보를 확인해주세요.');
        return;
      }
      
      // 백엔드가 기대하는 정확한 필드명과 구조로 맞춤
      const aiScheduleRequest = {
        business_id: currentUser.uid,
        week_start_date: adjustedStartDate,
        week_end_date: adjustedEndDate,
        department_staffing: validDepartments.map(dept => ({
          business_id: currentUser.uid,
          department_id: dept.department_id || `dept_${Date.now()}_${Math.random()}`,
          department_name: dept.department_name,
          required_staff_count: dept.required_staff_count,
          work_hours: dept.work_hours || (() => {
            // 파트 설정에서 work_hours가 없으면 기본값 설정
            // 사용자가 설정한 요일만 포함 (기본적으로 월~금)
            const defaultWorkHours = {};
            const workingDays = ["월", "화", "수", "목", "금"];
            workingDays.forEach(day => {
              defaultWorkHours[day] = ["09:00-18:00"];
            });
            console.log('✅ 기본 work_hours 설정:', defaultWorkHours);
            return defaultWorkHours;
          })(),
          priority_level: 3
        })),
        employee_preferences: validEmployees.map(emp => ({
          worker_id: emp.worker_id,
          business_id: currentUser.uid,
          department_id: emp.department_id || `dept_${Date.now()}_${Math.random()}`,
          work_fields: emp.work_fields || ["일반"],
          preferred_off_days: emp.preferred_off_days || [],
          preferred_work_days: emp.preferred_work_days || ["월", "화", "수", "목", "금"],
          preferred_work_hours: emp.preferred_work_hours || ["09:00-18:00"],
          min_work_hours: emp.min_work_hours || 4,
          max_work_hours: emp.max_work_hours || 8,
          availability_score: emp.availability_score || 5,
          priority_level: 3
        })),
         schedule_constraints: {
          // AI 스케줄 생성 지시사항
          ai_instructions: {
            priority_focus: "결근 정보를 최우선으로 고려하여 스케줄 생성",
            pattern_avoidance: "요일 기반 반복 패턴 완전 차단",
            absence_handling: "결근 직원은 해당 날짜에 절대 배정 금지",
            workload_distribution: "가용 직원들 간에 업무량 균등 분배",
            schedule_variety: "각 날짜마다 완전히 다른 직원 조합 사용"
          },
          // 제약사항 강화
          enforce_rest_hours: true,
          limit_consecutive_days: true,
          ensure_weekly_rest: true,
          limit_daily_hours: true,
          limit_weekly_hours: true,
          prioritize_preferences: true,
          balance_workload: true,
          limit_employee_assignments: true,
          max_consecutive_assignments: true
        }
      };
      
      // 결근 정보를 더 체계적으로 처리하여 schedule_constraints에 추가
      if (validAbsences.length > 0) {
        // 결근 정보를 날짜별로 그룹화
        const absencesByDate = {};
        validAbsences.forEach(absence => {
          if (!absencesByDate[absence.date]) {
            absencesByDate[absence.date] = [];
          }
          absencesByDate[absence.date].push({
            employee_id: absence.worker_id,
            reason: absence.notes || '결근'
          });
        });

        // AI가 더 쉽게 이해할 수 있는 구조로 변환
        aiScheduleRequest.schedule_constraints.absences = Object.entries(absencesByDate).map(([date, absences]) => ({
          date: date,
          unavailable_employees: absences.map(absence => absence.employee_id),
          total_unavailable: absences.length,
          reasons: absences.map(absence => absence.reason)
        }));

        // 결근 정보 요약 추가
        aiScheduleRequest.schedule_constraints.absence_summary = {
          total_absence_days: Object.keys(absencesByDate).length,
          total_absence_instances: validAbsences.length,
          affected_employees: [...new Set(validAbsences.map(a => a.worker_id))],
          date_range: {
            start: Math.min(...Object.keys(absencesByDate).map(d => new Date(d).getTime())),
            end: Math.max(...Object.keys(absencesByDate).map(d => new Date(d).getTime()))
          }
        };

        console.log('📋 체계화된 결근 정보:', {
          날짜별_결근: absencesByDate,
          요약: aiScheduleRequest.schedule_constraints.absence_summary
        });
      }

      // 백엔드로 전송될 데이터 상세 로깅
      console.log('🚀 백엔드로 전송될 AI 스케줄 생성 요청:');
      console.log('- business_id:', aiScheduleRequest.business_id);
      console.log('- week_start_date:', aiScheduleRequest.week_start_date);
      console.log('- week_end_date:', aiScheduleRequest.week_end_date);
      console.log('- department_staffing:', aiScheduleRequest.department_staffing.length, '개 부서');
      console.log('- employee_preferences:', aiScheduleRequest.employee_preferences.length, '명 직원');
      console.log('- schedule_constraints.absences:', aiScheduleRequest.schedule_constraints.absences ? aiScheduleRequest.schedule_constraints.absences.length : 0, '건');
      
      // 부서별 필요 인원 상세 로깅
      console.log('🏢 전송되는 부서별 필요 인원:');
      aiScheduleRequest.department_staffing.forEach((dept, index) => {
        console.log(`  ${index + 1}. ${dept.department_name} - ${dept.required_staff_count}명`);
        console.log(`     work_hours:`, dept.work_hours);
        console.log(`     work_hours 타입:`, typeof dept.work_hours);
        console.log(`     work_hours 키들:`, Object.keys(dept.work_hours || {}));
        
        // work_hours의 각 요일별 내용 상세 분석
        if (dept.work_hours && typeof dept.work_hours === 'object') {
          Object.entries(dept.work_hours).forEach(([day, hours]) => {
            console.log(`       ${day}요일:`, {
              hours: hours,
              타입: typeof hours,
              배열여부: Array.isArray(hours),
              길이: Array.isArray(hours) ? hours.length : 'N/A',
              내용: hours
            });
          });
        }
      });
      
      // 직원 선호도 상세 로깅
      console.log('👥 전송되는 직원 선호도:');
      aiScheduleRequest.employee_preferences.forEach((emp, index) => {
        console.log(`  ${index + 1}. ${emp.worker_id} - 부서: ${emp.department_id} - 가용성 점수: ${emp.availability_score}`);
      });
      
      // 결근 정보 상세 로깅 (체계화된 구조)
      if (aiScheduleRequest.schedule_constraints.absences && aiScheduleRequest.schedule_constraints.absences.length > 0) {
        console.log('📋 전송되는 체계화된 결근 정보:');
        aiScheduleRequest.schedule_constraints.absences.forEach((dateAbsence, index) => {
          console.log(`  ${index + 1}. ${dateAbsence.date}:`);
          console.log(`     - 결근 직원: ${dateAbsence.unavailable_employees.join(', ')}`);
          console.log(`     - 총 결근 인원: ${dateAbsence.total_unavailable}명`);
          console.log(`     - 사유: ${dateAbsence.reasons.join(', ')}`);
        });
        
        console.log('📊 결근 정보 요약:');
        console.log(`  - 총 결근 일수: ${aiScheduleRequest.schedule_constraints.absence_summary.total_absence_days}일`);
        console.log(`  - 총 결근 건수: ${aiScheduleRequest.schedule_constraints.absence_summary.total_absence_instances}건`);
        console.log(`  - 영향받는 직원: ${aiScheduleRequest.schedule_constraints.absence_summary.affected_employees.join(', ')}`);
      } else {
        console.log('📋 결근 정보 없음');
      }
      
      // 데이터 구조 검증
      console.log('📋 데이터 구조 검증:');
      console.log('- 모든 필드가 문자열 또는 숫자:', Object.entries(aiScheduleRequest).every(([key, value]) => 
        typeof value === 'string' || typeof value === 'number'
      ));
      console.log('- 중첩 객체 없음:', Object.entries(aiScheduleRequest).every(([key, value]) => 
        typeof value !== 'object' || value === null
      ));
      
      // 전체 요청 데이터
      console.log('📦 전체 요청 데이터:', JSON.stringify(aiScheduleRequest, null, 2));
      
      // 결근 정보 기반 최종 검증 및 강화
      // dailyAbsenceAnalysis를 함수 외부에서도 사용할 수 있도록 변수 스코프 조정
      let dailyAbsenceAnalysis = {};
      const finalValidation = (() => {
        const issues = [];
        const warnings = [];
        
        // 결근 정보 검증
        if (confirmedAbsences.length > 0) {
          const absenceDates = [...new Set(confirmedAbsences.map(a => a.date))];
          const workersWithAbsences = [...new Set(confirmedAbsences.map(a => a.worker_id))];
          
          console.log('결근 정보 최종 검증:', {
            absenceDates,
            workersWithAbsences,
            totalAbsences: confirmedAbsences.length
          });
          
          // 결근 정보는 이미 aiScheduleRequest.absences에 포함되어 있음
          console.log('결근 정보가 absences 필드에 포함됨:', confirmedAbsences.length, '건');
          
          // 각 날짜별 결근 정보 상세 분석
          dailyAbsenceAnalysis = {}; // 외부 변수에 할당
          absenceDates.forEach(date => {
            const dayAbsences = confirmedAbsences.filter(absence => absence.date === date);
            const absentWorkers = dayAbsences.map(absence => ({
              worker_id: absence.worker_id,
              worker_name: absence.worker_name || absence.worker_email,
              reason: absence.notes || '결근'
            }));
            
            const availableWorkers = employeePreferences.filter(pref => 
              !absentWorkers.some(absence => absence.worker_id === pref.worker_id)
            );
            
            dailyAbsenceAnalysis[date] = {
              absent_workers: absentWorkers,
              available_workers: availableWorkers.length,
              total_workers: employeePreferences.length,
              coverage_ratio: Math.round((availableWorkers.length / employeePreferences.length) * 100)
            };
          });
          
          console.log('📅 날짜별 결근 정보 상세 분석:', dailyAbsenceAnalysis);
          
          // 결근이 많은 날짜 경고
          Object.entries(dailyAbsenceAnalysis).forEach(([date, analysis]) => {
            if (analysis.coverage_ratio < 50) {
              warnings.push(`${date}: 가용 직원 ${analysis.coverage_ratio}% (${analysis.available_workers}/${analysis.total_workers}명)`);
            }
          });
          
          warnings.push(`결근 정보 ${confirmedAbsences.length}건이 반영됩니다.`);
        }
        
        // 직원 가용성 검증
        const totalWorkDays = Math.ceil((new Date(adjustedEndDate) - new Date(adjustedStartDate)) / (24 * 60 * 60 * 1000)) + 1;
        const minWorkersPerDay = Math.ceil(totalRequiredStaff / totalWorkDays);
        
        if (availableWorkers < minWorkersPerDay) {
          issues.push(`직원 수 부족: 일일 최소 ${minWorkersPerDay}명 필요, 현재 ${availableWorkers}명`);
        }
        
        return { issues, warnings, dailyAbsenceAnalysis: dailyAbsenceAnalysis || {} };
      })();
      
      // 검증 문제가 있으면 경고
      if (finalValidation.issues.length > 0) {
        const issueMessage = finalValidation.issues.join('\n');
        if (!confirm(`다음 문제가 발견되었습니다:\n\n${issueMessage}\n\n계속 진행하시겠습니까?`)) {
          return;
        }
      }
      
      // 최종 데이터 검증
      if (!aiScheduleRequest.business_id) {
        alert('비즈니스 ID가 없습니다.');
        return;
      }
      
      if (!aiScheduleRequest.week_start_date || !aiScheduleRequest.week_end_date) {
        alert('시작일과 종료일이 설정되지 않았습니다.');
        return;
      }
      
      // 기본 데이터 검증
      if (!aiScheduleRequest.business_id) {
        alert('비즈니스 ID가 없습니다.');
        return;
      }
      
      if (!aiScheduleRequest.week_start_date || !aiScheduleRequest.week_end_date) {
        alert('시작일과 종료일이 설정되지 않았습니다.');
        return;
      }
      
      if (aiScheduleRequest.department_staffing.length === 0) {
        alert('부서별 필요 인원 정보가 없습니다.');
        return;
      }
      
      if (aiScheduleRequest.employee_preferences.length === 0) {
        alert('직원 선호도 정보가 없습니다.');
        return;
      }
      
      // 결근 정보 상태 확인
      if (aiScheduleRequest.schedule_constraints.absences && aiScheduleRequest.schedule_constraints.absences.length > 0) {
        console.log('✅ 결근 정보가 포함되어 스케줄이 생성됩니다.');
      } else {
        console.log('⚠️ 결근 정보가 없습니다. 모든 직원이 가용합니다.');
      }
      
      console.log('✅ 모든 데이터 검증 통과');
      
      console.log('데이터 검증 완료, API 호출 시작...');

      // AI 스케줄 생성 API 호출
      console.log('🚀 API 호출 시작...');
      console.log('📡 요청 URL:', '/ai/schedule/generate');
      console.log('📤 요청 데이터 타입:', typeof aiScheduleRequest);
      console.log('📤 요청 데이터 크기:', JSON.stringify(aiScheduleRequest).length, 'bytes');
      console.log('📤 요청 데이터 내용:', JSON.stringify(aiScheduleRequest, null, 2));
      
      const response = await employerScheduleAPI.generateSchedule(aiScheduleRequest);
      console.log('AI 스케줄 생성 성공:', response.data);
       console.log('AI 스케줄 생성 - 전체 응답 구조:', response);
       console.log('AI 스케줄 생성 - response.data 타입:', typeof response.data);
       console.log('AI 스케줄 생성 - response.data 키들:', Object.keys(response.data || {}));
      
      // 백엔드 응답 구조 상세 분석
      console.log('🔍 백엔드 응답 상세 분석:');
      if (response.data) {
        console.log('- response.data 존재:', !!response.data);
        console.log('- response.data 타입:', typeof response.data);
        console.log('- response.data 키들:', Object.keys(response.data));
        
        // 각 키별 상세 내용 분석
        Object.entries(response.data).forEach(([key, value]) => {
          console.log(`  - ${key}:`, {
            type: typeof value,
            isArray: Array.isArray(value),
            length: Array.isArray(value) ? value.length : 'N/A',
            value: value
          });
        });
        
        // schedule 필드가 있는지 특별히 확인
        if (response.data.schedule) {
          console.log('🔍 schedule 필드 상세 분석:');
          console.log('- schedule 타입:', typeof response.data.schedule);
          console.log('- schedule 키들:', Object.keys(response.data.schedule || {}));
          
          if (response.data.schedule && typeof response.data.schedule === 'object') {
            Object.entries(response.data.schedule).forEach(([key, value]) => {
              console.log(`  - schedule.${key}:`, {
                type: typeof value,
                isArray: Array.isArray(value),
                length: Array.isArray(value) ? value.length : 'N/A',
                value: value
              });
            });
          }
        }
        
        // 요일별 스케줄 데이터 분석
        if (response.data.schedule && typeof response.data.schedule === 'object') {
          console.log('📅 요일별 스케줄 데이터 분석:');
          const scheduleKeys = Object.keys(response.data.schedule);
          console.log('- 포함된 요일들:', scheduleKeys);
          console.log('- 토요일 포함 여부:', scheduleKeys.includes('토'));
          console.log('- 일요일 포함 여부:', scheduleKeys.includes('일'));
          
          // 각 요일별 상세 내용
          scheduleKeys.forEach(day => {
            const dayData = response.data.schedule[day];
            console.log(`  - ${day}요일:`, {
              타입: typeof dayData,
              배열여부: Array.isArray(dayData),
              길이: Array.isArray(dayData) ? dayData.length : 'N/A',
              내용: dayData
            });
          });
        }
        
        // 전체 응답 데이터를 JSON으로 출력
        console.log('📦 전체 백엔드 응답 데이터:');
        console.log(JSON.stringify(response.data, null, 2));
      }
       
       // 백엔드 응답 구조에 따라 스케줄 데이터 추출
       let scheduleData = response.data;
       if (response.data && typeof response.data === 'object') {
        // 백엔드 응답 구조: { message, schedule_id, schedule }
        if (response.data.schedule && typeof response.data.schedule === 'object') {
          console.log('✅ schedule 필드에서 데이터 추출');
          scheduleData = response.data.schedule;
        } else if (response.data.schedules && Array.isArray(response.data.schedules) && response.data.schedules.length > 0) {
          console.log('✅ schedules 필드에서 데이터 추출:', response.data.schedules.length, '개');
           scheduleData = response.data.schedules[0];
         } else if (response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
          console.log('✅ data 필드에서 데이터 추출:', response.data.data.length, '개');
           scheduleData = response.data.data[0];
         } else if (response.data.results && Array.isArray(response.data.results) && response.data.results.length > 0) {
          console.log('✅ results 필드에서 데이터 추출:', response.data.results.length, '개');
           scheduleData = response.data.results[0];
        } else if (response.data.generated_schedule && typeof response.data.generated_schedule === 'object') {
          console.log('✅ generated_schedule 필드에서 데이터 추출');
          scheduleData = response.data.generated_schedule;
        } else {
          console.warn('⚠️ 스케줄 데이터를 찾을 수 없음. response.data를 직접 사용');
          scheduleData = response.data;
         }
       }
       
       console.log('설정할 스케줄 데이터:', scheduleData);
      console.log('🔍 scheduleData 상세 분석:');
      console.log('- scheduleData 타입:', typeof scheduleData);
      console.log('- scheduleData 키들:', Object.keys(scheduleData || {}));
      console.log('- scheduleData 내용:', JSON.stringify(scheduleData, null, 2));
      
      // 스케줄 데이터 유효성 검증
      if (!scheduleData || typeof scheduleData !== 'object') {
        console.error('❌ 스케줄 데이터가 유효하지 않습니다:', scheduleData);
        alert('스케줄 데이터가 유효하지 않습니다. 백엔드 응답을 확인해주세요.');
        return;
      }
      
      // 백엔드 응답 구조에 맞게 검증
      // 백엔드는 { message, schedule_id, schedule } 형태로 응답
      // schedule 필드 안에 실제 스케줄 데이터가 있음
      console.log('🔍 검증 전 scheduleData 분석:');
      console.log('- scheduleData.schedule_data 존재:', !!scheduleData.schedule_data);
      console.log('- scheduleData.week_start_date 존재:', !!scheduleData.week_start_date);
      console.log('- scheduleData.week_end_date 존재:', !!scheduleData.week_end_date);
      
      // 백엔드 응답 구조를 더 유연하게 처리
      // schedule_data나 week_start_date가 없어도 다른 방법으로 처리 시도
      console.log('🔍 백엔드 응답 구조 분석 결과:');
      console.log('- scheduleData 키들:', Object.keys(scheduleData || {}));
      console.log('- scheduleData 내용:', scheduleData);
      
      // 백엔드가 성공 메시지만 보낸 경우도 처리
      if (scheduleData.message && scheduleData.schedule_id) {
        console.log('✅ 백엔드에서 성공 메시지와 스케줄 ID를 제공했습니다');
        console.log('- 메시지:', scheduleData.message);
        console.log('- 스케줄 ID:', scheduleData.schedule_id);
      }
      
      // 백엔드 응답 구조에 따라 스케줄 데이터 추출
      let finalScheduleData = null;
      let scheduleDataKeys = [];
      
      // 다양한 백엔드 응답 구조 처리
      if (scheduleData.schedule_data) {
        console.log('✅ schedule_data 필드에서 스케줄 데이터 추출');
        finalScheduleData = scheduleData.schedule_data;
        scheduleDataKeys = Object.keys(finalScheduleData);
      } else if (scheduleData.week_start_date && scheduleData.week_end_date) {
        console.log('✅ week_start_date/week_end_date 기반으로 스케줄 데이터 구성');
        // 백엔드가 날짜 범위만 제공한 경우, 파트 설정에 맞는 요일만 포함
        const workingDays = [];
        
        // department_staffing에서 work_hours가 설정된 요일만 추출
        if (aiScheduleRequest.department_staffing) {
          aiScheduleRequest.department_staffing.forEach(dept => {
            if (dept.work_hours && typeof dept.work_hours === 'object') {
              Object.keys(dept.work_hours).forEach(day => {
                if (dept.work_hours[day] && Array.isArray(dept.work_hours[day]) && dept.work_hours[day].length > 0) {
                  if (!workingDays.includes(day)) {
                    workingDays.push(day);
                  }
                }
              });
            }
          });
        }
        
        // work_hours가 설정된 요일이 없으면 기본 요일 사용
        if (workingDays.length === 0) {
          workingDays.push("월", "화", "수", "목", "금");
        }
        
        finalScheduleData = {};
        workingDays.forEach(day => {
          finalScheduleData[day] = [];
        });
        
        scheduleDataKeys = Object.keys(finalScheduleData);
        console.log('✅ 파트 설정에 맞는 요일만 포함:', workingDays);
      } else if (scheduleData.message && scheduleData.schedule_id) {
        console.log('✅ message/schedule_id 기반으로 기본 스케줄 데이터 구성');
        // 백엔드가 성공 메시지만 제공한 경우, 파트 설정에 맞는 요일만 포함
        // 사용자가 설정한 파트의 work_hours가 있는 요일만 포함
        const workingDays = [];
        
        // department_staffing에서 work_hours가 설정된 요일만 추출
        if (aiScheduleRequest.department_staffing) {
          aiScheduleRequest.department_staffing.forEach(dept => {
            if (dept.work_hours && typeof dept.work_hours === 'object') {
              Object.keys(dept.work_hours).forEach(day => {
                if (dept.work_hours[day] && Array.isArray(dept.work_hours[day]) && dept.work_hours[day].length > 0) {
                  if (!workingDays.includes(day)) {
                    workingDays.push(day);
                  }
                }
              });
            }
          });
        }
        
        // work_hours가 설정된 요일이 없으면 기본 요일 사용
        if (workingDays.length === 0) {
          workingDays.push("월", "화", "수", "목", "금");
        }
        
        finalScheduleData = {};
        workingDays.forEach(day => {
          finalScheduleData[day] = [];
        });
        
        scheduleDataKeys = Object.keys(finalScheduleData);
        console.log('✅ 파트 설정에 맞는 요일만 포함:', workingDays);
      } else if (scheduleData.schedule && typeof scheduleData.schedule === 'object') {
        console.log('✅ schedule 필드에서 스케줄 데이터 추출');
        finalScheduleData = scheduleData.schedule;
        scheduleDataKeys = Object.keys(finalScheduleData);
        
        // 백엔드에서 받은 요일들을 파트 설정에 맞게 필터링
        console.log('🔍 백엔드 응답 요일 필터링:');
        console.log('- 원본 요일들:', Object.keys(finalScheduleData));
        
        // 파트 설정에서 work_hours가 있는 요일만 필터링
        const allowedDays = new Set();
        if (aiScheduleRequest.department_staffing) {
          aiScheduleRequest.department_staffing.forEach(dept => {
            if (dept.work_hours && typeof dept.work_hours === 'object') {
              Object.keys(dept.work_hours).forEach(day => {
                if (dept.work_hours[day] && Array.isArray(dept.work_hours[day]) && dept.work_hours[day].length > 0) {
                  allowedDays.add(day);
                }
              });
            }
          });
        }
        
        // 허용되지 않은 요일 제거
        const filteredScheduleData = {};
        Object.keys(finalScheduleData).forEach(day => {
          if (allowedDays.has(day)) {
            filteredScheduleData[day] = finalScheduleData[day];
            console.log(`✅ ${day}요일 유지 (파트 설정에 포함)`);
          } else {
            console.log(`❌ ${day}요일 제거 (파트 설정에 없음)`);
          }
        });
        
        finalScheduleData = filteredScheduleData;
        scheduleDataKeys = Object.keys(finalScheduleData);
        console.log('✅ 필터링 후 요일들:', scheduleDataKeys);
        
      } else if (scheduleData.schedules && Array.isArray(scheduleData.schedules) && scheduleData.schedules.length > 0) {
        console.log('✅ schedules 배열에서 첫 번째 스케줄 데이터 추출');
        finalScheduleData = scheduleData.schedules[0];
        scheduleDataKeys = Object.keys(finalScheduleData);
      } else if (scheduleData.data && Array.isArray(scheduleData.data) && scheduleData.data.length > 0) {
        console.log('✅ data 배열에서 첫 번째 스케줄 데이터 추출');
        finalScheduleData = scheduleData.data[0];
        scheduleDataKeys = Object.keys(finalScheduleData);
      } else {
        console.log('⚠️ 알 수 없는 백엔드 응답 구조, scheduleData 자체를 사용');
        finalScheduleData = scheduleData;
        scheduleDataKeys = Object.keys(finalScheduleData);
      }
      
      console.log('🔍 최종 스케줄 데이터 분석:');
      console.log('- finalScheduleData 타입:', typeof finalScheduleData);
      console.log('- finalScheduleData 키들:', scheduleDataKeys);
      console.log('- finalScheduleData 내용:', JSON.stringify(finalScheduleData, null, 2));
      
      if (scheduleDataKeys.length === 0) {
        console.error('❌ 스케줄 데이터에 내용이 없습니다');
        alert('생성된 스케줄에 내용이 없습니다. 백엔드 AI 모델을 확인해주세요.');
        return;
      }
      
      // 생성된 스케줄을 상태에 저장
      // 백엔드 응답 구조에 맞게 저장
      const scheduleToSave = {
        week_start_date: scheduleData.week_start_date || scheduleRequest.week_start_date,
        week_end_date: scheduleData.week_end_date || scheduleRequest.week_end_date,
        schedule_data: finalScheduleData,
        total_workers: scheduleData.total_workers || 0,
        total_hours: scheduleData.total_hours || 0,
        satisfaction_score: scheduleData.satisfaction_score || 0.0,
        // 중복 표시 방지를 위한 플래그 추가
        is_ai_generated: true,
        generated_at: new Date().toISOString()
      };
      
      setCurrentSchedule(scheduleToSave);
      
      // 성공 메시지 표시
      alert('AI 스케줄이 성공적으로 생성되었습니다! 🎉\n\n결근 정보가 반영된 최적의 스케줄이 생성되었습니다.');
      
      // 스케줄 데이터 구조 디버깅
      console.log('생성된 스케줄 데이터 구조:', {
        scheduleData,
        schedule_data: scheduleData.schedule_data,
        schedule_data_keys: Object.keys(scheduleData.schedule_data || {}),
        week_start_date: scheduleData.week_start_date,
        week_end_date: scheduleData.week_end_date
      });
      
      console.log('✅ 스케줄 데이터 검증 통과:', {
        totalDates: scheduleDataKeys.length,
        dateRange: `${scheduleDataKeys[0]} ~ ${scheduleDataKeys[scheduleDataKeys.length - 1]}`,
        sampleDates: scheduleDataKeys.slice(0, 5)
      });
      
      // 날짜별 스케줄 생성 확인 및 품질 분석
      if (scheduleData.schedule_data) {
        const dates = Object.keys(scheduleData.schedule_data);
        const uniquePatterns = new Set();
        const dailyAssignments = {};
        
        dates.forEach(date => {
          const daySchedule = scheduleData.schedule_data[date];
          const pattern = JSON.stringify(daySchedule);
          uniquePatterns.add(pattern);
          
          // 각 날짜별 배정된 직원 추출
          const assignedWorkers = new Set();
          daySchedule.forEach(dept => {
            const workers = dept.assigned_employees || dept.employees || dept.worker_assignments || [];
            // workers가 배열인지 확인 후 forEach 실행
            if (Array.isArray(workers)) {
              workers.forEach(worker => {
                const workerId = worker.worker_id || worker.employee_id || worker.id;
                if (workerId) assignedWorkers.add(workerId);
              });
            } else {
              console.warn('workers가 배열이 아닙니다:', workers);
            }
          });
          dailyAssignments[date] = Array.from(assignedWorkers);
        });
        
        // 스케줄 품질 분석
        const totalDates = dates.length;
        const uniquePatternsCount = uniquePatterns.size;
        const varietyScore = Math.round((uniquePatternsCount / totalDates) * 100);
        const isRepeating = uniquePatternsCount < totalDates;
        
        // 직원별 근무 일수 분석
        const workerWorkDays = {};
        Object.values(dailyAssignments).forEach(workers => {
          workers.forEach(workerId => {
            workerWorkDays[workerId] = (workerWorkDays[workerId] || 0) + 1;
          });
        });
        
        const workDayStats = Object.values(workerWorkDays);
        const avgWorkDays = Math.round(workDayStats.reduce((a, b) => a + b, 0) / workDayStats.length);
        const maxWorkDays = Math.max(...workDayStats);
        const minWorkDays = Math.min(...workDayStats);
        
        console.log('📊 스케줄 품질 분석 결과:', {
          totalDates,
          uniquePatterns: uniquePatternsCount,
          varietyScore: `${varietyScore}%`,
          isRepeating,
          workerDistribution: {
            totalWorkers: Object.keys(workerWorkDays).length,
            averageWorkDays: avgWorkDays,
            maxWorkDays,
            minWorkDays,
            balanceScore: Math.round((minWorkDays / maxWorkDays) * 100)
          },
          sampleDates: dates.slice(0, 5),
          patterns: Array.from(uniquePatterns).slice(0, 3)
        });
        
        // 사용자에게 품질 피드백 제공
        let qualityMessage = '';
        if (varietyScore >= 90) {
          qualityMessage = `✅ 우수한 스케줄 품질 (${varietyScore}%) - 각 날짜별로 고유한 스케줄이 생성되었습니다.`;
        } else if (varietyScore >= 70) {
          qualityMessage = `⚠️ 보통 스케줄 품질 (${varietyScore}%) - 일부 날짜에 유사한 패턴이 있습니다.`;
        } else {
          qualityMessage = `❌ 낮은 스케줄 품질 (${varietyScore}%) - 많은 날짜에 동일한 패턴이 반복됩니다.`;
        }
        
        console.log(qualityMessage);
        
        if (isRepeating) {
          console.warn('⚠️ 경고: 동일한 스케줄 패턴이 반복되고 있습니다!');
          console.warn('결근 정보가 제대로 반영되지 않았을 수 있습니다.');
          console.warn('백엔드 AI 모델의 프롬프팅을 확인해주세요.');
        }
      }
      
      // 스케줄 목록 새로고침
      await loadGeneratedSchedules();
      
      // 생성된 스케줄 탭으로 자동 전환
      setActiveTab('schedules');
      
      // 성공 메시지
      const startDateObj = new Date(adjustedStartDate);
      const endDateObj = new Date(adjustedEndDate);
      const totalWeeks = Math.ceil((endDateObj - startDateObj) / (7 * 24 * 60 * 60 * 1000));
      
      alert(`AI 스케줄이 성공적으로 생성되었습니다!\n\n` +
            `📅 생성된 스케줄 기간: ${adjustedStartDate} ~ ${adjustedEndDate}\n` +
            `📊 총 ${totalWeeks}주간의 스케줄\n` +
            `👥 결근 정보 반영: ${confirmedAbsences.length}건\n` +
            `\n생성된 스케줄 탭으로 이동합니다.`);
      
    } catch (error) {
      console.error('스케줄 생성 실패:', error);
      
      // 백엔드 에러 응답 상세 분석
      if (error.response) {
        console.error('🔍 백엔드 에러 응답 상세:');
        console.error('- 상태 코드:', error.response.status);
        console.error('- 상태 메시지:', error.response.statusText);
        console.error('- 에러 데이터 타입:', typeof error.response.data);
        console.error('- 에러 데이터:', error.response.data);
        
        // 에러 데이터의 상세 내용 출력
        if (error.response.data && typeof error.response.data === 'object') {
          console.error('- 에러 데이터 키들:', Object.keys(error.response.data));
          Object.entries(error.response.data).forEach(([key, value]) => {
            console.error(`  - ${key}:`, value);
          });
        }
        
        // 백엔드에서 전달한 구체적인 에러 메시지
        if (error.response.data && error.response.data.detail) {
          alert(`스케줄 생성 실패: ${error.response.data.detail}`);
        } else if (error.response.data && error.response.data.message) {
          alert(`스케줄 생성 실패: ${error.response.data.message}`);
        } else if (error.response.data && error.response.data.error) {
          alert(`스케줄 생성 실패: ${error.response.data.error}`);
        } else {
          alert(`스케줄 생성 실패: 백엔드 에러 (${error.response.status})`);
        }
      } else if (error.request) {
        console.error('🔍 네트워크 에러:', error.request);
        alert('네트워크 연결에 실패했습니다. 인터넷 연결을 확인해주세요.');
      } else {
        console.error('🔍 기타 에러:', error.message);
        alert(`스케줄 생성 실패: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceClick = (preference) => {
    setSelectedPreference(preference);
    setShowPreferenceModal(true);
  };

  const closePreferenceModal = () => {
    setShowPreferenceModal(false);
    setSelectedPreference(null);
  };

  const getDepartmentName = (departmentId) => {
    const department = departments.find(dept => dept.department_id === departmentId);
    return department ? department.department_name : '알 수 없는 파트';
  };

  const loadUserNames = async (preferences) => {
    try {
      const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      console.log('직원 이름 로드 시작 - preferences:', preferences);
      
      const names = {};
      for (const pref of preferences) {
        try {
          // 직원 ID를 다양한 필드에서 찾기 (우선순위: employee_id > worker_id > id)
          const userId = pref.employee_id || pref.worker_id || pref.id;
          console.log(`직원 ID 확인: ${userId} (pref:`, pref, ')');
          
          if (!userId) {
            console.warn('사용자 ID가 없습니다:', pref);
            continue;
          }
          
          // 먼저 users 컬렉션에서 찾기
          let userData = null;
          try {
            console.log(`users 컬렉션 조회 시도: ${userId}`);
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              userData = userDoc.data();
              console.log(`users 컬렉션에서 직원 정보 찾음: ${userId}`, userData);
            } else {
              console.log(`users 컬렉션에서 직원 정보 없음: ${userId}`);
            }
          } catch (error) {
            console.log(`users 컬렉션 조회 실패: ${userId}`, error);
          }
          
          // users에서 찾지 못한 경우, employee_preferences에서 추가 정보 찾기
          if (!userData) {
            console.log(`users에서 찾지 못함, employee_preferences에서 추가 정보 확인: ${userId}`);
            // employee_preferences에서 같은 ID를 가진 다른 문서 찾기
            const additionalQuery = query(
              collection(db, 'employee_preferences'),
              where('employee_id', '==', userId)
            );
            const additionalSnapshot = await getDocs(additionalQuery);
            
            if (!additionalSnapshot.empty) {
              const additionalData = additionalSnapshot.docs[0].data();
              console.log(`employee_preferences에서 추가 정보 찾음:`, additionalData);
              userData = additionalData;
            } else {
              console.log(`employee_preferences에서도 추가 정보 없음: ${userId}`);
            }
          }
          
          // 이름 설정 (우선순위: employee_name > name > display_name > email > worker_id)
          if (userData) {
            names[userId] = userData.employee_name || 
                           userData.name || 
                           userData.display_name || 
                           userData.email?.split('@')[0] || 
                           `직원_${userId.slice(-4)}`;
          } else {
            // 기본값으로 worker_id 사용
            names[userId] = `직원_${userId.slice(-4)}`;
          }
          
          console.log(`최종 직원명 설정: ${userId} -> ${names[userId]}`);
          
        } catch (error) {
          console.error('사용자 정보 로드 실패:', error);
          const userId = pref.employee_id || pref.id || pref.worker_id;
          if (userId) {
            names[userId] = `직원_${userId.slice(-4)}`;
          }
        }
      }
      
      console.log('최종 직원명 매핑:', names);
      setUserNames(names);
    } catch (error) {
      console.error('사용자 이름 로드 실패:', error);
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI 스케줄 생성 시스템
        </h1>
        <p className="text-gray-600">
          직원들의 선호도를 통합하여 최적의 스케줄을 자동으로 생성합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex items-center px-4 py-2 rounded-md transition-colors ${
            activeTab === 'generate'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 mr-2" />
          스케줄 생성
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`flex items-center px-4 py-2 rounded-md transition-colors ${
            activeTab === 'schedules'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          생성된 스케줄
        </button>
      </div>

      {/* 스케줄 생성 탭 */}
      {activeTab === 'generate' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border overflow-hidden">
            <h2 className="text-xl font-semibold mb-4">AI 스케줄 생성</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  주 시작일
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="date"
                  value={scheduleRequest.week_start_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduleRequest({
                    ...scheduleRequest,
                    week_start_date: e.target.value
                  })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    scheduleRequest.week_start_date && isPastDate(scheduleRequest.week_start_date)
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300'
                  }`}
                />
                {scheduleRequest.week_start_date && (
                  <div className="mt-2">
                    {isPastDate(scheduleRequest.week_start_date) ? (
                      <p className="text-xs text-red-500 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        과거 날짜는 선택할 수 없습니다
                      </p>
                    ) : isToday(scheduleRequest.week_start_date) ? (
                      <p className="text-xs text-blue-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        오늘부터 시작 (일부 시간대 제한될 수 있음)
                      </p>
                    ) : (
                      <p className="text-xs text-green-500 flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        미래 날짜 선택됨
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  과거 날짜는 선택할 수 없습니다. 오늘 또는 미래 날짜를 선택해주세요.
                </p>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  주 마감일
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="date"
                  value={scheduleRequest.week_end_date}
                  min={scheduleRequest.week_start_date || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduleRequest({
                    ...scheduleRequest,
                    week_end_date: e.target.value
                  })}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    scheduleRequest.week_end_date && (
                      isPastDate(scheduleRequest.week_end_date) || 
                      (scheduleRequest.week_start_date && new Date(scheduleRequest.week_end_date) <= new Date(scheduleRequest.week_start_date))
                    )
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300'
                  }`}
                />
                {scheduleRequest.week_end_date && (
                  <div className="mt-2">
                    {isPastDate(scheduleRequest.week_end_date) ? (
                      <p className="text-xs text-red-500 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        과거 날짜는 선택할 수 없습니다
                      </p>
                    ) : scheduleRequest.week_start_date && new Date(scheduleRequest.week_end_date) <= new Date(scheduleRequest.week_start_date) ? (
                      <p className="text-xs text-red-500 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        마감일은 시작일 이후여야 합니다
                      </p>
                    ) : (
                      <p className="text-xs text-green-500 flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        유효한 마감일
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  시작일 이후의 날짜를 선택해주세요.
                </p>
              </div>
            </div>

            {/* 고급 제약사항 설정 */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <button 
                onClick={() => setShowAdvancedConstraints(!showAdvancedConstraints)}
                className="w-full flex items-center justify-between text-left hover:bg-gray-50 p-2 -m-2 rounded-lg transition-colors"
              >
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-600" />
                  고급 제약사항 설정
                </h3>
                {showAdvancedConstraints ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              
              <p className="text-sm text-gray-600 mt-4 mb-4">
                AI 스케줄 생성 시 모든 제약사항이 자동으로 적용됩니다. 노동법과 직원 복지를 고려한 안전하고 공정한 스케줄이 생성됩니다.
              </p>
              
              {showAdvancedConstraints && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* 휴식시간 보장 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        휴식시간 보장 (11시간 연속) ✅
                      </label>
                    </div>
                    
                    {/* 연속근무일 제한 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        연속근무일 제한 (최대 6일) ✅
                      </label>
                    </div>
                    
                    {/* 주간 휴식 보장 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        주간 휴식 보장 (최소 1일) ✅
                      </label>
                    </div>
                    
                    {/* 일일 근무시간 제한 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        일일 근무시간 제한 (최대 8시간) ✅
                      </label>
                    </div>
                    
                    {/* 주간 근무시간 제한 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        주간 근무시간 제한 (최대 40시간) ✅
                      </label>
                    </div>
                    
                    {/* 개인 선호도 우선 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        개인 선호도 우선 ✅
                      </label>
                    </div>
                    
                    {/* 업무량 균등 배분 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        업무량 균등 배분 ✅
                      </label>
                    </div>
                    
                    {/* 직원별 배정 제한 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        직원별 배정 제한 (한 사람 몰빵 방지) ✅
                      </label>
                    </div>
                    
                    {/* 최대 연속 근무일 제한 */}
                    <div className="flex items-center space-x-3 bg-green-50 p-3 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-medium text-green-800">
                        최대 연속 배정 제한 (3일 연속까지만) ✅
                      </label>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-700">
                      💡 <strong>모든 고급 제약사항이 자동으로 활성화</strong>되어 AI가 노동법과 직원 복지를 고려하여 
                      안전하고 공정한 스케줄을 생성합니다. 사용자가 별도로 설정할 필요가 없습니다.
                    </p>
                  </div>
                </>
              )}
              
              {!showAdvancedConstraints && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 text-center">
                    <span className="inline-flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                      모든 제약사항이 자동으로 적용됩니다
                    </span>
                    <br />
                    <button 
                      onClick={() => setShowAdvancedConstraints(true)}
                      className="text-blue-600 hover:text-blue-700 underline text-sm mt-1"
                    >
                      자세히 보기
                    </button>
                  </p>
                </div>
              )}
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                    <Briefcase className="w-4 h-4 mr-2" />
                    등록된 파트
                  </h4>
                  <p className="text-blue-700">{departments.length}개 파트</p>
                  {departments.length > 0 && (
                    <div className="mt-2 space-y-2">
                    {departments.map((dept, index) => {
                      const requiredStaff = dept.required_staff_count || dept.staff_count || 1;
                      
                      // work_hours 구조에 따라 근무일 계산
                      let workDays = [];
                      if (dept.work_hours) {
                        Object.keys(dept.work_hours).forEach(day => {
                          const dayConfig = dept.work_hours[day];
                          if (typeof dayConfig === 'boolean' && dayConfig) {
                            workDays.push(day);
                          } else if (dayConfig && typeof dayConfig === 'object' && dayConfig.enabled) {
                            workDays.push(day);
                          }
                        });
                      }
                      
                      // 주간 총 필요 인원 = 일일 필요 인원 × 실제 근무일 수
                      const totalWeeklyStaff = requiredStaff * workDays.length;
                      
                      return (
                        <div key={index} className="bg-blue-100 p-2 rounded text-xs">
                          <div className="font-medium text-blue-800">{dept.department_name}</div>
                          <div className="text-blue-600">
                            일일 필요 인원: <span className="font-semibold">{requiredStaff}명</span>
                          </div>
                          <div className="text-blue-600">
                            주간 총 필요 인원: <span className="font-semibold text-blue-800">{totalWeeklyStaff}명</span>
                          </div>
                          <div className="text-blue-600 mt-1">
                            근무일: {workDays.length > 0 ? workDays.join(', ') : '설정되지 않음'}
                            {workDays.length === 0 && (
                              <span className="text-red-500 text-xs ml-2">⚠️ 근무일이 설정되지 않았습니다</span>
                            )}
                          </div>
                          <div className="text-blue-600 mt-1">
                            근무시간: {workDays.length > 0 ? 
                              workDays.map(day => {
                                const dayConfig = dept.work_hours?.[day];
                                if (dayConfig && typeof dayConfig === 'object' && dayConfig.enabled) {
                                  return `${day} ${dayConfig.start_time}-${dayConfig.end_time}`;
                                } else if (typeof dayConfig === 'boolean' && dayConfig) {
                                  return `${day} 09:00-18:00`;
                                }
                                return day;
                              }).join(', ') : '09:00-18:00'
                            }
                        </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    직원 선호도
                  </h4>
                  <p className="text-green-700">{employeePreferences.length}명의 직원 선호도</p>
                                     {employeePreferences.length > 0 ? (
                     <div className="mt-2 space-y-2">
                    {employeePreferences.map((pref, index) => {
                      const employeeId = pref.employee_id || pref.worker_id || pref.id;
                      // 백엔드에서 제공하는 employee_info 우선 사용, 없으면 userNames 사용
                      const employeeName = pref.employee_info?.name || 
                                        pref.employee_info?.display_name || 
                                        userNames[employeeId] || 
                                        `직원_${employeeId?.slice(-4)}`;
                      const isNameLoaded = employeeName && !employeeName.includes('로딩');
                      
                      return (
                          <div 
                            key={index} 
                            className="bg-green-100 p-2 rounded text-xs cursor-pointer hover:bg-green-200 transition-colors"
                            onClick={() => handlePreferenceClick(pref)}
                          >
                            <div className="font-medium text-green-800">
                            {employeeName}
                            {pref.employee_info?.email && (
                              <span className="text-green-600 ml-2 text-xs">
                                ({pref.employee_info.email})
                              </span>
                            )}
                          </div>
                          <div className="text-green-600 text-xs">
                            ID: {employeeId || '없음'}
                            </div>
                            <div className="text-green-600">
                              선택된 요일: {Object.keys(pref.daily_preferences || {}).filter(day => 
                                pref.daily_preferences[day]?.selected_departments?.length > 0
                              ).join(', ') || '없음'}
                            </div>
                            <div className="text-green-600 mt-1">
                              총 선택 파트: {Object.values(pref.daily_preferences || {}).reduce((total, day) => 
                                total + (day?.selected_departments?.length || 0), 0
                              )}개
                            </div>
                            <div className="text-green-500 text-xs mt-1 italic">
                              클릭하여 상세보기
                            </div>
                          </div>
                      );
                    })}
                     </div>
                   ) : (
                     <div className="mt-2 text-green-600 text-xs">
                       아직 직원들이 선호도를 설정하지 않았습니다.
                     </div>
                   )}
                </div>
              </div>

              {/* 확정된 결근 정보 표시 */}
              {filteredConfirmedAbsences.length > 0 && (
                <div className="mt-6 bg-red-50 p-4 rounded-lg border border-red-200">
                  <h4 className="font-medium text-red-900 mb-3 flex items-center">
                    <X className="w-4 h-4 mr-2" />
                    확정된 결근 정보
                    <span className="ml-2 text-sm text-red-600">
                      ({filteredConfirmedAbsences.length}건)
                    </span>
                    {confirmedAbsences.length > filteredConfirmedAbsences.length && (
                      <span className="ml-2 text-xs text-red-500 bg-red-200 px-2 py-1 rounded-full">
                        과거 {confirmedAbsences.length - filteredConfirmedAbsences.length}건 제외됨
                      </span>
                    )}
                  </h4>
                  <p className="text-red-700 text-sm mb-3">
                    다음 직원들은 해당 날짜에 결근으로 확정되어 스케줄에서 제외됩니다.
                    <span className="text-red-600 font-medium">(과거 날짜의 결근은 자동으로 제외됩니다)</span>
                  </p>
                  
                  {/* 결근 정보 요약 */}
                  <div className="mb-4 p-3 bg-red-100 rounded border border-red-300">
                    <h5 className="font-medium text-red-800 mb-2">📊 결근 정보 요약</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-red-700">결근 직원 수:</span>
                        <span className="ml-2 font-medium text-red-800">
                          {new Set(filteredConfirmedAbsences.map(a => a.worker_id)).size}명
                        </span>
                      </div>
                      <div>
                        <span className="text-red-700">결근 기간:</span>
                        <span className="ml-2 font-medium text-red-800">
                          {(() => {
                            const dates = filteredConfirmedAbsences.map(a => new Date(a.date)).sort((a, b) => a - b);
                            if (dates.length === 0) return '없음';
                            const start = dates[0];
                            const end = dates[dates.length - 1];
                            const daysDiff = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
                            return `${start.toLocaleDateString()} ~ ${end.toLocaleDateString()} (${daysDiff}일)`;
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-red-700">총 결근 일수:</span>
                        <span className="ml-2 font-medium text-red-800">
                          {filteredConfirmedAbsences.length}일
                        </span>
                      </div>
                      <div>
                        <span className="text-red-700">영향받는 주:</span>
                        <span className="ml-2 font-medium text-red-800">
                          {(() => {
                            const dates = filteredConfirmedAbsences.map(a => new Date(a.date)).sort((a, b) => a - b);
                            if (dates.length === 0) return '없음';
                            const start = dates[0];
                            const end = dates[dates.length - 1];
                            const weeksDiff = Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000));
                            return `${weeksDiff}주`;
                          })()}간
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {filteredConfirmedAbsences.map((absence, index) => (
                      <div key={index} className="bg-red-100 p-3 rounded-md border border-red-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <X className="h-4 w-4 text-red-500" />
                            <span className="font-medium text-red-800">
                              {absence.worker_name || absence.worker_email}
                            </span>
                            <span className="text-red-600">-</span>
                            <span className="text-sm text-red-600">{absence.notes}</span>
                          </div>
                          <div className="text-xs text-red-500 bg-red-200 px-2 py-1 rounded-full">
                            {absence.date}
                            {isToday(absence.date) && (
                              <span className="ml-1 text-blue-600 font-medium">(오늘)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 p-3 bg-red-100 rounded border border-red-300">
                    <p className="text-xs text-red-800">
                      💡 <strong>AI 스케줄 생성 시</strong> 이 결근 정보가 자동으로 반영되어 
                      해당 직원들은 해당 날짜에 스케줄에 배정되지 않습니다.
                      <br />
                      <strong>결근 기간을 고려하여 스케줄 생성 기간이 자동으로 조정됩니다.</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* 결근이 없는 경우 안내 메시지 */}
              {filteredConfirmedAbsences.length === 0 && (
                <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    결근 정보
                  </h4>
                  <p className="text-gray-600 text-sm">
                    {confirmedAbsences.length > 0 ? (
                      <>
                        현재 표시 가능한 결근이 없습니다. 
                        {confirmedAbsences.length > 0 && (
                          <span className="text-gray-500">
                            (과거 날짜의 결근 {confirmedAbsences.length}건은 자동으로 제외됨)
                          </span>
                        )}
                      </>
                    ) : (
                      '현재 확정된 결근이 없습니다. 모든 직원이 정상적으로 스케줄에 배정될 수 있습니다.'
                    )}
                  </p>
                </div>
              )}
            </div>

          {/* 직원수 부족 시 제약사항 조정 옵션 */}
          {availableWorkers < Math.ceil(totalRequiredStaff / 7) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-900 mb-2">⚠️ 직원수 부족으로 인한 제약사항 조정 필요</h4>
                  <div className="text-sm text-yellow-700 space-y-2">
                    <p><strong>현재 상황:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>일일 최소 필요 인원: {Math.ceil(totalRequiredStaff / 7)}명</li>
                      <li>사용 가능한 직원: {availableWorkers}명</li>
                      <li>부족한 인원: {Math.ceil(totalRequiredStaff / 7) - availableWorkers}명</li>
                    </ul>
                    <p className="mt-3"><strong>영향받는 제약사항:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>휴식시간 보장: 일부 직원은 11시간 미만 휴식 가능</li>
                      <li>주간 휴식: 모든 직원이 연속 근무해야 할 수 있음</li>
                      <li>연속근무 제한: 6일 이상 근무해야 할 수 있음</li>
                    </ul>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-100 rounded border border-yellow-300">
                    <p className="text-sm text-yellow-800">
                      <strong>권장사항:</strong> 직원을 추가로 고용하거나, 
                      일부 제약사항을 완화하여 스케줄을 생성하세요.
                    </p>
                  </div>
                  
                  {/* 제약사항 완화 옵션 */}
                  <div className="mt-4">
                    <label className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={scheduleRequest.schedule_constraints.auto_adjust_constraints || false}
                        onChange={(e) => setScheduleRequest(prev => ({
                          ...prev,
                          schedule_constraints: {
                            ...prev.schedule_constraints,
                            auto_adjust_constraints: e.target.checked
                          }
                        }))}
                        className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-yellow-300 rounded"
                      />
                      <span className="text-yellow-800">
                        직원수 부족 시 제약사항 자동 완화 (권장)
                      </span>
                    </label>
                    <p className="text-xs text-yellow-600 mt-1 ml-6">
                      체크하면 직원수가 부족할 때 일부 제약사항을 자동으로 완화하여 
                      실행 가능한 스케줄을 생성합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

            {/* 결근 정보 간단 안내 */}
            {filteredConfirmedAbsences.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center text-sm text-blue-800">
                  <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                  <span>
                    <strong>{filteredConfirmedAbsences.length}건의 결근</strong>이 감지되었습니다. 
                    AI가 자동으로 결근 정보를 고려하여 스케줄을 생성합니다.
                  </span>
              </div>
            </div>
          )}

            <button
              onClick={(e) => {
                // 중복 클릭 방지
                e.preventDefault();
                e.stopPropagation();
                if (!loading) {
                  handleGenerateSchedule();
                }
              }}
              disabled={
                loading || 
                departments.length === 0 || 
                !scheduleRequest.week_start_date || 
                !scheduleRequest.week_end_date ||
                isPastDate(scheduleRequest.week_start_date) ||
                isPastDate(scheduleRequest.week_end_date)
              }
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  정보를 받아오는 중...
                </div>
              ) : (
                <>
                  <Calendar className="w-5 h-5 mr-2" />
                  AI 스케줄 생성
                </>
              )}
            </button>
        </div>
      )}

      {/* 생성된 스케줄 탭 */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">생성된 스케줄 목록</h2>
            
            {/* 뷰 선택 탭 */}
            <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setScheduleView('list')}
                className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                  scheduleView === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                목록 보기
              </button>
              <button
                onClick={() => setScheduleView('calendar')}
                className={`flex items-center px-4 py-2 rounded-md transition-colors ${
                  scheduleView === 'calendar'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                캘린더 보기
              </button>
            </div>

            <div className="space-y-4">
              {/* 현재 날짜 정보 표시 */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">현재 날짜: {currentDate.toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="text-sm text-blue-600">
                    과거 날짜의 스케줄은 자동으로 제외됩니다
                  </div>
                </div>
              </div>

              {Array.isArray(filteredGeneratedSchedules) && filteredGeneratedSchedules.length > 0 ? (
                filteredGeneratedSchedules.map((schedule, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {schedule.week_start_date} ~ {schedule.week_end_date}
                      </h3>
                      <p className="text-gray-600">
                          총 {schedule.total_required_staff || (() => {
                            // 백엔드에서 total_required_staff가 없으면 프론트엔드에서 계산 (중복 제거)
                            let totalRequired = 0;
                            let dayDetails = [];
                            let duplicateCheck = new Set();
                            
                            if (schedule.schedule_data) {
                              Object.entries(schedule.schedule_data).forEach(([day, daySchedules]) => {
                                if (Array.isArray(daySchedules)) {
                                  let dayTotal = 0;
                                  let dayDepts = [];
                                  
                                  daySchedules.forEach(dept => {
                                    const deptKey = `${day}_${dept.department_id || dept.department_name}`;
                                    if (!duplicateCheck.has(deptKey)) {
                                      duplicateCheck.add(deptKey);
                                      const requiredStaff = dept.required_staff_count || dept.staff_count || 1;
                                      dayTotal += requiredStaff;
                                      dayDepts.push(`${dept.department_name}(${requiredStaff}명)`);
                                    }
                                  });
                                  
                                  totalRequired += dayTotal;
                                  dayDetails.push(`${day}: ${dayTotal}명 [${dayDepts.join(', ')}]`);
                                }
                              });
                            }
                            
                            // 디버깅 로그
                            console.log(`스케줄 ${schedule.week_start_date} ~ ${schedule.week_end_date} 필요 인원 계산 (프론트엔드):`, {
                              dayDetails,
                              totalRequired,
                              duplicateCheck: Array.from(duplicateCheck)
                            });
                            
                            return totalRequired;
                          })()}명 (실제 필요 인원), {schedule.total_hours}시간
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-1" />
                        <span className="text-sm text-gray-600">
                           생성일: {new Date(schedule.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                    실제 배정: {(() => {
                      // 실제 배정된 직원 수 계산
                      let totalAssigned = 0;
                      if (schedule.schedule_data) {
                        Object.values(schedule.schedule_data).forEach(daySchedules => {
                          if (Array.isArray(daySchedules)) {
                            daySchedules.forEach(dept => {
                              if (dept.assigned_employees && Array.isArray(dept.assigned_employees)) {
                                totalAssigned += dept.assigned_employees.length;
                              } else if (dept.employees && Array.isArray(dept.employees)) {
                                totalAssigned += dept.employees.length;
                              } else if (dept.worker_assignments && Array.isArray(dept.worker_assignments)) {
                                totalAssigned += dept.worker_assignments.length;
                              }
                            });
                          }
                        });
                      }
                      return totalAssigned > 0 ? totalAssigned : 'N/A';
                    })()}명
                      </p>
                    </div>
                  </div>
                  
                    {/* 뷰에 따른 스케줄 표시 */}
                    {scheduleView === 'list' ? (
                      // 목록 보기 (기존 요일별 표시)
                  <div className="grid grid-cols-7 gap-2 text-xs">
                    {['월', '화', '수', '목', '금', '토', '일'].map(day => (
                      <div key={day} className="text-center">
                        <div className="font-medium text-gray-600 mb-1">{day}</div>
                        <div className="bg-gray-100 rounded p-2 min-h-[60px]">
                          {schedule.schedule_data && schedule.schedule_data[day]?.map((dept, deptIndex) => {
                            // 백엔드 응답 구조에 따라 assigned_employees 데이터 추출
                            let assignedEmployees = [];
                            if (dept.assigned_employees && Array.isArray(dept.assigned_employees)) {
                              assignedEmployees = dept.assigned_employees;
                            } else if (dept.employees && Array.isArray(dept.employees)) {
                              assignedEmployees = dept.employees;
                            } else if (dept.worker_assignments && Array.isArray(dept.worker_assignments)) {
                              assignedEmployees = dept.worker_assignments;
                            }
                            
                            return (
                            <div key={deptIndex} className="mb-1">
                              <div className="font-medium text-blue-600">{dept.department_name}</div>
                              <div className="text-gray-500">
                                  {assignedEmployees.length}명
                              </div>
                                {assignedEmployees.length > 0 && (
                                  <div className="text-xs text-gray-400">
                                    {assignedEmployees.map(emp => 
                                      emp.employee_name || emp.worker_name || emp.name || '직원'
                                    ).join(', ')}
                            </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                    ) : (
                      // 캘린더 보기
                      <div className="mt-4">
                        <CalendarView 
                          schedule={schedule} 
                          departmentStaffing={departmentStaffing}
                          departments={departments}
                          onScheduleUpdate={(updatedSchedule) => {
                            // 스케줄 업데이트 처리
                            setCurrentSchedule(prev => ({
                              ...prev,
                              schedule_data: updatedSchedule
                            }));
                            
                            // 생성된 스케줄 목록도 업데이트
                            setGeneratedSchedules(prev => prev.map(schedule => {
                              if (schedule.schedule_id === currentSchedule?.schedule_id) {
                                return {
                                  ...schedule,
                                  schedule_data: updatedSchedule
                                };
                              }
                              return schedule;
                            }));
                            
                            toast.success('스케줄이 AI에 의해 수정되었습니다!');
                          }}
                        />
                      </div>
                    )}
                </div>
               ))
             ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  {generatedSchedules.length > 0 ? (
                    <>
                      <p>표시 가능한 스케줄이 없습니다.</p>
                      <p className="text-sm text-gray-400">
                        과거 날짜의 스케줄 {generatedSchedules.length - filteredGeneratedSchedules.length}건이 자동으로 제외되었습니다.
                      </p>
                      <p className="text-sm mt-2">스케줄 생성 탭에서 새로운 스케줄을 만들어보세요.</p>
                    </>
                  ) : (
                    <>
                  <p>아직 생성된 스케줄이 없습니다.</p>
                  <p className="text-sm">스케줄 생성 탭에서 새로운 스케줄을 만들어보세요.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 현재 생성된 스케줄 요약 정보 */}
      {currentSchedule && (
        <div className="bg-white p-4 rounded-lg shadow-sm border mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium flex items-center text-green-600">
              <Sparkles className="w-5 h-5 text-green-500 mr-2" />
              AI 스케줄 생성 완료
            </h3>
            <button
              onClick={() => setCurrentSchedule(null)}
              className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              title="스케줄 정보 숨기기"
            >
              ×
            </button>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>✅ 결근 정보가 반영된 최적의 스케줄이 생성되었습니다.</p>
            <p className="mt-1">📅 기간: {currentSchedule.week_start_date} ~ {currentSchedule.week_end_date}</p>
            <p className="mt-1">👥 총 배정 인원: {currentSchedule.total_workers || 'N/A'}명</p>
            <p className="mt-1">⏰ 총 근무시간: {currentSchedule.total_hours || 'N/A'}시간</p>
              </div>
          
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              💡 상세 스케줄은 위의 캘린더에서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      )}

       {/* 선호도 상세 모달 */}
       {showPreferenceModal && selectedPreference && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-semibold text-gray-900">직원 선호도 상세</h3>
               <button
                 onClick={closePreferenceModal}
                 className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
               >
                 ×
               </button>
             </div>
             
             <div className="space-y-4">
                               <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">기본 정보</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">직원명:</span>
                      <span className="ml-2 font-medium">{userNames[selectedPreference.employee_id || selectedPreference.worker_id || selectedPreference.id] || '로딩 중...'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">생성일:</span>
                      <span className="ml-2 font-medium">
                        {selectedPreference.created_at ? new Date(selectedPreference.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">수정일:</span>
                      <span className="ml-2 font-medium">
                        {selectedPreference.updated_at ? new Date(selectedPreference.updated_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">선택된 요일:</span>
                      <span className="ml-2 font-medium">
                        {Object.keys(selectedPreference.daily_preferences || {}).filter(day => 
                          selectedPreference.daily_preferences[day]?.selected_departments?.length > 0
                        ).join(', ') || '없음'}
                      </span>
                    </div>
                  </div>
                </div>

               <div className="bg-green-50 p-4 rounded-lg">
                 <h4 className="font-medium text-green-900 mb-3">요일별 선호 파트</h4>
                 <div className="grid grid-cols-7 gap-2">
                   {daysOfWeek.map(day => {
                     const dayPreferences = selectedPreference.daily_preferences?.[day];
                     const selectedDepartments = dayPreferences?.selected_departments || [];
                     
                     return (
                       <div key={day} className="text-center">
                         <div className="font-medium text-gray-700 mb-2">{day}</div>
                         <div className="bg-white rounded p-2 min-h-[80px] border">
                           {selectedDepartments.length > 0 ? (
                             <div className="space-y-1">
                               {selectedDepartments.map((deptId, index) => (
                                 <div key={index} className="text-xs bg-green-100 p-1 rounded">
                                   {getDepartmentName(deptId)}
                                 </div>
                               ))}
                             </div>
                           ) : (
                             <div className="text-xs text-gray-400 italic">
                               선택 없음
                             </div>
                           )}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               </div>

                               <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">요약</h4>
                  <div className="grid grid-cols-1 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600">총 선택 파트:</span>
                      <span className="ml-2 font-medium">
                        {Object.values(selectedPreference.daily_preferences || {}).reduce((total, day) => 
                          total + (day?.selected_departments?.length || 0), 0
                        )}개
                      </span>
                    </div>
                  </div>
                </div>
             </div>

             <div className="flex justify-end mt-6">
               <button
                 onClick={closePreferenceModal}
                 className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
               >
                 닫기
               </button>
             </div>
           </div>
         </div>
       )}

      
    </div>
  );
};

export default EmployerScheduleGenerator;
