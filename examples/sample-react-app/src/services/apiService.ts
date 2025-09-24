import { User, Todo, ApiResponse, CreateTodoRequest, UpdateTodoRequest } from '../types';

class ApiService {
  private baseUrl = '/api';

  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user`);
    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }
    const data: ApiResponse<User> = await response.json();
    return data.data;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/user/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update user');
    }

    const data: ApiResponse<User> = await response.json();
    return data.data;
  }

  async getTodos(userId: string): Promise<Todo[]> {
    const response = await fetch(`${this.baseUrl}/user/${userId}/todos`);
    if (!response.ok) {
      throw new Error('Failed to fetch todos');
    }
    const data: ApiResponse<Todo[]> = await response.json();
    return data.data;
  }

  async createTodo(userId: string, todo: CreateTodoRequest): Promise<Todo> {
    const response = await fetch(`${this.baseUrl}/user/${userId}/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(todo),
    });

    if (!response.ok) {
      throw new Error('Failed to create todo');
    }

    const data: ApiResponse<Todo> = await response.json();
    return data.data;
  }

  async updateTodo(todoId: string, updates: UpdateTodoRequest): Promise<Todo> {
    const response = await fetch(`${this.baseUrl}/todos/${todoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update todo');
    }

    const data: ApiResponse<Todo> = await response.json();
    return data.data;
  }

  async deleteTodo(todoId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/todos/${todoId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete todo');
    }
  }
}

export const apiService = new ApiService();