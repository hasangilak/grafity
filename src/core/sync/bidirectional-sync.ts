import { EventEmitter } from 'events';
import { ProjectGraph, VisualChange, AIResponse, CodeModification, FileChange } from '../../types';
import { GraphGenerator } from '../graph/generator';

export interface SyncOptions {
  debounceMs: number;
  enableConflictResolution: boolean;
  maxRetries: number;
}

export interface SyncEvent {
  id: string;
  timestamp: Date;
  type: 'visual_to_code' | 'code_to_visual';
  source: 'human' | 'ai';
  changes: VisualChange[] | CodeModification[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'conflict';
}

export class BidirectionalSync extends EventEmitter {
  private graphGenerator: GraphGenerator;
  private currentGraph: ProjectGraph | null = null;
  private pendingChanges: Map<string, SyncEvent> = new Map();
  private syncQueue: SyncEvent[] = [];
  private isProcessing = false;
  private options: SyncOptions;

  constructor(graphGenerator: GraphGenerator, options: Partial<SyncOptions> = {}) {
    super();
    this.graphGenerator = graphGenerator;
    this.options = {
      debounceMs: 500,
      enableConflictResolution: true,
      maxRetries: 3,
      ...options
    };
  }

  public setCurrentGraph(graph: ProjectGraph): void {
    this.currentGraph = graph;
    this.emit('graph_updated', graph);
  }

  public async handleVisualChange(change: VisualChange, source: 'human' | 'ai' = 'human'): Promise<string> {
    const eventId = this.generateEventId();
    const event: SyncEvent = {
      id: eventId,
      timestamp: new Date(),
      type: 'visual_to_code',
      source,
      changes: [change],
      status: 'pending'
    };

    this.queueSyncEvent(event);
    return eventId;
  }

  public async handleCodeModifications(modifications: CodeModification[], source: 'human' | 'ai' = 'human'): Promise<string> {
    const eventId = this.generateEventId();
    const event: SyncEvent = {
      id: eventId,
      timestamp: new Date(),
      type: 'code_to_visual',
      source,
      changes: modifications,
      status: 'pending'
    };

    this.queueSyncEvent(event);
    return eventId;
  }

  private queueSyncEvent(event: SyncEvent): void {
    this.syncQueue.push(event);
    this.pendingChanges.set(event.id, event);

    if (!this.isProcessing) {
      setTimeout(() => this.processSyncQueue(), this.options.debounceMs);
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (this.isProcessing || this.syncQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.syncQueue.length > 0) {
        const event = this.syncQueue.shift()!;
        await this.processEvent(event);
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: SyncEvent): Promise<void> {
    try {
      event.status = 'processing';
      this.emit('sync_event_started', event);

      if (event.type === 'visual_to_code') {
        await this.handleVisualToCodeSync(event);
      } else {
        await this.handleCodeToVisualSync(event);
      }

      event.status = 'completed';
      this.emit('sync_event_completed', event);
    } catch (error) {
      event.status = 'failed';
      this.emit('sync_event_failed', event, error);
      console.error(`Sync event ${event.id} failed:`, error);
    }
  }

  private async handleVisualToCodeSync(event: SyncEvent): Promise<void> {
    if (!this.currentGraph) {
      throw new Error('No current graph available for sync');
    }

    const visualChanges = event.changes as VisualChange[];

    for (const change of visualChanges) {
      const codeModifications = await this.generateCodeFromVisualChange(change);

      if (codeModifications.length > 0) {
        await this.applyCodeModifications(codeModifications);

        this.currentGraph = await this.graphGenerator.generateGraph(this.currentGraph.files[0]?.path.split('/').slice(0, -1).join('/') || '.');
        this.emit('code_updated', { eventId: event.id, modifications: codeModifications });
      }
    }
  }

  private async handleCodeToVisualSync(event: SyncEvent): Promise<void> {
    if (!this.currentGraph) {
      throw new Error('No current graph available for sync');
    }

    const codeModifications = event.changes as CodeModification[];

    this.currentGraph = await this.graphGenerator.generateGraph(this.currentGraph.files[0]?.path.split('/').slice(0, -1).join('/') || '.');

    const affectedComponents = new Set<string>();
    for (const modification of codeModifications) {
      const components = this.findAffectedComponents(modification);
      components.forEach(comp => affectedComponents.add(comp));
    }

    this.emit('visual_updated', {
      eventId: event.id,
      updatedGraph: this.currentGraph,
      affectedComponents: Array.from(affectedComponents)
    });
  }

  private async generateCodeFromVisualChange(change: VisualChange): Promise<CodeModification[]> {
    const modifications: CodeModification[] = [];

    switch (change.type) {
      case 'connect':
        if (change.targetComponent) {
          modifications.push(await this.generateConnectionCode(change.sourceComponent, change.targetComponent, change));
        }
        break;

      case 'modify':
        modifications.push(await this.generateModificationCode(change.sourceComponent, change));
        break;

      case 'create':
        modifications.push(await this.generateCreationCode(change.sourceComponent, change));
        break;

      case 'delete':
        modifications.push(await this.generateDeletionCode(change.sourceComponent, change));
        break;

      case 'drag':
        break;
    }

    return modifications;
  }

  private async generateConnectionCode(source: string, target: string, change: VisualChange): Promise<CodeModification> {
    const sourceFile = this.findComponentFile(source);
    const targetFile = this.findComponentFile(target);

    if (!sourceFile || !targetFile) {
      throw new Error(`Could not find files for components: ${source}, ${target}`);
    }

    const importStatement = this.generateImportStatement(target, sourceFile, targetFile);
    const usageCode = this.generateComponentUsage(target, change.properties || {});

    return {
      file: sourceFile,
      type: 'modify',
      changes: [
        {
          startLine: 1,
          endLine: 1,
          oldContent: '',
          newContent: importStatement + '\n',
          changeType: 'add'
        },
        {
          startLine: -1,
          endLine: -1,
          oldContent: '',
          newContent: usageCode,
          changeType: 'add'
        }
      ],
      reasoning: `Connected ${source} to ${target} based on visual change`,
      businessJustification: change.businessIntent || 'User-requested component connection'
    };
  }

  private async generateModificationCode(component: string, change: VisualChange): Promise<CodeModification> {
    const componentFile = this.findComponentFile(component);

    if (!componentFile) {
      throw new Error(`Could not find file for component: ${component}`);
    }

    return {
      file: componentFile,
      type: 'modify',
      changes: [
        {
          startLine: 1,
          endLine: -1,
          oldContent: '',
          newContent: this.generateModificationContent(change.properties || {}),
          changeType: 'modify'
        }
      ],
      reasoning: `Modified ${component} based on visual change`,
      businessJustification: change.businessIntent || 'User-requested component modification'
    };
  }

  private async generateCreationCode(component: string, change: VisualChange): Promise<CodeModification> {
    const filePath = this.generateComponentFilePath(component);
    const componentCode = this.generateComponentTemplate(component, change.properties || {});

    return {
      file: filePath,
      type: 'create',
      changes: [
        {
          startLine: 1,
          endLine: 1,
          oldContent: '',
          newContent: componentCode,
          changeType: 'add'
        }
      ],
      reasoning: `Created new component ${component} based on visual change`,
      businessJustification: change.businessIntent || 'User-requested component creation'
    };
  }

  private async generateDeletionCode(component: string, change: VisualChange): Promise<CodeModification> {
    const componentFile = this.findComponentFile(component);

    if (!componentFile) {
      throw new Error(`Could not find file for component: ${component}`);
    }

    return {
      file: componentFile,
      type: 'delete',
      changes: [
        {
          startLine: 1,
          endLine: -1,
          oldContent: 'entire file',
          newContent: '',
          changeType: 'remove'
        }
      ],
      reasoning: `Deleted component ${component} based on visual change`,
      businessJustification: change.businessIntent || 'User-requested component deletion'
    };
  }

  private async applyCodeModifications(modifications: CodeModification[]): Promise<void> {
    for (const modification of modifications) {
      this.emit('applying_code_modification', modification);
    }
  }

  private findAffectedComponents(modification: CodeModification): string[] {
    if (!this.currentGraph) return [];

    return this.currentGraph.components
      .filter(comp => comp.filePath === modification.file)
      .map(comp => comp.name);
  }

  private findComponentFile(componentName: string): string | null {
    if (!this.currentGraph) return null;

    const component = this.currentGraph.components.find(comp => comp.name === componentName);
    return component?.filePath || null;
  }

  private generateImportStatement(componentName: string, sourceFile: string, targetFile: string): string {
    const relativePath = this.getRelativePath(sourceFile, targetFile);
    return `import { ${componentName} } from '${relativePath}';`;
  }

  private generateComponentUsage(componentName: string, properties: Record<string, any>): string {
    const props = Object.entries(properties)
      .map(([key, value]) => `${key}={${JSON.stringify(value)}}`)
      .join(' ');

    return `<${componentName} ${props} />`;
  }

  private generateModificationContent(properties: Record<string, any>): string {
    return `// Modified with properties: ${JSON.stringify(properties, null, 2)}`;
  }

  private generateComponentFilePath(componentName: string): string {
    return `./src/components/${componentName}.tsx`;
  }

  private generateComponentTemplate(componentName: string, properties: Record<string, any>): string {
    const propsInterface = Object.keys(properties).length > 0
      ? `interface ${componentName}Props {\n${Object.entries(properties)
          .map(([key, value]) => `  ${key}: ${typeof value};`)
          .join('\n')}\n}\n\n`
      : '';

    const propsParam = Object.keys(properties).length > 0 ? `props: ${componentName}Props` : '';

    return `import React from 'react';

${propsInterface}export const ${componentName}: React.FC<${Object.keys(properties).length > 0 ? `${componentName}Props` : ''}> = (${propsParam}) => {
  return (
    <div>
      <h1>${componentName}</h1>
    </div>
  );
};

export default ${componentName};
`;
  }

  private getRelativePath(from: string, to: string): string {
    const fromParts = from.split('/').slice(0, -1);
    const toParts = to.split('/').slice(0, -1);

    let commonLength = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    const upLevels = fromParts.length - commonLength;
    const downPath = toParts.slice(commonLength);

    const relativeParts = Array(upLevels).fill('..').concat(downPath);
    const fileName = to.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') || '';

    return relativeParts.length > 0
      ? `./${relativeParts.join('/')}/${fileName}`
      : `./${fileName}`;
  }

  private generateEventId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getEventStatus(eventId: string): SyncEvent | null {
    return this.pendingChanges.get(eventId) || null;
  }

  public cancelEvent(eventId: string): boolean {
    const event = this.pendingChanges.get(eventId);
    if (event && event.status === 'pending') {
      event.status = 'failed';
      this.syncQueue = this.syncQueue.filter(e => e.id !== eventId);
      this.pendingChanges.delete(eventId);
      this.emit('sync_event_cancelled', event);
      return true;
    }
    return false;
  }

  public getPendingEvents(): SyncEvent[] {
    return Array.from(this.pendingChanges.values());
  }

  public clearQueue(): void {
    this.syncQueue = [];
    this.pendingChanges.clear();
    this.emit('queue_cleared');
  }
}