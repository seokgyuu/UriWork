/**
 * 파트/주요업무 관리 컴포넌트
 * 파트 관리, 주요업무 관리 기능
 */

import React, { useState, useEffect } from 'react';
import { Briefcase, Target, X, Edit, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const CategoriesManagement = ({ currentUser }) => {
  const [departments, setDepartments] = useState([]);
  const [workFields, setWorkFields] = useState([]);
  const [newDepartment, setNewDepartment] = useState({
    department_name: '',
    required_staff_count: 1,
    work_hours: {
      '월': { enabled: false, start_time: '09:00', end_time: '18:00' },
      '화': { enabled: false, start_time: '09:00', end_time: '18:00' },
      '수': { enabled: false, start_time: '09:00', end_time: '18:00' },
      '목': { enabled: false, start_time: '09:00', end_time: '18:00' },
      '금': { enabled: false, start_time: '09:00', end_time: '18:00' },
      '토': { enabled: false, start_time: '09:00', end_time: '18:00' },
      '일': { enabled: false, start_time: '09:00', end_time: '18:00' }
    }
  });
  const [newWorkTask, setNewWorkTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  // 요일별 파트 필터링 및 계산 함수들
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
  
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
  
  const getTotalStaffForDay = (day) => {
    return getDepartmentsForDay(day).reduce((total, dept) => total + (dept.required_staff_count || 0), 0);
  };

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

  useEffect(() => {
    if (currentUser) {
      fetchDepartments();
      fetchWorkTasks();
    }
  }, [currentUser]);

  const handleEditDepartment = (department) => {
    // 기존 데이터 구조와 새로운 구조를 모두 지원하는 변환 함수
    const convertWorkHours = (workHours) => {
      const converted = {};
      const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
      
      daysOfWeek.forEach(day => {
        if (workHours && workHours[day]) {
          if (typeof workHours[day] === 'boolean') {
            // 기존 구조 (boolean)를 새로운 구조로 변환
            converted[day] = {
              enabled: workHours[day],
              start_time: '09:00',
              end_time: '18:00'
            };
          } else if (typeof workHours[day] === 'object') {
            // 새로운 구조 그대로 사용
            converted[day] = {
              enabled: workHours[day].enabled || false,
              start_time: workHours[day].start_time || '09:00',
              end_time: workHours[day].end_time || '18:00'
            };
          }
        } else {
          // 기본값
          converted[day] = {
            enabled: false,
            start_time: '09:00',
            end_time: '18:00'
          };
        }
      });
      
      return converted;
    };

    setNewDepartment({
      department_id: department.department_id,
      department_name: department.department_name,
      required_staff_count: department.required_staff_count || 1,
      work_hours: convertWorkHours(department.work_hours)
    });
    
    // 파트 등록 섹션으로 스크롤
    const categoriesSection = document.getElementById('categories-section');
    if (categoriesSection) {
      categoriesSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    toast.success('파트 수정 모드로 전환되었습니다. 수정 후 저장 버튼을 클릭하세요.');
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.department_name.trim()) return;
    
    const departmentName = newDepartment.department_name.trim();
    
    try {
      setLoading(true);
      const { collection, doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // 기존 파트 수정인지 확인
      const isEditing = newDepartment.department_id;
      
      if (isEditing) {
        // 기존 파트 수정
        const departmentData = {
          ...newDepartment,
          department_name: departmentName,
          updated_at: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'departments', newDepartment.department_id), departmentData);
        
        // 로컬 상태 업데이트
        setDepartments(prev => prev.map(dept => 
          dept.department_id === newDepartment.department_id ? departmentData : dept
        ));
        
        toast.success('파트가 수정되었습니다');
      } else {
        // 새 파트 추가
        const departmentId = `dept_${Date.now()}`;
        const departmentData = {
          department_id: departmentId,
          department_name: departmentName,
          business_id: currentUser.uid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          required_staff_count: newDepartment.required_staff_count,
          work_hours: newDepartment.work_hours
        };
        
        await setDoc(doc(db, 'departments', departmentId), departmentData);
        
        // 로컬 상태 업데이트
        setDepartments(prev => [...prev, departmentData]);
        
        toast.success('파트가 추가되었습니다');
      }
      
      // 폼 초기화
      setNewDepartment({
        department_name: '',
        required_staff_count: 1,
        work_hours: {
          '월': { enabled: false, start_time: '09:00', end_time: '18:00' },
          '화': { enabled: false, start_time: '09:00', end_time: '18:00' },
          '수': { enabled: false, start_time: '09:00', end_time: '18:00' },
          '목': { enabled: false, start_time: '09:00', end_time: '18:00' },
          '금': { enabled: false, start_time: '09:00', end_time: '18:00' },
          '토': { enabled: false, start_time: '09:00', end_time: '18:00' },
          '일': { enabled: false, start_time: '09:00', end_time: '18:00' }
        }
      });
      
    } catch (error) {
      console.error('파트 저장 에러:', error);
      toast.error('파트 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDepartment = async (index) => {
    const departmentToRemove = departments[index];
    
    try {
      setLoading(true);
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // Firebase에서 파트 삭제
      await deleteDoc(doc(db, 'departments', departmentToRemove.department_id));
      
      // 로컬 상태 업데이트
      const updatedDepartments = departments.filter((_, i) => i !== index);
      setDepartments(updatedDepartments);
      toast.success('파트가 삭제되었습니다');
      
    } catch (error) {
      console.error('파트 삭제 에러:', error);
      toast.error('파트 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 주요업무 추가 함수
  const handleAddWorkTask = async () => {
    if (!newWorkTask.trim()) return;
    
    const taskName = newWorkTask.trim();
    
    try {
      setLoading(true);
      const { collection, doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // Firebase에 주요업무 저장
      const taskId = `task_${Date.now()}`;
      const taskData = {
        task_id: taskId,
        task_name: taskName,
        business_id: currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'work_tasks', taskId), taskData);
      
      // 로컬 상태 업데이트
      setWorkFields(prev => [...prev, taskData]);
      setNewWorkTask('');
      toast.success('주요업무가 추가되었습니다');
      
    } catch (error) {
      console.error('주요업무 저장 에러:', error);
      toast.error('주요업무 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 주요업무 삭제 함수
  const handleRemoveWorkTask = async (index) => {
    const taskToRemove = workFields[index];
    
    try {
      setLoading(true);
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // Firebase에서 주요업무 삭제
      await deleteDoc(doc(db, 'work_tasks', taskToRemove.task_id));
      
      // 로컬 상태 업데이트
      const updatedWorkFields = workFields.filter((_, i) => i !== index);
      setWorkFields(updatedWorkFields);
      toast.success('주요업무가 삭제되었습니다');
      
    } catch (error) {
      console.error('주요업무 삭제 에러:', error);
      toast.error('주요업무 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="categories-section" className="space-y-6">
      {/* 파트 관리 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">파트 관리</h3>
        <p className="text-sm text-gray-600 mb-4">
          업체의 근무 시간대별 파트를 관리합니다.
        </p>
        
        {/* 파트 등록 */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newDepartment.department_name}
              onChange={(e) => setNewDepartment({ ...newDepartment, department_name: e.target.value })}
              placeholder="파트명 입력 (예: 오전, 미들, 마감, 야간)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              min="1"
              value={newDepartment.required_staff_count}
              onChange={(e) => setNewDepartment({ ...newDepartment, required_staff_count: parseInt(e.target.value) || 1 })}
              placeholder="필요 인원"
              className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddDepartment}
              disabled={loading || !newDepartment.department_name.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Briefcase className="h-4 w-4" />
              )}
            </button>
          </div>
          
          {/* 요일별 근무 설정 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              요일별 근무 설정
            </label>
            <div className="grid grid-cols-7 gap-2">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center">
                  <div className="text-sm font-medium text-gray-600 mb-1">{day}</div>
                  <label className="flex items-center justify-center mb-2">
                    <input
                      type="checkbox"
                      checked={newDepartment.work_hours[day].enabled}
                      onChange={(e) => setNewDepartment({
                        ...newDepartment,
                        work_hours: {
                          ...newDepartment.work_hours,
                          [day]: {
                            ...newDepartment.work_hours[day],
                            enabled: e.target.checked
                          }
                        }
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </label>
                  {newDepartment.work_hours[day].enabled && (
                    <div className="space-y-1">
                      <input
                        type="time"
                        value={newDepartment.work_hours[day].start_time}
                        onChange={(e) => setNewDepartment({
                          ...newDepartment,
                          work_hours: {
                            ...newDepartment.work_hours,
                            [day]: {
                              ...newDepartment.work_hours[day],
                              start_time: e.target.value
                            }
                          }
                        })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="time"
                        value={newDepartment.work_hours[day].end_time}
                        onChange={(e) => setNewDepartment({
                          ...newDepartment,
                          work_hours: {
                            ...newDepartment.work_hours,
                            [day]: {
                              ...newDepartment.work_hours[day],
                              end_time: e.target.value
                            }
                          }
                        })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 요일별 요약 뷰 */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-800 mb-3">요일별 파트 현황</h4>
          <div className="grid grid-cols-7 gap-2">
            {daysOfWeek.map(day => {
              const dayDepartments = getDepartmentsForDay(day);
              const totalStaff = getTotalStaffForDay(day);
              const isSelected = selectedDay === day;
              
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : dayDepartments.length > 0 
                        ? 'border-green-200 bg-green-50 hover:border-green-300' 
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-700 mb-1">{day}</div>
                  <div className="text-xs text-gray-600">
                    {dayDepartments.length > 0 ? (
                      <>
                        <div className="font-medium text-green-700">{dayDepartments.length}개 파트</div>
                        <div className="text-green-600">총 {totalStaff}명 필요</div>
                      </>
                    ) : (
                      <div className="text-gray-500">근무 없음</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* 선택된 요일의 상세 정보 */}
        {selectedDay && (
          <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden max-w-md mx-auto">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-3 py-2">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-white">
                  {selectedDay}요일 근무 파트 상세
                </h5>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-white hover:text-gray-200 transition-colors"
                  title="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* 내용 */}
            <div className="p-3">
              {getDepartmentsForDay(selectedDay).length > 0 ? (
                <div className="space-y-2">
                  {/* 파트 목록 */}
                  <div className="grid gap-2">
                    {getDepartmentsForDay(selectedDay).map((dept, index) => {
                      // 시간 정보 가져오기 (기존 구조와 새로운 구조 모두 지원)
                      let timeInfo = '';
                      if (dept.work_hours && dept.work_hours[selectedDay]) {
                        if (typeof dept.work_hours[selectedDay] === 'object' && dept.work_hours[selectedDay].start_time) {
                          timeInfo = `${dept.work_hours[selectedDay].start_time} - ${dept.work_hours[selectedDay].end_time}`;
                        }
                      }
                      
                      return (
                        <div key={index} className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-md p-3 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <div>
                                <span className="font-medium text-gray-800 text-sm">{dept.department_name}</span>
                                {timeInfo && (
                                  <div className="text-xs text-gray-500 mt-1">{timeInfo}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">{dept.required_staff_count}</div>
                                <div className="text-xs text-gray-500">명 필요</div>
                              </div>
                              <button
                                onClick={() => handleEditDepartment(dept)}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="수정"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* 총계 */}
                  <div className="mt-3 pt-3 border-t border-green-200 bg-green-50 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                        <span className="font-medium text-green-800 text-sm">총 필요 인원</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-700">{getTotalStaffForDay(selectedDay)}</div>
                        <div className="text-xs text-green-600 font-medium">명</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Briefcase className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-600 text-sm font-medium">해당 요일에 근무하는 파트가 없습니다.</p>
                  <p className="text-gray-400 text-xs mt-1">파트 등록에서 해당 요일을 선택하여 파트를 추가해보세요.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 주요업무 관리 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">주요업무 관리</h3>
        <p className="text-sm text-gray-600 mb-4">
          업체의 주요업무를 간단하게 입력하여 등록합니다. 파트관리처럼 쉽게 관리할 수 있습니다.
        </p>
        
        {/* 주요업무 등록 */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newWorkTask}
            onChange={(e) => setNewWorkTask(e.target.value)}
            placeholder="주요업무 입력 (예: 주문접수, 배송, 정리정돈, 고객응대)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newWorkTask.trim()) {
                handleAddWorkTask();
              }
            }}
          />
          <button
            onClick={handleAddWorkTask}
            disabled={!newWorkTask.trim() || loading}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Target className="h-4 w-4" />
            )}
          </button>
        </div>
        
        {/* 등록된 주요업무 목록 */}
        {workFields.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {workFields.map((task, index) => (
              <div key={index} className="bg-gray-100 px-3 py-2 rounded-md text-sm flex items-center justify-between">
                <span>{task.task_name}</span>
                <button
                  onClick={() => handleRemoveWorkTask(index)}
                  className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded"
                  title="삭제"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {workFields.length === 0 && (
          <div className="text-center py-4 bg-gray-50 rounded-md">
            <p className="text-gray-500 text-sm">아직 등록된 주요업무가 없습니다.</p>
            <p className="text-gray-400 text-xs mt-1">위에서 주요업무를 추가해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoriesManagement;
