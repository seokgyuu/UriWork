# UriWork 고객 지원

<meta http-equiv="refresh" content="0; url=./docs/">
<script>window.location.href = './docs/';</script>

AI 기반 스케줄 생성과 예약 관리 시스템입니다. 고용자와 직원 모두를 위한 통합 플랫폼으로, 직원 선호도를 고려한 최적의 스케줄을 자동으로 생성합니다.

**지원 페이지로 이동 중...** [지원 페이지 바로가기](./docs/)

## 주요 기능

### 🏢 고용자 기능
- **AI 스케줄 생성 시스템**: 직원들의 선호도를 통합하여 최적의 스케줄을 자동 생성
- **부서별 필요 인원 설정**: 각 부서별로 필요한 직원 수와 근무 시간 설정
- **직원 선호도 관리**: 직원들의 선호하는 근무일, 쉬는날, 근무 시간대 관리
- **스케줄 만족도 분석**: 생성된 스케줄의 직원 만족도를 자동 계산
- **예약 관리**: 고객 예약 현황 및 관리
- **노동자 관리**: 피고용자 권한 관리 및 업무 배정
- **업종/파트/주요분야 설정**: 비즈니스 카테고리 및 업무 분야 관리

### 👥 직원 기능
- **AI 선호도 설정**: 본인의 근무 선호도를 직접 설정하여 AI 스케줄 생성에 반영
- **스케줄 선호도 설정**: 선호하는 근무일, 쉬는날, 근무 시간 설정
- **개인 스케줄 확인**: 배정된 스케줄 및 업무 확인
- **프로필 관리**: 개인 정보 및 업무 분야 관리

### 🤖 AI 챗봇
- **자연어 스케줄 생성**: 한국어로 스케줄 요청 시 자동 파싱 및 생성
- **실시간 스케줄 제안**: 사용자 입력에 따른 즉시 스케줄 제안
- **스마트 응답**: 상황에 맞는 지능형 응답

## 기술 스택

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **AI/ML**: 자연어 처리 (정규표현식 기반)

## API 엔드포인트

### 인증
- `POST /auth/register` - 사용자 등록
- `POST /auth/login` - 로그인

### 비즈니스 관리
- `POST /business/calendar` - 비즈니스 캘린더 생성
- `POST /business/generate-code` - 노동자 초대 코드 생성
- `POST /business/category` - 업종 카테고리 생성
- `POST /business/department` - 부서 생성
- `POST /business/workfield` - 주요분야 생성
- `POST /business/schedule-settings` - 스케줄 설정

### 고용자 AI 스케줄 생성 시스템
- `POST /employee/preferences` - 직원 선호도 설정
- `GET /employee/preferences/{business_id}` - 직원 선호도 조회
- `POST /department/staffing` - 부서별 필요 인원 설정
- `GET /department/staffing/{business_id}` - 부서별 필요 인원 조회
- `POST /ai/schedule/generate` - AI 스케줄 생성
- `GET /ai/schedule/{schedule_id}` - 생성된 스케줄 조회
- `GET /ai/schedules/{business_id}` - 비즈니스별 생성된 스케줄 목록

### 노동자 관리
- `POST /worker/use-code/{code}` - 노동자 코드 사용
- `POST /worker/schedule-preferences` - 노동자 스케줄 선호도 설정
- `POST /employee/preferences` - 직원 AI 선호도 설정
- `GET /employee/my-preference/{business_id}` - 직원 개인 선호도 조회

### 예약 관리
- `POST /booking/create` - 예약 생성
- `GET /bookings/{business_id}` - 예약 목록 조회

### 구독 관리
- `POST /subscription/create` - 구독 생성

### 챗봇
- `POST /chatbot/message` - 챗봇 메시지 처리
- `POST /chatbot/parse-schedule` - 스케줄 요청 파싱
- `POST /chatbot/create-booking` - 챗봇을 통한 예약 생성
- `POST /chatbot/generate-schedule` - 챗봇 스케줄 생성

## 사용 흐름

### 고용자 AI 스케줄 생성 시스템
1. **부서 설정**: 각 부서별 필요 인원 수와 근무 시간 설정
2. **직원 선호도 등록**: 직원들의 선호하는 근무일, 쉬는날, 근무 시간대 등록
3. **AI 스케줄 생성**: 직원 선호도와 부서 요구사항을 고려한 최적 스케줄 자동 생성
4. **스케줄 분석**: 생성된 스케줄의 만족도 점수와 효율성 분석

### AI 챗봇 사용법
1. **자연어 입력**: "내일 오후 2시 미용실 예약" 같은 자연스러운 한국어로 요청
2. **자동 파싱**: 날짜, 시간, 서비스 유형을 자동으로 인식
3. **스케줄 제안**: 파싱된 정보를 바탕으로 적절한 스케줄 제안
4. **예약 확정**: 제안된 스케줄을 확인하고 예약 완료

## 설치 및 실행

### 백엔드 실행
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 프론트엔드 실행
```bash
npm install
npm run dev
```

## 데이터베이스 구조

### Firestore Collections
- `users` - 사용자 정보
- `calendars` - 비즈니스 캘린더
- `worker_codes` - 노동자 초대 코드
- `bookings` - 예약 정보
- `subscriptions` - 구독 정보
- `business_categories` - 업종 카테고리
- `departments` - 부서 정보
- `work_fields` - 주요분야
- `work_schedules` - 스케줄 설정
- `worker_schedules` - 노동자 스케줄
- `generated_schedules` - 생성된 스케줄
- `chatbot_bookings` - 챗봇 예약
- `chatbot_schedules` - 챗봇 스케줄
- `employee_preferences` - 직원 선호도
- `department_staffing` - 부서별 필요 인원

## 라이선스

MIT License
