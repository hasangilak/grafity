import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { apiService } from '../services/apiService';
import { Todo } from '../types';
import { TodoSummary } from './TodoSummary';
import { RecentActivity } from './RecentActivity';

export const Dashboard: React.FC = () => {
  const { user } = useUser();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        const userTodos = await apiService.getTodos(user.id);
        setTodos(userTodos);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  if (!user) {
    return <div className="error">Please log in to view dashboard</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user.name}!</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <TodoSummary todos={todos} />
        </div>

        <div className="dashboard-card">
          <RecentActivity todos={todos} />
        </div>
      </div>
    </div>
  );
};