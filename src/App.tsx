import { useEffect, useRef, useState, useCallback } from 'react';
import { createGameState, step, render, resizeGame, startGame, type GameState, type GameMode, type NetMessage, type Input } from './game/engine';
import { loadScores, addScore, clearScores } from './game/scores';
import type { ScoreEntry } from './game/types';
import { createPeer, type PeerJSInstance, type DataConnection } from './game/net';

const STORAGE_NAME = 'slapdash_player_name_v1';
const STORAGE_NAME2 = 'slapdash_player_name2_v1';

type ScreenState = 'menu' | 'modeSelect' | 'charSelect' | 'lobby' | 'playing' | 'paused' | 'result';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const input1Ref = useRef<Input>({ move: { x: 0, y: 0 }, action: false, pause: false, hide: false });
  const input2Ref = useRef<Input>({ move: { x: 0, y: 0 }, action: false, pause: false, hide: false });
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // touch refs
  const touch1BaseRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const touch1SlapRef = useRef<number | null>(null);
  const touch2BaseRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const touch2SlapRef = useRef<number | null>(null);

  // network
  const peerRef = useRef<PeerJSInstance | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const [connStatus, setConnStatus] = useState<'idle' | 'connecting' | 'waiting' | 'connected' | 'error'>('idle');
  const [connError, setConnError] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [roomPassword, setRoomPassword] = useState<string>('');
  const [joinPassword, setJoinPassword] = useState<string>('');
  const [roomName, setRoomName] = useState<string>('My Room');

  const [screen, setScreen] = useState<ScreenState>('menu');
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<GameMode>('cpu');
  const [p1Name, setP1Name] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_NAME) || 'Player 1'; } catch { return 'Player 1'; }
  });
  const [p2Name, setP2Name] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_NAME2) || 'Player 2'; } catch { return 'Player 2'; }
  });
  const [p1Char, setP1Char] = useState<'boy' | 'girl'>('boy');
  const [p2Char, setP2Char] = useState<'boy' | 'girl'>('girl');
  // game duration per turn: 10s, 20s, 30s, 1min (60s), 5min (300s), 10min (600s)
  type Duration = 10 | 20 | 30 | 60 | 300 | 600;
  const [turnDuration, setTurnDuration] = useState<Duration>(20);
  const [scores, setScores] = useState<ScoreEntry[]>(loadScores());
  const [lastResult, setLastResult] = useState<{ winner: 'p1' | 'p2' | 'tie'; diff: number; p1: number; p2: number } | null>(null);
  const [showScores, setShowScores] = useState(false);
  const [isNewHigh, setIsNewHigh] = useState(false);

  // Save names when changed
  useEffect(() => { try { localStorage.setItem(STORAGE_NAME, p1Name); } catch {} }, [p1Name]);
  useEffect(() => { try { localStorage.setItem(STORAGE_NAME2, p2Name); } catch {} }, [p2Name]);

  // init canvas
  useEffect(() => {
    const canvas = canvasRef.current!;
    const container = containerRef.current!;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!stateRef.current) {
        stateRef.current = createGameState(rect.width, rect.height);
      } else {
        resizeGame(stateRef.current, rect.width, rect.height);
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const loop = (t: number) => {
      const last = lastTimeRef.current || t;
      let dt = (t - last) / 1000;
      if (dt > 0.1) dt = 0.1;
      lastTimeRef.current = t;
      const s = stateRef.current!;
      s.input1 = input1Ref.current;
      s.input2 = input2Ref.current;
      step(s, dt);
      render(ctx, s, t);

      // Network sync (host authoritative, sends state to guest)
      if (s.mode === 'online' && s.netReady) {
        if (s.isOnlineHost && connRef.current && connRef.current.open) {
          const snap = {
            type: 'state' as const,
            p1: { pos: s.p1.pos, vel: s.p1.vel, facing: s.p1.facing, slapAnim: s.p1.slapAnim, hitFlash: s.p1.hitFlash, isMoving: s.p1.isMoving, isChaser: s.p1.isChaser, character: s.p1.character, name: s.p1.name, hidden: s.p1.hidden, score: s.p1Score },
            p2: { pos: s.p2.pos, vel: s.p2.vel, facing: s.p2.facing, slapAnim: s.p2.slapAnim, hitFlash: s.p2.hitFlash, isMoving: s.p2.isMoving, isChaser: s.p2.isChaser, character: s.p2.character, name: s.p2.name, hidden: s.p2.hidden, score: s.p2Score },
            timeLeft: s.timeLeft, currentTurn: s.currentTurn, phase: s.phase, countdown: s.countdown,
            result: s.turnResult ? { winner: s.turnResult.winner, diff: s.turnResult.diff, p1Score: s.p1Score, p2Score: s.p2Score } : null,
          };
          try { connRef.current.send(JSON.stringify(snap)); } catch {}
        }
      }

      if (s.phase === 'result' && screen !== 'result') {
        const r = s.turnResult;
        if (r) {
          setLastResult({ winner: r.winner, diff: Math.abs(r.diff), p1: s.p1Score, p2: s.p2Score });
          setScreen('result');
        }
      }
      if (s.phase === 'paused' && screen !== 'paused') {
        setScreen('paused');
      }
      setTick((x) => (x + 1) % 1000000);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Keyboard handling ---
  useEffect(() => {
    const pressed = new Set<string>();
    const compute = () => {
      // Player 1: WASD/Arrows + Space/J
      let m1x = 0, m1y = 0;
      if (pressed.has('KeyW') || pressed.has('ArrowUp')) m1y -= 1;
      if (pressed.has('KeyS') || pressed.has('ArrowDown')) m1y += 1;
      if (pressed.has('KeyA') || pressed.has('ArrowLeft')) m1x -= 1;
      if (pressed.has('KeyD') || pressed.has('ArrowRight')) m1x += 1;
      input1Ref.current.move = { x: m1x, y: m1y };
      // Player 2 (local): IJKL + Enter
      let m2x = 0, m2y = 0;
      if (pressed.has('KeyI')) m2y -= 1;
      if (pressed.has('KeyK')) m2y += 1;
      if (pressed.has('KeyJ')) m2x -= 1;
      if (pressed.has('KeyL')) m2x += 1;
      input2Ref.current.move = { x: m2x, y: m2y };
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      pressed.add(e.code);
      // prevent scroll on movement keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space' || e.code === 'KeyF') {
        input1Ref.current.action = true;
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        input2Ref.current.action = true;
      }
      if (e.code === 'KeyH') {
        input1Ref.current.hide = true;
      }
      if (e.code === 'ShiftRight' || e.code === 'ShiftLeft') {
        input2Ref.current.hide = true;
      }
      // Pause
      if (e.code === 'KeyP' || e.code === 'Escape') {
        const s = stateRef.current;
        if (s) {
          if (s.phase === 'turn1' || s.phase === 'turn2') {
            s.prevPhase = s.phase;
            s.phase = 'paused';
            setScreen('paused');
          } else if (s.phase === 'paused') {
            s.phase = s.prevPhase;
            setScreen('playing');
          }
        }
      }
      // Start
      if (e.code === 'Enter' || e.code === 'Space') {
        if (screen === 'menu') {
          // do nothing
        } else if (screen === 'paused') {
          const s = stateRef.current;
          if (s) { s.phase = s.prevPhase; setScreen('playing'); }
        } else if (screen === 'result') {
          // restart handled by button
        }
      }
      compute();
    };
    const onUp = (e: KeyboardEvent) => {
      pressed.delete(e.code);
      if (e.code === 'Space' || e.code === 'KeyF') input1Ref.current.action = false;
      if (e.code === 'Enter' || e.code === 'NumpadEnter') input2Ref.current.action = false;
      if (e.code === 'KeyH') input1Ref.current.hide = false;
      if (e.code === 'ShiftRight' || e.code === 'ShiftLeft') input2Ref.current.hide = false;
      compute();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [screen]);

  // Touch handling: split screen into regions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const rect = canvas.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        const isRightSide = x > rect.width / 2;
        // For local multiplayer, split vertically into 2 halves
        const inTopHalf = y < rect.height / 2;
        if (isRightSide) {
          // slap
          if (inTopHalf) {
            if (touch1SlapRef.current === null) {
              touch1SlapRef.current = t.identifier;
              input1Ref.current.action = true;
            }
          } else {
            if (touch2SlapRef.current === null) {
              touch2SlapRef.current = t.identifier;
              input2Ref.current.action = true;
            }
          }
        } else {
          // joystick
          if (inTopHalf) {
            if (touch1BaseRef.current === null) {
              touch1BaseRef.current = { x, y, id: t.identifier };
              const s = stateRef.current;
              if (s) {
                s.joystick1.active = true;
                s.joystick1.x = x; s.joystick1.y = y;
                s.joystick1.dx = 0; s.joystick1.dy = 0;
                s.joystick1.touchId = t.identifier;
              }
            }
          } else {
            if (touch2BaseRef.current === null) {
              touch2BaseRef.current = { x, y, id: t.identifier };
              const s = stateRef.current;
              if (s) {
                s.joystick2.active = true;
                s.joystick2.x = x; s.joystick2.y = y;
                s.joystick2.dx = 0; s.joystick2.dy = 0;
                s.joystick2.touchId = t.identifier;
              }
            }
          }
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const rect = canvas.getBoundingClientRect();
        const x = t.clientX - rect.left;
        const y = t.clientY - rect.top;
        if (touch1BaseRef.current && t.identifier === touch1BaseRef.current.id) {
          const dx = x - touch1BaseRef.current.x;
          const dy = y - touch1BaseRef.current.y;
          const max = 60;
          const len = Math.hypot(dx, dy);
          const cdx = len > max ? (dx / len) * max : dx;
          const cdy = len > max ? (dy / len) * max : dy;
          const s = stateRef.current;
          if (s) { s.joystick1.dx = cdx; s.joystick1.dy = cdy; }
          input1Ref.current.move = { x: cdx / max, y: cdy / max };
          // hide if joystick near center and pressed
        }
        if (touch2BaseRef.current && t.identifier === touch2BaseRef.current.id) {
          const dx = x - touch2BaseRef.current.x;
          const dy = y - touch2BaseRef.current.y;
          const max = 60;
          const len = Math.hypot(dx, dy);
          const cdx = len > max ? (dx / len) * max : dx;
          const cdy = len > max ? (dy / len) * max : dy;
          const s = stateRef.current;
          if (s) { s.joystick2.dx = cdx; s.joystick2.dy = cdy; }
          input2Ref.current.move = { x: cdx / max, y: cdy / max };
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (touch1BaseRef.current && t.identifier === touch1BaseRef.current.id) {
          touch1BaseRef.current = null;
          const s = stateRef.current;
          if (s) { s.joystick1.active = false; s.joystick1.dx = 0; s.joystick1.dy = 0; }
          input1Ref.current.move = { x: 0, y: 0 };
        }
        if (touch2BaseRef.current && t.identifier === touch2BaseRef.current.id) {
          touch2BaseRef.current = null;
          const s = stateRef.current;
          if (s) { s.joystick2.active = false; s.joystick2.dx = 0; s.joystick2.dy = 0; }
          input2Ref.current.move = { x: 0, y: 0 };
        }
        if (touch1SlapRef.current !== null && t.identifier === touch1SlapRef.current) {
          touch1SlapRef.current = null;
          input1Ref.current.action = false;
        }
        if (touch2SlapRef.current !== null && t.identifier === touch2SlapRef.current) {
          touch2SlapRef.current = null;
          input2Ref.current.action = false;
        }
      }
    };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart as any);
      canvas.removeEventListener('touchmove', onTouchMove as any);
      canvas.removeEventListener('touchend', onTouchEnd as any);
      canvas.removeEventListener('touchcancel', onTouchEnd as any);
    };
  }, []);

  // Network message handler is set up in createRoom / joinRoom.

  const handleNetMessage = useCallback((msg: NetMessage) => {
    const s = stateRef.current;
    if (!s) return;
    if (msg.type === 'hello') {
      // remote player joined; for guest, this is the host info; for host, this is the joiner
      if (s.isOnlineHost) {
        // host stores remote info
        s.remoteName = msg.name;
        s.remoteCharacter = msg.character;
        // set the joining player as p2 (non-host)
        s.p2.name = msg.name;
        s.p2.character = msg.character;
        s.p2.isLocal = false;
        s.p1.isLocal = true;
        s.netReady = true;
        setConnStatus('connected');
        // start game
        startGame(s);
        setScreen('playing');
      }
    } else if (msg.type === 'input') {
      // host receives guest's input; apply to non-host player
      if (s.isOnlineHost) {
        if (s.p2.isLocal === false) s.input2 = { move: msg.move, action: msg.action, pause: false, hide: msg.hide };
      }
    } else if (msg.type === 'state') {
      // guest receives host's state; sync our local state for remote (host) player
      if (!s.isOnlineHost) {
        const prevPhase = s.phase;
        // host is p1 from guest's perspective
        s.p1.pos = msg.p1.pos;
        s.p1.vel = msg.p1.vel;
        s.p1.facing = msg.p1.facing;
        s.p1.slapAnim = msg.p1.slapAnim;
        s.p1.hitFlash = msg.p1.hitFlash;
        s.p1.isMoving = msg.p1.isMoving;
        s.p1.isChaser = msg.p1.isChaser;
        s.p1.hidden = msg.p1.hidden;
        s.p1Score = msg.p1.score;
        s.timeLeft = msg.timeLeft;
        s.currentTurn = msg.currentTurn;
        s.phase = msg.phase as any;
        s.countdown = msg.countdown;
        // If game is starting or in progress, switch to playing screen
        if (prevPhase !== msg.phase && (msg.phase === 'countdown' || msg.phase === 'turn1' || msg.phase === 'turn2')) {
          setScreen((curr) => curr === 'lobby' ? 'playing' : curr);
        }
        if (msg.phase === 'result' && prevPhase !== 'result') {
          const r = (msg as any).result;
          if (r) {
            setLastResult({ winner: r.winner, diff: Math.abs(r.diff), p1: r.p1Score, p2: r.p2Score });
          } else {
            setLastResult({ winner: 'p1', diff: 0, p1: msg.p1.score, p2: msg.p2.score });
          }
          setScreen('result');
        }
      }
    } else if (msg.type === 'chat') {
      s.chat.push({ from: s.remoteName || 'Peer', text: msg.text, time: 4 });
    }
    // Trigger re-render
    setTick((x) => (x + 1) % 1000000);
  }, []);

  // send input from guest to host
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || s.mode !== 'online' || s.isOnlineHost) return;
      if (!connRef.current || !connRef.current.open) return;
      // guest is p2; send input2
      const msg: NetMessage = { type: 'input', move: input2Ref.current.move, action: input2Ref.current.action, hide: input2Ref.current.hide || false };
      try { connRef.current.send(JSON.stringify(msg)); } catch {}
    }, 50);
    return () => clearInterval(id);
  }, []);

  // ---- Mode selection helpers ----
  const goToCharSelect = (m: GameMode) => {
    setMode(m);
    setScreen('charSelect');
  };

  const startLocalGame = () => {
    const s = stateRef.current;
    if (!s) return;
    s.mode = mode;
    s.p1.name = p1Name.slice(0, 12) || 'Player 1';
    s.p2.name = p2Name.slice(0, 12) || 'Player 2';
    s.p1.character = p1Char;
    s.p2.character = p2Char;
    s.p1.isLocal = true;
    s.p2.isLocal = true;
    s.p1.isChaser = false;
    s.p2.isChaser = true;
    s.p2.isHuman = mode === 'local' ? true : false;
    s.turnTimeLimit = turnDuration;
    startGame(s);
    setScreen('playing');
  };

  const startCPUGame = () => {
    const s = stateRef.current;
    if (!s) return;
    s.mode = 'cpu';
    s.p1.name = p1Name.slice(0, 12) || 'You';
    s.p2.name = 'Computer';
    s.p1.character = p1Char;
    s.p2.character = p1Char === 'boy' ? 'girl' : 'boy';
    s.p1.isLocal = true;
    s.p2.isLocal = false;
    s.p1.isChaser = false;
    s.p2.isChaser = true;
    s.p2.isHuman = false;
    s.turnTimeLimit = turnDuration;
    startGame(s);
    setScreen('playing');
  };

  // Expected password for the host (set when room is created)
  const [hostExpectedPassword, setHostExpectedPassword] = useState<string>('');

  const createRoom = async () => {
    if (!roomName.trim()) {
      setConnError('Please enter a room name');
      return;
    }
    if (!roomPassword.trim()) {
      setConnError('Please set a password');
      return;
    }
    setConnError('');
    setConnStatus('connecting');
    setHostExpectedPassword(roomPassword);
    try {
      const peer = await createPeer();
      peerRef.current = peer;
      peer.on('open', (id: string) => {
        // Display the full peer ID as the room code (formatted for readability)
        setRoomCode(id);
        setConnStatus('waiting');
        peer.on('connection', (conn: DataConnection) => {
          connRef.current = conn;
          conn.on('open', () => {
            const s = stateRef.current;
            if (!s) return;
            s.mode = 'online';
            s.isOnlineHost = true;
            s.p1.name = p1Name.slice(0, 12) || 'Host';
            s.p1.character = p1Char;
            s.p1.isLocal = true;
            s.p2.name = 'Peer';
            s.p2.character = p2Char === p1Char ? (p1Char === 'boy' ? 'girl' : 'boy') : p2Char;
            s.p2.isLocal = false;
            conn.on('data', (data: any) => {
              try {
                const msg: NetMessage = typeof data === 'string' ? JSON.parse(data) : data;
                if (msg.type === 'hello') {
                  // verify password
                  const pw = (msg as any).password;
                  if (pw !== hostExpectedPassword) {
                    setConnError('Wrong password');
                    setConnStatus('error');
                    try { conn.close(); } catch {}
                    return;
                  }
                  s.p2.name = msg.name;
                  s.p2.character = msg.character;
                  s.p2.isLocal = false;
                  s.p1.isLocal = true;
                  s.netReady = true;
                  setConnStatus('connected');
                  // reply with our hello + start the game
                  conn.send(JSON.stringify({ type: 'hello', name: s.p1.name, character: s.p1.character } as NetMessage));
                  s.turnTimeLimit = turnDuration;
                  startGame(s);
                  setScreen('playing');
                } else {
                  handleNetMessage(msg);
                }
              } catch {}
            });
            conn.on('close', () => {
              setConnStatus('idle');
              setConnError('Peer disconnected');
            });
          });
        });
        peer.on('error', (err: any) => {
          setConnStatus('error');
          setConnError(err?.message || 'Peer error');
        });
      });
    } catch (e: any) {
      setConnStatus('error');
      setConnError(e?.message || 'Failed to create room');
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim();
    if (!code) {
      setConnError('Please enter a room code');
      return;
    }
    if (!joinPassword.trim()) {
      setConnError('Please enter the password');
      return;
    }
    setConnError('');
    setConnStatus('connecting');
    try {
      const peer = await createPeer();
      peerRef.current = peer;
      peer.on('open', () => {
        const conn = peer.connect(code, { reliable: true });
        connRef.current = conn;
        conn.on('open', () => {
          const s = stateRef.current;
          if (!s) return;
          s.mode = 'online';
          s.isOnlineHost = false;
          s.p2.name = p2Name.slice(0, 12) || 'Guest';
          s.p2.character = p2Char;
          s.p2.isLocal = true;
          s.p1.name = 'Host';
          s.p1.character = p1Char === p2Char ? (p2Char === 'boy' ? 'girl' : 'boy') : p1Char;
          s.p1.isLocal = false;
          // Send hello with password (host will verify)
          conn.send(JSON.stringify({ type: 'hello', name: s.p2.name, character: s.p2.character, password: joinPassword } as any));
          // Set up message handler
          conn.on('data', (data: any) => {
            try {
              const msg: NetMessage = typeof data === 'string' ? JSON.parse(data) : data;
              handleNetMessage(msg);
              // For guest, also need to know when game starts
              if (msg.type === 'state' && s.phase !== (msg as any).phase) {
                if (msg.phase === 'countdown' || msg.phase === 'turn1' || msg.phase === 'turn2') {
                  if (screen !== 'playing') setScreen('playing');
                }
              }
            } catch {}
          });
          conn.on('close', () => {
            setConnStatus('idle');
            setConnError('Disconnected');
          });
          setConnStatus('connected');
        });
        conn.on('error', (err: any) => {
          setConnStatus('error');
          setConnError(err?.message || 'Connection failed');
        });
      });
      peer.on('error', (err: any) => {
        setConnStatus('error');
        setConnError(err?.message || 'Peer error');
      });
    } catch (e: any) {
      setConnStatus('error');
      setConnError(e?.message || 'Failed to join');
    }
  };

  const leaveRoom = () => {
    try { connRef.current?.close(); } catch {}
    try { peerRef.current?.destroy(); } catch {}
    connRef.current = null;
    peerRef.current = null;
    setConnStatus('idle');
    setConnError('');
    setRoomCode('');
    setJoinCode('');
  };

  const handlePause = () => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === 'turn1' || s.phase === 'turn2') {
      s.prevPhase = s.phase;
      s.phase = 'paused';
      setScreen('paused');
    }
  };
  const handleResume = () => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === 'paused') {
      s.phase = s.prevPhase;
      setScreen('playing');
    }
  };
  const handleStart = () => {
    const s = stateRef.current;
    if (!s) return;
    startGame(s);
    setScreen('playing');
    setLastResult(null);
    setIsNewHigh(false);
  };
  const handleMenu = () => {
    leaveRoom();
    // reset engine state so the loop doesn't keep re-triggering result
    const s = stateRef.current;
    if (s) {
      s.phase = 'menu';
      s.turnResult = null;
    }
    setLastResult(null);
    setScreen('menu');
  };

  // When result, save score
  useEffect(() => {
    if (screen === 'result' && lastResult) {
      const winnerScore = Math.max(lastResult.p1, lastResult.p2);
      const winnerName = lastResult.p1 > lastResult.p2 ? p1Name : (lastResult.p2 > lastResult.p1 ? (mode === 'cpu' ? 'Computer' : p2Name) : 'Tie');
      const prevMin = scores.length < 10 ? -1 : scores[scores.length - 1].score;
      const willBeHigh = winnerScore > prevMin;
      if (willBeHigh && mode === 'cpu') {
        const updated = addScore({ name: winnerName.slice(0, 12) || 'You', score: winnerScore, date: new Date().toLocaleDateString(), mode });
        setScores(updated);
        setIsNewHigh(true);
      } else {
        setIsNewHigh(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const live = stateRef.current;
  const hud = live ? {
    p1Score: live.p1Score,
    p2Score: live.p2Score,
    p1Name: live.p1.name,
    p2Name: live.p2.name,
    p1Char: live.p1.character,
    p2Char: live.p2.character,
    timeLeft: Math.ceil(live.timeLeft),
    turnTimeLimit: live.turnTimeLimit,
    phase: live.phase,
    countdown: Math.ceil(live.countdown),
    currentTurn: live.currentTurn,
    mode: live.mode,
    p1HideTime: live.p1.hideTimeLeft,
    p1HideCooldown: live.p1.hideCooldown,
    p1Hidden: live.p1.hidden,
    p1Safe: live.p1.safe,
    p1SafeTime: live.p1.safeTimeLeft,
    p1SafeCooldown: live.p1.safeCooldown,
    p2HideTime: live.p2.hideTimeLeft,
    p2HideCooldown: live.p2.hideCooldown,
    p2Hidden: live.p2.hidden,
    p2Safe: live.p2.safe,
    p2SafeTime: live.p2.safeTimeLeft,
    p2SafeCooldown: live.p2.safeCooldown,
    hideCooldownBase: live.hideCooldownBase,
    hideRefillRate: live.hideRefillRate,
  } : null;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-slate-950 text-white select-none">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Touch joystick overlays */}
      {live && live.joystick1.active && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute" style={{ left: live.joystick1.x - 36, top: live.joystick1.y - 36, width: 72, height: 72 }}>
            <div className="w-full h-full rounded-full border-2 border-cyan-400/60 bg-cyan-400/10 backdrop-blur-sm" />
            <div className="absolute rounded-full bg-cyan-400/70 border-2 border-white shadow-lg shadow-cyan-400/50"
              style={{ left: 28 + live.joystick1.dx - 22, top: 28 + live.joystick1.dy - 22, width: 44, height: 44 }} />
          </div>
        </div>
      )}
      {live && live.mode === 'local' && live.joystick2.active && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute" style={{ left: live.joystick2.x - 36, top: live.joystick2.y - 36, width: 72, height: 72 }}>
            <div className="w-full h-full rounded-full border-2 border-pink-400/60 bg-pink-400/10 backdrop-blur-sm" />
            <div className="absolute rounded-full bg-pink-400/70 border-2 border-white shadow-lg shadow-pink-400/50"
              style={{ left: 28 + live.joystick2.dx - 22, top: 28 + live.joystick2.dy - 22, width: 44, height: 44 }} />
          </div>
        </div>
      )}

      {/* HUD */}
      {hud && (screen === 'playing' || screen === 'paused') && (
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          <div className="flex justify-between items-start p-3 sm:p-5 gap-2">
            <PlayerScoreCard
              name={hud.p2Name}
              character={hud.p2Char}
              score={hud.p2Score}
              side="left"
              isChaser={hud.currentTurn === 2}
              hideTime={hud.p2HideTime}
              hideCooldown={hud.p2HideCooldown}
              hidden={hud.p2Hidden}
              safe={hud.p2Safe}
              safeTime={hud.p2SafeTime}
              safeCooldown={hud.p2SafeCooldown}
              hideCooldownBase={hud.hideCooldownBase}
            />
            {/* spacer for symmetry */}
            <div className="flex flex-col items-center gap-1">
              <div className={`bg-slate-900/70 border-2 rounded-2xl px-3 py-1 sm:px-4 sm:py-2 backdrop-blur-md ${hud.timeLeft <= 5 ? 'border-red-400 animate-pulse' : 'border-purple-400/60'}`}>
                <div className="text-[10px] sm:text-xs font-bold text-purple-200 tracking-widest text-center">
                  {hud.mode === 'online' ? (hud.currentTurn === 1 ? `${hud.p1Name}'S TURN` : `${hud.p2Name}'S TURN`) :
                    hud.currentTurn === 1 ? `${hud.p1Name}'S TURN` : `${hud.p2Name}'S TURN`}
                </div>
                <div className={`text-2xl sm:text-3xl font-black leading-none ${hud.timeLeft <= 5 ? 'text-red-300' : 'text-white'}`}>
                  {formatTime(hud.timeLeft)}
                </div>
              </div>
              <button onClick={handlePause} className="pointer-events-auto bg-slate-900/70 border border-slate-600 hover:border-purple-400 rounded-lg px-2 py-1 text-xs text-slate-300 hover:text-white transition">
                ⏸ P
              </button>
            </div>
            <PlayerScoreCard
              name={hud.p1Name}
              character={hud.p1Char}
              score={hud.p1Score}
              side="right"
              isChaser={hud.currentTurn === 1}
              hideTime={hud.p1HideTime}
              hideCooldown={hud.p1HideCooldown}
              hidden={hud.p1Hidden}
              safe={hud.p1Safe}
              safeTime={hud.p1SafeTime}
              safeCooldown={hud.p1SafeCooldown}
              hideCooldownBase={hud.hideCooldownBase}
            />
            {/* end */}
          </div>

          <div className="flex-1 flex items-end justify-center pb-6 pointer-events-none">
            <div className="bg-slate-900/70 border border-slate-600 backdrop-blur-md rounded-2xl px-4 py-2 text-center pop-in max-w-sm">
              {hud.mode === 'local' ? (
                <div className="text-slate-100 text-sm font-semibold">
                  {hud.currentTurn === 1 ? (
                    <span><span className="text-cyan-300">P1 (WASD/Space)</span> chases • <span className="text-pink-300">P2 (IJKL/Enter)</span> runs</span>
                  ) : (
                    <span><span className="text-pink-300">P2 (IJKL/Enter)</span> chases • <span className="text-cyan-300">P1 (WASD/Space)</span> runs</span>
                  )}
                </div>
              ) : hud.mode === 'online' ? (
                <div className="text-slate-100 text-sm font-semibold">
                  {hud.currentTurn === (hud.phase === 'turn2' ? 2 : 1) ? (hud.phase === 'turn2' ? `${hud.p2Name} chases!` : `${hud.p1Name} chases!`) : 'Your turn!'}
                </div>
              ) : hud.currentTurn === 1 ? (
                <div className="text-cyan-100 text-sm font-semibold">Run from the chaser! H to hide in bushes</div>
              ) : (
                <div className="text-cyan-100 text-sm font-semibold">Catch them and SLAP!</div>
              )}
              <div className="text-slate-400 text-[10px] sm:text-xs mt-1">H to hide in bushes • Pause with P</div>
            </div>
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {hud && hud.phase === 'countdown' && screen === 'playing' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center pop-in">
            <div className="text-6xl sm:text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(168,85,247,0.8)]">{hud.countdown}</div>
            <div className="text-base sm:text-xl font-bold text-purple-200 mt-2">
              {hud.currentTurn === 1 ? `${hud.p1Name} chases first!` : `${hud.p2Name} chases first!`}
            </div>
          </div>
        </div>
      )}

      {/* Main Menu */}
      {screen === 'menu' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950/85 via-purple-950/75 to-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-purple-950 border-2 border-purple-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-500/30 my-4">
            <div className="text-center">
              <div className="text-5xl sm:text-6xl mb-2 bounce-soft inline-block">✋💥</div>
              <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-lg">SLAP DASH!</h1>
              <p className="text-purple-200/80 text-sm mt-2">Chase • Hide • Slap</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-purple-400/50"></div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-purple-300/70 font-semibold">a game by</span>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-purple-400/50"></div>
              </div>
              <div
                className="text-3xl font-black italic bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(168,85,247,0.7)] mt-1"
                style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
              >
                Ktn
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => goToCharSelect('cpu')}
                className="w-full bg-gradient-to-r from-pink-500/30 to-purple-500/30 hover:from-pink-500/50 hover:to-purple-500/50 border-2 border-pink-400/50 hover:border-pink-300 rounded-2xl p-3 text-left flex items-center gap-3 transition active:scale-95"
              >
                <div className="text-3xl">🤖</div>
                <div className="flex-1">
                  <div className="font-black text-white text-base">VS COMPUTER</div>
                  <div className="text-pink-200/80 text-xs">Play against smart AI</div>
                </div>
                <div className="text-pink-300">▶</div>
              </button>
              <button
                onClick={() => goToCharSelect('local')}
                className="w-full bg-gradient-to-r from-cyan-500/30 to-blue-500/30 hover:from-cyan-500/50 hover:to-blue-500/50 border-2 border-cyan-400/50 hover:border-cyan-300 rounded-2xl p-3 text-left flex items-center gap-3 transition active:scale-95"
              >
                <div className="text-3xl">👫</div>
                <div className="flex-1">
                  <div className="font-black text-white text-base">LOCAL 2 PLAYER</div>
                  <div className="text-cyan-200/80 text-xs">Same keyboard • 2 humans</div>
                </div>
                <div className="text-cyan-300">▶</div>
              </button>
              <button
                onClick={() => { setScreen('lobby'); setMode('online'); }}
                className="w-full bg-gradient-to-r from-emerald-500/30 to-teal-500/30 hover:from-emerald-500/50 hover:to-teal-500/50 border-2 border-emerald-400/50 hover:border-emerald-300 rounded-2xl p-3 text-left flex items-center gap-3 transition active:scale-95"
              >
                <div className="text-3xl">🌐</div>
                <div className="flex-1">
                  <div className="font-black text-white text-base">ONLINE MULTIPLAYER</div>
                  <div className="text-emerald-200/80 text-xs">Play with friends via room code</div>
                </div>
                <div className="text-emerald-300">▶</div>
              </button>
            </div>

            <div className="mt-4 bg-slate-800/60 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-purple-200 text-sm mb-1">Controls</div>
              <div>⌨️ <b>P1:</b> WASD/Arrows move, <b>Space/F</b> slap, <b>H</b> hide</div>
              <div>⌨️ <b>P2 (local):</b> IJKL move, <b>Enter</b> slap, <b>Shift</b> hide</div>
              <div>📱 Mobile: drag on <b>top half</b> for P1, <b>bottom half</b> for P2</div>
              <div>🌿 <b>Bushes/Trees/Walls</b> = hide (H, 5s safe, 10s cooldown)</div>
              <div>⏸️ <b>P / Esc</b> to pause</div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setShowScores((s) => !s)}
                className="flex-1 text-xs bg-slate-800/80 hover:bg-slate-700 border border-slate-600 rounded-lg py-2 text-slate-200 transition"
              >
                🏆 {showScores ? 'Hide' : 'Show'} High Scores
              </button>
            </div>
            {showScores && <HighScoreBoard scores={scores} onClear={() => { clearScores(); setScores([]); }} />}
          </div>
        </div>
      )}

      {/* Character select */}
      {screen === 'charSelect' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950/85 via-purple-950/75 to-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-purple-950 border-2 border-purple-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-500/30 my-4">
            <h2 className="text-2xl sm:text-3xl font-black text-center bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">Choose Your Fighter</h2>
            <p className="text-center text-purple-200/80 text-sm mt-1">
              {mode === 'cpu' ? 'VS Computer' : 'Local 2 Player'}
            </p>

            <div className="mt-5 space-y-4">
              <PlayerConfig
                label={mode === 'cpu' ? 'You' : 'Player 1'}
                name={p1Name}
                setName={setP1Name}
                character={p1Char}
                setCharacter={setP1Char}
                accent="cyan"
              />
              {mode === 'local' && (
                <PlayerConfig
                  label="Player 2"
                  name={p2Name}
                  setName={setP2Name}
                  character={p2Char}
                  setCharacter={setP2Char}
                  accent="pink"
                />
              )}
            </div>

            {/* Game duration selector */}
            <div className="mt-4 bg-slate-800/60 border border-slate-600 rounded-2xl p-3">
              <div className="text-xs text-purple-200 font-bold mb-2">⏱️ ROUND DURATION (per turn)</div>
              <div className="grid grid-cols-3 gap-2">
                {([10, 20, 30, 60, 300, 600] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setTurnDuration(d)}
                    className={`py-2 rounded-lg border-2 font-bold text-sm transition ${turnDuration === d ? 'border-purple-400 bg-purple-500/30 text-white scale-105' : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'}`}
                  >
                    {d < 60 ? `${d}s` : `${d / 60}m`}
                    <div className="text-[9px] font-normal opacity-80 mt-0.5">
                      {d === 10 ? '⚡ Quick' : d === 20 ? '⏱️ Standard' : d === 30 ? '🐢 Long' : d === 60 ? '🎯 1m' : d === 300 ? '🔥 5m' : '💀 10m'}
                    </div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-slate-400 mt-2 text-center">
                Total game: {formatTotalTime(turnDuration * 2)}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setScreen('menu')}
                className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg hover:bg-slate-700 active:scale-95 transition"
              >
                ← Back
              </button>
              <button
                onClick={mode === 'cpu' ? startCPUGame : startLocalGame}
                className="flex-1 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 hover:from-pink-400 hover:via-purple-400 hover:to-cyan-400 text-white font-black py-2.5 rounded-lg shadow-lg shadow-purple-500/50 active:scale-95 transition"
              >
                PLAY ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online Lobby */}
      {screen === 'lobby' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-950/85 via-emerald-950/75 to-slate-950/85 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-emerald-950 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/30 my-4">
            <h2 className="text-2xl sm:text-3xl font-black text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">🌐 Online Lobby</h2>
            <p className="text-center text-emerald-200/80 text-sm mt-1">Create a room or join with a code</p>

            {connStatus === 'idle' || connStatus === 'error' ? (
              <>
                <div className="mt-5 bg-emerald-500/10 border border-emerald-400/40 rounded-2xl p-3 space-y-2">
                  <div className="font-bold text-emerald-200 text-sm">📡 CREATE A ROOM</div>
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value.slice(0, 24))}
                    placeholder="Room name (for you to remember)"
                    maxLength={24}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
                  />
                  <input
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value.slice(0, 20))}
                    placeholder="Password (share with friend)"
                    maxLength={20}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    {([10, 20, 30, 60, 300, 600] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setTurnDuration(d)}
                        className={`py-1.5 rounded-lg border text-xs font-bold transition ${turnDuration === d ? 'border-emerald-400 bg-emerald-500/30 text-white' : 'border-slate-600 bg-slate-800 text-slate-300'}`}
                      >
                        {d < 60 ? `${d}s` : `${d / 60}m`} {d === 10 ? '⚡' : d === 20 ? '⏱️' : d === 30 ? '🐢' : d === 60 ? '🎯' : d === 300 ? '🔥' : '💀'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={createRoom}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-2 rounded-lg active:scale-95 transition"
                  >
                    CREATE ROOM
                  </button>
                </div>

                <div className="mt-3 bg-cyan-500/10 border border-cyan-400/40 rounded-2xl p-3 space-y-2">
                  <div className="font-bold text-cyan-200 text-sm">🚪 JOIN A ROOM</div>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.slice(0, 40))}
                    placeholder="Room code (paste from host)"
                    maxLength={40}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-400 break-all"
                  />
                  <input
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value.slice(0, 20))}
                    placeholder="Password"
                    maxLength={20}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={joinRoom}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold py-2 rounded-lg active:scale-95 transition"
                  >
                    JOIN ROOM
                  </button>
                </div>

                {connError && (
                  <div className="mt-3 text-red-300 text-xs text-center bg-red-500/10 border border-red-500/40 rounded-lg p-2">
                    {connError}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setScreen('menu')}
                    className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg hover:bg-slate-700 active:scale-95 transition"
                  >
                    ← Back
                  </button>
                </div>
              </>
            ) : connStatus === 'waiting' && (
              <div className="mt-5 bg-emerald-500/10 border border-emerald-400/40 rounded-2xl p-5 text-center">
                <div className="text-emerald-200 text-sm font-bold">📡 Waiting for friend...</div>
                <div className="text-slate-300 text-xs mt-2">Share this code + the password:</div>
                <div className="bg-slate-900 border border-emerald-400/60 rounded-lg px-3 py-2 mt-2 pop-in flex items-center gap-2">
                  <div className="flex-1 text-emerald-300 text-xs font-mono break-all select-all">{roomCode}</div>
                  <button
                    onClick={() => { try { navigator.clipboard.writeText(roomCode); } catch {} }}
                    className="bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 text-xs font-bold px-2 py-1 rounded border border-emerald-400/50 active:scale-95"
                  >
                    📋 Copy
                  </button>
                </div>
                <div className="text-slate-400 text-xs mt-2">Room: <b className="text-white">{roomName}</b></div>
                <div className="text-slate-400 text-xs flex items-center gap-2">Password: <b className="text-white">{roomPassword}</b>
                  <button
                    onClick={() => { try { navigator.clipboard.writeText(roomPassword); } catch {} }}
                    className="text-[10px] text-emerald-300 hover:text-emerald-200"
                  >copy</button>
                </div>
                <button
                  onClick={leaveRoom}
                  className="mt-3 text-xs text-slate-300 hover:text-red-300"
                >
                  Cancel
                </button>
              </div>
            )}

            {connStatus === 'connecting' && (
              <div className="mt-5 text-center text-slate-200 text-sm">⏳ Connecting...</div>
            )}
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {screen === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-purple-500/60 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-purple-500/30 pop-in">
            <div className="text-5xl mb-2">⏸️</div>
            <h2 className="text-3xl font-black text-white">PAUSED</h2>
            <div className="mt-1 text-purple-200/80 text-sm">Take a breather, then slap on!</div>
            <div className="mt-5 flex flex-col gap-2 w-56">
              <button onClick={handleResume} className="bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-2.5 rounded-lg shadow-lg active:scale-95 transition">▶ Resume</button>
              <button onClick={handleStart} className="bg-slate-800 border border-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg hover:bg-slate-700 active:scale-95 transition">↻ Restart</button>
              <button onClick={handleMenu} className="bg-slate-800 border border-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg hover:bg-slate-700 active:scale-95 transition">🏠 Main Menu</button>
            </div>
          </div>
        </div>
      )}

      {/* Result overlay */}
      {screen === 'result' && lastResult && (
        <div className={`absolute inset-0 flex items-center justify-center p-4 ${lastResult.winner === 'p1' ? 'bg-cyan-950/70' : lastResult.winner === 'p2' ? 'bg-pink-950/70' : 'bg-purple-950/70'} backdrop-blur-md overflow-y-auto`}>
          <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-purple-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-purple-500/40 pop-in my-4">
            <div className="text-center">
              {lastResult.winner === 'tie' ? (
                <>
                  <div className="text-5xl mb-1">🤝</div>
                  <h2 className="text-3xl sm:text-4xl font-black text-purple-300">IT'S A TIE!</h2>
                </>
              ) : (
                <h2 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-yellow-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                  🏆 {lastResult.winner === 'p1' ? (mode === 'cpu' ? 'YOU WIN!' : `${p1Name} WINS!`) : (mode === 'cpu' ? 'COMPUTER WINS!' : `${p2Name} WINS!`)}
                </h2>
              )}
              {isNewHigh && (
                <div className="mt-2 inline-block bg-yellow-400/20 border border-yellow-400 text-yellow-200 text-xs font-bold px-3 py-1 rounded-full animate-pulse">🏆 NEW HIGH SCORE!</div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <ResultCard name={p1Name} character={p1Char} score={lastResult.p1} won={lastResult.winner === 'p1'} accent="cyan" />
              <ResultCard name={mode === 'cpu' ? 'Computer' : p2Name} character={p1Char === 'boy' ? 'girl' : 'boy'} score={lastResult.p2} won={lastResult.winner === 'p2'} accent="pink" />
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button onClick={handleStart} className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white font-black py-3 rounded-xl shadow-lg shadow-purple-500/50 active:scale-95 transition text-lg">▶ PLAY AGAIN</button>
              <div className="flex gap-2">
                <button onClick={() => setShowScores((s) => !s)} className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 font-semibold py-2 rounded-lg hover:bg-slate-700 active:scale-95 transition text-sm">🏆 Scores</button>
                <button onClick={handleMenu} className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 font-semibold py-2 rounded-lg hover:bg-slate-700 active:scale-95 transition text-sm">🏠 Menu</button>
              </div>
            </div>

            {showScores && <HighScoreBoard scores={scores} onClear={() => { clearScores(); setScores([]); }} />}

            {/* Ktn signature on the result page */}
            <div className="mt-5 pt-4 border-t border-slate-700/50 flex items-center justify-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"></div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-purple-300/60 font-semibold">crafted by</span>
              <div
                className="text-2xl font-black italic bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
              >
                Ktn
              </div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-purple-400/40 to-transparent"></div>
            </div>
          </div>
        </div>
      )}

      {/* Watermark - always visible in bottom-right corner */}
      <div className="pointer-events-none absolute bottom-2 right-3 select-none z-50">
        <div className="flex items-center gap-1.5 opacity-40 hover:opacity-70 transition-opacity">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">made by</span>
          <span
            className="text-lg font-black italic bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(168,85,247,0.6)]"
            style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
          >
            Ktn
          </span>
        </div>
      </div>
    </div>
  );
}

function PlayerConfig({ label, name, setName, character, setCharacter, accent }: { label: string; name: string; setName: (s: string) => void; character: 'boy' | 'girl'; setCharacter: (c: 'boy' | 'girl') => void; accent: 'cyan' | 'pink' }) {
  const ringClass = accent === 'cyan' ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-pink-400/60 bg-pink-500/10';
  const textClass = accent === 'cyan' ? 'text-cyan-200' : 'text-pink-200';
  return (
    <div className={`rounded-2xl border-2 ${ringClass} p-3`}>
      <div className={`text-xs font-bold ${textClass} tracking-wider`}>{label}</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 12))}
        maxLength={12}
        className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400"
        placeholder="Name"
      />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => setCharacter('boy')}
          className={`p-2 rounded-xl border-2 text-2xl transition ${character === 'boy' ? 'border-blue-400 bg-blue-500/30 scale-105' : 'border-slate-600 bg-slate-800 opacity-60'}`}
        >
          👦
          <div className="text-[10px] text-blue-200 font-bold mt-1">BOY</div>
        </button>
        <button
          onClick={() => setCharacter('girl')}
          className={`p-2 rounded-xl border-2 text-2xl transition ${character === 'girl' ? 'border-pink-400 bg-pink-500/30 scale-105' : 'border-slate-600 bg-slate-800 opacity-60'}`}
        >
          👧
          <div className="text-[10px] text-pink-200 font-bold mt-1">GIRL</div>
        </button>
      </div>
    </div>
  );
}

function PlayerScoreCard({ name, character, score, isChaser, hideTime, hideCooldown, hidden, safe, safeTime, safeCooldown, hideCooldownBase }: { name: string; character: 'boy' | 'girl'; score: number; side: 'left' | 'right'; isChaser: boolean; hideTime: number; hideCooldown: number; hidden: boolean; safe: boolean; safeTime: number; safeCooldown: number; hideCooldownBase: number }) {
  const isGirl = character === 'girl';
  const emoji = isGirl ? '👧' : '👦';
  let hideStatus = '🌿';
  let hideLabel = `${hideTime.toFixed(1)}s`;
  let hideColor = 'text-green-200';
  let progressPct = (hideTime / 5) * 100;
  if (hidden) {
    hideStatus = '🫥';
    hideLabel = `BUSH ${hideTime.toFixed(1)}s`;
    hideColor = 'text-green-300';
    progressPct = (hideTime / 5) * 100;
  } else if (safe) {
    hideStatus = '🛡️';
    hideLabel = `COVER ${safeTime.toFixed(1)}s`;
    hideColor = 'text-emerald-300';
    progressPct = (safeTime / 5) * 100;
  } else if (hideCooldown > 0 || safeCooldown > 0) {
    const cd = Math.max(hideCooldown, safeCooldown);
    hideStatus = '⏳';
    hideLabel = `CD ${cd.toFixed(1)}s`;
    hideColor = 'text-red-300';
    progressPct = (cd / hideCooldownBase) * 100;
  }
  return (
    <div className={`${isGirl ? 'bg-pink-500/20 border-pink-400/60 shadow-pink-500/20' : 'bg-cyan-500/20 border-cyan-400/60 shadow-cyan-500/20'} border-2 backdrop-blur-md rounded-2xl px-3 py-2 sm:px-4 sm:py-2 shadow-lg pop-in min-w-[110px]`}>
      <div className={`text-[10px] sm:text-xs font-bold ${isGirl ? 'text-pink-200' : 'text-cyan-200'} tracking-widest flex items-center gap-1`}>
        <span>{emoji}</span>
        <span className="truncate max-w-[80px]">{name}</span>
        {isChaser && <span className="text-red-300 animate-pulse">⚡</span>}
      </div>
      <div className={`text-2xl sm:text-3xl font-black ${isGirl ? 'text-pink-100' : 'text-cyan-100'} leading-none`}>{score}</div>
      <div className={`text-[9px] sm:text-[10px] ${hideColor} font-bold flex items-center justify-between gap-1 mt-0.5`}>
        <span className="flex items-center gap-1">
          <span>{hideStatus}</span>
          <span>{hideLabel}</span>
        </span>
      </div>
      {/* progress bar showing hide/cooldown state */}
      <div className="mt-1 h-1 bg-slate-800/60 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${
            hidden ? 'bg-green-400' : safe ? 'bg-emerald-400' :
            (hideCooldown > 0 || safeCooldown > 0) ? 'bg-red-400' : 'bg-yellow-400'
          }`}
          style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
        />
      </div>
    </div>
  );
}

function ResultCard({ name, character, score, won, accent }: { name: string; character: 'boy' | 'girl'; score: number; won: boolean; accent: 'cyan' | 'pink' }) {
  const isGirl = character === 'girl';
  const ringColor = accent === 'cyan' ? 'border-cyan-400/50' : 'border-pink-400/50';
  return (
    <div className={`${won ? 'bg-yellow-500/15 border-yellow-400' : 'bg-slate-800/60 ' + ringColor} border-2 rounded-2xl p-3 text-center`}>
      <div className="text-2xl mb-1">{isGirl ? '👧' : '👦'}</div>
      <div className={`text-xs ${won ? 'text-yellow-200' : accent === 'cyan' ? 'text-cyan-200' : 'text-pink-200'} font-bold truncate`}>{name}</div>
      <div className={`text-3xl font-black ${won ? 'text-yellow-100' : accent === 'cyan' ? 'text-cyan-100' : 'text-pink-100'}`}>{score}</div>
      <div className="text-[10px] text-slate-400 mt-0.5">slaps</div>
    </div>
  );
}

function formatTime(sec: number): string {
  // For HUD - show MM:SS for >= 60s, else just seconds
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTotalTime(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm > 0 ? `${h}h ${mm}m` : `${h}h`;
}

function HighScoreBoard({ scores, onClear }: { scores: ScoreEntry[]; onClear: () => void }) {
  return (
    <div className="mt-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-3 pop-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black text-yellow-300 tracking-wider">🏆 HIGH SCORES</h3>
        {scores.length > 0 && <button onClick={onClear} className="text-[10px] text-slate-400 hover:text-red-300">clear</button>}
      </div>
      {scores.length === 0 ? (
        <div className="text-xs text-slate-400 text-center py-3">No scores yet. Be the first!</div>
      ) : (
        <ol className="space-y-1">
          {scores.map((s, i) => (
            <li key={i} className="flex items-center justify-between bg-slate-900/60 rounded-lg px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`font-black w-5 ${i === 0 ? 'text-yellow-300' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-500'}`}>{i + 1}</span>
                <span className="text-slate-200 truncate font-semibold">{s.name}</span>
                <span className="text-[9px] text-slate-500 uppercase">{s.mode}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-purple-300 text-[10px]">{s.date}</span>
                <span className="text-white font-black">{s.score}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
