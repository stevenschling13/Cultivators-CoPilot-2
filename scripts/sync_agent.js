/**
 * AGENT SYNC TOOL v1.0
 * 
 * Automates the "Plan -> Execute -> Sync" loop for the Cultivator's Copilot architecture.
 * This tool bridges the local dev environment with GitHub to ensure @copilot reviews.
 * 
 * Usage: node scripts/sync_agent.js "Commit message/Summary of changes"
 * 
 * Prerequisites:
 * - Node.js
 * - git
 * - gh (GitHub CLI) - Optional but recommended for auto-PRs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI Colors for "Neon Noir" Console Output
const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m"
};

const log = (color, label, msg) => {
  console.log(`${color}[${label}]${COLORS.reset} ${msg}`);
};

const run = (command, ignoreError = false) => {
  try {
    return execSync(command, { stdio: 'pipe', encoding: 'utf-8' }).trim();
  } catch (e) {
    if (!ignoreError) {
      log(COLORS.red, "ERROR", `Command failed: ${command}`);
      console.error(e.stderr || e.message);
      process.exit(1);
    }
    return null;
  }
};

const main = () => {
  log(COLORS.cyan, "INIT", "Initializing Agent Sync Protocol...");

  // 1. Validate Git State
  const status = run('git status --porcelain');
  if (!status) {
    log(COLORS.yellow, "SKIP", "No changes detected. Workspace clean.");
    return;
  }

  // 2. Get Commit Message
  const args = process.argv.slice(2);
  let commitMsg = args[0];
  
  if (!commitMsg) {
    log(COLORS.red, "HALT", "Commit message required. Usage: node scripts/sync_agent.js \"Message\"");
    process.exit(1);
  }

  // Format: [Agent] Message (Timestamp)
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  const formattedMsg = `feat: ${commitMsg}`;

  // 3. Stage & Commit
  log(COLORS.green, "GIT", "Staging all changes...");
  run('git add .');
  
  log(COLORS.green, "GIT", `Committing: "${formattedMsg}"`);
  run(`git commit -m "${formattedMsg}"`);

  // 4. Push
  const branch = run('git branch --show-current');
  log(COLORS.green, "GIT", `Pushing to origin/${branch}...`);
  run(`git push origin ${branch}`);

  // 5. GitHub Collaboration Logic
  log(COLORS.cyan, "SYNC", "Engaging GitHub Remote...");
  
  const prTitle = `Agent Sync: ${commitMsg}`;
  const prBody = `
## 🤖 Agent Sync Report
**Timestamp:** ${timestamp}
**Agent:** Owner-Architect (Gemini 3 Pro)

## 📝 Change Summary
${commitMsg}

## 🧠 Review Request
cc: @copilot - Please analyze the architectural impact of these changes.
  `.trim();

  // Check if gh CLI exists
  const ghVersion = run('gh --version', true);
  
  if (ghVersion) {
    // Check if PR exists
    const prList = run(`gh pr list --head ${branch} --json url`, true);
    const existingPr = prList ? JSON.parse(prList) : [];

    if (existingPr.length > 0) {
      log(COLORS.yellow, "INFO", `PR already exists: ${existingPr[0].url}`);
      // Comment on existing PR to notify copilot
      run(`gh pr comment ${existingPr[0].url} --body "Updates pushed. @copilot please review."`, true);
      log(COLORS.green, "SUCCESS", "Updated existing PR with review request.");
    } else {
      log(COLORS.green, "ACTION", "Creating new Pull Request...");
      try {
        const prUrl = run(`gh pr create --title "${prTitle}" --body "${prBody}" --base main --head ${branch}`);
        log(COLORS.green, "SUCCESS", `PR Created: ${prUrl}`);
      } catch (e) {
        log(COLORS.red, "FAIL", "Could not create PR automatically.");
      }
    }
  } else {
    // Fallback if no GH CLI
    log(COLORS.yellow, "MANUAL", "GitHub CLI not found. To trigger @copilot review, create a PR manually.");
    console.log(`\n${COLORS.dim}--- PR Template ---${COLORS.reset}`);
    console.log(`Title: ${prTitle}`);
    console.log(`Body:\n${prBody}`);
    console.log(`${COLORS.dim}-------------------${COLORS.reset}\n`);
  }

  log(COLORS.cyan, "DONE", "Sync cycle complete. Architecture versioned.");
};

main();