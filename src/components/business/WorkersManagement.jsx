/**
 * 노동자 관리 컴포넌트
 * 피고용자 권한 요청 처리, 노동자 프로필 관리 기능
 */

import React, { useState, useEffect } from 'react';
import { User, X } from 'lucide-react';
import toast from 'react-hot-toast';

const WorkersManagement = ({ currentUser, workFields }) => {
  const [workers, setWorkers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [showWorkerProfile, setShowWorkerProfile] = useState(false);
  const [selectedWorkFields, setSelectedWorkFields] = useState([]);
  const [availableWorkFields, setAvailableWorkFields] = useState([]);

  // 피고용자 목록과 권한 요청 가져오기
  const fetchWorkers = async () => {
    setLoading(true);
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

      // 대기 중인 권한 요청 가져오기
      const pendingQuery = query(
        collection(db, 'permissions'), 
        where('business_id', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      
      const pendingList = [];
      for (const pendingDoc of pendingSnapshot.docs) {
        const pending = pendingDoc.data();
        pendingList.push(pending);
      }
      
      setPendingRequests(pendingList);
    } catch (error) {
      console.error('피고용자 목록 가져오기 에러:', error);
      toast.error('피고용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 권한 승인/거부 처리
  const handlePermissionResponse = async (workerId, status) => {
    try {
      setLoading(true);
      const { doc, updateDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const permissionRef = doc(db, 'permissions', `${workerId}_${currentUser.uid}`);
      await updateDoc(permissionRef, {
        status: status,
        responded_at: new Date().toISOString()
      });
      
      if (status === 'active') {
        toast.success('권한이 승인되었습니다.');
        
        // 승인된 피고용자 정보 가져오기
        const permissionQuery = query(
          collection(db, 'permissions'),
          where('worker_id', '==', workerId),
          where('business_id', '==', currentUser.uid),
          where('status', '==', 'active')
        );
        const permissionSnapshot = await getDocs(permissionQuery);
        
        if (!permissionSnapshot.empty) {
          const permission = permissionSnapshot.docs[0].data();
          
          // 피고용자 정보 가져오기
          const userDoc = await getDocs(query(
            collection(db, 'users'), 
            where('uid', '==', workerId)
          ));
          
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data();
            const workerData = {
              ...permission,
              ...userData
            };
            
            // 바로 노동자 프로필 모달 열기
            handleViewWorkerProfile(workerData);
          }
        }
      } else {
        toast.success('권한이 거부되었습니다.');
      }
      
      // 목록 새로고침
      fetchWorkers();
    } catch (error) {
      console.error('권한 처리 에러:', error);
      toast.error('권한 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 노동자 프로필 보기
  const handleViewWorkerProfile = async (worker) => {
    setSelectedWorker(worker);
    setShowWorkerProfile(true);
    setSelectedWorkFields([]); // 선택된 주요분야 초기화
    
    // 파트 관리에서 등록된 주요업무 사용
    setAvailableWorkFields(workFields || []);
    
    // 기존에 저장된 노동자 프로필 불러오기
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const profileQuery = query(
        collection(db, 'worker_profiles'),
        where('worker_id', '==', worker.worker_id),
        where('business_id', '==', currentUser.uid)
      );
      const profileSnapshot = await getDocs(profileQuery);
      
      if (!profileSnapshot.empty) {
        const profileData = profileSnapshot.docs[0].data();
        if (profileData.assigned_tasks && profileData.assigned_tasks.length > 0) {
          // 저장된 주요업무를 선택된 상태로 설정
          const savedTasks = profileData.assigned_tasks.map(savedTask => {
            const matchingTask = workFields.find(task => task.task_id === savedTask.task_id);
            return matchingTask || savedTask;
          });
          setSelectedWorkFields(savedTasks);
        }
      }
    } catch (error) {
      console.error('노동자 프로필 불러오기 에러:', error);
    }
  };

  // 노동자 프로필 닫기
  const handleCloseWorkerProfile = () => {
    setShowWorkerProfile(false);
    setSelectedWorker(null);
    setSelectedWorkFields([]);
  };

  // 주요분야 추가
  const handleAddWorkFieldToWorker = (taskId) => {
    if (!taskId) return;
    
    const selectedTask = availableWorkFields.find(task => task.task_id === taskId);
    if (selectedTask && !selectedWorkFields.find(field => field.task_id === taskId)) {
      setSelectedWorkFields(prev => [...prev, selectedTask]);
    }
  };

  // 주요분야 제거
  const handleRemoveWorkFieldFromWorker = (taskId) => {
    setSelectedWorkFields(prev => prev.filter(field => field.task_id !== taskId));
  };

  // 노동자 프로필 저장
  const handleSaveWorkerProfile = async () => {
    try {
      setLoading(true);
      const { collection, doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      // 노동자 프로필 데이터 준비
      const workerProfileData = {
        worker_id: selectedWorker.worker_id,
        business_id: currentUser.uid,
        worker_name: selectedWorker.worker_name || selectedWorker.worker_email?.split('@')[0],
        worker_email: selectedWorker.worker_email,
        assigned_tasks: selectedWorkFields.map(task => ({
          task_id: task.task_id,
          task_name: task.task_name
        })),
        updated_at: new Date().toISOString()
      };
      
      // Firebase에 노동자 프로필 저장
      const profileId = `worker_profile_${selectedWorker.worker_id}_${currentUser.uid}`;
      await setDoc(doc(db, 'worker_profiles', profileId), workerProfileData);
      
      toast.success('노동자 프로필이 저장되었습니다.');
      handleCloseWorkerProfile();
      
      // 목록 새로고침
      fetchWorkers();
    } catch (error) {
      console.error('노동자 프로필 저장 에러:', error);
      toast.error('노동자 프로필 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 피고용자 목록 가져오기
  useEffect(() => {
    fetchWorkers();
  }, []);

  return (
    <div className="space-y-6">
      {/* 권한 요청 대기 목록 */}
      {pendingRequests.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">권한 요청 대기</h3>
          
          <div className="space-y-4">
            {pendingRequests.map((request, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {request.worker_name || request.worker_email?.split('@')[0] || '이름 없음'}
                    </h4>
                    <p className="text-sm text-gray-600">{request.worker_email}</p>
                    <p className="text-xs text-gray-500">
                      요청일: {new Date(request.requested_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePermissionResponse(request.worker_id, 'active')}
                    disabled={loading}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handlePermissionResponse(request.worker_id, 'rejected')}
                    disabled={loading}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    거부
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 피고용자 목록 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">피고용자 목록</h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-600 mt-2">피고용자 목록을 불러오는 중...</p>
          </div>
        ) : workers.length > 0 ? (
          <div className="space-y-4">
            {workers.map((worker, index) => (
              <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {worker.worker_name || worker.worker_email?.split('@')[0] || '이름 없음'}
                    </h4>
                    <p className="text-sm text-gray-600">{worker.worker_email}</p>
                    <p className="text-xs text-gray-500">
                      권한 부여일: {new Date(worker.granted_at).toLocaleDateString('ko-KR')}
                    </p>
                    {worker.assigned_tasks && worker.assigned_tasks.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">할당된 업무:</p>
                        <div className="flex flex-wrap gap-1">
                          {worker.assigned_tasks.slice(0, 3).map((task, idx) => (
                            <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              {task.task_name}
                            </span>
                          ))}
                          {worker.assigned_tasks.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{worker.assigned_tasks.length - 3}개 더
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    활성
                  </span>
                  <button
                    onClick={() => handleViewWorkerProfile(worker)}
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                  >
                    프로필 보기
                  </button>
                  <button
                    onClick={() => handlePermissionResponse(worker.worker_id, 'rejected')}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    권한 해제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">아직 등록된 피고용자가 없습니다.</p>
            <p className="text-sm text-gray-500 mt-2">
              프로필에서 고유 코드를 생성하여 피고용자에게 전달해보세요.
            </p>
          </div>
        )}
      </div>

      {/* 노동자 프로필 모달 */}
      {showWorkerProfile && selectedWorker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">노동자 프로필</h3>
              <button
                onClick={handleCloseWorkerProfile}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {selectedWorker.worker_name || selectedWorker.worker_email?.split('@')[0] || '이름 없음'}
                  </h4>
                  <p className="text-sm text-gray-600">{selectedWorker.worker_email}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h5 className="font-medium text-gray-900 mb-2">주요업무 설정</h5>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주요업무 선택
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onChange={(e) => handleAddWorkFieldToWorker(e.target.value)}
                      value=""
                    >
                      <option value="">주요업무를 선택하세요</option>
                      {availableWorkFields.map((task, index) => (
                        <option key={index} value={task.task_id}>
                          {task.task_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedWorkFields.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        선택된 주요업무
                      </label>
                      <div className="space-y-2">
                        {selectedWorkFields.map((field, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-md">
                            <span className="text-sm text-blue-800">
                              {field.task_name}
                            </span>
                            <button
                              onClick={() => handleRemoveWorkFieldFromWorker(field.task_id)}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="제거"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {availableWorkFields.length === 0 && (
                    <div className="text-center py-4 bg-gray-50 rounded-md">
                      <p className="text-sm text-gray-600">등록된 주요업무가 없습니다.</p>
                      <p className="text-xs text-gray-500 mt-1">파트 관리에서 주요업무를 먼저 등록해주세요.</p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    파트 관리에서 등록한 주요업무를 선택하여 노동자에게 할당할 수 있습니다.
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h5 className="font-medium text-gray-900 mb-2">권한 정보</h5>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>권한 부여일: {new Date(selectedWorker.granted_at).toLocaleDateString('ko-KR')}</p>
                  <p>상태: <span className="text-green-600 font-medium">활성</span></p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={handleCloseWorkerProfile}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                다음에 하기
              </button>
              <button 
                onClick={handleSaveWorkerProfile}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkersManagement;
