# Cross-Platform MCP Server Configuration

Research on how to configure MCP servers across multiple AI coding platforms, and tools that abstract away the differences.

## The Problem

Every AI coding tool uses a **different config file** for MCP servers, even though they all configure the same thing. If you ship an MCP server (like `@iwsdk/rag-mcp`), users on different platforms need different setup instructions.

## Project-Level Config Files by Platform

| Tool | Project-Level Config Path | Top-Level Key | Format |
| --- | --- | --- | --- |
| **Claude Code** | `.mcp.json` | `"mcpServers"` | JSON |
| **Visual Studio** | `.mcp.json` | `"servers"` | JSON |
| **VS Code (Copilot)** | `.vscode/mcp.json` | `"servers"` (nested under `"mcp"`) | JSON |
| **Cursor** | `.cursor/mcp.json` | `"mcpServers"` | JSON |
| **JetBrains Junie** | `.junie/mcp/mcp.json` | `"mcpServers"` | JSON |
| **Roo Code** | `.roo/mcp.json` | `"mcpServers"` | JSON |
| **Amazon Q** | `.amazonq/mcp.json` | `"mcpServers"` | JSON |
| **Kiro** | `.kiro/settings/mcp.json` | `"mcpServers"` | JSON |
| **Continue** | `.continue/mcpServers/mcp.json` | `"mcpServers"` | JSON |
| **Gemini CLI** | `.gemini/settings.json` | `"mcpServers"` | JSON |
| **OpenAI Codex** | `.codex/config.toml` | `[mcp_servers.<name>]` | **TOML** |
| **Goose** | `.goose/config.yaml` | `extensions` | **YAML** |
| **Windsurf** | **None (global only)** | `"mcpServers"` | JSON |
| **Zed** | `.zed/settings.json` | custom | JSON |

## Per-Server Schema (Shared Across Most Platforms)

The inner schema for defining an individual server is nearly identical everywhere:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": {
        "API_KEY": "xxx"
      }
    }
  }
}
```

### Key Differences

| Platform | Difference |
| --- | --- |
| **VS Code** | Nests under `"mcp"` -> `"servers"` instead of `"mcpServers"`; requires explicit `"type": "stdio"` field; supports an `"inputs"` array for secure secret prompting |
| **Codex** | Uses **TOML** with `[mcp_servers.<name>]` (underscores, not camelCase); `command` is an array, not a string |
| **Goose** | Uses **YAML** with an `extensions` key |
| **Windsurf** | Uses `serverUrl` for HTTP (others use `url`); global only, no project-level config |
| **Visual Studio** | Uses `"servers"` (not `"mcpServers"`) as the top-level key despite also using `.mcp.json` |

## Format Examples

### Majority of tools (Claude Code, Cursor, Junie, Roo, Amazon Q, Kiro, Gemini CLI, Continue)

```json
{
  "mcpServers": {
    "iwsdk-rag": {
      "command": "npx",
      "args": ["-y", "@iwsdk/rag-mcp"],
      "env": {}
    }
  }
}
```

### VS Code / GitHub Copilot

```json
{
  "mcp": {
    "servers": {
      "iwsdk-rag": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@iwsdk/rag-mcp"],
        "env": {}
      }
    }
  }
}
```

### OpenAI Codex

```toml
[mcp_servers.iwsdk-rag]
command = ["npx", "-y", "@iwsdk/rag-mcp"]
env = {}
enabled = true
```

### Goose

```yaml
extensions:
  iwsdk-rag:
    command: npx
    args:
      - -y
      - "@iwsdk/rag-mcp"
    env: {}
```

## Tools That Abstract This Away

### 1. `add-mcp` by Neon (CLI)

**Repository:** [neondatabase/add-mcp](https://github.com/neondatabase/add-mcp)

The most complete cross-platform solution. Writes the correct config file for each detected agent from a single command.

```bash
# Add to all detected agents
npx add-mcp @iwsdk/rag-mcp

# Target specific agents
npx add-mcp @iwsdk/rag-mcp -a cursor -a claude-code -a codex

# Global install
npx add-mcp @iwsdk/rag-mcp -g -a claude-code -y
```

**Supports:** Claude Code, Claude Desktop, Codex, Cursor, Gemini CLI, Goose, GitHub Copilot CLI, OpenCode, VS Code, Zed.

**Does NOT support:** Windsurf, JetBrains Junie, Amazon Q, Kiro, Roo Code.

### 2. `@gleanwork/mcp-config-schema` by Glean (Library)

**Repository:** [gleanwork/mcp-config-schema](https://github.com/gleanwork/mcp-config-schema)

A TypeScript/Zod library for **programmatic** config generation. Useful for building custom installer scripts.

```typescript
import { buildConfig } from '@gleanwork/mcp-config-schema';
// Define once, generate for any supported client
```

Key features:
- Registry API to query client capabilities
- Supports both stdio and HTTP transports
- Generates partial configs for merging into existing files
- Validation via Zod schemas

### 3. Other Notable Tools

| Tool | Description | Scope |
| --- | --- | --- |
| [MCPM.sh](https://github.com/pathintegral-institute/mcpm.sh) | Cross-client MCP package manager with profiles | User/global level |
| [Smithery CLI](https://smithery.ai/) | Registry + CLI with `--client` flag | User/global level |
| [mcp-sync](https://github.com/ztripez/mcp-sync) | Synchronizes configs across tools | User/global level |
| [MCP Linker](https://github.com/milisp/mcp-linker) | Syncs across 7+ clients | User/global level |
| [MCP Dock](https://github.com/OldJii/mcp-dock) | Desktop app for multi-client sync | User/global level |

## Is There a Universal Standard?

**No.** The [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25) defines the wire protocol only, not configuration file conventions. The config format is a de-facto convention that emerged organically.

There are two open discussions proposing a standard:
- [Discussion #2218: Universal MCP Configuration File Standard](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2218) (Open)
- [Discussion #681: Standardizing MCP Configuration File Format](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/681) (Closed)

Neither has official traction from Anthropic or other platform maintainers.

## Recommendation for `@iwsdk/rag-mcp`

1. **For end-user installation:** Document `npx add-mcp @iwsdk/rag-mcp` as the primary setup method — it handles platform detection and config generation automatically.

2. **For project-level (team) config:** Ship a `.mcp.json` in the repo root (covers Claude Code natively). Since the `mcpServers` schema is identical for Cursor/Junie/Roo/Amazon Q/Kiro/Gemini/Continue, a simple script can fan out the same content to their respective subdirectories. Only VS Code (key rename) and Codex (TOML conversion) need real transformation.

3. **For programmatic setup:** Use `@gleanwork/mcp-config-schema` if building a custom `setup` CLI command.

## VS Code Auto-Discovery

VS Code has a `chat.mcp.discovery.enabled` setting that auto-discovers MCP servers configured in other applications (like Claude Desktop). This can reduce duplication for users who already have the server configured elsewhere.

## Sources

- [neondatabase/add-mcp](https://github.com/neondatabase/add-mcp)
- [add-mcp blog post (Neon)](https://neon.com/blog/add-mcp)
- [gleanwork/mcp-config-schema](https://github.com/gleanwork/mcp-config-schema)
- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [Discussion #2218](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2218)
- [Discussion #681](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/681)
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp)
- [VS Code MCP Docs](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Cursor MCP Docs](https://docs.cursor.com/context/model-context-protocol)
- [Windsurf Cascade MCP Docs](https://docs.windsurf.com/windsurf/cascade/mcp)
- [OpenAI Codex MCP Docs](https://developers.openai.com/codex/mcp)
- [JetBrains Junie MCP Settings](https://www.jetbrains.com/help/junie/mcp-settings.html)
- [FastMCP - MCP JSON Configuration](https://gofastmcp.com/integrations/mcp-json-configuration)
- [MCPM.sh](https://github.com/pathintegral-institute/mcpm.sh)
- [Smithery.ai](https://smithery.ai/)
- [mcp-sync](https://github.com/ztripez/mcp-sync)
- [MCP Linker](https://github.com/milisp/mcp-linker)
