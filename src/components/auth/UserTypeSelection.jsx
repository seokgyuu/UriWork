/**
 * 사용자 타입 선택 컴포넌트
 * 회원가입 시 사용자가 업체(사업자)인지 노동자인지 선택하는 페이지
 * 선택한 타입에 따라 다른 가입 프로세스 진행
 * 업체는 캘린더 생성, 노동자는 초대 코드 입력으로 구분
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
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
           const userDoc = await getDoc(userDocRef);
           
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

     // 약간의 지연을 두고 실행 (상태 안정화를 위해)
     const timer = setTimeout(() => {
       if (currentUser) {
         checkUserType();
       } else {
         if (isMounted) {
           setLoading(false);
         }
       }
     }, 500); // 지연 시간 증가

     return () => {
       isMounted = false;
       clearTimeout(timer);
     };
   }, [currentUser?.uid]); // currentUser.uid만 의존성으로 사용

     // 고유 코드 생성 함수
   const generateUniqueCode = async () => {
     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
     let code;
     let isUnique = false;
     
     while (!isUnique) {
       code = '';
       for (let i = 0; i < 8; i++) {
         code += chars.charAt(Math.floor(Math.random() * chars.length));
       }
       
       // Firestore에서 중복 확인
       const { collection, getDocs, query, where } = await import('firebase/firestore');
       const codeQuery = await getDocs(query(collection(db, 'users'), where('uniqueCode', '==', code)));
       if (codeQuery.empty) {
         isUnique = true;
       }
     }
     
     return code;
   };

   const handleUserTypeSelection = async (userType) => {
     try {
       console.log('UserTypeSelection: 사용자 타입 선택 시작:', userType);
       
       if (!currentUser) {
         console.log('UserTypeSelection: currentUser가 없음, 로그인 페이지로 이동');
         toast.error('로그인이 필요합니다.');
         navigate('/login');
         return;
       }

       console.log('UserTypeSelection: currentUser 확인:', currentUser);
       console.log('UserTypeSelection: currentUser.uid:', currentUser.uid);

       // 인증 상태 재확인
       if (!currentUser.uid) {
         console.log('UserTypeSelection: currentUser.uid가 없음');
         toast.error('인증 정보가 올바르지 않습니다. 다시 로그인해주세요.');
         navigate('/login');
         return;
       }

       // Firebase Auth 상태 재확인
       const { auth } = await import('../../firebase');
       const firebaseUser = auth.currentUser;
       console.log('UserTypeSelection: Firebase Auth 현재 사용자:', firebaseUser);
       
       if (!firebaseUser) {
         console.log('UserTypeSelection: Firebase Auth에 로그인된 사용자가 없음');
         toast.error('인증 상태가 올바르지 않습니다. 다시 로그인해주세요.');
         navigate('/login');
         return;
       }
       
       // 인증 토큰 확인
       try {
         const token = await firebaseUser.getIdToken();
         console.log('UserTypeSelection: Firebase Auth 토큰 확인됨');
         console.log('UserTypeSelection: 사용자 UID:', firebaseUser.uid);
         console.log('UserTypeSelection: 사용자 이메일:', firebaseUser.email);
       } catch (tokenError) {
         console.error('UserTypeSelection: 토큰 가져오기 실패:', tokenError);
         toast.error('인증 토큰을 가져올 수 없습니다. 다시 로그인해주세요.');
         navigate('/login');
         return;
       }

       console.log('UserTypeSelection: Firestore에서 사용자 타입 업데이트 시작');
       
       // 재시도 로직 추가
       let retryCount = 0;
       const maxRetries = 3;
       
       while (retryCount < maxRetries) {
         try {
           // 고용자인 경우 고유 코드 생성
           let updateData = {
             user_type: userType,
             updated_at: new Date().toISOString()
           };
           
           if (userType === 'business') {
             console.log('UserTypeSelection: 고용자 고유 코드 생성 시작');
             const uniqueCode = await generateUniqueCode();
             updateData.uniqueCode = uniqueCode;
             console.log('UserTypeSelection: 고유 코드 생성 완료:', uniqueCode);
           }
           
           // Firestore에서 사용자 타입 업데이트
           const userDocRef = doc(db, 'users', currentUser.uid);
           await updateDoc(userDocRef, updateData);

           console.log('UserTypeSelection: 사용자 타입 업데이트 완료:', userType);
           
           if (userType === 'business') {
             toast.success(`고용자로 설정되었습니다! 고유 코드: ${updateData.uniqueCode}`);
           } else {
             toast.success('피고용자로 설정되었습니다!');
           }

           // 사용자 타입에 따라 적절한 대시보드로 이동
           if (userType === 'business') {
             console.log('UserTypeSelection: 고용자 대시보드로 이동');
             navigate('/business');
           } else {
             console.log('UserTypeSelection: 노동자 대시보드로 이동');
             navigate('/worker');
           }
           
           return; // 성공시 함수 종료
         } catch (error) {
           retryCount++;
           console.error(`UserTypeSelection: 사용자 타입 설정 에러 (시도 ${retryCount}/${maxRetries}):`, error);
           
           if (retryCount >= maxRetries) {
             console.error('UserTypeSelection: 최대 재시도 횟수 초과');
             toast.error('사용자 타입 설정 중 오류가 발생했습니다. 다시 시도해주세요.');
             throw error;
           }
           
           // 재시도 전 잠시 대기
           await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
         }
       }
     } catch (error) {
       console.error('UserTypeSelection: 사용자 타입 설정 최종 에러:', error);
       toast.error('사용자 타입 설정 중 오류가 발생했습니다.');
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
              onClick={() => handleUserTypeSelection('business')}
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
              onClick={() => handleUserTypeSelection('worker')}
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