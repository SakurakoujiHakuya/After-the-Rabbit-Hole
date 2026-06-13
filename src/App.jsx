import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './GameCanvas';
import { assetUrl } from './assets';
import { firstLevelId, getLevel, levels } from './levels';
import {
  chooseBranch,
  clearProgress,
  completeLevel,
  enterLevel,
  loadProgress,
  recordDeath,
} from './progress';

function emitEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`rabbit-hole:${name}`, { detail }));
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
        <div className="instruction-row"><span>◇</span><p>章节中会出现分支，选择将被自动保存</p></div>
        <p className="small-copy">进度保存在当前浏览器中。传感器不可用时可使用触摸摇杆。</p>
        <button className="primary-button" onClick={onClose}>我记住了</button>
      </section>
    </div>
  );
}

function ChapterScreen({ progress, onSelect, onBack }) {
  const completedCount = Object.keys(progress.completed).length;
  const chapterTotal = levels.length;
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
        <span>{completedCount}/{chapterTotal}</span>
      </header>
      <div className="progress-track"><i style={{ width: `${Math.min(100, (completedCount / chapterTotal) * 100)}%` }} /></div>
      <section className="chapter-list">
        {levels.map((level) => {
          const unlocked = progress.unlocked.includes(level.id) || (storyComplete && Boolean(level.branch));
          const completed = Boolean(progress.completed[level.id]);
          const chosen = Object.values(progress.choices).includes(level.branch);
          const inaccessibleBranch = level.branch && !unlocked && Object.keys(progress.choices).length > 0 && !chosen;
          return (
            <button
              key={level.id}
              className={`chapter-card ${completed ? 'completed' : ''} ${unlocked ? '' : 'locked'}`}
              disabled={!unlocked}
              onClick={() => onSelect(level.id)}
            >
              <span className="chapter-number">{String(level.order).padStart(2, '0')}</span>
              <div>
                <small>{level.chapter}{level.branch ? ` · ${level.branch === 'tea' ? '茶会支线' : '蘑菇支线'}` : ''}</small>
                <strong>{level.name}</strong>
                <em>{unlocked ? level.mechanic : inaccessibleBranch ? '另一条梦境支线' : '尚未解锁'}</em>
              </div>
              <b>{completed ? '✓' : unlocked ? '→' : '×'}</b>
            </button>
          );
        })}
      </section>
    </main>
  );
}

function Joystick({ gravityRef }) {
  const padRef = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX, clientY) => {
    const rect = padRef.current.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const max = rect.width * 0.29;
    const ratio = distance > max ? max / distance : 1;
    const x = dx * ratio;
    const y = dy * ratio;
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

function LevelInterlude({ level, onContinue }) {
  return (
    <div className="modal-backdrop interlude">
      <section className="quote-card">
        <span className="quote-mark">“</span>
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
  return (
    <main className="screen ending-screen">
      <div className="dawn" />
      <img className="ending-avatar" src={assetUrl('assets/art/alice-avatar.png')} alt="" />
      <p className="kicker">THE NAME REMEMBERED</p>
      <h2>她终于想起了<br />自己的名字</h2>
      <div className="title-divider dark"><span>◆</span></div>
      <blockquote>
        {branch === 'tea' ? '她带着茶会停住的时间，' : '她带着蘑菇改变的身体，'}<br />
        亲口说出了那个<br />
        世界无法替她定义的名字。
      </blockquote>
      <div className="ending-actions">
        <button className="primary-button dark-button" onClick={onChapters}>重访其他章节</button>
        <button className="text-button dark-text" onClick={onReplay}>从头再做一次选择</button>
      </div>
      <p className="the-end">FIN · 但梦境还有另一条路</p>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState('start');
  const [showHowTo, setShowHowTo] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [controlMode, setControlMode] = useState('keyboard');
  const [progress, setProgress] = useState(loadProgress);
  const [levelId, setLevelId] = useState(() => loadProgress().currentLevelId);
  const [pendingLevelId, setPendingLevelId] = useState(() => loadProgress().currentLevelId);
  const [paused, setPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [interlude, setInterlude] = useState(false);
  const [toast, setToast] = useState('');
  const [collected, setCollected] = useState([]);
  const inputRef = useRef({
    motion: { x: 0, y: 0 },
    keyboard: { x: 0, y: 0 },
    joystick: { x: 0, y: 0 },
  });
  const gravityRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef(new Set());
  const audioRef = useRef(null);
  const level = getLevel(levelId);

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

  const restart = () => {
    setCollected([]);
    setPaused(false);
    setResetToken((value) => value + 1);
    emitEvent('level_restart', { levelId: level.id });
  };

  const handleCollect = (item) => {
    setCollected((items) => [...items, item]);
    if (navigator.vibrate) navigator.vibrate(30);
    const messages = {
      key: '钥匙在你手里轻轻响了一声。',
      potion: '你变小了。世界没有。',
      cookie: '你变大了，连规则也开始后退。',
      fragment: `她想起了：“${item.word}”`,
      checkpoint: '红玫瑰记住了你的位置。',
    };
    setToast(messages[item.type] || '机关发出了一声轻响。');
    emitEvent('item_collected', { levelId: level.id, itemType: item.type });
  };

  const handleSwitch = () => {
    setToast('一枚印章亮了起来。');
    if (navigator.vibrate) navigator.vibrate(25);
  };

  const handleDeath = (reason) => {
    const nextProgress = recordDeath(progress, level.id);
    setProgress(nextProgress);
    setToast(reason === 'card' ? '纸牌卫兵把你送回了玫瑰旁。' : '漩涡把方向揉成了一团。');
    if (navigator.vibrate) navigator.vibrate(90);
  };

  const handleComplete = (duration) => {
    if (navigator.vibrate) navigator.vibrate([50, 40, 50]);
    const nextProgress = completeLevel(progress, level, Math.round(duration));
    setProgress(nextProgress);
    setInterlude(true);
    emitEvent('level_complete', { levelId: level.id, duration: Math.round(duration) });
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
            paused={paused || interlude}
            resetToken={resetToken}
            onCollect={handleCollect}
            onSwitch={handleSwitch}
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
            {controlMode === 'motion' ? '倾斜手机以移动' : controlMode === 'joystick' ? '拖动左下角圆盘' : '方向键 / WASD'}
          </p>
        </footer>

        {controlMode === 'joystick' && <Joystick gravityRef={inputRef} />}
        {toast && <div className="toast">{toast}</div>}
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
        {interlude && <LevelInterlude level={level} onContinue={continueAfterLevel} />}
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
