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

  // 공용 유틸: 타임아웃/재시도
  const createTimeout = (ms, message) => new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message || `요청 타임아웃 (${ms}ms)`)), ms);
  });

  const withRetry = async (fn, { retries = 2, baseDelayMs = 1000 } = {}) => {
    let attempt = 0;
    let lastError = null;
    while (attempt <= retries) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const code = err?.code || '';
        const msg = err?.message || '';
        const retryable = code === 'auth/network-request-failed' || msg.includes('타임아웃') || msg.toLowerCase().includes('network');
        if (!retryable || attempt === retries) break;
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        attempt += 1;
      }
    }
    throw lastError || new Error('요청 실패');
  };

  // 사용자 정보를 Firestore에 저장하는 함수
  const saveUserToFirestore = async (user, provider, dbInstance = null) => {
    console.log('⚡️  [log] - AuthContext: saveUserToFirestore 시작, 사용자:', user);
    console.log('⚡️  [log] - AuthContext: 제공자:', provider);
    console.log('⚡️  [log] - AuthContext: 전달받은 Firestore 인스턴스:', !!dbInstance);
    console.log('⚡️  [log] - AuthContext: 기본 Firestore 인스턴스:', !!db);
    
    // 사용할 Firestore 인스턴스 결정
    const targetDb = dbInstance || db;
    console.log('⚡️  [log] - AuthContext: 사용할 Firestore 인스턴스:', !!targetDb);
    console.log('⚡️  [log] - AuthContext: Firestore 앱 참조:', !!targetDb?.app);
    
    if (!targetDb) {
      throw new Error('Firestore 인스턴스를 찾을 수 없습니다.');
    }
    
    try {
      // Firestore 문서 참조 생성
      const userRef = doc(targetDb, 'users', user.uid);
      console.log('⚡️  [log] - AuthContext: Firestore 문서 참조 생성:', `users/${user.uid}`);
      
      // 기존 사용자 문서 확인 시작...
      console.log('⚡️  [log] - AuthContext: 기존 사용자 문서 확인 시작...');
      
      // Firestore 작업에 타임아웃 추가 (30초로 증가)
                      const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => {
                    reject(new Error('Firestore 작업 타임아웃 (60초)'));
                  }, 60000); // 60초 타임아웃으로 증가
                });
      
      // 기존 사용자 확인
      const checkUserPromise = getDoc(userRef);
      const checkResult = await Promise.race([checkUserPromise, timeoutPromise]);
      console.log('⚡️  [log] - AuthContext: 기존 사용자 확인 완료:', !!checkResult);
      
      if (checkResult.exists()) {
        console.log('⚡️  [log] - AuthContext: 기존 사용자 발견, 업데이트 시작...');
        
        // 기존 사용자 정보 업데이트
        const updatePromise = updateDoc(userRef, {
          lastSignInTime: new Date().toISOString(),
          provider: provider,
          updatedAt: new Date().toISOString()
        });
        
        await Promise.race([updatePromise, timeoutPromise]);
        console.log('⚡️  [log] - AuthContext: 기존 사용자 업데이트 완료');
        
      } else {
        console.log('⚡️  [log] - AuthContext: 새 사용자 발견, 생성 시작...');
        
        // 새 사용자 정보 생성
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Apple User',
          provider: provider,
          createdAt: new Date().toISOString(),
          lastSignInTime: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true
        };
        
        console.log('⚡️  [log] - AuthContext: 저장할 사용자 데이터:', userData);
        
        const createPromise = setDoc(userRef, userData);
        await Promise.race([createPromise, timeoutPromise]);
        console.log('⚡️  [log] - AuthContext: 새 사용자 생성 완료');
      }
      
      console.log('⚡️  [log] - AuthContext: Firestore 저장 완료!');
      return true;
      
    } catch (error) {
      console.error('⚡️  [error] - AuthContext: Firestore 저장 실패:', error);
      console.error('⚡️  [error] - AuthContext: 에러 타입:', typeof error);
      console.error('⚡️  [error] - AuthContext: 에러 메시지:', error.message);
      console.error('⚡️  [error] - AuthContext: 에러 스택:', error.stack);
      
      // 타임아웃 에러인 경우 재시도 로직 실행
      if (error.message && error.message.includes('타임아웃')) {
        console.log('⚡️  [log] - AuthContext: Firestore 타임아웃, 재시도 중...');
        
        try {
          // 간단한 데이터로 재시도 (기본 정보만)
          const simpleData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Apple User',
            provider: provider,
            lastSignInTime: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          console.log('⚡️  [log] - AuthContext: 재시도 데이터:', simpleData);
          
          // 재시도 시에는 더 짧은 타임아웃 사용
                              const retryTimeoutPromise = new Promise((_, reject) => {
                      setTimeout(() => {
                        reject(new Error('Firestore 재시도 타임아웃 (30초)'));
                      }, 30000);
                    });
          
          await Promise.race([
            setDoc(userRef, simpleData, { merge: true }),
            retryTimeoutPromise
          ]);
          
          console.log('⚡️  [log] - AuthContext: 재시도 성공!');
          return true;
          
        } catch (retryError) {
          console.error('⚡️  [error] - AuthContext: 재시도 실패:', retryError);
          console.log('⚡️  [log] - AuthContext: Firestore 저장 실패했지만 로그인은 계속 진행');
          return false;
        }
      }
      
      // 타임아웃이 아닌 다른 에러의 경우
      console.log('⚡️  [log] - AuthContext: Firestore 저장 실패했지만 로그인은 계속 진행');
      return false;
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
        // 모바일(iOS/Android)은 항상 리다이렉트 사용
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        try { sessionStorage.setItem('PENDING_GOOGLE_REDIRECT', '1'); } catch (_) {}
        console.log('⚡️  [log] - AuthContext: 모바일 플랫폼 → Google 리다이렉트 사용');
        await signInWithRedirect(auth, provider);
        return;
      }
      
      // 웹은 팝업 우선, 차단 시 리다이렉트로 폴백
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      const result = await signInWithPopup(auth, provider);
      console.log('⚡️  [log] - AuthContext: Google 팝업 로그인 성공:', result.user);
      try { await saveUserToFirestore(result.user, 'google', db); } catch (e) { console.error('Firestore 저장 실패', e); }
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
        
        // 네이티브 Apple Sign In 플러그인 확인 (두 경로 모두 지원)
        const getApplePlugin = () => (window.AppleSignInPlugin || window.Capacitor?.Plugins?.AppleSignInPlugin);
        // 플러그인이 늦게 등록되는 경우를 위해 최대 2초 대기하며 폴링
        const waitForPlugin = async (timeoutMs = 6000, intervalMs = 150) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            const plugin = getApplePlugin();
            if (plugin && typeof plugin.signIn === 'function') return plugin;
            await new Promise(r => setTimeout(r, intervalMs));
          }
          const plugin = getApplePlugin();
          return (plugin && typeof plugin.signIn === 'function') ? plugin : null;
        };

        let plugin = await waitForPlugin();

        // 플러그인이 아직 없다면 messageHandler를 직접 사용해 임시 브릿지 생성
        if (!plugin && window.webkit?.messageHandlers?.AppleSignInPlugin) {
          console.log('⚡️  [log] - AuthContext: messageHandler 감지 → 임시 브릿지 생성');
          window.AppleSignInPlugin = {
            signIn: () => new Promise((resolve, reject) => {
              window._appleSignInResolve = resolve;
              window._appleSignInReject = reject;
              try {
                window.webkit.messageHandlers.AppleSignInPlugin.postMessage({ action: 'signIn' });
              } catch (e) {
                reject(e);
              }
            })
          };
          if (window.Capacitor?.Plugins) {
            window.Capacitor.Plugins.AppleSignInPlugin = window.AppleSignInPlugin;
          }
          plugin = window.AppleSignInPlugin;
        }

        if (plugin) {
          console.log('⚡️  [log] - AuthContext: AppleSignInPlugin 발견, 네이티브 Apple Sign In 시작...');
          
          try {
            const result = await plugin.signIn();
            console.log('⚡️  [log] - AuthContext: 네이티브 Apple Sign In 결과:', result);
            
            if (result && result.success && result.credential) {
              console.log('⚡️  [log] - AuthContext: Firebase Auth로 Apple Sign In 처리...');
              
                    // Firebase 모듈이 로드되지 않은 경우 강제 초기화 시도
      if (!auth || !db) {
        console.log('⚡️  [log] - AuthContext: Firebase 모듈이 로드되지 않음, 강제 초기화 시도...');
        console.log('⚡️  [log] - AuthContext: Auth 인스턴스 상태:', !!auth);
        console.log('⚡️  [log] - AuthContext: DB 인스턴스 상태:', !!db);
        console.log('⚡️  [log] - AuthContext: 전역 Firebase 상태:', !!window.__FIREBASE_DEBUG__);
                
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
              
              // Google 로그인과 동일한 방식으로 Apple OAuth Provider 사용
              console.log('⚡️  [log] - AuthContext: Apple OAuth Provider로 Firebase Auth 처리...');
              
              // Apple ID Token으로 credential 생성 (올바른 방식)
              const provider = new OAuthProvider('apple.com');
              const credential = provider.credential({
                idToken: result.credential.idToken,
                rawNonce: result.credential.rawNonce
              });
              
              console.log('⚡️  [log] - AuthContext: signInWithCredential 시작...');
              console.log('⚡️  [log] - AuthContext: credential 객체:', credential);
              console.log('⚡️  [log] - AuthContext: currentAuth 인스턴스:', !!auth);
              
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
              
              // Google 로그인과 동일한 방식으로 처리
              console.log('⚡️  [log] - AuthContext: Google 로그인과 동일한 방식으로 Apple 로그인 처리...');
              
              try {
                console.log('⚡️  [log] - AuthContext: signInWithCredential 실행 시작...');
                
                // Firebase Auth 타임아웃 설정 (60초로 증가) + 더 강력한 에러 처리
                console.log('⚡️  [log] - AuthContext: Firebase Auth 타임아웃 설정 적용...');
                
                // Auth 설정 확인 및 수정
                if (currentAuth && currentAuth.config) {
                  try {
                    console.log('⚡️  [log] - AuthContext: 현재 Auth 설정:', currentAuth.config);
                    console.log('⚡️  [log] - AuthContext: Auth 앱 참조:', !!currentAuth.app);
                    console.log('⚡️  [log] - AuthContext: Auth 프로젝트 ID:', currentAuth.app?.options?.projectId);
                    
                    // Firebase Auth 연결 상태 테스트
                    console.log('⚡️  [log] - AuthContext: Firebase Auth 연결 상태 테스트 시작...');
                    console.log('⚡️  [log] - AuthContext: currentAuth.tenantId:', currentAuth.tenantId);
                    console.log('⚡️  [log] - AuthContext: currentAuth.languageCode:', currentAuth.languageCode);
                    console.log('⚡️  [log] - AuthContext: currentAuth.settings:', currentAuth.settings);
                    
                    // 네트워크 연결 상태 확인
                    if (navigator.onLine) {
                      console.log('⚡️  [log] - AuthContext: 네트워크 연결 상태: 온라인');
                    } else {
                      console.log('⚡️  [log] - AuthContext: 네트워크 연결 상태: 오프라인');
                    }
                    
                  } catch (configError) {
                    console.error('⚡️  [error] - AuthContext: Auth 설정 확인 중 오류:', configError);
                  }
                }
                
                // Firebase Auth 실행: 타임아웃 + 재시도
                const attemptSignIn = async () => {
                  const authPromise = signInWithCredential(currentAuth, credential);
                  console.log('⚡️  [log] - AuthContext: signInWithCredential Promise 생성 완료');
                  return await Promise.race([
                    authPromise,
                    createTimeout(20000, 'Firebase Auth 타임아웃 (20초) - 서버 연결 실패')
                  ]);
                };

                const userCredential = await withRetry(attemptSignIn, { retries: 2, baseDelayMs: 1500 });
                console.log('⚡️  [log] - AuthContext: signInWithCredential 완료!');
                
                const user = userCredential.user;
                console.log('⚡️  [log] - AuthContext: Firebase Auth Apple 로그인 성공:', user);
                
                // Firebase Auth 성공 시 인증 상태 즉시 업데이트
                console.log('⚡️  [log] - AuthContext: Firebase Auth 성공 후 인증 상태 업데이트 시작...');
                setCurrentUser(user);
                console.log('⚡️  [log] - AuthContext: Firebase Auth 성공 후 인증 상태 업데이트 완료:', user);
                
                // 사용자 정보를 Firestore에 저장 (Google 로그인과 동일한 방식)
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
                  
                  // Firestore 저장 실패해도 로그인은 성공으로 처리 (Google 로그인과 동일)
                  console.log('⚡️  [log] - AuthContext: Firestore 저장 실패했지만 로그인은 성공으로 처리');
                }
                
                console.log('⚡️  [log] - AuthContext: Apple 로그인 완료!');
                return user;
                
              } catch (authError) {
                console.error('⚡️  [error] - AuthContext: signInWithCredential 실패:', authError);
                console.error('⚡️  [error] - AuthContext: 에러 타입:', typeof authError);
                console.error('⚡️  [error] - AuthContext: 에러 코드:', authError.code);
                console.error('⚡️  [error] - AuthContext: 에러 메시지:', authError.message);
                console.error('⚡️  [error] - AuthContext: 에러 스택:', authError.stack);
                console.error('⚡️  [error] - AuthContext: 에러 전체 객체:', JSON.stringify(authError, null, 2));
                
                // Google 로그인과 동일한 에러 처리
                if (authError.code === 'auth/popup-closed-by-user') {
                  throw new Error('Apple 로그인이 취소되었습니다.');
                } else if (authError.code === 'auth/popup-blocked') {
                  throw new Error('Apple 로그인 팝업이 차단되었습니다.');
                } else if (authError.message && authError.message.includes('타임아웃')) {
                  throw new Error('Apple 로그인 시간이 초과되었습니다. 다시 시도해주세요.');
                } else {
                  throw new Error(`Apple 로그인 실패: ${authError.message || '알 수 없는 오류'}`);
                }
              }
              
            } else {
              throw new Error('Apple Sign In에서 credential을 받지 못했습니다.');
            }
          } catch (nativeError) {
            console.error('⚡️  [error] - AuthContext: 네이티브 Apple Sign In 실패:', nativeError);
            throw nativeError;
          }
        } else {
          console.log('⚡️  [log] - AuthContext: AppleSignInPlugin을 찾을 수 없음 → 네이티브 필요, 중단');
          throw new Error('iOS 네이티브 Apple 로그인 플러그인을 사용할 수 없습니다.');
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

  // 리다이렉트 결과 처리: 모바일(iOS/Android) 포함 항상 시도
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        console.log('⚡️  [log] - AuthContext: 리다이렉트 결과 처리 시작...');
        const result = await getRedirectResult(auth);
        if (result) {
          console.log('⚡️  [log] - AuthContext: 리다이렉트 결과 감지:', result.user);
          await saveUserToFirestore(result.user, 'google', db);
        }
      } catch (error) {
        console.error('⚡️  [error] - AuthContext: 리다이렉트 결과 처리 실패:', error);
      } finally {
        try { sessionStorage.removeItem('PENDING_GOOGLE_REDIRECT'); } catch (_) {}
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