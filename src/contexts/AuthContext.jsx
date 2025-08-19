/**
 * 인증 컨텍스트 컴포넌트
 * Firebase Authentication을 사용한 사용자 인증 상태 관리
 * 로그인, 로그아웃, 사용자 정보 제공
 * 전역적으로 인증 상태를 관리하여 모든 컴포넌트에서 사용 가능
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { authAPI } from '../services/api';
import { uploadProfileImage, deleteFile, getFilePathFromURL } from '../services/storage';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthContext: 인증 상태 감지 시작...');
    
    let isMounted = true;
    
    const initializeAuth = async () => {
      try {
        // 세션 초기화 (타임아웃 추가)
        await Promise.race([
          auth.authStateReady(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Auth timeout')), 10000)
          )
        ]);
        console.log('AuthContext: Auth 세션 준비 완료');
        
        // URL에서 로그인 관련 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const hasAuthParams = urlParams.has('apiKey') || urlParams.has('authDomain') || 
                             urlParams.has('continueUrl') || urlParams.has('state');
        
        console.log('AuthContext: URL 파라미터 확인:', {
          hasAuthParams,
          urlParams: Object.fromEntries(urlParams.entries())
        });
        
        // 리다이렉트 결과 확인 (여러 번 시도)
        let redirectResult = null;
        let retryCount = 0;
        const maxRetries = 5; // 재시도 횟수 증가
        
        while (!redirectResult && retryCount < maxRetries) {
          try {
            redirectResult = await getRedirectResult(auth);
            if (redirectResult) {
              console.log('AuthContext: 리다이렉트 로그인 성공:', redirectResult.user);
              break;
            }
          } catch (error) {
            console.log('AuthContext: 리다이렉트 결과 확인 시도', retryCount + 1, '실패:', error);
          }
          
          if (!redirectResult) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log('AuthContext: 리다이렉트 결과 재시도 중...', retryCount);
              await new Promise(resolve => setTimeout(resolve, 1500)); // 대기 시간 증가
            }
          }
        }
        
        // 로컬호스트 환경에서 추가 리다이렉트 결과 확인
        if (!redirectResult && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          console.log('AuthContext: 로컬호스트 환경에서 추가 리다이렉트 결과 확인...');
          
          // 로컬호스트에서는 더 긴 대기 후 재시도
          setTimeout(async () => {
            try {
              const delayedResult = await getRedirectResult(auth);
              if (delayedResult && isMounted) {
                console.log('AuthContext: 로컬호스트 지연된 리다이렉트 결과 발견:', delayedResult.user);
                await saveUserToFirestore(delayedResult.user);
                setCurrentUser(delayedResult.user);
                setLoading(false);
                toast.success('Google 로그인되었습니다!');
              }
            } catch (error) {
              console.log('AuthContext: 로컬호스트 지연된 리다이렉트 결과 확인 실패:', error);
            }
          }, 5000); // 5초 후 재시도
          
          // 로컬호스트에서 추가 지연 확인 (10초 후)
          setTimeout(async () => {
            try {
              const extraDelayedResult = await getRedirectResult(auth);
              if (extraDelayedResult && isMounted) {
                console.log('AuthContext: 로컬호스트 추가 지연된 리다이렉트 결과 발견:', extraDelayedResult.user);
                await saveUserToFirestore(extraDelayedResult.user);
                setCurrentUser(extraDelayedResult.user);
                setLoading(false);
                toast.success('Google 로그인되었습니다!');
              }
            } catch (error) {
              console.log('AuthContext: 로컬호스트 추가 지연된 리다이렉트 결과 확인 실패:', error);
            }
          }, 10000); // 10초 후 재시도
        }
        
        if (redirectResult) {
          try {
            await saveUserToFirestore(redirectResult.user);
            console.log('AuthContext: 리다이렉트 사용자 데이터 Firestore 저장 완료');
            
            // 리다이렉트 로그인 성공 시 즉시 사용자 상태 설정
            console.log('AuthContext: 리다이렉트 사용자 상태 설정 중...');
            setCurrentUser(redirectResult.user);
            setLoading(false);
            
            toast.success('Google 로그인되었습니다!');
            console.log('AuthContext: 리다이렉트 로그인 완료, 사용자 상태 설정됨');
            
            // URL 파라미터 정리
            if (hasAuthParams) {
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
              console.log('AuthContext: URL 파라미터 정리 완료');
            }
            
          } catch (error) {
            console.error('AuthContext: 리다이렉트 사용자 데이터 저장 실패:', error);
            // 저장 실패해도 로그인은 성공으로 처리
            console.log('AuthContext: 데이터 저장 실패했지만 로그인은 성공으로 처리');
            setCurrentUser(redirectResult.user);
            setLoading(false);
          }
        } else {
          console.log('AuthContext: 리다이렉트 결과 없음');
          
          // URL 파라미터가 있지만 리다이렉트 결과가 없는 경우 처리
          if (hasAuthParams) {
            console.log('AuthContext: URL 파라미터는 있지만 리다이렉트 결과가 없음, 추가 대기...');
            
            // 추가 대기 후 다시 시도
            setTimeout(async () => {
              if (isMounted) {
                try {
                  const delayedResult = await getRedirectResult(auth);
                  if (delayedResult) {
                    console.log('AuthContext: 지연된 리다이렉트 결과 발견:', delayedResult.user);
                    await saveUserToFirestore(delayedResult.user);
                    setCurrentUser(delayedResult.user);
                    setLoading(false);
                    toast.success('Google 로그인되었습니다!');
                  }
                } catch (error) {
                  console.log('AuthContext: 지연된 리다이렉트 결과 확인 실패:', error);
                }
              }
            }, 3000);
          }
          
          // 리다이렉트 결과가 없어도 현재 Auth 상태 확인
          if (auth.currentUser) {
            console.log('AuthContext: 현재 Auth 상태에서 사용자 발견:', auth.currentUser);
            setCurrentUser(auth.currentUser);
            setLoading(false);
          }
        }
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('AuthContext: 인증 상태 변경:', user ? '로그인됨' : '로그아웃됨');
          
          if (isMounted) {
            try {
              if (user) {
                console.log('AuthContext: 사용자 정보:', {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName
                });
                
                // 사용자가 있으면 즉시 상태 설정
                setCurrentUser(user);
                setLoading(false);
                
                // GIS 등 모든 경로에서 Firestore 사용자 문서 보장
                try {
                  saveUserToFirestore(user);
                } catch (e) {
                  console.log('AuthContext: Firestore 저장 스케줄링 실패(무시):', e);
                }
              } else {
                console.log('AuthContext: 사용자가 로그아웃됨');
                // 리다이렉트 결과가 있거나 URL 파라미터가 있는 경우는 로그아웃으로 처리하지 않음
                if (!redirectResult && !hasAuthParams) {
                  console.log('AuthContext: 리다이렉트 결과와 URL 파라미터 모두 없음, 로그아웃 상태로 설정');
                  setCurrentUser(null);
                  setLoading(false);
                } else {
                  console.log('AuthContext: 리다이렉트 결과 또는 URL 파라미터가 있음, 로그아웃 상태 설정 건너뜀');
                  
                  // 리다이렉트 결과가 있는 경우 사용자 상태 재설정
                  if (redirectResult && redirectResult.user) {
                    setTimeout(() => {
                      if (isMounted) {
                        console.log('AuthContext: 리다이렉트 결과로 사용자 상태 재설정');
                        setCurrentUser(redirectResult.user);
                        setLoading(false);
                      }
                    }, 1000);
                  }
                }
              }
            } catch (error) {
              console.error('AuthContext: 상태 설정 에러:', error);
              if (isMounted) {
                setCurrentUser(null);
                setLoading(false);
              }
            }
          }
        }, (error) => {
          console.error('AuthContext: 인증 상태 변경 에러:', error);
          
          // 에러 발생 시에도 로딩 상태 해제
          if (isMounted) {
            setCurrentUser(null);
            setLoading(false);
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('AuthContext: Auth 초기화 에러:', error);
        if (isMounted) {
          setCurrentUser(null);
          setLoading(false);
        }
        return () => {};
      }
    };

    const cleanup = initializeAuth().then(unsubscribe => {
      return unsubscribe;
    });
    
    return () => {
      isMounted = false;
      cleanup.then(unsubscribe => {
        if (unsubscribe) {
          unsubscribe();
        }
      });
    };
  }, []);

  const register = async (email, password, userType, name) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Firestore에 사용자 정보 저장
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        uid: userCredential.user.uid,
        email: email,
        name: name,
        user_type: userType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // 백엔드에 사용자 정보 전송
      await authAPI.register({
        email,
        password,
        user_type: userType,
        name
      });

      toast.success('회원가입이 완료되었습니다!');
      return userCredential.user;
    } catch (error) {
      console.error('회원가입 에러:', error);
      toast.error('회원가입 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 백엔드에 로그인 정보 전송
      await authAPI.login({ email, password });
      
      toast.success('로그인되었습니다!');
      return userCredential.user;
    } catch (error) {
      toast.error('로그인 중 오류가 발생했습니다.');
      throw error;
    }
  };

      const loginWithGoogle = async () => {
    try {
      console.log('AuthContext: Google 로그인 시작...');
      
      // 모든 플랫폼에서 Google 로그인 허용
      let platform = 'web';
      
      if (window.Capacitor) {
        try {
          platform = window.Capacitor.getPlatform();
          console.log('AuthContext: 플랫폼:', platform);
        } catch (error) {
          console.log('AuthContext: 플랫폼 감지 실패:', error);
        }
      }
      
      console.log('AuthContext: 현재 플랫폼:', platform);
      
      // Firebase Auth Google 로그인 사용
      const provider = new GoogleAuthProvider();
      
      // 기본 스코프 설정
      provider.addScope('email');
      provider.addScope('profile');
      
      // 계정 선택 화면 표시 (Firebase가 공식 지원하는 최소 파라미터만 사용)
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // 리다이렉트 설정 개선
      if (platform === 'web') {
        // 웹에서는 현재 도메인을 리다이렉트 도메인으로 설정
        const currentDomain = window.location.origin;
        console.log('AuthContext: 리다이렉트 도메인 설정:', currentDomain);
        
        // 리다이렉트 URL 관련 커스텀 파라미터는 사용하지 않음 (Firebase가 내부적으로 처리)
        if (currentDomain.includes('localhost') || currentDomain.includes('127.0.0.1')) {
          console.log('AuthContext: 로컬호스트 환경 감지');
        }
      }
      
      console.log('AuthContext: Firebase Auth 객체:', auth);
      console.log('AuthContext: Google Provider:', provider);
      
      // 세션 초기화 후 로그인 시도
      try {
        await Promise.race([
          auth.authStateReady(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Auth timeout')), 5000)
          )
        ]);
        console.log('AuthContext: 세션 준비 완료');
      } catch (error) {
        console.log('AuthContext: 세션 초기화 타임아웃, 계속 진행');
      }
      
      // 웹에서는 팝업 방식 우선 시도 (404 에러 방지)
      if (platform === 'web') {
        // 현재 도메인 확인
        const currentDomain = window.location.origin;
        
        // 웹에서는 리다이렉트 방식만 사용하여 COOP 팝업 경고 방지
        console.log('AuthContext: 웹 환경에서 리다이렉트 방식 사용...');
        try {
          await signInWithRedirect(auth, provider);
          console.log('AuthContext: 웹 리다이렉트 로그인 시작');
          toast.info('Google 로그인 페이지로 이동합니다...');
          // 리다이렉트 후 결과는 onAuthStateChanged에서 처리됨
        } catch (redirectError) {
          console.error('AuthContext: 웹 리다이렉트 로그인 실패:', redirectError);
          throw redirectError;
        }
      } else {
        // 모바일에서는 리다이렉트 방식만 사용 (COOP 오류 완전 방지)
        console.log('AuthContext: 모바일 환경에서 리다이렉트 방식으로 Google 로그인 시도...');
        try {
          await signInWithRedirect(auth, provider);
          console.log('AuthContext: 모바일 리다이렉트 로그인 시작');
          toast.info('Google 로그인 페이지로 이동합니다...');
          // 리다이렉트 후 결과는 onAuthStateChanged에서 처리됨
        } catch (redirectError) {
          console.error('AuthContext: 모바일 리다이렉트 로그인 실패:', redirectError);
          
          // 모바일에서는 팝업 시도하지 않음 (COOP 오류 방지)
          throw new Error('모바일에서 Google 로그인에 실패했습니다. 다시 시도해주세요.');
        }
      }
    } catch (error) {
      console.error('AuthContext: Google 로그인 에러:', error);
      console.error('AuthContext: 에러 메시지:', error.message);
      
      // 구체적인 오류 메시지 처리
      let errorMessage = 'Google 로그인 중 오류가 발생했습니다.';
      
      if (error.message.includes('popup_closed') || error.message.includes('Cross-Origin-Opener-Policy')) {
        errorMessage = '로그인 창이 차단되었습니다. 팝업 허용 후 다시 시도하거나, 새로고침 후 다시 시도해주세요.';
      } else if (error.message.includes('network')) {
        errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
      } else if (error.message.includes('oauth')) {
        errorMessage = 'Google 로그인 설정에 문제가 있습니다. 관리자에게 문의해주세요.';
      } else if (error.message.includes('unable')) {
        errorMessage = '세션 오류가 발생했습니다. 앱을 다시 시작해주세요.';
      } else if (error.message.includes('404') || error.message.includes('not found')) {
        errorMessage = '로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
      }
      
      toast.error(errorMessage);
      throw error;
    }
  };

  const loginWithApple = async () => {
    try {
      console.log('AuthContext: Apple 로그인 시작...');

      let platform = 'web';
      if (window.Capacitor) {
        try {
          platform = window.Capacitor.getPlatform();
          console.log('AuthContext: 플랫폼:', platform);
        } catch (error) {
          console.log('AuthContext: 플랫폼 감지 실패:', error);
        }
      }

      // Apple OAuth Provider 설정
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');

      // 세션 준비
      try {
        await Promise.race([
          auth.authStateReady(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 5000))
        ]);
        console.log('AuthContext: 세션 준비 완료');
      } catch (error) {
        console.log('AuthContext: 세션 초기화 타임아웃, 계속 진행');
      }

      // Apple은 리다이렉트 플로우 권장
      console.log('AuthContext: Apple 리다이렉트 로그인 시작');
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error('AuthContext: Apple 로그인 에러:', error);
      let errorMessage = 'Apple 로그인 중 오류가 발생했습니다.';
      if (error?.message?.toLowerCase?.().includes('network')) {
        errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
      }
      toast.error(errorMessage);
      throw error;
    }
  };

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
       const codeQuery = await getDocs(query(collection(db, 'users'), where('uniqueCode', '==', code)));
       if (codeQuery.empty) {
         isUnique = true;
       }
     }
     
     return code;
   };

   // Firestore에 사용자 데이터 저장
   const saveUserToFirestore = async (user) => {
    try {
      console.log('AuthContext: Firestore에 사용자 데이터 저장 시작');
      
      // 인증 상태 재확인
      if (!user || !user.uid) {
        console.error('AuthContext: 사용자 정보가 없음');
        return;
      }
      
      // Firebase Auth 상태 확인
      const currentUser = auth.currentUser;
      console.log('AuthContext: 현재 Firebase Auth 사용자:', currentUser);
      
      if (!currentUser) {
        console.error('AuthContext: Firebase Auth에 로그인된 사용자가 없음');
        return;
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log('AuthContext: 새 사용자 생성');
        const userData = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          user_type: null, // 사용자 타입은 나중에 선택하도록 null로 설정
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          photoURL: user.photoURL,
          emailVerified: user.emailVerified || false
        };
        
        await setDoc(userDocRef, userData);
        console.log('AuthContext: 새 사용자 데이터 저장 완료:', userData);
      } else {
        console.log('AuthContext: 기존 사용자 발견, 정보 업데이트');
        const existingData = userDoc.data();
        console.log('AuthContext: 기존 사용자 데이터:', existingData);
        
        // 기존 사용자 정보 업데이트
        const updatedData = {
          ...existingData,
          name: user.displayName || existingData.name,
          photoURL: user.photoURL || existingData.photoURL,
          updated_at: new Date().toISOString(),
          emailVerified: user.emailVerified || existingData.emailVerified
        };
        
        await setDoc(userDocRef, updatedData);
        console.log('AuthContext: 기존 사용자 데이터 업데이트 완료:', updatedData);
      }
      
      console.log('AuthContext: Firestore 저장 완료');
    } catch (error) {
      console.error('AuthContext: Firestore 저장 에러:', error);
      // Firestore 저장 실패해도 로그인은 성공으로 처리
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('로그아웃되었습니다.');
    } catch (error) {
      toast.error('로그아웃 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const getUserData = async (uid) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        return userDoc.data();
      } else {
        console.log('사용자 데이터가 없습니다.');
        return null;
      }
    } catch (error) {
      console.error('사용자 데이터 가져오기 에러:', error);
      return null;
    }
  };

  const updateUserData = async (uid, data) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        ...data,
        updated_at: new Date().toISOString()
      });
      toast.success('프로필이 업데이트되었습니다!');
    } catch (error) {
      console.error('사용자 데이터 업데이트 에러:', error);
      toast.error('프로필 업데이트 중 오류가 발생했습니다.');
      throw error;
    }
  };

  // 프로필 이미지 업로드 함수
  const uploadUserProfileImage = async (file) => {
    try {
      if (!currentUser) {
        throw new Error('로그인이 필요합니다.');
      }

      // 기존 프로필 이미지가 있으면 삭제
      if (currentUser.photoURL) {
        const oldFilePath = getFilePathFromURL(currentUser.photoURL);
        if (oldFilePath) {
          try {
            await deleteFile(oldFilePath);
          } catch (error) {
            console.log('기존 이미지 삭제 실패:', error);
          }
        }
      }

      // 새 이미지 업로드
      const downloadURL = await uploadProfileImage(file, currentUser.uid);
      
      // 사용자 프로필 업데이트
      await updateUserData(currentUser.uid, { photoURL: downloadURL });
      
      toast.success('프로필 이미지가 업데이트되었습니다!');
      return downloadURL;
    } catch (error) {
      console.error('프로필 이미지 업로드 에러:', error);
      toast.error('프로필 이미지 업로드 중 오류가 발생했습니다.');
      throw error;
    }
  };

  const value = {
    currentUser,
    register,
    login,
    loginWithGoogle,
    loginWithApple,
    logout,
    getUserData,
    updateUserData,
    uploadUserProfileImage,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 