<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1dgQMgfizygESKjiJYuf0RW2kQeWtskgo

## Run Locally

**Prerequisites:** Node.js 20.10+ (npm 10+ recommended). Verify with `node -v` and `npm -v`. Install via [Node.js downloads](https://nodejs.org/en/download) or a version manager such as [nvm](https://github.com/nvm-sh/nvm) before continuing.

1. Install dependencies: `npm install`
2. Set API credentials in [.env.local](.env.local):
   - `API_KEY` for the Vercel proxy at `api/proxy.js`
   - `GEMINI_API_KEY` for local scripts (e.g., `scripts/mcp_client.js`)
3. Run the app: `npm run dev`

## Deployment Readiness Checklist

1. **Runtime available:** Node.js 20.10+ with npm 10+ is required to run lint/build steps.
2. **Proxy present:** The Gemini proxy lives at `api/proxy.js` and expects `API_KEY` in the environment.
3. **Install dependencies:** `npm install`
4. **Quality gates:**
   - Lint: `npm run lint`
   - Build: `npm run build`
   - Preview: `npm run preview`
