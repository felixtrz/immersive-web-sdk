import {
  PanelDocument,
  PanelUI,
  UIKitDocument,
  createSystem,
  eq,
} from '@iwsdk/core';
import { gameGlobals, type RoundState } from '../components/game-state';
import { PANEL_CONFIG } from '../constants';

const ROUND_STATE_LABELS: Record<RoundState, string> = {
  ready: 'THROW!',
  live: '—',
  cleared: 'CLEARED!',
  out: 'OUT OF BALLS',
};

/**
 * Binds the carnival scoreboard panel (ui/scoreboard.uikitml, compiled to
 * public/ui/scoreboard.json by the vite plugin) to the shared game signals.
 *
 * Pure event/signal driven — no update loop. The panel document loads
 * asynchronously, so all wiring happens in the query's qualify callback;
 * signal subscriptions fire immediately on subscribe, which also seeds the
 * initial text values.
 */
export class ScoreboardSystem extends createSystem({
  scorePanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', PANEL_CONFIG)],
  },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.scorePanel.subscribe('qualify', (entity) => {
        const doc = PanelDocument.data.document[entity.index] as
          | UIKitDocument
          | undefined;
        if (!doc) {
          return;
        }

        const scoreEl = doc.getElementById('score-value');
        const ballsEl = doc.getElementById('balls-value');
        const stateEl = doc.getElementById('round-state');
        const resetBtn = doc.getElementById('reset-button');

        const g = gameGlobals(this.globals);

        this.cleanupFuncs.push(
          g.score.subscribe((value) => {
            scoreEl?.setProperties({ text: String(value) });
          }),
          g.ballsLeft.subscribe((value) => {
            ballsEl?.setProperties({ text: String(value) });
          }),
          g.roundState.subscribe((state) => {
            stateEl?.setProperties({ text: ROUND_STATE_LABELS[state] });
          }),
        );

        // Trigger on BOTH click (browser mouse path) and pointerup (XR ray
        // select-value path — emulated select events don't synthesize
        // 'click'), guarded so a path that emits both fires once.
        let lastReset = 0;
        const requestReset = () => {
          const now = performance.now();
          if (now - lastReset < 300) {
            return;
          }
          lastReset = now;
          console.log('[GAME] ui=reset-pressed');
          g.resetRequested.value = g.resetRequested.peek() + 1;
        };
        resetBtn?.addEventListener('click', requestReset);
        resetBtn?.addEventListener('pointerup', requestReset);
      }),
    );
  }
}
