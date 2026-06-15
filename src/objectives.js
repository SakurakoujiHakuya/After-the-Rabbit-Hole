function findTarget(level, id) {
  return level.items?.find((item) => item.id === id)
    || level.switches?.find((trigger) => trigger.id === id);
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
