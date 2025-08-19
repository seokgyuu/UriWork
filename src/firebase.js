import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAWVfGZ3ANf2SptLDFNqdbWmyKJdaIa64E", // Firebase Console과 일치
  authDomain: "calendar-8e1a2.firebaseapp.com",
  projectId: "calendar-8e1a2",
  storageBucket: "calendar-8e1a2.firebasestorage.app",
  messagingSenderId: "1014872932714",
  appId: "1:1014872932714:web:906317cac136f19973a513", // 웹 앱 ID 사용
  measurementId: "G-YSZZGVW7CD"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Auth, Firestore, Storage 서비스 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Auth 설정 개선 - COOP 정책 대응
auth.useDeviceLanguage();

// COOP 정책 대응을 위한 Auth 설정
auth.settings.appVerificationDisabledForTesting = true;
auth.settings.forceRefreshOnReconnect = true;

// COOP 오류 근본 방지를 위한 설정
if (typeof window !== 'undefined') {
  // 현재 도메인을 리다이렉트 도메인으로 설정
  const currentDomain = window.location.origin;
  console.log('Firebase: 현재 도메인:', currentDomain);
  
  // 로컬호스트 환경에서 Auth 설정 최적화
  if (currentDomain.includes('localhost') || currentDomain.includes('127.0.0.1')) {
    console.log('Firebase: 로컬호스트 환경에서 Auth 설정 최적화');
    
    // 로컬호스트에서 더 안정적인 Auth 설정
    auth.settings.forceRefreshOnReconnect = true;
    auth.settings.appVerificationDisabledForTesting = true;
    
    // 로컬호스트에서 리다이렉트 도메인 명시적 설정 제거 (Firebase가 내부 처리)
    
    // Google 로그인 관련 설정 개선
    auth.settings.useDeviceLanguage = true;
    auth.settings.forceRefreshOnReconnect = true;
    
    // 로컬호스트에서 리다이렉트 처리 개선
    if (typeof window !== 'undefined') {
      // 로컬호스트에서 페이지 로드 시 리다이렉트 결과 확인
      window.addEventListener('load', async () => {
        try {
          console.log('Firebase: 로컬호스트 페이지 로드 시 리다이렉트 결과 확인');
          const { getRedirectResult } = await import('firebase/auth');
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult) {
            console.log('Firebase: 로컬호스트에서 리다이렉트 결과 발견:', redirectResult.user);
          }
        } catch (error) {
          console.log('Firebase: 로컬호스트 리다이렉트 결과 확인 실패:', error);
        }
      });
      
      // 로컬 개발 중 과도한 URL 변경 감지는 비활성화 (불필요한 재시도 방지)
      
      // Google 로그인 상태 확인
      window.addEventListener('storage', (event) => {
        if (event.key && event.key.includes('firebase')) {
          console.log('Firebase: 저장소 변경 감지, Google 로그인 상태 확인');
        }
      });
    }
  }
  
  // 팝업 관련 전역 오버라이드는 제거 (Firebase 내부 로직에 맡김)
}

export default app; 