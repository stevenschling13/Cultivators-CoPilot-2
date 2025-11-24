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

## GitHub MCP Server (Remote or Local)

Use the bundled `.vscode/mcp.json` to light up the GitHub MCP Server in hosts that support remote or local servers. The config adds:

- **Remote (hosted by GitHub):** `type: http` pointed at `https://api.githubcopilot.com/mcp/` with a prompt for your PAT (recommended scopes: `copilot`, `repo`, `read:org` depending on needed toolsets).
- **Local (Docker):** `command: docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server`. For GHES/ghe.com, add `-e GITHUB_HOST=your-ghes-host`; omit this flag for github.com. This reuses the same PAT input.
   > **Note:** To use GHES/ghe.com, manually edit `.vscode/mcp.json` to add the `GITHUB_HOST` environment variable to the `github-local` server's `env` section. For example:
   > ```json
   > "env": {
   >   "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_mcp_pat}",
   >   "GITHUB_HOST": "your-ghes-host"
   > }
   > ```

Quick start:

1. Create a GitHub Personal Access Token with the scopes you are comfortable granting to MCP tools.
2. Open VS Code 1.101+ (or another MCP host) and accept the `.vscode/mcp.json` workspace config when prompted.
3. Toggle Agent mode (VS Code Copilot Chat) to initialize the remote server, or start the local Docker flavor if you prefer running it yourself.
4. Adjust toolsets via `GITHUB_TOOLSETS` or `--toolsets` when running Docker if you want to narrow available GitHub APIs (e.g., `repos,issues,pull_requests`).
   > **Note:** To customize toolsets in `.vscode/mcp.json`, add the `GITHUB_TOOLSETS` environment variable to the `env` section, or add `--toolsets` to the `args` array of your server configuration. For example:
   > ```json
   > {
   >   "mcpServers": {
   >     "github-local": {
   >       "command": "docker",
   >       "args": [
   >         "run", "-i", "--rm",
   >         "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
   >         "-e", "GITHUB_TOOLSETS",
   >         "ghcr.io/github/github-mcp-server"
   >       ],
   >       "env": {
   >         "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_mcp_pat}",
   >         "GITHUB_TOOLSETS": "repos,issues,pull_requests"
   >       }
   >     }
   >   }
   > }
   > ```

## GitHub Copilot CLI (Public Preview)

Use GitHub Copilot directly from the terminal to stay aligned with the MCP bridge and local workflows.

- **Prerequisites:** Node.js 22+, npm 10+, and an active Copilot subscription. Ensure your organization allows Copilot CLI access.
- **Install:** `npm install -g @github/copilot` (re-run to update when needed).
- **Launch & authenticate:** Run `copilot` in the project root, use `/login` when prompted, and trust the working directory. You can also provide a fine-grained PAT via `GH_TOKEN` or `GITHUB_TOKEN` with the **Copilot Requests** permission.
- **Verify:** `copilot --banner` should show the animated banner. Then submit a prompt like `"Explain the files in this directory"` to confirm responses stream.
- **Model + MCP awareness:** By default the CLI uses Claude Sonnet 4.5, but you can switch with `/model`. The CLI already bundles GitHub's MCP server, so keep the `scripts/mcp_client.js` bridge available for custom tooling by exporting the `mcpServers` block above into `.github/agent.json` or local configs.

## Cloud Build trigger (GCP)

Use the bundled `cloudbuild.yaml` for a simple CI flow in Google Cloud Build. To recreate the trigger referenced in the project brief:

1. **Trigger type:** Push to a branch (2nd gen, GitHub App repository).
2. **Repository:** `stevenschling13/Cultivators-CoPilot-2` with branch regex `^main$` (no inversion).
3. **Location:** Region `global`.
4. **Configuration:** Use the repo-stored `cloudbuild.yaml` at the repository root.
5. **Service account:** `959574223828-compute@developer.gserviceaccount.com` (replace if you need least-privilege).
6. **Logs:** Enable "Send build logs to GitHub" if you want GitHub-visible build logs.

The pipeline installs dependencies with `npm ci` and runs the production build via `npm run build`, keeping logs in Cloud Logging.
