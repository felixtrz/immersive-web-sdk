/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InputConfig } from '../visual/adapter/base-visual-adapter.js';

/**
 * State of a thumbstick or touchpad based on direction.
 * @category Input
 */
export enum AxesState {
  /** Centered / no input. */
  Default = 0,
  /** Pushed up (negative Y). */
  Up = 1,
  /** Pushed down (positive Y). */
  Down = 2,
  /** Pushed left (negative X). */
  Left = 3,
  /** Pushed right (positive X). */
  Right = 4,
}

/**
 * Standard XR gamepad input component identifiers.
 * Use these with StatefulGamepad methods to query specific buttons.
 * @category Input
 */
export enum InputComponent {
  /** Primary trigger button. */
  Trigger = 'xr-standard-trigger',
  /** Grip/squeeze button. */
  Squeeze = 'xr-standard-squeeze',
  /** Touchpad (if available). */
  Touchpad = 'xr-standard-touchpad',
  /** Thumbstick. */
  Thumbstick = 'xr-standard-thumbstick',
  /** A button (right controller). */
  A_Button = 'a-button',
  /** B button (right controller). */
  B_Button = 'b-button',
  /** X button (left controller). */
  X_Button = 'x-button',
  /** Y button (left controller). */
  Y_Button = 'y-button',
  /** Thumbrest capacitive sensor. */
  Thumbrest = 'thumbrest',
  /** Menu button. */
  Menu = 'menu',
}

/**
 * Tracks XR gamepad button and axis state with frame-accurate edge detection.
 *
 * StatefulGamepad wraps a native WebXR Gamepad and provides:
 * - Button pressed/touched/value queries by name or index
 * - Edge detection (button down/up transitions)
 * - Thumbstick/touchpad axis values and directional state
 * - Select (trigger) state helpers
 *
 * @remarks
 * - Access via `world.input.gamepads.left` or `world.input.gamepads.right`.
 * - Call `update()` each frame (handled automatically by XRInputManager).
 * - Use {@link InputComponent} constants for button names.
 *
 * @example
 * ```ts
 * const gamepad = world.input.gamepads.right;
 * if (gamepad) {
 *   // Check if trigger just pressed this frame
 *   if (gamepad.getButtonDown(InputComponent.Trigger)) {
 *     console.log('Trigger pressed!');
 *   }
 *   // Get thumbstick values
 *   const stick = gamepad.getAxesValues(InputComponent.Thumbstick);
 *   if (stick) {
 *     console.log(`Thumbstick: ${stick.x}, ${stick.y}`);
 *   }
 * }
 * ```
 *
 * @category Input
 */
export class StatefulGamepad {
  public readonly handedness: XRHandedness;
  public readonly gamepad: Gamepad;
  public readonly inputSource: XRInputSource;
  public readonly buttonMapping = new Map<string, number>();
  public readonly axesMapping = new Map<string, { x: number; y: number }>();
  public axesThreshold = 0.8;
  private axesStates = new Map<string, { prev: AxesState; curr: AxesState }>();
  private axes2DValues = new Map<string, number>();
  private pressedArrs: [Int8Array, Int8Array];
  private touchedArrs: [Int8Array, Int8Array];
  private valueArrs: [Float32Array, Float32Array];
  private axesValues = new Map<string, { x: number; y: number }>();
  private selectComponentId: string;
  private currentIndex = 1;
  private previousIndex = 0;

  constructor({ inputSource, layout }: InputConfig) {
    this.handedness = inputSource.handedness;
    this.gamepad = inputSource.gamepad!;
    this.inputSource = inputSource;
    this.selectComponentId = layout.selectComponentId;
    const numButtons = this.gamepad.buttons.length;
    this.pressedArrs = [
      new Int8Array(numButtons).fill(0),
      new Int8Array(numButtons).fill(0),
    ];
    this.touchedArrs = [
      new Int8Array(numButtons).fill(0),
      new Int8Array(numButtons).fill(0),
    ];
    this.valueArrs = [
      new Float32Array(numButtons).fill(0),
      new Float32Array(numButtons).fill(0),
    ];
    Object.entries(layout.components).forEach(([id, config]) => {
      const buttonIdx = config.gamepadIndices['button'];
      if (buttonIdx !== undefined) {
        this.buttonMapping.set(id, buttonIdx);
      }
      if (config.type === 'thumbstick' || config.type === 'touchpad') {
        this.axesMapping.set(id, {
          x: config.gamepadIndices.xAxis!,
          y: config.gamepadIndices.yAxis!,
        });
        this.axesValues.set(id, { x: 0, y: 0 });
        this.axes2DValues.set(id, 0);
        this.axesStates.set(id, {
          prev: AxesState.Default,
          curr: AxesState.Default,
        });
      }
    });
  }

  /**
   * Updates button and axis state from the native gamepad.
   * Called automatically each frame by XRInputManager.
   */
  update() {
    this.currentIndex = 1 - this.currentIndex;
    this.previousIndex = 1 - this.previousIndex;
    this.gamepad.buttons.forEach((button, idx) => {
      this.pressedArrs[this.currentIndex][idx] = button.pressed ? 1 : 0;
      this.touchedArrs[this.currentIndex][idx] = button.touched ? 1 : 0;
      this.valueArrs[this.currentIndex][idx] = button.value;
    });
    this.axesMapping.forEach(({ x: xIdx, y: yIdx }, id) => {
      const axesValue = this.axesValues.get(id)!;
      const axesState = this.axesStates.get(id)!;
      axesState.prev = axesState.curr;
      axesValue.x = this.gamepad.axes[xIdx];
      axesValue.y = this.gamepad.axes[yIdx];
      const { x, y } = axesValue;
      const value2D = Math.sqrt(x * x + y * y);
      this.axes2DValues.set(id, value2D);
      if (value2D < this.axesThreshold) {
        axesState.curr = AxesState.Default;
      } else {
        if (Math.abs(x) > Math.abs(y)) {
          axesState.curr = x > 0 ? AxesState.Right : AxesState.Left;
        } else {
          axesState.curr = y > 0 ? AxesState.Down : AxesState.Up;
        }
      }
    });
  }

  private getButtonState(id: string, stateArr: [Int8Array, Int8Array]) {
    const idx = this.buttonMapping.get(id);
    return idx !== undefined ? stateArr[this.currentIndex][idx] : 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // Button State Queries
  // ─────────────────────────────────────────────────────────────────

  /** Returns true if the button at the given index is currently pressed. */
  getButtonPressedByIdx(idx: number) {
    return !!this.pressedArrs[this.currentIndex][idx];
  }

  /** Returns true if the named button is currently pressed. */
  getButtonPressed(id: string) {
    return !!this.getButtonState(id, this.pressedArrs);
  }

  /** Returns true if the button at the given index is currently touched. */
  getButtonTouchedByIdx(idx: number) {
    return !!this.touchedArrs[this.currentIndex][idx];
  }

  /** Returns true if the named button is currently touched. */
  getButtonTouched(id: string) {
    return !!this.getButtonState(id, this.touchedArrs);
  }

  /** Returns the analog value (0-1) of the button at the given index. */
  getButtonValueByIdx(idx: number) {
    return this.valueArrs[this.currentIndex][idx] ?? 0;
  }

  /** Returns the analog value (0-1) of the named button. */
  getButtonValue(id: string) {
    const idx = this.buttonMapping.get(id);
    return idx !== undefined ? this.valueArrs[this.currentIndex][idx] : 0;
  }

  // ─────────────────────────────────────────────────────────────────
  // Button Edge Detection (Down/Up)
  // ─────────────────────────────────────────────────────────────────

  /** Returns true if the button at the given index was just pressed this frame. */
  getButtonDownByIdx(idx: number) {
    return (
      (this.pressedArrs[this.currentIndex][idx] &
        ~this.pressedArrs[this.previousIndex][idx]) !==
      0
    );
  }

  /** Returns true if the named button was just pressed this frame. */
  getButtonDown(id: string) {
    const idx = this.buttonMapping.get(id);
    return idx !== undefined
      ? (this.pressedArrs[this.currentIndex][idx] &
          ~this.pressedArrs[this.previousIndex][idx]) !==
          0
      : false;
  }

  /** Returns true if the button at the given index was just released this frame. */
  getButtonUpByIdx(idx: number) {
    return (
      (~this.pressedArrs[this.currentIndex][idx] &
        this.pressedArrs[this.previousIndex][idx]) !==
      0
    );
  }

  /** Returns true if the named button was just released this frame. */
  getButtonUp(id: string) {
    const idx = this.buttonMapping.get(id);
    return idx !== undefined
      ? (~this.pressedArrs[this.currentIndex][idx] &
          this.pressedArrs[this.previousIndex][idx]) !==
          0
      : false;
  }

  // ─────────────────────────────────────────────────────────────────
  // Select (Primary Action) Helpers
  // ─────────────────────────────────────────────────────────────────

  /** Returns true if the select action (trigger) was just pressed this frame. */
  getSelectStart() {
    return this.getButtonDown(this.selectComponentId);
  }

  /** Returns true if the select action (trigger) was just released this frame. */
  getSelectEnd() {
    return this.getButtonUp(this.selectComponentId);
  }

  /** Returns true if the select action (trigger) is currently held. */
  getSelecting() {
    return this.getButtonPressed(this.selectComponentId);
  }

  // ─────────────────────────────────────────────────────────────────
  // Axes (Thumbstick/Touchpad) Queries
  // ─────────────────────────────────────────────────────────────────

  /** Returns the X/Y values of the named axis component (thumbstick/touchpad). */
  getAxesValues(id: string) {
    return this.axesValues.get(id);
  }

  /** Returns the current directional state of the named axis. */
  getAxesState(id: string) {
    return this.axesStates.get(id)?.curr;
  }

  /** Returns the 2D magnitude (0-1) of the named axis. */
  get2DInputValue(id: string) {
    return this.axes2DValues.get(id);
  }

  /** Returns true if the axis just entered the given directional state. */
  getAxesEnteringState(id: string, state: AxesState) {
    const axesState = this.axesStates.get(id);
    return axesState
      ? axesState.curr === state && axesState.prev !== state
      : false;
  }

  /** Returns true if the axis just left the given directional state. */
  getAxesLeavingState(id: string, state: AxesState) {
    const axesState = this.axesStates.get(id);
    return axesState
      ? axesState.curr !== state && axesState.prev === state
      : false;
  }

  /** Returns true if the axis just moved to the up position. */
  getAxesEnteringUp(id: string) {
    return this.getAxesEnteringState(id, AxesState.Up);
  }

  /** Returns true if the axis just moved to the down position. */
  getAxesEnteringDown(id: string) {
    return this.getAxesEnteringState(id, AxesState.Down);
  }

  /** Returns true if the axis just moved to the left position. */
  getAxesEnteringLeft(id: string) {
    return this.getAxesEnteringState(id, AxesState.Left);
  }

  /** Returns true if the axis just moved to the right position. */
  getAxesEnteringRight(id: string) {
    return this.getAxesEnteringState(id, AxesState.Right);
  }

  /** Returns true if the axis just left the up position. */
  getAxesLeavingUp(id: string) {
    return this.getAxesLeavingState(id, AxesState.Up);
  }

  /** Returns true if the axis just left the down position. */
  getAxesLeavingDown(id: string) {
    return this.getAxesLeavingState(id, AxesState.Down);
  }

  /** Returns true if the axis just left the left position. */
  getAxesLeavingLeft(id: string) {
    return this.getAxesLeavingState(id, AxesState.Left);
  }

  /** Returns true if the axis just left the right position. */
  getAxesLeavingRight(id: string) {
    return this.getAxesLeavingState(id, AxesState.Right);
  }
}
