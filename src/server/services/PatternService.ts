import { ConfigManager } from '../../config/ConfigManager';
import { CacheService } from '../cache/service';
import { PatternDetector } from '../../core/ast-mechanical/PatternDetector';
import { PatternAnalyzer } from '../../core/analysis/pattern-analyzer';

export interface Pattern {
  id: string;
  name: string;
  description: string;
  type: 'good_pattern' | 'anti_pattern' | 'optimization' | 'security' | 'performance';
  category: string;
  confidence: number;
  examples: string[];
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  detectedAt: Date;
  projectId?: string;
  fileId?: string;
  location?: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
}

export interface PatternFilters {
  type?: string;
  category?: string;
  severity?: string;
  projectId?: string;
  tags?: string[];
  confidence?: { min?: number; max?: number };
}

export interface CustomPatternDefinition {
  name: string;
  description: string;
  type: Pattern['type'];
  category: string;
  pattern: string; // AST pattern or regex
  language: string[];
  severity: Pattern['severity'];
  recommendations: string[];
  tags: string[];
}

export class PatternService {
  private configManager: ConfigManager;
  private cacheService: CacheService;
  private patternDetector: PatternDetector;
  private patternAnalyzer: PatternAnalyzer;

  // In-memory storage for demo purposes
  private patterns: Map<string, Pattern> = new Map();
  private customPatterns: Map<string, CustomPatternDefinition> = new Map();

  constructor(
    configManager: ConfigManager,
    cacheService: CacheService
  ) {
    this.configManager = configManager;
    this.cacheService = cacheService;
    this.patternDetector = new PatternDetector();
    this.patternAnalyzer = new PatternAnalyzer();

    // Initialize with sample patterns
    this.initializeSamplePatterns();
  }

  async detectPatterns(
    code: string,
    language: string,
    projectId?: string,
    fileId?: string
  ): Promise<Pattern[]> {
    const cacheKey = `patterns:detect:${projectId}:${fileId}:${this.generateCodeHash(code)}`;

    // Try cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Use existing pattern detection modules
      const detectedPatterns = await this.patternDetector.detectPatterns(code);

      const patterns: Pattern[] = detectedPatterns.map((pattern: any) => ({
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: pattern.name,
        description: pattern.description,
        type: pattern.type || 'good_pattern',
        category: pattern.category || 'general',
        confidence: pattern.confidence || 85,
        examples: pattern.examples || [],
        recommendations: pattern.recommendations || [],
        severity: pattern.severity || 'medium',
        tags: pattern.tags || [],
        detectedAt: new Date(),
        projectId,
        fileId,
        location: pattern.location
      }));

      // Store detected patterns
      patterns.forEach(pattern => {
        this.patterns.set(pattern.id, pattern);
      });

      // Cache for 30 minutes
      await this.cacheService.set(cacheKey, patterns, 1800);

      return patterns;

    } catch (error) {
      console.error('Pattern detection failed:', error);
      return [];
    }
  }

  async getPattern(patternId: string): Promise<Pattern | null> {
    return this.patterns.get(patternId) || null;
  }

  async listPatterns(
    filters: PatternFilters = {},
    pagination: { page: number; limit: number; offset: number },
    sort?: { field: string; order: 'asc' | 'desc' }
  ): Promise<{ patterns: Pattern[]; totalCount: number }> {
    let filteredPatterns = Array.from(this.patterns.values());

    // Apply filters
    if (filters.type) {
      filteredPatterns = filteredPatterns.filter(p => p.type === filters.type);
    }

    if (filters.category) {
      filteredPatterns = filteredPatterns.filter(p => p.category === filters.category);
    }

    if (filters.severity) {
      filteredPatterns = filteredPatterns.filter(p => p.severity === filters.severity);
    }

    if (filters.projectId) {
      filteredPatterns = filteredPatterns.filter(p => p.projectId === filters.projectId);
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredPatterns = filteredPatterns.filter(p =>
        filters.tags!.some(tag => p.tags.includes(tag))
      );
    }

    if (filters.confidence) {
      filteredPatterns = filteredPatterns.filter(p => {
        const { min, max } = filters.confidence!;
        return (!min || p.confidence >= min) && (!max || p.confidence <= max);
      });
    }

    // Apply sorting
    if (sort) {
      filteredPatterns.sort((a, b) => {
        const aValue = (a as any)[sort.field];
        const bValue = (b as any)[sort.field];
        const order = sort.order === 'desc' ? -1 : 1;

        if (aValue instanceof Date && bValue instanceof Date) {
          return (aValue.getTime() - bValue.getTime()) * order;
        }

        return aValue > bValue ? order : -order;
      });
    }

    // Apply pagination
    const totalCount = filteredPatterns.length;
    const paginatedPatterns = filteredPatterns.slice(
      pagination.offset,
      pagination.offset + pagination.limit
    );

    return {
      patterns: paginatedPatterns,
      totalCount
    };
  }

  async getPatternsByProject(projectId: string): Promise<Pattern[]> {
    return Array.from(this.patterns.values()).filter(p => p.projectId === projectId);
  }

  async getPatternStats(projectId?: string): Promise<any> {
    const patterns = projectId
      ? await this.getPatternsByProject(projectId)
      : Array.from(this.patterns.values());

    const stats = {
      total: patterns.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      averageConfidence: 0,
      topCategories: [] as Array<{ category: string; count: number }>,
      recentPatterns: patterns
        .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
        .slice(0, 5)
    };

    // Calculate statistics
    patterns.forEach(pattern => {
      stats.byType[pattern.type] = (stats.byType[pattern.type] || 0) + 1;
      stats.bySeverity[pattern.severity] = (stats.bySeverity[pattern.severity] || 0) + 1;
      stats.byCategory[pattern.category] = (stats.byCategory[pattern.category] || 0) + 1;
    });

    stats.averageConfidence = patterns.length > 0
      ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
      : 0;

    stats.topCategories = Object.entries(stats.byCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return stats;
  }

  async createCustomPattern(definition: CustomPatternDefinition): Promise<string> {
    const patternId = `custom_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.customPatterns.set(patternId, definition);

    // Clear related caches
    await this.cacheService.clearPattern('patterns:*');

    return patternId;
  }

  async updateCustomPattern(
    patternId: string,
    updates: Partial<CustomPatternDefinition>
  ): Promise<boolean> {
    const existing = this.customPatterns.get(patternId);
    if (!existing) {
      return false;
    }

    const updated = { ...existing, ...updates };
    this.customPatterns.set(patternId, updated);

    // Clear related caches
    await this.cacheService.clearPattern('patterns:*');

    return true;
  }

  async deleteCustomPattern(patternId: string): Promise<boolean> {
    const deleted = this.customPatterns.delete(patternId);

    if (deleted) {
      await this.cacheService.clearPattern('patterns:*');
    }

    return deleted;
  }

  async getCustomPatterns(): Promise<CustomPatternDefinition[]> {
    return Array.from(this.customPatterns.values());
  }

  async validatePattern(code: string, language: string): Promise<{
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  }> {
    // TODO: Implement actual pattern validation
    return {
      isValid: true,
      errors: [],
      suggestions: ['Consider adding more specific pattern matching']
    };
  }

  async comparePatterns(
    pattern1Id: string,
    pattern2Id: string
  ): Promise<any> {
    const pattern1 = await this.getPattern(pattern1Id);
    const pattern2 = await this.getPattern(pattern2Id);

    if (!pattern1 || !pattern2) {
      throw new Error('One or both patterns not found');
    }

    return {
      pattern1: pattern1.name,
      pattern2: pattern2.name,
      similarities: {
        category: pattern1.category === pattern2.category,
        type: pattern1.type === pattern2.type,
        severity: pattern1.severity === pattern2.severity
      },
      differences: {
        confidence: Math.abs(pattern1.confidence - pattern2.confidence),
        tags: {
          unique1: pattern1.tags.filter(tag => !pattern2.tags.includes(tag)),
          unique2: pattern2.tags.filter(tag => !pattern1.tags.includes(tag)),
          common: pattern1.tags.filter(tag => pattern2.tags.includes(tag))
        }
      }
    };
  }

  private generateCodeHash(code: string): string {
    // Simple hash for caching purposes
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private initializeSamplePatterns(): void {
    const samplePatterns: Pattern[] = [
      {
        id: 'pattern_1',
        name: 'React Hook Pattern',
        description: 'Proper use of React hooks following best practices',
        type: 'good_pattern',
        category: 'react',
        confidence: 95,
        examples: [
          'useEffect(() => { /* cleanup */ return () => {}; }, [dependencies])',
          'const [state, setState] = useState(initialValue)'
        ],
        recommendations: [
          'Continue using this pattern for state management',
          'Ensure proper dependency arrays in useEffect'
        ],
        severity: 'low',
        tags: ['react', 'hooks', 'best-practice'],
        detectedAt: new Date('2024-01-10'),
        projectId: 'proj_1'
      },
      {
        id: 'pattern_2',
        name: 'God Component Anti-Pattern',
        description: 'Component with too many responsibilities and high complexity',
        type: 'anti_pattern',
        category: 'architecture',
        confidence: 88,
        examples: [
          'Component with 500+ lines',
          'Component handling multiple unrelated concerns'
        ],
        recommendations: [
          'Break component into smaller, focused components',
          'Extract business logic into custom hooks',
          'Use composition over inheritance'
        ],
        severity: 'high',
        tags: ['architecture', 'complexity', 'maintainability'],
        detectedAt: new Date('2024-01-12'),
        projectId: 'proj_1'
      }
    ];

    samplePatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });

    // Sample custom patterns
    const sampleCustomPattern: CustomPatternDefinition = {
      name: 'Custom React Context Pattern',
      description: 'Detect proper React context usage with providers',
      type: 'good_pattern',
      category: 'react',
      pattern: 'createContext.*Provider',
      language: ['typescript', 'tsx'],
      severity: 'medium',
      recommendations: [
        'Ensure context has proper default values',
        'Use context sparingly to avoid prop drilling'
      ],
      tags: ['react', 'context', 'state-management']
    };

    this.customPatterns.set('custom_1', sampleCustomPattern);
  }
}