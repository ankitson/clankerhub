import { useState, useCallback } from 'react';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onApprovePlan: (taskId: string) => void;
  onCompleteSubtask: (taskId: string, subtaskId: string) => void;
  onUpdateMetric: (taskId: string, metricId: string, value: number) => void;
  onAnswerQuestion: (taskId: string, questionId: string, answer: string) => void;
  onDelete: (taskId: string) => void;
}

export default function TaskCard({
  task,
  onApprovePlan,
  onCompleteSubtask,
  onUpdateMetric,
  onAnswerQuestion,
  onDelete,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(task.status === 'awaiting_input');
  const [metricInputs, setMetricInputs] = useState<Record<string, string>>({});
  const [questionInputs, setQuestionInputs] = useState<Record<string, string>>({});

  const completedSubtasks = task.subtasks.filter(st => st.status === 'completed').length;
  const totalSubtasks = task.subtasks.length;
  const progressPercent = totalSubtasks > 0
    ? Math.round((completedSubtasks / totalSubtasks) * 100)
    : 0;

  const handleMetricUpdate = useCallback((metricId: string) => {
    const value = parseFloat(metricInputs[metricId] || '0');
    if (!isNaN(value)) {
      onUpdateMetric(task.id, metricId, value);
      setMetricInputs(prev => ({ ...prev, [metricId]: '' }));
    }
  }, [task.id, metricInputs, onUpdateMetric]);

  const handleQuestionAnswer = useCallback((questionId: string) => {
    const answer = questionInputs[questionId];
    if (answer?.trim()) {
      onAnswerQuestion(task.id, questionId, answer.trim());
      setQuestionInputs(prev => ({ ...prev, [questionId]: '' }));
    }
  }, [task.id, questionInputs, onAnswerQuestion]);

  return (
    <div className="task-card">
      <div
        className="task-card-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="task-card-title">
          <h3>{task.title}</h3>
          <span className={`task-status status-${task.status}`}>
            {task.status.replace('_', ' ')}
          </span>
        </div>
        <span className="task-card-expand">
          {isExpanded ? '▼' : '▶'}
        </span>
      </div>

      {isExpanded && (
        <div className="task-card-body">
          {/* Progress bar for tasks with subtasks */}
          {totalSubtasks > 0 && (
            <div className="progress-section">
              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="progress-text">
                  {completedSubtasks}/{totalSubtasks}
                </span>
              </div>
            </div>
          )}

          {/* AI Plan (awaiting approval) */}
          {task.status === 'awaiting_input' && task.aiPlan && (
            <div className="ai-plan">
              <h4>🤖 AI Plan</h4>
              <p className="ai-plan-approach">{task.aiPlan.approach}</p>

              {task.aiPlan.estimatedDuration && (
                <p style={{ color: 'var(--color-text-dim)', marginBottom: '12px' }}>
                  Estimated time: {task.aiPlan.estimatedDuration}
                </p>
              )}

              <div className="ai-plan-section">
                <h5>Proposed Subtasks</h5>
                {task.aiPlan.proposedSubtasks.map((st, i) => (
                  <div key={i} className="proposed-subtask">
                    <span className="proposed-subtask-icon">
                      {st.canBeAutomated ? '🤖' : '👤'}
                    </span>
                    <div className="proposed-subtask-content">
                      <div className="proposed-subtask-title">{st.title}</div>
                      <div className="proposed-subtask-desc">{st.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {task.aiPlan.proposedMetrics.length > 0 && (
                <div className="ai-plan-section">
                  <h5>Progress Metrics</h5>
                  {task.aiPlan.proposedMetrics.map((m, i) => (
                    <div key={i} style={{ padding: '4px 0' }}>
                      • {m.name}: 0 / {m.targetValue} {m.unit}
                    </div>
                  ))}
                </div>
              )}

              <div className="ai-plan-actions">
                <button
                  className="btn btn-success"
                  onClick={() => onApprovePlan(task.id)}
                >
                  ✓ Approve Plan
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => onDelete(task.id)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Clarification Questions */}
          {task.clarificationQuestions.some(q => !q.answer) && (
            <div className="questions-section">
              <h4>📝 Questions for you</h4>
              {task.clarificationQuestions
                .filter(q => !q.answer)
                .map(q => (
                  <div key={q.id} className="question-item">
                    <div className="question-text">{q.question}</div>
                    <div className="question-input">
                      <input
                        type="text"
                        placeholder="Your answer..."
                        value={questionInputs[q.id] || ''}
                        onChange={(e) => setQuestionInputs(prev => ({
                          ...prev,
                          [q.id]: e.target.value
                        }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleQuestionAnswer(q.id);
                        }}
                      />
                      <button
                        className="btn btn-primary btn-small"
                        onClick={() => handleQuestionAnswer(q.id)}
                        disabled={!questionInputs[q.id]?.trim()}
                      >
                        Answer
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Subtasks (after plan approval) */}
          {task.subtasks.length > 0 && (
            <div className="subtasks-section">
              <h4>Subtasks</h4>
              {task.subtasks.map(st => (
                <div
                  key={st.id}
                  className={`subtask-item ${st.status === 'completed' ? 'completed' : ''}`}
                  onClick={() => {
                    if (st.status !== 'completed') {
                      onCompleteSubtask(task.id, st.id);
                    }
                  }}
                >
                  <div className={`subtask-checkbox ${st.status === 'completed' ? 'checked' : ''}`} />
                  <div className="subtask-content">
                    <div className={`subtask-title ${st.status === 'completed' ? 'completed' : ''}`}>
                      {st.title}
                    </div>
                    <div className="subtask-meta">
                      {st.canBeAutomated && <span>🤖 Automatable</span>}
                      {st.estimatedMinutes && <span>{st.estimatedMinutes} min</span>}
                    </div>
                  </div>
                  <span className="subtask-icon">
                    {st.canBeAutomated ? '🤖' : '👤'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Progress Metrics */}
          {task.progressMetrics.length > 0 && (
            <div className="metrics-section">
              <h4>Progress Metrics</h4>
              {task.progressMetrics.map(m => {
                const percent = Math.min(100, Math.round((m.currentValue / m.targetValue) * 100));
                return (
                  <div key={m.id} className="metric-item">
                    <div className="metric-info">
                      <div className="metric-name">{m.name}</div>
                      <div className="metric-bar">
                        <div
                          className="metric-bar-fill"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="metric-value">
                      {m.currentValue} / {m.targetValue} {m.unit}
                    </div>
                    <div className="metric-input">
                      <input
                        type="number"
                        placeholder="Update"
                        value={metricInputs[m.id] || ''}
                        onChange={(e) => setMetricInputs(prev => ({
                          ...prev,
                          [m.id]: e.target.value
                        }))}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="btn btn-primary btn-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMetricUpdate(m.id);
                        }}
                      >
                        Set
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Answered Questions */}
          {task.clarificationQuestions.some(q => q.answer) && (
            <div className="questions-section" style={{ marginTop: '16px' }}>
              <h4 style={{ color: 'var(--color-success)' }}>✓ Answered Questions</h4>
              {task.clarificationQuestions
                .filter(q => q.answer)
                .map(q => (
                  <div key={q.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ fontWeight: 500 }}>{q.question}</div>
                    <div className="question-answered">"{q.answer}"</div>
                  </div>
                ))}
            </div>
          )}

          {/* Delete button */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => onDelete(task.id)}
            >
              Delete Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
