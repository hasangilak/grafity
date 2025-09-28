/**
 * Core edge types for the Grafity graph engine
 */

export type EdgeRelationType =
  // Code relationships
  | 'imports'
  | 'exports'
  | 'calls'
  | 'extends'
  | 'implements'
  | 'uses'
  | 'renders'
  | 'passes_props'
  | 'uses_state'
  | 'provides_context'
  | 'consumes_context'

  // Business relationships
  | 'implements_feature'
  | 'solves_requirement'
  | 'part_of_story'
  | 'depends_on'
  | 'blocks'

  // Document relationships
  | 'documents'
  | 'references'
  | 'describes'
  | 'specifies'

  // Conversation relationships
  | 'responds_to'
  | 'mentions'
  | 'discusses'
  | 'decides'

  // Cross-domain relationships
  | 'relates_to'
  | 'connects_with'
  | 'bidirectional';

export interface EdgeMetadata {
  createdAt: Date;
  updatedAt: Date;
  confidence?: number;
  source?: string;
  automatic?: boolean;
  [key: string]: any;
}

export interface GraphEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  type: EdgeRelationType;
  label?: string;
  weight?: number; // 0-1, strength of relationship
  bidirectional: boolean;
  metadata: EdgeMetadata;
}

/**
 * Bi-directional edge helper
 * Creates two edges for bi-directional relationships
 */
export function createBidirectionalEdge(
  source: string,
  target: string,
  type: EdgeRelationType,
  params?: Partial<GraphEdge>
): [GraphEdge, GraphEdge] {
  const baseEdge = {
    type,
    weight: 1,
    bidirectional: true,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date()
    },
    ...params
  };

  const forwardEdge: GraphEdge = {
    ...baseEdge,
    id: `${source}-${type}-${target}`,
    source,
    target,
    label: params?.label || `${type} →`
  };

  const reverseEdge: GraphEdge = {
    ...baseEdge,
    id: `${target}-${type}-${source}`,
    source: target,
    target: source,
    label: params?.label ? `← ${params.label}` : `← ${type}`
  };

  return [forwardEdge, reverseEdge];
}

/**
 * Edge creation helper
 */
export function createEdge(params: Omit<GraphEdge, 'metadata'> & { metadata?: Partial<EdgeMetadata> }): GraphEdge {
  return {
    ...params,
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...params.metadata
    }
  };
}

/**
 * Edge type categorization
 */
export function getEdgeCategory(type: EdgeRelationType): 'code' | 'business' | 'document' | 'conversation' | 'cross-domain' {
  const codeTypes: EdgeRelationType[] = [
    'imports', 'exports', 'calls', 'extends', 'implements',
    'uses', 'renders', 'passes_props', 'uses_state',
    'provides_context', 'consumes_context'
  ];

  const businessTypes: EdgeRelationType[] = [
    'implements_feature', 'solves_requirement', 'part_of_story',
    'depends_on', 'blocks'
  ];

  const documentTypes: EdgeRelationType[] = [
    'documents', 'references', 'describes', 'specifies'
  ];

  const conversationTypes: EdgeRelationType[] = [
    'responds_to', 'mentions', 'discusses', 'decides'
  ];

  if (codeTypes.includes(type)) return 'code';
  if (businessTypes.includes(type)) return 'business';
  if (documentTypes.includes(type)) return 'document';
  if (conversationTypes.includes(type)) return 'conversation';
  return 'cross-domain';
}

/**
 * Edge strength calculation
 */
export function calculateEdgeStrength(edge: GraphEdge): number {
  // Base weight
  let strength = edge.weight || 0.5;

  // Adjust based on type
  const category = getEdgeCategory(edge.type);
  switch (category) {
    case 'code':
      strength *= 1.2; // Code relationships are stronger
      break;
    case 'business':
      strength *= 1.0;
      break;
    case 'document':
      strength *= 0.8;
      break;
    case 'conversation':
      strength *= 0.6;
      break;
    default:
      strength *= 0.7;
  }

  // Bidirectional edges are stronger
  if (edge.bidirectional) {
    strength *= 1.3;
  }

  // Confidence adjustment
  if (edge.metadata.confidence) {
    strength *= edge.metadata.confidence;
  }

  return Math.min(1, Math.max(0, strength));
}