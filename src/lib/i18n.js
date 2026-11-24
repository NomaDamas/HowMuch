// Tiny i18n: English by default, Korean switchable in Settings. No dependency; works outside React too.
import { useSyncExternalStore } from 'react';

const dict = {
  en: {
    'mode.auto': 'Auto', 'mode.draw': 'Touch · Draw',
    'hint.auto': 'Hold steady on an object', 'hint.draw': 'Tap or circle an object', 'hint.connecting': 'Starting camera…',
    'hint.finding': 'Finding the outline…', 'hint.notFound': 'Nothing found. Move closer or select it by hand.', 'hint.tooSmall': 'That is too small. Move closer or circle the whole object.',
    'hint.max': 'Up to 4 objects at once. Close one to add another.', 'hint.cancelled': 'Search cancelled.', 'hint.label': 'Show the label or model mark up close.',
    'hint.reticle': 'Point at an object',
    'cam.https': 'Open this page over HTTPS to use the camera.', 'cam.denied': 'Allow camera access in your browser settings.', 'cam.error': 'Could not open the camera.', 'cam.retry': 'Allow camera',
    'cam.label': 'Live price camera', 'cam.draw': 'Draw around an object', 'seg.fail': 'Could not recognise the object.', 'seg.none': 'No object found in that selection.',
    'st.segmenting': 'Finding outline', 'st.identifying': 'Identifying', 'st.searching': 'Searching prices', 'st.unavailable': 'Shops unreachable', 'st.failed': 'Search failed',
    'st.needModel': 'Model needed', 'st.reacquiring': 'Re-locking outline', 'st.lost': 'Out of view', 'st.checking': 'Checking price', 'st.person': 'Person', 'st.partial': 'Partial',
    'st.noProduct': 'Nothing identified',
    'price.none': 'No price found', 'price.verified': 'Verified price', 'price.estimate': 'Rough price · model unknown', 'price.market': 'Market price', 'price.hold': 'On hold',
    'price.single': 'Single listing', 'price.compare': '{n} compared', 'price.delivered': 'delivery included', 'price.item': 'item price',
    'price.avgOf': 'average of {n} similar items', 'price.sources': '{n} sources', 'price.region.all': 'Nationwide', 'price.askModel': 'Tell me the model', 'price.askModelBasis': 'No price found · enter the model or show the label',
    'price.approx': '~{p}', 'price.unitLabel': '{p} / {u} · {r}', 'price.estLabel': '{p} (model unconfirmed)',
    'card.person': 'Person', 'card.object': 'Object', 'card.compared': '{n} sellers',
    'act.identified': 'Identified: {text}', 'act.search': 'Searching “{text}”', 'act.open': 'Reading {text}', 'act.cite': 'Source: {text}', 'act.agentDone': 'Agent finished · {n} prices', 'act.compare': 'Comparing {n} listings',
    'act.cache': 'Seen recently · using saved prices', 'price.prelim': 'Preliminary · {n} listings', 'work.title': 'Working on it', 'work.identify': 'Identify', 'work.search': 'Search', 'work.compare': 'Compare', 'work.verify': 'Verify', 'work.agents': '{n} of 3 research agents done', 'work.wait': 'Usually under a minute',
    'sheet.items': 'Items', 'sheet.settings': 'Settings', 'sheet.empty': 'Nothing is being researched.', 'sheet.cancel': 'Cancel', 'sheet.cancelItem': 'Cancel object {n}', 'sheet.cancelListItem': 'Cancel object {n} from list',
    'detail.more': 'Details', 'detail.less': 'Hide details', 'detail.sources': 'Sources', 'detail.range': 'Range', 'detail.mean': 'Average', 'detail.median': 'Median', 'detail.samples': '{n} listings',
    'detail.new': 'New', 'detail.used': 'Used', 'detail.unknownCond': 'Condition unknown', 'detail.inStock': 'In stock', 'detail.soldOut': 'Sold out', 'detail.stockUnknown': 'Stock unknown',
    'detail.estimateNote': 'Rough average of similar items. Not the price of this exact model.', 'detail.marketNote': 'Market price per {u}, {r}. Observed {d}.',
    'detail.checked': 'Checked', 'detail.searching': 'Checking prices…', 'detail.identifying': 'Identifying the object…', 'detail.unavailable': 'Could not reach shops. Try again.',
    'detail.exchange': 'Converted with ECB rates {d}', 'detail.person': 'Just for fun.',
    'model.placeholder': 'Model name, e.g. AirPods Pro 2', 'model.search': 'Search this model', 'model.scan': 'Scan the label', 'model.hint': 'Enter the model name or show the label for an exact price.', 'model.aria': 'Model name',
    'settings.advanced': 'Advanced', 'settings.imageSearch': 'Image search (Google)', 'settings.imageSearch.note': 'Sends the cut-out photo to Google to find leads about what it is. Off by default.', 'settings.imageSearch.off': 'Not set up on this server (needs GOOGLE_VISION_API_KEY).', 'act.image': 'Image search: {text}',
    'settings.language': 'Language', 'settings.fun': 'Fun mode for people', 'settings.pair': 'Connect phone (QR)', 'settings.source': 'Source code', 'settings.about': 'HowMuch by NomaDamas MinXing', 'settings.star': 'Star on GitHub',
    'bar.all': 'All', 'bar.aria': 'Objects', 'bar.remove': 'Remove',
    'star.title': 'Give HowMuch a star', 'star.sub': 'It means a lot to the developer.', 'star.btn': 'Star on GitHub', 'star.later': 'Later', 'star.code': 'Enter this code on GitHub', 'star.waiting': 'Waiting for you to approve…',
    'star.thanks': 'Thank you!', 'star.open': 'Open GitHub', 'star.done': 'I starred it', 'star.fail': 'Could not star. Try again.', 'star.aria': 'Star HowMuch on GitHub', 'star.as': 'Star as @{user}', 'star.signin': 'Sign in with GitHub to star', 'star.checking': 'Checking GitHub…', 'star.already': 'You already starred it. Thank you!', 'star.codeHelp': 'Open github.com/login/device and enter this code',
    'ghost.aria': 'Objects out of view',
    'label.cancel': 'Cancel', 'label.send': 'Capture & search again', 'label.aria': 'Label capture', 'mode.aria': 'Selection mode',
    'person.vibe0': 'Main-character energy', 'person.vibe1': 'Café owner outfit', 'person.vibe2': 'Weekend traveller', 'person.vibe3': 'Effortless hipster', 'person.vibe4': 'Office street-style', 'person.vibe5': 'Perfect outfit day',
    'xr.open': 'Spatial view', 'xr.close': 'Close', 'xr.manual': 'Place on a surface', 'xr.placed': 'Pinned to the surface. Tap to move it.', 'xr.fail': 'Could not start spatial view.', 'xr.nodepth': 'Camera and depth cannot be used together on this device.',
    'xr.ended': 'Video or depth became unavailable.', 'xr.autoReady': 'Shows a 3D price tag when the product is visible.', 'xr.aim': 'Aim beside the product and tap.', 'xr.showing': 'Showing 3D price tags beside {n} products.', 'xr.checking': 'Checking the product and depth.', 'xr.auto': 'Auto 3D beside the product',
    'pair.title': 'Connect phone', 'pair.scan': 'Scan with a phone on the same Wi-Fi. The code works once for 5 minutes.', 'pair.connect': 'Connect to this server', 'pair.revoke': 'Disconnect', 'pair.revoked': 'Disconnected.', 'pair.expired': 'This QR was used or expired. Create a new one on the PC.', 'pair.close': 'Close', 'pair.new': 'New QR', 'pair.app': 'HowMuch app', 'pair.browser': 'Browser',
    'pair.phone': 'Phone camera link', 'pair.ask': 'Connect this device to the server below to research objects from its camera?', 'pair.scanNew': 'Scan a new QR from the phone-connect button on the PC.', 'pair.start': 'Start the phone demo server and trust the local certificate on the phone.',
    'net.stream': 'The research connection was interrupted.', 'net.failed': 'Research failed', 'net.size': 'Response too large', 'net.timeout': 'Research timed out.', 'net.nojob': 'Research job not found.'
  },
  ko: {
    'mode.auto': '자동', 'mode.draw': '터치·그리기',
    'hint.auto': '물체를 잠깐 비춰 주세요', 'hint.draw': '물체를 탭하거나 둘러 그려 주세요', 'hint.connecting': '카메라 시작 중…',
    'hint.finding': '윤곽을 찾는 중…', 'hint.notFound': '물체를 찾지 못했어요. 가까이 비추거나 직접 선택하세요.', 'hint.tooSmall': '너무 작은 조각이에요. 가까이 비추거나 물체 전체를 둘러 그려 주세요.',
    'hint.max': '최대 4개까지 함께 조사해요. 하나를 닫고 다시 선택하세요.', 'hint.cancelled': '조사를 취소했어요.', 'hint.label': '라벨이나 모델 각인을 가까이 비춰 주세요.',
    'hint.reticle': '물체를 비춰 보세요',
    'cam.https': '카메라를 쓰려면 HTTPS 주소로 열어 주세요.', 'cam.denied': '브라우저 설정에서 카메라 권한을 허용해 주세요.', 'cam.error': '카메라를 열 수 없어요.', 'cam.retry': '카메라 허용',
    'cam.label': '라이브 가격 카메라', 'cam.draw': '물체 그리기', 'seg.fail': '물체를 인식하지 못했어요.', 'seg.none': '선택 범위에서 물체를 찾지 못했어요.',
    'st.segmenting': '윤곽 찾는 중', 'st.identifying': '식별 중', 'st.searching': '시세 조사 중', 'st.unavailable': '판매처 연결 불가', 'st.failed': '검색 실패',
    'st.needModel': '모델 필요', 'st.reacquiring': '윤곽 재획득 중', 'st.lost': '시야 밖', 'st.checking': '가격 확인', 'st.person': '사람', 'st.partial': '부분 결과',
    'st.noProduct': '확인된 상품 없음',
    'price.none': '가격 미확인', 'price.verified': '확인한 판매가', 'price.estimate': '대략 시세 · 모델 미확인', 'price.market': '시장 시세', 'price.hold': '가격 보류',
    'price.single': '단일 판매가', 'price.compare': '비교 {n}건', 'price.delivered': '배송비 포함', 'price.item': '상품가 기준',
    'price.avgOf': '비슷한 상품 {n}개 평균', 'price.sources': '{n}곳 시세', 'price.region.all': '전국', 'price.askModel': '모델명을 알려 주세요', 'price.askModelBasis': '가격을 찾지 못했어요 · 모델명 입력 또는 라벨 촬영',
    'price.approx': '약 {p}', 'price.unitLabel': '{p} / {u} · {r} 시세', 'price.estLabel': '{p} (모델 미확인 평균)',
    'card.person': '사람', 'card.object': '물체', 'card.compared': '{n}곳 비교',
    'act.identified': '확인: {text}', 'act.search': '“{text}” 검색 중', 'act.open': '{text} 읽는 중', 'act.cite': '출처: {text}', 'act.agentDone': '조사 에이전트 완료 · 가격 {n}건', 'act.compare': '{n}개 상품 비교 중',
    'act.cache': '최근에 본 상품 · 저장된 가격 사용', 'price.prelim': '임시 가격 · {n}건 기준', 'work.title': '작업 중', 'work.identify': '식별', 'work.search': '검색', 'work.compare': '비교', 'work.verify': '검증', 'work.agents': '조사 에이전트 3개 중 {n}개 완료', 'work.wait': '보통 1분 안에 끝나요',
    'sheet.items': '조사 목록', 'sheet.settings': '설정', 'sheet.empty': '조사 중인 물체가 없어요.', 'sheet.cancel': '취소', 'sheet.cancelItem': '물체 {n} 조사 취소', 'sheet.cancelListItem': '목록에서 물체 {n} 조사 취소',
    'detail.more': '자세히', 'detail.less': '접기', 'detail.sources': '출처', 'detail.range': '범위', 'detail.mean': '평균', 'detail.median': '중앙값', 'detail.samples': '{n}건',
    'detail.new': '새 상품', 'detail.used': '중고', 'detail.unknownCond': '상태 미확인', 'detail.inStock': '재고 있음', 'detail.soldOut': '품절', 'detail.stockUnknown': '재고 미확인',
    'detail.estimateNote': '비슷한 상품의 대략적인 평균이에요. 이 모델의 정확한 가격이 아니에요.', 'detail.marketNote': '{r} {u} 기준 시세예요. 조사일 {d}.',
    'detail.checked': '확인', 'detail.searching': '가격을 확인하는 중…', 'detail.identifying': '물체를 식별하는 중…', 'detail.unavailable': '판매처에 연결하지 못했어요. 다시 시도해 주세요.',
    'detail.exchange': 'ECB 환율 {d} 기준 환산', 'detail.person': '재미로만 봐 주세요.',
    'model.placeholder': '모델명 예: AirPods Pro 2', 'model.search': '이 모델로 다시 찾기', 'model.scan': '라벨 촬영', 'model.hint': '정확한 가격은 모델명을 입력하거나 라벨을 비추면 알 수 있어요.', 'model.aria': '모델명',
    'settings.advanced': '고급 설정', 'settings.imageSearch': '이미지 검색 (구글)', 'settings.imageSearch.note': '오려 낸 사진을 구글로 보내 무엇인지 단서를 찾습니다. 기본은 꺼짐입니다.', 'settings.imageSearch.off': '이 서버에는 설정되어 있지 않습니다 (GOOGLE_VISION_API_KEY 필요).', 'act.image': '이미지 검색: {text}',
    'settings.language': '언어', 'settings.fun': '사람 장난 모드', 'settings.pair': '휴대폰 연결 (QR)', 'settings.source': '소스 코드', 'settings.about': 'HowMuch by NomaDamas MinXing', 'settings.star': 'GitHub에서 Star',
    'bar.all': '전체', 'bar.aria': '물체', 'bar.remove': '삭제',
    'star.title': 'HowMuch에 별을 눌러 주세요', 'star.sub': '개발자에게 큰 힘이 돼요.', 'star.btn': 'GitHub에서 Star', 'star.later': '나중에', 'star.code': 'GitHub에서 이 코드를 입력하세요', 'star.waiting': '승인을 기다리는 중…',
    'star.thanks': '감사합니다!', 'star.open': 'GitHub 열기', 'star.done': 'Star 눌렀어요', 'star.fail': 'Star를 누르지 못했어요. 다시 시도해 주세요.', 'star.aria': 'GitHub에서 HowMuch Star 누르기', 'star.as': '@{user} 계정으로 Star', 'star.signin': 'GitHub에 로그인하고 Star', 'star.checking': 'GitHub 확인 중…', 'star.already': '이미 Star를 눌렀어요. 감사합니다!', 'star.codeHelp': 'github.com/login/device 에서 이 코드를 입력하세요',
    'ghost.aria': '시야 밖 물체',
    'label.cancel': '취소', 'label.send': '촬영하고 다시 찾기', 'label.aria': '라벨 촬영', 'mode.aria': '선택 모드',
    'person.vibe0': '주인공 아우라', 'person.vibe1': '카페 사장님 룩', 'person.vibe2': '주말 여행 모드', 'person.vibe3': '편안한 힙스터 감성', 'person.vibe4': '출근길 패셔니스타', 'person.vibe5': '오늘의 코디 만점',
    'xr.open': '공간 보기', 'xr.close': '닫기', 'xr.manual': '표면에 직접 배치', 'xr.placed': '표면에 고정했어요. 탭하면 다시 배치해요.', 'xr.fail': '공간 보기를 시작하지 못했어요.', 'xr.nodepth': '이 기기에서는 카메라와 깊이를 함께 쓸 수 없어요.',
    'xr.ended': '영상이나 깊이를 읽을 수 없어 종료했어요.', 'xr.autoReady': '상품이 보이면 3D 가격표를 붙여요.', 'xr.aim': '상품 옆 표면에 조준하고 탭하세요.', 'xr.showing': '{n}개 상품 옆에 3D 가격표를 표시해요.', 'xr.checking': '상품과 깊이를 확인하고 있어요.', 'xr.auto': '상품 옆에 자동 3D 표시',
    'pair.title': '휴대폰 연결', 'pair.scan': '같은 Wi-Fi의 휴대폰으로 스캔하세요. 코드는 5분 동안 한 번 쓸 수 있어요.', 'pair.connect': '이 서버에 연결', 'pair.revoke': '연결 해제', 'pair.revoked': '연결을 해제했어요.', 'pair.expired': '이미 사용했거나 만료된 QR이에요. PC에서 새 코드를 만드세요.', 'pair.close': '닫기', 'pair.new': '새 QR', 'pair.app': 'HowMuch 앱', 'pair.browser': '브라우저',
    'pair.phone': '휴대폰 카메라 연결', 'pair.ask': '이 기기를 아래 서버에 연결해 카메라로 선택한 물체를 조사할까요?', 'pair.scanNew': 'PC의 휴대폰 연결 버튼에서 새 QR을 스캔하세요.', 'pair.start': '휴대폰 데모 서버를 실행하고 로컬 인증서를 휴대폰에서 신뢰해 주세요.',
    'net.stream': '가격 조사 연결이 끊겼어요.', 'net.failed': '가격 조사에 실패했어요', 'net.size': '응답이 너무 커요', 'net.timeout': '가격 조사 시간이 초과됐어요.', 'net.nojob': '가격 조사 작업을 찾을 수 없어요.'
  }
};

const KEY = 'howmuch-lang';
const read = () => { try { const v = localStorage.getItem(KEY); return v === 'ko' || v === 'en' ? v : 'en'; } catch { return 'en'; } };
let lang = read();
const listeners = new Set();

export const getLang = () => lang;
export function setLang(next) {
  if (next !== 'en' && next !== 'ko') return;
  lang = next; try { localStorage.setItem(KEY, next); } catch { /* storage may be unavailable */ }
  listeners.forEach(fn => fn());
}
/** Translate a key; {name} placeholders are filled from vars. Falls back to English, then the key. */
export function t(key, vars) {
  const text = dict[lang][key] ?? dict.en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : text;
}
/** Re-renders the calling component when the language changes. */
export function useLang() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, getLang); }
export const locale = () => lang === 'ko' ? 'ko-KR' : 'en-US';
export const numberFormat = () => lang === 'ko' ? 'ko-KR' : 'en-US';
export const dictionaries = dict;
