/* =====================================================
   오늘아이돌봄 v11_2 - app.js
   "당근" 컨셉: 내 동네 + 오늘 맡길 수 있는 곳 우선
   카드 정렬: 업체직접등록(0) > 공식DB(1) > 외부링크(2)
   ===================================================== */

'use strict';

const VENDOR_EMAIL = ['leeshadow', '87', '@', 'gmail', '.com'].join('');
// 구글폼 생성 후 "보내기 > 링크"에서 복사한 응답자용 URL을 붙여넣으세요.
const VENDOR_GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd-7jGRKZ8YORu2-Beu3c8SCdX2KvCYlXe-ELZ7wfyD2nxsNg/viewform';

// ── 카테고리 메타 ────────────────────────────────────
const CAT_LABELS = {
  support:    '공동육아·놀이공간',
  public:     '공공 키즈카페',
  childcare:  '시간제보육',
  schoolcare: '초등돌봄',
  all:        '전체'
};
const CAT_EMOJI = {
  support:'👨‍👩‍👧', public:'🎪', childcare:'🏠', schoolcare:'📚'
};
const CAT_CLASS = {
  support:'tag-support', public:'tag-public',
  childcare:'tag-childcare', schoolcare:'tag-schoolcare'
};

// ── 앱 상태 ──────────────────────────────────────────
const state = {
  hood: { key: '', name: '전국' }, // 당근 스타일 동네
  filters: { today:false, weekend:false, guardian:false, parking:false, free:false, meal:false },
  cat: 'all',
  q: '',
  selected: null,
  view: 'split',
  cluster: true,
  mobileShowMap: false
};

let ALL_DATA = [];
let filtered = [];
let SIDO_LIST = [];    // 시도 목록
let SIGUNGU_LIST = []; // {sido, sigungu} 목록
let SUBGU_LIST = [];   // {sido, sigungu, subgu} 하위 구 목록 (화성시 동탄구 등)

// ── 지도 ─────────────────────────────────────────────
let map, clusterer, markers = [], markerMap = new Map();
const DEFAULT_POS  = { lat: 37.2004, lng: 127.0961 }; // 동탄역 근처
const KOREA_CENTER = { lat: 36.35, lng: 127.85 };
const DEFAULT_LEVEL = 7;
const KOREA_MAX_LEVEL = 12;
const KAKAO_DONG_SUGGEST_ENABLED = false; // 비용·쿼터 보호: 입력 중 Places 자동검색은 기본 OFF

// ── 유틸 ─────────────────────────────────────────────
const $  = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, m =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[m]));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── 소스 분류 (정렬 핵심) ────────────────────────────
function sourceRank(p) {
  // 0: 업체 직접 등록  1: 공식·공개 DB  2: 외부 링크형
  const s = [
    p.data_source_type, p.verification_status, p.source_name, p.source_url
  ].map(v => String(v || '').toLowerCase()).join('|');
  if (p.operator_registered || s.includes('direct') || s.includes('vendor')) return 0;
  if (s.includes('naver') || s.includes('kakao') || s.includes('map_link')) return 2;
  return 1;
}
function sourceLabel(p) {
  const r = sourceRank(p);
  if (r === 0) return { text:'업체등록', cls:'direct' };
  if (r === 2) return { text:'외부확인', cls:'link' };
  return { text:'공식DB', cls:'public' };
}
function feeLabel(f) {
  if (f === 'free') return { text:'무료', cls:'free' };
  if (f === 'paid') return { text:'유료확인', cls:'paid' };
  return null;
}

function categoryRank(p) {
  // 초등돌봄은 대체로 정기 등록형이라 "잠깐 맡기기" 검색에서는 뒤로 보냅니다.
  return p.category === 'schoolcare' ? 1 : 0;
}

function hasKnownValue(p, key) {
  return Object.prototype.hasOwnProperty.call(p, key) && p[key] !== null && p[key] !== '';
}

function isTodayCandidate(p) {
  if (p.available_today === true) return true;
  if (p.reservation_required === false) return true;
  return p.fee_type === 'free' && p.category !== 'schoolcare';
}

function hasCoord(p) {
  return typeof p.lat === 'number' && typeof p.lng === 'number' &&
    !Number.isNaN(p.lat) && !Number.isNaN(p.lng);
}

// ── 퀵 필터 적용 여부 판단 ───────────────────────────
// 데이터에 값이 없으면 필터를 강제 적용하지 않음
function passFilter(p) {
  const f = state.filters;
  if (f.free     && p.fee_type !== 'free') return false;
  if (f.today    && !isTodayCandidate(p)) return false;
  if (f.weekend  && p.available_weekend !== true) return false;
  if (f.guardian && !(hasKnownValue(p, 'guardian_required') && p.guardian_required === false)) return false;
  if (f.parking  && p.parking_available !== true) return false;
  if (f.meal     && p.meal_provided !== true) return false;
  return true;
}

// ── 동네 필터 ────────────────────────────────────────
function matchHood(p) {
  if (!state.hood.key) return true;
  const key = state.hood.key.toLowerCase();
  return (
    String(p.sigungu || '').toLowerCase().includes(key) ||
    String(p.address || '').toLowerCase().includes(key) ||
    String(p.sido    || '').toLowerCase().includes(key)
  );
}

// ── 검색 랭킹 ────────────────────────────────────────
function searchRank(p, q) {
  if (!q) return 9;
  const name    = String(p.name    || '').toLowerCase();
  const sigungu = String(p.sigungu || '').toLowerCase();
  const addr    = String(p.address || '').toLowerCase();
  const cat     = String(CAT_LABELS[p.category] || '').toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.includes(q))   return 1;
  if (sigungu.includes(q) || addr.includes(q)) return 2;
  if (cat.includes(q))    return 3;
  return 99;
}

// ── 필터 + 정렬 ──────────────────────────────────────
function applyFilter() {
  const q = String(state.q || '').trim().toLowerCase();
  filtered = ALL_DATA.filter(p => {
    if (state.cat !== 'all' && p.category !== state.cat) return false;
    if (!matchHood(p))  return false;
    if (!passFilter(p)) return false;
    if (q) {
      const sr = searchRank(p, q);
      if (sr >= 99) return false;
    }
    return true;
  });
  // 정렬: 업체등록(0) > 공식DB(1) > 외부링크(2) → 초등돌봄 후순위 → 같은 그룹 안에서 검색어 일치도순
  filtered.sort((a, b) => {
    const ra = sourceRank(a), rb = sourceRank(b);
    if (ra !== rb) return ra - rb;
    const ca = categoryRank(a), cb = categoryRank(b);
    if (ca !== cb) return ca - cb;
    return searchRank(a, q) - searchRank(b, q);
  });
}

// ── 렌더링 ───────────────────────────────────────────
function renderAll() {
  applyFilter();
  updateCount();
  renderList();
  renderMarkers();
}

function updateCount() {
  $('count-num').textContent = filtered.length;
  const area = $('count-area');
  area.textContent = state.hood.name !== '전국'
    ? `(${state.hood.name})` : '';
}

function renderList() {
  const scroll  = $('list-scroll');
  const bsScroll = $('bs-scroll');

  if (filtered.length === 0) {
    const html = `<div class="no-results">
      <div class="no-results-icon">🔍</div>
      <p style="font-weight:700;color:var(--text2)">조건에 맞는 장소가 없어요</p>
      <p style="font-size:11px;color:var(--text3);margin-top:4px">동네나 필터를 조정해 보세요</p>
      <button class="btn-reset" onclick="resetAll()">필터 초기화</button>
    </div>`;
    scroll.innerHTML = html;
    bsScroll.innerHTML = html;
    return;
  }

  // 그룹별로 섹션 타이틀 삽입
  const sections = [
    { rank: 0, title: '🏷️ 업체 직접 등록', items: filtered.filter(p => sourceRank(p) === 0) },
    { rank: 1, title: '📋 공식·공개 DB',   items: filtered.filter(p => sourceRank(p) === 1) },
    { rank: 2, title: '🔗 외부 링크 확인', items: filtered.filter(p => sourceRank(p) === 2) }
  ].filter(s => s.items.length > 0);

  let html = '';
  sections.forEach(sec => {
    html += `<div class="list-section-title">${sec.title} (${sec.items.length})</div>`;
    sec.items.forEach(p => { html += cardHtml(p); });
  });

  scroll.innerHTML = html;
  bsScroll.innerHTML = html;

  // 선택된 카드 스크롤
  if (state.selected) {
    setTimeout(() => {
      const sel = scroll.querySelector('.place-card.selected');
      if (sel) sel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }
}

function cardHtml(p) {
  const rank  = sourceRank(p);
  const src   = sourceLabel(p);
  const fee   = feeLabel(p.fee_type);
  const catCls = CAT_CLASS[p.category] || 'tag-etc';
  const catLbl = CAT_LABELS[p.category] || p.category || '기타';
  const catEm  = CAT_EMOJI[p.category]  || '📍';
  const sel    = p.id === state.selected;
  const geo    = !hasCoord(p) ? '<span class="tag" style="color:var(--text4)">지도 미표시</span>' : '';

  const tags = [
    p.parking_available === true  ? '<span class="tag">🚗 주차</span>'   : '',
    p.meal_provided     === true  ? '<span class="tag">🍱 식사</span>'   : '',
    p.guardian_required === false ? '<span class="tag orange">보호자비동반</span>' : '',
    isTodayCandidate(p)           ? '<span class="tag" style="background:#f0fdf4;color:var(--green)">오늘/즉시확인</span>' : '',
    p.available_weekend === true  ? '<span class="tag" style="background:var(--purple-light);color:var(--purple)">주말가능</span>' : '',
    p.category === 'schoolcare'   ? '<span class="tag" style="background:var(--purple-light);color:var(--purple)">정기등록 확인</span>' : '',
    geo
  ].filter(Boolean).join('');

  return `<div class="place-card${sel ? ' selected' : ''}" data-rank="${rank}" onclick="selectPlace('${esc(p.id)}')">
    <div class="card-top">
      <div class="card-name">${esc(p.name)}</div>
      <span class="card-cat ${catCls}">${catEm} ${esc(catLbl)}</span>
    </div>
    <div class="card-source-row">
      <span class="src-badge ${src.cls}">${src.text}</span>
      ${fee ? `<span class="src-badge ${fee.cls}">${fee.text}</span>` : ''}
    </div>
    <div class="card-addr">
      <span class="card-addr-icon">📍</span>
      <span>${esc(p.sigungu || '')}${p.sigungu && p.address ? ' · ' : ''}${esc((p.address || '').replace(p.sigungu || '', '').trim())}</span>
    </div>
    ${tags ? `<div class="card-tags">${tags}</div>` : ''}
  </div>`;
}

// ── 지도 마커 ────────────────────────────────────────
function renderMarkers() {
  markers.forEach(m => m.setMap(null));
  clusterer && clusterer.clear();
  markers = [];
  markerMap.clear();

  if (!map) return;

  const filteredIds = new Set(filtered.map(p => p.id));
  const newMarkers = [];

  ALL_DATA.forEach(p => {
    if (!hasCoord(p)) return;
    const inFilter = filteredIds.has(p.id);
    if (!inFilter) return;

    const rank = sourceRank(p);
    const colors = ['#f97316', '#2563eb', '#9ca3af'];
    const color  = colors[rank] || '#9ca3af';

    const content = `<div style="
      width:${rank===0?'13':'11'}px;height:${rank===0?'13':'11'}px;
      border-radius:50%;background:${color};
      border:2.5px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.25);
      cursor:pointer;
      ${p.id===state.selected?'outline:3px solid '+color+';outline-offset:2px;':''}
    "></div>`;

    const overlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(p.lat, p.lng),
      content,
      zIndex: rank === 0 ? 3 : rank === 1 ? 2 : 1
    });
    kakao.maps.event.addListener(overlay, 'click', () => selectPlace(p.id));
    overlay.__placeId = p.id;
    markers.push(overlay);
    markerMap.set(p.id, overlay);
  });

  markers.forEach(m => m.setMap(map));
}

function fitBounds(showToast = true) {
  const pts = filtered.filter(hasCoord);
  if (!pts.length) {
    map.setCenter(new kakao.maps.LatLng(DEFAULT_POS.lat, DEFAULT_POS.lng));
    map.setLevel(DEFAULT_LEVEL);
    if (showToast) toast('지도에 표시할 좌표 데이터가 없습니다');
    return;
  }
  const bounds = new kakao.maps.LatLngBounds();
  pts.forEach(p => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
  map.setBounds(bounds);
  setTimeout(() => {
    if (map.getLevel() > KOREA_MAX_LEVEL) {
      map.setCenter(new kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng));
      map.setLevel(KOREA_MAX_LEVEL);
    }
  }, 0);
}

function toggleCluster() {
  state.cluster = !state.cluster;
  $('cluster-btn').classList.toggle('active', state.cluster);
  renderMarkers();
}

// ── 장소 선택 ────────────────────────────────────────
function selectPlace(id) {
  if (state.selected === id) {
    state.selected = null;
    closeDetail();
    renderList();
    renderMarkers();
    return;
  }
  state.selected = id;
  const p = ALL_DATA.find(x => x.id === id);
  if (p) {
    renderDetail(p);
    if (hasCoord(p) && map) {
      map.setCenter(new kakao.maps.LatLng(p.lat, p.lng));
      if (map.getLevel() > 5) map.setLevel(5);
    }
  }
  renderList();
  renderMarkers();
  closeBs();
}

// ── 상세 패널 ────────────────────────────────────────
function renderDetail(p) {
  const src  = sourceLabel(p);
  const rank = sourceRank(p);
  const fee  = feeLabel(p.fee_type);
  const catCls = CAT_CLASS[p.category] || 'tag-etc';
  const catLbl = CAT_LABELS[p.category] || p.category || '기타';
  const catEm  = CAT_EMOJI[p.category]  || '📍';

  const noticeTexts = [
    '이 정보는 업체·기관이 직접 제출하거나 운영자가 확인한 등록 정보입니다.',
    '이 정보는 공공데이터·지자체 공개 정보 기반으로 수집한 정보입니다. 실제 운영 여부는 기관에 확인하세요.',
    '이 항목은 위치 확인용 외부 링크입니다. 실제 정보는 네이버·카카오 지도에서 확인하세요.'
  ];
  const noticeCls = ['', 'blue', 'gray'];

  $('detail-hero').innerHTML = `
    <div class="detail-name">${esc(p.name)}</div>
    <div class="detail-badges">
      <span class="card-cat ${catCls}">${catEm} ${esc(catLbl)}</span>
      <span class="src-badge ${src.cls}">${src.text}</span>
      ${fee ? `<span class="src-badge ${fee.cls}">${fee.text}</span>` : ''}
    </div>`;

  const call = p.tel
    ? `<a href="tel:${esc(p.tel)}">${esc(p.tel)}</a>`
    : '전화번호 확인 필요';

  const officialUrl = p.reservation_url || p.official_url || p.homepage_url || '';
  const officialLinkHtml = officialUrl
    ? `<a href="${esc(officialUrl)}" target="_blank" rel="noopener">바로가기 →</a>`
    : '등록된 링크 없음';

  const srcUrl = p.source_url || '';
  const naverUrl  = p.naver_map_url || p.naver_url  || `https://map.naver.com/v5/search/${encodeURIComponent([p.name, p.sigungu].filter(Boolean).join(' '))}`;
  const kakaoUrl  = p.kakao_map_url || p.kakao_url  || `https://map.kakao.com/?q=${encodeURIComponent([p.name, p.sigungu].filter(Boolean).join(' '))}`;

  const primaryBtn = officialUrl
    ? `<a class="det-btn primary" href="${esc(officialUrl)}" target="_blank" rel="noopener">공식·예약 링크</a>`
    : `<button class="det-btn primary" onclick="toast('공식·예약 링크가 아직 없습니다')">공식 링크 없음</button>`;

  $('detail-body').innerHTML = `
    <div class="notice-box ${noticeCls[rank]}">${noticeTexts[rank]}</div>
    ${p.category === 'schoolcare' ? '<div class="notice-box gray">초등돌봄은 대부분 정기 등록·대상 조건 확인이 필요한 시설입니다. 당일·일시 이용 가능 여부는 기관에 직접 확인하세요.</div>' : ''}
    <div class="detail-section">
      <div class="detail-section-title">기본 정보</div>
      ${row('📍','주소', esc(p.address || '주소 확인 필요'))}
      ${row('☎️','전화', call)}
      ${row('🧒','대상', esc(p.target_age || '확인 필요'))}
      ${row('💳','요금', fee ? `<span class="src-badge ${fee.cls}">${fee.text}</span>` : '요금 확인 필요')}
      ${row('🔗','공식·예약', officialLinkHtml)}
    </div>
    <div class="detail-section">
      <div class="detail-section-title">데이터 출처</div>
      ${row('📚','출처', esc(p.source_name || '공공·공개 데이터'))}
      ${row('🗓️','검수일', esc(p.last_checked || '확인일 미상'))}
      ${srcUrl ? row('🔎','출처 링크', `<a href="${esc(srcUrl)}" target="_blank" rel="noopener">바로가기 →</a>`) : ''}
    </div>
    <div class="legal-box">
      오늘아이돌봄 v11은 시설 정보를 연결하는 서비스이며, 직접 돌봄을 제공하거나 예약을 보증하지 않습니다.
    </div>
    <div class="detail-actions">
      ${primaryBtn}
      ${p.tel ? `<a class="det-btn" href="tel:${esc(p.tel)}">전화하기</a>` : ''}
      <a class="det-btn" href="${esc(kakaoUrl)}" target="_blank" rel="noopener">카카오맵</a>
      <a class="det-btn" href="${esc(naverUrl)}" target="_blank" rel="noopener">네이버지도</a>
      <button class="det-btn" onclick="sharePlace('${esc(p.id)}')">공유</button>
    </div>`;

  $('detail-panel').classList.add('open');
}

function row(icon, label, val) {
  return `<div class="detail-row">
    <div class="detail-icon">${icon}</div>
    <div class="detail-val"><b>${label}</b><br>${val}</div>
  </div>`;
}

function closeDetail() {
  $('detail-panel').classList.remove('open');
  state.selected = null;
  renderList();
  renderMarkers();
}

// ── 카테고리 바 ──────────────────────────────────────
function renderCatBar() {
  const bar = $('cat-bar');
  bar.innerHTML = `<button class="cat-btn${state.cat==='all'?' active':''}" onclick="setCat('all')">전체</button>` +
    Object.entries(CAT_LABELS)
      .filter(([k]) => k !== 'all')
      .map(([k, v]) => `<button class="cat-btn${state.cat===k?' active':''}" onclick="setCat('${k}')">${CAT_EMOJI[k]||''} ${v}</button>`)
      .join('');
}

function setCat(cat) {
  state.cat = cat;
  renderCatBar();
  renderAll();
}

// ── 퀵 필터 토글 ────────────────────────────────────
const CHIP_COLOR = {
  today:'on-green', weekend:'on-purple', guardian:'on-green',
  parking:'on-blue', free:'on-green', meal:'on-blue'
};
function toggleFilter(key) {
  state.filters[key] = !state.filters[key];
  const chip = $('chip-' + key);
  const on   = state.filters[key];
  chip.className = 'chip' + (on ? ' ' + (CHIP_COLOR[key] || 'on-orange') : '');
  renderAll();
}

// ── 검색 ────────────────────────────────────────────
function onSearch(v) {
  state.q = v;
  $('search-clear').classList.toggle('show', !!v);
  renderAll();
}
function clearSearch() {
  $('search-input').value = '';
  onSearch('');
}

// ── 뷰 전환 ──────────────────────────────────────────
function setView(v) {
  state.view = v;
  ['split','map','list'].forEach(m => {
    $('v-' + m).classList.toggle('active', m === v);
  });
  const lp = $('list-panel');
  const mp = $('map-panel');
  if (v === 'split') { lp.style.display = ''; mp.style.display = ''; lp.style.width = '360px'; mp.style.flex = '1'; }
  else if (v === 'map')  { lp.style.display = 'none'; mp.style.display = ''; mp.style.flex = '1'; }
  else if (v === 'list') { lp.style.display = ''; lp.style.width = '100%'; mp.style.display = 'none'; }
  setTimeout(() => map && map.relayout(), 80);
}

// ── 모바일 뷰 전환 ───────────────────────────────────
function toggleMobileView() {
  state.mobileShowMap = !state.mobileShowMap;
  const lp = $('list-panel');
  const mp = $('map-panel');
  if (state.mobileShowMap) {
    lp.classList.remove('mobile-list-mode');
    mp.classList.remove('mobile-list-mode');
    $('fab-icon').textContent = '📋';
    $('fab-text').textContent = '목록 보기';
    setTimeout(() => map && map.relayout(), 80);
  } else {
    lp.classList.add('mobile-list-mode');
    mp.classList.add('mobile-list-mode');
    $('fab-icon').textContent = '🗺️';
    $('fab-text').textContent = '지도 보기';
  }
}

function closeBs() {
  $('bottom-sheet').classList.remove('open');
  $('bs-overlay').classList.remove('show');
}

// ── 동네 설정 (당근 컨셉) ────────────────────────────
// 시도 약칭 매핑 (충남→충청남도 등)
const SIDO_ALIAS = {
  '서울':'서울특별시','경기':'경기도','인천':'인천광역시',
  '부산':'부산광역시','대구':'대구광역시','대전':'대전광역시',
  '광주':'광주광역시','울산':'울산광역시','세종':'세종특별자치시',
  '강원':'강원특별자치도','충북':'충청북도','충남':'충청남도',
  '전북':'전북특별자치도','전남':'전라남도','경북':'경상북도',
  '경남':'경상남도','제주':'제주특별자치도'
};

function buildSigunguList() {
  const sidoSet = new Set();
  const sgSet   = new Set();
  const sgList  = [];
  const subSet  = new Set();
  const subList = [];

  ALL_DATA.forEach(p => {
    if (p.sido) sidoSet.add(p.sido);
    if (p.sigungu) {
      const key = (p.sido || '') + '|' + p.sigungu;
      if (!sgSet.has(key)) {
        sgSet.add(key);
        sgList.push({ sido: p.sido || '', sigungu: p.sigungu });
      }
      // 주소에서 "시군구 하위 구" 추출 (예: 화성시 동탄구, 성남시 분당구)
      const addr = p.address || '';
      const m = addr.match(new RegExp(p.sigungu + '\\s([가-힣]+구)'));
      if (m) {
        const subgu = m[1];
        const subKey = p.sido + '|' + p.sigungu + '|' + subgu;
        if (!subSet.has(subKey)) {
          subSet.add(subKey);
          subList.push({ sido: p.sido || '', sigungu: p.sigungu, subgu });
        }
      }
    }
  });

  SIDO_LIST    = Array.from(sidoSet).sort();
  SIGUNGU_LIST = sgList.sort((a, b) => a.sigungu.localeCompare(b.sigungu, 'ko'));
  SUBGU_LIST   = subList.sort((a, b) => a.subgu.localeCompare(b.subgu, 'ko'));
}

let _suggestionTimer = null;

function openLocationModal() {
  $('loc-input').value = '';
  filterSuggestions('');
  $('location-modal').classList.add('open');
  setTimeout(() => $('loc-input').focus(), 100);
}

// ── 당근마켓 스타일 동네 검색 ─────────────────────────
// 1단계: 데이터 기반 (시도·시군구·하위구) 즉시 표시
// 2단계: 카카오 Places API 읍·면·동 실시간 추가는 비용·쿼터 보호를 위해 기본 OFF
function filterSuggestions(q) {
  const box = $('loc-suggestions');
  const lower = q.trim().toLowerCase();
  clearTimeout(_suggestionTimer);

  if (!lower) {
    // 기본: 시도 전체 목록
    box.innerHTML = SIDO_LIST.map(sido =>
      `<div class="loc-item" onclick="setNeighborhood('${sido}','${sido}')">
        <span class="loc-sido">🗺️ ${sido}</span>
        <span class="loc-all-badge">전체</span>
      </div>`
    ).join('') || `<div class="loc-empty">데이터 로딩 중...</div>`;
    return;
  }

  // ① 데이터 기반 결과 즉시 표시
  box.innerHTML = buildDataHtml(lower) ||
    `<div class="loc-empty">검색 결과가 없습니다. 시군구 이름으로 다시 검색해보세요.</div>`;

  // ② 300ms 후 카카오 읍·면·동 검색 결과 추가
  if (KAKAO_DONG_SUGGEST_ENABLED) {
    _suggestionTimer = setTimeout(() => appendKakaoDong(q, lower, box), 500);
  }
}

function buildDataHtml(lower) {
  const hl = s => s.replace(new RegExp(`(${lower})`, 'gi'),
    '<strong style="color:var(--brand)">$1</strong>');
  const expandedLower = (SIDO_ALIAS[lower] || '').toLowerCase();
  let html = '';

  // 시도
  const sidoMatches = SIDO_LIST.filter(s =>
    s.toLowerCase().includes(lower) ||
    (expandedLower && s.toLowerCase().includes(expandedLower))
  );
  sidoMatches.forEach(sido => {
    html += `<div class="loc-item" onclick="setNeighborhood('${sido}','${sido}')">
      <span class="loc-sido">🗺️ ${sido}</span>
      <span class="loc-all-badge">전체</span>
    </div>`;
  });

  // 시군구
  const sgMatches = SIGUNGU_LIST.filter(s => {
    const sig = s.sigungu.toLowerCase();
    const direct = sig.includes(lower) && !sidoMatches.some(sido => sido.toLowerCase().includes(sig));
    return direct || sidoMatches.some(sido => s.sido === sido);
  }).slice(0, 50);
  sgMatches.forEach(s => {
    html += `<div class="loc-item" onclick="setNeighborhood('${s.sigungu}','${s.sigungu}')">
      <span>${hl(s.sigungu)}</span>
      <span class="loc-sub-text">${s.sido}</span>
    </div>`;
  });

  // 하위 구 (동탄구·분당구 등)
  const subMatches = SUBGU_LIST.filter(s =>
    s.subgu.toLowerCase().includes(lower) ||
    sidoMatches.some(sido => s.sido === sido) ||
    (s.sigungu.toLowerCase().includes(lower) && !sgMatches.find(x => x.sigungu === s.sigungu))
  );
  subMatches.forEach(s => {
    html += `<div class="loc-item" onclick="setNeighborhood('${s.subgu}','${s.subgu}')">
      <span>${hl(s.subgu)}</span>
      <span class="loc-sub-text">${s.sigungu} · ${s.sido}</span>
    </div>`;
  });

  return html;
}

// 카카오 Places API로 읍·면·동 단위 검색 후 결과 추가
function appendKakaoDong(q, lower, box) {
  if (!kakao?.maps?.services) return;
  const ps = new kakao.maps.services.Places();
  ps.keywordSearch(q, (results, status) => {
    if (status !== kakao.maps.services.Status.OK) return;

    // 읍·면·동 포함 결과만 필터
    const dongItems = [];
    const seen = new Set();
    results.forEach(p => {
      const addr = p.road_address_name || p.address_name || '';
      const m = addr.match(/([가-힣]+시|[가-힣]+군)\s([가-힣]+(동|읍|면|가))\b/) ||
                addr.match(/([가-힣]+구)\s([가-힣]+(동|읍|면|가))\b/);
      if (!m) return;
      const dong   = m[2];
      const parent = m[1];
      const key    = parent + '|' + dong;
      if (seen.has(key)) return;
      seen.add(key);

      // 상위 시군구 파악 (필터용)
      const sigMatch = SIGUNGU_LIST.find(s => addr.includes(s.sigungu));
      const filterKey = sigMatch ? sigMatch.sigungu : dong;
      const sidoText  = sigMatch ? sigMatch.sido : '';

      dongItems.push({ dong, parent, filterKey, sidoText, lat: p.y, lng: p.x, addr });
    });

    if (!dongItems.length) return;

    const divider = `<div class="loc-divider">📍 읍·면·동 검색 결과</div>`;
    const addHtml = dongItems.slice(0, 8).map(d =>
      `<div class="loc-item loc-dong"
        onclick="setNeighborhoodDong('${d.filterKey}','${d.dong}',${d.lat},${d.lng})">
        <span>📍 <strong style="color:var(--brand)">${d.dong}</strong></span>
        <span class="loc-sub-text">${d.parent} · ${d.sidoText}</span>
      </div>`
    ).join('');

    // 기존 결과 뒤에 추가
    const cur = box.querySelector('.loc-empty');
    if (cur) box.innerHTML = divider + addHtml;
    else box.innerHTML += divider + addHtml;
  }, { size: 15 });
}

// 읍·면·동 선택: 지도는 정확한 위치로, 데이터는 상위 시군구로 필터
function setNeighborhoodDong(filterKey, dongName, lat, lng) {
  state.hood = {
    key: filterKey,
    name: dongName,
    lat: parseFloat(lat),
    lng: parseFloat(lng)
  };
  $('loc-name').textContent = dongName;
  closeModal('location-modal');
  renderAll();
  try { localStorage.setItem('hood', JSON.stringify(state.hood)); } catch(e) {}
  setTimeout(() => {
    if (!map) return;
    map.setCenter(new kakao.maps.LatLng(parseFloat(lat), parseFloat(lng)));
    map.setLevel(6);
  }, 150);
}

function moveMapByKeyword(name) {
  if (!map || !name || !kakao.maps.services) return;

  // 행정구역명 → 주소 검색으로 정확한 위치 찾기
  const geocoder = new kakao.maps.services.Geocoder();
  geocoder.addressSearch(name, (result, status) => {
    if (status === kakao.maps.services.Status.OK && result.length > 0) {
      map.setCenter(new kakao.maps.LatLng(result[0].y, result[0].x));
      map.setLevel(8);
      return;
    }

    // 주소 검색 실패 시 → "홍성군청" / "동탄시청" 방식으로 장소 검색
    const suffix = name.endsWith('군') ? ' 군청'
                 : name.endsWith('구') ? ' 구청'
                 : name.endsWith('시') ? ' 시청'
                 : ' 행정복지센터';
    const query = name + suffix;

    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(query, (data, status2) => {
      if (status2 === kakao.maps.services.Status.OK && data.length > 0) {
        map.setCenter(new kakao.maps.LatLng(data[0].y, data[0].x));
        map.setLevel(8);
      } else {
        // 최후 수단: 이름 그대로 검색
        ps.keywordSearch(name, (data2, status3) => {
          if (status3 === kakao.maps.services.Status.OK && data2.length > 0) {
            map.setCenter(new kakao.maps.LatLng(data2[0].y, data2[0].x));
            map.setLevel(8);
          }
        });
      }
    });
  });
}

function setNeighborhood(key, name) {
  state.hood = { key, name };
  $('loc-name').textContent = name || '동네 설정';
  closeModal('location-modal');
  renderAll();
  try { localStorage.setItem('hood', JSON.stringify(state.hood)); } catch(e) {}

  // 동네 이름으로 카카오 장소검색 → 지도 이동 (좌표 유무 관계없이 항상 실행)
  setTimeout(() => {
    if (!map) return;
    if (!key) {
      // 전국 선택 시 한국 중앙으로
      map.setCenter(new kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng));
      map.setLevel(KOREA_MAX_LEVEL);
      return;
    }
    moveMapByKeyword(name);
  }, 150);
}

// ── 전체 초기화 ──────────────────────────────────────
function resetAll() {
  state.filters = { today:false, weekend:false, guardian:false, parking:false, free:false, meal:false };
  ['today','weekend','guardian','parking','free','meal'].forEach(k => {
    $('chip-' + k).className = 'chip';
  });
  state.cat = 'all';
  state.q = '';
  $('search-input').value = '';
  $('search-clear').classList.remove('show');
  renderCatBar();
  renderAll();
}

// ── 업체 등록 ───────────────────────────────────────
function openVendorGoogleForm() {
  if (!VENDOR_GOOGLE_FORM_URL) {
    toast('구글폼 주소를 먼저 연결해주세요');
    return;
  }
  window.open(VENDOR_GOOGLE_FORM_URL, '_blank', 'noopener');
}
function openVendorModal() { $('vendor-modal').classList.add('open'); }

// ── 공유 ─────────────────────────────────────────────
function sharePlace(id) {
  const p = ALL_DATA.find(x => x.id === id);
  if (!p) return;
  const text = `${p.name}\n${p.address || p.sigungu || ''}\n※ 실제 운영 여부는 기관에 확인하세요`;
  if (navigator.share) {
    navigator.share({ title: p.name, text });
  } else {
    navigator.clipboard?.writeText(text).then(() => toast('시설 정보를 복사했습니다'));
  }
}

// ── 모달 공통 ────────────────────────────────────────
function closeModal(id) {
  $(id).classList.remove('open');
}

// ── 법적 고지 (1회) ──────────────────────────────────
function confirmLegal() {
  try { localStorage.setItem('legal_v11_confirmed', '1'); } catch(e) {}
  closeModal('legal-modal');
}
function checkLegal() {
  try {
    if (localStorage.getItem('legal_v11_confirmed') === '1') return;
  } catch(e) {}
  $('legal-modal').classList.add('open');
}

// ── 저장된 동네 복원 ─────────────────────────────────
function restoreHood() {
  try {
    const saved = localStorage.getItem('hood');
    if (saved) {
      const h = JSON.parse(saved);
      if (h && h.name) {
        state.hood = h;
        $('loc-name').textContent = h.name;
      }
    }
  } catch(e) {}
}

// ── 카카오 지도 초기화 ───────────────────────────────
function initMap() {
  kakao.maps.load(() => {
    const center = new kakao.maps.LatLng(DEFAULT_POS.lat, DEFAULT_POS.lng);
    map = new kakao.maps.Map($('kakao-map'), {
      center,
      level: DEFAULT_LEVEL
    });
    clusterer = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 5,
      disableClickZoom: false
    });
    renderMarkers();
    if (state.hood.key) fitBounds(false);
  });
}

// ── 반응형 처리 ──────────────────────────────────────
function handleResize() {
  const isMobile = window.innerWidth < 640;
  const fab = $('mobile-fab');
  if (isMobile) {
    fab.style.display = 'flex';
    if (!state.mobileShowMap) {
      $('map-panel').classList.remove('mobile-list-mode');
      $('list-panel').classList.add('mobile-list-mode');
    }
  } else {
    fab.style.display = 'none';
    $('list-panel').classList.remove('mobile-list-mode');
    $('map-panel').classList.remove('mobile-list-mode');
    setView(state.view);
    map && map.relayout();
  }
}

// ── 키보드 단축키 ────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetail();
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }
});

// ── 앱 초기화 ────────────────────────────────────────
async function init() {
  // 1. 데이터 로드
  try {
    const res  = await fetch('data/places.json');
    ALL_DATA   = await res.json();
    if (!Array.isArray(ALL_DATA)) throw new Error('Invalid data');
  } catch (e) {
    $('loading').innerHTML = `<div style="color:var(--brand);font-size:13px">
      ❌ 데이터를 불러오지 못했습니다.<br>
      <small>로컬에서 실행 시 <b>Live Server</b>를 사용해주세요.</small>
    </div>`;
    return;
  }

  // 2. 동네 목록 구성
  buildSigunguList();

  // 3. 저장된 동네 복원
  restoreHood();

  // 4. 카테고리 바 렌더
  renderCatBar();

  // 5. 초기 렌더
  applyFilter();
  updateCount();
  renderList();

  // 6. 지도 초기화
  initMap();

  // 7. 법적 고지 (1회)
  checkLegal();

  // 8. 반응형 초기 처리
  handleResize();
  window.addEventListener('resize', handleResize);
}

window.addEventListener('load', init);
