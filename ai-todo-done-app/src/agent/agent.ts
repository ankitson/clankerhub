/**
 * Main TO-DONE Agent
 *
 * Orchestrates the AI-powered task management workflow.
 */

import type {
  Task,
  Subtask,
  AIPlan,
  ClarificationQuestion,
  AgentConfig,
  AgentMode,
  AgentMessage,
  AgentMessageHandler,
  AIProvider,
  SkillRegistry,
  generateId as generateIdFn,
} from '../types/index.js';
import { DEFAULT_AGENT_CONFIG, createSubtask } from '../types/index.js';
import { MockAIProvider } from './mock-ai.js';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * The main TO-DONE Agent class
 */
export class ToDoneAgent {
  private config: AgentConfig;
  private aiProvider: AIProvider;
  private skillRegistry: SkillRegistry;
  private mode: AgentMode = 'idle';
  private messageHandlers: Set<AgentMessageHandler> = new Set();

  // Task processing queue
  private processingQueue: Task[] = [];
  private isProcessing = false;

  constructor(
    skillRegistry: SkillRegistry,
    config: Partial<AgentConfig> = {},
    aiProvider?: AIProvider
  ) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    this.skillRegistry = skillRegistry;
    this.aiProvider = aiProvider || new MockAIProvider();
  }

  /**
   * Subscribe to agent messages
   */
  onMessage(handler: AgentMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Emit a message to all handlers
   */
  private emit(message: AgentMessage): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        console.error('Message handler error:', error);
      }
    }
  }

  /**
   * Get current agent mode
   */
  getMode(): AgentMode {
    return this.mode;
  }

  /**
   * Process a new task - the main entry point
   */
  async processTask(task: Task): Promise<Task> {
    this.emit({ type: 'task_added', task });
    this.emit({
      type: 'progress_update',
      taskId: task.id,
      message: 'Starting to analyze task...',
    });

    // Phase 1: Research
    task = await this.researchPhase(task);

    // Phase 2: Planning
    task = await this.planningPhase(task);

    // The task is now in 'awaiting_input' status, waiting for user approval
    return task;
  }

  /**
   * Research phase - gather information about the task
   */
  private async researchPhase(task: Task): Promise<Task> {
    this.mode = 'researching';
    task = { ...task, status: 'researching' };
    this.emit({ type: 'task_updated', task });
    this.emit({
      type: 'progress_update',
      taskId: task.id,
      message: 'Researching the task...',
    });

    try {
      const research = await this.aiProvider.research(
        task.title,
        task.description || ''
      );

      const findings = research.findings.map((finding, i) => ({
        id: generateId(),
        topic: task.title,
        summary: finding,
        sources: [],
        confidence: 'medium' as const,
        timestamp: Date.now(),
      }));

      task = {
        ...task,
        researchFindings: [...task.researchFindings, ...findings],
        aiReasoning: research.summary,
        modifiedAt: Date.now(),
      };

      this.emit({
        type: 'research_complete',
        taskId: task.id,
        findings: findings,
      });
    } catch (error) {
      this.emit({
        type: 'error',
        taskId: task.id,
        error: `Research failed: ${error}`,
      });
    }

    return task;
  }

  /**
   * Planning phase - create subtasks and metrics
   */
  private async planningPhase(task: Task): Promise<Task> {
    this.mode = 'planning';
    task = { ...task, status: 'planning' };
    this.emit({ type: 'task_updated', task });
    this.emit({
      type: 'progress_update',
      taskId: task.id,
      message: 'Creating a plan...',
    });

    try {
      const skillSummary = this.skillRegistry.getCapabilitySummary();
      const plan = await this.aiProvider.generatePlan(task, skillSummary);

      task = {
        ...task,
        aiPlan: plan,
        status: 'awaiting_input',
        modifiedAt: Date.now(),
      };

      // Generate clarification questions
      const questions: ClarificationQuestion[] = plan.questionsForUser.map(
        (q) => ({
          id: generateId(),
          question: q,
          context: `Related to planning: ${task.title}`,
        })
      );

      task = {
        ...task,
        clarificationQuestions: [
          ...task.clarificationQuestions,
          ...questions,
        ],
      };

      this.emit({ type: 'plan_ready', taskId: task.id, plan });
      this.mode = 'waiting_for_user';
    } catch (error) {
      this.emit({
        type: 'error',
        taskId: task.id,
        error: `Planning failed: ${error}`,
      });
    }

    return task;
  }

  /**
   * User approves the plan - convert to actual subtasks
   */
  async approvePlan(task: Task): Promise<Task> {
    if (!task.aiPlan) {
      throw new Error('No plan to approve');
    }

    const plan = task.aiPlan;

    // Convert proposed subtasks to actual subtasks
    const subtasks: Subtask[] = plan.proposedSubtasks.map((proposed, i) =>
      ({
        ...createSubtask(task.id, proposed.title, i, proposed.canBeAutomated),
        description: proposed.description,
        estimatedMinutes: proposed.estimatedMinutes,
        automationSkillId: proposed.requiredSkill,
      })
    );

    // Convert proposed metrics to actual metrics
    const metrics = plan.proposedMetrics.map((proposed) => ({
      id: generateId(),
      name: proposed.name,
      unit: proposed.unit,
      currentValue: 0,
      targetValue: proposed.targetValue,
      history: [],
    }));

    task = {
      ...task,
      subtasks,
      progressMetrics: [...task.progressMetrics, ...metrics],
      aiPlan: { ...plan, status: 'approved', approvedAt: Date.now() },
      status: 'in_progress',
      modifiedAt: Date.now(),
    };

    this.emit({ type: 'task_updated', task });
    this.emit({
      type: 'progress_update',
      taskId: task.id,
      message: 'Plan approved! Ready to start working.',
    });

    this.mode = 'idle';
    return task;
  }

  /**
   * User modifies the plan
   */
  async modifyPlan(
    task: Task,
    modifications: {
      removeSubtaskIndices?: number[];
      addSubtasks?: Array<{ title: string; description: string }>;
      modifyApproach?: string;
    }
  ): Promise<Task> {
    if (!task.aiPlan) {
      throw new Error('No plan to modify');
    }

    let plan = { ...task.aiPlan };

    // Remove subtasks
    if (modifications.removeSubtaskIndices) {
      plan.proposedSubtasks = plan.proposedSubtasks.filter(
        (_, i) => !modifications.removeSubtaskIndices!.includes(i)
      );
    }

    // Add subtasks
    if (modifications.addSubtasks) {
      for (const newSubtask of modifications.addSubtasks) {
        plan.proposedSubtasks.push({
          title: newSubtask.title,
          description: newSubtask.description,
          estimatedMinutes: 30,
          canBeAutomated: false,
        });
      }
    }

    // Modify approach
    if (modifications.modifyApproach) {
      plan.approach = modifications.modifyApproach;
    }

    plan.modifiedAt = Date.now();

    task = {
      ...task,
      aiPlan: plan,
      modifiedAt: Date.now(),
    };

    this.emit({ type: 'task_updated', task });
    return task;
  }

  /**
   * Answer a clarification question
   */
  answerQuestion(task: Task, questionId: string, answer: string): Task {
    const updatedQuestions = task.clarificationQuestions.map((q) =>
      q.id === questionId
        ? { ...q, answer, answeredAt: Date.now() }
        : q
    );

    task = {
      ...task,
      clarificationQuestions: updatedQuestions,
      modifiedAt: Date.now(),
    };

    this.emit({ type: 'task_updated', task });
    return task;
  }

  /**
   * Mark a subtask as complete
   */
  completeSubtask(task: Task, subtaskId: string): Task {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId
        ? { ...st, status: 'completed' as const, completedAt: Date.now() }
        : st
    );

    const allComplete = updatedSubtasks.every(
      (st) => st.status === 'completed'
    );

    task = {
      ...task,
      subtasks: updatedSubtasks,
      status: allComplete ? 'completed' : task.status,
      completedAt: allComplete ? Date.now() : task.completedAt,
      modifiedAt: Date.now(),
    };

    this.emit({ type: 'task_updated', task });

    if (allComplete) {
      this.emit({
        type: 'progress_update',
        taskId: task.id,
        message: 'All subtasks completed! Task is done.',
      });
    }

    return task;
  }

  /**
   * Update a progress metric
   */
  updateMetric(
    task: Task,
    metricId: string,
    value: number,
    note?: string
  ): Task {
    const updatedMetrics = task.progressMetrics.map((m) =>
      m.id === metricId
        ? {
            ...m,
            currentValue: value,
            history: [
              ...m.history,
              { timestamp: Date.now(), value, note },
            ],
          }
        : m
    );

    task = {
      ...task,
      progressMetrics: updatedMetrics,
      modifiedAt: Date.now(),
    };

    this.emit({ type: 'task_updated', task });
    return task;
  }

  /**
   * Execute an automated subtask using a skill
   */
  async executeSubtask(task: Task, subtaskId: string): Promise<Task> {
    const subtask = task.subtasks.find((st) => st.id === subtaskId);
    if (!subtask) {
      throw new Error('Subtask not found');
    }

    if (!subtask.canBeAutomated || !subtask.automationSkillId) {
      throw new Error('Subtask cannot be automated');
    }

    const skill = this.skillRegistry.getSkill(subtask.automationSkillId);
    if (!skill) {
      throw new Error(`Skill not found: ${subtask.automationSkillId}`);
    }

    this.mode = 'executing';
    this.emit({
      type: 'progress_update',
      taskId: task.id,
      message: `Executing: ${subtask.title}`,
    });

    try {
      const result = await skill.execute(
        { query: subtask.title, description: subtask.description },
        { taskId: task.id }
      );

      const updatedSubtasks = task.subtasks.map((st) =>
        st.id === subtaskId
          ? {
              ...st,
              status: result.success
                ? ('completed' as const)
                : ('blocked' as const),
              automationResult: {
                success: result.success,
                output: result.output as string,
                error: result.error,
                executedAt: Date.now(),
              },
              completedAt: result.success ? Date.now() : undefined,
            }
          : st
      );

      task = {
        ...task,
        subtasks: updatedSubtasks,
        modifiedAt: Date.now(),
      };

      this.emit({
        type: 'skill_executed',
        taskId: task.id,
        skillId: skill.id,
        result,
      });
      this.emit({ type: 'task_updated', task });
    } catch (error) {
      this.emit({
        type: 'error',
        taskId: task.id,
        error: `Skill execution failed: ${error}`,
      });
    }

    this.mode = 'idle';
    return task;
  }

  /**
   * Get progress analysis for a task
   */
  async analyzeProgress(task: Task): Promise<{
    progressPercentage: number;
    summary: string;
    nextSteps: string[];
    blockers?: string[];
  }> {
    return this.aiProvider.analyzeProgress(task);
  }
}
