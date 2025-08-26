/**
 * 사용자 타입 선택 컴포넌트
 * 회원가입 시 사용자가 업체(사업자)인지 노동자인지 선택하는 페이지
 * 선택한 타입에 따라 다른 가입 프로세스 진행
 * 업체는 캘린더 생성, 노동자는 초대 코드 입력으로 구분
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

const UserTypeSelection = () => {
  const navigate = useNavigate();
  const { currentUser, updateUserData } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

     useEffect(() => {
     let isMounted = true;
     
     const checkUserType = async () => {
       console.log('UserTypeSelection: currentUser 확인 중...', currentUser);
       
       if (currentUser && isMounted) {
         try {
           console.log('UserTypeSelection: Firestore에서 사용자 데이터 조회 시작');
           const userDocRef = doc(db, 'users', currentUser.uid);
           
           // Firestore 조회에 3초 타임아웃 추가
           const timeoutPromise = new Promise((_, reject) => {
             setTimeout(() => {
               reject(new Error('Firestore 조회 타임아웃 (10초)'));
             }, 10000); // 10초 타임아웃
           });
           
           const userDocPromise = getDoc(userDocRef);
           const userDoc = await Promise.race([userDocPromise, timeoutPromise]);
           
           if (!isMounted) return;
           
           console.log('UserTypeSelection: Firestore 문서 존재 여부:', userDoc.exists());
           
           if (userDoc.exists()) {
             const data = userDoc.data();
             console.log('UserTypeSelection: 사용자 데이터:', data);
             
             if (isMounted) {
               setUserData(data);
               setLoading(false); // 로딩 상태 해제
             }
             
             // 이미 사용자 타입이 설정된 경우 적절한 대시보드로 리다이렉트
             if (data.user_type) {
               console.log('UserTypeSelection: 사용자 타입이 이미 설정됨:', data.user_type);
               if (isMounted) {
                 if (data.user_type === 'business') {
                   console.log('UserTypeSelection: 고용자 대시보드로 이동');
                   navigate('/business');
                 } else if (data.user_type === 'worker') {
                   console.log('UserTypeSelection: 노동자 대시보드로 이동');
                   navigate('/worker');
                 }
               }
               return;
             } else {
               console.log('UserTypeSelection: 사용자 타입이 설정되지 않음, 선택 화면 표시');
             }
           } else {
             console.log('UserTypeSelection: Firestore 문서가 존재하지 않음, 새 사용자로 처리');
             // 문서가 없으면 새 사용자로 간주하고 선택 화면 표시
             if (isMounted) {
               setUserData({
                 uid: currentUser.uid,
                 email: currentUser.email,
                 name: currentUser.displayName || currentUser.email?.split('@')[0] || '사용자',
                 user_type: null
               });
               setLoading(false); // 로딩 상태 해제
             }
           }
         } catch (error) {
           console.error('UserTypeSelection: 사용자 데이터 확인 에러:', error);
           
           // 타임아웃 에러인 경우 새 사용자로 처리
           if (error.message && error.message.includes('타임아웃')) {
             console.log('UserTypeSelection: Firestore 조회 타임아웃, 새 사용자로 처리');
             if (isMounted) {
               setUserData({
                 uid: currentUser.uid,
                 email: currentUser.email,
                 name: currentUser.displayName || currentUser.email?.split('@')[0] || '사용자',
                 user_type: null
               });
               setLoading(false);
             }
             return;
           }
           
           // 에러가 발생해도 로딩 상태는 해제
           if (isMounted) {
             setLoading(false);
           }
         }
       } else {
         console.log('UserTypeSelection: currentUser가 없음');
         if (isMounted) {
           setLoading(false);
         }
       }
     };

     // currentUser가 변경될 때마다 즉시 실행
     if (currentUser) {
       checkUserType();
     } else {
       // currentUser가 없으면 로딩 상태 해제
       setLoading(false);
     }

     return () => {
       isMounted = false;
     };
   }, [currentUser, navigate]); // currentUser 전체와 navigate를 의존성으로 사용

  // 고유 코드 생성 함수
  const generateUniqueCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleUserTypeSelect = async (userType) => {
    if (loading) {
      console.log('UserTypeSelection: 이미 처리 중, 중복 호출 무시');
      return;
    }
    
    console.log('UserTypeSelection: 사용자 타입 선택 시작:', userType);
    
    // 로딩 상태 즉시 설정하여 중복 호출 방지
    setLoading(true);
    
    try {
      // Firebase Auth 상태 재확인
      const { auth } = await import('../../firebase');
      const firebaseUser = auth.currentUser;
      console.log('UserTypeSelection: Firebase Auth 현재 사용자:', firebaseUser);
      
      // Firebase Auth 검증을 우회하고 mockUser 사용
      console.log('UserTypeSelection: Firebase Auth 검증 우회, mockUser 사용');
      
      // 인증 토큰 확인도 우회
      console.log('UserTypeSelection: 토큰 확인 우회됨');
      console.log('UserTypeSelection: 사용자 UID:', currentUser.uid);
      console.log('UserTypeSelection: 사용자 이메일:', currentUser.email);

      console.log('UserTypeSelection: Firestore에서 사용자 타입 업데이트 시작');
      
      // 업데이트할 데이터 준비
      let updateData = {
        user_type: userType,
        updated_at: new Date().toISOString()
      };
      
      // 고용자인 경우 고유 코드 생성
      if (userType === 'business') {
        console.log('UserTypeSelection: 고용자 고유 코드 생성 시작');
        const uniqueCode = generateUniqueCode();
        console.log('UserTypeSelection: 고유 코드 생성 완료:', uniqueCode);
        
        updateData.uniqueCode = uniqueCode;
        console.log('UserTypeSelection: updateData에 고유 코드 추가됨:', updateData);
      }
      
      console.log('UserTypeSelection: Firestore 문서 참조 생성 시작');
      const userDocRef = doc(db, 'users', currentUser.uid);
      console.log('UserTypeSelection: Firestore 문서 참조 생성 완료:', userDocRef);
      
      console.log('UserTypeSelection: setDoc 실행 시작...');
      console.log('UserTypeSelection: setDoc 파라미터 - 문서참조:', userDocRef);
      console.log('UserTypeSelection: setDoc 파라미터 - 데이터:', updateData);
      console.log('UserTypeSelection: setDoc 파라미터 - 옵션:', { merge: true });
      
      // Firestore 연결 상태 확인
      console.log('UserTypeSelection: Firestore 인스턴스 상태 확인:', {
        db: !!db,
        dbApp: !!db?.app,
        dbProjectId: db?.app?.options?.projectId
      });
      
      try {
        // setDoc을 사용하여 문서가 없어도 생성 (merge: true로 기존 데이터 보존)
        console.log('UserTypeSelection: setDoc await 시작...');
        await setDoc(userDocRef, updateData, { merge: true });
        console.log('UserTypeSelection: setDoc await 완료!');
        console.log('UserTypeSelection: setDoc 실행 완료!');
        
        // 저장 완료 확인을 위한 추가 로깅
        console.log('UserTypeSelection: Firestore 저장 성공 확인됨');
        console.log('UserTypeSelection: 저장된 데이터:', updateData);
        
      } catch (setDocError) {
        console.error('UserTypeSelection: setDoc 실행 실패:', setDocError);
        console.error('UserTypeSelection: setDoc 에러 상세:', {
          message: setDocError.message,
          code: setDocError.code,
          stack: setDocError.stack
        });
        throw setDocError;
      }

      console.log('UserTypeSelection: 사용자 타입 업데이트 완료:', userType);
      
      if (userType === 'business') {
        toast.success(`고용자로 설정되었습니다! 고유 코드: ${updateData.uniqueCode}`);
      } else {
        toast.success('피고용자로 설정되었습니다!');
      }

      // 사용자 타입에 따라 즉시 적절한 대시보드로 이동
      if (userType === 'business') {
        console.log('UserTypeSelection: 고용자 대시보드로 이동');
        navigate('/business');
      } else {
        console.log('UserTypeSelection: 노동자 대시보드로 이동');
        navigate('/worker');
      }
      
      return; // 성공시 함수 종료
      
    } catch (error) {
      console.error('UserTypeSelection: 사용자 타입 설정 실패:', error);
      toast.error('사용자 타입 설정에 실패했습니다. 다시 시도해주세요.');
      
      // 에러 발생 시 로딩 상태 해제
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // currentUser가 없으면 로그인 페이지로 리다이렉트
  if (!currentUser) {
    console.log('UserTypeSelection: currentUser가 없음, 로그인 페이지로 리다이렉트');
    return <Navigate to="/login" replace />;
  }

  console.log('UserTypeSelection: 렌더링 시작, currentUser:', currentUser, 'userData:', userData, 'loading:', loading);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            사용자 유형 선택
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            고용자 또는 피고용자 중 선택해주세요
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {/* 고용자 선택 */}
            <button
              onClick={() => handleUserTypeSelect('business')}
              className="relative p-6 border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">고용자</h3>
                   <p className="text-sm text-gray-500">
                     일정을 관리하고 피고용자를 고용하는 업체입니다
                   </p>
                 </div>
              </div>
            </button>

            {/* 노동자 선택 */}
            <button
              onClick={() => handleUserTypeSelect('worker')}
              className="relative p-6 border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                                 <div className="ml-4">
                   <h3 className="text-lg font-medium text-gray-900">피고용자</h3>
                   <p className="text-sm text-gray-500">
                     일정을 확인하고 업무를 수행하는 근로자입니다
                   </p>
                 </div>
              </div>
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              다른 계정으로 로그인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTypeSelection; 