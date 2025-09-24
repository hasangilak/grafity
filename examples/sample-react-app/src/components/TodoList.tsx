import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { apiService } from '../services/apiService';
import { Todo, CreateTodoRequest } from '../types';
import { TodoItem } from './TodoItem';
import { CreateTodoForm } from './CreateTodoForm';

export const TodoList: React.FC = () => {
  const { user } = useUser();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    loadTodos();
  }, [user]);

  const loadTodos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userTodos = await apiService.getTodos(user.id);
      setTodos(userTodos);
    } catch (error) {
      console.error('Failed to load todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTodo = async (todoData: CreateTodoRequest) => {
    if (!user) return;

    try {
      const newTodo = await apiService.createTodo(user.id, todoData);
      setTodos(prev => [newTodo, ...prev]);
    } catch (error) {
      console.error('Failed to create todo:', error);
    }
  };

  const handleUpdateTodo = async (todoId: string, updates: Partial<Todo>) => {
    try {
      const updatedTodo = await apiService.updateTodo(todoId, updates);
      setTodos(prev =>
        prev.map(todo => todo.id === todoId ? updatedTodo : todo)
      );
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await apiService.deleteTodo(todoId);
      setTodos(prev => prev.filter(todo => todo.id !== todoId));
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'pending':
        return !todo.completed;
      case 'completed':
        return todo.completed;
      default:
        return true;
    }
  });

  if (loading) {
    return <div className="loading">Loading todos...</div>;
  }

  if (!user) {
    return <div className="error">Please log in to view todos</div>;
  }

  return (
    <div className="todo-list-page">
      <div className="page-header">
        <h1>My Tasks</h1>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({todos.length})
          </button>
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending ({todos.filter(t => !t.completed).length})
          </button>
          <button
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed ({todos.filter(t => t.completed).length})
          </button>
        </div>
      </div>

      <CreateTodoForm onSubmit={handleCreateTodo} />

      <div className="todo-list">
        {filteredTodos.length === 0 ? (
          <div className="empty-state">
            {filter === 'all' ? 'No tasks yet. Create your first task above!' :
             filter === 'pending' ? 'No pending tasks. Great job!' :
             'No completed tasks yet.'}
          </div>
        ) : (
          filteredTodos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onUpdate={handleUpdateTodo}
              onDelete={handleDeleteTodo}
            />
          ))
        )}
      </div>
    </div>
  );
};