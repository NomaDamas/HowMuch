// A reference item's shelf price is never promoted to a verified price for the scanned object.
export function comparableLabel(result) {
  if (result?.lowest) return '';
  const first = result?.comparables?.[0];
  if (!first || !Number.isFinite(first.price) || !first.currency) return '';
  return '유사품 ' + new Intl.NumberFormat('ko-KR',{style:'currency',currency:first.currency}).format(first.price);
}
export function discoveryLabel(report) {
  if (!report?.visual) return '';
  const v=report.visual;
  if (v.status === 'unavailable') return '이미지 검색을 사용할 수 없었습니다.';
  if (v.merchantLinks > 0) return '이미지 검색에서 판매처 링크 '+v.merchantLinks+'개를 찾았습니다.';
  return '이미지 검색에서 확인 가능한 판매처 링크가 없었습니다.';
}
