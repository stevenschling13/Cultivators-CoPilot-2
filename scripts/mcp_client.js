/**
 * MCP BRIDGE CLIENT v1.0
 * 
 * A standalone, zero-dependency Node.js client for the Model Context Protocol (MCP).
 * This script acts as a bridge between GitHub Agents/Actions and the Google AI Studio MCP Server.
 * 
 * Usage:
 * 1. List Tools: node scripts/mcp_client.js
 * 2. Execute Prompt: node scripts/mcp_client.js "Analyze the project structure"
 * 
 * Environment Requirement:
 * GEMINI_API_KEY must be set in the environment.
 */

const { spawn } = require('child_process');
const readline = require('readline');

// ANSI Colors
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m"
};

const log = (color, label, msg) => console.error(`${color}[${label}]${COLORS.reset} ${msg}`);

// Config
const SERVER_CMD = 'npx';
const SERVER_ARGS = ['-y', 'aistudio-mcp-server'];

const main = async () => {
  const prompt = process.argv[2];

  if (!process.env.GEMINI_API_KEY) {
    log(COLORS.red, "ERROR", "GEMINI_API_KEY is missing.");
    console.error("Please export GEMINI_API_KEY in your environment.");
    process.exit(1);
  }

  log(COLORS.cyan, "INIT", "Spawning AI Studio MCP Server...");

  const server = spawn(SERVER_CMD, SERVER_ARGS, {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', process.stderr] 
  });

  const rl = readline.createInterface({ input: server.stdout });
  let msgId = 0;
  let pendingRequests = new Map();

  // --- JSON-RPC 2.0 Helper ---
  const send = (method, params) => {
    const id = msgId++;
    const req = { jsonrpc: "2.0", id, method, params };
    const json = JSON.stringify(req);
    // log(COLORS.dim, "SEND", json);
    server.stdin.write(json + "\n");
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
    });
  };

  const sendNotify = (method, params) => {
    const req = { jsonrpc: "2.0", method, params };
    server.stdin.write(JSON.stringify(req) + "\n");
  };

  // --- Response Handler ---
  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      // log(COLORS.dim, "RECV", JSON.stringify(msg).slice(0, 100) + "...");

      if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    } catch (e) {
      // Ignore non-JSON lines (sometimes npx outputs text)
    }
  });

  try {
    // 1. Initialize
    log(COLORS.cyan, "MCP", "Handshaking...");
    const initResult = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { roots: { listChanged: true } },
      clientInfo: { name: "CultivatorBridge", version: "1.0.0" }
    });

    log(COLORS.green, "READY", `Server: ${initResult.serverInfo.name} v${initResult.serverInfo.version}`);
    sendNotify("notifications/initialized", {});

    // 2. List Tools
    log(COLORS.cyan, "MCP", "Discovering Capabilities...");
    const toolsResult = await send("tools/list", {});
    const tools = toolsResult.tools || [];
    
    if (!prompt) {
      console.log(`\n${COLORS.green}=== Available MCP Tools ===${COLORS.reset}`);
      tools.forEach(t => {
        console.log(`${COLORS.yellow}${t.name}${COLORS.reset}: ${t.description || 'No description'}`);
      });
      console.log(`\nRun with a prompt to execute: ${COLORS.dim}node scripts/mcp_client.js "Your query"${COLORS.reset}`);
      process.exit(0);
    }

    // 3. Execute Prompt (if provided)
    // We look for a standard generation tool. AI Studio usually exposes 'generate_content' or similar.
    // We'll attempt to find a relevant tool or default to the first one if it looks like a generator.
    const genTool = tools.find(t => t.name.includes('generate') || t.name.includes('content')) || tools[0];

    if (!genTool) {
      throw new Error("No generation tools found on MCP server.");
    }

    log(COLORS.cyan, "EXEC", `Invoking tool: ${genTool.name}...`);
    
    // Construct args - simplistic mapping for generic prompt
    // AI Studio MCP often expects 'user_prompt' or 'prompt'
    const args = {};
    const schema = genTool.inputSchema?.properties || {};
    if (schema.user_prompt) args.user_prompt = prompt;
    else if (schema.prompt) args.prompt = prompt;
    else if (schema.text) args.text = prompt;
    else {
        // Fallback: try to inject into first string property
        const key = Object.keys(schema).find(k => schema[k].type === 'string');
        if (key) args[key] = prompt;
    }
    
    // Include files context if referencing file (rudimentary support)
    if (schema.files && prompt.includes('file')) {
        // If the prompt asks about a file, we'd theoretically parse it here.
        // For this bridge script, we keep it simple.
    }

    const callResult = await send("tools/call", {
      name: genTool.name,
      arguments: args
    });

    console.log(`\n${COLORS.green}=== Gemini Response ===${COLORS.reset}\n`);
    
    // Parse Content
    if (callResult.content && Array.isArray(callResult.content)) {
        callResult.content.forEach(c => {
            if (c.type === 'text') console.log(c.text);
            else console.log(`[${c.type} Content]`);
        });
    } else {
        console.log(JSON.stringify(callResult, null, 2));
    }

  } catch (err) {
    log(COLORS.red, "FAIL", err.message || JSON.stringify(err));
    process.exit(1);
  } finally {
    server.kill();
    process.exit(0);
  }
};

main();