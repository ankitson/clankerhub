/**
 * Mock AI Provider for prototyping
 *
 * This simulates AI responses for the prototype.
 * In production, this would be replaced with actual LLM calls.
 */

import type {
  Task,
  AIPlan,
  AIProvider,
  Skill,
} from '../types/index.js';

/**
 * Task templates for common goals
 */
const TASK_TEMPLATES: Record<
  string,
  {
    keywords: string[];
    subtasks: Array<{
      title: string;
      description: string;
      estimatedMinutes: number;
      canBeAutomated: boolean;
      requiredSkill?: string;
    }>;
    metrics: Array<{ name: string; unit: string; targetValue: number }>;
    questions: string[];
    approach: string;
  }
> = {
  taxes: {
    keywords: ['tax', 'taxes', 'irs', 'tax return'],
    subtasks: [
      {
        title: 'Gather W-2 and employment documents',
        description: 'Collect all W-2 forms from employers',
        estimatedMinutes: 30,
        canBeAutomated: true,
        requiredSkill: 'file_search',
      },
      {
        title: 'Gather 1099 forms',
        description: 'Collect 1099-INT, 1099-DIV, 1099-B from brokerages',
        estimatedMinutes: 30,
        canBeAutomated: true,
        requiredSkill: 'file_search',
      },
      {
        title: 'Compile deduction receipts',
        description: 'Gather receipts for deductible expenses',
        estimatedMinutes: 60,
        canBeAutomated: false,
      },
      {
        title: 'Review last year\'s return',
        description: 'Check for any carryover items or recurring deductions',
        estimatedMinutes: 20,
        canBeAutomated: true,
        requiredSkill: 'file_search',
      },
      {
        title: 'Choose filing method',
        description: 'Decide between TurboTax, H&R Block, CPA, or self-file',
        estimatedMinutes: 30,
        canBeAutomated: false,
      },
      {
        title: 'Complete tax return',
        description: 'Fill out all required forms',
        estimatedMinutes: 120,
        canBeAutomated: false,
      },
      {
        title: 'Review and file',
        description: 'Double-check all entries and submit',
        estimatedMinutes: 30,
        canBeAutomated: false,
      },
    ],
    metrics: [
      { name: 'Documents gathered', unit: 'documents', targetValue: 10 },
      { name: 'Forms completed', unit: 'forms', targetValue: 5 },
    ],
    questions: [
      'Do you have any self-employment income this year?',
      'Did you have any major life changes (marriage, home purchase, children)?',
      'Do you have investments in taxable brokerage accounts?',
      'What filing method did you use last year?',
    ],
    approach:
      'I\'ll help you organize your tax preparation by first gathering all necessary documents, then guiding you through the filing process step by step.',
  },
  running: {
    keywords: ['run', '5k', 'marathon', 'running', 'jog', 'race'],
    subtasks: [
      {
        title: 'Assess current fitness level',
        description: 'Do a baseline run to understand starting point',
        estimatedMinutes: 30,
        canBeAutomated: false,
      },
      {
        title: 'Get proper running shoes',
        description: 'Visit a running store for fitting',
        estimatedMinutes: 60,
        canBeAutomated: false,
      },
      {
        title: 'Create training schedule',
        description: 'Build a week-by-week training plan',
        estimatedMinutes: 30,
        canBeAutomated: true,
        requiredSkill: 'calendar',
      },
      {
        title: 'Week 1-2: Base building',
        description: 'Easy runs of 1-2 miles, 3x per week',
        estimatedMinutes: 180,
        canBeAutomated: false,
      },
      {
        title: 'Week 3-4: Increase distance',
        description: 'Runs of 2-2.5 miles, 3-4x per week',
        estimatedMinutes: 240,
        canBeAutomated: false,
      },
      {
        title: 'Week 5-6: Build endurance',
        description: 'Runs of 2.5-3 miles with one longer run',
        estimatedMinutes: 300,
        canBeAutomated: false,
      },
      {
        title: 'Week 7-8: Race preparation',
        description: 'Include 3+ mile runs, then taper before race',
        estimatedMinutes: 240,
        canBeAutomated: false,
      },
      {
        title: 'Race day',
        description: 'Run the 5K!',
        estimatedMinutes: 45,
        canBeAutomated: false,
      },
    ],
    metrics: [
      { name: 'Longest run', unit: 'miles', targetValue: 3.5 },
      { name: 'Training runs completed', unit: 'runs', targetValue: 24 },
      { name: 'Weekly mileage', unit: 'miles', targetValue: 15 },
    ],
    questions: [
      'Have you run before? What\'s your current fitness level?',
      'Do you have a target race date or timeline in mind?',
      'Do you have any injuries or physical limitations?',
      'What time of day works best for your training runs?',
    ],
    approach:
      'I\'ll create a gradual 8-week training plan that builds your endurance safely. We\'ll start with short, easy runs and progressively increase distance.',
  },
  learning: {
    keywords: ['learn', 'study', 'course', 'skill', 'language', 'programming'],
    subtasks: [
      {
        title: 'Define learning objectives',
        description: 'What specifically do you want to be able to do?',
        estimatedMinutes: 30,
        canBeAutomated: false,
      },
      {
        title: 'Research learning resources',
        description: 'Find courses, books, tutorials',
        estimatedMinutes: 60,
        canBeAutomated: true,
        requiredSkill: 'research',
      },
      {
        title: 'Create learning schedule',
        description: 'Block time for daily/weekly practice',
        estimatedMinutes: 30,
        canBeAutomated: true,
        requiredSkill: 'calendar',
      },
      {
        title: 'Set up practice environment',
        description: 'Get necessary tools, accounts, materials',
        estimatedMinutes: 60,
        canBeAutomated: false,
      },
      {
        title: 'Begin structured learning',
        description: 'Start with fundamentals',
        estimatedMinutes: 300,
        canBeAutomated: false,
      },
      {
        title: 'Build practice projects',
        description: 'Apply what you\'ve learned',
        estimatedMinutes: 600,
        canBeAutomated: false,
      },
      {
        title: 'Review and assess progress',
        description: 'Test your knowledge, identify gaps',
        estimatedMinutes: 60,
        canBeAutomated: false,
      },
    ],
    metrics: [
      { name: 'Hours studied', unit: 'hours', targetValue: 50 },
      { name: 'Lessons completed', unit: 'lessons', targetValue: 20 },
      { name: 'Projects built', unit: 'projects', targetValue: 3 },
    ],
    questions: [
      'What is your current level with this topic?',
      'What\'s your goal - hobby, career change, or specific project?',
      'How much time can you dedicate per day/week?',
      'Do you prefer video courses, reading, or hands-on projects?',
    ],
    approach:
      'I\'ll help you create a structured learning path with clear milestones. We\'ll combine theory with practical projects to ensure the knowledge sticks.',
  },
  default: {
    keywords: [],
    subtasks: [
      {
        title: 'Clarify the goal',
        description: 'Define what success looks like',
        estimatedMinutes: 15,
        canBeAutomated: false,
      },
      {
        title: 'Research the topic',
        description: 'Gather relevant information',
        estimatedMinutes: 30,
        canBeAutomated: true,
        requiredSkill: 'research',
      },
      {
        title: 'Break down into actionable steps',
        description: 'Create a detailed task list',
        estimatedMinutes: 20,
        canBeAutomated: false,
      },
      {
        title: 'Execute steps',
        description: 'Work through the task list',
        estimatedMinutes: 120,
        canBeAutomated: false,
      },
      {
        title: 'Review and complete',
        description: 'Verify all requirements are met',
        estimatedMinutes: 15,
        canBeAutomated: false,
      },
    ],
    metrics: [
      { name: 'Subtasks completed', unit: 'tasks', targetValue: 5 },
    ],
    questions: [
      'Can you describe the desired outcome in more detail?',
      'Is there a deadline for this task?',
      'Are there any constraints or requirements I should know about?',
    ],
    approach:
      'I\'ll help you break this down into manageable steps. Let me first understand the requirements better.',
  },
};

/**
 * Find the best matching template for a task
 */
function findTemplate(taskTitle: string): typeof TASK_TEMPLATES.default {
  const titleLower = taskTitle.toLowerCase();

  for (const [, template] of Object.entries(TASK_TEMPLATES)) {
    if (template.keywords.some((kw) => titleLower.includes(kw))) {
      return template;
    }
  }

  return TASK_TEMPLATES.default;
}

/**
 * Generate a unique ID (imported from types doesn't work in mock, so duplicate here)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mock AI Provider implementation
 */
export class MockAIProvider implements AIProvider {
  async generatePlan(task: Task, _context: string): Promise<AIPlan> {
    // Simulate thinking time
    await this.simulateDelay(500);

    const template = findTemplate(task.title);

    return {
      id: generateId(),
      taskId: task.id,
      status: 'draft',
      summary: `Plan for: ${task.title}`,
      approach: template.approach,
      estimatedDuration: this.estimateDuration(template.subtasks),
      proposedSubtasks: template.subtasks,
      proposedMetrics: template.metrics,
      questionsForUser: template.questions,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
  }

  async research(
    topic: string,
    _context: string
  ): Promise<{
    summary: string;
    findings: string[];
    suggestedQuestions: string[];
  }> {
    await this.simulateDelay(1000);

    const template = findTemplate(topic);

    return {
      summary: `Research completed for: ${topic}`,
      findings: [
        `Found relevant information about ${topic}`,
        'Identified key steps and considerations',
        'Gathered best practices from similar tasks',
      ],
      suggestedQuestions: template.questions.slice(0, 2),
    };
  }

  async selectSkills(
    subtask: string,
    availableSkills: Skill[]
  ): Promise<{ skillId: string; input: Record<string, unknown> }[]> {
    await this.simulateDelay(200);

    // Simple keyword matching
    const subtaskLower = subtask.toLowerCase();
    const matches: { skillId: string; input: Record<string, unknown> }[] = [];

    for (const skill of availableSkills) {
      const skillText = `${skill.name} ${skill.description}`.toLowerCase();
      if (
        subtaskLower.split(' ').some((word) => skillText.includes(word))
      ) {
        matches.push({
          skillId: skill.id,
          input: { query: subtask },
        });
      }
    }

    return matches;
  }

  async generateQuestions(task: Task, _context: string): Promise<string[]> {
    await this.simulateDelay(300);

    const template = findTemplate(task.title);
    return template.questions;
  }

  async analyzeProgress(task: Task): Promise<{
    progressPercentage: number;
    summary: string;
    nextSteps: string[];
    blockers?: string[];
  }> {
    await this.simulateDelay(300);

    const completedSubtasks = task.subtasks.filter(
      (st) => st.status === 'completed'
    ).length;
    const totalSubtasks = task.subtasks.length || 1;
    const progressPercentage = Math.round(
      (completedSubtasks / totalSubtasks) * 100
    );

    const pendingSubtasks = task.subtasks
      .filter((st) => st.status === 'pending')
      .slice(0, 3);

    return {
      progressPercentage,
      summary:
        progressPercentage === 0
          ? 'Just getting started!'
          : progressPercentage === 100
          ? 'All subtasks completed!'
          : `${completedSubtasks} of ${totalSubtasks} subtasks completed`,
      nextSteps: pendingSubtasks.map((st) => st.title),
      blockers: task.clarificationQuestions
        .filter((q) => !q.answer)
        .map((q) => `Awaiting answer: ${q.question}`),
    };
  }

  private estimateDuration(
    subtasks: Array<{ estimatedMinutes: number }>
  ): string {
    const totalMinutes = subtasks.reduce(
      (sum, st) => sum + st.estimatedMinutes,
      0
    );
    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    }
    const hours = Math.round(totalMinutes / 60);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
