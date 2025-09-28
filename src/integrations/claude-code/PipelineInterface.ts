import { Transform, Readable, Writable } from 'stream';
import { ClaudeCodeWrapper } from './ClaudeCodeWrapper';

export interface PipelineOptions {
  chunkSize?: number;
  encoding?: BufferEncoding;
  highWaterMark?: number;
  timeout?: number;
}

export interface PipelineProgress {
  bytesProcessed: number;
  totalBytes?: number;
  chunksProcessed: number;
  startTime: number;
  currentTime: number;
}

export class PipelineInterface {
  private claude: ClaudeCodeWrapper;
  private defaultOptions: PipelineOptions = {
    chunkSize: 64 * 1024, // 64KB chunks
    encoding: 'utf8',
    highWaterMark: 16 * 1024 * 1024, // 16MB buffer
    timeout: 60000 // 60 seconds
  };

  private progressCallbacks: ((progress: PipelineProgress) => void)[] = [];
  private cancelRequested = false;

  constructor(claudeWrapper?: ClaudeCodeWrapper, options?: PipelineOptions) {
    this.claude = claudeWrapper || new ClaudeCodeWrapper();
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Pipe large data through Claude for analysis
   */
  async pipeData(
    input: string | Buffer | Readable,
    prompt: string,
    options?: PipelineOptions
  ): Promise<string> {
    const opts = { ...this.defaultOptions, ...options };
    const chunks: string[] = [];

    return new Promise((resolve, reject) => {
      const inputStream = this.createInputStream(input);
      const processStream = this.createProcessStream(prompt);
      const outputStream = this.createOutputStream(chunks);

      // Set up error handling
      inputStream.on('error', reject);
      processStream.on('error', reject);
      outputStream.on('error', reject);

      // Set up completion
      outputStream.on('finish', async () => {
        try {
          const fullData = chunks.join('');
          const result = await this.claude.pipe(fullData, prompt);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      // Set up timeout
      if (opts.timeout) {
        setTimeout(() => {
          reject(new Error('Pipeline timeout'));
          inputStream.destroy();
        }, opts.timeout);
      }

      // Start pipeline
      inputStream.pipe(processStream).pipe(outputStream);
    });
  }

  /**
   * Stream processing with progress tracking
   */
  async streamWithProgress(
    input: string | Buffer,
    prompt: string,
    onProgress?: (progress: PipelineProgress) => void
  ): Promise<string> {
    const startTime = Date.now();
    const totalBytes = Buffer.byteLength(input);
    let bytesProcessed = 0;
    let chunksProcessed = 0;

    if (onProgress) {
      this.progressCallbacks.push(onProgress);
    }

    const chunks = this.splitIntoChunks(input.toString(), this.defaultOptions.chunkSize!);
    const results: string[] = [];

    for (const chunk of chunks) {
      if (this.cancelRequested) {
        throw new Error('Pipeline cancelled by user');
      }

      const chunkResult = await this.processChunk(chunk, prompt, chunksProcessed === 0);
      results.push(chunkResult);

      bytesProcessed += Buffer.byteLength(chunk);
      chunksProcessed++;

      const progress: PipelineProgress = {
        bytesProcessed,
        totalBytes,
        chunksProcessed,
        startTime,
        currentTime: Date.now()
      };

      this.notifyProgress(progress);
    }

    return results.join('\n');
  }

  /**
   * Buffer management for large inputs
   */
  async bufferLargeInput(
    inputPath: string,
    prompt: string,
    maxMemory: number = 100 * 1024 * 1024 // 100MB
  ): Promise<string> {
    const fs = await import('fs');
    const stats = await fs.promises.stat(inputPath);

    if (stats.size > maxMemory) {
      // Process in chunks to avoid memory issues
      return this.processLargeFile(inputPath, prompt, maxMemory);
    } else {
      // Load entire file into memory
      const content = await fs.promises.readFile(inputPath, 'utf8');
      return this.claude.pipe(content, prompt);
    }
  }

  /**
   * Cancel ongoing pipeline operation
   */
  cancel(): void {
    this.cancelRequested = true;
  }

  /**
   * Add progress listener
   */
  onProgress(callback: (progress: PipelineProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Create input stream from various sources
   */
  private createInputStream(input: string | Buffer | Readable): Readable {
    if (input instanceof Readable) {
      return input;
    }

    const stream = new Readable({
      encoding: this.defaultOptions.encoding,
      highWaterMark: this.defaultOptions.highWaterMark
    });

    stream.push(input);
    stream.push(null);

    return stream;
  }

  /**
   * Create processing transform stream
   */
  private createProcessStream(prompt: string): Transform {
    let buffer = '';
    const chunkSize = this.defaultOptions.chunkSize || 64 * 1024;

    return new Transform({
      encoding: this.defaultOptions.encoding,
      transform(chunk, encoding, callback) {
        buffer += chunk.toString();

        // Process when buffer reaches chunk size
        if (Buffer.byteLength(buffer) >= chunkSize) {
          this.push(buffer);
          buffer = '';
        }

        callback();
      },
      flush(callback) {
        if (buffer) {
          this.push(buffer);
        }
        callback();
      }
    });
  }

  /**
   * Create output stream to collect results
   */
  private createOutputStream(chunks: string[]): Writable {
    return new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      }
    });
  }

  /**
   * Process a single chunk
   */
  private async processChunk(chunk: string, prompt: string, isFirst: boolean): Promise<string> {
    const chunkPrompt = isFirst
      ? prompt
      : `Continue analyzing (chunk continuation): ${prompt}`;

    return this.claude.execute(chunkPrompt, chunk);
  }

  /**
   * Split input into manageable chunks
   */
  private splitIntoChunks(input: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    const lines = input.split('\n');

    for (const line of lines) {
      if (Buffer.byteLength(currentChunk + line + '\n') > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
      }
      currentChunk += line + '\n';
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Process large file in chunks
   */
  private async processLargeFile(
    filePath: string,
    prompt: string,
    maxMemory: number
  ): Promise<string> {
    const fs = await import('fs');
    const readline = await import('readline');

    const results: string[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      currentChunk += line + '\n';

      if (Buffer.byteLength(currentChunk) >= maxMemory) {
        const result = await this.processChunk(
          currentChunk,
          prompt,
          chunkIndex === 0
        );
        results.push(result);
        currentChunk = '';
        chunkIndex++;
      }
    }

    // Process remaining chunk
    if (currentChunk) {
      const result = await this.processChunk(
        currentChunk,
        prompt,
        chunkIndex === 0
      );
      results.push(result);
    }

    return results.join('\n');
  }

  /**
   * Notify progress listeners
   */
  private notifyProgress(progress: PipelineProgress): void {
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    }
  }

  /**
   * Create a pipeline for continuous processing
   */
  createContinuousPipeline(prompt: string): Transform {
    const claudeInstance = this.claude;

    return new Transform({
      async transform(chunk, encoding, callback) {
        try {
          const input = chunk.toString();
          const result = await claudeInstance.pipe(input, prompt);
          callback(null, result);
        } catch (error: any) {
          callback(error);
        }
      }
    });
  }
}

// Export singleton for convenience
export const pipeline = new PipelineInterface();