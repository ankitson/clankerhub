/**
 * Agent Types for AI TO-DONE App
 *
 * The agent orchestrates task processing, research, planning, and execution.
 */

import type { Task, AIPlan, ClarificationQuestion } from './task.js';
import type { Skill, SkillResult } from './skill.js';

/**
 * Agent's current state/mode
 */
export type AgentMode =
  | 'idle'
  | 'researching'
  | 'planning'
  | 'interviewing'
  | 'executing'
  | 'waiting_for_user';

/**
 * A single step in the agent's workflow
 */
export interface AgentStep {
  id: string;
  taskId: string;
  type: 'research' | 'plan' | 'question' | 'execute' | 'report';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Configuration for the agent
 */
export interface AgentConfig {
  // How much autonomy the agent has
  autonomyLevel: 'minimal' | 'moderate' | 'high';

  // Whether to ask before executing skills
  confirmBeforeExecute: boolean;

  // Maximum research time per task (ms)
  maxResearchTime: number;

  // Maximum subtasks to propose
  maxSubtasks: number;

  // AI model settings (for future LLM integration)
  modelConfig?: {
    provider: string;
    model: string;
    apiKey?: string;
  };
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  autonomyLevel: 'moderate',
  confirmBeforeExecute: true,
  maxResearchTime: 30000,
  maxSubtasks: 10,
};

/**
 * Message types for agent communication
 */
export type AgentMessage =
  | { type: 'task_added'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'research_complete'; taskId: string; findings: unknown[] }
  | { type: 'plan_ready'; taskId: string; plan: AIPlan }
  | { type: 'question'; taskId: string; question: ClarificationQuestion }
  | { type: 'skill_executed'; taskId: string; skillId: string; result: SkillResult }
  | { type: 'progress_update'; taskId: string; message: string }
  | { type: 'error'; taskId?: string; error: string };

/**
 * Handler for agent messages
 */
export type AgentMessageHandler = (message: AgentMessage) => void;

/**
 * Interface for AI providers (LLMs)
 */
export interface AIProvider {
  /**
   * Generate a plan for a task
   */
  generatePlan(task: Task, context: string): Promise<AIPlan>;

  /**
   * Perform research on a topic
   */
  research(topic: string, context: string): Promise<{
    summary: string;
    findings: string[];
    suggestedQuestions: string[];
  }>;

  /**
   * Determine which skills to use for a subtask
   */
  selectSkills(
    subtask: string,
    availableSkills: Skill[]
  ): Promise<{ skillId: string; input: Record<string, unknown> }[]>;

  /**
   * Generate clarification questions
   */
  generateQuestions(task: Task, context: string): Promise<string[]>;

  /**
   * Analyze progress and suggest next steps
   */
  analyzeProgress(task: Task): Promise<{
    progressPercentage: number;
    summary: string;
    nextSteps: string[];
    blockers?: string[];
  }>;
}

/**
 * Event emitter interface for agent
 */
export interface AgentEventEmitter {
  on(event: 'message', handler: AgentMessageHandler): void;
  off(event: 'message', handler: AgentMessageHandler): void;
  emit(message: AgentMessage): void;
}
