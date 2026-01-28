/**
 * Types for the TO-DONE Web UI
 * Mirrored from the core package for browser compatibility
 */

export type TaskStatus =
  | 'pending'
  | 'researching'
  | 'planning'
  | 'awaiting_input'
  | 'in_progress'
  | 'blocked'
  | 'completed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProgressMetric {
  id: string;
  name: string;
  unit: string;
  currentValue: number;
  targetValue: number;
  history: Array<{
    timestamp: number;
    value: number;
    note?: string;
  }>;
}

export interface ResearchFinding {
  id: string;
  topic: string;
  summary: string;
  sources: string[];
  confidence: 'low' | 'medium' | 'high';
  timestamp: number;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  context: string;
  options?: string[];
  answer?: string;
  answeredAt?: number;
}

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
  canBeAutomated: boolean;
  automationSkillId?: string;
  automationResult?: {
    success: boolean;
    output?: string;
    error?: string;
    executedAt: number;
  };
}

export interface AIPlan {
  id: string;
  taskId: string;
  status: 'draft' | 'awaiting_approval' | 'approved' | 'in_progress' | 'completed';
  summary: string;
  approach: string;
  estimatedDuration?: string;
  proposedSubtasks: Array<{
    title: string;
    description: string;
    estimatedMinutes?: number;
    canBeAutomated: boolean;
    requiredSkill?: string;
  }>;
  proposedMetrics: Array<{
    name: string;
    unit: string;
    targetValue: number;
  }>;
  questionsForUser: string[];
  createdAt: number;
  approvedAt?: number;
  modifiedAt: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  parentId?: string;
  subtasks: Subtask[];
  createdAt: number;
  modifiedAt: number;
  dueDate?: number;
  completedAt?: number;
  timeEstimate?: number;
  timeSpent: number;
  researchFindings: ResearchFinding[];
  clarificationQuestions: ClarificationQuestion[];
  aiPlan?: AIPlan;
  progressMetrics: ProgressMetric[];
  tags: string[];
  contextId?: string;
  notes: string[];
  aiReasoning?: string;
}

// Helper functions
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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
