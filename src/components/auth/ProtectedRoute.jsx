/**
 * 보호된 라우트 컴포넌트
 * 인증이 필요한 페이지를 보호하는 래퍼 컴포넌트
 * 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
 * 특정 사용자 타입만 접근 가능하도록 제한할 수도 있음
 */

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const ProtectedRoute = ({ children, userType }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const [userData, setUserData] = useState(null);
  const [checkingUserType, setCheckingUserType] = useState(true);

  useEffect(() => {
    const checkUserType = async () => {
      console.log('ProtectedRoute: 사용자 타입 확인 시작, currentUser:', currentUser);
      
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          console.log('ProtectedRoute: Firestore 문서 존재 여부:', userDoc.exists());
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            console.log('ProtectedRoute: 사용자 데이터:', data);
            setUserData(data);
            
            // 사용자 타입이 설정되지 않은 경우 사용자 타입 선택 페이지로 리다이렉트
            if (!data.user_type && location.pathname !== '/user-type') {
              console.log('ProtectedRoute: 사용자 타입이 설정되지 않음, 사용자 타입 선택 페이지로 리다이렉트');
              setCheckingUserType(false);
              return;
            } else if (data.user_type) {
              console.log('ProtectedRoute: 사용자 타입이 설정됨:', data.user_type);
            }
          } else {
            console.log('ProtectedRoute: Firestore 문서가 존재하지 않음');
            // 문서가 없으면 사용자 타입 선택 페이지로 리다이렉트
            if (location.pathname !== '/user-type') {
              setCheckingUserType(false);
              return;
            }
          }
        } catch (error) {
          console.error('ProtectedRoute: 사용자 데이터 확인 에러:', error);
          // 에러가 발생해도 로딩 상태는 해제
          setCheckingUserType(false);
        }
      } else {
        console.log('ProtectedRoute: currentUser가 없음');
        setCheckingUserType(false);
      }
      setCheckingUserType(false);
    };

    // loading이 false이고 currentUser가 있을 때만 실행
    if (!loading && currentUser) {
      console.log('ProtectedRoute: 로딩 완료, 사용자 타입 확인 시작');
      checkUserType();
    } else if (!loading && !currentUser) {
      // 로딩이 끝났는데 currentUser가 없으면 로그인 페이지로
      console.log('ProtectedRoute: 로딩 완료, 사용자 없음');
      setCheckingUserType(false);
    } else {
      console.log('ProtectedRoute: 아직 로딩 중...');
    }
  }, [currentUser, loading]);

  // 로딩 중일 때
  if (loading || checkingUserType) {
    console.log('ProtectedRoute: 로딩 화면 표시', { loading, checkingUserType });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {loading ? '인증 상태 확인 중...' : '사용자 정보 불러오는 중...'}
          </p>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우
  if (!currentUser) {
    console.log('ProtectedRoute: 로그인하지 않음, 로그인 페이지로 리다이렉트');
    return <Navigate to="/login" replace />;
  }

  // 사용자 데이터가 아직 로드되지 않은 경우
  if (!userData) {
    console.log('ProtectedRoute: 사용자 데이터가 로드되지 않음');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 특정 사용자 타입이 요구되는 경우
  if (userType && userData.user_type !== userType) {
    console.log('ProtectedRoute: 사용자 타입 불일치, 적절한 대시보드로 리다이렉트');
    // 사용자 타입이 일치하지 않는 경우 적절한 대시보드로 리다이렉트
    if (userData.user_type === 'business') {
      return <Navigate to="/business" replace />;
    } else if (userData.user_type === 'worker') {
      return <Navigate to="/worker" replace />;
    }
  }

  // 사용자 타입이 아직 없는 경우에는 사용자 타입 선택 페이지로 이동
  if (!userData.user_type && location.pathname !== '/user-type') {
    return <Navigate to="/user-type" replace />;
  }

  // 사용자 타입에 따라 적절한 대시보드로 자동 리다이렉트
  if (userData.user_type === 'business' && location.pathname === '/profile') {
    return <Navigate to="/business" replace />;
  } else if (userData.user_type === 'worker' && location.pathname === '/profile') {
    return <Navigate to="/worker" replace />;
  }

  return children;
};

export default ProtectedRoute; 