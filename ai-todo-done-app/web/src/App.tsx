import { useState, useCallback } from 'react';
import { Task, createTask } from './types';
import { processTask, approvePlan, completeSubtask, updateMetric, answerQuestion } from './services/mockAgent';
import TaskCard from './components/TaskCard';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  const handleAddTask = useCallback(async () => {
    if (!inputValue.trim() || isProcessing) return;

    const newTask = createTask(inputValue.trim());
    setInputValue('');
    setTasks(prev => [...prev, newTask]);
    setIsProcessing(true);

    try {
      const processedTask = await processTask(newTask, (msg) => {
        setProcessingMessage(msg);
      });
      setTasks(prev => prev.map(t => t.id === newTask.id ? processedTask : t));
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [inputValue, isProcessing]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  }, [handleAddTask]);

  const handleApprovePlan = useCallback((taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return approvePlan(t);
      }
      return t;
    }));
  }, []);

  const handleCompleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return completeSubtask(t, subtaskId);
      }
      return t;
    }));
  }, []);

  const handleUpdateMetric = useCallback((taskId: string, metricId: string, value: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return updateMetric(t, metricId, value);
      }
      return t;
    }));
  }, []);

  const handleAnswerQuestion = useCallback((taskId: string, questionId: string, answer: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return answerQuestion(t, questionId, answer);
      }
      return t;
    }));
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>TO-DONE</h1>
        <p>AI-powered task manager that works on your goals</p>
      </header>

      <div className="add-task-form">
        <input
          type="text"
          className="add-task-input"
          placeholder="What do you want to accomplish? (e.g., 'Do my taxes', 'Run a 5K')"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isProcessing}
        />
        <button
          className="btn btn-primary"
          onClick={handleAddTask}
          disabled={!inputValue.trim() || isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Add Task'}
        </button>
      </div>

      {isProcessing && processingMessage && (
        <div className="loading">
          <div className="loading-spinner" />
          <span>{processingMessage}</span>
        </div>
      )}

      <div className="task-list">
        {tasks.length === 0 ? (
          <div className="task-list-empty">
            <p>No tasks yet.</p>
            <p style={{ fontSize: '0.9rem' }}>Add a task above and watch the AI create a plan for you!</p>
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onApprovePlan={handleApprovePlan}
              onCompleteSubtask={handleCompleteSubtask}
              onUpdateMetric={handleUpdateMetric}
              onAnswerQuestion={handleAnswerQuestion}
              onDelete={handleDeleteTask}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default App;
