import { spawn } from "child_process";
import readline from "readline";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
};

const log = (color, label, message) => {
  console.log(`${color}[${label}]${COLORS.reset} ${message}`);
};

const normalizeError = (message) => {
  if (!message) return "Gemini Service Unavailable";
  const normalized = typeof message === "string" ? message : String(message);
  if (normalized.includes("429")) return "Daily API Limit Reached";
  if (normalized.includes("401")) return "Invalid API Key";
  if (normalized.toLowerCase().includes("safety")) return "Safety Block Triggered";
  if (normalized.includes("503")) return "Gemini Overloaded";
  return normalized;
};

const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  log(COLORS.red, "HALT", "GEMINI_API_KEY is missing. Export it before running the MCP bridge.");
  process.exit(1);
}

let requestId = 1;
const pendingRequests = new Map();

const server = spawn("npx", ["--yes", "aistudio-mcp-server"], {
  env: { ...process.env },
  stdio: ["pipe", "pipe", "pipe"]
});

const stdoutBuffer = { data: "" };

const sendRpc = (method, params = {}) => {
  const id = requestId++;
  const payload = { jsonrpc: "2.0", id, method, params };

  const promise = new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, method });
  });

  server.stdin.write(`${JSON.stringify(payload)}\n`);
  log(COLORS.cyan, "RPC", `-> ${method}`);
  return promise;
};

const handleResponse = (message) => {
  if (typeof message !== "object" || message === null) return;

  if (typeof message.id === "number" && pendingRequests.has(message.id)) {
    const pending = pendingRequests.get(message.id);
    pendingRequests.delete(message.id);

    if (message.error) {
      const normalized = normalizeError(message.error.message || "Unexpected error");
      pending.reject(new Error(normalized));
      return;
    }

    pending.resolve(message.result ?? message);
    return;
  }

  if (message.method) {
    if (message.params && message.params.event?.text) {
      log(COLORS.green, "STREAM", message.params.event.text);
    } else if (message.params && message.params.event?.data) {
      log(COLORS.green, "STREAM", JSON.stringify(message.params.event.data));
    } else {
      log(COLORS.green, "STREAM", JSON.stringify(message));
    }
  }
};

const processStdoutChunk = (chunk) => {
  stdoutBuffer.data += chunk.toString();
  const lines = stdoutBuffer.data.split("\n");
  stdoutBuffer.data = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      handleResponse(parsed);
    } catch (error) {
      log(COLORS.yellow, "INFO", line);
    }
  }
};

const listTools = async () => {
  const response = await sendRpc("tools/list", {});
  const tools = response?.tools ?? [];
  if (!Array.isArray(tools) || tools.length === 0) {
    throw new Error("No tools exposed by MCP server");
  }

  log(COLORS.cyan, "TOOLS", tools.map((tool) => tool.name).join(", "));
  return tools;
};

const selectPromptTool = (tools) => {
  const preferredKeys = ["prompt", "input", "query", "message", "text"];

  for (const tool of tools) {
    const properties = tool?.parameters?.properties;
    const required = tool?.parameters?.required ?? [];
    if (!properties) continue;

    const requiredKey = preferredKeys.find(
      (key) => properties[key]?.type === "string" && required.includes(key)
    );
    if (requiredKey) {
      return { tool, argKey: requiredKey };
    }

    const optionalKey = preferredKeys.find((key) => properties[key]?.type === "string");
    if (optionalKey) {
      return { tool, argKey: optionalKey };
    }
  }

  return null;
};

const callTool = async (tool, argKey, prompt) => {
  if (!prompt) {
    log(COLORS.yellow, "SKIP", "No prompt provided; skipping tool call.");
    return;
  }

  const args = { [argKey]: prompt };

  const required = tool.parameters?.required ?? [];
  const missingRequired = required.filter((key) => args[key] === undefined);
  if (missingRequired.length > 0) {
    throw new Error(`Missing required fields: ${missingRequired.join(", ")}`);
  }

  const response = await sendRpc("tools/call", { name: tool.name, arguments: args });

  if (response?.content) {
    response.content.forEach((item) => {
      if (item.type === "text" && item.text) {
        log(COLORS.green, "RESULT", item.text);
      } else {
        log(COLORS.green, "RESULT", JSON.stringify(item));
      }
    });
  } else if (response?.result) {
    log(COLORS.green, "RESULT", JSON.stringify(response.result));
  } else {
    log(COLORS.green, "RESULT", JSON.stringify(response));
  }
};

const bootstrap = async () => {
  await sendRpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: { streaming: true, tools: {} }
  });

  const tools = await listTools();
  const promptTool = selectPromptTool(tools);

  if (!promptTool) {
    throw new Error("No suitable prompt tool found (expected a string parameter like 'prompt' or 'input').");
  }

  log(
    COLORS.cyan,
    "INFO",
    `Routing user input to tool '${promptTool.tool.name}' via argument '${promptTool.argKey}'.`
  );

  const initialPrompt = process.argv.slice(2).join(" ");
  if (initialPrompt) {
    await callTool(promptTool.tool, promptTool.argKey, initialPrompt);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt("Prompt> ");
  rl.prompt();

  rl.on("line", async (input) => {
    const trimmed = input.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed.toLowerCase() === "exit") {
      rl.close();
      server.kill();
      return;
    }

    try {
      await callTool(promptTool.tool, promptTool.argKey, trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : normalizeError(String(error));
      log(COLORS.red, "ERROR", message);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    log(COLORS.cyan, "INFO", "Shutting down MCP client.");
    server.kill();
  });
};

server.stdout.on("data", processStdoutChunk);
server.stderr.on("data", (data) => {
  log(COLORS.yellow, "SERVER", data.toString().trim());
});

server.on("close", () => {
  log(COLORS.cyan, "INFO", "AI Studio MCP server stopped.");
});

server.on("error", (error) => {
  log(COLORS.red, "HALT", normalizeError(error.message));
  process.exit(1);
});

bootstrap().catch((error) => {
  const message = error instanceof Error ? error.message : normalizeError(String(error));
  log(COLORS.red, "HALT", message);
  server.kill();
  process.exit(1);
});
