import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './GameCanvas';
import { levels } from './levels';

function emitEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(`rabbit-hole:${name}`, { detail }));
}

function StartScreen({ onStart, onHowTo }) {
  return (
    <main className="screen start-screen">
      <div className="falling-motes" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => <i key={index} />)}
      </div>
      <div className="start-art" aria-hidden="true">
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="key-silhouette">⚿</span>
        <div className="rabbit-hole"><div className="memory-pearl" /></div>
      </div>
      <section className="title-card">
        <p className="kicker">A LITTLE GRAVITY TALE</p>
        <h1>兔子洞<br />尽头</h1>
        <div className="title-divider"><span>◆</span></div>
        <p className="intro">请握住手机。<br />这个世界会往你倾斜的方向坠落。</p>
        <button className="primary-button" onClick={onStart}>开始坠落</button>
        <button className="text-button" onClick={onHowTo}>玩法说明</button>
      </section>
      <p className="edition">一则关于名字、门与错误方向的故事</p>
    </main>
  );
}

function PermissionScreen({ onAllow, onFallback, requesting, error }) {
  return (
    <main className="screen permission-screen">
      <div className="permission-ornament">◜ <span>✦</span> ◝</div>
      <div className="tilt-device" aria-hidden="true">
        <div className="tiny-maze"><span /></div>
      </div>
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
        <h2>倾斜一个<br />不讲道理的世界</h2>
        <div className="instruction-row"><span>↔</span><p>左右倾斜，控制记忆珠滚动</p></div>
        <div className="instruction-row"><span>↕</span><p>前后倾斜，寻找迷宫的门</p></div>
        <div className="instruction-row"><span>◇</span><p>拾取钥匙、药水与名字碎片</p></div>
        <p className="small-copy">传感器不可用时，屏幕左下角会出现触摸摇杆。</p>
        <button className="primary-button" onClick={onClose}>我记住了</button>
      </section>
    </div>
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
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          update(event.clientX, event.clientY);
        }
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function PauseModal({ onResume, onRestart, onQuit }) {
  return (
    <div className="modal-backdrop">
      <section className="paper-modal compact">
        <p className="kicker">A SMALL PAUSE</p>
        <h2>世界暂时<br />停止倾斜</h2>
        <button className="primary-button" onClick={onResume}>继续寻找</button>
        <button className="secondary-button" onClick={onRestart}>重新开始本关</button>
        <button className="text-button" onClick={onQuit}>回到兔子洞口</button>
      </section>
    </div>
  );
}

function LevelInterlude({ level, onContinue, isLast }) {
  return (
    <div className="modal-backdrop interlude">
      <section className="quote-card">
        <span className="quote-mark">“</span>
        <p>{level.quote}</p>
        <div className="title-divider"><span>◆</span></div>
        <button className="text-button light" onClick={onContinue}>
          {isLast ? '说出她的名字' : '继续坠落 ↓'}
        </button>
      </section>
    </div>
  );
}

function Ending({ onReplay }) {
  const share = async () => {
    const data = {
      title: '兔子洞尽头',
      text: '我穿过了不讲道理的花园，也找回了遗失的名字。',
      url: window.location.href,
    };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else await navigator.clipboard?.writeText(window.location.href);
  };

  return (
    <main className="screen ending-screen">
      <div className="dawn" />
      <div className="ending-star">✦</div>
      <p className="kicker">THE NAME REMEMBERED</p>
      <h2>她终于想起了<br />自己的名字</h2>
      <div className="title-divider dark"><span>◆</span></div>
      <blockquote>
        出口并不在门后。<br />
        出口在她重新说出<br />
        自己名字的那一刻。
      </blockquote>
      <div className="ending-actions">
        <button className="primary-button dark-button" onClick={onReplay}>再坠落一次</button>
        <button className="text-button dark-text" onClick={share}>分享这段梦</button>
      </div>
      <p className="the-end">FIN · 兔子洞尽头</p>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState('start');
  const [showHowTo, setShowHowTo] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [controlMode, setControlMode] = useState('keyboard');
  const [levelIndex, setLevelIndex] = useState(0);
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
  const level = levels[levelIndex];

  const beginGame = useCallback((mode) => {
    setControlMode(mode);
    setLevelIndex(0);
    setCollected([]);
    setScreen('game');
    emitEvent('game_start', { controlMode: mode });
  }, []);

  const requestMotion = async () => {
    setRequesting(true);
    setPermissionError('');
    try {
      if (!window.isSecureContext) {
        throw new Error('insecure-context');
      }
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') throw new Error('denied');
      }
      if (typeof DeviceOrientationEvent === 'undefined') throw new Error('unsupported');
      setControlMode('motion');
      beginGame('motion');
      emitEvent('permission_granted');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'denied';
      if (reason === 'insecure-context') {
        setPermissionError('当前页面使用 HTTP。iPhone 只允许 HTTPS 页面读取倾斜方向，请改用 HTTPS 地址，或暂时使用触摸控制。');
      } else if (reason === 'unsupported') {
        setPermissionError('当前浏览器不支持方向传感器，请使用触摸控制。');
      } else {
        setPermissionError('Safari 没有授予倾斜权限。请检查该网站的权限设置，或使用触摸控制。');
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
      const keyboard = inputRef.current.keyboard;
      gravityRef.current.x = source.x + keyboard.x;
      gravityRef.current.y = source.y + keyboard.y;
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
      fragment: `她想起了：“${item.word}”`,
    };
    setToast(messages[item.type]);
    emitEvent('item_collected', { levelId: level.id, itemType: item.type });
  };

  const handleComplete = (duration) => {
    if (navigator.vibrate) navigator.vibrate([50, 40, 50]);
    setInterlude(true);
    emitEvent('level_complete', { levelId: level.id, duration: Math.round(duration) });
  };

  const continueAfterLevel = () => {
    setInterlude(false);
    if (levelIndex === levels.length - 1) {
      setScreen('ending');
      emitEvent('game_complete');
      return;
    }
    setLevelIndex((value) => value + 1);
    setCollected([]);
    setResetToken((value) => value + 1);
  };

  if (screen === 'start') {
    return (
      <>
        <StartScreen onStart={() => setScreen('permission')} onHowTo={() => setShowHowTo(true)} />
        {showHowTo && <HowTo onClose={() => setShowHowTo(false)} />}
      </>
    );
  }

  if (screen === 'permission') {
    return (
      <PermissionScreen
        onAllow={requestMotion}
        onFallback={() => beginGame('joystick')}
        requesting={requesting}
        error={permissionError}
      />
    );
  }

  if (screen === 'ending') {
    return <Ending onReplay={() => setScreen('start')} />;
  }

  const fragmentItems = collected.filter((item) => item.type === 'fragment');
  return (
    <main className="game-shell">
      <header className="game-header">
        <div>
          <p>{level.eyebrow}</p>
          <h1>{level.name}</h1>
        </div>
        <button className="pause-button" onClick={() => setPaused(true)} aria-label="暂停">
          <i /><i />
        </button>
      </header>

      <section className="canvas-frame">
        <GameCanvas
          level={level}
          gravityRef={gravityRef}
          paused={paused || interlude}
          resetToken={resetToken}
          onCollect={handleCollect}
          onLockedDoor={() => setToast(level.lockedHint || '门仍在等你找回缺少的东西。')}
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
          onQuit={() => {
            setPaused(false);
            setScreen('start');
          }}
        />
      )}
      {interlude && (
        <LevelInterlude
          level={level}
          onContinue={continueAfterLevel}
          isLast={levelIndex === levels.length - 1}
        />
      )}
    </main>
  );
}
