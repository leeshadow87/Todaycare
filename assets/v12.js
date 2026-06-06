'use strict';

const VENDOR_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd-7jGRKZ8YORu2-Beu3c8SCdX2KvCYlXe-ELZ7wfyD2nxsNg/viewform';
const CONTACT_EMAIL = ['leeshadow','87','@','gmail','.com'].join('');

// 지도 정책:
// 카카오맵 SDK는 지도 배경 렌더링과 자체 DB 위도/경도 마커 표시용으로만 사용한다.
// 카카오 Local/Places API 검색 결과를 장소 DB로 저장, 복제, 재배포하지 않는다.
// 향후 Kakao/Naver/Google/Leaflet 교체가 쉽도록 지도 호출은 얇은 어댑터 계층으로 분리한다.
// 공개 지도 SDK appkey를 쓰는 경우 카카오 개발자 콘솔에서 허용 도메인을 반드시 제한한다.
const MAP_POLICY = Object.freeze({
  provider: 'kakao-sdk-or-static-link',
  allowRendering: true,
  allowMarkerFromOwnDb: true,
  prohibitPlaceHarvesting: true
});

// AI 검색은 /api/ai-search 같은 서버리스 함수에서 처리한다.
// OpenAI/Claude API Key는 Vercel/Netlify/Cloudflare/Supabase Edge Function 환경변수에 저장하고, 프론트에는 노출하지 않는다.
// 프론트는 DB 필터링 후보와 사용자 질문만 서버리스 함수에 전달하고, 서버는 저렴한 mini 모델로 짧은 추천 문장만 반환한다.

const primaryFilters = [
  ['today','오늘 가능'], ['indoor','실내'], ['age47','4~7세']
];

const advancedFilters = [
  ['openNow','지금 운영'], ['cheap','무료/저렴'], ['rain','비 오는 날'],
  ['age03','0~3세'], ['elementary','초등'], ['short','1~2시간'],
  ['call','전화 확인 필요'], ['reserve','예약 링크 있음'], ['public','공공기관'], ['private','민간시설'],
  ['outdoor','야외']
];

const primaryCategories = [
  ['all','전체','통합 검색', []],
  ['publicGroup','공공돌봄','국가·공공·가족센터', ['national','publiccare','community']],
  ['indoorGroup','실내놀이','키즈카페·실내놀이터', ['kidscafe','indoorplay']],
  ['programGroup','프로그램·수업','도서관·체험·특강', ['library','class','academy','seasonal']],
  ['outingGroup','체험·나들이','농촌·숲·쿠킹', ['nature']]
];

const advancedCategories = [
  ['national','국가 아이돌봄서비스','공식 방문형 1:1 돌봄 연결', ['national']],
  ['publiccare','공공돌봄','공공·지자체 돌봄', ['publiccare']],
  ['kidscafe','키즈카페','민간 놀이공간', ['kidscafe']],
  ['indoorplay','실내놀이터','비 오는 날 추천', ['indoorplay']],
  ['library','도서관 프로그램','무료·저렴 프로그램', ['library']],
  ['class','체험수업','미술·과학·놀이', ['class']],
  ['academy','학원 단기특강','방학·단기 과정', ['academy']],
  ['community','공동육아나눔터','가족센터 포함', ['community']],
  ['seasonal','방학특강','기간 한정', ['seasonal']],
  ['nature','농촌·숲·쿠킹 체험','지역 체험 프로그램', ['nature']]
];

const state = {
  data: [],
  q: '',
  category: 'all',
  filters: new Set(),
  moreFilters: false,
  moreCategories: false,
  activeScreen: 'home'
};

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));

function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function sameDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function aiQuota() {
  const key = 'todaycare_v12_ai_quota';
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  const today = sameDayKey();
  if (saved.day !== today) return { key, day: today, count: 0, limit: 5 };
  return { key, day: today, count: Number(saved.count || 0), limit: 5 };
}

function updateQuotaText() {
  const q = aiQuota();
  $('aiQuota').textContent = `AI 검색 테스트: 오늘 ${q.count}/${q.limit}회 사용`;
}

function useAiQuota() {
  const q = aiQuota();
  if (q.count >= q.limit) return false;
  localStorage.setItem(q.key, JSON.stringify({ day: q.day, count: q.count + 1 }));
  updateQuotaText();
  return true;
}

function renderFilterChips() {
  $('filterChips').innerHTML = primaryFilters.map(([id, label]) =>
    `<button class="chip ${state.filters.has(id) ? 'active' : ''}" data-filter="${id}" type="button">${esc(label)}</button>`
  ).join('');
  $('advancedFilterChips').innerHTML = advancedFilters.map(([id, label]) =>
    `<button class="chip ${state.filters.has(id) ? 'active' : ''}" data-filter="${id}" type="button">${esc(label)}</button>`
  ).join('');
  $('advancedFilterChips').hidden = !state.moreFilters;
  $('moreFiltersBtn').textContent = state.moreFilters ? '세부 필터 접기' : '세부 필터 더보기';
}

function renderCategories() {
  $('categoryGrid').innerHTML = primaryCategories.map(([id, label, hint]) =>
    `<button class="cat-btn ${state.category === id ? 'active' : ''}" data-category="${id}" type="button">${esc(label)}<span>${esc(hint)}</span></button>`
  ).join('');
  $('advancedCategoryGrid').innerHTML = advancedCategories.map(([id, label, hint]) =>
    `<button class="cat-btn ${state.category === id ? 'active' : ''}" data-category="${id}" type="button">${esc(label)}<span>${esc(hint)}</span></button>`
  ).join('');
  $('advancedCategoryGrid').hidden = !state.moreCategories;
  $('moreCategoriesBtn').textContent = state.moreCategories ? '세부 카테고리 접기' : '세부 카테고리 더보기';
}

function selectedCategoryIds() {
  const found = [...primaryCategories, ...advancedCategories].find(([id]) => id === state.category);
  if (!found || state.category === 'all') return [];
  return found[3] || [state.category];
}

function matchPlace(place) {
  const q = state.q.trim().toLowerCase();
  const categoryIds = selectedCategoryIds();
  if (categoryIds.length && !categoryIds.includes(place.category)) return false;
  if (q) {
    const haystack = [place.name, place.categoryLabel, place.address, place.targetAge, place.tags.join(' ')].join(' ').toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  for (const f of state.filters) {
    if (!place.filters.includes(f)) return false;
  }
  return true;
}

function filteredPlaces() {
  return state.data.filter(matchPlace).sort((a, b) => {
    const rank = { direct: 0, official: 1, public: 1, link: 2 };
    return (rank[a.sourceType] ?? 2) - (rank[b.sourceType] ?? 2);
  });
}

function badgeClass(place) {
  if (place.category === 'national') return 'official';
  if (place.operatorType === 'public') return 'public';
  if (place.operatorType === 'private') return 'private';
  return '';
}

function statusTags(place) {
  return [place.todayStatus, place.reserveStatus, place.capacityStatus, place.licenseType]
    .filter(Boolean)
    .map(t => `<span class="tag">${esc(t)}</span>`).join('');
}

function cardHtml(place) {
  const directions = `https://map.kakao.com/link/search/${encodeURIComponent(place.name + ' ' + place.address)}`;
  const homepage = place.homepage || place.officialLink || directions;
  const tel = place.tel ? `tel:${place.tel.replace(/[^0-9+]/g, '')}` : '';
  return `<article class="place-card">
    <div class="card-top">
      <div>
        <h3>${esc(place.name)}</h3>
        <div class="meta">${esc(place.categoryLabel)} · ${esc(place.address)}</div>
      </div>
      <span class="badge ${badgeClass(place)}">${esc(place.sourceLabel)}</span>
    </div>
    <div class="meta">
      운영시간: ${esc(place.hours || '확인 필요')}<br>
      요금: ${esc(place.fee || '확인 필요')} · 대상연령: ${esc(place.targetAge || '확인 필요')}<br>
      예약방식: ${esc(place.reservation || '전화 확인 필요')}
    </div>
    <div class="tags">${statusTags(place)}</div>
    <div class="actions">
      ${tel ? `<a class="hot" href="${tel}">전화</a>` : `<button type="button" data-toast="전화번호 확인 필요">전화</button>`}
      <a href="${directions}" target="_blank" rel="noopener">길찾기</a>
      <a href="${esc(homepage)}" target="_blank" rel="noopener">예약</a>
      <button type="button" data-correction="${esc(place.name)}">수정</button>
    </div>
  </article>`;
}

function renderCards() {
  const list = filteredPlaces();
  $('resultCount').textContent = `${list.length}곳`;
  $('cards').innerHTML = list.length ? list.map(cardHtml).join('') : `<div class="place-card"><h3>현재 노출 가능한 장소가 없습니다</h3><p class="meta">초기에는 데이터가 있는 지역부터 확장 중입니다. 필터를 줄이거나 지역명을 바꿔보세요.</p><button class="secondary-btn" type="button" data-open="vendor">우리 기관 무료 등록 신청</button></div>`;
  renderPins(list);
}

function renderPins(list) {
  const shown = list.slice(0, 10);
  $('pinBoard').innerHTML = shown.map((p, idx) => {
    const pos = boardPosition(p, idx);
    return `<button class="pin" style="left:${pos.x}%;top:${pos.y}%;" data-pin="${esc(p.name)}" type="button">${esc(p.name)}</button>`;
  }).join('');
}

function boardPosition(place, fallbackIndex) {
  if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    const minLat = 33.0, maxLat = 38.7, minLng = 124.5, maxLng = 131.5;
    const x = Math.max(8, Math.min(92, ((place.lng - minLng) / (maxLng - minLng)) * 100));
    const y = Math.max(8, Math.min(92, 100 - ((place.lat - minLat) / (maxLat - minLat)) * 100));
    return { x: Math.round(x), y: Math.round(y) };
  }
  return {
    x: 18 + ((fallbackIndex * 23) % 68),
    y: 18 + ((fallbackIndex * 31) % 68)
  };
}

function openModal(type, placeName = '') {
  const body = $('modalBody');
  const mailSubject = encodeURIComponent(`[오늘아이돌봄] ${placeName ? placeName + ' ' : ''}문의`);
  if (type === 'vendor') {
    body.innerHTML = `<h2>업체 무료 등록 신청</h2>
      <p>구글폼에서 장소명, 주소, 대표전화, 공식 홈페이지, 운영시간, 요금 등 공개 가능한 정보를 제출하면 수동 검수 후 반영합니다. 담당자 연락처는 내부 확인용으로만 사용합니다.</p>
      <a class="primary-btn" href="${VENDOR_FORM_URL}" target="_blank" rel="noopener">구글폼 열기</a>`;
  } else if (type === 'correction') {
    body.innerHTML = `<h2>정보 수정 요청</h2>
      <p>잘못된 운영시간, 전화번호, 링크, 폐업 정보는 이메일로 접수합니다. 개인정보성 정보는 최소화해서 보내주세요.</p>
      <a class="primary-btn" href="mailto:${CONTACT_EMAIL}?subject=${mailSubject}">이메일로 수정 요청</a>`;
  } else {
    body.innerHTML = `<h2>광고 문의</h2>
      <p>광고 상품은 데이터 밀도와 이용자 반응을 확인한 뒤 열 예정입니다. 지금은 무료 등록으로 먼저 입점을 신청해주세요.</p>
      <a class="primary-btn" href="mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[오늘아이돌봄] 광고 문의')}">광고 문의 이메일</a>`;
  }
  $('modalBackdrop').hidden = false;
}

function runAiSearch() {
  if (!useAiQuota()) {
    toast('오늘 AI 검색 테스트 횟수를 모두 사용했습니다');
    return;
  }
  const prompt = ($('aiPrompt').value || $('searchInput').value || '').trim();
  const list = filteredPlaces().slice(0, 5);
  if (!list.length) {
    $('aiResult').textContent = '현재 조건에 맞는 후보가 없습니다. 지역이나 필터를 넓혀보세요.';
    return;
  }
  const intro = prompt ? `질문: ${prompt}\n` : '';
  $('aiResult').textContent = intro + list.map((p, i) =>
    `${i + 1}. ${p.name} - ${p.todayStatus}. ${p.reservation || '전화 확인 필요'}`
  ).join('\n');
}

function switchScreen(screen) {
  state.activeScreen = screen;
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === `screen-${screen}`));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === screen));
}

function bindEvents() {
  $('searchInput').addEventListener('input', e => {
    state.q = e.target.value;
    renderCards();
  });
  $('aiBtn').addEventListener('click', () => {
    $('aiPrompt').value = $('searchInput').value;
    switchScreen('recommend');
    runAiSearch();
  });
  $('aiRunBtn').addEventListener('click', runAiSearch);
  $('resetBtn').addEventListener('click', () => {
    state.filters.clear();
    state.category = 'all';
    state.q = '';
    $('searchInput').value = '';
    renderFilterChips();
    renderCategories();
    renderCards();
  });
  $('moreFiltersBtn').addEventListener('click', () => {
    state.moreFilters = !state.moreFilters;
    renderFilterChips();
  });
  $('moreCategoriesBtn').addEventListener('click', () => {
    state.moreCategories = !state.moreCategories;
    renderCategories();
  });
  document.addEventListener('click', e => {
    const filter = e.target.closest('[data-filter]');
    if (filter) {
      const id = filter.dataset.filter;
      state.filters.has(id) ? state.filters.delete(id) : state.filters.add(id);
      renderFilterChips();
      renderCards();
      return;
    }
    const category = e.target.closest('[data-category]');
    if (category) {
      state.category = category.dataset.category;
      renderCategories();
      renderCards();
      return;
    }
    const screen = e.target.closest('[data-screen]');
    if (screen) {
      switchScreen(screen.dataset.screen);
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) {
      openModal(open.dataset.open);
      return;
    }
    const correction = e.target.closest('[data-correction]');
    if (correction) {
      openModal('correction', correction.dataset.correction);
      return;
    }
    const toastBtn = e.target.closest('[data-toast]');
    if (toastBtn) toast(toastBtn.dataset.toast);
    const pin = e.target.closest('[data-pin]');
    if (pin) toast(pin.dataset.pin);
  });
  $('modalClose').addEventListener('click', () => $('modalBackdrop').hidden = true);
  $('modalBackdrop').addEventListener('click', e => {
    if (e.target.id === 'modalBackdrop') $('modalBackdrop').hidden = true;
  });
}

async function loadData() {
  try {
    const res = await fetch('./data_v12.json');
    state.data = await res.json();
  } catch {
    state.data = [];
    toast('샘플 데이터를 불러오지 못했습니다');
  }
}

async function init() {
  renderFilterChips();
  renderCategories();
  bindEvents();
  updateQuotaText();
  await loadData();
  renderCards();
}

init();
