function findTarget(level, id) {
  return level.items?.find((item) => item.id === id)
    || level.switches?.find((trigger) => trigger.id === id)
    || level.portals?.find((portal) => portal.id === id)
    || level.paintables?.find((paintable) => paintable.id === id);
}

function findItem(level, id) {
  return level.items?.find((item) => item.id === id);
}

function findSwitch(level, id) {
  return level.switches?.find((trigger) => trigger.id === id);
}

function hasGoalRequirements(requirements) {
  return Object.values(requirements || {}).some((value) => (
    Array.isArray(value)
      ? value.length > 0
      : value && typeof value === 'object'
        ? Object.keys(value).length > 0
        : Boolean(value)
  ));
}

function missingIds(ids = [], completed) {
  return ids.filter((id) => !completed.has(id));
}

function itemGateMissing(item, collected, activated) {
  return [
    ...missingIds(item?.requiresItems, collected),
    ...missingIds(item?.requiresSwitches, activated),
  ];
}

function phaseLabel(level, phaseId, phase) {
  const labels = level.phaseLabels?.[phaseId];
  if (labels?.[phase]) return labels[phase];
  return phase === 0 ? '原层' : `第 ${phase + 1} 层`;
}

function getPhaseValue(level, phases, phaseId) {
  return phases[phaseId] ??
    level.phases?.find((entry) => entry.id === phaseId)?.initial ??
    0;
}

function goalTarget(level) {
  return {
    id: 'goal',
    label: '出口',
    x: level.goal.x + level.goal.w / 2,
    y: level.goal.y + level.goal.h / 2,
    r: Math.min(level.goal.w, level.goal.h) / 2,
    kind: 'goal',
  };
}

function targetWithMeta(target, kind = 'target') {
  if (!target) return null;
  return {
    id: target.id,
    label: target.label || target.word || target.id,
    x: target.x,
    y: target.y,
    r: target.r || 12,
    kind,
  };
}

function firstMissingItemTarget(level, ids = [], collected) {
  const id = ids.find((entry) => !collected.has(entry));
  return targetWithMeta(findItem(level, id), 'item');
}

function getGuidanceStepTarget(level, step, context) {
  const {
    collected,
    activated,
    painted,
    rotations,
    phases,
    fragmentCount,
    requirements,
  } = context;
  if (step.target === 'fragments') {
    if ((fragmentCount || 0) >= (requirements.fragments || 0)) return null;
    const fragment = level.items?.find((item) => (
      item.type === 'fragment' && !collected.has(item.id)
    ));
    return targetWithMeta(fragment, 'item');
  }
  if (step.target === 'painted') {
    const id = requirements.painted?.find((entry) => !painted.has(entry));
    return targetWithMeta(level.paintables?.find((paintable) => paintable.id === id), 'paintable');
  }
  if (step.target === 'rotation') {
    if (rotations[step.id] === step.turn) return null;
    return targetWithMeta(
      level.switches?.find((trigger) => trigger.action === 'rotate' && trigger.target === step.id),
      'switch',
    );
  }
  if (step.target === 'phase') {
    const current = getPhaseValue(level, phases, step.id);
    if (current === step.phase) return null;
    return targetWithMeta(
      level.switches?.find((trigger) => trigger.action === 'phase' && trigger.target === step.id),
      'switch',
    );
  }
  const item = findItem(level, step.target);
  if (item) {
    if (collected.has(item.id)) return null;
    const missingPhase = Object.entries(item.requiresPhases || {})
      .find(([id, phase]) => getPhaseValue(level, phases, id) !== phase);
    if (missingPhase) {
      return targetWithMeta(
        level.switches?.find((trigger) => trigger.action === 'phase' && trigger.target === missingPhase[0]),
        'switch',
      );
    }
    return targetWithMeta(item, 'item');
  }
  const trigger = findSwitch(level, step.target);
  if (trigger) {
    if (activated.has(trigger.id)) return null;
    return firstMissingItemTarget(level, trigger.requiresItems, collected) ||
      targetWithMeta(trigger, 'switch');
  }
  const target = findTarget(level, step.target);
  return targetWithMeta(target, target?.pairId ? 'portal' : 'target');
}

function getGuidanceStepHint(level, step, context) {
  const {
    collected,
    activated,
    painted,
    rotations,
    phases,
    fragmentCount,
    requirements,
  } = context;
  if (step.target === 'fragments') {
    if ((fragmentCount || 0) >= (requirements.fragments || 0)) return '';
    return step.hint || '继续收集名字碎片，门在等她把自己说完整。';
  }
  if (step.target === 'painted') {
    const missing = requirements.painted?.some((id) => !painted.has(id));
    return missing ? step.hint || '继续把白玫瑰涂红，女王的花园才会露出出口。' : '';
  }
  if (step.target === 'rotation') {
    const current = rotations[step.id];
    return current === step.turn ? '' : step.hint || '把旋转机关调到正确方向，再去找门后的路。';
  }
  if (step.target === 'phase') {
    const current = getPhaseValue(level, phases, step.id);
    return current === step.phase ? '' : step.hint || `把机关切到${phaseLabel(level, step.id, step.phase)}。`;
  }
  const item = findItem(level, step.target);
  if (item) {
    if (collected.has(item.id)) return '';
    const missingPhase = Object.entries(item.requiresPhases || {})
      .find(([id, phase]) => getPhaseValue(level, phases, id) !== phase);
    if (missingPhase) return `先切换地图层，再找“${item.label || item.id}”。`;
    return step.hint || `先寻找“${item.label || item.id}”。`;
  }
  const trigger = findSwitch(level, step.target);
  if (trigger) {
    if (activated.has(trigger.id)) return '';
    const missingItems = trigger.requiresItems?.filter((id) => !collected.has(id)) || [];
    if (missingItems.length > 0) {
      const labels = missingItems.map((id) => findItem(level, id)?.label).filter(Boolean).join('、');
      return `“${trigger.label}”还没醒，它在等${labels || '前置道具'}。`;
    }
    return step.hint || `接下来触发“${trigger.label || trigger.id}”。`;
  }
  return '';
}

function getGuidanceStepObjective(level, step, context) {
  const {
    collected,
    activated,
    painted,
    rotations,
    fragmentCount,
    requirements,
  } = context;
  if (step.target === 'fragments') {
    const required = requirements.fragments || 0;
    return {
      id: 'fragments',
      label: `${fragmentCount || 0}/${required} 名字`,
      done: required > 0 && (fragmentCount || 0) >= required,
    };
  }
  if (step.target === 'painted') {
    const required = requirements.painted?.length || 0;
    const count = requirements.painted?.filter((id) => painted.has(id)).length || 0;
    return {
      id: 'painted',
      label: `${count}/${required} 玫瑰`,
      done: required > 0 && count >= required,
    };
  }
  if (step.target === 'rotation') {
    return {
      id: `rotation:${step.id}`,
      label: step.label || level.rotationLabel || '房间',
      done: rotations[step.id] === step.turn,
    };
  }
  const item = findItem(level, step.target);
  if (item) {
    return {
      id: item.id,
      label: item.label || item.id,
      done: collected.has(item.id),
    };
  }
  const trigger = findSwitch(level, step.target);
  if (trigger) {
    return {
      id: trigger.id,
      label: trigger.label || trigger.id,
      done: activated.has(trigger.id),
    };
  }
  return null;
}

export function getGuidanceObjectives(level, state = {}) {
  if (!level.guidanceRoute?.length) return [];
  const context = {
    collected: new Set(state.collectedIds || []),
    activated: new Set(state.activatedIds || []),
    painted: new Set(state.paintedIds || []),
    rotations: state.rotations || {},
    phases: state.phases || {},
    fragmentCount: state.fragmentCount || 0,
    requirements: level.goal?.requires || {},
  };
  const entries = level.guidanceRoute
    .map((step) => getGuidanceStepObjective(level, step, context))
    .filter(Boolean);
  const currentIndex = entries.findIndex((entry) => !entry.done);
  return entries.map((entry, index) => ({
    ...entry,
    current: index === currentIndex,
    next: currentIndex >= 0 && index === currentIndex + 1,
  }));
}

function getRouteHint(level, state, context) {
  for (const step of level.guidanceRoute || []) {
    const hint = getGuidanceStepHint(level, step, context);
    if (hint) return hint;
  }
  return '';
}

function getPhaseRouteHint(level, context) {
  if (!level.phaseRoute?.length) return '';
  const phaseControl = level.switches?.find((trigger) => trigger.action === 'phase');
  const phase = level.phases?.find((entry) => entry.id === phaseControl?.target);
  if (!phaseControl || !phase) return '';
  const currentPhase = getPhaseValue(level, context.phases, phase.id);

  for (let index = 0; index < level.phaseRoute.length; index += 1) {
    const step = level.phaseRoute[index];
    if (step.target === 'goal') {
      return currentPhase === step.phase
        ? level.readyHint || '条件已经齐了，去终点门前试试看。'
        : `去中央镜盘切回${phaseLabel(level, phase.id, step.phase)}，门才会站到正确那一面。`;
    }
    const item = findItem(level, step.target);
    if (item) {
      if (context.collected.has(item.id)) continue;
      if (currentPhase !== step.phase) {
        return `先去中央镜盘切到${phaseLabel(level, phase.id, step.phase)}，再找“${item.label || item.id}”。`;
      }
      return item.guidance || `当前先去找“${item.label || item.id}”。`;
    }
    const trigger = findSwitch(level, step.target);
    if (!trigger) continue;
    if (currentPhase !== step.phase) continue;
    const next = level.phaseRoute[index + 1];
    const nextPhase = next?.phase ?? 0;
    return `去中央镜盘${nextPhase === 0 ? '切回' : '切到'}${phaseLabel(level, phase.id, nextPhase)}。`;
  }
  return '';
}

function getPhaseRouteTarget(level, context) {
  if (!level.phaseRoute?.length) return null;
  const phaseControl = level.switches?.find((trigger) => trigger.action === 'phase');
  const phase = level.phases?.find((entry) => entry.id === phaseControl?.target);
  if (!phaseControl || !phase) return null;
  const currentPhase = getPhaseValue(level, context.phases, phase.id);

  for (const step of level.phaseRoute) {
    if (step.target === 'goal') {
      return currentPhase === step.phase
        ? goalTarget(level)
        : targetWithMeta(phaseControl, 'switch');
    }
    const item = findItem(level, step.target);
    if (item) {
      if (context.collected.has(item.id)) continue;
      return currentPhase === step.phase
        ? targetWithMeta(item, 'item')
        : targetWithMeta(phaseControl, 'switch');
    }
    const trigger = findSwitch(level, step.target);
    if (!trigger) continue;
    if (context.activated.has(trigger.id)) continue;
    return currentPhase === step.phase
      ? targetWithMeta(trigger, 'switch')
      : targetWithMeta(phaseControl, 'switch');
  }
  return null;
}

export function getStagedObjectives(level, collectedIds, activatedIds) {
  if (!level.stealthRoute?.length) return [];
  const collected = new Set(collectedIds);
  const activated = new Set(activatedIds);
  const entries = level.stealthRoute.map((id) => {
    if (id === 'goal') return { id, label: '出口', done: false };
    const target = findTarget(level, id);
    return {
      id,
      label: target?.label || id,
      done: collected.has(id) || activated.has(id),
    };
  });
  const currentIndex = entries.findIndex((entry) => !entry.done);
  return entries.map((entry, index) => ({
    ...entry,
    current: index === currentIndex,
    next: currentIndex >= 0 && index === currentIndex + 1,
  }));
}

export function getStealthAlertDuration(config, switches) {
  const stages = config?.stageDurations || {};
  const active = new Set(switches);
  if (active.has('exit-lantern')) return stages.exit ?? config.alertDuration;
  if (active.has('sun-lantern')) return stages.sun ?? config.alertDuration;
  if (active.has('moon-lantern')) return stages.moon ?? config.alertDuration;
  return config?.alertDuration;
}

export function getDynamicHint(level, state = {}) {
  const collected = new Set(state.collectedIds || []);
  const activated = new Set(state.activatedIds || []);
  const painted = new Set(state.paintedIds || []);
  const rotations = state.rotations || {};
  const phases = state.phases || {};
  const requirements = level.goal?.requires || {};

  if (!hasGoalRequirements(requirements)) return '';

  const context = {
    collected,
    activated,
    painted,
    rotations,
    phases,
    fragmentCount: state.fragmentCount || 0,
    requirements,
  };

  if (level.echoReplay && !requirements.switches?.every((id) => activated.has(id))) {
    if (state.identityRemaining > 0) {
      return '过去已经被左侧印章记住了，趁倒计时结束前去碰右侧“现在”。';
    }
    return '先让两秒后的倒影踩住左侧“过去”，再绕到右侧等待她。';
  }

  const routeHint = getRouteHint(level, state, context);
  if (routeHint) return routeHint;

  const phaseRouteHint = getPhaseRouteHint(level, context);
  if (phaseRouteHint) return phaseRouteHint;

  const staged = getStagedObjectives(level, [...collected], [...activated]);
  const currentStage = staged.find((entry) => entry.current);
  if (currentStage) {
    if (currentStage.id === 'goal') {
      return '两半微笑都归位了，跟着最后一团猫雾去终点。';
    }
    const target = findTarget(level, currentStage.id);
    if (target?.requiresItems?.some((id) => !collected.has(id))) {
      const missing = target.requiresItems
        .map((id) => findItem(level, id)?.label)
        .filter(Boolean)
        .join('、');
      return `“${target.label}”还在等${missing || '前一个物件'}。`;
    }
    if (level.stealthConfig && currentStage.id !== level.stealthRoute?.[0]) {
      return `跟紧移动猫雾，去找“${currentStage.label}”。`;
    }
    return `当前先去找“${currentStage.label}”。`;
  }

  if (requirements.fragments && (state.fragmentCount || 0) < requirements.fragments) {
    return '继续收集名字碎片，门在等她把自己说完整。';
  }

  const missingItemId = requirements.items?.find((id) => {
    if (collected.has(id)) return false;
    const item = findItem(level, id);
    return itemGateMissing(item, collected, activated).length === 0 || item?.guidance;
  });
  if (missingItemId) {
    const item = findItem(level, missingItemId);
    return item?.guidance || `先寻找“${item?.label || missingItemId}”，门才愿意继续听你说话。`;
  }

  const missingPaintedId = requirements.painted?.find((id) => !painted.has(id));
  if (missingPaintedId) {
    return '继续把白玫瑰涂红，女王的花园才会露出出口。';
  }

  const missingRotation = Object.entries(requirements.rotations || {})
    .find(([id, turn]) => rotations[id] !== turn);
  if (missingRotation) {
    return '把旋转房间调到正确方向，再去找门后的路。';
  }

  const missingPhase = Object.entries(requirements.phases || {})
    .find(([id, phase]) => phases[id] !== phase);
  if (missingPhase) {
    return '切换黑白棋局，让出口所在的那一层显现出来。';
  }

  const missingSwitchId = requirements.switches?.find((id) => !activated.has(id));
  if (missingSwitchId) {
    const trigger = findSwitch(level, missingSwitchId);
    const missingItems = trigger?.requiresItems?.filter((id) => !collected.has(id)) || [];
    if (missingItems.length > 0) {
      const labels = missingItems
        .map((id) => findItem(level, id)?.label)
        .filter(Boolean)
        .join('、');
      return `“${trigger.label}”还没醒，它在等${labels || '前置道具'}。`;
    }
    if (level.switchSequence?.length) {
      const index = level.switchSequence.indexOf(missingSwitchId);
      return `按顺序触发第 ${index + 1} 个目标：“${trigger?.label || missingSwitchId}”。`;
    }
    return `接下来触发“${trigger?.label || missingSwitchId}”。`;
  }

  return level.readyHint || '条件已经齐了，去终点门前试试看。';
}

export function getGuidanceTarget(level, state = {}) {
  const collected = new Set(state.collectedIds || []);
  const activated = new Set(state.activatedIds || []);
  const painted = new Set(state.paintedIds || []);
  const rotations = state.rotations || {};
  const phases = state.phases || {};
  const requirements = level.goal?.requires || {};
  if (!hasGoalRequirements(requirements) && !level.guidanceRoute?.length && !level.stealthRoute?.length) {
    return null;
  }

  const context = {
    collected,
    activated,
    painted,
    rotations,
    phases,
    fragmentCount: state.fragmentCount || 0,
    requirements,
  };

  if (level.echoReplay && !requirements.switches?.every((id) => activated.has(id))) {
    const targetId = state.identityRemaining > 0 ? 'who-right' : 'who-left';
    return targetWithMeta(findSwitch(level, targetId), 'switch');
  }

  for (const step of level.guidanceRoute || []) {
    const target = getGuidanceStepTarget(level, step, context);
    if (target) return target;
  }

  const phaseTarget = getPhaseRouteTarget(level, context);
  if (phaseTarget) return phaseTarget;

  const staged = getStagedObjectives(level, [...collected], [...activated]);
  const currentStage = staged.find((entry) => entry.current);
  if (currentStage) {
    if (currentStage.id === 'goal') return goalTarget(level);
    const target = findTarget(level, currentStage.id);
    if (target?.requiresItems?.some((id) => !collected.has(id))) {
      return firstMissingItemTarget(level, target.requiresItems, collected);
    }
    return targetWithMeta(target, target?.activationMode ? 'switch' : 'item');
  }

  if (requirements.fragments && (state.fragmentCount || 0) < requirements.fragments) {
    return targetWithMeta(
      level.items?.find((item) => item.type === 'fragment' && !collected.has(item.id)),
      'item',
    );
  }

  const missingItem = requirements.items
    ?.map((id) => findItem(level, id))
    .find((item) => item && !collected.has(item.id) && itemGateMissing(item, collected, activated).length === 0);
  if (missingItem) return targetWithMeta(missingItem, 'item');

  const missingPaintable = requirements.painted
    ?.map((id) => level.paintables?.find((paintable) => paintable.id === id))
    .find((paintable) => paintable && !painted.has(paintable.id));
  if (missingPaintable) return targetWithMeta(missingPaintable, 'paintable');

  const missingRotation = Object.entries(requirements.rotations || {})
    .find(([id, turn]) => rotations[id] !== turn);
  if (missingRotation) {
    return targetWithMeta(
      level.switches?.find((trigger) => trigger.action === 'rotate' && trigger.target === missingRotation[0]),
      'switch',
    );
  }

  const missingPhase = Object.entries(requirements.phases || {})
    .find(([id, phase]) => phases[id] !== phase);
  if (missingPhase) {
    return targetWithMeta(
      level.switches?.find((trigger) => trigger.action === 'phase' && trigger.target === missingPhase[0]),
      'switch',
    );
  }

  const missingSwitch = requirements.switches
    ?.map((id) => findSwitch(level, id))
    .find((trigger) => trigger && !activated.has(trigger.id));
  if (missingSwitch) {
    return firstMissingItemTarget(level, missingSwitch.requiresItems, collected) ||
      targetWithMeta(missingSwitch, 'switch');
  }

  return goalTarget(level);
}
