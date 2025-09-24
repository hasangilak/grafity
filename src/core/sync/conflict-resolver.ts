import { VisualChange, CodeModification, FileChange } from '../../types';
import { ConflictData, ConflictResolution } from '../events/change-event-system';

export interface ConflictAnalysis {
  conflictType: 'file_overlap' | 'component_overlap' | 'dependency_conflict' | 'semantic_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedAreas: string[];
  autoResolvable: boolean;
  recommendedStrategy: 'accept_human' | 'accept_ai' | 'merge' | 'manual_resolve';
  confidence: number;
}

export interface MergeStrategy {
  name: string;
  description: string;
  canMerge: (humanChange: any, aiChange: any) => boolean;
  merge: (humanChange: any, aiChange: any) => any;
}

export class ConflictResolver {
  private mergeStrategies: Map<string, MergeStrategy> = new Map();

  constructor() {
    this.initializeMergeStrategies();
  }

  public analyzeConflict(humanChange: VisualChange | CodeModification[], aiChange: VisualChange | CodeModification[]): ConflictAnalysis {
    const isHumanVisual = !Array.isArray(humanChange);
    const isAiVisual = !Array.isArray(aiChange);

    if (isHumanVisual && isAiVisual) {
      return this.analyzeVisualConflict(humanChange as VisualChange, aiChange as VisualChange);
    } else if (!isHumanVisual && !isAiVisual) {
      return this.analyzeCodeConflict(humanChange as CodeModification[], aiChange as CodeModification[]);
    } else {
      return this.analyzeMixedConflict(humanChange, aiChange);
    }
  }

  public generateResolutions(conflict: ConflictData, analysis: ConflictAnalysis): ConflictResolution[] {
    const baseResolutions: ConflictResolution[] = [
      {
        id: 'accept_human',
        strategy: 'accept_human',
        description: 'Keep human changes and discard AI suggestions'
      },
      {
        id: 'accept_ai',
        strategy: 'accept_ai',
        description: 'Apply AI suggestions and discard human changes'
      }
    ];

    if (analysis.autoResolvable && analysis.recommendedStrategy === 'merge') {
      const mergedResult = this.attemptAutoMerge(conflict.humanChange, conflict.aiChange, analysis);
      if (mergedResult) {
        baseResolutions.push({
          id: 'auto_merge',
          strategy: 'merge',
          description: `Automatically merge changes (${analysis.conflictType})`,
          mergedResult
        });
      }
    }

    baseResolutions.push({
      id: 'manual_resolve',
      strategy: 'manual_resolve',
      description: 'Manually review and resolve the conflict'
    });

    return baseResolutions;
  }

  public attemptAutoMerge(
    humanChange: VisualChange | CodeModification[],
    aiChange: VisualChange | CodeModification[],
    analysis?: ConflictAnalysis
  ): VisualChange | CodeModification[] | null {
    const isHumanVisual = !Array.isArray(humanChange);
    const isAiVisual = !Array.isArray(aiChange);

    if (isHumanVisual && isAiVisual) {
      return this.mergeVisualChanges(humanChange as VisualChange, aiChange as VisualChange);
    } else if (!isHumanVisual && !isAiVisual) {
      return this.mergeCodeModifications(humanChange as CodeModification[], aiChange as CodeModification[]);
    }

    return null;
  }

  private analyzeVisualConflict(humanChange: VisualChange, aiChange: VisualChange): ConflictAnalysis {
    const conflictsOnSameComponent = humanChange.sourceComponent === aiChange.sourceComponent;
    const conflictsOnRelatedComponents = humanChange.targetComponent === aiChange.sourceComponent ||
                                       humanChange.sourceComponent === aiChange.targetComponent;

    let conflictType: ConflictAnalysis['conflictType'];
    let severity: ConflictAnalysis['severity'];
    let autoResolvable = false;

    if (conflictsOnSameComponent) {
      conflictType = 'component_overlap';
      severity = humanChange.type === aiChange.type ? 'medium' : 'high';
      autoResolvable = humanChange.type !== aiChange.type;
    } else if (conflictsOnRelatedComponents) {
      conflictType = 'dependency_conflict';
      severity = 'low';
      autoResolvable = true;
    } else {
      conflictType = 'semantic_conflict';
      severity = 'low';
      autoResolvable = true;
    }

    return {
      conflictType,
      severity,
      description: `Visual changes conflict on ${conflictsOnSameComponent ? 'same component' : 'related components'}`,
      affectedAreas: [humanChange.sourceComponent, aiChange.sourceComponent].filter((v, i, a) => a.indexOf(v) === i),
      autoResolvable,
      recommendedStrategy: autoResolvable ? 'merge' : 'manual_resolve',
      confidence: autoResolvable ? 0.8 : 0.4
    };
  }

  private analyzeCodeConflict(humanChanges: CodeModification[], aiChanges: CodeModification[]): ConflictAnalysis {
    const humanFiles = new Set(humanChanges.map(c => c.file));
    const aiFiles = new Set(aiChanges.map(c => c.file));
    const overlappingFiles = Array.from(humanFiles).filter(f => aiFiles.has(f));

    let conflictType: ConflictAnalysis['conflictType'];
    let severity: ConflictAnalysis['severity'];
    let autoResolvable = false;

    if (overlappingFiles.length > 0) {
      const hasLineOverlaps = this.checkLineOverlaps(
        humanChanges.filter(c => overlappingFiles.includes(c.file)),
        aiChanges.filter(c => overlappingFiles.includes(c.file))
      );

      if (hasLineOverlaps) {
        conflictType = 'file_overlap';
        severity = 'high';
        autoResolvable = false;
      } else {
        conflictType = 'file_overlap';
        severity = 'medium';
        autoResolvable = true;
      }
    } else {
      conflictType = 'semantic_conflict';
      severity = 'low';
      autoResolvable = true;
    }

    return {
      conflictType,
      severity,
      description: `Code modifications conflict in ${overlappingFiles.length} file(s)`,
      affectedAreas: overlappingFiles,
      autoResolvable,
      recommendedStrategy: autoResolvable ? 'merge' : 'manual_resolve',
      confidence: autoResolvable ? 0.9 : 0.3
    };
  }

  private analyzeMixedConflict(humanChange: VisualChange | CodeModification[], aiChange: VisualChange | CodeModification[]): ConflictAnalysis {
    return {
      conflictType: 'semantic_conflict',
      severity: 'medium',
      description: 'Mixed visual and code changes cannot be automatically resolved',
      affectedAreas: ['mixed_changes'],
      autoResolvable: false,
      recommendedStrategy: 'manual_resolve',
      confidence: 0.2
    };
  }

  private checkLineOverlaps(humanChanges: CodeModification[], aiChanges: CodeModification[]): boolean {
    for (const humanMod of humanChanges) {
      for (const aiMod of aiChanges) {
        if (humanMod.file !== aiMod.file) continue;

        for (const humanChange of humanMod.changes) {
          for (const aiChangeItem of aiMod.changes) {
            if (this.linesOverlap(humanChange, aiChangeItem)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private linesOverlap(change1: FileChange, change2: FileChange): boolean {
    const start1 = change1.startLine;
    const end1 = change1.endLine === -1 ? start1 : change1.endLine;
    const start2 = change2.startLine;
    const end2 = change2.endLine === -1 ? start2 : change2.endLine;

    return !(end1 < start2 || end2 < start1);
  }

  private mergeVisualChanges(humanChange: VisualChange, aiChange: VisualChange): VisualChange | null {
    const strategy = this.mergeStrategies.get('visual_merge');
    if (strategy && strategy.canMerge(humanChange, aiChange)) {
      return strategy.merge(humanChange, aiChange);
    }

    if (humanChange.sourceComponent === aiChange.sourceComponent && humanChange.type !== aiChange.type) {
      return {
        ...humanChange,
        properties: { ...(humanChange.properties || {}), ...(aiChange.properties || {}) },
        businessIntent: `${humanChange.businessIntent || ''} + ${aiChange.businessIntent || ''}`.trim()
      };
    }

    return null;
  }

  private mergeCodeModifications(humanChanges: CodeModification[], aiChanges: CodeModification[]): CodeModification[] | null {
    const strategy = this.mergeStrategies.get('code_merge');
    if (strategy && strategy.canMerge(humanChanges, aiChanges)) {
      return strategy.merge(humanChanges, aiChanges);
    }

    const humanFileMap = new Map<string, CodeModification>();
    const aiFileMap = new Map<string, CodeModification>();

    humanChanges.forEach(mod => humanFileMap.set(mod.file, mod));
    aiChanges.forEach(mod => aiFileMap.set(mod.file, mod));

    const allFiles = new Set([...humanFileMap.keys(), ...aiFileMap.keys()]);
    const merged: CodeModification[] = [];

    for (const file of allFiles) {
      const humanMod = humanFileMap.get(file);
      const aiMod = aiFileMap.get(file);

      if (humanMod && aiMod) {
        const hasOverlap = this.checkLineOverlaps([humanMod], [aiMod]);
        if (hasOverlap) {
          return null;
        }

        merged.push({
          file,
          type: 'modify',
          changes: [...humanMod.changes, ...aiMod.changes],
          reasoning: `Merged changes: ${humanMod.reasoning} + ${aiMod.reasoning}`
        });
      } else {
        merged.push(humanMod || aiMod!);
      }
    }

    return merged;
  }

  private initializeMergeStrategies(): void {
    this.mergeStrategies.set('visual_merge', {
      name: 'Visual Change Merger',
      description: 'Merges non-conflicting visual changes on the same component',
      canMerge: (humanChange: VisualChange, aiChange: VisualChange) => {
        return humanChange.sourceComponent === aiChange.sourceComponent &&
               humanChange.type !== aiChange.type;
      },
      merge: (humanChange: VisualChange, aiChange: VisualChange) => ({
        ...humanChange,
        properties: { ...(humanChange.properties || {}), ...(aiChange.properties || {}) },
        businessIntent: `${humanChange.businessIntent || ''} + ${aiChange.businessIntent || ''}`.trim()
      })
    });

    this.mergeStrategies.set('code_merge', {
      name: 'Code Modification Merger',
      description: 'Merges non-overlapping code modifications',
      canMerge: (humanChanges: CodeModification[], aiChanges: CodeModification[]) => {
        const humanFiles = new Set(humanChanges.map(c => c.file));
        const aiFiles = new Set(aiChanges.map(c => c.file));
        const overlappingFiles = Array.from(humanFiles).filter(f => aiFiles.has(f));

        if (overlappingFiles.length === 0) return true;

        return !this.checkLineOverlaps(
          humanChanges.filter(c => overlappingFiles.includes(c.file)),
          aiChanges.filter(c => overlappingFiles.includes(c.file))
        );
      },
      merge: (humanChanges: CodeModification[], aiChanges: CodeModification[]) => {
        const humanFileMap = new Map<string, CodeModification>();
        const aiFileMap = new Map<string, CodeModification>();

        humanChanges.forEach(mod => humanFileMap.set(mod.file, mod));
        aiChanges.forEach(mod => aiFileMap.set(mod.file, mod));

        const allFiles = new Set([...humanFileMap.keys(), ...aiFileMap.keys()]);
        const merged: CodeModification[] = [];

        for (const file of allFiles) {
          const humanMod = humanFileMap.get(file);
          const aiMod = aiFileMap.get(file);

          if (humanMod && aiMod) {
            merged.push({
              file,
              type: 'modify',
              changes: [...humanMod.changes, ...aiMod.changes],
              reasoning: `Merged: ${humanMod.reasoning} + ${aiMod.reasoning}`
            });
          } else {
            merged.push(humanMod || aiMod!);
          }
        }

        return merged;
      }
    });
  }

  public addMergeStrategy(strategy: MergeStrategy): void {
    this.mergeStrategies.set(strategy.name, strategy);
  }

  public removeMergeStrategy(name: string): boolean {
    return this.mergeStrategies.delete(name);
  }

  public getAvailableStrategies(): string[] {
    return Array.from(this.mergeStrategies.keys());
  }
}