# Firebase Android 설정 가이드

## 1. Firebase 콘솔에서 Android 앱 추가

1. [Firebase 콘솔](https://console.firebase.google.com/)에 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. "앱 추가" → "Android" 선택

### Android 앱 등록 정보:
- **패키지 이름**: `com.company.appname`
- **앱 닉네임**: `내 Android 앱`
- **디버그 서명 인증서 SHA-1**: `00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00`

## 2. google-services.json 파일 다운로드

1. Firebase 콘솔에서 `google-services.json` 파일 다운로드
2. 파일을 `android/app/` 폴더에 복사

## 3. Android 프로젝트 설정

### build.gradle (프로젝트 레벨) 수정
`android/build.gradle`에 다음 추가:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

### build.gradle (앱 레벨) 수정
`android/app/build.gradle`에 다음 추가:

```gradle
plugins {
    id 'com.google.gms.google-services'
}

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-auth'
    implementation 'com.google.firebase:firebase-firestore'
}
```

## 4. Capacitor Firebase 플러그인 설치

```bash
npm install @capacitor-community/firebase-analytics
npm install @capacitor-community/firebase-crashlytics
npx cap sync android
```

## 5. Android Studio에서 빌드

1. Android Studio에서 `android` 폴더 열기
2. Gradle 동기화 실행
3. 앱 빌드 및 실행

## 6. SHA-1 인증서 지문 확인

디버그용 SHA-1 확인:
```bash
cd android
./gradlew signingReport
```

릴리즈용 SHA-1 확인:
```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

## 7. Firebase 기능 테스트

앱이 정상적으로 빌드되면 Firebase 콘솔에서 다음을 확인:
- Analytics 데이터 수신
- Authentication 로그인 테스트
- Firestore 데이터베이스 연결

## 문제 해결

### 일반적인 오류:
1. **google-services.json 파일 누락**: 파일이 `android/app/` 폴더에 있는지 확인
2. **SHA-1 불일치**: Firebase 콘솔의 SHA-1과 실제 인증서 SHA-1이 일치하는지 확인
3. **빌드 오류**: Gradle 캐시 정리 후 재빌드

### Gradle 캐시 정리:
```bash
cd android
./gradlew clean
./gradlew build
``` 