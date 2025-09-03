/**
 * 로그인 컴포넌트
 * 사용자가 이메일과 비밀번호로 로그인할 수 있는 페이지
 * Firebase Authentication을 사용하여 로그인 처리
 * 로그인 성공 시 사용자 타입에 따라 대시보드로 리다이렉트
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
// import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';

const Login = () => {
  // 이메일/비밀번호 로그인 제거
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { loginWithGoogle, loginWithApple, currentUser } = useAuth();
  const navigate = useNavigate();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleOAuthEnabled = Boolean(googleClientId);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  
  // 플랫폼 감지 (Capacitor 공식 API 사용)
  const [platform, setPlatform] = useState(Capacitor.getPlatform());
  const isNative = Capacitor.isNativePlatform();
  
  useEffect(() => {
    const currentPlatform = Capacitor.getPlatform();
    setPlatform(currentPlatform);
    console.log('Login: 플랫폼:', currentPlatform, 'isNative:', Capacitor.isNativePlatform());
  }, []);

  // 사용자 로그인 상태 감지하여 자동 네비게이션
  useEffect(() => {
    if (currentUser) {
      console.log('Login: 사용자 로그인 감지, 사용자 타입 선택 화면으로 이동');
      console.log('Login: 현재 사용자 정보:', currentUser);
      
      // 약간의 지연을 두고 네비게이션 (상태 안정화를 위해)
      const timer = setTimeout(() => {
        console.log('Login: 네비게이션 시작 - /user-type으로 이동');
        
        try {
          navigate('/user-type');
          console.log('Login: useEffect에서 네비게이션 성공');
          
          // UserTypeSelection으로 이동 후 currentUser를 null로 설정하여 무한 루프 방지
          setTimeout(() => {
            if (window.__FIREBASE_DEBUG__) {
              window.__FIREBASE_DEBUG__.currentUser = null;
              console.log('Login: 전역 상태에서 currentUser 제거 (무한 루프 방지)');
            }
            // AuthContext의 currentUser는 AuthContext 내부에서 관리됨
            console.log('Login: AuthContext currentUser는 AuthContext에서 관리됨');
          }, 100);
          
        } catch (navError) {
          console.error('Login: useEffect에서 네비게이션 실패:', navError);
          
          // 강제 페이지 이동 시도
          setTimeout(() => {
            window.location.href = '/user-type';
            console.log('Login: 강제 페이지 이동 시도');
          }, 500); // 0.5초로 단축
        }
      }, 200); // 지연 시간 단축 (0.5초 → 0.2초)
      
      return () => clearTimeout(timer);
    }
  }, [currentUser, navigate]);

  // 디버깅을 위한 사용자 상태 로깅
  useEffect(() => {
    console.log('Login: currentUser 상태 변화:', currentUser);
    console.log('Login: currentUser 타입:', typeof currentUser);
    console.log('Login: currentUser null 여부:', currentUser === null);
    console.log('Login: currentUser undefined 여부:', currentUser === undefined);
    
    // URL 파라미터도 함께 확인
    const urlParams = new URLSearchParams(window.location.search);
    const hasAuthParams = urlParams.has('apiKey') || urlParams.has('authDomain') || 
                         urlParams.has('continueUrl') || urlParams.has('state');
    
    if (hasAuthParams) {
      console.log('Login: 사용자 상태 변화 시에도 인증 관련 URL 파라미터 존재');
    }
    
    // 전역 상태도 확인
    if (window.__FIREBASE_DEBUG__) {
      console.log('Login: 전역 Firebase 디버그 상태:', window.__FIREBASE_DEBUG__);
    }
  }, [currentUser]);

  // 페이지 로드 시 리다이렉트 결과 확인
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        // URL 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const hasAuthParams = urlParams.has('apiKey') || urlParams.has('authDomain') || 
                             urlParams.has('continueUrl') || urlParams.has('state');
        
        console.log('Login: URL 파라미터 확인:', {
          hasAuthParams,
          urlParams: Object.fromEntries(urlParams.entries())
        });
        
        // 로컬호스트 환경 확인
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        console.log('Login: 로컬호스트 환경 여부:', isLocalhost);
        
        if (hasAuthParams) {
          console.log('Login: 인증 관련 URL 파라미터 발견, 리다이렉트 결과 대기 중...');
          
          // URL 파라미터가 있으면 리다이렉트 결과 대기
          setTimeout(async () => {
            try {
              const { getRedirectResult } = await import('firebase/auth');
              const { auth } = await import('../../firebase');
              
              const redirectResult = await getRedirectResult(auth);
              if (redirectResult) {
                console.log('Login: 지연된 리다이렉트 결과 발견:', redirectResult.user);
              }
            } catch (error) {
              console.log('Login: 지연된 리다이렉트 결과 확인 실패:', error);
            }
          }, 2000);
        }
        
        // 즉시 리다이렉트 결과 확인
        const { getRedirectResult } = await import('firebase/auth');
        const { auth } = await import('../../firebase');
        
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult) {
          console.log('Login: 페이지 로드 시 리다이렉트 결과 발견:', redirectResult.user);
        }
        
        // 로컬호스트 환경에서 추가 확인
        if (isLocalhost && !redirectResult) {
          console.log('Login: 로컬호스트 환경에서 추가 리다이렉트 결과 확인...');
          
          setTimeout(async () => {
            try {
              const delayedResult = await getRedirectResult(auth);
              if (delayedResult) {
                console.log('Login: 로컬호스트 지연된 리다이렉트 결과 발견:', delayedResult.user);
              }
            } catch (error) {
              console.log('Login: 로컬호스트 지연된 리다이렉트 결과 확인 실패:', error);
            }
          }, 3000);
          
          // 로컬호스트에서 추가 지연 확인 (8초 후)
          setTimeout(async () => {
            try {
              const extraDelayedResult = await getRedirectResult(auth);
              if (extraDelayedResult) {
                console.log('Login: 로컬호스트 추가 지연된 리다이렉트 결과 발견:', extraDelayedResult.user);
              }
            } catch (error) {
              console.log('Login: 로컬호스트 추가 지연된 리다이렉트 결과 확인 실패:', error);
            }
          }, 8000);
        }
      } catch (error) {
        console.log('Login: 리다이렉트 결과 확인 실패:', error);
      }
    };
    
    checkRedirectResult();
  }, []);

  // 이메일/비밀번호 로그인 핸들러 제거

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      console.log('Login: Google 로그인 시작...');
      console.log('Login: 현재 플랫폼:', platform);
      
      // AuthContext의 loginWithGoogle 메서드 사용
      const user = await loginWithGoogle();
      
      if (user) {
        console.log('Login: Google 로그인 성공, 사용자:', user);
        console.log('Login: 사용자 타입 선택 화면으로 이동');
        
        // 약간의 지연을 두고 네비게이션
        setTimeout(() => {
          navigate('/user-type');
        }, 1000);
      }
      
    } catch (error) {
      console.error('Login: Google 로그인 에러:', error);
      
      // 구체적인 에러 메시지 표시
      let errorMessage = 'Google 로그인 중 오류가 발생했습니다.';
      
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = '로그인 창이 닫혔습니다. 다시 시도해주세요.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = '팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
      } else if (error.message && error.message.includes('Cross-Origin-Opener-Policy')) {
        errorMessage = '보안 정책으로 인해 로그인 창이 차단되었습니다. 새로고침 후 다시 시도하거나, 다른 브라우저를 사용해주세요.';
      } else if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
        errorMessage = '로그인 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message && error.message.includes('모바일에서 Google 로그인에 실패했습니다')) {
        errorMessage = '모바일에서 로그인에 실패했습니다. 다시 시도해주세요.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error('Login: 에러 메시지:', errorMessage);
      
      // 사용자에게 에러 메시지 표시
      alert(errorMessage);
      
      // 에러 발생 시 로딩 상태 해제
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      console.log('Login: Apple 로그인 시작...');
      const user = await loginWithApple();
      
      // Apple 로그인 성공 시 즉시 네비게이션
      if (user) {
        console.log('Login: Apple 로그인 성공, 즉시 사용자 타입 선택 화면으로 이동');
        try {
          navigate('/user-type');
          console.log('Login: 즉시 네비게이션 성공');
          
          // UserTypeSelection으로 이동 후 currentUser를 null로 설정하여 무한 루프 방지
          setTimeout(() => {
            if (window.__FIREBASE_DEBUG__) {
              window.__FIREBASE_DEBUG__.currentUser = null;
              console.log('Login: 전역 상태에서 currentUser 제거 (무한 루프 방지)');
            }
            // AuthContext의 currentUser는 AuthContext 내부에서 관리됨
            console.log('Login: AuthContext currentUser는 AuthContext에서 관리됨');
          }, 100);
          
        } catch (navError) {
          console.log('Login: 즉시 네비게이션 실패, 지연 후 재시도:', navError);
          
          // 2. 지연 후 네비게이션 재시도
          setTimeout(() => {
            try {
              navigate('/user-type');
              console.log('Login: 지연 후 네비게이션 성공');
            } catch (retryError) {
              console.error('Login: 지연 후 네비게이션도 실패:', retryError);
              
              // 3. 강제 페이지 이동
              window.location.href = '/user-type';
              console.log('Login: 강제 페이지 이동 시도');
            }
          }, 200); // 0.2초로 단축
        }
      }
      
      // 리다이렉트 플로우이므로 여기 아래 코드는 보통 실행되지 않음
    } catch (error) {
      console.error('Login: Apple 로그인 에러:', error);
      alert('Apple 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setAppleLoading(false);
    }
  };

  // 웹 기반 Google 로그인 (네이티브 환경에서도)
  const handleGoogleLoginNative = async () => {
    setGoogleLoading(true);
    try {
      console.log('Login: 웹 기반 Google 로그인 시작...');
      await loginWithGoogle();
    } catch (e) {
      console.error('Login: 웹 기반 Google 로그인 실패', e);
      alert('Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-4 px-4 sm:py-12 sm:px-6 lg:px-8 login-container">
      <div className="max-w-md w-full space-y-4 sm:space-y-8">
        <div>
          <h2 className="mt-2 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900 text-responsive-2xl">
            로그인
          </h2>
          <p className="mt-2 text-center text-xs sm:text-sm text-gray-600 text-responsive-sm">
            계정이 없으신가요?{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              회원가입
            </Link>
          </p>
        </div>
        
        <div className="mt-4 sm:mt-8 space-y-4 sm:space-y-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Google / Apple 로그인 버튼 */}
            <div className="text-center">
              <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 text-responsive-sm">
                소셜 계정으로 간편하게 로그인하세요
              </p>
              
              <div className="w-full">
                {/* 네이티브 환경에서는 Apple 로그인만 제공 */}
                {isNative ? (
                  <div className="text-center">
                    <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3 text-responsive-sm">
                      📱 네이티브 앱에서는 Apple 로그인을 사용해주세요
                    </p>
                    <p className="text-xs text-gray-400 mb-3 sm:mb-4 text-responsive-xs">
                      Google 로그인이 필요하시면 웹 버전을 이용해주세요
                    </p>
                  </div>
                ) : googleOAuthEnabled ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowGoogleModal(true)}
                      disabled={googleLoading || currentUser}
                      className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {googleLoading ? 'Google 로그인 중...' : 'Google로 로그인'}
                    </button>
                    {showGoogleModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                        <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
                          <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">Google 로그인</h3>
                            <button
                              type="button"
                              onClick={() => setShowGoogleModal(false)}
                              className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                              aria-label="close"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex justify-center">
                            <GoogleLogin
                              onSuccess={async (credentialResponse) => {
                                try {
                                  setGoogleLoading(true);
                                  const idToken = credentialResponse.credential;
                                  const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
                                  const { auth } = await import('../../firebase');
                                  const credential = GoogleAuthProvider.credential(idToken);
                                  const userCred = await signInWithCredential(auth, credential);
                                  console.log('Login: GIS 성공 → Firebase 로그인 완료', userCred.user);
                                  setShowGoogleModal(false);
                                  navigate('/user-type');
                                } catch (e) {
                                  console.error('Login: GIS→Firebase 교환 실패', e);
                                  alert('Google 로그인에 실패했습니다. 새로고침 후 다시 시도해주세요.');
                                } finally {
                                  setGoogleLoading(false);
                                }
                              }}
                              onError={async () => {
                                console.log('Login: GIS 실패');
                                alert('Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
                              }}
                              useOneTap={false}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || currentUser}
                    className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {googleLoading ? 'Google 로그인 중...' : 
                      currentUser ? '로그인 완료, 이동 중...' : 'Google로 로그인'}
                  </button>
                )}
              </div>

              {/* Apple 로그인 버튼 */}
              <div className="w-full mt-2 sm:mt-3">
                <button
                  type="button"
                  onClick={handleAppleLogin}
                  disabled={appleLoading || currentUser}
                  className="w-full flex justify-center items-center px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-md shadow-sm bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 btn-mobile touch-target text-responsive-sm"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16.365 1.43c0 1.14-.42 2.085-1.26 2.835-.915.825-1.935 1.29-3.06 1.2-.06-1.11.45-2.085 1.29-2.895.885-.87 2.025-1.41 3.03-1.14zM21.165 17.255c-.57 1.365-1.26 2.58-2.055 3.63-1.08 1.425-2.13 2.865-3.855 2.895-1.65.03-2.175-.945-4.05-.945-1.875 0-2.445.915-4.05.975-1.68.06-2.88-1.53-3.96-2.94-2.145-2.79-3.78-7.905-1.575-11.37 1.095-1.77 3.045-2.895 5.145-2.925 1.62-.03 3.15 1.035 4.05 1.035.9 0 2.775-1.275 4.68-1.095.795.03 3.045.315 4.485 2.37-3.78 2.07-3.165 7.485.285 8.565z" />
                  </svg>
                  {appleLoading ? 'Apple 로그인 중...' : currentUser ? '로그인 완료, 이동 중...' : 'Apple로 로그인'}
                </button>
              </div>
              
              {/* 로그인 상태 표시 */}
              {currentUser && (
                <div className="mt-2 text-center text-sm text-green-600">
                  로그인 성공! 사용자 타입 선택 화면으로 이동 중...
                </div>
              )}
            </div>
            
            {/* 이메일/비밀번호 로그인 UI 제거됨 */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 