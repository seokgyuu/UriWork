/**
 * 사용자 프로필 컴포넌트
 * 현재 로그인한 사용자의 정보를 표시하고 편집할 수 있는 페이지
 * 사용자 이름, 이메일, 사용자 타입 등을 보여주고 수정 가능
 * 로그아웃 기능도 포함
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Building, 
  Briefcase, 
  Calendar,
  LogOut,
  Edit,
  Save,
  X,
  Copy,
  Key,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { currentUser, logout, getUserData, updateUserData } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    business_name: ''
  });
  const [businessCode, setBusinessCode] = useState('');
  const [permissionStatus, setPermissionStatus] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser?.uid) {
        try {
          const data = await getUserData(currentUser.uid);
          setUserData(data);
          setEditForm({
            name: data?.name || currentUser.displayName || '',
            email: data?.email || currentUser.email || '',
            business_name: data?.business_name || ''
          });
        } catch (error) {
          console.error('사용자 데이터 가져오기 에러:', error);
          toast.error('사용자 정보를 불러오는데 실패했습니다.');
        }
      }
    };

    fetchUserData();
  }, [currentUser?.uid, getUserData]);

  // 권한 상태 확인 (worker 사용자용)
  useEffect(() => {
    const checkPermission = async () => {
      if (!currentUser || userData?.user_type !== 'worker') return;

      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../firebase');

        // 현재 사용자의 권한 확인
        const permissionQuery = query(
          collection(db, 'permissions'),
          where('worker_id', '==', currentUser.uid),
          where('status', '==', 'active')
        );
        const permissionSnapshot = await getDocs(permissionQuery);

        if (!permissionSnapshot.empty) {
          const permission = permissionSnapshot.docs[0].data();
          setPermissionStatus({
            status: 'active',
            businessId: permission.business_id,
            businessName: permission.business_name
          });
        } else {
          setPermissionStatus({ status: 'pending' });
        }
      } catch (error) {
        console.error('권한 확인 에러:', error);
        setPermissionStatus({ status: 'error' });
      }
    };

    checkPermission();
  }, [currentUser, userData?.user_type]);

  // 고유번호 생성 함수 (업체 사용자용)
  const generateUniqueCode = async () => {
    try {
      setLoading(true);
      const { doc, setDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase');
      
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code;
      let isUnique = false;
      
      while (!isUnique) {
        code = '';
        for (let i = 0; i < 8; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // 중복 확인
        const codeQuery = await getDocs(query(collection(db, 'users'), where('uniqueCode', '==', code)));
        if (codeQuery.empty) {
          isUnique = true;
        }
      }
      
      // 업체 정보에 고유 코드 저장
      await setDoc(doc(db, 'users', currentUser.uid), {
        uniqueCode: code,
        updated_at: new Date().toISOString()
      }, { merge: true });
      
      // 로컬 상태 업데이트
      setUserData(prev => ({ ...prev, uniqueCode: code }));
      toast.success('고유 코드가 생성되었습니다!');
    } catch (error) {
      console.error('고유 코드 생성 에러:', error);
      toast.error('고유 코드 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({
      name: userData?.name || currentUser.displayName || '',
      email: userData?.email || currentUser.email || '',
      business_name: userData?.business_name || ''
    });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // 사용자 타입은 변경하지 않고 원래 값 유지
      const updateData = {
        name: editForm.name,
        email: editForm.email,
        business_name: editForm.business_name,
        user_type: userData?.user_type // 원래 사용자 타입 유지
      };
      
      // AuthContext의 updateUserData 함수 사용
      await updateUserData(currentUser.uid, updateData);
      
      // 로컬 상태 업데이트 (사용자 타입은 원래 값 유지)
      setUserData(prev => ({ 
        ...prev, 
        name: editForm.name,
        email: editForm.email,
        business_name: editForm.business_name
        // user_type은 변경하지 않음
      }));
      setIsEditing(false);
      
      toast.success('프로필이 업데이트되었습니다.');
    } catch (error) {
      console.error('⚡️  [error] - Profile: 프로필 업데이트 에러:', error);
      
      let errorMessage = '프로필 업데이트에 실패했습니다.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        switch (error.code) {
          case 'permission-denied':
            errorMessage = '권한이 없습니다. 다시 로그인해주세요.';
            break;
          case 'not-found':
            errorMessage = '사용자 정보를 찾을 수 없습니다.';
            break;
          case 'network-request-failed':
            errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
            break;
          default:
            errorMessage = `업데이트 실패: ${error.code}`;
        }
      }
      
      toast.error(errorMessage);
      
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('클립보드에 복사되었습니다!');
  };

  const handleBusinessCodeSubmit = async () => {
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

      // 권한 정보 저장
      await setDoc(doc(db, 'permissions', `${currentUser.uid}_${businessData.uid}`), {
        worker_id: currentUser.uid,
        business_id: businessData.uid,
        business_name: businessData.name || businessData.email?.split('@')[0],
        worker_name: userData?.name || currentUser.displayName,
        worker_email: currentUser.email,
        status: 'active',
        granted_at: new Date().toISOString()
      });

      // 로컬 스토리지에 권한 정보 저장
      localStorage.setItem(`worker_permission_${currentUser.uid}`, JSON.stringify({
        businessId: businessData.uid,
        businessName: businessData.name || businessData.email?.split('@')[0]
      }));

      toast.success('업체 캘린더 접근 권한이 부여되었습니다!');
      setBusinessCode('');
    } catch (error) {
      console.error('업체 고유번호 처리 에러:', error);
      toast.error('업체 고유번호 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getUserTypeDisplay = (userType) => {
    switch (userType) {
      case 'business':
        return '업체 (사업자)';
      case 'worker':
        return '직원';
      default:
        return '미설정';
    }
  };

  const getUserTypeIcon = (userType) => {
    switch (userType) {
      case 'business':
        return <Building className="h-5 w-5 text-blue-500" />;
      case 'worker':
        return <Briefcase className="h-5 w-5 text-green-500" />;
      default:
        return <User className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">로그인이 필요합니다.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dashboard-container">
      {/* 헤더 */}
      <header className="bg-white shadow header-mobile">
        <div className="w-full px-2 sm:px-4">
          <div className="flex justify-between items-center pt-6 pb-3 sm:pt-8 sm:pb-6">
            <h1 className="text-lg sm:text-3xl font-bold text-gray-900 text-responsive-xl">프로필</h1>
            <button
              onClick={() => navigate(-1)}
              className="text-responsive-xs sm:text-sm text-gray-600 hover:text-gray-900"
            >
              ← 뒤로
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto py-6 container-responsive">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* 프로필 헤더 */}
          <div className="px-4 sm:px-6 py-6 sm:py-8 border-b border-gray-200">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-responsive-xl sm:text-2xl font-bold text-gray-900 truncate">
                      {userData?.name || currentUser.displayName || '사용자'}
                    </h2>
                    <div className="mt-2 space-y-1">
                      <p className="text-responsive-xs sm:text-sm text-gray-600 break-all">{currentUser.email}</p>
                      <div className="flex items-center">
                        {getUserTypeIcon(userData?.user_type)}
                        <span className="ml-2 text-responsive-xs sm:text-sm text-gray-600">
                          {getUserTypeDisplay(userData?.user_type)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {!isEditing ? (
                      <button
                        onClick={handleEdit}
                        className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-responsive-xs sm:text-sm"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        편집
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleSave}
                          disabled={loading}
                          className="flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-responsive-xs sm:text-sm"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          저장
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex items-center px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-responsive-xs sm:text-sm"
                        >
                          <X className="h-4 w-4 mr-2" />
                          취소
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 프로필 정보 */}
          <div className="px-4 sm:px-6 py-6">
            <h3 className="text-responsive-lg sm:text-lg font-medium text-gray-900 mb-4">기본 정보</h3>
            <div className="space-y-4">
              {/* 이름 */}
              <div>
                <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                  이름
                </label>
                {isEditing ? (
                  <div>
                    <input
                      type="text"
                      value={editForm.name}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">이름은 Google 계정에서 관리됩니다</p>
                  </div>
                ) : (
                  <p className="text-gray-900 break-words">{userData?.name || currentUser.displayName || '미설정'}</p>
                )}
              </div>

              {/* 이메일 */}
              <div>
                <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                {isEditing ? (
                  <div>
                    <input
                      type="email"
                      value={editForm.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">이메일은 Google 계정에서 관리됩니다</p>
                  </div>
                ) : (
                  <p className="text-gray-900 break-all">{userData?.email || currentUser.email}</p>
                )}
              </div>

              {/* 사용자 타입 */}
              <div>
                <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                  사용자 타입
                </label>
                <div className="flex items-center flex-wrap gap-2">
                  {getUserTypeIcon(userData?.user_type)}
                  <span className="text-gray-900 text-responsive-xs sm:text-sm">
                    {getUserTypeDisplay(userData?.user_type)}
                  </span>
                  {isEditing && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      변경 불가
                    </span>
                  )}
                </div>
                {isEditing && (
                  <p className="text-xs text-gray-500 mt-1">
                    사용자 타입은 보안상 변경할 수 없습니다.
                  </p>
                )}
              </div>

              {/* 업체명 (업체 사용자만) */}
              {userData?.user_type === 'business' && (
                <div>
                  <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                    업체명
                  </label>
                  {isEditing ? (
                    <div>
                      <input
                        type="text"
                        value={editForm.business_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="업체명을 입력하세요"
                      />
                      <p className="text-xs text-gray-500 mt-1">업체명만 수정 가능합니다</p>
                    </div>
                  ) : (
                    <p className="text-gray-900 break-words">{userData?.business_name || '미설정'}</p>
                  )}
                </div>
              )}

              {/* 고유번호 (업체 사용자만) */}
              {userData?.user_type === 'business' && (
                <div>
                  <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                    고유번호
                  </label>
                  {userData?.uniqueCode ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex-1 min-w-[160px] bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-md p-3">
                        <code className="text-responsive-lg sm:text-lg font-mono text-blue-800 font-bold break-all">
                          {userData.uniqueCode}
                        </code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(userData.uniqueCode)}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-responsive-xs sm:text-sm"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        복사
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex-1 min-w-[160px] bg-gray-50 border-2 border-gray-200 rounded-md p-3">
                        <p className="text-gray-500 text-responsive-xs sm:text-sm">고유번호가 생성되지 않았습니다.</p>
                      </div>
                      <button
                        onClick={generateUniqueCode}
                        disabled={loading}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-responsive-xs sm:text-sm"
                      >
                        <Key className="h-4 w-4 mr-1" />
                        생성
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    이 고유번호를 직원에게 전달하여 캘린더 접근 권한을 부여할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 업체 고유번호 입력 (직원 사용자만, 권한이 없을 때만) */}
              {userData?.user_type === 'worker' && permissionStatus?.status !== 'active' && (
                <div>
                  <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                    업체 고유번호
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={businessCode}
                      onChange={(e) => setBusinessCode(e.target.value.toUpperCase())}
                      placeholder="업체 고유번호를 입력하세요"
                      className="flex-1 min-w-[160px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={8}
                    />
                    <button
                      onClick={handleBusinessCodeSubmit}
                      disabled={loading || !businessCode.trim()}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-responsive-xs sm:text-sm"
                    >
                      <Key className="h-4 w-4 mr-1" />
                      권한 요청
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    업체에서 받은 고유번호를 입력하여 캘린더 접근 권한을 요청할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 권한 상태 표시 (직원 사용자만, 권한이 있을 때) */}
              {userData?.user_type === 'worker' && permissionStatus?.status === 'active' && (
                <div>
                  <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                    권한 상태
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center px-3 py-2 bg-green-100 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-green-800 font-medium text-responsive-xs sm:text-sm">활성</span>
                    </div>
                    <span className="text-responsive-xs sm:text-sm text-gray-600">
                      {permissionStatus.businessName} 업체에 권한이 부여되었습니다.
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    이제 업체 캘린더에 접근할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 계정 생성일 */}
              <div>
                <label className="block text-responsive-xs sm:text-sm font-medium text-gray-700 mb-2">
                  계정 생성일
                </label>
                <p className="text-gray-900">
                  {userData?.created_at 
                    ? new Date(userData.created_at).toLocaleDateString('ko-KR')
                    : '정보 없음'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* 계정 관리 */}
          <div className="px-4 sm:px-6 py-6 border-t border-gray-200">
            <h3 className="text-responsive-lg sm:text-lg font-medium text-gray-900 mb-4">계정 관리</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg gap-2 flex-wrap">
                <div className="min-w-0">
                  <h4 className="font-medium text-gray-900 text-responsive-sm sm:text-base">비밀번호 변경</h4>
                  <p className="text-responsive-xs sm:text-sm text-gray-600">계정 보안을 위해 주기적으로 비밀번호를 변경하세요</p>
                </div>
                <button className="px-3 sm:px-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-responsive-xs sm:text-sm">
                  변경하기
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg gap-2 flex-wrap">
                <div className="min-w-0">
                  <h4 className="font-medium text-gray-900 text-responsive-sm sm:text-base">계정 삭제</h4>
                  <p className="text-responsive-xs sm:text-sm text-gray-600">계정을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
                </div>
                <button className="px-3 sm:px-4 py-2 text-red-600 hover:text-red-700 font-medium text-responsive-xs sm:text-sm">
                  삭제하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile; 