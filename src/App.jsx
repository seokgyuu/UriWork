/**
 * 메인 앱 컴포넌트
 * 전체 애플리케이션의 루트 컴포넌트
 * 라우팅 설정, 인증 상태 관리, 전역 레이아웃 제공
 * 모든 페이지 컴포넌트를 포함하는 컨테이너 역할
 */

import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import UserTypeSelection from './components/auth/UserTypeSelection';
import Profile from './components/auth/Profile';
import BusinessDashboard from './components/business/BusinessDashboard';
import WorkerDashboard from './components/worker/WorkerDashboard';
import Calendar from './components/calendar/Calendar';
import BookingForm from './components/booking/BookingForm';
import Subscription from './components/subscription/Subscription';
import Chatbot from './components/chatbot/Chatbot';
import './App.css';

// 개발 환경에서 더미 사용자 생성 - 제거됨
// if (import.meta.env.DEV) {
//   import('./utils/createDummyUsers');
// }

// 메인 앱 컴포넌트 (인증 상태에 따른 라우팅)
function AppContent() {
  const { currentUser, loading, authStateReady } = useAuth();

  // 인증 상태가 준비되지 않았거나 로딩 중일 때
  if (!authStateReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">앱을 불러오는 중...</p>
          <p className="mt-2 text-gray-500 text-sm">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 로그인된 사용자가 있으면 적절한 대시보드로 리다이렉트
  if (currentUser) {
    return <Navigate to="/profile" replace />;
  }

  // 로그인되지 않은 경우 로그인 페이지로
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ErrorBoundary>
        <div className="App safe-area-top safe-area-bottom container-responsive">
          <Routes>
            {/* 공개 라우트 */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/user-type" element={<UserTypeSelection />} />
            
            {/* 보호된 라우트 */}
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            
            <Route path="/business" element={
              <ProtectedRoute>
                <BusinessDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/worker" element={
              <ProtectedRoute>
                <WorkerDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/calendar/:businessId" element={
              <ProtectedRoute>
                <Calendar />
              </ProtectedRoute>
            } />
            
            <Route path="/booking" element={
              <ProtectedRoute>
                <BookingForm />
              </ProtectedRoute>
            } />
            
            <Route path="/subscription" element={
              <ProtectedRoute>
                <Subscription />
              </ProtectedRoute>
            } />
            
            <Route path="/chatbot" element={
              <ProtectedRoute>
                <Chatbot />
              </ProtectedRoute>
            } />
            
            {/* 기본 라우트 - 인증 상태에 따라 자동 리다이렉트 */}
            <Route path="/" element={<AppContent />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}

export default App;
