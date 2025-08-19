/**
 * 스케줄 관리 컴포넌트
 * 노동자 스케줄 확인 및 관리 기능
 */

import React, { useState, useEffect } from 'react';
import { User, Calendar, X, Clock, MapPin, Phone, Mail, CheckCircle, AlertCircle, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { employerScheduleAPI } from '../../services/api';

const ScheduleManagement = ({ currentUser }) => {
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerSchedule, setShowWorkerSchedule] = useState(false);
  const [workerSchedules, setWorkerSchedules] = useState({});
  const [aiGeneratedSchedule, setAiGeneratedSchedule] = useState(null);
  const [loadingAiSchedule, setLoadingAiSchedule] = useState(false);

  // 노동자 목록 불러오기 (WorkersManagement와 동일한 방식)
  const fetchWorkers = async () => {
    if (!currentUser) return;
    
    setLoadingWorkers(true);
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // 현재 업체에 권한이 있는 피고용자들 가져오기
      const permissionsQuery = query(
        collection(db, 'permissions'), 
        where('business_id', '==', currentUser.uid),
        where('status', '==', 'active')
      );
      const permissionsSnapshot = await getDocs(permissionsQuery);
      
      const workersList = [];
      for (const permissionDoc of permissionsSnapshot.docs) {
        const permission = permissionDoc.data();
        
        // 피고용자 정보 가져오기
        const userDoc = await getDocs(query(
          collection(db, 'users'), 
          where('uid', '==', permission.worker_id)
        ));
        
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          
          // 노동자 프로필 정보 가져오기
          const profileQuery = query(
            collection(db, 'worker_profiles'),
            where('worker_id', '==', permission.worker_id),
            where('business_id', '==', currentUser.uid)
          );
          const profileSnapshot = await getDocs(profileQuery);
          
          let assignedTasks = [];
          if (!profileSnapshot.empty) {
            const profileData = profileSnapshot.docs[0].data();
            assignedTasks = profileData.assigned_tasks || [];
          }
          
          workersList.push({
            ...permission,
            ...userData,
            assigned_tasks: assignedTasks
          });
        }
      }
      
      setWorkers(workersList);
    } catch (error) {
      console.error('노동자 목록 불러오기 에러:', error);
      toast.error('노동자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingWorkers(false);
    }
  };

  // 노동자 스케줄 불러오기
  const fetchWorkerSchedule = async (workerId) => {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const scheduleQuery = query(
        collection(db, 'worker_schedules'),
        where('worker_id', '==', workerId),
        where('business_id', '==', currentUser.uid)
      );
      const scheduleSnapshot = await getDocs(scheduleQuery);
      
      if (!scheduleSnapshot.empty) {
        const scheduleData = scheduleSnapshot.docs[0].data();
        return scheduleData;
      }
      return null;
    } catch (error) {
      console.error('노동자 스케줄 불러오기 에러:', error);
      return null;
    }
  };

  // AI 생성 스케줄에서 직원 스케줄 조회
  const fetchAiGeneratedEmployeeSchedule = async (employeeId) => {
    try {
      setLoadingAiSchedule(true);
      
      const response = await employerScheduleAPI.getEmployeeSchedule(currentUser.uid, employeeId);
      
      if (response.data && response.data.employee_schedule) {
        return response.data.employee_schedule;
      } else {
        return null;
      }
    } catch (error) {
      console.error('AI 생성 직원 스케줄 조회 에러:', error);
      toast.error('AI 생성 스케줄 조회에 실패했습니다.');
      return null;
    } finally {
      setLoadingAiSchedule(false);
    }
  };

  // 노동자 스케줄 보기 핸들러
  const handleViewWorkerSchedule = async (worker) => {
    setSelectedWorker(worker);
    
    // 이미 로드된 스케줄이 있는지 확인
    if (workerSchedules[worker.worker_id]) {
      setSelectedWorker(prev => ({ ...prev, schedule: workerSchedules[worker.worker_id] }));
    } else {
      // 스케줄 로딩 중 표시
      setSelectedWorker(prev => ({ ...prev, schedule: null }));
      const schedule = await fetchWorkerSchedule(worker.worker_id);
      setWorkerSchedules(prev => ({ ...prev, [worker.worker_id]: schedule }));
      setSelectedWorker(prev => ({ ...prev, schedule }));
    }
    
    // AI 생성 스케줄에서 해당 직원의 배정 스케줄 조회
    const aiSchedule = await fetchAiGeneratedEmployeeSchedule(worker.worker_id);
    setAiGeneratedSchedule(aiSchedule);
    
    setShowWorkerSchedule(true);
  };

  // 노동자 스케줄 모달 닫기 핸들러
  const handleCloseWorkerSchedule = () => {
    setShowWorkerSchedule(false);
    setSelectedWorker(null);
  };

  // 요일별 색상 매핑
  const getDayColor = (day) => {
    const colors = {
      '월': 'bg-blue-100 text-blue-800',
      '화': 'bg-green-100 text-green-800',
      '수': 'bg-purple-100 text-purple-800',
      '목': 'bg-orange-100 text-orange-800',
      '금': 'bg-red-100 text-red-800',
      '토': 'bg-indigo-100 text-indigo-800',
      '일': 'bg-pink-100 text-pink-800'
    };
    return colors[day] || 'bg-gray-100 text-gray-800';
  };

  // 컴포넌트 마운트 시 노동자 목록 불러오기
  useEffect(() => {
    fetchWorkers();
  }, [currentUser]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">노동자 스케줄 관리</h3>
            <p className="text-sm text-gray-600 mt-1">
              등록된 노동자들의 스케줄을 확인하고 관리합니다.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            총 {workers.length}명의 노동자
          </div>
        </div>

        {loadingWorkers ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : workers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workers.map((worker) => (
              <div key={worker.worker_id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-lg">
                        {worker.display_name || worker.email?.split('@')[0] || '이름 없음'}
                      </h4>
                      <p className="text-sm text-gray-500 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {worker.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                      활성
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3 mb-4">
                  {worker.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      {worker.phone}
                    </div>
                  )}
                  {worker.address && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      {worker.address}
                    </div>
                  )}
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="font-medium">할당된 업무:</span> 
                    <span className="ml-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                      {worker.assigned_tasks?.length || 0}개
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleViewWorkerSchedule(worker)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>스케줄 보기</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="h-10 w-10 text-gray-400" />
            </div>
            <h4 className="text-xl font-medium text-gray-900 mb-3">등록된 노동자가 없습니다</h4>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              노동자 관리에서 노동자를 등록한 후 스케줄을 확인할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      {/* 노동자 스케줄 상세 모달 */}
      {showWorkerSchedule && selectedWorker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedWorker.display_name || selectedWorker.email?.split('@')[0]} 스케줄
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center">
                    <Mail className="h-3 w-3 mr-1" />
                    {selectedWorker.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseWorkerSchedule}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              {selectedWorker.schedule || aiGeneratedSchedule ? (
                <div className="space-y-6">
                  {/* AI 생성 스케줄 표시 */}
                  {aiGeneratedSchedule && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                        <Briefcase className="w-4 h-4 mr-2" />
                        AI 생성 스케줄 배정 현황
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-purple-600">기간:</span>
                          <span className="ml-2 font-medium">
                            {aiGeneratedSchedule.week_start_date} ~ {aiGeneratedSchedule.week_end_date}
                          </span>
                        </div>
                        <div>
                          <span className="text-purple-600">총 근무일:</span>
                          <span className="ml-2 font-medium text-purple-800">
                            {aiGeneratedSchedule.total_work_days}일
                          </span>
                        </div>
                        <div>
                          <span className="text-purple-600">총 근무시간:</span>
                          <span className="ml-2 font-medium text-purple-800">
                            {aiGeneratedSchedule.total_work_hours}시간
                          </span>
                        </div>
                        <div>
                          <span className="text-purple-600">배정 파트:</span>
                          <span className="ml-2 font-medium text-purple-800">
                            {aiGeneratedSchedule.assigned_departments.length}개
                          </span>
                        </div>
                      </div>
                      
                      {/* 요일별 스케줄 표시 */}
                      <div className="grid grid-cols-7 gap-2 text-xs">
                        {['월', '화', '수', '목', '금', '토', '일'].map(day => {
                          const dayAssignments = aiGeneratedSchedule.daily_assignments[day] || [];
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
                                        {assignment.work_hours[0] || '09:00-18:00'}
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
                    </div>
                  )}
                  
                  {/* AI 스케줄 로딩 중 */}
                  {loadingAiSchedule && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
                        <span className="text-purple-700">AI 생성 스케줄을 불러오는 중...</span>
                      </div>
                    </div>
                  )}
                  
                  {/* AI 스케줄이 없는 경우 */}
                  {!loadingAiSchedule && !aiGeneratedSchedule && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-center py-6">
                        <Briefcase className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                        <h4 className="text-purple-700 font-medium mb-2">AI 생성 스케줄 없음</h4>
                        <p className="text-purple-600 text-sm">아직 AI 스케줄이 생성되지 않았거나 해당 직원이 배정되지 않았습니다.</p>
                        <p className="text-purple-500 text-xs mt-1">AI 스케줄 생성 탭에서 스케줄을 먼저 생성해주세요.</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 개인 선호도 스케줄 표시 */}
                  {selectedWorker.schedule && (
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        개인 선호도 스케줄
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                          <span className="text-blue-600">총 근무일:</span>
                        <span className="ml-2 font-medium">
                          {Object.values(selectedWorker.schedule.daily_preferences || {}).filter(day => day.length > 0).length}일
                        </span>
                      </div>
                      <div>
                          <span className="text-blue-600">선호 파트:</span>
                        <span className="ml-2 font-medium">
                          {new Set(Object.values(selectedWorker.schedule.daily_preferences || {}).flat()).size}개
                        </span>
                      </div>
                      <div>
                          <span className="text-blue-600">상태:</span>
                        <span className="ml-2 font-medium text-green-600">활성</span>
                      </div>
                      <div>
                          <span className="text-blue-600">마지막 업데이트:</span>
                        <span className="ml-2 font-medium">
                          {selectedWorker.schedule.updated_at ? 
                            new Date(selectedWorker.schedule.updated_at).toLocaleDateString('ko-KR') : 
                            '정보 없음'
                          }
                        </span>
                      </div>
                    </div>
                      
                      {/* 요일별 선호도 표시 */}
                      <div className="grid grid-cols-7 gap-2 text-xs">
                        {['월', '화', '수', '목', '금', '토', '일'].map(day => {
                          const dayPreferences = selectedWorker.schedule.daily_preferences?.[day];
                          const selectedDepartments = dayPreferences?.selected_departments || [];
                          
                        return (
                          <div key={day} className="text-center">
                              <div className="font-medium text-blue-700 mb-1">{day}</div>
                              <div className="bg-white rounded p-2 min-h-[60px] border border-blue-200">
                                {selectedDepartments.length > 0 ? (
                                  <div className="space-y-1">
                                    {selectedDepartments.map((deptId, index) => (
                                      <div key={index} className="text-xs bg-blue-100 p-1 rounded">
                                        {deptId}
                            </div>
                                    ))}
                                  </div>
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
                  {selectedWorker.schedule?.additional_preferences && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-3">추가 선호사항</h4>
                      <div className="text-sm text-gray-600">
                        {selectedWorker.schedule.additional_preferences}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Calendar className="h-8 w-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">아직 설정된 스케줄이 없습니다</h4>
                  <p className="text-gray-600 mb-2">노동자가 선호도 설정에서 스케줄을 설정하면 여기에 표시됩니다.</p>
                  <p className="text-gray-400 text-sm">노동자 관리에서 스케줄 설정을 안내해주세요.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagement;
