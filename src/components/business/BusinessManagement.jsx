/**
 * 업장 관리 컴포넌트
 * 사용자가 여러 업장을 관리할 수 있는 페이지
 * 업장 추가, 선택, 편집, 삭제 기능 제공
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { businessManagementAPI } from '../../services/api';
import { 
  Plus, 
  Building, 
  Edit, 
  Trash2, 
  Check, 
  X,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';

const BusinessManagement = () => {
  const { currentUser } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [isAddingBusiness, setIsAddingBusiness] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: ''
  });

  // 업장 목록 불러오기
  const fetchBusinesses = async () => {
    if (!currentUser) {
      console.log('사용자가 로그인되지 않음');
      return;
    }
    
    try {
      setLoading(true);
      console.log('업장 목록 불러오기 시작, 사용자 ID:', currentUser.uid);
      
      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const businessesQuery = query(
        collection(db, 'businesses'),
        where('owner_id', '==', currentUser.uid),
        orderBy('created_at', 'desc')
      );
      
      console.log('Firestore 쿼리 실행 중...');
      const businessesSnapshot = await getDocs(businessesQuery);
      console.log('쿼리 결과 문서 수:', businessesSnapshot.size);
      
      const businessesList = [];
      
      businessesSnapshot.forEach((doc) => {
        const businessData = {
          id: doc.id,
          ...doc.data()
        };
        console.log('업장 데이터:', businessData);
        businessesList.push(businessData);
      });
      
      console.log('최종 업장 목록:', businessesList);
      setBusinesses(businessesList);
      
      // 첫 번째 업장을 기본 선택
      if (businessesList.length > 0 && !selectedBusiness) {
        setSelectedBusiness(businessesList[0]);
        console.log('기본 업장 선택:', businessesList[0]);
      }
    } catch (error) {
      console.error('업장 목록 불러오기 에러:', error);
      toast.error('업장 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 업장 추가
  const handleAddBusiness = async () => {
    if (!formData.name.trim()) {
      toast.error('업장명을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      console.log('업장 추가 시작:', formData.name);
      
      // 고유 코드 생성
      const uniqueCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const businessData = {
        name: formData.name,
        owner_id: currentUser.uid,
        unique_code: uniqueCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
      };
      
      console.log('업장 데이터:', businessData);
      
      // Firestore에 직접 저장 (백엔드 API 대신)
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      console.log('Firestore에 저장 시작...');
      const docRef = await addDoc(collection(db, 'businesses'), businessData);
      console.log('Firestore 저장 완료, 문서 ID:', docRef.id);
      
      const newBusiness = {
        id: docRef.id,
        ...businessData
      };
      
      console.log('새 업장 객체:', newBusiness);
      
      setBusinesses([newBusiness, ...businesses]);
      setSelectedBusiness(newBusiness);
      setIsAddingBusiness(false);
      resetForm();
      
      console.log('업장 추가 완료, 업장 목록 업데이트됨');
      toast.success(`업장이 추가되었습니다! 고유 코드: ${uniqueCode}`);
    } catch (error) {
      console.error('업장 추가 에러:', error);
      console.error('에러 상세:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      if (error.code === 'permission-denied') {
        toast.error('권한이 없습니다. Firebase 보안 규칙을 확인해주세요.');
      } else if (error.code === 'unavailable') {
        toast.error('네트워크 연결을 확인해주세요.');
      } else {
        toast.error(`업장 추가에 실패했습니다: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 업장 수정
  const handleUpdateBusiness = async () => {
    if (!selectedBusiness || !formData.name.trim()) {
      toast.error('업장명을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      // Firestore에 직접 업데이트
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const updateData = {
        name: formData.name,
        updated_at: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'businesses', selectedBusiness.id), updateData);
      
      const updatedBusiness = {
        ...selectedBusiness,
        ...updateData
      };
      
      setBusinesses(businesses.map(b => 
        b.id === selectedBusiness.id ? updatedBusiness : b
      ));
      setSelectedBusiness(updatedBusiness);
      setIsEditing(false);
      resetForm();
      toast.success('업장 정보가 수정되었습니다.');
    } catch (error) {
      console.error('업장 수정 에러:', error);
      toast.error('업장 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 업장 삭제
  const handleDeleteBusiness = async (businessId) => {
    if (!confirm('정말로 이 업장을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      
      // Firestore에서 직접 삭제
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      await deleteDoc(doc(db, 'businesses', businessId));
      
      const updatedBusinesses = businesses.filter(b => b.id !== businessId);
      setBusinesses(updatedBusinesses);
      
      if (selectedBusiness?.id === businessId) {
        setSelectedBusiness(updatedBusinesses.length > 0 ? updatedBusinesses[0] : null);
      }
      
      toast.success('업장이 삭제되었습니다.');
    } catch (error) {
      console.error('업장 삭제 에러:', error);
      toast.error('업장 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: ''
    });
  };

  // 편집 모드 시작
  const startEditing = (business) => {
    setFormData({
      name: business.name || ''
    });
    setIsEditing(true);
  };

  // 편집 취소
  const cancelEditing = () => {
    setIsEditing(false);
    resetForm();
  };

  // 업장 선택
  const selectBusiness = (business) => {
    setSelectedBusiness(business);
    setIsEditing(false);
    resetForm();
  };

  useEffect(() => {
    fetchBusinesses();
  }, [currentUser]);

  if (loading && businesses.length === 0) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">업장 관리</h2>
        <button
          onClick={() => setIsAddingBusiness(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>업장 추가</span>
        </button>
      </div>

      {/* 업장 목록 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">내 업장 목록</h3>
        {businesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map((business) => (
              <div
                key={business.id}
                className="p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white"
                onClick={() => {
                  // 업장 선택 후 해당 업장의 대시보드로 이동
                  setSelectedBusiness(business);
                  
                  // 부모 컴포넌트에 업장 변경 알림
                  const event = new CustomEvent('businessSelected', {
                    detail: { business }
                  });
                  window.dispatchEvent(event);
                  
                  // 부모 컴포넌트에 직접 호출
                  if (window.parent && window.parent.postMessage) {
                    window.parent.postMessage({
                      type: 'BUSINESS_SELECTED',
                      business: business
                    }, '*');
                  }
                  
                  // 로컬 스토리지에 선택된 업장 저장
                  localStorage.setItem('selectedBusiness', JSON.stringify(business));
                  
                  console.log('업장 선택됨:', business);
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 truncate">{business.name}</h4>
                  <Building className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  고유 코드: {business.unique_code}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(business);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 rounded hover:bg-blue-50"
                  >
                    수정
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBusiness(business.id);
                    }}
                    className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 업장이 없습니다</h3>
            <p className="text-gray-500 mb-4">첫 번째 업장을 추가해보세요!</p>
            <button
              onClick={() => setIsAddingBusiness(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              업장 추가하기
            </button>
          </div>
        )}
      </div>


      {/* 업장 추가 모달 */}
      {isAddingBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">새 업장 추가</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업장명 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="업장명을 입력하세요"
                />
              </div>
            </div>

            <div className="flex space-x-2 mt-6">
              <button
                onClick={handleAddBusiness}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                추가
              </button>
              <button
                onClick={() => {
                  setIsAddingBusiness(false);
                  resetForm();
                }}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업장 수정 모달 */}
      {isEditing && selectedBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">업장 수정</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업장명 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="업장명을 입력하세요"
                />
              </div>
            </div>

            <div className="flex space-x-2 mt-6">
              <button
                onClick={handleUpdateBusiness}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                저장
              </button>
              <button
                onClick={cancelEditing}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessManagement;
