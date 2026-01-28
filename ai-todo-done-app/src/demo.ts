/**
 * Demo script showing TO-DONE in action
 *
 * This demonstrates the full workflow without requiring user interaction.
 */

import {
  createTask,
  SkillRegistry,
  AgentMessage,
} from './types/index.js';
import { ToDoneAgent } from './agent/index.js';
import { TaskStore } from './store/index.js';
import { createBuiltinDirectory } from './skills/index.js';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(color: keyof typeof c, msg: string) {
  console.log(`${c[color]}${msg}${c.reset}`);
}

function divider(title: string) {
  console.log(`\n${c.bright}${'═'.repeat(50)}${c.reset}`);
  console.log(`${c.bright}  ${title}${c.reset}`);
  console.log(`${c.bright}${'═'.repeat(50)}${c.reset}\n`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demo() {
  divider('TO-DONE: AI Task Manager Demo');

  // Initialize components
  const store = new TaskStore();
  const skillRegistry = new SkillRegistry();
  const builtinDir = createBuiltinDirectory();
  skillRegistry.registerDirectory(builtinDir);

  const agent = new ToDoneAgent(skillRegistry, {
    autonomyLevel: 'moderate',
    confirmBeforeExecute: true,
  });

  // Subscribe to agent messages
  agent.onMessage((message: AgentMessage) => {
    switch (message.type) {
      case 'progress_update':
        log('cyan', `  🤖 ${message.message}`);
        break;
      case 'plan_ready':
        log('green', `  ✓ Plan generated!`);
        break;
      case 'research_complete':
        log('green', `  ✓ Research complete`);
        break;
    }
  });

  // Demo 1: Tax preparation task
  divider('Demo 1: Adding "Do my taxes" task');

  log('yellow', 'User types: "Do my taxes"');
  await sleep(500);

  let taxTask = createTask('Do my taxes', 'Need to file 2024 tax return');
  store.save(taxTask);

  log('dim', 'AI is processing the task...\n');
  taxTask = await agent.processTask(taxTask);
  store.save(taxTask);

  await sleep(500);

  // Display the plan
  if (taxTask.aiPlan) {
    console.log(`\n${c.bright}AI's Proposed Plan:${c.reset}`);
    console.log(`${c.yellow}Approach: ${taxTask.aiPlan.approach}${c.reset}`);
    console.log(`${c.dim}Estimated: ${taxTask.aiPlan.estimatedDuration}${c.reset}\n`);

    console.log(`${c.bright}Proposed Subtasks:${c.reset}`);
    taxTask.aiPlan.proposedSubtasks.forEach((st, i) => {
      const icon = st.canBeAutomated ? '🤖' : '👤';
      console.log(`  ${i + 1}. ${icon} ${st.title}`);
    });

    console.log(`\n${c.bright}Suggested Questions:${c.reset}`);
    taxTask.aiPlan.questionsForUser.forEach((q, i) => {
      console.log(`  ${c.magenta}${i + 1}. ${q}${c.reset}`);
    });
  }

  // User approves the plan
  await sleep(1000);
  divider('User approves the plan');

  log('yellow', 'User types: "approve"');
  await sleep(300);

  taxTask = await agent.approvePlan(taxTask);
  store.save(taxTask);

  log('green', '✓ Plan approved! Subtasks created.\n');

  console.log(`${c.bright}Active Subtasks:${c.reset}`);
  taxTask.subtasks.forEach((st, i) => {
    const icon = st.canBeAutomated ? '🤖' : '👤';
    console.log(`  ${i + 1}. ${icon} ${st.title} (${st.status})`);
  });

  // Show progress
  await sleep(500);
  divider('Checking progress');

  const progress = await agent.analyzeProgress(taxTask);
  console.log(`Progress: ${progress.progressPercentage}%`);
  console.log(`Summary: ${progress.summary}`);
  console.log(`\nNext steps:`);
  progress.nextSteps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step}`);
  });

  // Complete some subtasks
  await sleep(500);
  divider('User completes a subtask');

  log('yellow', 'User types: "complete 1"');
  await sleep(300);

  taxTask = agent.completeSubtask(taxTask, taxTask.subtasks[0].id);
  store.save(taxTask);

  log('green', `✓ Completed: ${taxTask.subtasks[0].title}\n`);

  // Demo 2: Running goal
  await sleep(500);
  divider('Demo 2: Adding "Run a 5K" task');

  log('yellow', 'User types: "Run a 5K race"');
  await sleep(500);

  let runTask = createTask('Run a 5K race', 'Complete a 5K run in the next 2 months');
  store.save(runTask);

  log('dim', 'AI is processing the task...\n');
  runTask = await agent.processTask(runTask);
  store.save(runTask);

  await sleep(500);

  // Display the plan
  if (runTask.aiPlan) {
    console.log(`\n${c.bright}AI's Proposed Plan:${c.reset}`);
    console.log(`${c.yellow}Approach: ${runTask.aiPlan.approach}${c.reset}\n`);

    console.log(`${c.bright}Training Plan:${c.reset}`);
    runTask.aiPlan.proposedSubtasks.forEach((st, i) => {
      console.log(`  ${i + 1}. ${st.title}`);
      console.log(`     ${c.dim}${st.description}${c.reset}`);
    });

    console.log(`\n${c.bright}Progress Metrics:${c.reset}`);
    runTask.aiPlan.proposedMetrics.forEach((m) => {
      console.log(`  • ${m.name}: 0 / ${m.targetValue} ${m.unit}`);
    });
  }

  // Approve and track progress
  await sleep(500);
  log('yellow', '\nUser approves the plan');
  runTask = await agent.approvePlan(runTask);
  store.save(runTask);

  // Update a metric
  divider('Tracking progress with metrics');

  log('yellow', 'User logs a 2-mile run');
  await sleep(300);

  const longestRunMetric = runTask.progressMetrics.find(
    (m) => m.name.includes('Longest')
  );
  if (longestRunMetric) {
    runTask = agent.updateMetric(runTask, longestRunMetric.id, 2, 'Morning run');
    store.save(runTask);
    log('green', `✓ Updated: Longest run is now 2 miles\n`);
  }

  // Show final state
  divider('Final Summary');

  console.log(`${c.bright}All Tasks:${c.reset}`);
  for (const task of store.getAll()) {
    const completed = task.subtasks.filter((s) => s.status === 'completed').length;
    const total = task.subtasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    console.log(`\n  ${c.cyan}${task.title}${c.reset}`);
    console.log(`  Status: ${task.status}`);
    console.log(`  Progress: ${completed}/${total} subtasks (${pct}%)`);

    if (task.progressMetrics.length > 0) {
      console.log(`  Metrics:`);
      task.progressMetrics.forEach((m) => {
        console.log(`    • ${m.name}: ${m.currentValue}/${m.targetValue} ${m.unit}`);
      });
    }
  }

  divider('Demo Complete!');

  console.log(`${c.dim}This demo showed:`);
  console.log(`  • Adding tasks that AI automatically analyzes`);
  console.log(`  • AI generating plans with subtasks and metrics`);
  console.log(`  • Clarification questions for better planning`);
  console.log(`  • Progress tracking with measurable goals`);
  console.log(`  • Subtask completion tracking${c.reset}`);
  console.log(`\n${c.cyan}Run "npm start" for the interactive CLI!${c.reset}\n`);
}

demo().catch(console.error);
