import { ProjectGraph, DependencyGraph, ComponentInfo, DataFlow, UserJourney } from '../../../types/index.js';

export interface SecurityVulnerability {
  id: string;
  type: 'data_leak' | 'xss' | 'sql_injection' | 'csrf' | 'auth_bypass' | 'sensitive_data' | 'insecure_transport' | 'weak_crypto' | 'path_traversal' | 'code_injection';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affected_components: string[];
  data_flow_path: string[];
  confidence: number; // 0-100
  cwe_id?: string; // Common Weakness Enumeration
  owasp_category?: string;
  remediation: RemediationSuggestion[];
  potential_impact: ImpactAssessment;
  detection_context: DetectionContext;
}

export interface RemediationSuggestion {
  action: 'sanitize_input' | 'add_authentication' | 'encrypt_data' | 'add_validation' | 'update_dependency' | 'add_rate_limiting' | 'secure_headers' | 'fix_permissions';
  description: string;
  code_example?: string;
  priority: number;
  estimated_effort: 'low' | 'medium' | 'high';
}

export interface ImpactAssessment {
  data_at_risk: string[];
  business_impact: 'low' | 'medium' | 'high' | 'critical';
  compliance_violations: string[];
  user_data_exposure: boolean;
  system_compromise_risk: number; // 0-100
}

export interface DetectionContext {
  detection_method: 'static_analysis' | 'data_flow' | 'pattern_matching' | 'ai_inference';
  source_locations: SourceLocation[];
  data_flow_trace: DataFlowTrace[];
  related_vulnerabilities: string[];
}

export interface SourceLocation {
  file_path: string;
  line_number?: number;
  function_name?: string;
  component_name?: string;
}

export interface DataFlowTrace {
  step: number;
  component: string;
  operation: string;
  data_type: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface SecurityAnalysisResult {
  vulnerabilities: SecurityVulnerability[];
  security_score: number; // 0-100
  risk_assessment: RiskAssessment;
  compliance_status: ComplianceStatus;
  recommendations: SecurityRecommendation[];
  data_flow_risks: DataFlowRisk[];
}

export interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
  attack_surface: AttackSurface;
  threat_vectors: ThreatVector[];
  risk_factors: RiskFactor[];
}

export interface AttackSurface {
  external_endpoints: number;
  user_input_points: number;
  database_connections: number;
  third_party_integrations: number;
  authentication_mechanisms: string[];
}

export interface ThreatVector {
  name: string;
  likelihood: number; // 0-100
  impact: number; // 0-100
  mitigation_status: 'none' | 'partial' | 'complete';
}

export interface RiskFactor {
  factor: string;
  weight: number;
  description: string;
  mitigation_available: boolean;
}

export interface ComplianceStatus {
  frameworks: ComplianceFramework[];
  overall_score: number; // 0-100
  gaps: ComplianceGap[];
}

export interface ComplianceFramework {
  name: 'OWASP' | 'PCI_DSS' | 'GDPR' | 'HIPAA' | 'SOX' | 'ISO_27001';
  score: number; // 0-100
  requirements_met: number;
  total_requirements: number;
  critical_gaps: string[];
}

export interface ComplianceGap {
  framework: string;
  requirement: string;
  description: string;
  remediation_steps: string[];
}

export interface SecurityRecommendation {
  id: string;
  category: 'authentication' | 'authorization' | 'input_validation' | 'data_protection' | 'secure_communication' | 'error_handling' | 'logging' | 'configuration';
  priority: number;
  title: string;
  description: string;
  implementation_guidance: string;
  code_examples: string[];
  related_vulnerabilities: string[];
}

export interface DataFlowRisk {
  flow_id: string;
  source: string;
  destination: string;
  data_sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  encryption_status: 'encrypted' | 'unencrypted' | 'unknown';
  validation_status: 'validated' | 'unvalidated' | 'partial';
  risk_score: number; // 0-100
  potential_vulnerabilities: string[];
}

export class SecurityAnalyzer {
  private readonly SECURITY_PATTERNS = {
    SQL_INJECTION: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+.*\+.*\$/gi,
    XSS_PATTERNS: /innerHTML|outerHTML|document\.write|eval\(/gi,
    HARDCODED_SECRETS: /(?:password|secret|key|token|api_key)\s*[:=]\s*['"'][^'"]+['"]/gi,
    INSECURE_CRYPTO: /MD5|SHA1|DES|RC4/gi,
    PATH_TRAVERSAL: /\.\.\//gi,
    WEAK_RANDOM: /Math\.random\(\)/gi
  };

  private readonly SENSITIVE_DATA_PATTERNS = {
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    CREDIT_CARD: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    PHONE: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
  };

  private readonly HIGH_RISK_LIBRARIES = [
    'eval', 'exec', 'child_process', 'vm', 'fs', 'http', 'https', 'net',
    'crypto', 'buffer', 'url', 'querystring', 'path'
  ];

  public async analyzeSecurityVulnerabilities(graph: ProjectGraph): Promise<SecurityAnalysisResult> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const dataFlowRisks: DataFlowRisk[] = [];

    // Analyze data flows for security risks
    if (graph.dataFlows) {
      for (const flow of graph.dataFlows) {
        const flowRisks = await this.analyzeDataFlowSecurity(flow, graph);
        dataFlowRisks.push(...flowRisks);

        const flowVulnerabilities = await this.detectDataFlowVulnerabilities(flow, graph);
        vulnerabilities.push(...flowVulnerabilities);
      }
    }

    // Analyze components for security issues
    if (graph.dependencies?.nodes) {
      for (const node of graph.dependencies.nodes) {
        if (node.type === 'component' && node.metadata) {
          const componentVulns = await this.analyzeComponentSecurity(node.metadata as ComponentInfo, graph);
          vulnerabilities.push(...componentVulns);
        }
      }
    }

    // Analyze user journeys for security gaps
    if (graph.userJourneys) {
      for (const journey of graph.userJourneys) {
        const journeyVulns = await this.analyzeUserJourneySecurity(journey, graph);
        vulnerabilities.push(...journeyVulns);
      }
    }

    const riskAssessment = this.calculateRiskAssessment(vulnerabilities, graph);
    const complianceStatus = this.assessCompliance(vulnerabilities, graph);
    const recommendations = this.generateSecurityRecommendations(vulnerabilities, graph);
    const securityScore = this.calculateSecurityScore(vulnerabilities, riskAssessment);

    return {
      vulnerabilities,
      security_score: securityScore,
      risk_assessment: riskAssessment,
      compliance_status: complianceStatus,
      recommendations,
      data_flow_risks: dataFlowRisks
    };
  }

  private async analyzeDataFlowSecurity(flow: DataFlow, graph: ProjectGraph): Promise<DataFlowRisk[]> {
    const risks: DataFlowRisk[] = [];

    // Analyze each step in the data flow
    if (flow.steps) {
      for (let i = 0; i < flow.steps.length - 1; i++) {
        const source = flow.steps[i];
        const destination = flow.steps[i + 1];

        const risk: DataFlowRisk = {
          flow_id: `${flow.id}_step_${i}`,
          source: source.component || source.function || 'unknown',
          destination: destination.component || destination.function || 'unknown',
          data_sensitivity: this.assessDataSensitivity(flow.data_type || 'unknown'),
          encryption_status: this.checkEncryptionStatus(source, destination),
          validation_status: this.checkValidationStatus(source, destination),
          risk_score: 0,
          potential_vulnerabilities: []
        };

        // Calculate risk score based on multiple factors
        risk.risk_score = this.calculateDataFlowRiskScore(risk, flow);

        // Identify potential vulnerabilities in this data flow
        risk.potential_vulnerabilities = this.identifyDataFlowVulnerabilities(risk, flow);

        if (risk.risk_score > 30) { // Only include medium+ risk flows
          risks.push(risk);
        }
      }
    }

    return risks;
  }

  private async detectDataFlowVulnerabilities(flow: DataFlow, graph: ProjectGraph): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for unvalidated user input
    if (flow.source === 'user_input' && !this.hasInputValidation(flow, graph)) {
      vulnerabilities.push({
        id: `input_validation_${flow.id}`,
        type: 'xss',
        severity: 'high',
        title: 'Unvalidated User Input',
        description: `Data flow ${flow.id} processes user input without proper validation, potentially leading to XSS or injection attacks.`,
        affected_components: this.getFlowComponents(flow),
        data_flow_path: this.getFlowPath(flow),
        confidence: 85,
        cwe_id: 'CWE-79',
        owasp_category: 'A03:2021 – Injection',
        remediation: [{
          action: 'add_validation',
          description: 'Implement input validation and sanitization for user-provided data',
          code_example: 'const sanitized = DOMPurify.sanitize(userInput);',
          priority: 1,
          estimated_effort: 'medium'
        }],
        potential_impact: {
          data_at_risk: ['user_data', 'session_tokens'],
          business_impact: 'high',
          compliance_violations: ['OWASP_TOP_10'],
          user_data_exposure: true,
          system_compromise_risk: 75
        },
        detection_context: {
          detection_method: 'data_flow',
          source_locations: this.getFlowSourceLocations(flow),
          data_flow_trace: this.buildDataFlowTrace(flow),
          related_vulnerabilities: []
        }
      });
    }

    // Check for sensitive data exposure
    if (this.containsSensitiveData(flow) && !this.hasDataProtection(flow, graph)) {
      vulnerabilities.push({
        id: `data_exposure_${flow.id}`,
        type: 'sensitive_data',
        severity: 'critical',
        title: 'Sensitive Data Exposure',
        description: `Data flow ${flow.id} handles sensitive information without adequate protection measures.`,
        affected_components: this.getFlowComponents(flow),
        data_flow_path: this.getFlowPath(flow),
        confidence: 90,
        cwe_id: 'CWE-200',
        owasp_category: 'A02:2021 – Cryptographic Failures',
        remediation: [{
          action: 'encrypt_data',
          description: 'Encrypt sensitive data at rest and in transit',
          code_example: 'const encrypted = CryptoJS.AES.encrypt(sensitiveData, secretKey);',
          priority: 1,
          estimated_effort: 'high'
        }],
        potential_impact: {
          data_at_risk: ['personal_information', 'financial_data', 'authentication_tokens'],
          business_impact: 'critical',
          compliance_violations: ['GDPR', 'PCI_DSS'],
          user_data_exposure: true,
          system_compromise_risk: 95
        },
        detection_context: {
          detection_method: 'data_flow',
          source_locations: this.getFlowSourceLocations(flow),
          data_flow_trace: this.buildDataFlowTrace(flow),
          related_vulnerabilities: []
        }
      });
    }

    // Check for SQL injection risks in database flows
    if (flow.destination === 'database' && this.hasSQLInjectionRisk(flow, graph)) {
      vulnerabilities.push({
        id: `sql_injection_${flow.id}`,
        type: 'sql_injection',
        severity: 'critical',
        title: 'SQL Injection Vulnerability',
        description: `Database flow ${flow.id} constructs SQL queries using unsanitized user input.`,
        affected_components: this.getFlowComponents(flow),
        data_flow_path: this.getFlowPath(flow),
        confidence: 80,
        cwe_id: 'CWE-89',
        owasp_category: 'A03:2021 – Injection',
        remediation: [{
          action: 'sanitize_input',
          description: 'Use parameterized queries and input sanitization',
          code_example: 'const query = "SELECT * FROM users WHERE id = ?"; db.query(query, [userId]);',
          priority: 1,
          estimated_effort: 'medium'
        }],
        potential_impact: {
          data_at_risk: ['database_records', 'system_configuration'],
          business_impact: 'critical',
          compliance_violations: ['OWASP_TOP_10', 'PCI_DSS'],
          user_data_exposure: true,
          system_compromise_risk: 90
        },
        detection_context: {
          detection_method: 'data_flow',
          source_locations: this.getFlowSourceLocations(flow),
          data_flow_trace: this.buildDataFlowTrace(flow),
          related_vulnerabilities: []
        }
      });
    }

    return vulnerabilities;
  }

  private async analyzeComponentSecurity(component: ComponentInfo, graph: ProjectGraph): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for dangerous React patterns
    if (component.type === 'react' && component.props) {
      // Check for dangerouslySetInnerHTML usage
      const hasDangerousHTML = component.props.some(prop => prop.name === 'dangerouslySetInnerHTML');
      if (hasDangerousHTML) {
        vulnerabilities.push({
          id: `xss_${component.name}`,
          type: 'xss',
          severity: 'high',
          title: 'Potential XSS via dangerouslySetInnerHTML',
          description: `Component ${component.name} uses dangerouslySetInnerHTML which can lead to XSS attacks if not properly sanitized.`,
          affected_components: [component.name],
          data_flow_path: [component.name],
          confidence: 70,
          cwe_id: 'CWE-79',
          owasp_category: 'A03:2021 – Injection',
          remediation: [{
            action: 'sanitize_input',
            description: 'Sanitize HTML content before rendering or use safe alternatives',
            code_example: 'import DOMPurify from "dompurify"; const clean = DOMPurify.sanitize(dirty);',
            priority: 1,
            estimated_effort: 'low'
          }],
          potential_impact: {
            data_at_risk: ['user_sessions', 'dom_content'],
            business_impact: 'medium',
            compliance_violations: ['OWASP_TOP_10'],
            user_data_exposure: true,
            system_compromise_risk: 60
          },
          detection_context: {
            detection_method: 'static_analysis',
            source_locations: [{
              file_path: component.file_path || '',
              component_name: component.name
            }],
            data_flow_trace: [],
            related_vulnerabilities: []
          }
        });
      }
    }

    // Check for insecure state management
    if (component.hooks) {
      const hasPasswordState = component.hooks.some(hook =>
        hook.type === 'useState' &&
        (hook.name?.toLowerCase().includes('password') || hook.name?.toLowerCase().includes('secret'))
      );

      if (hasPasswordState) {
        vulnerabilities.push({
          id: `insecure_state_${component.name}`,
          type: 'sensitive_data',
          severity: 'medium',
          title: 'Sensitive Data in Component State',
          description: `Component ${component.name} stores sensitive information in React state without encryption.`,
          affected_components: [component.name],
          data_flow_path: [component.name],
          confidence: 75,
          cwe_id: 'CWE-316',
          owasp_category: 'A02:2021 – Cryptographic Failures',
          remediation: [{
            action: 'encrypt_data',
            description: 'Avoid storing sensitive data in component state or encrypt it',
            code_example: 'Use secure storage solutions or encrypt sensitive data before storing',
            priority: 2,
            estimated_effort: 'medium'
          }],
          potential_impact: {
            data_at_risk: ['user_credentials', 'personal_data'],
            business_impact: 'medium',
            compliance_violations: ['GDPR'],
            user_data_exposure: true,
            system_compromise_risk: 45
          },
          detection_context: {
            detection_method: 'static_analysis',
            source_locations: [{
              file_path: component.file_path || '',
              component_name: component.name
            }],
            data_flow_trace: [],
            related_vulnerabilities: []
          }
        });
      }
    }

    return vulnerabilities;
  }

  private async analyzeUserJourneySecurity(journey: UserJourney, graph: ProjectGraph): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for authentication gaps in protected journeys
    if (journey.persona && journey.persona.includes('authenticated') && journey.steps) {
      const hasAuthCheck = journey.steps.some(step =>
        step.action?.includes('login') ||
        step.action?.includes('authenticate') ||
        step.requirements?.includes('authenticated')
      );

      if (!hasAuthCheck) {
        vulnerabilities.push({
          id: `auth_bypass_${journey.id}`,
          type: 'auth_bypass',
          severity: 'high',
          title: 'Missing Authentication Check',
          description: `User journey ${journey.name} requires authentication but lacks proper authentication validation.`,
          affected_components: journey.steps?.map(step => step.component) || [],
          data_flow_path: journey.steps?.map(step => step.component) || [],
          confidence: 85,
          cwe_id: 'CWE-306',
          owasp_category: 'A07:2021 – Identification and Authentication Failures',
          remediation: [{
            action: 'add_authentication',
            description: 'Implement proper authentication checks for protected routes',
            code_example: 'if (!isAuthenticated(user)) { return redirect("/login"); }',
            priority: 1,
            estimated_effort: 'medium'
          }],
          potential_impact: {
            data_at_risk: ['user_data', 'protected_resources'],
            business_impact: 'high',
            compliance_violations: ['OWASP_TOP_10'],
            user_data_exposure: true,
            system_compromise_risk: 80
          },
          detection_context: {
            detection_method: 'pattern_matching',
            source_locations: [],
            data_flow_trace: [],
            related_vulnerabilities: []
          }
        });
      }
    }

    return vulnerabilities;
  }

  private assessDataSensitivity(dataType: string): 'public' | 'internal' | 'confidential' | 'restricted' {
    const sensitiveTypes = ['password', 'token', 'key', 'secret', 'credential', 'ssn', 'credit_card', 'personal'];
    const confidentialTypes = ['user_data', 'profile', 'email', 'phone', 'address'];
    const internalTypes = ['api_response', 'config', 'metadata'];

    if (sensitiveTypes.some(type => dataType.toLowerCase().includes(type))) {
      return 'restricted';
    } else if (confidentialTypes.some(type => dataType.toLowerCase().includes(type))) {
      return 'confidential';
    } else if (internalTypes.some(type => dataType.toLowerCase().includes(type))) {
      return 'internal';
    }

    return 'public';
  }

  private checkEncryptionStatus(source: any, destination: any): 'encrypted' | 'unencrypted' | 'unknown' {
    // Simple heuristic - in real implementation, would analyze actual code
    if (source.operation?.includes('encrypt') || destination.operation?.includes('decrypt')) {
      return 'encrypted';
    }
    if (source.protocol === 'https' || destination.protocol === 'https') {
      return 'encrypted';
    }
    return 'unencrypted';
  }

  private checkValidationStatus(source: any, destination: any): 'validated' | 'unvalidated' | 'partial' {
    // Simple heuristic - in real implementation, would analyze validation logic
    if (source.operation?.includes('validate') || source.operation?.includes('sanitize')) {
      return 'validated';
    }
    return 'unvalidated';
  }

  private calculateDataFlowRiskScore(risk: DataFlowRisk, flow: DataFlow): number {
    let score = 0;

    // Data sensitivity factor
    switch (risk.data_sensitivity) {
      case 'restricted': score += 40; break;
      case 'confidential': score += 30; break;
      case 'internal': score += 20; break;
      case 'public': score += 10; break;
    }

    // Encryption factor
    switch (risk.encryption_status) {
      case 'unencrypted': score += 30; break;
      case 'unknown': score += 20; break;
      case 'encrypted': score += 0; break;
    }

    // Validation factor
    switch (risk.validation_status) {
      case 'unvalidated': score += 30; break;
      case 'partial': score += 15; break;
      case 'validated': score += 0; break;
    }

    return Math.min(score, 100);
  }

  private identifyDataFlowVulnerabilities(risk: DataFlowRisk, flow: DataFlow): string[] {
    const vulnerabilities: string[] = [];

    if (risk.data_sensitivity === 'restricted' && risk.encryption_status === 'unencrypted') {
      vulnerabilities.push('sensitive_data_exposure');
    }

    if (risk.validation_status === 'unvalidated') {
      vulnerabilities.push('injection_attack');
      vulnerabilities.push('xss_vulnerability');
    }

    if (flow.source === 'user_input' && flow.destination === 'database') {
      vulnerabilities.push('sql_injection');
    }

    return vulnerabilities;
  }

  private hasInputValidation(flow: DataFlow, graph: ProjectGraph): boolean {
    // Check if any step in the flow performs validation
    return flow.steps?.some(step =>
      step.operation?.includes('validate') ||
      step.operation?.includes('sanitize') ||
      step.operation?.includes('escape')
    ) || false;
  }

  private containsSensitiveData(flow: DataFlow): boolean {
    const sensitivePatterns = ['password', 'ssn', 'credit_card', 'token', 'key', 'secret'];
    return sensitivePatterns.some(pattern =>
      flow.data_type?.toLowerCase().includes(pattern) ||
      flow.description?.toLowerCase().includes(pattern)
    );
  }

  private hasDataProtection(flow: DataFlow, graph: ProjectGraph): boolean {
    return flow.steps?.some(step =>
      step.operation?.includes('encrypt') ||
      step.operation?.includes('hash') ||
      step.operation?.includes('protect')
    ) || false;
  }

  private hasSQLInjectionRisk(flow: DataFlow, graph: ProjectGraph): boolean {
    return flow.source === 'user_input' &&
           flow.destination === 'database' &&
           !this.hasParameterizedQueries(flow);
  }

  private hasParameterizedQueries(flow: DataFlow): boolean {
    return flow.steps?.some(step =>
      step.operation?.includes('prepare') ||
      step.operation?.includes('parameter') ||
      step.operation?.includes('bind')
    ) || false;
  }

  private getFlowComponents(flow: DataFlow): string[] {
    return flow.steps?.map(step => step.component || step.function || 'unknown') || [];
  }

  private getFlowPath(flow: DataFlow): string[] {
    return flow.steps?.map(step => `${step.component || step.function}:${step.operation}`) || [];
  }

  private getFlowSourceLocations(flow: DataFlow): SourceLocation[] {
    return flow.steps?.map(step => ({
      file_path: step.file_path || '',
      component_name: step.component,
      function_name: step.function
    })) || [];
  }

  private buildDataFlowTrace(flow: DataFlow): DataFlowTrace[] {
    return flow.steps?.map((step, index) => ({
      step: index + 1,
      component: step.component || step.function || 'unknown',
      operation: step.operation || 'unknown',
      data_type: step.data_type || flow.data_type || 'unknown',
      risk_level: this.assessStepRiskLevel(step)
    })) || [];
  }

  private assessStepRiskLevel(step: any): 'low' | 'medium' | 'high' {
    if (step.operation?.includes('user_input') || step.operation?.includes('external_api')) {
      return 'high';
    }
    if (step.operation?.includes('database') || step.operation?.includes('file_system')) {
      return 'medium';
    }
    return 'low';
  }

  private calculateRiskAssessment(vulnerabilities: SecurityVulnerability[], graph: ProjectGraph): RiskAssessment {
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumCount = vulnerabilities.filter(v => v.severity === 'medium').length;

    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalCount > 0) overallRisk = 'critical';
    else if (highCount > 2) overallRisk = 'high';
    else if (highCount > 0 || mediumCount > 5) overallRisk = 'medium';

    return {
      overall_risk: overallRisk,
      attack_surface: this.calculateAttackSurface(graph),
      threat_vectors: this.identifyThreatVectors(vulnerabilities),
      risk_factors: this.calculateRiskFactors(vulnerabilities, graph)
    };
  }

  private calculateAttackSurface(graph: ProjectGraph): AttackSurface {
    // Simplified calculation - would be more sophisticated in real implementation
    return {
      external_endpoints: graph.dependencies?.edges?.filter(e => e.type === 'api_call').length || 0,
      user_input_points: graph.dataFlows?.filter(f => f.source === 'user_input').length || 0,
      database_connections: graph.dataFlows?.filter(f => f.destination === 'database').length || 0,
      third_party_integrations: graph.dependencies?.edges?.filter(e => e.type === 'external_dependency').length || 0,
      authentication_mechanisms: ['jwt', 'session', 'oauth']
    };
  }

  private identifyThreatVectors(vulnerabilities: SecurityVulnerability[]): ThreatVector[] {
    const threatMap = new Map<string, { count: number, maxSeverity: string }>();

    vulnerabilities.forEach(vuln => {
      const existing = threatMap.get(vuln.type) || { count: 0, maxSeverity: 'low' };
      existing.count++;
      if (this.severityWeight(vuln.severity) > this.severityWeight(existing.maxSeverity)) {
        existing.maxSeverity = vuln.severity;
      }
      threatMap.set(vuln.type, existing);
    });

    return Array.from(threatMap.entries()).map(([type, data]) => ({
      name: type,
      likelihood: Math.min(data.count * 20, 100),
      impact: this.severityWeight(data.maxSeverity) * 25,
      mitigation_status: 'none' as const
    }));
  }

  private severityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  private calculateRiskFactors(vulnerabilities: SecurityVulnerability[], graph: ProjectGraph): RiskFactor[] {
    return [
      {
        factor: 'Input Validation',
        weight: 0.8,
        description: 'Lack of proper input validation increases injection attack risks',
        mitigation_available: true
      },
      {
        factor: 'Data Encryption',
        weight: 0.7,
        description: 'Unencrypted sensitive data increases exposure risks',
        mitigation_available: true
      },
      {
        factor: 'Authentication Mechanisms',
        weight: 0.9,
        description: 'Weak or missing authentication allows unauthorized access',
        mitigation_available: true
      }
    ];
  }

  private assessCompliance(vulnerabilities: SecurityVulnerability[], graph: ProjectGraph): ComplianceStatus {
    const frameworks: ComplianceFramework[] = [
      {
        name: 'OWASP',
        score: this.calculateOWASPCompliance(vulnerabilities),
        requirements_met: 0,
        total_requirements: 10,
        critical_gaps: vulnerabilities.filter(v => v.owasp_category).map(v => v.title)
      }
    ];

    return {
      frameworks,
      overall_score: Math.round(frameworks.reduce((sum, f) => sum + f.score, 0) / frameworks.length),
      gaps: this.identifyComplianceGaps(vulnerabilities)
    };
  }

  private calculateOWASPCompliance(vulnerabilities: SecurityVulnerability[]): number {
    const owaspVulns = vulnerabilities.filter(v => v.owasp_category);
    const maxScore = 100;
    const penalty = owaspVulns.length * 10;
    return Math.max(maxScore - penalty, 0);
  }

  private identifyComplianceGaps(vulnerabilities: SecurityVulnerability[]): ComplianceGap[] {
    return vulnerabilities.map(vuln => ({
      framework: vuln.owasp_category || 'Unknown',
      requirement: vuln.title,
      description: vuln.description,
      remediation_steps: vuln.remediation.map(r => r.description)
    }));
  }

  private generateSecurityRecommendations(vulnerabilities: SecurityVulnerability[], graph: ProjectGraph): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = [];

    // Generate recommendations based on vulnerability patterns
    if (vulnerabilities.some(v => v.type === 'xss')) {
      recommendations.push({
        id: 'input_sanitization',
        category: 'input_validation',
        priority: 1,
        title: 'Implement Input Sanitization',
        description: 'Add comprehensive input validation and sanitization to prevent XSS attacks',
        implementation_guidance: 'Use libraries like DOMPurify for HTML sanitization and validate all user inputs',
        code_examples: [
          'import DOMPurify from "dompurify";',
          'const clean = DOMPurify.sanitize(userInput);'
        ],
        related_vulnerabilities: vulnerabilities.filter(v => v.type === 'xss').map(v => v.id)
      });
    }

    if (vulnerabilities.some(v => v.type === 'sql_injection')) {
      recommendations.push({
        id: 'parameterized_queries',
        category: 'data_protection',
        priority: 1,
        title: 'Use Parameterized Queries',
        description: 'Replace dynamic SQL construction with parameterized queries',
        implementation_guidance: 'Use prepared statements or ORM methods that automatically handle parameter binding',
        code_examples: [
          'const query = "SELECT * FROM users WHERE id = ?";',
          'db.query(query, [userId]);'
        ],
        related_vulnerabilities: vulnerabilities.filter(v => v.type === 'sql_injection').map(v => v.id)
      });
    }

    return recommendations;
  }

  private calculateSecurityScore(vulnerabilities: SecurityVulnerability[], riskAssessment: RiskAssessment): number {
    let score = 100;

    // Deduct points based on vulnerabilities
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 8; break;
        case 'low': score -= 3; break;
      }
    });

    // Additional deductions for high overall risk
    if (riskAssessment.overall_risk === 'critical') score -= 20;
    else if (riskAssessment.overall_risk === 'high') score -= 10;

    return Math.max(score, 0);
  }
}