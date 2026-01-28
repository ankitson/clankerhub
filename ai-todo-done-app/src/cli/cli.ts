/**
 * Interactive CLI for TO-DONE App
 *
 * A simple command-line interface for demonstrating the AI-powered task management.
 */

import * as readline from 'node:readline';
import {
  createTask,
  Task,
  SkillRegistry,
  AgentMessage,
} from '../types/index.js';
import { ToDoneAgent } from '../agent/index.js';
import { TaskStore } from '../store/index.js';
import { createBuiltinDirectory } from '../skills/index.js';

// ANSI colors for terminal output
const colors = {
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

function c(color: keyof typeof colors, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Main CLI Application
 */
export class ToDoneCLI {
  private store: TaskStore;
  private skillRegistry: SkillRegistry;
  private agent: ToDoneAgent;
  private rl: readline.Interface;
  private currentTask: Task | null = null;

  constructor() {
    // Initialize components
    this.store = new TaskStore({
      persistPath: './.todone/tasks.json',
      autoSave: true,
    });

    this.skillRegistry = new SkillRegistry();
    const builtinDir = createBuiltinDirectory();
    this.skillRegistry.registerDirectory(builtinDir);

    this.agent = new ToDoneAgent(this.skillRegistry, {
      autonomyLevel: 'moderate',
      confirmBeforeExecute: true,
    });

    // Subscribe to agent messages
    this.agent.onMessage(this.handleAgentMessage.bind(this));

    // Setup readline
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Handle messages from the agent
   */
  private handleAgentMessage(message: AgentMessage): void {
    switch (message.type) {
      case 'progress_update':
        console.log(c('cyan', `\n🤖 Agent: ${message.message}`));
        break;
      case 'research_complete':
        console.log(c('green', '\n✓ Research phase complete'));
        break;
      case 'plan_ready':
        console.log(c('green', '\n✓ Plan ready for review'));
        this.displayPlan(message.plan);
        break;
      case 'error':
        console.log(c('red', `\n✗ Error: ${message.error}`));
        break;
      case 'skill_executed':
        const status = message.result.success ? '✓' : '✗';
        console.log(
          c(message.result.success ? 'green' : 'red',
            `\n${status} Skill executed: ${message.skillId}`)
        );
        break;
    }
  }

  /**
   * Display a plan to the user
   */
  private displayPlan(plan: any): void {
    console.log('\n' + c('bright', '═══ AI Plan ═══'));
    console.log(c('yellow', `\nApproach: ${plan.approach}`));

    if (plan.estimatedDuration) {
      console.log(c('dim', `Estimated time: ${plan.estimatedDuration}`));
    }

    console.log(c('bright', '\nProposed Subtasks:'));
    plan.proposedSubtasks.forEach((st: any, i: number) => {
      const autoIcon = st.canBeAutomated ? '🤖' : '👤';
      console.log(`  ${i + 1}. ${autoIcon} ${st.title}`);
      if (st.description) {
        console.log(c('dim', `      ${st.description}`));
      }
    });

    if (plan.proposedMetrics?.length) {
      console.log(c('bright', '\nProgress Metrics:'));
      plan.proposedMetrics.forEach((m: any) => {
        console.log(`  • ${m.name}: 0 / ${m.targetValue} ${m.unit}`);
      });
    }

    if (plan.questionsForUser?.length) {
      console.log(c('bright', '\nQuestions for you:'));
      plan.questionsForUser.forEach((q: string, i: number) => {
        console.log(c('magenta', `  ${i + 1}. ${q}`));
      });
    }

    console.log('\n' + c('dim', 'Commands: "approve" to accept, "modify" to change, "skip" to work on something else'));
  }

  /**
   * Display a task
   */
  private displayTask(task: Task): void {
    const statusColors: Record<string, keyof typeof colors> = {
      pending: 'dim',
      researching: 'cyan',
      planning: 'cyan',
      awaiting_input: 'yellow',
      in_progress: 'blue',
      blocked: 'red',
      completed: 'green',
    };

    console.log('\n' + c('bright', `═══ ${task.title} ═══`));
    console.log(
      `Status: ${c(statusColors[task.status] || 'reset', task.status.toUpperCase())}`
    );

    if (task.description) {
      console.log(c('dim', task.description));
    }

    if (task.subtasks.length > 0) {
      console.log(c('bright', '\nSubtasks:'));
      task.subtasks.forEach((st, i) => {
        const icon = st.status === 'completed' ? '✓' : st.status === 'in_progress' ? '→' : '○';
        const color = st.status === 'completed' ? 'green' : st.status === 'blocked' ? 'red' : 'reset';
        console.log(c(color, `  ${icon} ${i + 1}. ${st.title}`));
      });
    }

    if (task.progressMetrics.length > 0) {
      console.log(c('bright', '\nProgress:'));
      task.progressMetrics.forEach((m) => {
        const pct = Math.round((m.currentValue / m.targetValue) * 100);
        const bar = this.progressBar(pct);
        console.log(`  ${m.name}: ${bar} ${m.currentValue}/${m.targetValue} ${m.unit}`);
      });
    }

    if (task.clarificationQuestions.some((q) => !q.answer)) {
      console.log(c('yellow', '\nPending Questions:'));
      task.clarificationQuestions
        .filter((q) => !q.answer)
        .forEach((q, i) => {
          console.log(c('magenta', `  ${i + 1}. ${q.question}`));
        });
    }
  }

  /**
   * Create a progress bar
   */
  private progressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
  }

  /**
   * Main prompt loop
   */
  private prompt(): void {
    const prefix = this.currentTask
      ? c('cyan', `[${this.currentTask.title}]`)
      : c('green', '[TO-DONE]');

    this.rl.question(`${prefix} > `, async (input) => {
      await this.handleInput(input.trim());
      this.prompt();
    });
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    if (!input) return;

    const [command, ...args] = input.split(' ');
    const argStr = args.join(' ');

    switch (command.toLowerCase()) {
      case 'add':
      case 'new':
        await this.addTask(argStr);
        break;

      case 'list':
      case 'ls':
        this.listTasks();
        break;

      case 'show':
      case 'view':
        this.showTask(argStr);
        break;

      case 'approve':
        await this.approvePlan();
        break;

      case 'complete':
      case 'done':
        await this.completeSubtask(argStr);
        break;

      case 'answer':
        await this.answerQuestion(argStr);
        break;

      case 'progress':
        await this.showProgress();
        break;

      case 'metric':
        await this.updateMetric(argStr);
        break;

      case 'skills':
        this.listSkills();
        break;

      case 'select':
        this.selectTask(argStr);
        break;

      case 'help':
        this.showHelp();
        break;

      case 'exit':
      case 'quit':
        this.exit();
        break;

      default:
        // Treat as a new task if it looks like one
        if (input.length > 3 && !input.startsWith('/')) {
          await this.addTask(input);
        } else {
          console.log(c('dim', `Unknown command: ${command}. Type "help" for commands.`));
        }
    }
  }

  /**
   * Add a new task
   */
  private async addTask(title: string): Promise<void> {
    if (!title) {
      console.log(c('red', 'Please provide a task title.'));
      return;
    }

    console.log(c('cyan', `\nAdding task: "${title}"`));
    const task = createTask(title);
    this.store.save(task);
    this.currentTask = task;

    // Start AI processing
    console.log(c('dim', 'AI is analyzing your task...'));
    const processedTask = await this.agent.processTask(task);
    this.currentTask = processedTask;
    this.store.save(processedTask);
  }

  /**
   * List all tasks
   */
  private listTasks(): void {
    const tasks = this.store.getAll();

    if (tasks.length === 0) {
      console.log(c('dim', '\nNo tasks yet. Add one with "add <task name>"'));
      return;
    }

    console.log(c('bright', '\n═══ Your Tasks ═══'));
    tasks.forEach((task, i) => {
      const statusIcon =
        task.status === 'completed' ? '✓' :
        task.status === 'in_progress' ? '→' :
        task.status === 'awaiting_input' ? '?' : '○';

      const color =
        task.status === 'completed' ? 'green' :
        task.status === 'blocked' ? 'red' :
        task.status === 'awaiting_input' ? 'yellow' : 'reset';

      const subtaskProgress = task.subtasks.length > 0
        ? ` (${task.subtasks.filter((s) => s.status === 'completed').length}/${task.subtasks.length})`
        : '';

      console.log(c(color, `  ${statusIcon} ${i + 1}. ${task.title}${subtaskProgress}`));
    });
    console.log('');
  }

  /**
   * Show a specific task
   */
  private showTask(idOrIndex: string): void {
    const task = this.findTask(idOrIndex) || this.currentTask;
    if (!task) {
      console.log(c('red', 'No task selected. Use "show <number>" or "select <number>".'));
      return;
    }
    this.displayTask(task);
  }

  /**
   * Approve the current plan
   */
  private async approvePlan(): Promise<void> {
    if (!this.currentTask) {
      console.log(c('red', 'No task selected.'));
      return;
    }

    if (!this.currentTask.aiPlan) {
      console.log(c('red', 'No plan to approve.'));
      return;
    }

    const approvedTask = await this.agent.approvePlan(this.currentTask);
    this.currentTask = approvedTask;
    this.store.save(approvedTask);
    console.log(c('green', '\n✓ Plan approved! Subtasks created.'));
    this.displayTask(approvedTask);
  }

  /**
   * Complete a subtask
   */
  private async completeSubtask(indexStr: string): Promise<void> {
    if (!this.currentTask) {
      console.log(c('red', 'No task selected.'));
      return;
    }

    const index = parseInt(indexStr, 10) - 1;
    if (isNaN(index) || index < 0 || index >= this.currentTask.subtasks.length) {
      console.log(c('red', `Invalid subtask number. Use 1-${this.currentTask.subtasks.length}`));
      return;
    }

    const subtask = this.currentTask.subtasks[index];
    const updatedTask = this.agent.completeSubtask(this.currentTask, subtask.id);
    this.currentTask = updatedTask;
    this.store.save(updatedTask);
    console.log(c('green', `\n✓ Completed: ${subtask.title}`));
  }

  /**
   * Answer a clarification question
   */
  private async answerQuestion(input: string): Promise<void> {
    if (!this.currentTask) {
      console.log(c('red', 'No task selected.'));
      return;
    }

    const unanswered = this.currentTask.clarificationQuestions.filter(
      (q) => !q.answer
    );

    if (unanswered.length === 0) {
      console.log(c('dim', 'No pending questions.'));
      return;
    }

    // Parse "1 My answer here" format
    const match = input.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      console.log(c('dim', 'Usage: answer <question number> <your answer>'));
      return;
    }

    const qIndex = parseInt(match[1], 10) - 1;
    const answer = match[2];

    if (qIndex < 0 || qIndex >= unanswered.length) {
      console.log(c('red', `Invalid question number. Use 1-${unanswered.length}`));
      return;
    }

    const question = unanswered[qIndex];
    const updatedTask = this.agent.answerQuestion(
      this.currentTask,
      question.id,
      answer
    );
    this.currentTask = updatedTask;
    this.store.save(updatedTask);
    console.log(c('green', `\n✓ Answered: "${question.question}"`));
  }

  /**
   * Show progress analysis
   */
  private async showProgress(): Promise<void> {
    if (!this.currentTask) {
      console.log(c('red', 'No task selected.'));
      return;
    }

    const analysis = await this.agent.analyzeProgress(this.currentTask);

    console.log('\n' + c('bright', '═══ Progress Report ═══'));
    console.log(`Overall: ${this.progressBar(analysis.progressPercentage)}`);
    console.log(c('cyan', `\n${analysis.summary}`));

    if (analysis.nextSteps.length > 0) {
      console.log(c('bright', '\nNext Steps:'));
      analysis.nextSteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
      });
    }

    if (analysis.blockers && analysis.blockers.length > 0) {
      console.log(c('red', '\nBlockers:'));
      analysis.blockers.forEach((blocker) => {
        console.log(`  • ${blocker}`);
      });
    }
  }

  /**
   * Update a metric
   */
  private async updateMetric(input: string): Promise<void> {
    if (!this.currentTask) {
      console.log(c('red', 'No task selected.'));
      return;
    }

    if (this.currentTask.progressMetrics.length === 0) {
      console.log(c('dim', 'No metrics defined for this task.'));
      return;
    }

    // Parse "1 5" format (metric index, value)
    const match = input.match(/^(\d+)\s+(\d+(?:\.\d+)?)\s*(.*)$/);
    if (!match) {
      console.log(c('dim', 'Usage: metric <metric number> <value> [note]'));
      console.log(c('dim', 'Metrics:'));
      this.currentTask.progressMetrics.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.name}: ${m.currentValue}/${m.targetValue} ${m.unit}`);
      });
      return;
    }

    const metricIndex = parseInt(match[1], 10) - 1;
    const value = parseFloat(match[2]);
    const note = match[3] || undefined;

    if (
      metricIndex < 0 ||
      metricIndex >= this.currentTask.progressMetrics.length
    ) {
      console.log(
        c('red', `Invalid metric number. Use 1-${this.currentTask.progressMetrics.length}`)
      );
      return;
    }

    const metric = this.currentTask.progressMetrics[metricIndex];
    const updatedTask = this.agent.updateMetric(
      this.currentTask,
      metric.id,
      value,
      note
    );
    this.currentTask = updatedTask;
    this.store.save(updatedTask);
    console.log(c('green', `\n✓ Updated ${metric.name}: ${value} ${metric.unit}`));
  }

  /**
   * List available skills
   */
  private listSkills(): void {
    console.log(c('bright', '\n═══ Available Skills ═══'));
    const skills = this.skillRegistry.getAllSkills();
    skills.forEach((skill) => {
      const autoIcon = '🤖';
      console.log(`\n${autoIcon} ${c('cyan', skill.name)}`);
      console.log(c('dim', `   ${skill.description}`));
      console.log(c('dim', `   Category: ${skill.category}`));
    });
  }

  /**
   * Select a task to work on
   */
  private selectTask(idOrIndex: string): void {
    const task = this.findTask(idOrIndex);
    if (!task) {
      console.log(c('red', 'Task not found.'));
      return;
    }
    this.currentTask = task;
    console.log(c('green', `\n✓ Selected: ${task.title}`));
    this.displayTask(task);
  }

  /**
   * Find a task by index or ID
   */
  private findTask(idOrIndex: string): Task | undefined {
    const index = parseInt(idOrIndex, 10) - 1;
    const tasks = this.store.getAll();

    if (!isNaN(index) && index >= 0 && index < tasks.length) {
      return tasks[index];
    }

    return this.store.get(idOrIndex);
  }

  /**
   * Show help
   */
  private showHelp(): void {
    console.log(c('bright', '\n═══ TO-DONE Commands ═══\n'));
    console.log('  add <task>      Add a new task (AI will analyze and plan)');
    console.log('  list            List all tasks');
    console.log('  show [n]        Show task details');
    console.log('  select <n>      Select a task to work on');
    console.log('  approve         Approve the AI\'s plan');
    console.log('  complete <n>    Mark subtask as complete');
    console.log('  answer <n> <a>  Answer a clarification question');
    console.log('  progress        Show progress analysis');
    console.log('  metric <n> <v>  Update a progress metric');
    console.log('  skills          List available AI skills');
    console.log('  help            Show this help');
    console.log('  exit            Exit the app');
    console.log(c('dim', '\n  Or just type a task to add it directly!'));
  }

  /**
   * Exit the app
   */
  private exit(): void {
    console.log(c('cyan', '\nGoodbye! Your tasks have been saved.\n'));
    this.rl.close();
    process.exit(0);
  }

  /**
   * Start the CLI
   */
  start(): void {
    console.log(c('bright', '\n════════════════════════════════════'));
    console.log(c('bright', '         TO-DONE: AI Task Manager    '));
    console.log(c('bright', '════════════════════════════════════\n'));
    console.log(c('cyan', 'Your AI assistant will help break down tasks and track progress.'));
    console.log(c('dim', 'Type "help" for commands or just type a task to get started.\n'));

    // Load and show existing tasks
    const tasks = this.store.getActive();
    if (tasks.length > 0) {
      console.log(c('dim', `You have ${tasks.length} active task(s).\n`));
    }

    this.prompt();
  }
}

/**
 * Entry point
 */
export function main(): void {
  const cli = new ToDoneCLI();
  cli.start();
}
