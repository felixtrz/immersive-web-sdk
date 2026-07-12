# GDC Launch Thread — IWSDK AI-Native Development

## Strategy Notes
- **Target**: Developers (WebXR, game dev, 3D, AI-curious)
- **Tone**: Founder-voice, confident, practical — not corporate
- **GDC**: Mentioned naturally once, not forced
- **Thread length**: 7 tweets (research sweet spot)
- **Key visual**: Screenshot appearing in terminal = "AI can see your 3D world"

---

## Tweet 1/7 — THE HOOK (with main demo video)

**Text:**
AI coding agents conquered text editors. But they've been blind to 3D.

We gave them eyes, hands, and a debugger for WebXR.

Introducing AI-native development for immersive apps — agents that can see into, interact with, and debug your running XR scenes.

Here's what that looks like:

**Media:** Main demo video (20-30s, sped up). Recording spec:
- Full-screen terminal showing Claude Code
- Prompt: something like "the button on the UI panel isn't responding to poke interactions, can you fix it?"
- Agent calls `browser_screenshot` — the XR scene appears inline in the terminal (THIS IS THE MONEY SHOT — pause the speedup here, let it breathe for 2-3 seconds)
- Agent calls `scene_get_hierarchy` to understand scene structure
- Agent reads the relevant component code, spots the issue
- Agent edits the file (brief, sped up)
- Agent calls `browser_reload_page`, then `browser_screenshot` again — fixed scene visible
- Optional: agent calls `xr_set_transform` + `xr_select` to verify the button works
- End frame: clean terminal with "Done" or similar

**Notes:** No music. Add text overlay captions for key moments: "taking screenshot of running XR scene" → "inspecting scene hierarchy" → "fixing the code" → "verifying the fix". White text, semi-transparent dark background, bottom of frame.

---

## Tweet 2/7 — THE "HOW" (architecture in plain English)

**Text:**
How it works:

Your AI agent gets 3 superpowers via MCP:

🎮 **Emulator** — position controllers, press buttons, trigger interactions. The agent uses your app like a real user.

👁️ **Scene tools** — see the full object hierarchy, query any transform. The agent understands spatial relationships.

🔧 **ECS debugger** — pause the world, step one frame, snapshot state, diff changes. Engine-level introspection.

All through standard MCP — works with Claude, Cursor, Copilot, Codex.

**Media:** A clean diagram/infographic showing the 3 categories as columns or a triangle:
- Left: "Interact" — icon of a VR controller, bullet: position, press, select
- Center: "Perceive" — icon of an eye, bullet: hierarchy, transforms, screenshots
- Right: "Debug" — icon of a wrench/gear, bullet: pause, step, snapshot, diff
- Bottom: MCP logo/text connecting to Claude/Cursor/Copilot/Codex logos
- Style: dark background, clean lines, your brand colors. Not a slide deck — think developer-tool marketing visual.

---

## Tweet 3/7 — ZERO CONFIG (the developer experience)

**Text:**
The best part: there's nothing to set up.

```
npm create @iwsdk
```

That's it. AI tooling is built into the framework from day one. Your dev server starts an MCP server automatically. Your editor connects. Your agent can see the scene.

No plugins to install. No config files to write. No "AI integration guide" to read.

**Media:** Screen recording (10-15s):
- Terminal: `npm create @iwsdk`
- Interactive prompts fly by (sped up) — project name, template selection
- `npm run dev` — dev server starts
- Brief flash of terminal output showing MCP server starting alongside Vite
- Cut to Claude Code connecting and taking its first screenshot of the freshly scaffolded XR scene

**Notes:** This clip should feel fast and effortless. Speed up everything except the final screenshot moment.

---

## Tweet 4/7 — THE ECS DEBUGGER (second demo clip)

**Text:**
The part that makes engine developers do a double-take:

Your AI agent can pause the ECS, step one frame forward, take a state snapshot, step again, and diff what changed.

It debugs frame-by-frame state transitions — something most developers can't easily do manually.

**Media:** Screen recording (10-15s, can be sped up):
- Terminal showing Claude Code
- Agent calls `ecs_pause` — "ECS paused"
- Agent calls `ecs_snapshot` — state captured
- Agent calls `ecs_step` — one frame advances
- Agent calls `ecs_snapshot` again
- Agent calls `ecs_diff` — diff output shows exactly what components/values changed between frames
- Agent reasons about the diff: "The velocity component updated but the position didn't — the physics system ran but the transform sync didn't"

**Notes:** The diff output is the visual payoff here. If possible, format/highlight it so the state changes are visually clear even at a glance.

---

## Tweet 5/7 — COLLABORATE MODE (human + AI)

**Text:**
It gets better: Collaborate mode.

You and the AI agent share the same running session. You position a controller exactly where you want it using the visual DevUI. The agent reads that transform and saves it.

Now it can reproduce your exact interaction autonomously — testing what you showed it, over and over.

Human teaches precision. Agent provides repetition.

**Media:** Screen recording or annotated screenshots (15-20s):
- Split or sequential view:
  - Left/first: Browser window showing the XR scene with DevUI visible — user dragging a controller to a precise position near a UI element
  - Right/second: Terminal showing the agent calling `xr_get_transform` to read the position the human just set, then using it in subsequent `xr_set_transform` + `xr_select` calls
- End: Agent repeating the interaction autonomously in a loop (optional, if easy to capture)

**Notes:** This is the "human-AI collaboration" moment. The visual should make it obvious that the human positioned something by hand and the agent learned from it.

---

## Tweet 6/7 — GDC + OPEN INVITATION

**Text:**
We're at GDC this week — come find us if you want to see this live.

But you don't need to wait. The framework is open source and the AI tooling ships with every new project today:

📦 npm create @iwsdk
📖 [docs link]
💻 [github link]

**Media:** None (clean text tweet — gives the thread visual breathing room, and links get better click-through without competing media).

**Notes:** Keep this short. The CTA is clear. If you have a booth number or specific GDC event, add it. If GDC mention isn't beneficial, replace with just the open source + links CTA.

---

## Tweet 7/7 — CTA + FORWARD-LOOKING

**Text:**
AI agents building 2D apps is yesterday's news. Agents building immersive 3D experiences — seeing the scene, touching the objects, debugging the engine — that's where this is going.

What would you build if your AI agent could see your 3D world?

**Media:** The single most visually striking screenshot from the demo — the moment the XR scene appears inline in the terminal. Static image, high res. This is the "poster frame" people will see when the thread gets quoted/shared.

**Notes:** End with a question to drive replies (13.5x algorithm weight). The static screenshot works as a standalone image if this tweet gets shared out of context.

---

## Production Checklist

- [ ] Record main demo video (Tweet 1) — 20-30s
- [ ] Record npm create quickstart clip (Tweet 3) — 10-15s
- [ ] Record ECS debug clip (Tweet 4) — 10-15s
- [ ] Record or screenshot collaborate mode (Tweet 5) — 15-20s
- [ ] Create 3-column architecture diagram (Tweet 2)
- [ ] Export hero screenshot for Tweet 7
- [ ] Add text overlay captions to all videos (no audio needed)
- [ ] Prepare links: docs URL, GitHub URL, GDC booth/event info
- [ ] Schedule for Tuesday-Thursday, 9-11 AM EST
- [ ] Line up team for immediate engagement in replies (first 30 min critical)
