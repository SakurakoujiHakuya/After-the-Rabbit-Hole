import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameCanvas from './GameCanvas';
import { assetUrl } from './assets';
import { firstLevelId, getLevel, getPlayableLevel, levels } from './levels';
import {
  calculateLevelGrade,
  chooseBranch,
  clearProgress,
  collectCuriosity,
  completeLevel,
  enterLevel,
  loadProgress,
  recordDeath,
} from './progress';

const debugLevelId = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('level')
  : null;

function emitEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`rabbit-hole:${name}`, { detail }));
}

function formatDuration(milliseconds) {
  if (!milliseconds) return '';
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return minutes ? `${minutes}:${seconds}` : `${seconds}秒`;
}

function MusicButton({ muted, playing, onToggle }) {
  const active = playing && !muted;
  return (
    <button
      className={`music-button ${active ? 'is-playing' : ''}`}
      onClick={onToggle}
      aria-label={active ? '关闭背景音乐' : '播放背景音乐'}
    >
      <span>{active ? '♫' : '♪'}</span>
      <i />
    </button>
  );
}

function playMirrorZoneCue(effect) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequencies = {
    echo: [392, 330],
    vanish: [523, 659],
    invertX: [440, 311],
  };
  const [startFrequency, endFrequency] = frequencies[effect] || frequencies.echo;
  oscillator.type = effect === 'vanish' ? 'sine' : 'triangle';
  oscillator.frequency.setValueAtTime(startFrequency, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    context.currentTime + 0.32,
  );
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.38);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.4);
  oscillator.addEventListener('ended', () => context.close());
}

function StartScreen({ progress, onContinue, onNewGame, onChapters, onHowTo }) {
  const hasProgress = progress.unlocked.length > 1 || Object.keys(progress.completed).length > 0;
  const currentLevel = getLevel(progress.currentLevelId);
  return (
    <main className="screen start-screen">
      <img className="opening-illustration" src={assetUrl('assets/art/opening-rabbit-hole.jpg')} alt="" />
      <div className="falling-motes" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
      </div>
      <section className="title-card">
        <p className="kicker">A LITTLE GRAVITY TALE</p>
        <h1>兔子洞<br />尽头</h1>
        <div className="title-divider"><span>◆</span></div>
        <p className="intro">
          {hasProgress ? (
            <>书签停在「{currentLevel.name}」。<br />梦还记得你离开的地方。</>
          ) : (
            <>请握住手机。<br />这个世界会往你倾斜的方向坠落。</>
          )}
        </p>
        <button className="primary-button" onClick={onContinue}>
          {hasProgress ? '继续梦境' : '开始坠落'}
        </button>
        {hasProgress && <button className="secondary-start-button" onClick={onChapters}>打开章节书签</button>}
        <button className="text-button" onClick={onHowTo}>玩法说明</button>
        {hasProgress && <button className="quiet-button" onClick={onNewGame}>从头开始</button>}
      </section>
      <p className="edition">一则关于名字、选择与错误方向的故事</p>
    </main>
  );
}

function PermissionScreen({ onAllow, onFallback, requesting, error }) {
  return (
    <main
      className="screen permission-screen"
      style={{ '--garden-art': `url("${assetUrl('assets/art/dream-garden.jpg')}")` }}
    >
      <img className="permission-rabbit" src={assetUrl('assets/art/white-rabbit.png')} alt="追逐怀表的白兔" />
      <div className="permission-ornament">◜ <span>✦</span> ◝</div>
      <div className="tilt-device" aria-hidden="true"><div className="tiny-maze"><span /></div></div>
      <p className="kicker">BEFORE THE FALL</p>
      <h2>让世界<br />开始倾斜</h2>
      <p className="body-copy">这个游戏需要读取手机的倾斜方向。<br />我们只感知方向，不会收集任何数据。</p>
      {error && <p className="permission-error">{error}</p>}
      <button className="primary-button" onClick={onAllow} disabled={requesting}>
        {requesting ? '世界正在醒来…' : '允许世界倾斜'}
      </button>
      <button className="text-button" onClick={onFallback}>改用触摸控制</button>
      <p className="permission-note">电脑也可使用方向键或 WASD</p>
    </main>
  );
}

function HowTo({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="paper-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="关闭">×</button>
        <p className="kicker">HOW TO FALL</p>
        <h2>每一章只教你<br />一条新规则</h2>
        <div className="instruction-row"><span>↔</span><p>倾斜手机，让爱丽丝头像在玻璃球中滚动</p></div>
        <div className="instruction-row"><span>♙</span><p>观察机关：水流、镜面、印章、茶杯与纸牌</p></div>
        <div className="instruction-row"><span>♛</span><p>寻找兔子浮雕，以更少失误挑战三星评价</p></div>
        <div className="instruction-row"><span>◇</span><p>章节分支、收藏和最佳成绩都会自动保存</p></div>
        <p className="small-copy">进度保存在当前浏览器中。传感器不可用时可使用触摸摇杆。</p>
        <button className="primary-button" onClick={onClose}>我记住了</button>
      </section>
    </div>
  );
}

function ChapterScreen({ progress, onSelect, onBack }) {
  const completedCount = Object.keys(progress.completed).length;
  const chapterTotal = levels.length;
  const curiosityCount = Object.values(progress.curiosities).filter((items) => items?.length).length;
  const storyComplete = Boolean(progress.completed['trial-of-names']);
  return (
    <main
      className="screen chapter-screen"
      style={{ '--garden-art': `url("${assetUrl('assets/art/dream-garden.jpg')}")` }}
    >
      <header className="chapter-header">
        <button className="back-button" onClick={onBack}>←</button>
        <div>
          <p className="kicker">CHAPTER BOOKMARKS</p>
          <h1>梦境书签</h1>
        </div>
        <span>{completedCount}/{chapterTotal}<small>浮雕 {curiosityCount}/{chapterTotal}</small></span>
      </header>
      <div className="progress-track"><i style={{ width: `${Math.min(100, (completedCount / chapterTotal) * 100)}%` }} /></div>
      <section className="chapter-list">
        {levels.map((level) => {
          const unlocked = progress.unlocked.includes(level.id) || (storyComplete && Boolean(level.branch));
          const completed = Boolean(progress.completed[level.id]);
          const chosen = Object.values(progress.choices).includes(level.branch);
          const inaccessibleBranch = level.branch && !unlocked && Object.keys(progress.choices).length > 0 && !chosen;
          const grade = progress.grades[level.id] || 0;
          const foundCuriosity = Boolean(progress.curiosities[level.id]?.length);
          return (
            <button
              key={level.id}
              className={`chapter-card ${completed ? 'completed' : ''} ${unlocked ? '' : 'locked'}`}
              disabled={!unlocked}
              onClick={() => onSelect(level.id)}
            >
              <span className="chapter-number">{String(level.order).padStart(2, '0')}</span>
              <div>
                <small>{level.chapter}{level.branch ? ` · ${level.branchLabel || `${level.branch}支线`}` : ''}</small>
                <strong>{level.name}</strong>
                <em>
                  {unlocked
                    ? `${level.mechanic}${progress.bestTimes[level.id] ? ` · ${formatDuration(progress.bestTimes[level.id])}` : ''}`
                    : inaccessibleBranch ? '另一条梦境支线' : '尚未解锁'}
                </em>
              </div>
              <span className="chapter-reward">
                <b>{grade ? '♛'.repeat(grade) : completed ? '✓' : unlocked ? '→' : '×'}</b>
                <i className={foundCuriosity ? 'found' : ''}>{foundCuriosity ? '◉' : '○'}</i>
              </span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

function Joystick({ gravityRef, horizontalOnly = false }) {
  const padRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX, clientY) => {
    const rect = padRef.current.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const max = rect.width * 0.29;
    const distance = horizontalOnly ? Math.abs(dx) : Math.hypot(dx, dy);
    const ratio = distance > max ? max / distance : 1;
    const x = dx * ratio;
    const y = horizontalOnly ? 0 : dy * ratio;
    setKnob({ x, y });
    gravityRef.current.joystick = { x: x / max, y: y / max };
  };

  const release = () => {
    setKnob({ x: 0, y: 0 });
    gravityRef.current.joystick = { x: 0, y: 0 };
  };

  return (
    <div
      ref={padRef}
      className="joystick"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) update(event.clientX, event.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function PauseModal({ onResume, onRestart, onChapters, onQuit }) {
  return (
    <div className="modal-backdrop">
      <section className="paper-modal compact">
        <p className="kicker">A SMALL PAUSE</p>
        <h2>世界暂时<br />停止倾斜</h2>
        <button className="primary-button" onClick={onResume}>继续寻找</button>
        <button className="secondary-button" onClick={onRestart}>重新开始本关</button>
        <button className="secondary-button" onClick={onChapters}>章节书签</button>
        <button className="text-button" onClick={onQuit}>回到兔子洞口</button>
      </section>
    </div>
  );
}

const storyPortraits = {
  alice: 'assets/art/alice-avatar.png',
  rabbit: 'assets/art/white-rabbit.png',
  key: 'assets/art/rabbit-cameo.png',
  caterpillar: 'assets/art/caterpillar-portrait.jpg',
  hatter: 'assets/art/mad-hatter-portrait.jpg',
  watch: 'assets/art/pocket-watch.png',
  card: 'assets/art/card-guard.png',
  queen: 'assets/art/red-queen-portrait.jpg',
  flamingo: 'assets/art/flamingo-mallet.png',
  cheshire: 'assets/art/cheshire-cat-portrait.png',
};

function StoryPortrait({ portrait }) {
  const source = storyPortraits[portrait] || storyPortraits.alice;
  return <img src={assetUrl(source)} alt="" />;
}

function StoryPanel({ level, index, onAdvance, onSkip }) {
  const scene = level.story?.[index];
  if (!scene) return null;
  const finalScene = index === level.story.length - 1;
  return (
    <div className="modal-backdrop story-backdrop">
      <section className="story-panel">
        <div className="story-chapter">
          <small>{level.eyebrow}</small>
          <strong>{level.name}</strong>
        </div>
        <StoryPortrait portrait={scene.portrait} />
        <div className="story-copy">
          <span>{scene.speaker}</span>
          <p>{scene.text}</p>
        </div>
        <div className="story-progress" aria-label={`剧情 ${index + 1}/${level.story.length}`}>
          {level.story.map((_, sceneIndex) => (
            <i key={sceneIndex} className={sceneIndex <= index ? 'active' : ''} />
          ))}
        </div>
        <button className="primary-button" onClick={onAdvance}>
          {finalScene ? '进入这一章' : '继续听'}
        </button>
        <button className="text-button" onClick={onSkip}>跳过本章剧情</button>
      </section>
    </div>
  );
}

function StoryBeat({ beat, onClose }) {
  if (!beat) return null;
  return (
    <aside className="story-beat" aria-live="polite" onClick={onClose}>
      <StoryPortrait portrait={beat.portrait} />
      <div>
        <strong>{beat.speaker}</strong>
        <p>{beat.text}</p>
      </div>
      <button aria-label="关闭剧情提示">×</button>
    </aside>
  );
}

function LevelInterlude({ level, result, onContinue }) {
  return (
    <div className="modal-backdrop interlude">
      <section className="quote-card">
        <span className="quote-mark">“</span>
        {result && (
          <div className="chapter-result">
            <strong>{'♛'.repeat(result.grade)}</strong>
            <span>{formatDuration(result.duration)} · 失误 {result.deaths}</span>
            <i>{result.foundCuriosity ? '兔子浮雕已收藏' : '兔子浮雕仍藏在本章'}</i>
          </div>
        )}
        <p>{level.quote}</p>
        <div className="title-divider"><span>◆</span></div>
        {level.choices ? (
          <div className="choice-list">
            {level.choices.map((choice) => (
              <button key={choice.id} onClick={() => onContinue(choice)}>
                <strong>{choice.title}</strong>
                <span>{choice.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <button className="text-button light" onClick={() => onContinue(null)}>
            {level.ending ? '说出她的名字' : '翻到下一章 ↓'}
          </button>
        )}
      </section>
    </div>
  );
}

function Ending({ progress, onChapters, onReplay }) {
  const branch = progress.choices['caterpillar-crossroad'];
  const lateBranch = progress.choices['queen-garden'];
  const curiosityCount = Object.values(progress.curiosities).filter((items) => items?.length).length;
  const crownCount = Object.values(progress.grades).reduce((total, grade) => total + grade, 0);
  const foundEveryCameo = curiosityCount === levels.length;
  return (
    <main className="screen ending-screen">
      <div className="dawn" />
      <img className="ending-avatar" src={assetUrl('assets/art/alice-avatar.png')} alt="" />
      <p className="kicker">THE NAME REMEMBERED</p>
      <h2>她终于想起了<br />自己的名字</h2>
      <div className="title-divider dark"><span>◆</span></div>
      <blockquote>
        {foundEveryCameo ? (
          <>所有浮雕在晨光里拼成一只白兔。<br />它终于停下怀表，<br />向她问了自己的名字。</>
        ) : (
          <>
            {branch === 'tea' ? '她带着茶会停住的时间，' : '她带着蘑菇改变的身体，'}<br />
            {lateBranch === 'croquet' ? '也带着槌球场弯曲的规则，' : '也带着镜中黑白交替的道路，'}<br />
            亲口说出了那个<br />
            世界无法替她定义的名字。</>
        )}
      </blockquote>
      <p className="ending-collection">兔子浮雕 {curiosityCount}/{levels.length} · 皇冠 {crownCount}/{levels.length * 3}</p>
      <div className="ending-actions">
        <button className="primary-button dark-button" onClick={onChapters}>重访其他章节</button>
        <button className="text-button dark-text" onClick={onReplay}>从头再做一次选择</button>
      </div>
      <p className="the-end">FIN · 但梦境还有另一条路</p>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState(debugLevelId ? 'game' : 'start');
  const [showHowTo, setShowHowTo] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [controlMode, setControlMode] = useState('keyboard');
  const [progress, setProgress] = useState(loadProgress);
  const [levelId, setLevelId] = useState(() => debugLevelId || loadProgress().currentLevelId);
  const [pendingLevelId, setPendingLevelId] = useState(() => debugLevelId || loadProgress().currentLevelId);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [interlude, setInterlude] = useState(false);
  const [toast, setToast] = useState('');
  const [storyOpen, setStoryOpen] = useState(Boolean(debugLevelId));
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyBeat, setStoryBeat] = useState(null);
  const [seenStoryEvents, setSeenStoryEvents] = useState([]);
  const [collected, setCollected] = useState([]);
  const [activated, setActivated] = useState([]);
  const [rotations, setRotations] = useState({});
  const [phases, setPhases] = useState({});
  const [painted, setPainted] = useState([]);
  const [runDeaths, setRunDeaths] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const inputRef = useRef({
    motion: { x: 0, y: 0 },
    keyboard: { x: 0, y: 0 },
    joystick: { x: 0, y: 0 },
  });
  const gravityRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef(new Set());
  const audioRef = useRef(null);
  const level = useMemo(
    () => getPlayableLevel(levelId, progress.choices),
    [levelId, progress.choices],
  );

  const startMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || musicMuted) return;
    try {
      await audio.play();
      setMusicPlaying(true);
    } catch {
      setMusicPlaying(false);
    }
  }, [musicMuted]);

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicMuted || audio.paused) {
      setMusicMuted(false);
      audio.muted = false;
      try {
        await audio.play();
        setMusicPlaying(true);
      } catch {
        setMusicPlaying(false);
      }
    } else {
      setMusicMuted(true);
      audio.muted = true;
      setMusicPlaying(false);
    }
  };

  const openPermission = async (targetLevelId = progress.currentLevelId) => {
    await startMusic();
    setPendingLevelId(targetLevelId);
    setPermissionError('');
    setScreen('permission');
  };

  const beginGame = useCallback((mode, targetLevelId = pendingLevelId) => {
    const nextProgress = enterLevel(progress, targetLevelId);
    setProgress(nextProgress);
    setControlMode(mode);
    setLevelId(targetLevelId);
    setCollected([]);
    setActivated([]);
    setRotations({});
    setPhases({});
    setPainted([]);
    setRunDeaths(0);
    setLastResult(null);
    setStoryIndex(0);
    setStoryOpen(Boolean(getLevel(targetLevelId).story?.length));
    setStoryBeat(null);
    setSeenStoryEvents([]);
    setPaused(false);
    setResetToken((value) => value + 1);
    setScreen('game');
    emitEvent('game_start', { controlMode: mode, levelId: targetLevelId });
  }, [pendingLevelId, progress]);

  const requestMotion = async () => {
    setRequesting(true);
    setPermissionError('');
    try {
      if (!window.isSecureContext) throw new Error('insecure-context');
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') throw new Error('denied');
      }
      if (typeof DeviceOrientationEvent === 'undefined') throw new Error('unsupported');
      beginGame('motion');
      emitEvent('permission_granted');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'denied';
      if (reason === 'insecure-context') {
        setPermissionError('当前页面使用 HTTP。iPhone 只允许 HTTPS 页面读取倾斜方向。');
      } else if (reason === 'unsupported') {
        setPermissionError('当前浏览器不支持方向传感器，请使用触摸控制。');
      } else {
        setPermissionError('Safari 没有授予倾斜权限，请检查该网站的权限设置。');
      }
      emitEvent('permission_denied', { reason });
    } finally {
      setRequesting(false);
    }
  };

  useEffect(() => {
    const onOrientation = (event) => {
      const gamma = Math.max(-28, Math.min(28, event.gamma || 0)) / 16;
      const betaOffset = window.innerHeight > window.innerWidth ? 35 : 0;
      const beta = Math.max(-28, Math.min(28, (event.beta || 0) - betaOffset)) / 16;
      inputRef.current.motion.x = inputRef.current.motion.x * 0.82 + gamma * 0.18;
      inputRef.current.motion.y = inputRef.current.motion.y * 0.82 + beta * 0.18;
    };
    window.addEventListener('deviceorientation', onOrientation, true);
    return () => window.removeEventListener('deviceorientation', onOrientation, true);
  }, []);

  useEffect(() => {
    const movementKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);
    const onKeyDown = (event) => {
      if (movementKeys.has(event.code)) event.preventDefault();
      keysRef.current.add(event.code);
    };
    const onKeyUp = (event) => keysRef.current.delete(event.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    let frame;
    const tick = () => {
      const keys = keysRef.current;
      inputRef.current.keyboard.x =
        Number(keys.has('ArrowRight') || keys.has('KeyD')) -
        Number(keys.has('ArrowLeft') || keys.has('KeyA'));
      inputRef.current.keyboard.y =
        Number(keys.has('ArrowDown') || keys.has('KeyS')) -
        Number(keys.has('ArrowUp') || keys.has('KeyW'));
      const source =
        controlMode === 'motion'
          ? inputRef.current.motion
          : controlMode === 'joystick'
            ? inputRef.current.joystick
            : inputRef.current.keyboard;
      const keyboardAssist = controlMode === 'keyboard' ? { x: 0, y: 0 } : inputRef.current.keyboard;
      gravityRef.current.x = source.x + keyboardAssist.x;
      gravityRef.current.y = source.y + keyboardAssist.y;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [controlMode]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!storyBeat) return undefined;
    const timeout = setTimeout(() => setStoryBeat(null), 5200);
    return () => clearTimeout(timeout);
  }, [storyBeat]);

  const revealStoryEvent = (eventKey) => {
    if (seenStoryEvents.includes(eventKey)) return;
    const beat = level.eventStories?.[eventKey];
    if (!beat) return;
    setSeenStoryEvents((events) => [...events, eventKey]);
    setStoryBeat(beat);
  };

  const restart = () => {
    setCollected([]);
    setActivated([]);
    setRotations({});
    setPhases({});
    setPainted([]);
    setStoryBeat(null);
    setSeenStoryEvents([]);
    setRunDeaths(0);
    setPaused(false);
    setResetToken((value) => value + 1);
    emitEvent('level_restart', { levelId: level.id });
  };

  const handleCollect = (item) => {
    setCollected((items) => [...items, item]);
    if (item.type === 'curiosity') {
      setProgress((current) => collectCuriosity(current, level.id, item.id));
    }
    if (navigator.vibrate) navigator.vibrate(30);
    const messages = {
      key: '钥匙在你手里轻轻响了一声。',
      potion: '你变小了。世界没有。',
      cookie: '你变大了，连规则也开始后退。',
      fragment: `她想起了：“${item.word}”`,
      checkpoint: '红玫瑰记住了你的位置。',
      paint: '爱丽丝提起了红色油漆桶。',
      timepiece: '帽匠借出的怀表停住了巡逻机关。',
      fan: '白兔的折扇吹开了一条过分狭窄的路。',
      smile: '微笑留了下来，猫却仍然不见踪影。',
      mirrorShard: item.releasesMirror
        ? '定向镜片归位了。左与右终于重新同意彼此。'
        : '一枚倒影碎片从镜层里脱落下来。',
      shield: '支线留下的纪念物正保护着你。',
      curiosity: '你找到了一枚藏起来的兔子浮雕。',
    };
    setToast(messages[item.type] || '机关发出了一声轻响。');
    revealStoryEvent(`collect:${item.id}`);
    revealStoryEvent(`collect:${item.type}`);
    emitEvent('item_collected', { levelId: level.id, itemType: item.type });
  };

  const handlePaint = (rose) => {
    setPainted(rose.paintedIds || []);
    const total = level.paintables?.length || 0;
    const count = rose.paintedIds?.length || 0;
    setToast(rose.checkpoint
      ? `第 ${count} 朵玫瑰红了，并记住了你的位置。`
      : `白玫瑰变红了：${count}/${total}`);
    revealStoryEvent(`paint:${rose.id}`);
    if (navigator.vibrate) navigator.vibrate([20, 25, 20]);
    emitEvent('rose_painted', { levelId: level.id, roseId: rose.id, count });
  };

  const handleBumper = (bumper) => {
    const hoop = level.switches?.find((entry) => entry.id === bumper.targetHoopId);
    setToast(`火烈鸟 ${hoop?.order || ''} 号挥杆：沿金色虚线修正方向！`);
    revealStoryEvent(`bumper:${bumper.id}`);
    if (navigator.vibrate) navigator.vibrate(35);
  };

  const handleSwitch = (trigger) => {
    setActivated(trigger.activeIds || []);
    if (trigger.sequenceStatus === 'needs-bumper') {
      setToast(`这道球门只承认 ${trigger.order} 号火烈鸟击出的球。`);
    } else if (trigger.sequenceStatus === 'wrong-phase') {
      setToast(trigger.wrongPhaseMessage || '这枚棋子属于另一种颜色的世界，先切换棋盘。');
    } else if (trigger.rotationId) {
      setRotations(trigger.rotations || {});
      setToast(trigger.rotationTurn === 1 ? '房间转过了九十度。' : '房间回到了原来的方向。');
    } else if (trigger.phaseId) {
      setPhases(trigger.phases || {});
      setToast(
        trigger.phaseMessages?.[trigger.phaseState] ||
        (trigger.phaseState
          ? trigger.phaseOnMessage || '白棋醒来，前方的镜门改变了位置。'
          : trigger.phaseOffMessage || '黑棋醒来，身后的路被镜面封住。'),
      );
    } else if (trigger.sequenceStatus === 'reset') {
      setToast('顺序错了。镜子把所有印章熄灭了。');
    } else if (trigger.sequenceStatus === 'complete') {
      setToast(trigger.action === 'hoop' ? '第三道球门得分，女王的终点门被迫打开。' : '最后一枚印章回应了你。');
    } else if (trigger.sequenceStatus === 'correct') {
      setToast(trigger.action === 'hoop'
        ? `${trigger.order} 号球门得分，下一段赛道开启。`
        : `顺序正确：${trigger.sequenceIndex}/${trigger.sequenceLength}`);
    } else {
      setToast('一枚印章亮了起来。');
    }
    if (trigger.sequenceStatus !== 'needs-bumper') revealStoryEvent(`switch:${trigger.id}`);
    if (navigator.vibrate) navigator.vibrate(25);
  };

  const handleGiftUsed = (reason) => {
    setToast(reason === 'card'
      ? '支线纪念物挡住了纸牌卫兵的一次冲撞。'
      : '支线纪念物替你挡住了一次危险。');
    if (navigator.vibrate) navigator.vibrate([25, 30, 25]);
  };

  const handleZoneEnter = (zone) => {
    setToast(zone.firstEntry
      ? zone.enterMessage
      : zone.reenterMessage || zone.enterMessage);
    if (navigator.vibrate) navigator.vibrate(zone.firstEntry ? 24 : 12);
    if (!musicMuted) playMirrorZoneCue(zone.effect);
    revealStoryEvent(`zone:${zone.id}`);
    emitEvent('zone_enter', {
      levelId: level.id,
      zoneId: zone.id,
      effect: zone.effect,
      firstEntry: zone.firstEntry,
    });
  };

  const handleDeath = (reason) => {
    setProgress((current) => recordDeath(current, level.id));
    setRunDeaths((count) => count + 1);
    const messages = {
      card: '纸牌卫兵把你送回了玫瑰旁。',
      watch: '怀表追上了你，时间重新开始。',
      hazard: '漩涡把方向揉成了一团。',
      spikes: '三颗心都碎了。兔子洞把你送回了最初的落点。',
      top: '洞顶的尖刺耗尽了三颗心。平台重新洗牌。',
      fall: '你坠过了兔子洞的边界，只好从顶部重新寻找落点。',
    };
    setToast(messages[reason] || messages.hazard);
    if (navigator.vibrate) navigator.vibrate(90);
  };

  const handleDamage = ({ reason, lives }) => {
    const messages = {
      spikes: `你踩中了尖刺平台。还剩 ${lives} 颗心。`,
      top: `世界把你推到了洞顶。还剩 ${lives} 颗心。`,
      fall: `你错过了所有平台。还剩 ${lives} 颗心。`,
    };
    setToast(messages[reason] || messages.fall);
    if (navigator.vibrate) navigator.vibrate([35, 25, 35]);
  };

  const handleComplete = (duration, collectedIds = []) => {
    if (navigator.vibrate) navigator.vibrate([50, 40, 50]);
    const roundedDuration = Math.round(duration);
    const curiosityIds = collectedIds.filter((id) => id.startsWith('cameo-'));
    const foundCuriosity =
      curiosityIds.length > 0 ||
      Boolean(progress.curiosities[level.id]?.length);
    const grade = calculateLevelGrade(level, roundedDuration, runDeaths, foundCuriosity);
    setProgress((current) => completeLevel(current, level, roundedDuration, {
      deaths: runDeaths,
      curiosityIds,
    }));
    setLastResult({
      grade,
      duration: roundedDuration,
      deaths: runDeaths,
      foundCuriosity,
    });
    setInterlude(true);
    emitEvent('level_complete', { levelId: level.id, duration: roundedDuration, grade });
  };

  const continueAfterLevel = (choice) => {
    setInterlude(false);
    if (level.ending) {
      setScreen('ending');
      emitEvent('game_complete');
      return;
    }
    let nextProgress = progress;
    let nextLevelId = level.next?.[0];
    if (choice) {
      nextProgress = chooseBranch(progress, level, choice);
      nextLevelId = choice.next;
    } else if (nextLevelId) {
      nextProgress = enterLevel(progress, nextLevelId);
    }
    setProgress(nextProgress);
    setLevelId(nextLevelId);
    setCollected([]);
    setActivated([]);
    setRotations({});
    setPhases({});
    setPainted([]);
    setRunDeaths(0);
    setLastResult(null);
    setStoryIndex(0);
    setStoryOpen(Boolean(getLevel(nextLevelId).story?.length));
    setStoryBeat(null);
    setSeenStoryEvents([]);
    setResetToken((value) => value + 1);
  };

  const startOver = () => {
    const fresh = clearProgress();
    setProgress(fresh);
    setLevelId(firstLevelId);
    openPermission(firstLevelId);
  };

  let content;
  if (screen === 'start') {
    content = (
      <>
        <StartScreen
          progress={progress}
          onContinue={() => openPermission(progress.currentLevelId)}
          onNewGame={startOver}
          onChapters={() => setScreen('chapters')}
          onHowTo={() => setShowHowTo(true)}
        />
        {showHowTo && <HowTo onClose={() => setShowHowTo(false)} />}
      </>
    );
  } else if (screen === 'permission') {
    content = (
      <PermissionScreen
        onAllow={requestMotion}
        onFallback={() => beginGame('joystick')}
        requesting={requesting}
        error={permissionError}
      />
    );
  } else if (screen === 'chapters') {
    content = (
      <ChapterScreen
        progress={progress}
        onSelect={(id) => openPermission(id)}
        onBack={() => setScreen('start')}
      />
    );
  } else if (screen === 'ending') {
    content = (
      <Ending
        progress={progress}
        onChapters={() => setScreen('chapters')}
        onReplay={startOver}
      />
    );
  } else {
    const fragmentItems = collected.filter((item) => item.type === 'fragment');
    content = (
      <main
        className="game-shell"
        style={{ '--garden-art': `url("${assetUrl('assets/art/dream-garden.jpg')}")` }}
      >
        <header className="game-header">
          <div>
            <p>{level.eyebrow}</p>
            <h1>{level.name}</h1>
          </div>
          <div className="mechanic-badge">{level.mechanic}</div>
          <button className="pause-button" onClick={() => setPaused(true)} aria-label="暂停"><i /><i /></button>
        </header>

        <section className="canvas-frame">
          <GameCanvas
            level={level}
            gravityRef={gravityRef}
            paused={paused || interlude || storyOpen}
            resetToken={resetToken}
            controlMode={controlMode}
            onCollect={handleCollect}
            onPaint={handlePaint}
            onBumper={handleBumper}
            onSwitch={handleSwitch}
            onGiftUsed={handleGiftUsed}
            onZoneEnter={handleZoneEnter}
            onDamage={handleDamage}
            onDeath={handleDeath}
            onLockedDoor={() => setToast(level.lockedHint || '门仍在等待缺少的证据。')}
            onComplete={handleComplete}
          />
          <div className="corner corner-tl" />
          <div className="corner corner-tr" />
          <div className="corner corner-bl" />
          <div className="corner corner-br" />
        </section>

        <footer className="game-footer">
          <div className="hint-line"><span>✦</span><p>{level.hint}</p><span>✦</span></div>
          {(level.goal.requires || level.items?.some((item) => item.type === 'curiosity')) && (
            <div className="objective-strip" aria-label="当前目标">
              {(level.goal.requires?.items || []).map((id) => (
                <span key={id} className={collected.some((item) => item.id === id) ? 'done' : ''}>
                  {collected.some((item) => item.id === id) ? '✓' : '◇'} {
                    level.items?.find((item) => item.id === id)?.label || '道具'
                  }
                </span>
              ))}
              {(level.goal.requires?.switches || []).map((id, index) => {
                const trigger = level.switches?.find((entry) => entry.id === id);
                const label = trigger?.label || (trigger?.action === 'hoop'
                  ? '球门'
                  : trigger?.action === 'phase' ? '棋子' : '印章');
                return (
                  <span key={id} className={activated.includes(id) ? 'done' : ''}>
                    {activated.includes(id) ? '✓' : level.switchSequence ? index + 1 : '○'} {label}
                  </span>
                );
              })}
              {level.goal.requires?.fragments && (
                <span className={fragmentItems.length >= level.goal.requires.fragments ? 'done' : ''}>
                  {fragmentItems.length}/{level.goal.requires.fragments} 名字
                </span>
              )}
              {Object.entries(level.goal.requires?.rotations || {}).map(([id, turn]) => (
                <span key={id} className={rotations[id] === turn ? 'done' : ''}>
                  {rotations[id] === turn ? '✓' : '↻'} 房间
                </span>
              ))}
              {Object.entries(level.goal.requires?.phases || {}).map(([id, phase]) => {
                const currentPhase =
                  phases[id] ??
                  level.phases?.find((entry) => entry.id === id)?.initial ??
                  0;
                return (
                  <span key={id} className={currentPhase === phase ? 'done' : ''}>
                    {currentPhase === phase ? '✓' : level.phaseSymbol || '♟'} {
                      level.phaseLabel || '棋局'
                    }
                  </span>
                );
              })}
              {(level.goal.requires?.painted || []).length > 0 && (
                <span className={painted.length >= level.goal.requires.painted.length ? 'done' : ''}>
                  {painted.length}/{level.goal.requires.painted.length} 玫瑰
                </span>
              )}
              {level.items?.some((item) => item.type === 'curiosity') && (
                <span className={
                  collected.some((item) => item.type === 'curiosity') ||
                  progress.curiosities[level.id]?.length
                    ? 'done'
                    : ''
                }>
                  ◉ 浮雕
                </span>
              )}
            </div>
          )}
          {level.fragments && (
            <div className="fragment-status">
              {level.fragments.map((word) => (
                <span key={word} className={fragmentItems.some((item) => item.word === word) ? 'found' : ''}>
                  {fragmentItems.some((item) => item.word === word) ? word : '？'}
                </span>
              ))}
            </div>
          )}
          <p className="control-label">
            {level.mode === 'fall'
              ? controlMode === 'motion'
                ? '左右倾斜手机选择落点'
                : controlMode === 'joystick'
                  ? '左右拖动圆盘选择落点'
                  : '← → / A D 选择落点'
              : controlMode === 'motion'
                ? '倾斜手机以移动'
                : controlMode === 'joystick'
                  ? '拖动左下角圆盘'
                  : '方向键 / WASD'}
          </p>
        </footer>

        {controlMode === 'joystick' && (
          <Joystick gravityRef={inputRef} horizontalOnly={level.mode === 'fall'} />
        )}
        {toast && <div className="toast">{toast}</div>}
        <StoryBeat beat={storyBeat} onClose={() => setStoryBeat(null)} />
        {paused && (
          <PauseModal
            onResume={() => setPaused(false)}
            onRestart={restart}
            onChapters={() => {
              setPaused(false);
              setScreen('chapters');
            }}
            onQuit={() => {
              setPaused(false);
              setScreen('start');
            }}
          />
        )}
        {storyOpen && (
          <StoryPanel
            level={level}
            index={storyIndex}
            onAdvance={() => {
              if (storyIndex < level.story.length - 1) {
                setStoryIndex((value) => value + 1);
              } else {
                setStoryOpen(false);
              }
            }}
            onSkip={() => setStoryOpen(false)}
          />
        )}
        {interlude && <LevelInterlude level={level} result={lastResult} onContinue={continueAfterLevel} />}
      </main>
    );
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={assetUrl('assets/audio/rabbit-hole-bgm.mp3')}
        loop
        preload="auto"
        volume="0.35"
      />
      <MusicButton muted={musicMuted} playing={musicPlaying} onToggle={toggleMusic} />
      {content}
    </>
  );
}
