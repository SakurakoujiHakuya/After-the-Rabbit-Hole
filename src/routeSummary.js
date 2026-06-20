import { levelById, levels } from './levels.js';

export const giftTypeLabels = {
  potion: '蓝药水',
  cookie: '饼干',
  timepiece: '怀表',
  shield: '护符',
  fan: '折扇',
  key: '钥匙',
};

export function inheritedGiftName(entity = {}) {
  if (entity.label) return entity.label;
  if (entity.id?.includes('ribbon')) return '镜面缎带';
  if (entity.id?.includes('feather')) return '火烈鸟羽毛';
  if (entity.id?.includes('shortcut')) return '变小捷径';
  return giftTypeLabels[entity.type] || entity.id || '支线遗物';
}

export function getBranchGiftSummary(forkLevel, choice, allLevels = levels) {
  const names = new Set();
  for (const level of allLevels) {
    for (const inheritance of level.inheritances || []) {
      if (inheritance.choiceAt !== forkLevel.id || inheritance.choice !== choice.id) continue;
      for (const item of inheritance.items || []) names.add(inheritedGiftName(item));
      for (const gate of inheritance.sizeGates || []) names.add(inheritedGiftName(gate));
    }
  }
  return [...names].slice(0, 3).join('、');
}

export function getActiveCarrySummary(level, choices = {}) {
  const names = new Set();
  for (const inheritance of level.inheritances || []) {
    if (choices[inheritance.choiceAt] !== inheritance.choice) continue;
    for (const item of inheritance.items || []) names.add(inheritedGiftName(item));
    for (const gate of inheritance.sizeGates || []) names.add(inheritedGiftName(gate));
  }
  return [...names].join('、');
}

export function getRouteChoiceSummary(progress) {
  const choices = progress?.choices || {};
  return Object.entries(choices)
    .map(([forkId, choiceId]) => {
      const forkLevel = levelById[forkId];
      const choice = forkLevel?.choices?.find((entry) => entry.id === choiceId);
      if (!forkLevel || !choice) return null;
      return `${forkLevel.name}：${choice.title}`;
    })
    .filter(Boolean)
    .join(' / ');
}

export function getRouteCarrySummary(choices = {}, allLevels = levels) {
  const names = new Set();
  for (const level of allLevels) {
    for (const inheritance of level.inheritances || []) {
      if (choices[inheritance.choiceAt] !== inheritance.choice) continue;
      for (const item of inheritance.items || []) names.add(inheritedGiftName(item));
      for (const gate of inheritance.sizeGates || []) names.add(inheritedGiftName(gate));
    }
  }
  return [...names].join('、');
}
