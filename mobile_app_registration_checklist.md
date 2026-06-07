# 오늘아이돌봄지도 PWA 모바일 앱 등록 체크리스트

이 폴더는 V13_5 기준으로 모바일 설치와 Android Play 등록 직전까지 진행할 수 있게 준비된 상태입니다.

## 1. 먼저 배포할 것

PWA는 HTTPS 도메인에서 동작해야 앱 설치와 서비스워커가 정상 인증됩니다.

- 권장 도메인: `https://todaycare.kr/`
- 배포 파일: 이 폴더 전체
- 필수 확인: `https://todaycare.kr/manifest.json` 접근 가능
- 필수 확인: `https://todaycare.kr/sw.js` 접근 가능
- 필수 확인: `https://todaycare.kr/privacy.html` 접근 가능
- 필수 확인: `https://todaycare.kr/terms.html` 접근 가능
- 필수 확인: `https://todaycare.kr/.well-known/assetlinks.json` 접근 가능

카카오맵은 배포 후 카카오 개발자 콘솔에서 실제 도메인(`todaycare.kr`, `www.todaycare.kr`)을 JavaScript 키 허용 도메인에 추가해야 합니다.

## 2. PWA 설치 요건

이미 반영된 항목:

- `manifest.json`에 앱 이름, 앱 ID, 시작 URL, 범위, 아이콘, 스크린샷, 앱 바로가기 추가
- `index.html`에 모바일 앱 메타태그, iOS 홈 화면 설치 태그, 아이콘 링크 추가
- `sw.js`에 정적 파일, 데이터, 설치 스크린샷 캐시 추가
- 앱 바로가기 `업체 무료 등록` 선택 시 `?vendor=register`로 등록 모달 자동 오픈
- 카카오맵 SDK가 실패해도 목록과 업체등록 흐름이 유지되도록 fallback 추가
- Android 설치 배너와 iOS 홈 화면 추가 안내 배너 추가
- 설치 배너는 법적 고지 모달이 닫힌 뒤 노출
- 배너 닫기 후 7일 동안 숨김 처리
- 개인정보처리방침 `privacy.html` 추가
- 이용약관/정보 고지 `terms.html` 추가
- 앱 내부 상단 안내줄에 개인정보처리방침 및 이용안내 링크 추가

## 2-1. 라이브 비교 판단

2026-06-07 확인 기준 라이브 `https://todaycare.kr/data/places.json`은 정상 접근됩니다.

따라서 "라이브에 데이터가 없어서 0개 장소가 나온다"는 현재 기준으로는 확정할 수 없습니다. V13 배포 우선순위는 아래 순서입니다.

1. `index.html`, `assets/app.js`, `assets/app.css` 반영
2. `manifest.json`, `sw.js`, `screenshots/` 반영
3. `privacy.html`, `terms.html`, `screenshots/` 반영
4. `.well-known/assetlinks.json` 준비
5. 배포 후 브라우저 캐시와 서비스워커 갱신 확인

## 3. Android Play 등록 방식

순수 PWA는 Play Console에 바로 올리는 형태가 아니라 Trusted Web Activity(TWA) 래퍼로 패키징합니다.

권장 순서:

1. `https://todaycare.kr/`에 PWA 배포
2. Chrome Lighthouse 또는 PWABuilder에서 PWA 검사
3. PWABuilder 또는 Bubblewrap으로 Android TWA 생성
4. 패키지명은 우선 `kr.todaycare.app` 권장
5. Play Console에서 앱 생성 후 내부 테스트 트랙에 AAB 업로드
6. Play App Signing의 SHA-256 지문을 복사
7. `.well-known/assetlinks.template.json`을 `.well-known/assetlinks.json`으로 복사하고 SHA-256 값을 교체
8. 다시 배포 후 Android 앱에서 주소창 없이 열리는지 확인

## 4. Play Console 입력값 초안

- 앱 이름: 오늘아이돌봄지도
- 짧은 설명: 우리 동네 돌봄·놀이 장소를 한 번에 찾는 지도
- 긴 설명: 국가서비스, 공공돌봄, 키즈카페, 실내놀이터, 도서관 프로그램, 체험수업을 지역별로 검색하고 업체·기관은 무료 등록 신청을 할 수 있는 돌봄·놀이 통합 검색 지도입니다.
- 카테고리: 육아 또는 라이프스타일
- 개인정보처리방침 URL: `https://todaycare.kr/privacy.html`
- 문의 이메일: leeshadow87@gmail.com

## 5. iPhone 대응

iOS는 Safari에서 "홈 화면에 추가" 방식의 PWA 설치가 가능합니다. App Store 등록은 순수 PWA만으로는 어렵고, 별도의 iOS 래퍼 앱 또는 네이티브 앱 심사가 필요합니다.

현재 반영된 iOS 대응:

- `apple-mobile-web-app-capable`
- `apple-mobile-web-app-title`
- `apple-touch-icon`
- 모바일 viewport 설정

## 6. 등록 전 남은 필수 작업

- 운영 도메인 배포 확인: `todaycare.kr`
- 개인정보처리방침 URL 공개 접근 확인: `https://todaycare.kr/privacy.html`
- 이용약관/정보 고지 URL 공개 접근 확인: `https://todaycare.kr/terms.html`
- 구글폼 개인정보 수집 동의 문구 확인 및 필요 시 폼 상단에 `privacy.html` 링크 추가
- Play Console 개발자 계정 준비
- Play App Signing SHA-256으로 `.well-known/assetlinks.json` 생성
- Lighthouse PWA 검사 통과 확인

## 7. 아직 자동 완료할 수 없는 항목

- Play App Signing SHA-256 지문: Play Console에 앱을 만들고 AAB를 업로드한 뒤 확인 가능합니다.
- `.well-known/assetlinks.json`: SHA-256 지문을 받은 뒤 `.well-known/assetlinks.template.json`을 복사해 실제 값으로 교체해야 합니다.
- PWABuilder Android AAB: `https://todaycare.kr/` 배포 후 PWABuilder에서 생성해야 합니다.
- Play Console 데이터 보안 양식: 실제 수집 항목과 Google Forms 처리 방식을 기준으로 콘솔에서 직접 입력해야 합니다.

## 8. 과도한 비용 발생 방지 점검

- 카카오 Places 자동검색 제안은 `KAKAO_DONG_SUGGEST_ENABLED = false`로 비활성화되어 있습니다.
- 카카오맵 SDK는 지도 배경 렌더링과 자체 DB 좌표 마커 표시 용도입니다.
- 동네 선택 후 지도 이동을 위한 주소/키워드 검색은 사용자 선택 후에만 실행됩니다.
- OpenAI/Claude 등 유료 AI API 호출 코드는 현재 클라이언트에 없습니다.
- 광고, 결제, 인앱구매, 위치 권한, 카메라/마이크/연락처 권한 요청 코드가 없습니다.
