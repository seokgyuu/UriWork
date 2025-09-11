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
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
    business_type: '',
    operating_hours: {
      monday: { start: '09:00', end: '18:00', closed: false },
      tuesday: { start: '09:00', end: '18:00', closed: false },
      wednesday: { start: '09:00', end: '18:00', closed: false },
      thursday: { start: '09:00', end: '18:00', closed: false },
      friday: { start: '09:00', end: '18:00', closed: false },
      saturday: { start: '10:00', end: '16:00', closed: false },
      sunday: { start: '00:00', end: '00:00', closed: true }
    }
  });

  // 업장 목록 불러오기
  const fetchBusinesses = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const response = await businessManagementAPI.getBusinesses();
      
      if (response.data.success) {
        setBusinesses(response.data.businesses);
        
        // 첫 번째 업장을 기본 선택
        if (response.data.businesses.length > 0 && !selectedBusiness) {
          setSelectedBusiness(response.data.businesses[0]);
        }
      } else {
        throw new Error('업장 목록을 불러올 수 없습니다.');
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
      const businessData = {
        ...formData,
        owner_id: currentUser.uid
      };
      
      const response = await businessManagementAPI.createBusiness(businessData);
      
      if (response.data.success) {
        const newBusiness = response.data.business;
        setBusinesses([newBusiness, ...businesses]);
        setSelectedBusiness(newBusiness);
        setIsAddingBusiness(false);
        resetForm();
        toast.success('업장이 추가되었습니다.');
      } else {
        throw new Error('업장 추가에 실패했습니다.');
      }
    } catch (error) {
      console.error('업장 추가 에러:', error);
      toast.error('업장 추가에 실패했습니다.');
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
      const updateData = {
        ...formData
      };
      
      const response = await businessManagementAPI.updateBusiness(selectedBusiness.id, updateData);
      
      if (response.data.success) {
        const updatedBusiness = response.data.business;
        
        setBusinesses(businesses.map(b => 
          b.id === selectedBusiness.id ? updatedBusiness : b
        ));
        setSelectedBusiness(updatedBusiness);
        setIsEditing(false);
        toast.success('업장 정보가 수정되었습니다.');
      } else {
        throw new Error('업장 수정에 실패했습니다.');
      }
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
      const response = await businessManagementAPI.deleteBusiness(businessId);
      
      if (response.data.success) {
        const updatedBusinesses = businesses.filter(b => b.id !== businessId);
        setBusinesses(updatedBusinesses);
        
        if (selectedBusiness?.id === businessId) {
          setSelectedBusiness(updatedBusinesses.length > 0 ? updatedBusinesses[0] : null);
        }
        
        toast.success('업장이 삭제되었습니다.');
      } else {
        throw new Error('업장 삭제에 실패했습니다.');
      }
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
      name: '',
      address: '',
      phone: '',
      email: '',
      description: '',
      business_type: '',
      operating_hours: {
        monday: { start: '09:00', end: '18:00', closed: false },
        tuesday: { start: '09:00', end: '18:00', closed: false },
        wednesday: { start: '09:00', end: '18:00', closed: false },
        thursday: { start: '09:00', end: '18:00', closed: false },
        friday: { start: '09:00', end: '18:00', closed: false },
        saturday: { start: '10:00', end: '16:00', closed: false },
        sunday: { start: '00:00', end: '00:00', closed: true }
      }
    });
  };

  // 편집 모드 시작
  const startEditing = (business) => {
    setFormData({
      name: business.name || '',
      address: business.address || '',
      phone: business.phone || '',
      email: business.email || '',
      description: business.description || '',
      business_type: business.business_type || '',
      operating_hours: business.operating_hours || formData.operating_hours
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 업장 목록 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">업장 목록</h3>
          <div className="space-y-2">
            {businesses.map((business) => (
              <div
                key={business.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedBusiness?.id === business.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => selectBusiness(business)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{business.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{business.business_type}</p>
                    {business.address && (
                      <p className="text-sm text-gray-500 mt-1 flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        {business.address}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(business);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBusiness(business.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {businesses.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>등록된 업장이 없습니다.</p>
                <p className="text-sm">새 업장을 추가해보세요.</p>
              </div>
            )}
          </div>
        </div>

        {/* 업장 상세 정보 및 편집 */}
        <div className="space-y-4">
          {selectedBusiness ? (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">업장 정보</h3>
                {!isEditing && (
                  <button
                    onClick={() => startEditing(selectedBusiness)}
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span>편집</span>
                  </button>
                )}
              </div>

              {isEditing ? (
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      업종
                    </label>
                    <input
                      type="text"
                      value={formData.business_type}
                      onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 미용실, 카페, 레스토랑"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주소
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="업장 주소를 입력하세요"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        전화번호
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="02-1234-5678"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        이메일
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="business@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      설명
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="업장에 대한 간단한 설명을 입력하세요"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleUpdateBusiness}
                      disabled={loading}
                      className="flex items-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                      <span>저장</span>
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex items-center space-x-1 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                      <span>취소</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white p-4 border rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">{selectedBusiness.name}</h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      {selectedBusiness.business_type && (
                        <p className="flex items-center">
                          <Building className="h-4 w-4 mr-2" />
                          {selectedBusiness.business_type}
                        </p>
                      )}
                      {selectedBusiness.address && (
                        <p className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          {selectedBusiness.address}
                        </p>
                      )}
                      {selectedBusiness.phone && (
                        <p className="flex items-center">
                          <Phone className="h-4 w-4 mr-2" />
                          {selectedBusiness.phone}
                        </p>
                      )}
                      {selectedBusiness.email && (
                        <p className="flex items-center">
                          <Mail className="h-4 w-4 mr-2" />
                          {selectedBusiness.email}
                        </p>
                      )}
                    </div>
                    {selectedBusiness.description && (
                      <p className="text-sm text-gray-600 mt-3">{selectedBusiness.description}</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>업장을 선택하거나 추가해주세요.</p>
            </div>
          )}
        </div>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업종
                </label>
                <input
                  type="text"
                  value={formData.business_type}
                  onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 미용실, 카페, 레스토랑"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주소
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="업장 주소를 입력하세요"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="02-1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="business@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="업장에 대한 간단한 설명을 입력하세요"
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
    </div>
  );
};

export default BusinessManagement;
