/**
 * 메인 앱 컴포넌트
 * 전체 애플리케이션의 루트 컴포넌트
 * 라우팅 설정, 인증 상태 관리, 전역 레이아웃 제공
 * 모든 페이지 컴포넌트를 포함하는 컨테이너 역할
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
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

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="App">
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
            
            {/* 기본 리다이렉트 */}
            <Route path="/" element={<Login />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
