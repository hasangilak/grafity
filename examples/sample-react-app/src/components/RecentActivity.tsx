import React from 'react';
import { Todo } from '../types';

interface RecentActivityProps {
  todos: Todo[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({ todos }) => {
  const recentTodos = todos
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="recent-activity">
      <h3>Recent Activity</h3>

      {recentTodos.length === 0 ? (
        <p className="no-activity">No recent activity</p>
      ) : (
        <div className="activity-list">
          {recentTodos.map(todo => (
            <div key={todo.id} className="activity-item">
              <div className="activity-status">
                {todo.completed ? '✅' : '⏳'}
              </div>
              <div className="activity-details">
                <span className="activity-title">{todo.title}</span>
                <span className="activity-date">{formatDate(todo.updatedAt)}</span>
              </div>
              <div className="activity-priority">
                <span className={`priority-badge priority-${todo.priority}`}>
                  {todo.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};