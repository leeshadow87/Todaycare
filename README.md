# 오늘아이돌봄지도 V13_5 Codex Final

사설 기관 업체등록 DB 확보를 목표로 한 운영형 MVP입니다.

## 핵심 목표

부모는 회원가입 없이 우리 동네 돌봄·놀이 장소를 바로 검색하고,
업체·기관은 무료 등록 흐름을 통해 구글폼으로 신청합니다.
운영자는 수동 검수 후 `data/places.json`에 반영합니다.

## V13에서 확정한 것

- 헤더 바로 아래 업체 등록 CTA 띠 (상단 1곳만 노출)
- 모바일 FAB는 지도 보기만 유지
- 카드 목록 내 업체 등록 유도 배너 제거
- 업체등록 모달 전면 개편: 혜택 3종(무료/지도노출/링크연결) + 등록 가능 유형 8종 태그
- 구글폼 클릭 후 모달 자동 닫힘 + "1~3일 내 검수" 토스트
- data/places.json 포함 (공공데이터 기반 전국 4,376개)
- PWA 설치 배너 추가: Android Chrome 자동 설치 프롬프트, iOS Safari 홈 화면 추가 안내
- 설치 배너 닫기 후 영구 숨김이 아니라 7일 쿨다운 적용
- 법적 고지 모달 위로 설치 배너가 겹치지 않도록 노출 순서 조정
- 개인정보처리방침 페이지 `privacy.html` 추가
- 이용약관 및 정보 고지 페이지 `terms.html` 추가
- 앱 내부 상단 안내줄에 개인정보처리방침/이용안내 링크 추가
- Codex 제작 표시 파일 `CREATED_BY_CODEX.md` 추가
- 서비스워커 캐시명 v13-5로 갱신

## GitHub 업로드 방법

ZIP을 풀어 아래 구조를 저장소 루트에 올립니다.
웹 UI 드래그앤드롭 대신 GitHub Desktop 또는 git 명령어를 사용하세요.
data/places.json이 5MB라 웹 UI 업로드가 실패할 수 있습니다.

```
git add .
git commit -m "V12_5: 업체등록 전환 강화 + 데이터 포함"
git push
```

파일 구조:

```
index.html
manifest.json
sw.js
service-worker.js
assets/app.css
assets/app.js
data/places.json
icons/icon-192.png
icons/icon-512.png
README.md
```

## 구글폼 보완 필요 항목

현재 구글폼(leeshadow87@gmail.com 계정)에 아래 항목을 추가하면
등록된 업체 카드 정보가 더 풍부해집니다.

추가 권장 항목:

- 운영시간 (예: 평일 10:00~18:00 / 주말 10:00~20:00)
- 요금 형태 (무료 / 유료 / 확인 필요)
- 대상 연령 (예: 0~7세 / 초등학생)
- 주차 가능 여부 (예/아니오/확인 필요)
- 보호자 동반 필요 여부 (예/아니오/확인 필요)
- 식사 제공 여부 (예/아니오)

## 업체 등록 운영 순서

1. 지역별 사설 기관 후보 목록 작성 (키즈카페, 실내놀이터, 체험수업 등)
2. 인스타그램 DM, 전화, 카카오채널, 이메일로 무료 등록 안내
3. 구글폼 접수
4. 운영자 수동 검수 (업체명, 주소, 전화, 링크 확인)
5. data/places.json에 operator_registered: true로 반영
6. 30개 이상 실제 등록 후 자동 DB 반영 구조 검토

## 데이터 라벨 기준

- 업체등록: 업체가 실제 제출, 운영자가 검수한 데이터 (operator_registered: true)
- 공식DB: 공공데이터포털, 지자체 공개자료 기반
- 외부확인: 네이버·카카오 지도 위치 확인용 링크형 데이터

## 카카오맵 사용 원칙

허용: 지도 배경 렌더링, 자체 DB 좌표 마커 표시, 길찾기 외부 링크

금지: 카카오 Places API 결과를 DB로 저장, 외부 플랫폼 정보 대량 복제

## 다음 버전 (V12_6) 검토 항목

- 구글폼 항목 추가 후 places.json 필드 반영
- 등록 업체 카드 상단 고정 (업체등록 데이터 강조)
- 업체 정보 수정 요청 흐름 추가
- Google Sheets + Apps Script로 폼 → places.json 자동 갱신 검토
- Android TWA 패키징 (업체등록 30개 이후 권장)

## PWA 모바일 앱 등록 준비

이번 폴더에는 PWA 설치와 Android TWA 등록을 위한 기본 구성이 포함되어 있습니다.

- 앱 매니페스트: `manifest.json`
- 서비스워커: `sw.js`
- 설치 스크린샷: `screenshots/mobile-home.png`, `screenshots/desktop-map.png`
- 개인정보처리방침: `privacy.html`
- 이용약관/정보 고지: `terms.html`
- Android 도메인 인증 템플릿: `.well-known/assetlinks.template.json`
- 등록 진행 체크리스트: `mobile_app_registration_checklist.md`

Play 등록은 최종 HTTPS 도메인 배포 후 `assetlinks.json`에 Play App Signing SHA-256 지문을 넣어야 완료됩니다.

Play Console 개인정보처리방침 URL 입력값:

```
https://todaycare.kr/privacy.html
```

## 라이브 사이트 확인 메모

2026-06-07 확인 기준 `https://todaycare.kr/data/places.json`은 200 응답이며 약 5.25MB로 접근 가능합니다.
따라서 V13 배포의 핵심은 데이터 재업로드보다 `index.html`, `manifest.json`, `sw.js`, `assets/`, `screenshots/`, `.well-known/` 반영입니다.
