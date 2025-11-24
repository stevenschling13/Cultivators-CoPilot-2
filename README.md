<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1dgQMgfizygESKjiJYuf0RW2kQeWtskgo

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## AI Studio MCP Bridge

Use the MCP bridge to exercise the AI Studio server tools directly from Node.js.

- **Requirements:** `GEMINI_API_KEY` in your environment and access to `npx` (installs `aistudio-mcp-server` on demand).
- **List tools / interactive session:** `npm run mcp` (shows tool names after initialization and streams responses as they arrive).
- **Single prompt execution:** `npm run mcp -- "Diagnose my canopy stress"` (the client routes the prompt into the first string parameter named `prompt`, `input`, `query`, `message`, or `text` exposed by the MCP tool schema).
- **Error handling:** User-facing errors mirror `GeminiService` conventions (limit, auth, safety, overload) so downstream callers see consistent messaging.

### Agent Workflow (GitHub Agents/Actions)

Other agents can invoke the same bridge in their workflows by adding an MCP server entry:

```json
{
  "mcpServers": {
    "aistudio": {
      "command": "npm",
      "args": ["run", "mcp", "--"],
      "env": { "GEMINI_API_KEY": "${{ secrets.GEMINI_API_KEY }}" }
    }
  }
}
```

Agents can then pass prompts as CLI arguments or keep the process interactive; the bridge will initialize, list available tools, and stream outputs so multi-agent runs stay synchronized.

## GitHub Copilot CLI (Public Preview)

Use GitHub Copilot directly from the terminal to stay aligned with the MCP bridge and local workflows.

- **Prerequisites:** Node.js 22+, npm 10+, and an active Copilot subscription. Ensure your organization allows Copilot CLI access.
- **Install:** `npm install -g @github/copilot` (re-run to update when needed).
- **Launch & authenticate:** Run `copilot` in the project root, use `/login` when prompted, and trust the working directory. You can also provide a fine-grained PAT via `GH_TOKEN` or `GITHUB_TOKEN` with the **Copilot Requests** permission.
- **Verify:** `copilot --banner` should show the animated banner. Then submit a prompt like `"Explain the files in this directory"` to confirm responses stream.
- **Model + MCP awareness:** By default the CLI uses Claude Sonnet 4.5, but you can switch with `/model`. The CLI already bundles GitHub's MCP server, so keep the `scripts/mcp_client.js` bridge available for custom tooling by exporting the `mcpServers` block above into `.github/agent.json` or local configs.
