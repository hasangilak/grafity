import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ClaudeResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    duration: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface ClaudeConfig {
  timeout?: number;
  maxRetries?: number;
  outputFormat?: 'json' | 'text';
  maxTurns?: number;
}

export class ClaudeCodeWrapper {
  private defaultConfig: ClaudeConfig = {
    timeout: 30000,
    maxRetries: 3,
    outputFormat: 'json',
    maxTurns: 1
  };

  constructor(private config: ClaudeConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Execute a Claude command with a prompt
   */
  async execute(prompt: string, input?: string): Promise<string> {
    const startTime = Date.now();

    try {
      const command = this.buildCommand(prompt, 'text');

      if (input) {
        // Use piping for input
        const result = await this.executeWithPipe(command, input);
        return result;
      } else {
        // Direct execution
        const { stdout, stderr } = await execAsync(command);
        if (stderr && !stderr.includes('warning')) {
          throw new Error(`Claude CLI error: ${stderr}`);
        }
        return stdout.trim();
      }
    } catch (error) {
      if (this.config.maxRetries && this.config.maxRetries > 1) {
        return this.retryExecute(prompt, input, this.config.maxRetries - 1);
      }
      throw error;
    }
  }

  /**
   * Execute Claude command and parse JSON response
   */
  async executeJson<T = any>(prompt: string, input?: string): Promise<ClaudeResponse<T>> {
    const startTime = Date.now();

    try {
      const command = this.buildCommand(prompt, 'json');
      let output: string;

      if (input) {
        output = await this.executeWithPipe(command, input);
      } else {
        const { stdout, stderr } = await execAsync(command);
        if (stderr && !stderr.includes('warning')) {
          throw new Error(`Claude CLI error: ${stderr}`);
        }
        output = stdout.trim();
      }

      // Parse JSON response
      const data = this.parseJsonResponse<T>(output);

      return {
        success: true,
        data,
        metadata: {
          duration: Date.now() - startTime
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Pipe data through Claude for analysis
   */
  async pipe(data: any, prompt: string): Promise<any> {
    const input = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    if (this.config.outputFormat === 'json') {
      const response = await this.executeJson(prompt, input);
      if (!response.success) {
        throw new Error(response.error || 'Failed to process data');
      }
      return response.data;
    } else {
      return this.execute(prompt, input);
    }
  }

  /**
   * Stream large data through Claude
   */
  async stream(prompt: string, onData: (chunk: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(prompt, 'text');
      const claude = spawn('claude', args);

      claude.stdout.on('data', (data) => {
        onData(data.toString());
      });

      claude.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('warning')) {
          console.error('Claude stderr:', error);
        }
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Claude process exited with code ${code}`));
        }
      });

      claude.on('error', (error) => {
        reject(error);
      });

      // Set timeout
      if (this.config.timeout) {
        setTimeout(() => {
          claude.kill();
          reject(new Error('Claude command timed out'));
        }, this.config.timeout);
      }
    });
  }

  /**
   * Build command string for execution
   */
  private buildCommand(prompt: string, format: 'json' | 'text'): string {
    const args = this.buildArgs(prompt, format);
    return `claude ${args.join(' ')}`;
  }

  /**
   * Build command arguments
   */
  private buildArgs(prompt: string, format: 'json' | 'text'): string[] {
    const args = ['-p', `"${prompt.replace(/"/g, '\\"')}"`];

    if (format === 'json') {
      args.push('--output-format', 'json');
    }

    if (this.config.maxTurns) {
      args.push('--max-turns', this.config.maxTurns.toString());
    }

    return args;
  }

  /**
   * Execute command with piped input
   */
  private async executeWithPipe(command: string, input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const claude = exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        if (stderr && !stderr.includes('warning')) {
          reject(new Error(stderr));
          return;
        }
        resolve(stdout.trim());
      });

      // Write input to stdin
      if (claude.stdin) {
        claude.stdin.write(input);
        claude.stdin.end();
      }

      // Set timeout
      if (this.config.timeout) {
        setTimeout(() => {
          claude.kill();
          reject(new Error('Claude command timed out'));
        }, this.config.timeout);
      }
    });
  }

  /**
   * Parse JSON response from Claude
   */
  private parseJsonResponse<T>(output: string): T {
    try {
      // Claude might return JSON wrapped in markdown code blocks
      const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try direct JSON parse
      return JSON.parse(output);
    } catch (error) {
      // If not valid JSON, try to extract JSON from the response
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = output.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonStr);
      }

      throw new Error('Failed to parse JSON response from Claude');
    }
  }

  /**
   * Retry execution on failure
   */
  private async retryExecute(prompt: string, input: string | undefined, retries: number): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry

    try {
      return await this.execute(prompt, input);
    } catch (error) {
      if (retries > 0) {
        return this.retryExecute(prompt, input, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Test Claude CLI availability
   */
  static async testAvailability(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('claude --version');
      return stdout.includes('Claude');
    } catch {
      return false;
    }
  }
}

// Export singleton instance for convenience
export const claudeCode = new ClaudeCodeWrapper();