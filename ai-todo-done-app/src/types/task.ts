/**
 * Core Task Model for AI TO-DONE App
 *
 * Tasks in this app have a full lifecycle managed by both AI and user.
 */

export type TaskStatus =
  | 'pending'       // Just added, not yet processed by AI
  | 'researching'   // AI is gathering information
  | 'planning'      // AI is breaking down into subtasks
  | 'awaiting_input' // Needs user clarification/approval
  | 'in_progress'   // Being actively worked on
  | 'blocked'       // Waiting on something
  | 'completed';    // Done!

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Progress metric for tracking goal achievement
 */
export interface ProgressMetric {
  id: string;
  name: string;           // e.g., "Miles Run", "Documents Gathered"
  unit: string;           // e.g., "miles", "documents"
  currentValue: number;
  targetValue: number;
  history: Array<{
    timestamp: number;
    value: number;
    note?: string;
  }>;
}

/**
 * Research finding from AI investigation
 */
export interface ResearchFinding {
  id: string;
  topic: string;
  summary: string;
  sources: string[];
  confidence: 'low' | 'medium' | 'high';
  timestamp: number;
}

/**
 * Question the AI needs answered before proceeding
 */
export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  options?: string[];     // Suggested answers if applicable
  answer?: string;
  answeredAt?: number;
}

/**
 * Subtask - a smaller unit of work under a main task
 */
export interface Subtask {
  id: string;
  parentTaskId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  estimatedMinutes?: number;
  actualMinutes?: number;
  order: number;
  createdAt: number;
  completedAt?: number;

  // AI execution tracking
  canBeAutomated: boolean;
  automationSkillId?: string;
  automationResult?: {
    success: boolean;
    output?: string;
    error?: string;
    executedAt: number;
  };
}

/**
 * Main Task/Goal interface
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;

  // Hierarchy
  parentId?: string;      // For nested goals
  subtasks: Subtask[];

  // Time tracking
  createdAt: number;
  modifiedAt: number;
  dueDate?: number;
  completedAt?: number;
  timeEstimate?: number;  // In minutes
  timeSpent: number;      // In minutes

  // Scheduling
  recurrence?: RecurrenceConfig;

  // AI workflow
  researchFindings: ResearchFinding[];
  clarificationQuestions: ClarificationQuestion[];
  aiPlan?: AIPlan;

  // Progress tracking
  progressMetrics: ProgressMetric[];

  // Organization
  tags: string[];
  contextId?: string;     // Links to a context/skill directory

  // User notes and AI reasoning
  notes: string[];
  aiReasoning?: string;   // AI's explanation of its approach
}

/**
 * Recurrence configuration for repeating tasks
 */
export interface RecurrenceConfig {
  cycle: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;       // Every N cycles
  daysOfWeek?: number[];  // 0-6 for weekly
  dayOfMonth?: number;    // 1-31 for monthly
  endDate?: number;
  lastGenerated?: number;
}

/**
 * AI's plan for tackling a task
 */
export interface AIPlan {
  id: string;
  taskId: string;
  status: 'draft' | 'awaiting_approval' | 'approved' | 'in_progress' | 'completed';

  // The plan itself
  summary: string;
  approach: string;
  estimatedDuration?: string;

  // Proposed subtasks
  proposedSubtasks: Array<{
    title: string;
    description: string;
    estimatedMinutes?: number;
    canBeAutomated: boolean;
    requiredSkill?: string;
  }>;

  // Proposed metrics
  proposedMetrics: Array<{
    name: string;
    unit: string;
    targetValue: number;
  }>;

  // Questions for user
  questionsForUser: string[];

  // Timestamps
  createdAt: number;
  approvedAt?: number;
  modifiedAt: number;
}

/**
 * Create a new task with defaults
 */
export function createTask(title: string, description?: string): Task {
  const now = Date.now();
  return {
    id: generateId(),
    title,
    description,
    status: 'pending',
    priority: 'medium',
    subtasks: [],
    createdAt: now,
    modifiedAt: now,
    timeSpent: 0,
    researchFindings: [],
    clarificationQuestions: [],
    progressMetrics: [],
    tags: [],
    notes: [],
  };
}

/**
 * Create a subtask
 */
export function createSubtask(
  parentTaskId: string,
  title: string,
  order: number,
  canBeAutomated = false
): Subtask {
  return {
    id: generateId(),
    parentTaskId,
    title,
    status: 'pending',
    order,
    createdAt: Date.now(),
    canBeAutomated,
  };
}

/**
 * Simple ID generator
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export { generateId };
