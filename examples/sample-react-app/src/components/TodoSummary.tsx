import React from 'react';
import { Todo } from '../types';

interface TodoSummaryProps {
  todos: Todo[];
}

export const TodoSummary: React.FC<TodoSummaryProps> = ({ todos }) => {
  const completedCount = todos.filter(todo => todo.completed).length;
  const pendingCount = todos.length - completedCount;
  const highPriorityCount = todos.filter(todo => todo.priority === 'high' && !todo.completed).length;

  return (
    <div className="todo-summary">
      <h3>Todo Summary</h3>

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-number">{todos.length}</span>
          <span className="stat-label">Total Tasks</span>
        </div>

        <div className="stat">
          <span className="stat-number">{completedCount}</span>
          <span className="stat-label">Completed</span>
        </div>

        <div className="stat">
          <span className="stat-number">{pendingCount}</span>
          <span className="stat-label">Pending</span>
        </div>

        <div className="stat urgent">
          <span className="stat-number">{highPriorityCount}</span>
          <span className="stat-label">High Priority</span>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="summary-message">
          You have {pendingCount} pending task{pendingCount !== 1 ? 's' : ''} to complete.
          {highPriorityCount > 0 && ` ${highPriorityCount} of them are high priority.`}
        </div>
      )}
    </div>
  );
};