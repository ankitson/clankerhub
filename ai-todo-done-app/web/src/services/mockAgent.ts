/**
 * Mock Agent Service for the Web UI
 * Simulates AI behavior for the prototype
 */

import { Task, AIPlan, ClarificationQuestion, Subtask, ProgressMetric, generateId } from '../types';

// Task templates for common goals
const TASK_TEMPLATES: Record<string, {
  keywords: string[];
  subtasks: Array<{
    title: string;
    description: string;
    estimatedMinutes: number;
    canBeAutomated: boolean;
  }>;
  metrics: Array<{ name: string; unit: string; targetValue: number }>;
  questions: string[];
  approach: string;
}> = {
  taxes: {
    keywords: ['tax', 'taxes', 'irs', 'tax return'],
    subtasks: [
      { title: 'Gather W-2 and employment documents', description: 'Collect all W-2 forms from employers', estimatedMinutes: 30, canBeAutomated: true },
      { title: 'Gather 1099 forms', description: 'Collect 1099-INT, 1099-DIV, 1099-B from brokerages', estimatedMinutes: 30, canBeAutomated: true },
      { title: 'Compile deduction receipts', description: 'Gather receipts for deductible expenses', estimatedMinutes: 60, canBeAutomated: false },
      { title: 'Review last year\'s return', description: 'Check for carryover items', estimatedMinutes: 20, canBeAutomated: true },
      { title: 'Choose filing method', description: 'TurboTax, H&R Block, CPA, or self-file', estimatedMinutes: 30, canBeAutomated: false },
      { title: 'Complete tax return', description: 'Fill out all required forms', estimatedMinutes: 120, canBeAutomated: false },
      { title: 'Review and file', description: 'Double-check and submit', estimatedMinutes: 30, canBeAutomated: false },
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
    approach: 'I\'ll help you organize your tax preparation by first gathering all necessary documents, then guiding you through the filing process step by step.',
  },
  running: {
    keywords: ['run', '5k', 'marathon', 'running', 'jog', 'race'],
    subtasks: [
      { title: 'Assess current fitness level', description: 'Do a baseline run', estimatedMinutes: 30, canBeAutomated: false },
      { title: 'Get proper running shoes', description: 'Visit a running store', estimatedMinutes: 60, canBeAutomated: false },
      { title: 'Create training schedule', description: 'Build week-by-week plan', estimatedMinutes: 30, canBeAutomated: true },
      { title: 'Week 1-2: Base building', description: 'Easy runs of 1-2 miles, 3x per week', estimatedMinutes: 180, canBeAutomated: false },
      { title: 'Week 3-4: Increase distance', description: 'Runs of 2-2.5 miles, 3-4x per week', estimatedMinutes: 240, canBeAutomated: false },
      { title: 'Week 5-6: Build endurance', description: 'Runs of 2.5-3 miles with one longer run', estimatedMinutes: 300, canBeAutomated: false },
      { title: 'Week 7-8: Race preparation', description: 'Include 3+ mile runs, then taper', estimatedMinutes: 240, canBeAutomated: false },
      { title: 'Race day', description: 'Run the 5K!', estimatedMinutes: 45, canBeAutomated: false },
    ],
    metrics: [
      { name: 'Longest run', unit: 'miles', targetValue: 3.5 },
      { name: 'Training runs completed', unit: 'runs', targetValue: 24 },
      { name: 'Weekly mileage', unit: 'miles', targetValue: 15 },
    ],
    questions: [
      'Have you run before? What\'s your current fitness level?',
      'Do you have a target race date in mind?',
      'Do you have any injuries or physical limitations?',
      'What time of day works best for training?',
    ],
    approach: 'I\'ll create a gradual 8-week training plan that builds your endurance safely. We\'ll start with short, easy runs and progressively increase distance.',
  },
  learning: {
    keywords: ['learn', 'study', 'course', 'skill', 'language', 'programming', 'code'],
    subtasks: [
      { title: 'Define learning objectives', description: 'What do you want to be able to do?', estimatedMinutes: 30, canBeAutomated: false },
      { title: 'Research learning resources', description: 'Find courses, books, tutorials', estimatedMinutes: 60, canBeAutomated: true },
      { title: 'Create learning schedule', description: 'Block time for practice', estimatedMinutes: 30, canBeAutomated: true },
      { title: 'Set up practice environment', description: 'Get tools and materials', estimatedMinutes: 60, canBeAutomated: false },
      { title: 'Begin structured learning', description: 'Start with fundamentals', estimatedMinutes: 300, canBeAutomated: false },
      { title: 'Build practice projects', description: 'Apply what you\'ve learned', estimatedMinutes: 600, canBeAutomated: false },
      { title: 'Review and assess progress', description: 'Test knowledge, identify gaps', estimatedMinutes: 60, canBeAutomated: false },
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
    approach: 'I\'ll help you create a structured learning path with clear milestones. We\'ll combine theory with practical projects.',
  },
};

const DEFAULT_TEMPLATE = {
  subtasks: [
    { title: 'Clarify the goal', description: 'Define what success looks like', estimatedMinutes: 15, canBeAutomated: false },
    { title: 'Research the topic', description: 'Gather relevant information', estimatedMinutes: 30, canBeAutomated: true },
    { title: 'Break down into steps', description: 'Create detailed task list', estimatedMinutes: 20, canBeAutomated: false },
    { title: 'Execute steps', description: 'Work through the task list', estimatedMinutes: 120, canBeAutomated: false },
    { title: 'Review and complete', description: 'Verify requirements met', estimatedMinutes: 15, canBeAutomated: false },
  ],
  metrics: [{ name: 'Subtasks completed', unit: 'tasks', targetValue: 5 }],
  questions: [
    'Can you describe the desired outcome in more detail?',
    'Is there a deadline for this task?',
    'Are there any constraints I should know about?',
  ],
  approach: 'I\'ll help you break this down into manageable steps. Let me understand the requirements better.',
};

function findTemplate(title: string) {
  const titleLower = title.toLowerCase();
  for (const [, template] of Object.entries(TASK_TEMPLATES)) {
    if (template.keywords.some(kw => titleLower.includes(kw))) {
      return template;
    }
  }
  return DEFAULT_TEMPLATE;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function processTask(task: Task, onProgress: (message: string) => void): Promise<Task> {
  // Research phase
  onProgress('Researching your task...');
  await delay(800);

  const template = findTemplate(task.title);

  task = {
    ...task,
    status: 'researching',
    researchFindings: [{
      id: generateId(),
      topic: task.title,
      summary: `Found relevant information about ${task.title}`,
      sources: [],
      confidence: 'medium',
      timestamp: Date.now(),
    }],
    modifiedAt: Date.now(),
  };

  // Planning phase
  onProgress('Creating a plan...');
  await delay(600);

  const totalMinutes = template.subtasks.reduce((sum, st) => sum + st.estimatedMinutes, 0);
  const estimatedDuration = totalMinutes < 60
    ? `${totalMinutes} minutes`
    : `${Math.round(totalMinutes / 60)} hours`;

  const plan: AIPlan = {
    id: generateId(),
    taskId: task.id,
    status: 'draft',
    summary: `Plan for: ${task.title}`,
    approach: template.approach,
    estimatedDuration,
    proposedSubtasks: template.subtasks,
    proposedMetrics: template.metrics,
    questionsForUser: template.questions,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };

  const questions: ClarificationQuestion[] = template.questions.map(q => ({
    id: generateId(),
    question: q,
    context: `Related to: ${task.title}`,
  }));

  task = {
    ...task,
    status: 'awaiting_input',
    aiPlan: plan,
    clarificationQuestions: questions,
    aiReasoning: template.approach,
    modifiedAt: Date.now(),
  };

  onProgress('Plan ready for your review!');
  return task;
}

export function approvePlan(task: Task): Task {
  if (!task.aiPlan) throw new Error('No plan to approve');

  const subtasks: Subtask[] = task.aiPlan.proposedSubtasks.map((st, i) => ({
    id: generateId(),
    parentTaskId: task.id,
    title: st.title,
    description: st.description,
    status: 'pending' as const,
    estimatedMinutes: st.estimatedMinutes,
    order: i,
    createdAt: Date.now(),
    canBeAutomated: st.canBeAutomated,
  }));

  const metrics: ProgressMetric[] = task.aiPlan.proposedMetrics.map(m => ({
    id: generateId(),
    name: m.name,
    unit: m.unit,
    currentValue: 0,
    targetValue: m.targetValue,
    history: [],
  }));

  return {
    ...task,
    subtasks,
    progressMetrics: metrics,
    aiPlan: { ...task.aiPlan, status: 'approved', approvedAt: Date.now() },
    status: 'in_progress',
    modifiedAt: Date.now(),
  };
}

export function completeSubtask(task: Task, subtaskId: string): Task {
  const updatedSubtasks = task.subtasks.map(st =>
    st.id === subtaskId
      ? { ...st, status: 'completed' as const, completedAt: Date.now() }
      : st
  );

  const allComplete = updatedSubtasks.every(st => st.status === 'completed');

  return {
    ...task,
    subtasks: updatedSubtasks,
    status: allComplete ? 'completed' : task.status,
    completedAt: allComplete ? Date.now() : undefined,
    modifiedAt: Date.now(),
  };
}

export function updateMetric(task: Task, metricId: string, value: number, note?: string): Task {
  const updatedMetrics = task.progressMetrics.map(m =>
    m.id === metricId
      ? {
          ...m,
          currentValue: value,
          history: [...m.history, { timestamp: Date.now(), value, note }],
        }
      : m
  );

  return {
    ...task,
    progressMetrics: updatedMetrics,
    modifiedAt: Date.now(),
  };
}

export function answerQuestion(task: Task, questionId: string, answer: string): Task {
  const updatedQuestions = task.clarificationQuestions.map(q =>
    q.id === questionId
      ? { ...q, answer, answeredAt: Date.now() }
      : q
  );

  return {
    ...task,
    clarificationQuestions: updatedQuestions,
    modifiedAt: Date.now(),
  };
}
