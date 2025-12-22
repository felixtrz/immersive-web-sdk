# @iwsdk/starter-assets

CDN-hosted starter templates and assets for the IWSDK project scaffolding CLI. This package provides the recipes and assets used by `@iwsdk/create`.

> **Note**: This is an internal package used by `@iwsdk/create`. You typically don't need to install it directly.

## What's Included

- **Recipes** - Chef-compatible project templates for all IWSDK variants
- **Assets** - GLTF models, textures, and other starter content
- **Templates** - Pre-configured Vite projects for VR/AR development

## Template Variants

| ID                  | Description                           |
| ------------------- | ------------------------------------- |
| `vr-manual-ts`      | VR + TypeScript + code-only scene     |
| `vr-manual-js`      | VR + JavaScript + code-only scene     |
| `vr-metaspatial-ts` | VR + TypeScript + Meta Spatial Editor |
| `vr-metaspatial-js` | VR + JavaScript + Meta Spatial Editor |
| `ar-manual-ts`      | AR + TypeScript + code-only scene     |
| `ar-manual-js`      | AR + JavaScript + code-only scene     |
| `ar-metaspatial-ts` | AR + TypeScript + Meta Spatial Editor |
| `ar-metaspatial-js` | AR + JavaScript + Meta Spatial Editor |

## CDN URLs

Assets are served via jsDelivr:

```
Base: https://cdn.jsdelivr.net/npm/@iwsdk/starter-assets@<version>/dist
Recipes: .../recipes/index.json
Assets: .../assets/<variant-id>/public/...
```

## How It Works

1. `@iwsdk/create` fetches `recipes/index.json` to get available templates
2. User selects a variant through interactive prompts
3. The CLI fetches the recipe JSON for that variant
4. [@pmndrs/chef](https://github.com/pmndrs/chef) applies the recipe to scaffold the project
5. Binary assets (GLTF, images) are fetched from CDN URLs in the recipe

## Building (for contributors)

```bash
# Generate variants from starter-template and build assets
pnpm --filter @iwsdk/starter-assets build
```

This runs:

- `starter:sync` - Generates variant source files
- `build-assets.mjs` - Creates `dist/assets/` and `dist/recipes/`

## License

MIT © Meta Platforms, Inc.
