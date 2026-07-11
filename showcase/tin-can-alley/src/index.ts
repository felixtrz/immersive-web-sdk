import {
  AssetType,
  AudioSource,
  Interactable,
  InstanceStealPolicy,
  PanelUI,
  PlaybackMode,
  SessionMode,
  World,
} from '@iwsdk/core';
import { signal } from '@preact/signals-core';
import type { RoundState } from './components/game-state';
import { Ball } from './components/softball';
import { Can, Downed } from './components/tin-can';
import {
  BALLS_PER_ROUND,
  CLEAR_SFX_POS,
  HIT_SFX_POS,
  PANEL_CONFIG,
  PANEL_POS,
} from './constants';
import { buildBooth } from './scene/booth';
import { setupEnvironment } from './scene/environment';
import { BootSystem } from './systems/boot-system';
import { RoundSystem } from './systems/round-system';
import { ScoreboardSystem } from './systems/scoreboard-system';
import { ScoringSystem } from './systems/scoring-system';

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  assets: {
    chime: {
      url: '/audio/chime.mp3',
      type: AssetType.Audio,
      priority: 'critical',
    },
  },
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'once',
  },
  render: {
    // We own the neon-night look — keep the SDK from pre-attaching
    // day-blue defaults to the level root.
    defaultLighting: false,
  },
  features: {
    physics: true,
    grabbing: true,
    // locomotion omitted: stationary booth. spatialUI defaults on.
    // Audio has no flag — AudioSystem is always registered.
  },
}).then((world) => {
  // --- SFX entities (shared chime buffer; see TECH_PLAN audio rows) ---
  const hitSfx = world.createTransformEntity();
  hitSfx.object3D!.position.set(...HIT_SFX_POS);
  hitSfx.addComponent(AudioSource, {
    src: '/audio/chime.mp3',
    positional: true,
    volume: 0.85,
    playbackMode: PlaybackMode.Overlap,
    maxInstances: 3,
    instanceStealPolicy: InstanceStealPolicy.Oldest,
    refDistance: 2,
  });

  const clearSfx = world.createTransformEntity();
  clearSfx.object3D!.position.set(...CLEAR_SFX_POS);
  clearSfx.addComponent(AudioSource, {
    src: '/audio/chime.mp3',
    positional: false,
    volume: 1.0,
    playbackMode: PlaybackMode.Overlap,
    maxInstances: 3,
  });

  // --- Cross-system state: signals in world.globals (see game-state.ts) ---
  world.globals.score = signal(0);
  world.globals.ballsLeft = signal(BALLS_PER_ROUND);
  world.globals.roundState = signal<RoundState>('ready');
  world.globals.resetRequested = signal(0);
  world.globals.hitSfx = hitSfx;
  world.globals.clearSfx = clearSfx;

  // --- Components & systems BEFORE spawning (qualify events don't replay) ---
  world
    .registerComponent(Can)
    .registerComponent(Downed)
    .registerComponent(Ball);
  world
    .registerSystem(BootSystem, { priority: 10 })
    .registerSystem(ScoringSystem, { priority: 12 })
    .registerSystem(RoundSystem, { priority: 15 })
    .registerSystem(ScoreboardSystem, { priority: 30 });

  // --- World ---
  setupEnvironment(world);
  buildBooth(world);

  const panel = world.createTransformEntity();
  panel.object3D!.position.set(...PANEL_POS);
  panel
    .addComponent(PanelUI, {
      config: PANEL_CONFIG,
      maxWidth: 1.4,
      maxHeight: 0.6,
    })
    .addComponent(Interactable);

  // Game pieces spawn via BootSystem once frame deltas stabilize
  // (headless-safe physics; see boot-system.ts).

  console.log('[GAME] ready');
});
