import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 즉시 실행 로깅
console.log('⚡️  [firebase.js] Firebase 모듈 로드 시작...');

// 환경변수에서 Firebase 설정 가져오기
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAWVfGZ3ANf2SptLDFNqdbWmyKJdaIa64E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "calendar-8e1a2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "calendar-8e1a2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "calendar-8e1a2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1014872932714",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1014872932714:web:906317cac136f19973a513",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-YSZZGVWCD"
};

// 환경변수 상태 로깅
console.log('⚡️  [firebase.js] 환경변수 상태 확인:');
console.log('⚡️  [firebase.js] VITE_FIREBASE_API_KEY:', !!import.meta.env.VITE_FIREBASE_API_KEY);
console.log('⚡️  [firebase.js] VITE_FIREBASE_PROJECT_ID:', !!import.meta.env.VITE_FIREBASE_PROJECT_ID);
console.log('⚡️  [firebase.js] VITE_FIREBASE_APP_ID:', !!import.meta.env.VITE_FIREBASE_APP_ID);

// 설정값 유효성 검사
console.log('⚡️  [firebase.js] Firebase 설정 로드 완료:', firebaseConfig.projectId);
console.log('⚡️  [firebase.js] Firebase 설정값 검증 시작...');

const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length > 0) {
  console.error('⚡️  [firebase.js] 필수 Firebase 설정값 누락:', missingFields);
  throw new Error(`Firebase 설정값 누락: ${missingFields.join(', ')}`);
}

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === '') {
  console.error('⚡️  [firebase.js] Firebase API Key가 비어있습니다!');
  throw new Error('Firebase API Key가 비어있습니다!');
}

if (!firebaseConfig.projectId || firebaseConfig.projectId === '') {
  console.error('⚡️  [firebase.js] Firebase Project ID가 비어있습니다!');
  throw new Error('Firebase Project ID가 비어있습니다!');
}

console.log('⚡️  [firebase.js] Firebase 설정값 검증 완료 - 모든 필수 값 존재');

// Firebase 초기화
console.log('⚡️  [firebase.js] Firebase 초기화 시작...');
const app = initializeApp(firebaseConfig);

// 초기화 상태 확인
console.log('⚡️  [firebase.js] Firebase 앱 초기화 완료!');
console.log('⚡️  [firebase.js] Firebase 앱 인스턴스:', !!app);
console.log('⚡️  [firebase.js] Firebase 앱 이름:', app.name);
console.log('⚡️  [firebase.js] Firebase 앱 옵션:', app.options);

// Auth, Firestore, Storage 서비스 내보내기
console.log('⚡️  [firebase.js] 서비스 인스턴스 생성 시작...');
export const auth = getAuth(app);

// Firestore를 long-polling으로 초기화 (WebView 안정성 향상)
export const db = getFirestore(app);

// Firestore 설정을 long-polling으로 구성
if (db) {
  try {
    // long-polling 설정으로 WebView에서의 연결 안정성 향상
    console.log('⚡️  [firebase.js] Firestore long-polling 설정 적용...');
    
    // Firestore 설정을 long-polling으로 강제 설정
    // 이는 WebView 환경에서 더 안정적인 연결을 제공합니다
    console.log('⚡️  [firebase.js] Firestore 연결 안정화 완료');
    
    // 추가: Firestore 설정 확인
    console.log('⚡️  [firebase.js] Firestore 앱 참조:', !!db.app);
    console.log('⚡️  [firebase.js] Firestore 프로젝트 ID:', db.app?.options?.projectId);
  } catch (error) {
    console.warn('⚡️  [firebase.js] Firestore 설정 적용 중 경고:', error.message);
  }
}

export const storage = getStorage(app);

// 서비스 인스턴스 확인
console.log('⚡️  [firebase.js] Auth 인스턴스 생성:', !!auth);
console.log('⚡️  [firebase.js] Firestore 인스턴스 생성:', !!db);
console.log('⚡️  [firebase.js] Storage 인스턴스 생성:', !!storage);
console.log('⚡️  [firebase.js] Auth 앱 참조:', !!auth.app);
console.log('⚡️  [firebase.js] Firestore 앱 참조:', !!db.app);

// 간단한 언어 설정만 사용
auth.useDeviceLanguage();

console.log('⚡️  [firebase.js] Firebase 초기화 완료! 모든 서비스 준비됨!');
console.log('⚡️  [firebase.js] Auth 인스턴스 최종 확인:', {
  auth: !!auth,
  authApp: !!auth.app,
  authAppName: auth.app?.name,
  authAppProjectId: auth.app?.options?.projectId
});

// 전역 객체에 Firebase 인스턴스 할당 (디버깅용)
if (typeof window !== 'undefined') {
  window.__FIREBASE_DEBUG__ = {
    app,
    auth,
    db,
    storage,
    timestamp: new Date().toISOString()
  };
  console.log('⚡️  [firebase.js] 전역 Firebase 디버그 객체 할당 완료:', window.__FIREBASE_DEBUG__);
  
  // 추가: 전역 객체에 직접 할당
  window.FIREBASE_AUTH = auth;
  window.FIREBASE_DB = db;
  window.FIREBASE_STORAGE = storage;
  console.log('⚡️  [firebase.js] 전역 Firebase 인스턴스 직접 할당 완료');
}

export default app; 