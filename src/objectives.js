function findTarget(level, id) {
  return level.items?.find((item) => item.id === id)
    || level.switches?.find((trigger) => trigger.id === id);
}

function findItem(level, id) {
  return level.items?.find((item) => item.id === id);
}

function findSwitch(level, id) {
  return level.switches?.find((trigger) => trigger.id === id);
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

  if (level.echoReplay && !requirements.switches?.every((id) => activated.has(id))) {
    if (state.identityRemaining > 0) {
      return '过去已经被左侧印章记住了，趁倒计时结束前去碰右侧“现在”。';
    }
    return '先让两秒后的倒影踩住左侧“过去”，再绕到右侧等待她。';
  }

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
    return `当前先去找“${currentStage.label}”。`;
  }

  const missingItemId = requirements.items?.find((id) => !collected.has(id));
  if (missingItemId) {
    const item = findItem(level, missingItemId);
    return item?.guidance || `先寻找“${item?.label || missingItemId}”，门才愿意继续听你说话。`;
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

  if (requirements.fragments && (state.fragmentCount || 0) < requirements.fragments) {
    return '继续收集名字碎片，门在等她把自己说完整。';
  }

  return level.readyHint || '条件已经齐了，去终点门前试试看。';
}
