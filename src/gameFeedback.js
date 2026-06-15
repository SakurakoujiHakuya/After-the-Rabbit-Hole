const collectionMessages = {
  key: '钥匙在你手里轻轻响了一声。',
  potion: '你变小了。世界没有。',
  cookie: '你变大了，连规则也开始后退。',
  checkpoint: '检查点记住了你的位置。',
  paint: '爱丽丝提起了红色油漆桶。',
  timepiece: '帽匠借出的怀表停住了巡逻机关。',
  fan: '白兔的折扇吹开了一条过分狭窄的路。',
  smile: '微笑留了下来，猫却仍然不见踪影。',
  shield: '支线留下的纪念物正保护着你。',
  curiosity: '你找到了一枚藏起来的兔子浮雕。',
  thimble: '渡渡鸟郑重地把你的顶针颁给了你。',
};

const deathMessages = {
  card: '纸牌卫兵把你送回了玫瑰旁。',
  watch: '怀表追上了你，时间重新开始。',
  dodo: '赛跑队伍撞乱了你的脚步。渡渡鸟让你回到起点。',
  plate: '飞来的盘子把你送回了最近的检查点。',
  hazard: '漩涡把方向揉成了一团。',
  alert: '纸牌看清了你。柴郡猫把你送回最近的灯笼。',
  spikes: '三颗心都碎了。兔子洞把你送回了最初的落点。',
  top: '洞顶的尖刺耗尽了三颗心。平台重新洗牌。',
  fall: '你坠过了兔子洞的边界，只好从顶部重新寻找落点。',
};

export function getCollectionMessage(item) {
  if (item.collectMessage) return item.collectMessage;
  if (item.type === 'fragment') return `她想起了：“${item.word}”`;
  if (item.type === 'mirrorShard') {
    return item.releasesMirror
      ? '定向镜片归位了。左与右终于重新同意彼此。'
      : '一枚倒影碎片从镜层里脱落下来。';
  }
  return collectionMessages[item.type] || '机关发出了一声轻响。';
}

export function getDeathMessage(reason, level) {
  return level.deathMessages?.[reason] || deathMessages[reason] || deathMessages.hazard;
}
