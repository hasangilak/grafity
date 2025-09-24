import React, { useState } from 'react';
import { CreateTodoRequest } from '../types';

interface CreateTodoFormProps {
  onSubmit: (todo: CreateTodoRequest) => void;
}

export const CreateTodoForm: React.FC<CreateTodoFormProps> = ({ onSubmit }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority
    });

    // Reset form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setIsOpen(false);
  };

  return (
    <div className="create-todo-form">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="add-todo-btn"
        >
          + Add New Task
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="todo-form">
          <div className="form-group">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="title-input"
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description (optional)"
              className="description-input"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority:</label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="priority-select"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="submit" className="submit-btn">
              Create Task
            </button>
            <button type="button" onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};