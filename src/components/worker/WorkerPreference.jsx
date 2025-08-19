import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { workerPreferenceAPI } from '../../services/api';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  Save,
  User,
  Briefcase
} from 'lucide-react';

const WorkerPreference = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  
  const [preference, setPreference] = useState({
    worker_id: '',
    business_id: '',
    daily_preferences: {
      '월': { selected_departments: [] },
      '화': { selected_departments: [] },
      '수': { selected_departments: [] },
      '목': { selected_departments: [] },
      '금': { selected_departments: [] },
      '토': { selected_departments: [] },
      '일': { selected_departments: [] }
    }
  });

  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

  useEffect(() => {
    if (currentUser) {
      loadBusinessInfo();
    }
  }, [currentUser]);

  const loadBusinessInfo = async () => {
    try {
      // 로컬 스토리지에서 권한 정보 가져오기
      const permissionKey = `worker_permission_${currentUser.uid}`;
      const permissionData = localStorage.getItem(permissionKey);
      
      if (permissionData) {
        const permission = JSON.parse(permissionData);
        setBusinessInfo(permission);
        
        // 권한 정보가 있으면 선호도와 부서 정보 로드
        await loadUserPreference(permission.businessId);
        await loadDepartments(permission.businessId);
      } else {
        // 권한 정보가 없으면 기본값으로 설정
        setBusinessInfo({ businessId: currentUser.uid, businessName: '미설정' });
        await loadUserPreference(currentUser.uid);
        await loadDepartments(currentUser.uid);
      }
    } catch (error) {
      console.error('업체 정보 로드 실패:', error);
    }
  };

  const loadUserPreference = async (businessId) => {
    try {
      setLoading(true);
      
      // Firebase에서 직접 선호도 데이터 가져오기
      const { collection, doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const docId = `${currentUser.uid}_${businessId}`;
      const preferenceDoc = await getDoc(doc(db, 'employee_preferences', docId));
      
      if (preferenceDoc.exists()) {
        const existingPreference = preferenceDoc.data();
        console.log('기존 선호도 데이터:', existingPreference);
        
        // 기존 데이터 구조와 새로운 구조 간의 호환성 처리
        const updatedPreference = {
          ...existingPreference,
          worker_id: currentUser.uid,
          business_id: existingPreference.business_id,
          daily_preferences: existingPreference.daily_preferences || {
            '월': { selected_departments: [] },
            '화': { selected_departments: [] },
            '수': { selected_departments: [] },
            '목': { selected_departments: [] },
            '금': { selected_departments: [] },
            '토': { selected_departments: [] },
            '일': { selected_departments: [] }
          }
        };
        
        setPreference(updatedPreference);
      } else {
        console.log('기존 선호도 데이터가 없음, 새로 생성');
        setPreference({
          ...preference,
          worker_id: currentUser.uid,
          business_id: businessId
        });
      }
    } catch (error) {
      console.error('선호도 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async (businessId) => {
    try {
      // Firebase에서 고용자가 설정한 파트 정보 가져오기
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      console.log('직원 선호도 - 업체 ID:', businessId);
      
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('business_id', '==', businessId)
      );
      const departmentsSnapshot = await getDocs(departmentsQuery);
      
      console.log('직원 선호도 - 파트 쿼리 결과:', departmentsSnapshot.size, '개 문서');
      
      const departmentsList = [];
      departmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('직원 선호도 - 파트 데이터:', data);
        departmentsList.push(data);
      });
      
      console.log('직원 선호도 - 최종 파트 목록:', departmentsList);
      setDepartments(departmentsList);
    } catch (error) {
      console.error('부서 정보 로드 실패:', error);
    }
  };

  const handleSavePreference = async () => {
    try {
      setLoading(true);
      
      // Firebase에 직접 저장
      const { collection, doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // 선호도 데이터 준비
      const preferenceData = {
        worker_id: preference.worker_id,
        business_id: preference.business_id,
        daily_preferences: preference.daily_preferences,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // 문서 ID 생성 (worker_id + business_id)
      const docId = `${preference.worker_id}_${preference.business_id}`;
      
      console.log('Firebase에 저장할 데이터:', preferenceData);
      
      // Firebase에 직접 저장
      await setDoc(doc(db, 'employee_preferences', docId), preferenceData);
      
      console.log('선호도 저장 성공:', docId);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('선호도 저장 실패:', error);
      alert('선호도 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentToggle = (day, departmentId) => {
    setPreference(prev => ({
      ...prev,
      daily_preferences: {
        ...prev.daily_preferences,
        [day]: {
          ...prev.daily_preferences[day],
          selected_departments: prev.daily_preferences[day].selected_departments.includes(departmentId)
            ? prev.daily_preferences[day].selected_departments.filter(id => id !== departmentId)
            : [...prev.daily_preferences[day].selected_departments, departmentId]
        }
      }
    }));
  };



  const getDepartmentsForDay = (day) => {
    return departments.filter(dept => {
      if (!dept.work_hours) return false;
      
      // 기존 구조 (boolean)와 새로운 구조 (object) 모두 지원
      if (typeof dept.work_hours[day] === 'boolean') {
        return dept.work_hours[day];
      } else if (dept.work_hours[day] && typeof dept.work_hours[day] === 'object') {
        return dept.work_hours[day].enabled;
      }
      return false;
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
              <div className="mb-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">
              근무 선호도 설정
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              각 요일별로 선호하는 파트를 설정하여 AI가 최적의 스케줄을 생성할 수 있도록 도와주세요.
            </p>
          </div>
          
          {businessInfo && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200 shadow-sm">
              <div className="flex items-center justify-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-800">
                    <strong>소속 업체:</strong> {businessInfo.businessName}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    설정한 선호도는 이 업체의 AI 스케줄 생성에 반영됩니다
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
              ) : (
          <div className="space-y-8">
            {/* 요일별 파트 선택 */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                요일별 파트 선택
              </h2>
            
            <div className="grid grid-cols-7 gap-4 mb-6">
              {daysOfWeek.map(day => {
                const dayDepartments = getDepartmentsForDay(day);
                const selectedCount = preference.daily_preferences[day].selected_departments.length;
                
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      selectedDay === day
                        ? 'border-blue-500 bg-blue-50'
                        : selectedCount > 0
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-medium text-gray-900">{day}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {dayDepartments.length}개 파트
                      </div>
                      {selectedCount > 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          {selectedCount}개 선택
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 선택된 요일의 파트 상세 설정 */}
            {selectedDay && (
              <div className="border border-gray-200 rounded-2xl p-8 bg-gradient-to-r from-gray-50 to-blue-50">
                <h3 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  {selectedDay}요일 파트 설정
                </h3>
                
                {(() => {
                  const dayDepartments = getDepartmentsForDay(selectedDay);
                  
                  if (dayDepartments.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>이 요일에는 등록된 파트가 없습니다.</p>
                        <p className="text-sm mt-1">고용자가 파트를 등록하면 여기에 표시됩니다.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* 파트 선택 */}
                      <div>
                        <h4 className="text-md font-medium text-gray-700 mb-3">선호하는 파트 (복수 선택 가능)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {dayDepartments.map(dept => (
                            <div
                              key={dept.department_id}
                              onClick={() => handleDepartmentToggle(selectedDay, dept.department_id)}
                              className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                                preference.daily_preferences[selectedDay].selected_departments.includes(dept.department_id)
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h5 className="font-medium text-gray-900">{dept.department_name}</h5>
                                  <p className="text-sm text-gray-600 mt-1">
                                    필요 인원: {dept.required_staff_count}명
                                  </p>
                                  {(() => {
                                    let timeInfo = '';
                                    if (dept.work_hours && dept.work_hours[selectedDay]) {
                                      if (typeof dept.work_hours[selectedDay] === 'object' && dept.work_hours[selectedDay].start_time) {
                                        timeInfo = `${dept.work_hours[selectedDay].start_time} - ${dept.work_hours[selectedDay].end_time}`;
                                      }
                                    }
                                    return timeInfo ? (
                                      <p className="text-xs text-blue-600 mt-1">
                                        근무시간: {timeInfo}
                                      </p>
                                    ) : null;
                                  })()}
                                </div>
                                <div className="flex items-center">
                                  {preference.daily_preferences[selectedDay].selected_departments.includes(dept.department_id) && (
                                    <CheckCircle className="w-5 h-5 text-blue-600" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>


                    </div>
                  );
                })()}
              </div>
            )}
          </div>

                      {/* 저장 버튼 */}
            <div className="flex justify-center">
              <button
                onClick={handleSavePreference}
                disabled={loading}
                className="flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {saved ? '저장됨!' : '선호도 저장'}
              </button>
            </div>

            {saved && (
              <div className="flex items-center justify-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 rounded-2xl border border-green-200 shadow-lg">
                <div className="p-2 bg-green-100 rounded-full mr-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-lg font-medium">선호도가 성공적으로 저장되었습니다!</span>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default WorkerPreference;
