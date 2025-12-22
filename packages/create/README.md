<h1 align="center">create-iwsdk</h1>

<p align="center">
    <a href="https://www.npmjs.com/package/@iwsdk/create"><img src="https://badgen.net/npm/v/@iwsdk/create/?icon=npm&color=orange" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@iwsdk/create"><img src="https://badgen.net/npm/dt/@iwsdk/create" alt="npm download" /></a>
    <a href="https://raw.githubusercontent.com/facebook/immersive-web-sdk/main/LICENSE"><img src="https://badgen.net/github/license/facebook/immersive-web-sdk/" alt="license" /></a>
</p>

<p align="center"><strong>Scaffold a new Immersive Web SDK project in seconds.</strong></p>

## Quick Start

```bash
npm create @iwsdk@latest
```

Or with other package managers:

```bash
# pnpm
pnpm create @iwsdk@latest

# yarn
yarn create @iwsdk

# bun
bun create @iwsdk
```

## Interactive Prompts

The CLI will guide you through:

1. **Project name** - Directory name for your new project
2. **Language** - TypeScript or JavaScript
3. **Platform** - VR (Virtual Reality) or AR (Augmented Reality)
4. **XR Features** - Hand tracking, layers, anchors, hit-test, plane/mesh detection (tri-state: No/Optional/Required)
5. **SDK Features** - Locomotion (VR), Scene Understanding (AR), Grabbing, Physics
6. **Meta Spatial Editor** - Optional visual scene authoring integration
7. **Git & Install** - Initialize git repo and install dependencies

## What You Get

A fully configured project with:

- ⚡ **Vite** - Fast dev server with HMR
- 🎮 **WebXR Emulator** - Develop without VR hardware
- 📦 **GLTF Optimization** - Automatic asset compression
- 🔒 **HTTPS** - Required for WebXR, auto-configured
- 🏗️ **Meta Spatial Editor** - Visual scene authoring (optional)

## Example

```bash
$ npm create @iwsdk@latest

===============================================
IWSDK Create CLI v0.2.2
Node v20.19.0

? Project name › iwsdk-app
? Which language do you want to use? › TypeScript
? What type of experience are you building? › Virtual Reality
? Enable Hand Tracking? › Optional
? Enable WebXR Layers? › Optional
? Enable locomotion? › Yes
? Deploy locomotion engine on a Worker? › Yes (recommended)
? Enable grabbing (one/two-hand, distance)? › Yes
? Enable physics simulation (Havok)? › No
? Enable Meta Spatial Editor integration? › No (Can change later)
? Set up a Git repository? › Yes
? Install dependencies now? › Yes
```

## Command Line Options

```bash
# Provide project name directly
npm create @iwsdk@latest my-app

# Skip all prompts and use defaults
npm create @iwsdk@latest my-app -- -y

# Use custom CDN for recipes/assets
npm create @iwsdk@latest -- --assets-base https://my-cdn.com/iwsdk
```

| Flag                  | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `[name]`              | Project name (first positional argument)                 |
| `-y, --yes`           | Skip prompts and use defaults (VR + TypeScript + manual) |
| `--assets-base <url>` | Custom CDN base URL for recipes and assets               |

## Generated Templates

Based on your choices, one of these variants is generated:

| Template ID         | Description                           |
| ------------------- | ------------------------------------- |
| `vr-manual-ts`      | VR + TypeScript + code-only scene     |
| `vr-manual-js`      | VR + JavaScript + code-only scene     |
| `vr-metaspatial-ts` | VR + TypeScript + Meta Spatial Editor |
| `vr-metaspatial-js` | VR + JavaScript + Meta Spatial Editor |
| `ar-manual-ts`      | AR + TypeScript + code-only scene     |
| `ar-manual-js`      | AR + JavaScript + code-only scene     |
| `ar-metaspatial-ts` | AR + TypeScript + Meta Spatial Editor |
| `ar-metaspatial-js` | AR + JavaScript + Meta Spatial Editor |

## Requirements

- Node.js 20.19.0 or higher

## Documentation

For guides and tutorials, visit: **[https://iwsdk.dev](https://iwsdk.dev)**

## License

MIT © Meta Platforms, Inc.

---

<details>
<summary><strong>Development (for contributors)</strong></summary>

### Local Development

```bash
# Build the CLI
pnpm --filter @iwsdk/create build

# Run locally
pnpm --filter @iwsdk/create dev
```

### Module Layout

- `src/cli.ts` — Entrypoint: parses flags, runs prompts, scaffolds project
- `src/prompts.ts` — Interactive questions and defaults
- `src/recipes.ts` — Fetch helpers for CDN-hosted recipes
- `src/scaffold.ts` — Wraps Chef's `buildProject` and writes files
- `src/installer.ts` — Dependency installation and next steps
- `src/types.ts` — Shared types (`VariantId`, `TriState`, `PromptResult`)

### How It Works

The CLI uses [@pmndrs/chef](https://github.com/pmndrs/chef) to apply recipes fetched from jsDelivr CDN. Recipes and assets live in the `@iwsdk/starter-assets` package.

</details>
