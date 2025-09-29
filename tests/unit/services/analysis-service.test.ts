import { AnalysisService } from '../../../src/server/services/AnalysisService';
import { ConfigManager } from '../../../src/config/ConfigManager';
import { CacheService } from '../../../src/server/cache/service';
import { JobQueue } from '../../../src/server/jobs/queue';
import { ASTParser } from '../../../src/core/ast/parser';
import { ComponentExtractor } from '../../../src/core/ast-mechanical/extractors/ComponentExtractor';
import { PatternDetector } from '../../../src/core/ast-mechanical/PatternDetector';

// Mock dependencies
jest.mock('../../../src/config/ConfigManager');
jest.mock('../../../src/server/cache/service');
jest.mock('../../../src/server/jobs/queue');
jest.mock('../../../src/core/ast/parser');
jest.mock('../../../src/core/ast-mechanical/extractors/ComponentExtractor');
jest.mock('../../../src/core/ast-mechanical/PatternDetector');

describe('AnalysisService', () => {
  let analysisService: AnalysisService;
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockJobQueue: jest.Mocked<JobQueue>;
  let mockASTParser: jest.Mocked<ASTParser>;
  let mockComponentExtractor: jest.Mocked<ComponentExtractor>;
  let mockPatternDetector: jest.Mocked<PatternDetector>;

  beforeEach(() => {
    mockConfigManager = new ConfigManager() as jest.Mocked<ConfigManager>;
    mockCacheService = new CacheService(mockConfigManager) as jest.Mocked<CacheService>;
    mockJobQueue = new JobQueue(mockConfigManager) as jest.Mocked<JobQueue>;

    // Create service
    analysisService = new AnalysisService(mockConfigManager, mockCacheService, mockJobQueue);

    // Get mocked instances
    mockASTParser = (analysisService as any).astParser;
    mockComponentExtractor = (analysisService as any).componentExtractor;
    mockPatternDetector = (analysisService as any).patternDetector;

    // Setup mock implementations
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
    mockJobQueue.addJob.mockResolvedValue({ id: 'job-123' } as any);

    mockASTParser.parseCode.mockResolvedValue({
      sourceFile: {
        getFullText: () => 'mock source code'
      }
    } as any);

    mockComponentExtractor.extract.mockResolvedValue([
      {
        name: 'TestComponent',
        type: 'function_component',
        props: ['title', 'onClick'],
        hooks: ['useState', 'useEffect']
      }
    ]);

    mockPatternDetector.detectPatterns.mockResolvedValue([
      {
        name: 'Custom Hook Pattern',
        type: 'good_pattern',
        confidence: 0.9,
        description: 'Well-structured custom hook'
      }
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCode', () => {
    const sampleCode = `
      import React, { useState } from 'react';

      export function Counter() {
        const [count, setCount] = useState(0);
        return <div>{count}</div>;
      }
    `;

    it('should analyze code successfully with all options', async () => {
      const result = await analysisService.analyzeCode(sampleCode, 'tsx', {
        includePatterns: true,
        includeMetrics: true,
        includeDependencies: true
      });

      expect(result).toHaveValidStructure([
        'id', 'type', 'status', 'timestamp', 'duration', 'components', 'patterns', 'metrics'
      ]);
      expect(result.type).toBe('code');
      expect(result.status).toBe('completed');
      expect(result.components).toHaveLength(1);
      expect(result.patterns).toHaveLength(1);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should generate unique analysis IDs', async () => {
      const result1 = await analysisService.analyzeCode(sampleCode, 'tsx');
      const result2 = await analysisService.analyzeCode(sampleCode, 'tsx');

      expect(result1.id).not.toBe(result2.id);
      expect(result1.id).toMatch(/^analysis_\d+_[a-z0-9]{9}$/);
    });

    it('should parse code with correct language', async () => {
      await analysisService.analyzeCode(sampleCode, 'typescript');

      expect(mockASTParser.parseCode).toHaveBeenCalledWith(sampleCode, 'typescript');
    });

    it('should extract components from AST', async () => {
      await analysisService.analyzeCode(sampleCode, 'tsx');

      expect(mockComponentExtractor.extract).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceFile: expect.any(Object)
        })
      );
    });

    it('should detect patterns when includePatterns is true', async () => {
      await analysisService.analyzeCode(sampleCode, 'tsx', {
        includePatterns: true
      });

      expect(mockPatternDetector.detectPatterns).toHaveBeenCalled();
    });

    it('should skip pattern detection when includePatterns is false', async () => {
      await analysisService.analyzeCode(sampleCode, 'tsx', {
        includePatterns: false
      });

      expect(mockPatternDetector.detectPatterns).not.toHaveBeenCalled();
    });

    it('should calculate metrics when includeMetrics is true', async () => {
      const result = await analysisService.analyzeCode(sampleCode, 'tsx', {
        includeMetrics: true
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics).toHaveValidStructure([
        'totalComponents',
        'totalFunctions',
        'linesOfCode',
        'cyclomaticComplexity',
        'maintainabilityIndex',
        'testability'
      ]);
    });

    it('should cache analysis results', async () => {
      const result = await analysisService.analyzeCode(sampleCode, 'tsx');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `analysis:${result.id}`,
        result,
        3600
      );
    });

    it('should handle parsing errors gracefully', async () => {
      mockASTParser.parseCode.mockRejectedValue(new Error('Parse error'));

      const result = await analysisService.analyzeCode('invalid code', 'tsx');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Parse error');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle component extraction errors', async () => {
      mockComponentExtractor.extract.mockRejectedValue(new Error('Extraction failed'));

      const result = await analysisService.analyzeCode(sampleCode, 'tsx');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Extraction failed');
    });

    it('should handle pattern detection errors gracefully', async () => {
      mockPatternDetector.detectPatterns.mockRejectedValue(new Error('Pattern detection failed'));

      const result = await analysisService.analyzeCode(sampleCode, 'tsx', {
        includePatterns: true
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Pattern detection failed');
    });
  });

  describe('analyzeFile', () => {
    const mockFs = {
      readFile: jest.fn()
    };

    beforeEach(() => {
      // Mock fs module
      jest.doMock('fs/promises', () => mockFs);
      mockFs.readFile.mockResolvedValue('const x = 1;');
    });

    it('should analyze file successfully', async () => {
      const result = await analysisService.analyzeFile('/test/file.ts', 'project-123');

      expect(result.type).toBe('file');
      expect(result.filePath).toBe('/test/file.ts');
      expect(result.projectId).toBe('project-123');
    });

    it('should detect language from file extension', async () => {
      await analysisService.analyzeFile('/test/component.tsx');

      expect(mockASTParser.parseCode).toHaveBeenCalledWith(
        expect.any(String),
        'tsx'
      );
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await analysisService.analyzeFile('/nonexistent/file.ts');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('File not found');
    });

    it('should handle different file extensions', async () => {
      const testCases = [
        { file: 'test.ts', expected: 'typescript' },
        { file: 'test.tsx', expected: 'tsx' },
        { file: 'test.js', expected: 'javascript' },
        { file: 'test.jsx', expected: 'jsx' },
        { file: 'test.unknown', expected: 'typescript' } // fallback
      ];

      for (const testCase of testCases) {
        await analysisService.analyzeFile(`/test/${testCase.file}`);
        expect(mockASTParser.parseCode).toHaveBeenCalledWith(
          expect.any(String),
          testCase.expected
        );
        mockASTParser.parseCode.mockClear();
      }
    });
  });

  describe('analyzeProject', () => {
    it('should queue project analysis job', async () => {
      const jobId = await analysisService.analyzeProject(
        '/project/path',
        'project-123',
        { includePatterns: true }
      );

      expect(jobId).toBe('job-123');
      expect(mockJobQueue.addJob).toHaveBeenCalledWith(
        'analysis',
        'analyze_project',
        {
          projectPath: '/project/path',
          projectId: 'project-123',
          options: { includePatterns: true }
        },
        {
          priority: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      );
    });

    it('should use default options if not provided', async () => {
      await analysisService.analyzeProject('/project/path', 'project-123');

      expect(mockJobQueue.addJob).toHaveBeenCalledWith(
        'analysis',
        'analyze_project',
        {
          projectPath: '/project/path',
          projectId: 'project-123',
          options: {}
        },
        expect.any(Object)
      );
    });
  });

  describe('getAnalysisResult', () => {
    it('should return cached analysis result', async () => {
      const cachedResult = {
        id: 'analysis-123',
        status: 'completed',
        components: []
      };
      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await analysisService.getAnalysisResult('analysis-123');

      expect(result).toEqual(cachedResult);
      expect(mockCacheService.get).toHaveBeenCalledWith('analysis:analysis-123');
    });

    it('should return null if analysis not found', async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await analysisService.getAnalysisResult('nonexistent-123');

      expect(result).toBeNull();
    });
  });

  describe('getAnalysisStatus', () => {
    it('should return analysis status', async () => {
      const status = await analysisService.getAnalysisStatus('analysis-123');

      expect(status).toHaveValidStructure(['id', 'status', 'progress', 'message']);
      expect(status!.id).toBe('analysis-123');
      expect(status!.status).toBe('completed');
      expect(status!.progress).toBe(100);
    });
  });

  describe('compareAnalyses', () => {
    const analysis1 = {
      id: 'analysis-1',
      metrics: {
        totalComponents: 5,
        complexity: 3.2,
        maintainability: 85
      },
      patterns: [
        { name: 'Pattern A', confidence: 0.9 },
        { name: 'Pattern B', confidence: 0.8 }
      ]
    };

    const analysis2 = {
      id: 'analysis-2',
      metrics: {
        totalComponents: 7,
        complexity: 2.8,
        maintainability: 90
      },
      patterns: [
        { name: 'Pattern A', confidence: 0.95 },
        { name: 'Pattern C', confidence: 0.7 }
      ]
    };

    beforeEach(() => {
      mockCacheService.get
        .mockResolvedValueOnce(analysis1)
        .mockResolvedValueOnce(analysis2);
    });

    it('should compare two analyses', async () => {
      const comparison = await analysisService.compareAnalyses(
        'analysis-1',
        'analysis-2',
        { compareMetrics: true, comparePatterns: true }
      );

      expect(comparison).toHaveValidStructure([
        'id',
        'analysis1Id',
        'analysis2Id',
        'timestamp',
        'differences'
      ]);
      expect(comparison.analysis1Id).toBe('analysis-1');
      expect(comparison.analysis2Id).toBe('analysis-2');
    });

    it('should compare metrics when requested', async () => {
      const comparison = await analysisService.compareAnalyses(
        'analysis-1',
        'analysis-2',
        { compareMetrics: true }
      );

      expect(comparison.differences.metrics).toBeDefined();
      expect(comparison.differences.metrics.totalComponents).toEqual({
        before: 5,
        after: 7,
        change: 2,
        percentChange: 40
      });
    });

    it('should compare patterns when requested', async () => {
      const comparison = await analysisService.compareAnalyses(
        'analysis-1',
        'analysis-2',
        { comparePatterns: true }
      );

      expect(comparison.differences.patterns).toBeDefined();
      expect(comparison.differences.patterns.added).toBe(1); // Pattern C
      expect(comparison.differences.patterns.removed).toBe(1); // Pattern B
      expect(comparison.differences.patterns.unchanged).toBe(1); // Pattern A
    });

    it('should throw error if analysis not found', async () => {
      mockCacheService.get.mockResolvedValue(null);

      await expect(
        analysisService.compareAnalyses('missing-1', 'missing-2')
      ).rejects.toThrow('One or both analyses not found');
    });
  });

  describe('deleteAnalysis', () => {
    it('should delete analysis from cache', async () => {
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await analysisService.deleteAnalysis('analysis-123');

      expect(result).toBe(true);
      expect(mockCacheService.delete).toHaveBeenCalledWith('analysis:analysis-123');
    });

    it('should handle deletion errors', async () => {
      mockCacheService.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await analysisService.deleteAnalysis('analysis-123');

      expect(result).toBe(false);
    });
  });

  describe('getAnalysisHistory', () => {
    it('should return empty history (placeholder implementation)', async () => {
      const history = await analysisService.getAnalysisHistory({
        projectId: 'project-123',
        limit: 10
      });

      expect(history).toEqual({
        analyses: [],
        totalCount: 0
      });
    });
  });

  describe('private methods', () => {
    describe('calculateMetrics', () => {
      it('should calculate code metrics', async () => {
        const mockAST = {
          sourceFile: {
            getFullText: () => 'line1\nline2\nline3'
          }
        };

        const components = [{ name: 'Comp1' }, { name: 'Comp2' }];
        const functions = [{ name: 'func1' }, { name: 'func2' }, { name: 'func3' }];

        const metrics = await (analysisService as any).calculateMetrics(
          mockAST,
          components,
          functions
        );

        expect(metrics).toHaveValidStructure([
          'totalComponents',
          'totalFunctions',
          'linesOfCode',
          'cyclomaticComplexity',
          'maintainabilityIndex',
          'testability'
        ]);
        expect(metrics.totalComponents).toBe(2);
        expect(metrics.totalFunctions).toBe(3);
        expect(metrics.linesOfCode).toBe(3);
      });
    });

    describe('detectLanguage', () => {
      it('should detect language from file extensions', () => {
        const detectLanguage = (analysisService as any).detectLanguage.bind(analysisService);

        expect(detectLanguage('file.ts')).toBe('typescript');
        expect(detectLanguage('file.tsx')).toBe('tsx');
        expect(detectLanguage('file.js')).toBe('javascript');
        expect(detectLanguage('file.jsx')).toBe('jsx');
        expect(detectLanguage('file.unknown')).toBe('typescript');
      });
    });
  });

  describe('error recovery', () => {
    it('should handle multiple concurrent analysis requests', async () => {
      const promises = Array(5).fill(0).map((_, i) =>
        analysisService.analyzeCode(`const x${i} = ${i};`, 'typescript')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.status).toBe('completed');
        expect(result.id).toContain(`analysis_`);
      });
    });

    it('should handle cache service failures gracefully', async () => {
      mockCacheService.set.mockRejectedValue(new Error('Cache failure'));

      const result = await analysisService.analyzeCode('const x = 1;', 'typescript');

      // Should still complete analysis even if caching fails
      expect(result.status).toBe('completed');
    });
  });
});