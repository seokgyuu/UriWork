/**
 * API 서비스 모듈
 * 백엔드 API와의 통신을 담당하는 서비스 함수들
 * 인증 토큰 자동 추가, 에러 처리, 인터셉터 설정
 * 각 기능별로 API 함수들을 그룹화하여 관리
 */

import axios from 'axios';
import { auth } from '../firebase';

// 환경에 따른 API URL 설정
const getApiBaseUrl = () => {
  // 환경 변수에서 API URL 가져오기
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  if (envApiUrl) {
    console.log('🌐 환경 변수에서 API URL 사용:', envApiUrl);
    return envApiUrl;
  }
  
  // 개발 환경 (로컬)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8001';
  }
  
  // iOS 시뮬레이터 (개발용)
  if (window.location.hostname.includes('capacitor')) {
    return 'http://localhost:8001';
  }
  
  // iOS 실제 디바이스 (개발용) - MacBook의 IP 주소 사용
  if (window.location.hostname.includes('ionic') || window.location.hostname.includes('capacitor')) {
    // 환경 변수에서 IP 주소 가져오기 (없으면 기본값 사용)
    const devServerIP = import.meta.env.VITE_DEV_SERVER_IP || '192.168.1.100';
    console.log('📱 iOS 디바이스 감지, 개발 서버 IP:', devServerIP);
    return `http://${devServerIP}:8001`;
  }
  
  // 프로덕션 환경 (TestFlight, 실제 배포)
  // Cloud Run 서버 URL (올바른 URL 사용)
  const cloudRunUrl = import.meta.env.VITE_CLOUD_RUN_URL || 'https://uriwork-fastapi-1014872932714.asia-northeast3.run.app';
  console.log('☁️ Cloud Run URL 사용:', cloudRunUrl);
  return cloudRunUrl;
};

const API_BASE_URL = getApiBaseUrl();

// 디버깅을 위한 로그
console.log('🔍 API 설정 정보:', {
  hostname: window.location.hostname,
  apiBaseUrl: API_BASE_URL,
  environment: import.meta.env.MODE,
  viteCloudRunUrl: import.meta.env.VITE_CLOUD_RUN_URL
});

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 타임아웃
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 - 토큰 추가 (개발 모드에서는 더미 토큰 사용)
api.interceptors.request.use(
  async (config) => {
    console.log('🌐 API 요청 시작:', {
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      method: config.method,
      hostname: window.location.hostname
    });
    
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
        console.log('✅ Firebase 토큰 사용:', token.substring(0, 20) + '...');
      } catch (error) {
        // 개발 모드에서는 더미 토큰 사용
        console.log('⚠️ Firebase 토큰 가져오기 실패, 개발 모드로 실행:', error.message);
        config.headers.Authorization = `Bearer dev_token_123`;
      }
    } else {
      // 사용자가 없어도 개발 모드에서는 더미 토큰 사용
      console.log('⚠️ 사용자 없음, 개발 모드 토큰 사용');
      config.headers.Authorization = `Bearer dev_token_123`;
    }
    
    console.log('📤 최종 요청 헤더:', config.headers);
    return config;
  },
  (error) => {
    console.error('❌ 요청 인터셉터 오류:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 - 에러 처리
api.interceptors.response.use(
  (response) => {
    console.log('✅ API 응답 성공:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ API 응답 오류:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
      fullURL: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
      responseData: error.response?.data,
      requestData: error.config?.data
    });
    
    if (error.response?.status === 401) {
      // 인증 에러 처리
      console.log('🔐 인증 에러 - 토큰이 유효하지 않습니다');
    } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      console.log('🌐 네트워크 오류 - 서버에 연결할 수 없습니다');
      console.log('💡 해결 방법:');
      console.log('   1. 인터넷 연결 확인');
      console.log('   2. Cloud Run 서비스 상태 확인');
      console.log('   3. API URL 확인:', error.config?.baseURL);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🔌 연결 거부 - 백엔드 서버가 실행 중인지 확인하세요');
    } else if (error.code === 'ENOTFOUND') {
      console.log('🔍 DNS 오류 - 서버 주소를 찾을 수 없습니다');
      console.log('💡 해결 방법: API URL을 확인하세요:', error.config?.baseURL);
    } else if (error.code === 'CERT_HAS_EXPIRED' || error.message.includes('certificate')) {
      console.log('🔒 SSL 인증서 오류 - HTTPS 연결 문제');
    }
    
    return Promise.reject(error);
  }
);

// 인증 API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (userData) => api.post('/auth/login', userData),
};

// 업자 API
export const businessAPI = {
  createCalendar: () => api.post('/business/calendar'),
  generateWorkerCode: () => api.post('/business/generate-code'),
};

// 직원 API
export const workerAPI = {
  useCode: (code) => api.post(`/worker/use-code/${code}`),
};

// 예약 API
export const bookingAPI = {
  create: (bookingData) => api.post('/booking/create', bookingData),
  getBookings: (businessId) => api.get(`/bookings/${businessId}`),
};

// 구독 API
export const subscriptionAPI = {
  create: (subscriptionData) => api.post('/subscription/create', subscriptionData),
};

// 챗봇 API
export const chatbotAPI = {
  createBooking: (bookingData) => api.post('/chatbot/create-booking', bookingData),
  generateSchedule: (scheduleRequest) => api.post('/chatbot/generate-schedule', scheduleRequest),
  parseScheduleRequest: (userInput) => api.post('/chatbot/parse-schedule', { userInput }),
  editSchedule: (editData) => api.post('/chatbot/edit-schedule', editData)
};

// AI 스케줄 생성 및 관리 API
export const aiScheduleAPI = {
  // AI 스케줄 생성 (개발 모드용)
  generateSchedule: (scheduleRequest) => api.post('/ai/schedule/generate-dev', scheduleRequest),
  
  // 생성된 스케줄 조회
  getSchedule: (scheduleId) => api.get(`/ai/schedule/${scheduleId}`),
  
  // 비즈니스별 스케줄 목록 조회
  getSchedules: (businessId) => api.get(`/ai/schedules/${businessId}`),
  
  // 직원 선호도 설정
  setEmployeePreference: (preference) => api.post('/employee/preferences', preference),
  
  // 부서별 필요 인원 설정
  setDepartmentStaffing: (staffing) => api.post('/department/staffing', staffing),
  
  // 직원 선호도 조회
  getEmployeePreferences: (businessId) => api.get(`/employee/preferences/${businessId}`),
  
  // 내 선호도 조회
  getMyPreference: (businessId) => api.get(`/employee/my-preference/${businessId}`),
  
  // 부서별 필요 인원 조회
  getDepartmentStaffing: (businessId) => api.get(`/department/staffing/${businessId}`)
};

// 고용자 AI 스케줄 생성 시스템 API
export const employerScheduleAPI = {
  // 직원 선호도 설정
  setEmployeePreference: (preference) => api.post('/employee/preferences', preference),
  
  // 부서별 필요 인원 설정
  setDepartmentStaffing: (staffing) => api.post('/department/staffing', staffing),
  
  // 직원 선호도 조회
  getEmployeePreferences: (businessId) => api.get(`/employee/preferences/${businessId}`),
  
  // 내 선호도 조회
  getMyPreference: (businessId) => api.get(`/employee/my-preference/${businessId}`),
  
  // 부서별 필요 인원 조회
  getDepartmentStaffing: (businessId) => api.get(`/department/staffing/${businessId}`),
  
  // AI 스케줄 생성 (개발 모드용)
  generateSchedule: (scheduleRequest) => api.post('/ai/schedule/generate-dev', scheduleRequest),
  
  // 생성된 스케줄 조회
  getGeneratedSchedule: (scheduleId) => api.get(`/ai/schedule/${scheduleId}`),
  
  // 비즈니스별 스케줄 목록 조회
  getGeneratedSchedules: (businessId) => api.get(`/ai/schedules/${businessId}`),
  
  // 특정 직원의 AI 생성 스케줄 조회
  getEmployeeSchedule: (businessId, employeeId) => api.get(`/ai/schedule/employee/${businessId}/${employeeId}`),
  
  // AI 스케줄 생성 (별칭)
  generateAISchedule: (scheduleRequest) => api.post('/ai/schedule/generate', scheduleRequest),
  
  // 비즈니스별 스케줄 목록 조회 (별칭)
  getSchedules: (businessId) => api.get(`/ai/schedules/${businessId}`)
};

// 스케줄 관리 API
export const scheduleAPI = {
  // 업종 관리
  createCategory: (categoryData) => api.post('/business/category', categoryData),
  
  // 파트 관리
  createDepartment: (departmentData) => api.post('/business/department', departmentData),
  
  // 주요분야 관리
  createWorkField: (workFieldData) => api.post('/business/workfield', workFieldData),
  
  // 스케줄 설정
  createScheduleSettings: (scheduleData) => api.post('/business/schedule-settings', scheduleData),
  
  // AI 스케줄 생성
  generateSchedule: (scheduleRequest) => api.post('/business/generate-schedule', scheduleRequest),
};

// 직원 스케줄 API
export const workerScheduleAPI = {
  // 스케줄 선호도 설정
  setSchedulePreferences: (preferences) => api.post('/worker/schedule-preferences', preferences),
  
  // 내 스케줄 조회 (AI 생성 스케줄 + 개인 선호도)
  getMySchedule: (businessId, workerId) => api.get(`/worker/my-schedule/${businessId}/${workerId}`),
  
  // 내 개인 선호도 스케줄 조회
  getMyPreferenceSchedule: (businessId, workerId) => api.get(`/worker/preference-schedule/${businessId}/${workerId}`),
};

// 직원 개인 선호도 API
export const workerPreferenceAPI = {
  setEmployeePreference: (preference) => api.post('/employee/preferences', preference),
  getMyPreference: (businessId) => api.get(`/employee/my-preference/${businessId}`)
};

// OpenAI API 테스트
export const openaiAPI = {
  test: (message) => api.post('/test/openai', message),
};

// 업장 관리 API
export const businessManagementAPI = {
  // 업장 생성
  createBusiness: (businessData) => api.post('/businesses/create', businessData),
  
  // 업장 목록 조회
  getBusinesses: () => api.get('/businesses'),
  
  // 특정 업장 조회
  getBusiness: (businessId) => api.get(`/businesses/${businessId}`),
  
  // 업장 정보 수정
  updateBusiness: (businessId, updateData) => api.put(`/businesses/${businessId}`, updateData),
  
  // 업장 삭제
  deleteBusiness: (businessId) => api.delete(`/businesses/${businessId}`)
};

export default api; 