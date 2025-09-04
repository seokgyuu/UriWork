/**
 * 파트/주요업무 관리 컴포넌트
 * 파트 관리, 주요업무 관리 기능
 */

import React, { useState, useEffect } from 'react';
import { Briefcase, Target, X, Edit, Calendar, Copy, Trash2, Save, RotateCcw, Clock, Users, CheckCircle, AlertCircle, Info, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';

const CategoriesManagement = ({ currentUser }) => {
  const [departments, setDepartments] = useState([]);
  const [workFields, setWorkFields] = useState([]);
  const [newDepartment, setNewDepartment] = useState({
    department_name: '',
    required_staff_count: 1,
    work_hours: {
      '월': { enabled: false, time_slots: [] },
      '화': { enabled: false, time_slots: [] },
      '수': { enabled: false, time_slots: [] },
      '목': { enabled: false, time_slots: [] },
      '금': { enabled: false, time_slots: [] },
      '토': { enabled: false, time_slots: [] },
      '일': { enabled: false, time_slots: [] }
    }
  });
  const [newWorkTask, setNewWorkTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [expandedDays, setExpandedDays] = useState({});

  // 사전 설정된 근무 패턴 템플릿
  const workTemplates = [
    {
      name: '일반 사무직',
      description: '월-금 09:00-18:00',
      work_hours: {
        '월': { enabled: true, time_slots: [{ id: 1, start_time: '09:00', end_time: '18:00' }] },
        '화': { enabled: true, time_slots: [{ id: 2, start_time: '09:00', end_time: '18:00' }] },
        '수': { enabled: true, time_slots: [{ id: 3, start_time: '09:00', end_time: '18:00' }] },
        '목': { enabled: true, time_slots: [{ id: 4, start_time: '09:00', end_time: '18:00' }] },
        '금': { enabled: true, time_slots: [{ id: 5, start_time: '09:00', end_time: '18:00' }] },
        '토': { enabled: false, time_slots: [] },
        '일': { enabled: false, time_slots: [] }
      }
    },
    {
      name: '서비스업 (주말 포함)',
      description: '월-일 10:00-22:00',
      work_hours: {
        '월': { enabled: true, time_slots: [{ id: 6, start_time: '10:00', end_time: '22:00' }] },
        '화': { enabled: true, time_slots: [{ id: 7, start_time: '10:00', end_time: '22:00' }] },
        '수': { enabled: true, time_slots: [{ id: 8, start_time: '10:00', end_time: '22:00' }] },
        '목': { enabled: true, time_slots: [{ id: 9, start_time: '10:00', end_time: '22:00' }] },
        '금': { enabled: true, time_slots: [{ id: 10, start_time: '10:00', end_time: '22:00' }] },
        '토': { enabled: true, time_slots: [{ id: 11, start_time: '10:00', end_time: '22:00' }] },
        '일': { enabled: true, time_slots: [{ id: 12, start_time: '10:00', end_time: '22:00' }] }
      }
    },
    {
      name: '교대근무 (주간)',
      description: '월-금 06:00-14:00',
      work_hours: {
        '월': { enabled: true, time_slots: [{ id: 13, start_time: '06:00', end_time: '14:00' }] },
        '화': { enabled: true, time_slots: [{ id: 14, start_time: '06:00', end_time: '14:00' }] },
        '수': { enabled: true, time_slots: [{ id: 15, start_time: '06:00', end_time: '14:00' }] },
        '목': { enabled: true, time_slots: [{ id: 16, start_time: '06:00', end_time: '14:00' }] },
        '금': { enabled: true, time_slots: [{ id: 17, start_time: '06:00', end_time: '14:00' }] },
        '토': { enabled: false, time_slots: [] },
        '일': { enabled: false, time_slots: [] }
      }
    },
    {
      name: '교대근무 (야간)',
      description: '월-금 22:00-06:00',
      work_hours: {
        '월': { enabled: true, time_slots: [{ id: 18, start_time: '22:00', end_time: '06:00' }] },
        '화': { enabled: true, time_slots: [{ id: 19, start_time: '22:00', end_time: '06:00' }] },
        '수': { enabled: true, time_slots: [{ id: 20, start_time: '22:00', end_time: '06:00' }] },
        '목': { enabled: true, time_slots: [{ id: 21, start_time: '22:00', end_time: '06:00' }] },
        '금': { enabled: true, time_slots: [{ id: 22, start_time: '22:00', end_time: '06:00' }] },
        '토': { enabled: false, time_slots: [] },
        '일': { enabled: false, time_slots: [] }
      }
    }
  ];

  // 요일별 파트 필터링 및 계산 함수들
  const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
  
  const getDepartmentsForDay = (day) => {
    return departments.filter(dept => {
      if (!dept.work_hours) return false;
      
      // 기존 구조 (boolean)와 새로운 구조 (object) 모두 지원
      if (typeof dept.work_hours[day] === 'boolean') {
        return dept.work_hours[day];
      } else if (dept.work_hours[day] && typeof dept.work_hours[day] === 'object') {
        return dept.work_hours[day].enabled || (dept.work_hours[day].time_slots && dept.work_hours[day].time_slots.length > 0);
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
              time_slots: workHours[day] ? [{ id: Date.now(), start_time: '09:00', end_time: '18:00' }] : []
            };
          } else if (typeof workHours[day] === 'object') {
            // 새로운 구조 그대로 사용
            if (workHours[day].time_slots) {
              converted[day] = {
                enabled: workHours[day].enabled || workHours[day].time_slots.length > 0,
                time_slots: workHours[day].time_slots
              };
            } else {
              // 기존 object 구조를 time_slots로 변환
              converted[day] = {
                enabled: workHours[day].enabled || false,
                time_slots: workHours[day].enabled ? [{ 
                  id: Date.now(), 
                  start_time: workHours[day].start_time || '09:00', 
                  end_time: workHours[day].end_time || '18:00' 
                }] : []
              };
            }
          }
        } else {
          // 기본값
          converted[day] = {
            enabled: false,
            time_slots: []
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

  // 템플릿 적용 함수
  const applyTemplate = (template) => {
    setNewDepartment({
      ...newDepartment,
      work_hours: template.work_hours
    });
    setShowTemplates(false);
    toast.success(`"${template.name}" 템플릿이 적용되었습니다`);
  };

  // 파트 복사 함수
  const handleCopyDepartment = (department) => {
    setNewDepartment({
      department_name: `${department.department_name} (복사본)`,
      required_staff_count: department.required_staff_count,
      work_hours: department.work_hours
    });
    toast.success('파트가 복사되었습니다. 수정 후 저장하세요.');
  };

  // 일괄 선택 토글
  const toggleDepartmentSelection = (departmentId) => {
    setSelectedDepartments(prev => 
      prev.includes(departmentId) 
        ? prev.filter(id => id !== departmentId)
        : [...prev, departmentId]
    );
  };

  // 전체 선택/해제
  const toggleAllDepartments = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments(departments.map(dept => dept.department_id));
    }
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedDepartments.length === 0) {
      toast.error('삭제할 파트를 선택해주세요');
      return;
    }

    if (!confirm(`선택한 ${selectedDepartments.length}개 파트를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      setLoading(true);
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // 선택된 파트들 삭제
      await Promise.all(
        selectedDepartments.map(departmentId => 
          deleteDoc(doc(db, 'departments', departmentId))
        )
      );
      
      // 로컬 상태 업데이트
      setDepartments(prev => 
        prev.filter(dept => !selectedDepartments.includes(dept.department_id))
      );
      setSelectedDepartments([]);
      setShowBulkActions(false);
      toast.success(`${selectedDepartments.length}개 파트가 삭제되었습니다`);
      
    } catch (error) {
      console.error('일괄 삭제 에러:', error);
      toast.error('일괄 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 시간대 추가 함수
  const addTimeSlot = (day) => {
    setNewDepartment(prev => ({
      ...prev,
      work_hours: {
        ...prev.work_hours,
        [day]: {
          ...prev.work_hours[day],
          time_slots: [
            ...prev.work_hours[day].time_slots,
            { id: Date.now(), start_time: '09:00', end_time: '18:00' }
          ]
        }
      }
    }));
  };

  // 시간대 삭제 함수
  const removeTimeSlot = (day, slotId) => {
    setNewDepartment(prev => ({
      ...prev,
      work_hours: {
        ...prev.work_hours,
        [day]: {
          ...prev.work_hours[day],
          time_slots: prev.work_hours[day].time_slots.filter(slot => slot.id !== slotId)
        }
      }
    }));
  };

  // 시간대 수정 함수
  const updateTimeSlot = (day, slotId, field, value) => {
    setNewDepartment(prev => ({
      ...prev,
      work_hours: {
        ...prev.work_hours,
        [day]: {
          ...prev.work_hours[day],
          time_slots: prev.work_hours[day].time_slots.map(slot =>
            slot.id === slotId ? { ...slot, [field]: value } : slot
          )
        }
      }
    }));
  };

  // 폼 초기화
  const resetForm = () => {
    setNewDepartment({
      department_name: '',
      required_staff_count: 1,
      work_hours: {
        '월': { enabled: false, time_slots: [] },
        '화': { enabled: false, time_slots: [] },
        '수': { enabled: false, time_slots: [] },
        '목': { enabled: false, time_slots: [] },
        '금': { enabled: false, time_slots: [] },
        '토': { enabled: false, time_slots: [] },
        '일': { enabled: false, time_slots: [] }
      }
    });
  };

  // 요일별 아코디언 토글
  const toggleDayExpansion = (day) => {
    setExpandedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
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
          {/* 헤더와 액션 버튼들 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">새 파트 등록</h4>
              <p className="text-sm text-gray-600">파트명, 인원수, 근무 시간을 설정하세요</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                <Calendar className="h-4 w-4 mr-1" />
                템플릿
              </button>
              <button
                onClick={resetForm}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                초기화
              </button>
            </div>
          </div>

          {/* 템플릿 선택 */}
          {showTemplates && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="text-sm font-medium text-blue-900 mb-3">근무 패턴 템플릿 선택</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {workTemplates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => applyTemplate(template)}
                    className="text-left p-3 bg-white border border-blue-200 rounded-md hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="font-medium text-gray-900 text-sm">{template.name}</div>
                    <div className="text-xs text-gray-600 mt-1">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 파트 등록 폼 */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  파트명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDepartment.department_name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, department_name: e.target.value })}
                  placeholder="예: 주방, 홀서빙, 매장관리"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div className="w-full sm:w-24">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  필요 인원 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newDepartment.required_staff_count}
                  onChange={(e) => setNewDepartment({ ...newDepartment, required_staff_count: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-center"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddDepartment}
                  disabled={loading || !newDepartment.department_name.trim()}
                  className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2 min-h-[42px]"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {newDepartment.department_id ? '수정' : '추가'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* 입력 검증 메시지 */}
            {!newDepartment.department_name.trim() && (
              <div className="mt-2 flex items-center text-sm text-amber-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                파트명을 입력해주세요
              </div>
            )}
          </div>
          
          {/* 요일별 근무 설정 */}
                  <div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">요일별 근무 설정</h3>
              <p className="text-sm text-gray-600">체크한 요일에만 근무 시간을 설정합니다</p>
            </div>
            
            <div className="grid grid-cols-7 gap-3 mb-6">
              {daysOfWeek.map(day => (
                <div key={day} className="text-center">
                  <div className="text-sm font-medium text-gray-700 mb-3">{day}</div>
                  <label className="flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDepartment.work_hours[day].enabled}
                      onChange={(e) => setNewDepartment({
                        ...newDepartment,
                        work_hours: {
                          ...newDepartment.work_hours,
                          [day]: {
                            ...newDepartment.work_hours[day],
                            enabled: e.target.checked,
                            time_slots: e.target.checked && newDepartment.work_hours[day].time_slots.length === 0 
                              ? [{ id: Date.now(), start_time: '09:00', end_time: '18:00' }]
                              : newDepartment.work_hours[day].time_slots
                          }
                        }
                      })}
                      className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    />
                  </label>
                </div>
              ))}
            </div>

              {/* 근무 시간 설정 영역 */}
              <div className="space-y-3">
                {daysOfWeek.map(day => (
                  newDepartment.work_hours[day].enabled && (
                    <div key={day} className="border border-gray-200 rounded-lg">
                      {/* 아코디언 헤더 */}
                      <button
                        onClick={() => toggleDayExpansion(day)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors duration-200"
                      >
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-4 w-4 text-gray-600" />
                          <h4 className="text-sm font-medium text-gray-800">
                            {day}요일 근무 시간
                          </h4>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {newDepartment.work_hours[day].time_slots.length}개 시간대
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {/* 시간 요약 */}
                          {newDepartment.work_hours[day].time_slots.length > 0 && (
                            <div className="text-xs text-gray-500">
                              {newDepartment.work_hours[day].time_slots.map(slot => 
                                `${slot.start_time}-${slot.end_time}`
                              ).join(', ')}
                            </div>
                          )}
                          {/* 화살표 아이콘 */}
                          <div className={`transform transition-transform duration-200 ${
                            expandedDays[day] ? 'rotate-180' : 'rotate-0'
                          }`}>
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </button>

                      {/* 아코디언 콘텐츠 */}
                      {expandedDays[day] && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                          <div className="space-y-3 pt-4">
                            {/* 시간대 목록 */}
                            {newDepartment.work_hours[day].time_slots.map((slot, slotIndex) => (
                              <div key={slot.id} className="bg-gray-50 rounded p-3 border border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-2">
                                    <Clock className="h-4 w-4 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700">
                                      {slotIndex + 1}번째 시간대
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => removeTimeSlot(day, slot.id)}
                                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                                    title="이 시간대 삭제"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">시작 시간</label>
                                    <input
                                      type="time"
                                      value={slot.start_time}
                                      onChange={(e) => updateTimeSlot(day, slot.id, 'start_time', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">종료 시간</label>
                                    <input
                                      type="time"
                                      value={slot.end_time}
                                      onChange={(e) => updateTimeSlot(day, slot.id, 'end_time', e.target.value)}
                                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                  </div>
                                </div>
                                
                                {/* 시간대 요약 */}
                                <div className="mt-3 p-2 bg-white rounded border border-gray-200">
                                  <div className="text-center text-sm text-gray-700 font-medium">
                                    {slot.start_time} ~ {slot.end_time}
                                  </div>
                                </div>
                              </div>
                            ))}
                            
                            {/* 시간대 추가 버튼 */}
                            <button
                              onClick={() => addTimeSlot(day)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 bg-gray-50 border border-dashed border-gray-300 rounded hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 text-sm"
                            >
                              <Plus className="h-4 w-4" />
                              <span>{day}요일에 시간대 추가</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ))}

                {/* 휴무 요일 표시 */}
                {daysOfWeek.filter(day => !newDepartment.work_hours[day].enabled).length > 0 && (
                  <div className="bg-gray-50 rounded p-4 border border-gray-200">
                    <div className="flex items-center justify-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span className="text-sm">
                        휴무 요일: {daysOfWeek.filter(day => !newDepartment.work_hours[day].enabled).join(', ')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* 요일별 요약 뷰 */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h4 className="text-md font-medium text-gray-800">요일별 파트 현황</h4>
            {departments.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="flex items-center px-3 py-1 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Users className="h-4 w-4 mr-1" />
                  일괄 작업
                </button>
                <div className="text-sm text-gray-500 flex items-center">
                  <Info className="h-4 w-4 mr-1" />
                  총 {departments.length}개 파트
                </div>
              </div>
            )}
          </div>

          {/* 일괄 작업 패널 */}
          {showBulkActions && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAllDepartments}
                    className="flex items-center px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 border border-blue-200 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {selectedDepartments.length === departments.length ? '전체 해제' : '전체 선택'}
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedDepartments.length}개 선택됨
                  </span>
                </div>
                {selectedDepartments.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={loading}
                    className="flex items-center px-3 py-1 text-sm font-medium text-red-600 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    선택 삭제
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {daysOfWeek.map(day => {
              const dayDepartments = getDepartmentsForDay(day);
              const totalStaff = getTotalStaffForDay(day);
              const isSelected = selectedDay === day;
              
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`p-2 sm:p-3 rounded-lg border-2 transition-all touch-target ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : dayDepartments.length > 0 
                        ? 'border-green-200 bg-green-50 hover:border-green-300' 
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-medium text-gray-700 mb-1 text-responsive-xs">{day}</div>
                  <div className="text-xs text-gray-600 text-responsive-xs">
                    {dayDepartments.length > 0 ? (
                      <>
                        <div className="font-medium text-green-700">{dayDepartments.length}개</div>
                        <div className="text-green-600">{totalStaff}명</div>
                      </>
                    ) : (
                      <div className="text-gray-500">없음</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* 선택된 요일의 상세 정보 */}
        {selectedDay && (
          <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
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
                        if (dept.work_hours[selectedDay].time_slots && dept.work_hours[selectedDay].time_slots.length > 0) {
                          // 새로운 구조: time_slots 배열
                          timeInfo = dept.work_hours[selectedDay].time_slots
                            .map(slot => `${slot.start_time} - ${slot.end_time}`)
                            .join(', ');
                        } else if (typeof dept.work_hours[selectedDay] === 'object' && dept.work_hours[selectedDay].start_time) {
                          // 기존 구조: start_time, end_time
                          timeInfo = `${dept.work_hours[selectedDay].start_time} - ${dept.work_hours[selectedDay].end_time}`;
                        }
                      }
                      
                      return (
                        <div key={index} className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-md p-4 hover:shadow-sm transition-shadow">
                          {/* 모바일: 세로 레이아웃 */}
                          <div className="block sm:hidden">
                            <div className="flex items-center space-x-2 mb-3">
                              {showBulkActions && (
                                <input
                                  type="checkbox"
                                  checked={selectedDepartments.includes(dept.department_id)}
                                  onChange={() => toggleDepartmentSelection(dept.department_id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                              )}
                              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                              <span className="font-medium text-gray-800 text-sm">{dept.department_name}</span>
                            </div>
                            {timeInfo && (
                              <div className="text-xs text-gray-500 mb-3">{timeInfo}</div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="text-left">
                                <div className="text-lg font-bold text-green-600">{dept.required_staff_count}명</div>
                                <div className="text-xs text-gray-500">필요</div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleCopyDepartment(dept)}
                                  className="px-3 py-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target border border-gray-200 hover:border-blue-300"
                                  title="복사"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEditDepartment(dept)}
                                  className="px-3 py-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target border border-gray-200 hover:border-blue-300"
                                  title="수정"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* 데스크톱: 가로 레이아웃 */}
                          <div className="hidden sm:flex sm:items-center sm:justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              {showBulkActions && (
                                <input
                                  type="checkbox"
                                  checked={selectedDepartments.includes(dept.department_id)}
                                  onChange={() => toggleDepartmentSelection(dept.department_id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                              )}
                              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-800 text-sm block truncate">{dept.department_name}</span>
                                {timeInfo && (
                                  <div className="text-xs text-gray-500 mt-1">{timeInfo}</div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">{dept.required_staff_count}명</div>
                                <div className="text-xs text-gray-500">필요</div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleCopyDepartment(dept)}
                                  className="px-3 py-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target border border-gray-200 hover:border-blue-300"
                                  title="복사"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEditDepartment(dept)}
                                  className="px-3 py-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors touch-target border border-gray-200 hover:border-blue-300"
                                  title="수정"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">주요업무 관리</h3>
            <p className="text-sm text-gray-600">
              업체의 주요업무를 간단하게 입력하여 등록합니다.
            </p>
          </div>
          <div className="text-sm text-gray-500 flex items-center">
            <Info className="h-4 w-4 mr-1" />
            총 {workFields.length}개 업무
          </div>
        </div>
        
        {/* 주요업무 등록 */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주요업무명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWorkTask}
                onChange={(e) => setNewWorkTask(e.target.value)}
                placeholder="예: 주문접수, 배송, 정리정돈, 고객응대, 재고관리"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newWorkTask.trim()) {
                    handleAddWorkTask();
                  }
                }}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddWorkTask}
                disabled={!newWorkTask.trim() || loading}
                className="w-full sm:w-auto bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2 min-h-[42px]"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Target className="h-4 w-4" />
                    <span className="text-sm font-medium">추가</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* 입력 검증 메시지 */}
          {!newWorkTask.trim() && (
            <div className="mt-2 flex items-center text-sm text-amber-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              주요업무명을 입력해주세요
            </div>
          )}
        </div>
        
        {/* 등록된 주요업무 목록 */}
        {workFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {workFields.map((task, index) => (
              <div key={index} className="bg-gray-100 px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm flex items-center justify-between text-responsive-sm">
                <span className="flex-1 min-w-0 truncate pr-2">{task.task_name}</span>
                <button
                  onClick={() => handleRemoveWorkTask(index)}
                  className="text-red-600 hover:text-red-800 hover:bg-red-100 p-1 rounded flex-shrink-0 touch-target"
                  title="삭제"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
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
