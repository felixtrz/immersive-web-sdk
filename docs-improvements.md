# API Documentation Improvements

This document tracks issues and improvements needed for the API documentation.

---

## Build Warnings

### 1. Unknown JSDoc Tag `@hideineditor`

**Files affected:**

- `packages/core/src/transform/transform.ts:33`
- `packages/core/src/level/level-tag.ts:19`
- `packages/core/src/level/level-root.ts:18`
- `packages/core/src/ui/ui.ts:79`
- `packages/core/src/input/state-tags.ts:50`
- `packages/core/src/input/state-tags.ts:66`

**Fix:** Register `@hideineditor` as a known block tag in `typedoc.json`:

```json
"blockTags": ["@hideineditor"]
```

### 2. Broken Internal Links

- `@iwsdk/locomotor!Locomotor` - referenced in `LocomotionSystem` but not resolvable
- `WorldOptions.features.enableLocomotion` - referenced but not resolvable
- `initializeWorld` has `@param sceneContainer` that doesn't match actual parameter

**Fix:** Update JSDoc `@see` and `@link` references in `LocomotionSystem` and `initializeWorld`.

### 3. External Symbol Links (Three.js)

TypeDoc warns about links to Three.js types not included in docs:

- `matrixWorldNeedsUpdate`
- `matrixWorldAutoUpdate`
- `force` parameter

**Fix:** Add `externalSymbolLinkMappings` in `typedoc.json` to map Three.js types to their documentation URLs.

---

## Coverage Issues

### 1. Classes Missing JSDoc Descriptions

Many classes have no class-level JSDoc, resulting in documentation pages with only method signatures:

**@iwsdk/xr-input package:**

- `XRInputManager` - No class description (critical - main entry point for input)
- `StatefulGamepad` - No class description
- `MultiPointer` - No class description
- `GrabPointer` - No class description
- `XROrigin` - No class description
- `AnimatedController` - No class description
- `AnimatedHand` - No class description
- `XRControllerVisualAdapter` - No class description
- `XRHandVisualAdapter` - No class description
- `FlexBatchedMesh` - No class description

**@iwsdk/glxf package:**

- `GLXFLoader` - No class description

**@iwsdk/core package:**

- `AssetManager` - No class description
- `CacheManager` - No class description
- `AudioPool` - No class description
- `AudioUtils` - No class description
- `CameraUtils` - No class description
- `EntityCreator` - No class description
- `GLXFImporter` - No class description
- `SyncedEuler` - No class description
- `SyncedQuaternion` - No class description
- `SyncedVector3` - No class description

### 2. Methods Missing Descriptions

Most methods across all classes lack descriptions. Examples:

- `StatefulGamepad` - 30+ methods with no descriptions (just signatures)
- `XRInputManager.update()` - No description
- `Locomotor.addEnvironment()` - No description
- `Locomotor.removeEnvironment()` - No description
- `GLXFLoader.load()`, `parse()`, `parseAsync()` - No descriptions

### 3. Properties Missing Descriptions

Most properties lack descriptions explaining their purpose:

- `XRInputManager.gamepads` - No description
- `XRInputManager.multiPointers` - No description
- `Locomotor.hitTestNormal` - No description
- `Locomotor.hitTestTarget` - No description

### 4. Interfaces Missing Field Descriptions

- `GLXFAsset`, `GLXFNode`, `GLXFScene`, `GLXFData` - No field descriptions
- `XRInputOptions` - No field descriptions
- `XRInputDeviceConfig` - No field descriptions

### 5. Missing `@category` Tags

Many exports lack category tags, causing them to be dumped into "Other":

- Camera-related items should have `@category Camera`
- Physics constants (`DEFAULT_FRICTION`, etc.) should have `@category Physics`
- `VERSION` should have `@category Runtime`
- Many utility functions lack categories

---

## Quality Issues

### 1. Unresolved `{@link}` References Showing as Raw Text

In `LocomotionSystem.md`, links appear as raw syntax instead of being resolved:

```
{@link @iwsdk/locomotor!Locomotor}
{@link WorldOptions.features.enableLocomotion}
{@link LocomotionEnvironment}
```

**Fix:** Either fix the link syntax or remove broken links.

### 2. Missing Examples

Most classes and methods lack `@example` blocks:

- `XRInputManager` - No usage examples
- `StatefulGamepad` - No examples for button/axes methods
- `Locomotor` - No examples
- `GLXFLoader` - No examples
- Vite plugins - Minimal examples

### 3. Incomplete Parameter Descriptions

Many function parameters lack descriptions:

- `initializeWorld(container, options)` - `container` has no description
- Most method parameters across all classes

### 4. Empty Default Values in Schema Docs

Some schema fields show empty default values:

- `LocomotionSystem.rayGravity` - Default shows as empty (should be `-9.8` or similar)
- `Transform.parent` - Default shows as empty
- `OneHandGrabbable.rotateMin` - Shows `[, , ]` instead of `[-Infinity, -Infinity, -Infinity]`

---

## Readability Issues

### 1. Grammatical Issues in Generated Intro Sentences

The post-processor generates awkward sentences:

- "Transform is component for..." → should be "Transform is a component for..."
- "OneHandGrabbable is component for..." → should be "OneHandGrabbable is a component for..."

**Fix:** Update `postprocess-typedoc.cjs` to handle the grammar correctly.

### 2. Index Page Titles

Package index pages have unclear titles:

- `core/src` → should be `@iwsdk/core` or just `Core`
- Similar issues for other packages

### 3. Long Method Lists Without Grouping

`StatefulGamepad` has 30+ methods listed sequentially without any grouping or categorization, making it hard to find what you need.

### 4. Type Display Issues

- `Vec4` type is not being mapped to `[number, number, number, number]` in Transform component
- Some complex types are hard to read

---

## Post-Processing Issues

### 1. Negative Infinity Values Not Rendered

`-Infinity` values in default arrays render as empty:

```
Default value: `[, , ]`  // Should be `[-Infinity, -Infinity, -Infinity]`
```

**Fix:** Update `postprocess-typedoc.cjs` to handle `-Infinity` in `toStr()` function.

### 2. Vec4 Type Not Mapped

The `mapTypeName()` function maps `Types.Vec3` but not `Types.Vec4`:

```javascript
// Missing:
.replace(/Types\.Vec4\b/g, '[number, number, number, number]')
```

### 3. Entity Type Not Mapped

`Types.Entity` is not mapped to a readable type name.

---

## Structural/Navigation Issues

### 1. "Other" Category is a Catch-All

The "Other" category in the sidebar contains unrelated items:

- Camera utilities
- Physics constants
- Visibility types
- Version info
- XR session helpers

**Fix:** Create more specific categories or assign proper `@category` tags.

### 2. Missing Package Overview Pages

Each package index page is just a list of links. Should include:

- Package description
- Installation instructions
- Quick start example
- Links to related guides

### 3. No Search Guidance

API docs don't indicate how items relate to each other or common use patterns.

---

## Priority Recommendations

### High Priority (Affects usability significantly)

1. Add JSDoc descriptions to `XRInputManager`, `StatefulGamepad`, `Locomotor`
2. Fix broken `{@link}` references in `LocomotionSystem`
3. Add examples to core classes
4. Fix grammatical issues in post-processor

### Medium Priority (Improves quality)

1. Add descriptions to all public methods
2. Fix empty default value rendering
3. Add missing `@category` tags
4. Map `Vec4` and `Entity` types

### Low Priority (Polish)

1. Add package overview pages
2. Group related methods in large classes
3. Add external symbol mappings for Three.js
4. Register `@hideineditor` tag

---

## Files to Modify

| File                                                | Changes Needed                                      |
| --------------------------------------------------- | --------------------------------------------------- |
| `typedoc.json`                                      | Add `blockTags`, `externalSymbolLinkMappings`       |
| `scripts/postprocess-typedoc.cjs`                   | Fix grammar, add Vec4/Entity mapping, fix -Infinity |
| `packages/xr-input/src/xr-input-manager.ts`         | Add class JSDoc, method descriptions                |
| `packages/xr-input/src/gamepad/stateful-gamepad.ts` | Add class JSDoc, method descriptions                |
| `packages/locomotor/src/core/locomotor.ts`          | Add method descriptions                             |
| `packages/glxf/src/glxf-loader.ts`                  | Add class/method JSDoc                              |
| `packages/core/src/locomotion/locomotion.ts`        | Fix broken links                                    |
| Multiple component files                            | Add `@category` tags                                |
