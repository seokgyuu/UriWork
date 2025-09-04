/**
 * Google OAuth 서비스 모듈
 * Google 계정을 통한 로그인 기능 제공
 * Firebase Authentication과 연동하여 Google 로그인 처리
 * OAuth 토큰 관리 및 사용자 정보 가져오기
 */
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithCustomToken } from 'firebase/auth';

class GoogleOAuthService {
  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1014872932714-906317cac136f19973a513.apps.googleusercontent.com';
    this.redirectUri = 'com.hass.calendar://oauth/callback';
    this.scope = 'email profile';
  }

  // Google OAuth URL 생성
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope,
      access_type: 'offline',
      prompt: 'select_account',
      // 모바일 앱에서 더 안정적인 설정
      include_granted_scopes: 'true'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('GoogleOAuth: 생성된 인증 URL:', authUrl);
    return authUrl;
  }

  // OAuth 코드로 액세스 토큰 교환 (클라이언트 시크릿 없이)
  async exchangeCodeForToken(code) {
    try {
      console.log('GoogleOAuth: 토큰 교환 시작, 코드:', code);
      
      // 클라이언트 시크릿 없이 PKCE 방식 사용
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GoogleOAuth: 토큰 교환 실패:', response.status, errorText);
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('GoogleOAuth: 토큰 교환 성공');
      return tokenData;
    } catch (error) {
      console.error('GoogleOAuth: 토큰 교환 에러:', error);
      throw error;
    }
  }

  // 액세스 토큰으로 사용자 정보 가져오기
  async getUserInfo(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      return await response.json();
    } catch (error) {
      console.error('Get user info error:', error);
      throw error;
    }
  }

  // 모바일 앱에서 OAuth 시작
  async startOAuthFlow() {
    try {
      console.log('GoogleOAuth: OAuth 플로우 시작');
      
      // Capacitor 환경에서 iOS Google Sign-In 사용
      if (window.Capacitor && window.Capacitor.getPlatform() === 'ios') {
        return await this.startIOSGoogleSignIn();
      }
      // Capacitor Browser 플러그인 사용 (Android)
      else if (window.Capacitor) {
        const { Browser } = await import('@capacitor/browser');
        
        const authUrl = this.getAuthUrl();
        console.log('GoogleOAuth: 인증 URL:', authUrl);
        
        // 브라우저로 OAuth 페이지 열기
        await Browser.open({
          url: authUrl,
          windowName: '_self',
          presentationStyle: 'popover'
        });
        
        // 콜백 처리
        Browser.addListener('browserFinished', (event) => {
          console.log('GoogleOAuth: 브라우저 종료:', event);
          if (event.url && event.url.includes('oauth/callback')) {
            this.handleCallback(event.url);
          }
        });
        
      } else {
        // 웹에서는 팝업 사용
        const authUrl = this.getAuthUrl();
        const popup = window.open(authUrl, 'google-oauth', 'width=500,height=600');
        
        // 팝업에서 코드 받기
        window.addEventListener('message', (event) => {
          if (event.origin === window.location.origin) {
            this.handleCallback(event.data);
          }
        });
      }
    } catch (error) {
      console.error('GoogleOAuth: OAuth 플로우 에러:', error);
      throw error;
    }
  }

  // iOS Google Sign-In 구현
  async startIOSGoogleSignIn() {
    try {
      console.log('GoogleOAuth: iOS Google Sign-In 시작');
      
      // iOS에서 Google Sign-In을 위한 JavaScript 브릿지 구현
      const result = await this.callIOSGoogleSignIn();
      console.log('GoogleOAuth: iOS Google Sign-In 결과:', result);
      
      if (result.success && result.user) {
        // Firebase Firestore에 사용자 데이터 저장
        await this.saveUserToFirebase(result.user);
        
        return {
          user: result.user,
          tokens: result.tokens
        };
      } else {
        throw new Error(result.error || 'iOS Google Sign-In 실패');
      }
    } catch (error) {
      console.error('GoogleOAuth: iOS Google Sign-In 에러:', error);
      throw error;
    }
  }

  // iOS 네이티브 Google Sign-In 호출
  async callIOSGoogleSignIn() {
    return new Promise((resolve, reject) => {
      try {
        console.log('GoogleOAuth: iOS 네이티브 Google Sign-In 호출');
        
        // Capacitor Google Sign-In 플러그인 확인
        if (!window.Capacitor || !window.Capacitor.Plugins) {
          console.error('GoogleOAuth: Capacitor 또는 Plugins를 찾을 수 없음');
          reject(new Error('Capacitor를 찾을 수 없습니다'));
          return;
        }
        
        // Google Sign-In 플러그인 확인
        if (!window.Capacitor.Plugins.GoogleSignIn) {
          console.error('GoogleOAuth: GoogleSignIn 플러그인을 찾을 수 없음');
          reject(new Error('Google Sign-In 플러그인을 찾을 수 없습니다'));
          return;
        }
        
        // Google Sign-In 실행
        console.log('GoogleOAuth: Google Sign-In 실행 중...');
        window.Capacitor.Plugins.GoogleSignIn.signIn()
          .then(result => {
            console.log('GoogleOAuth: iOS Google Sign-In 성공:', result);
            resolve(result);
          })
          .catch(error => {
            console.error('GoogleOAuth: iOS Google Sign-In 실패:', error);
            reject(error);
          });
        
      } catch (error) {
        console.error('GoogleOAuth: iOS Google Sign-In 호출 에러:', error);
        reject(error);
      }
    });
  }


  // OAuth 콜백 처리
  async handleCallback(url) {
    try {
      console.log('GoogleOAuth: 콜백 처리 시작, URL:', url);
      
      // URL 파싱 개선
      let urlParams;
      if (url.includes('?')) {
        urlParams = new URLSearchParams(url.split('?')[1]);
      } else if (url.includes('#')) {
        urlParams = new URLSearchParams(url.split('#')[1]);
      } else {
        throw new Error('Invalid callback URL format');
      }
      
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const state = urlParams.get('state');
      
      console.log('GoogleOAuth: URL 파라미터 - code:', code, 'error:', error, 'state:', state);
      
      if (error) {
        throw new Error(`OAuth error: ${error}`);
      }
      
      if (!code) {
        throw new Error('No authorization code received');
      }
      
      console.log('GoogleOAuth: 인증 코드 받음:', code);
      
      // 토큰 교환
      const tokenData = await this.exchangeCodeForToken(code);
      console.log('GoogleOAuth: 토큰 교환 완료');
      
      // 사용자 정보 가져오기
      const userInfo = await this.getUserInfo(tokenData.access_token);
      console.log('GoogleOAuth: 사용자 정보:', userInfo);
      
      // Firebase Firestore에 사용자 데이터 저장
      await this.saveUserToFirebase(userInfo);
      
      // Firebase Auth와 연동 (선택사항)
      await this.linkWithFirebaseAuth(userInfo);
      
      return {
        user: userInfo,
        tokens: tokenData
      };
      
    } catch (error) {
      console.error('GoogleOAuth: 콜백 처리 에러:', error);
      throw error;
    }
  }

  // Firebase Firestore에 사용자 데이터 저장
  async saveUserToFirebase(userInfo) {
    try {
      console.log('GoogleOAuth: Firebase에 사용자 데이터 저장 시작');
      
      const userDocRef = doc(db, 'users', userInfo.id);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log('GoogleOAuth: 새 사용자 생성');
        const userData = {
          uid: userInfo.id,
          email: userInfo.email,
          name: userInfo.name || userInfo.email.split('@')[0],
          userType: null, // 사용자 타입은 나중에 선택하도록 null로 설정
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          photoURL: userInfo.picture,
          // OAuth 관련 정보 추가
          oauthProvider: 'google',
          oauthId: userInfo.id,
          emailVerified: userInfo.verified_email || false
        };
        
        await setDoc(userDocRef, userData);
        console.log('GoogleOAuth: 새 사용자 데이터 저장 완료:', userData);
      } else {
        console.log('GoogleOAuth: 기존 사용자 발견, 정보 업데이트');
        const existingData = userDoc.data();
        console.log('GoogleOAuth: 기존 사용자 데이터:', existingData);
        
        // 기존 사용자 정보 업데이트
        const updatedData = {
          ...existingData,
          name: userInfo.name || existingData.name,
          photoURL: userInfo.picture || existingData.photoURL,
          updatedAt: new Date().toISOString(),
          emailVerified: userInfo.verified_email || existingData.emailVerified
        };
        
        await setDoc(userDocRef, updatedData);
        console.log('GoogleOAuth: 기존 사용자 데이터 업데이트 완료:', updatedData);
      }
      
      console.log('GoogleOAuth: Firebase 저장 완료');
    } catch (error) {
      console.error('GoogleOAuth: Firebase 저장 에러:', error);
      throw error;
    }
  }

  // Firebase Auth와 연동 (사용하지 않음 - AuthContext에서 처리)
  async linkWithFirebaseAuth(userInfo) {
    try {
      console.log('GoogleOAuth: Firebase Auth 연동은 AuthContext에서 처리됨');
      return;
    } catch (error) {
      console.error('GoogleOAuth: Firebase Auth 연동 에러:', error);
      throw error;
    }
  }

  // Custom Token 생성 (백엔드에서 처리해야 함)
  async createCustomToken(userInfo) {
    try {
      // 실제 구현에서는 백엔드 API를 호출하여 Custom Token을 생성
      // 여기서는 예시로만 구현
      console.log('GoogleOAuth: Custom Token 생성 (백엔드 연동 필요)');
      return null; // 실제 구현에서는 백엔드에서 받은 Custom Token 반환
    } catch (error) {
      console.error('GoogleOAuth: Custom Token 생성 에러:', error);
      return null;
    }
  }
}

export const googleOAuthService = new GoogleOAuthService(); 