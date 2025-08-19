/**
 * 회원가입 컴포넌트
 * 새로운 사용자가 계정을 생성할 수 있는 페이지
 * 이메일, 비밀번호, 이름, 사용자 타입(업체/노동자)을 입력받음
 * Firebase Authentication으로 계정 생성 후 Firestore에 사용자 정보 저장
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Register = () => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const { loginWithGoogle, loginWithApple, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/user-type');
    }
  }, [currentUser, navigate]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/business'); // 기본적으로 업자 대시보드로 이동
    } catch (error) {
      console.error('Google 로그인 에러:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      await loginWithApple();
      navigate('/business');
    } catch (error) {
      console.error('Apple 로그인 에러:', error);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            회원가입
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              로그인
            </Link>
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="text-center space-y-3">
            <p className="text-sm text-gray-600 mb-6">
              소셜 계정으로 간편하게 회원가입하세요
            </p>
            
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {googleLoading ? 'Google 로그인 중...' : 'Google로 회원가입'}
            </button>

            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={appleLoading}
              className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.42 2.085-1.26 2.835-.915.825-1.935 1.29-3.06 1.2-.06-1.11.45-2.085 1.29-2.895.885-.87 2.025-1.41 3.03-1.14zM21.165 17.255c-.57 1.365-1.26 2.58-2.055 3.63-1.08 1.425-2.13 2.865-3.855 2.895-1.65.03-2.175-.945-4.05-.945-1.875 0-2.445.915-4.05.975-1.68.06-2.88-1.53-3.96-2.94-2.145-2.79-3.78-7.905-1.575-11.37 1.095-1.77 3.045-2.895 5.145-2.925 1.62-.03 3.15 1.035 4.05 1.035.9 0 2.775-1.275 4.68-1.095.795.03 3.045.315 4.485 2.37-3.78 2.07-3.165 7.485.285 8.565z" />
              </svg>
              {appleLoading ? 'Apple 로그인 중...' : 'Apple로 회원가입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register; 