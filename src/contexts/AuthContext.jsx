/**
 * 인증 컨텍스트 컴포넌트
 * Firebase Authentication을 사용한 사용자 인증 상태 관리
 * 로그인, 로그아웃, 사용자 정보 제공
 * 전역적으로 인증 상태를 관리하여 모든 컴포넌트에서 사용 가능
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, getRedirectResult, signInWithRedirect, signInWithCredential } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, query, where } from 'firebase/firestore';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';

// Firebase 모듈 직접 import (상대 경로 사용)
import { auth, db } from '../firebase';

// isPlatform 함수 직접 구현
const isPlatform = (platform) => {
  if (typeof window === 'undefined') return false;
  return Capacitor.getPlatform() === platform;
};

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
  const [authStateReady, setAuthStateReady] = useState(false);

  // Firebase 인스턴스 상태 확인 (전역 객체 우선 확인)
  console.log('⚡️  [AuthContext] AuthProvider 초기화 - Firebase 인스턴스 상태:');
  console.log('⚡️  [AuthContext] 전역 FIREBASE_AUTH:', !!window.FIREBASE_AUTH);
  console.log('⚡️  [AuthContext] 전역 FIREBASE_DB:', !!window.FIREBASE_DB);
  console.log('⚡️  [AuthContext] import된 auth 인스턴스:', !!auth);
  console.log('⚡️  [AuthContext] import된 db 인스턴스:', !!db);
  console.log('⚡️  [AuthContext] 전역 __FIREBASE_DEBUG__:', !!window.__FIREBASE_DEBUG__);

  // Firebase 모듈이 로드되지 않은 경우 대체 방법 시도
  useEffect(() => {
    if (!auth || !db) {
      console.log('⚡️  [AuthContext] Firebase 모듈이 로드되지 않음, 대체 방법 시도...');
      
      // 전역 객체에서 Firebase 인스턴스 확인
      if (window.FIREBASE_AUTH && window.FIREBASE_DB) {
        console.log('⚡️  [AuthContext] 전역 Firebase 인스턴스 발견, 사용');
        // 전역 객체에서 Firebase 인스턴스를 가져와서 사용
        window.__FIREBASE_DEBUG__ = {
          auth: window.FIREBASE_AUTH,
          db: window.FIREBASE_DB,
          storage: window.FIREBASE_STORAGE
        };
      } else if (window.__FIREBASE_DEBUG__) {
        console.log('⚡️  [AuthContext] 전역 Firebase 디버그 객체 발견');
      }
      
      // 동적 import 시도
      import('../firebase').then((firebaseModule) => {
        console.log('⚡️  [AuthContext] 동적 import 성공:', firebaseModule);
        // 동적으로 로드된 Firebase 인스턴스 사용
        window.__FIREBASE_DEBUG__ = firebaseModule;
      }).catch((error) => {
        console.error('⚡️  [AuthContext] 동적 import 실패:', error);
      });
    }
  }, []);

  // Firebase 모듈 강제 초기화 함수
  const forceInitializeFirebase = async () => {
    try {
      console.log('⚡️  [AuthContext] Firebase 모듈 강제 초기화 시작...');
      
      // 1. 전역 객체에서 Firebase 인스턴스 확인 (우선순위 1)
      if (window.FIREBASE_AUTH && window.FIREBASE_DB) {
        console.log('⚡️  [AuthContext] 전역 Firebase 인스턴스에서 인스턴스 사용');
        return {
          auth: window.FIREBASE_AUTH,
          db: window.FIREBASE_DB
        };
      }
      
      // 2. 전역 디버그 객체에서 Firebase 인스턴스 확인 (우선순위 2)
      if (window.__FIREBASE_DEBUG__) {
        console.log('⚡️  [AuthContext] 전역 Firebase 디버그 객체에서 인스턴스 사용');
        return {
          auth: window.__FIREBASE_DEBUG__.auth,
          db: window.__FIREBASE_DEBUG__.db
        };
      }
      
      // 3. 동적 import 시도 (우선순위 3)
      console.log('⚡️  [AuthContext] 동적 import 시도...');
      const firebaseModule = await import('../firebase');
      console.log('⚡️  [AuthContext] 동적 import 성공:', firebaseModule);
      
      // 4. 전역 객체에 할당
      window.__FIREBASE_DEBUG__ = firebaseModule;
      
      return {
        auth: firebaseModule.auth,
        db: firebaseModule.db
      };
    } catch (error) {
      console.error('⚡️  [AuthContext] Firebase 모듈 강제 초기화 실패:', error);
      throw error;
    }
  };

  // 사용자를 Firestore에 저장
  const saveUserToFirestore = async (user, provider = 'unknown', customDb = null) => {
    try {
      console.log('⚡️  [log] - AuthContext: saveUserToFirestore 시작, 사용자:', user);
      console.log('⚡️  [log] - AuthContext: 제공자:', provider);
      console.log('⚡️  [log] - AuthContext: 전달받은 Firestore 인스턴스:', !!customDb);
      console.log('⚡️  [log] - AuthContext: 기본 Firestore 인스턴스:', !!db);
      
      // Firestore 인스턴스 결정 (전달받은 것 우선, 없으면 기본 사용)
      const firestoreDb = customDb || db;
      console.log('⚡️  [log] - AuthContext: 사용할 Firestore 인스턴스:', !!firestoreDb);
      console.log('⚡️  [log] - AuthContext: Firestore 앱 참조:', !!firestoreDb?.app);
      
      if (!user || !user.uid) {
        console.error('⚡️  [error] - AuthContext: 유효하지 않은 사용자 정보');
        throw new Error('유효하지 않은 사용자 정보입니다.');
      }
      
      if (!firestoreDb) {
        console.error('⚡️  [error] - AuthContext: Firestore 인스턴스가 없습니다');
        throw new Error('Firestore 인스턴스를 찾을 수 없습니다.');
      }
      
      const userRef = doc(firestoreDb, 'users', user.uid);
      console.log('⚡️  [log] - AuthContext: Firestore 문서 참조 생성:', userRef.path);
      
      // 기존 사용자 정보 확인
      console.log('⚡️  [log] - AuthContext: 기존 사용자 문서 확인 시작...');
      const userDoc = await getDoc(userRef);
      console.log('⚡️  [log] - AuthContext: 기존 사용자 문서 확인:', userDoc.exists());
      
      if (userDoc.exists()) {
        console.log('⚡️  [log] - AuthContext: 기존 사용자 발견, 정보 업데이트...');
        
        // 기존 사용자 정보 업데이트
        await updateDoc(userRef, {
          lastLoginAt: new Date(),
          email: user.email || userDoc.data().email,
          displayName: user.displayName || userDoc.data().displayName,
          photoURL: user.photoURL || userDoc.data().photoURL,
          updatedAt: new Date()
        });
        
        console.log('⚡️  [log] - AuthContext: 기존 사용자 정보 업데이트 완료');
      } else {
        console.log('⚡️  [log] - AuthContext: 새 사용자 발견, 문서 생성...');
        
        // 새 사용자 문서 생성
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider: provider,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date(),
          userType: null, // 사용자 타입은 나중에 설정
          isActive: true
        };
        
        console.log('⚡️  [log] - AuthContext: 새 사용자 데이터:', userData);
        await setDoc(userRef, userData);
        console.log('⚡️  [log] - AuthContext: 새 사용자 문서 생성 완료');
      }
      
      console.log('⚡️  [log] - AuthContext: saveUserToFirestore 완료');
      
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: saveUserToFirestore 실패:', error);
      console.error('⚡️  [error] - AuthContext: 에러 상세:', error.message, error.code, error.stack);
      throw error;
    }
  };

  // Google 로그인
  const loginWithGoogle = async () => {
    try {
      console.log('⚡️  [log] - AuthContext: Google 로그인 시작...');
      const platform = isPlatform('ios') ? 'ios' : isPlatform('android') ? 'android' : 'web';
      console.log('⚡️  [log] - AuthContext: 플랫폼:', platform);
      
      // Firebase 모듈이 로드되지 않은 경우 동적 로드
      if (!auth || !db) {
        console.log('⚡️  [log] - AuthContext: Firebase 모듈이 로드되지 않음, 동적 로드 시작...');
        // await loadFirebase(); // 이 부분은 제거되었으므로 주석 처리
      }
      
      if (platform === 'ios' || platform === 'android') {
        // 플랫폼 확인
        const deviceInfo = await Device.getInfo();
        console.log('⚡️  [log] - AuthContext: 디바이스 정보:', deviceInfo);
        
        if (deviceInfo.isVirtual) {
          console.log('⚡️  [log] - AuthContext: 시뮬레이터 감지 → Google 웹 리다이렉트 폴백 사용');
          // 시뮬레이터에서는 웹 리다이렉트 사용
          const provider = new GoogleAuthProvider();
          provider.addScope('email');
          provider.addScope('profile');
          
          await signInWithRedirect(auth, provider);
          return;
        }
      }
      
      // 네이티브 플랫폼 또는 실제 디바이스
      console.log('⚡️  [log] - AuthContext: 네이티브 플랫폼 → Google 팝업 사용');
      
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      const result = await signInWithPopup(auth, provider);
      console.log('⚡️  [log] - AuthContext: Google 팝업 로그인 성공:', result.user);
      
      // 사용자 정보를 Firestore에 저장
      try {
        console.log('⚡️  [log] - AuthContext: Google 로그인 Firestore 저장 시작...');
        await saveUserToFirestore(result.user, 'google', db);
        console.log('⚡️  [log] - AuthContext: Google 로그인 Firestore 저장 완료!');
      } catch (firestoreError) {
        console.error('⚡️  [error] - AuthContext: Google 로그인 Firestore 저장 실패:', firestoreError);
        // Firestore 저장 실패해도 로그인은 성공으로 처리
      }
      return result.user;
      
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: Google 로그인 실패:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('로그인이 취소되었습니다.');
      } else if (error.code === 'auth/popup-blocked') {
        // 팝업이 차단된 경우 리다이렉트 시도
        console.log('⚡️  [log] - AuthContext: 팝업 차단됨 → 리다이렉트 시도');
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        await signInWithRedirect(auth, provider);
        return;
      } else {
        throw error;
      }
    }
  };

  // Apple 로그인
  const loginWithApple = async () => {
    try {
      console.log('⚡️  [log] - AuthContext: Apple 로그인 시작...');
      const platform = isPlatform('ios') ? 'ios' : isPlatform('android') ? 'android' : 'web';
      console.log('⚡️  [log] - AuthContext: 플랫폼:', platform);

      if (platform === 'ios') {
        // iOS에서는 네이티브 Apple Sign In 사용
        console.log('⚡️  [log] - AuthContext: iOS 네이티브 Apple Sign In 시도...');
        
        // 네이티브 Apple Sign In 플러그인 확인
        if (window.Capacitor?.Plugins?.AppleSignInPlugin) {
          console.log('⚡️  [log] - AuthContext: AppleSignInPlugin 발견, 네이티브 Apple Sign In 시작...');
          
          try {
            const result = await window.Capacitor.Plugins.AppleSignInPlugin.signIn();
            console.log('⚡️  [log] - AuthContext: 네이티브 Apple Sign In 결과:', result);
            
            if (result && result.success && result.credential) {
              console.log('⚡️  [log] - AuthContext: Firebase Auth로 Apple Sign In 처리...');
              
                  // Firebase 모듈이 로드되지 않은 경우 강제 초기화 시도
                  if (!auth || !db) {
                    console.log('⚡️  [log] - AuthContext: Firebase 모듈이 로드되지 않음, 강제 초기화 시도...');
                    
                    try {
                      const firebaseInstances = await forceInitializeFirebase();
                      console.log('⚡️  [log] - AuthContext: Firebase 강제 초기화 성공:', firebaseInstances);
                      
                      // 강제 초기화된 Firebase 인스턴스 사용
                      const { auth: forceAuth, db: forceDb } = firebaseInstances;
                      
                      if (!forceAuth || !forceDb) {
                        throw new Error('강제 초기화 후에도 Firebase 인스턴스를 찾을 수 없습니다');
                      }
                      
                      console.log('⚡️  [log] - AuthContext: 강제 초기화된 Firebase 인스턴스 사용');
                      
                    } catch (error) {
                      console.error('⚡️  [log] - AuthContext: Firebase 강제 초기화 실패:', error);
                      throw new Error('Firebase 모듈을 초기화할 수 없습니다: ' + error.message);
                    }
                  }
              
              // OAuthProvider로 Apple Sign In 처리
              const provider = new OAuthProvider('apple.com');
              const credential = provider.credential({
                idToken: result.credential.idToken,
                rawNonce: result.credential.rawNonce
              });
              
              console.log('⚡️  [log] - AuthContext: signInWithCredential 시작...');
              
              // Firebase 인스턴스 상태 재확인
              let currentAuth = auth;
              let currentDb = db;
              
              if (!currentAuth || !currentDb) {
                console.log('⚡️  [log] - AuthContext: Firebase 인스턴스 재확인 필요, 강제 초기화 재시도...');
                const firebaseInstances = await forceInitializeFirebase();
                currentAuth = firebaseInstances.auth;
                currentDb = firebaseInstances.db;
                console.log('⚡️  [log] - AuthContext: 재초기화된 Firebase 인스턴스:', !!currentAuth, !!currentDb);
              }
              
              // 30초 타임아웃 설정
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                  reject(new Error('Firebase Auth 타임아웃 (30초)'));
                }, 30000);
              });
              
              const authPromise = signInWithCredential(currentAuth, credential);
              const userCredential = await Promise.race([authPromise, timeoutPromise]);
              
              console.log('⚡️  [log] - AuthContext: signInWithCredential 완료!');
              const user = userCredential.user;
              console.log('⚡️  [log] - AuthContext: Firebase Auth Apple 로그인 성공:', user);
              
              // 사용자 정보를 Firestore에 저장
              try {
                console.log('⚡️  [log] - AuthContext: Firestore 저장 시작...');
                console.log('⚡️  [log] - AuthContext: 사용자 정보:', {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  providerId: user.providerId
                });
                console.log('⚡️  [log] - AuthContext: Firestore 인스턴스 확인:', !!currentDb);
                console.log('⚡️  [log] - AuthContext: Firestore 앱 참조:', !!currentDb?.app);
                
                await saveUserToFirestore(user, 'apple', currentDb);
                console.log('⚡️  [log] - AuthContext: Firestore 저장 완료!');
              } catch (firestoreError) {
                console.error('⚡️  [error] - AuthContext: Firestore 저장 실패:', firestoreError);
                console.error('⚡️  [error] - AuthContext: Firestore 에러 코드:', firestoreError.code);
                console.error('⚡️  [error] - AuthContext: Firestore 에러 메시지:', firestoreError.message);
                console.error('⚡️  [error] - AuthContext: Firestore 에러 스택:', firestoreError.stack);
                
                // Firestore 저장 실패해도 로그인은 성공으로 처리
                console.log('⚡️  [log] - AuthContext: Firestore 저장 실패했지만 로그인은 성공으로 처리');
              }
              
              console.log('⚡️  [log] - AuthContext: Apple 로그인 완료!');
              return user;
              
            } else {
              throw new Error('Apple Sign In에서 credential을 받지 못했습니다.');
            }
          } catch (nativeError) {
            console.error('⚡️  [error] - AuthContext: 네이티브 Apple Sign In 실패:', nativeError);
            throw nativeError;
          }
        } else {
          console.log('⚡️  [log] - AuthContext: AppleSignInPlugin을 찾을 수 없음, 웹 폴백 사용');
          // 웹 폴백: 리다이렉트 사용
          const provider = new OAuthProvider('apple.com');
          provider.addScope('email');
          provider.addScope('name');
          await signInWithRedirect(auth, provider);
          return;
        }
      } else {
        // 웹 플랫폼에서는 팝업 사용
        console.log('⚡️  [log] - AuthContext: 웹 플랫폼 → Apple 팝업 사용');
        
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        
        const result = await signInWithPopup(auth, provider);
        console.log('⚡️  [log] - AuthContext: Apple 팝업 로그인 성공:', result.user);
        
        await saveUserToFirestore(result.user);
        return result.user;
      }
      
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: Apple 로그인 실패:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('로그인이 취소되었습니다.');
      } else if (error.code === 'auth/popup-blocked') {
        // 팝업이 차단된 경우 리다이렉트 시도
        console.log('⚡️  [log] - AuthContext: 팝업 차단됨 → 리다이렉트 시도');
        const provider = new OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        
        await signInWithRedirect(auth, provider);
        return;
      } else {
        throw error;
      }
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await auth.signOut();
      console.log('⚡️  [log] - AuthContext: 로그아웃 완료');
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: 로그아웃 실패:', error);
      throw error;
    }
  };

  // 사용자 타입 업데이트
  const updateUserType = async (userType) => {
    try {
      if (!currentUser) {
        throw new Error('로그인된 사용자가 없습니다.');
      }
      
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        userType: userType,
        updatedAt: new Date()
      });
      
      // 현재 사용자 상태 업데이트
      setCurrentUser(prev => ({
        ...prev,
        userType: userType
      }));
      
      console.log('⚡️  [log] - AuthContext: 사용자 타입 업데이트 완료:', userType);
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: 사용자 타입 업데이트 실패:', error);
      throw error;
    }
  };

  // 사용자 선호도 업데이트
  const updateUserPreferences = async (preferences) => {
    try {
      if (!currentUser) {
        throw new Error('로그인된 사용자가 없습니다.');
      }
      
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        preferences: preferences,
        updatedAt: new Date()
      });
      
      // 현재 사용자 상태 업데이트
      setCurrentUser(prev => ({
        ...prev,
        preferences: preferences
      }));
      
      console.log('⚡️  [log] - AuthContext: 사용자 선호도 업데이트 완료');
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: 사용자 선호도 업데이트 실패:', error);
      throw error;
    }
  };

  // 사용자 정보 가져오기
  const getUserData = async (uid) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: 사용자 정보 가져오기 실패:', error);
      throw error;
    }
  };

  // 인증 상태 초기화
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        console.log('⚡️  [AuthContext] Firebase 초기화 시작...');
        
        // Firebase 인스턴스 상태 확인
        if (!auth) {
          throw new Error('Firebase Auth 인스턴스가 없습니다!');
        }
        if (!db) {
          throw new Error('Firestore 인스턴스가 없습니다!');
        }
        if (!auth.app) {
          throw new Error('Firebase 앱이 초기화되지 않았습니다!');
        }
        
        console.log('⚡️  [AuthContext] Firebase 인스턴스 상태 확인 완료 - 모든 인스턴스 정상');
        console.log('⚡️  [AuthContext] Firebase 초기화 완료');
        
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          try {
            if (user) {
              console.log('⚡️  [log] - AuthContext: 사용자 로그인 상태 감지:', user);
              
              // Firestore에서 사용자 정보 가져오기
              const userData = await getUserData(user.uid);
              
              if (userData) {
                // Firestore 데이터와 Firebase Auth 데이터 병합
                setCurrentUser({
                  ...user,
                  userType: userData.userType,
                  preferences: userData.preferences
                });
              } else {
                setCurrentUser(user);
              }
            } else {
              console.log('⚡️  [log] - AuthContext: 사용자 로그아웃 상태 감지');
              setCurrentUser(null);
            }
          } catch (error) {
            console.error('⚡️  [error] - AuthContext: 인증 상태 변경 처리 실패:', error);
            setCurrentUser(null);
          } finally {
            setLoading(false);
            setAuthStateReady(true);
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('⚡️  [error] - AuthContext: Firebase 초기화 실패:', error);
        setLoading(false);
        setAuthStateReady(true);
      }
    };

    initializeFirebase();
  }, []);

  // 리다이렉트 결과 처리
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        console.log('⚡️  [log] - AuthContext: 리다이렉트 결과 처리 시작...');
        
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('⚡️  [log] - AuthContext: 리다이렉트 결과 감지:', result.user);
          await saveUserToFirestore(result.user);
        }
      } catch (error) {
        console.error('⚡️  [error] - AuthContext: 리다이렉트 결과 처리 실패:', error);
      }
    };

    handleRedirectResult();
  }, []);

  const value = {
    currentUser,
    loading,
    authStateReady,
    loginWithGoogle,
    loginWithApple,
    logout,
    updateUserType,
    updateUserPreferences,
    getUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 