# @iwsdk/vite-plugin-iwer

A Vite plugin for WebXR emulation runtime injection using [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime). Enables WebXR development without VR hardware by injecting a full WebXR emulation layer during development.

## Features

- 🥽 **Device Emulation** - Emulate Meta Quest 2, Quest 3, Quest Pro, or Quest 1
- 🏠 **Synthetic Environments** - Optional room-scale environments for AR testing
- 🔧 **Zero Config** - Works out of the box with sensible defaults
- 🚫 **Smart Activation** - Only activates on localhost by default, skips real XR browsers
- ⚡ **Dev-First** - Injects during development, optionally during build

## Installation

```bash
npm install -D @iwsdk/vite-plugin-iwer
```

## Quick Start

```javascript
import { defineConfig } from 'vite';
import { injectIWER } from '@iwsdk/vite-plugin-iwer';

export default defineConfig({
  plugins: [
    injectIWER({
      device: 'metaQuest3',
      verbose: true,
    }),
  ],
});
```

## Configuration Options

```javascript
injectIWER({
  // XR device to emulate
  // Options: 'metaQuest2' | 'metaQuest3' | 'metaQuestPro' | 'oculusQuest1'
  device: 'metaQuest3', // default

  // Synthetic Environment Module for AR room simulation
  sem: {
    // Options: 'living_room' | 'meeting_room' | 'music_room' | 'office_large' | 'office_small'
    defaultScene: 'living_room',
  },

  // When to activate emulation
  // 'localhost' - only on localhost/127.0.0.1 (default)
  // 'always' - always activate
  // RegExp - custom hostname pattern
  activation: 'localhost',

  // Inject during production build (not just dev)
  injectOnBuild: false, // default

  // User-Agent pattern to skip (avoids injection on real XR browsers)
  userAgentException: /OculusBrowser/, // default

  // Enable verbose logging
  verbose: false, // default
});
```

## Usage Examples

### Basic VR Development

```javascript
injectIWER({
  device: 'metaQuest3',
});
```

### AR Development with Synthetic Environment

```javascript
injectIWER({
  device: 'metaQuest3',
  sem: {
    defaultScene: 'living_room',
  },
});
```

### Include in Production Build

```javascript
injectIWER({
  device: 'metaQuest3',
  injectOnBuild: true,
  activation: 'always',
});
```

## How It Works

1. During `vite dev`, the plugin bundles the IWER runtime and DevUI
2. The runtime is injected into `index.html` as a module script
3. IWER polyfills the WebXR API before your application loads
4. On real XR browsers (matching `userAgentException`), injection is skipped

## Output Example

```
🔧 IWER Plugin Configuration:
  - Device: metaQuest3
  - SEM: enabled (living_room)
  - Activation: localhost
  - UA exception: enabled
  - Inject on build: false

🥽 IWER Plugin Summary (Development):
  - Device: metaQuest3
  - Runtime injected: 245.3KB
  - Activation mode: localhost
  - SEM environment: living_room
  - Note: Runtime only activates on localhost/local networks
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import {
  injectIWER,
  type IWERPluginOptions,
  type SEMOptions,
} from '@iwsdk/vite-plugin-iwer';
```

## License

MIT © Meta Platforms, Inc.
