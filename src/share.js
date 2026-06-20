import { getRouteLevelIds } from './progress.js';
import { getRouteCarrySummary, getRouteChoiceSummary } from './routeSummary.js';

export function getEndingShareStats(progress = {}) {
  const routeLevelIds = getRouteLevelIds(progress);
  const routeLevelSet = new Set(routeLevelIds);
  const curiosityCount = Object.entries(progress.curiosities || {})
    .filter(([id, items]) => routeLevelSet.has(id) && items?.length)
    .length;
  const crownCount = Object.entries(progress.grades || {})
    .filter(([id]) => routeLevelSet.has(id))
    .reduce((total, [, grade]) => total + grade, 0);

  return {
    routeLevelIds,
    curiosityCount,
    crownCount,
    maxCuriosities: routeLevelIds.length,
    maxCrowns: routeLevelIds.length * 3,
    foundEveryCameo: curiosityCount === routeLevelIds.length,
  };
}

export function buildEndingSharePayload(progress = {}, url = '') {
  const stats = getEndingShareStats(progress);
  const route = getRouteChoiceSummary(progress) || '还没来得及选择岔路';
  const carry = getRouteCarrySummary(progress.choices || {}) || '一颗刚醒来的记忆珠';

  return {
    title: '兔子洞尽头',
    text: [
      '我在《兔子洞尽头》里帮爱丽丝找回了名字。',
      `路线：${route}`,
      `带回：${carry}`,
      `兔子浮雕 ${stats.curiosityCount}/${stats.maxCuriosities} · 皇冠 ${stats.crownCount}/${stats.maxCrowns}`,
    ].join('\n'),
    url,
  };
}

export function formatShareMessage(payload) {
  return [payload.title, payload.text, payload.url].filter(Boolean).join('\n');
}
