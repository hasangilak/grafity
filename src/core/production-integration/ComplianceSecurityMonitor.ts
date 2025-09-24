import { ProjectGraph, ComponentInfo, DependencyNode, DataFlow } from '../../types/core.js';

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: ComplianceCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  standards: string[];
  checkFunction: (context: ComplianceContext) => Promise<ComplianceViolation[]>;
}

export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  category: SecurityCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cweId?: string;
  owaspCategory?: string;
  checkFunction: (context: SecurityContext) => Promise<SecurityVulnerability[]>;
}

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  componentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  description: string;
  location: CodeLocation;
  suggestedFix: string;
  businessImpact: BusinessImpact;
  auditTrail: AuditEvent[];
  remediationSteps: RemediationStep[];
  complianceStandards: string[];
}

export interface SecurityVulnerability {
  id: string;
  ruleId: string;
  componentId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cveScore?: number;
  attackVector: AttackVector;
  description: string;
  location: CodeLocation;
  exploitability: 'low' | 'medium' | 'high';
  impact: SecurityImpact;
  mitigation: MitigationStrategy;
  threatModel: ThreatModel;
  dataFlowRisk: DataFlowRisk[];
}

export interface ComplianceContext {
  graph: ProjectGraph;
  component: ComponentInfo;
  dataFlows: DataFlow[];
  dependencies: DependencyNode[];
  businessContext: BusinessContext;
}

export interface SecurityContext {
  graph: ProjectGraph;
  component: ComponentInfo;
  dataFlows: DataFlow[];
  dependencies: DependencyNode[];
  networkExposure: NetworkExposure;
  dataClassification: DataClassification;
}

export interface VisualIndicator {
  type: 'badge' | 'border' | 'overlay' | 'icon' | 'animation';
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  color: string;
  icon?: string;
  text?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blinking?: boolean;
  tooltip: string;
  actionable: boolean;
  onClick?: () => void;
}

export interface ComplianceReport {
  id: string;
  timestamp: Date;
  projectId: string;
  overallScore: number;
  violations: ComplianceViolation[];
  standardsCompliance: StandardCompliance[];
  recommendations: ComplianceRecommendation[];
  visualIndicators: Map<string, VisualIndicator[]>;
  auditReady: boolean;
  certificationStatus: CertificationStatus[];
}

export interface SecurityReport {
  id: string;
  timestamp: Date;
  projectId: string;
  riskScore: number;
  vulnerabilities: SecurityVulnerability[];
  threatAssessment: ThreatAssessment;
  recommendations: SecurityRecommendation[];
  visualIndicators: Map<string, VisualIndicator[]>;
  penetrationTestReady: boolean;
  securityPosture: SecurityPosture;
}

export type ComplianceCategory =
  | 'data-privacy'
  | 'access-control'
  | 'audit-logging'
  | 'encryption'
  | 'business-continuity'
  | 'change-management'
  | 'documentation'
  | 'testing'
  | 'monitoring'
  | 'incident-response';

export type SecurityCategory =
  | 'injection'
  | 'authentication'
  | 'session-management'
  | 'access-control'
  | 'security-misconfiguration'
  | 'sensitive-data'
  | 'insufficient-logging'
  | 'insecure-deserialization'
  | 'vulnerable-components'
  | 'insufficient-validation';

interface CodeLocation {
  file: string;
  line: number;
  column: number;
  function?: string;
  context: string;
}

interface BusinessImpact {
  financial: number;
  reputation: 'low' | 'medium' | 'high';
  operational: 'low' | 'medium' | 'high';
  regulatory: 'low' | 'medium' | 'high';
  customerTrust: 'low' | 'medium' | 'high';
}

interface SecurityImpact {
  confidentiality: 'low' | 'medium' | 'high';
  integrity: 'low' | 'medium' | 'high';
  availability: 'low' | 'medium' | 'high';
  dataExposure: DataExposureRisk;
  systemAccess: SystemAccessRisk;
}

interface AttackVector {
  network: boolean;
  local: boolean;
  physical: boolean;
  userInteraction: boolean;
  privilegeRequired: 'none' | 'low' | 'high';
  complexity: 'low' | 'medium' | 'high';
}

interface AuditEvent {
  timestamp: Date;
  action: string;
  user: string;
  details: any;
  remediated: boolean;
}

interface RemediationStep {
  step: number;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  automated: boolean;
  dependencies: string[];
}

interface MitigationStrategy {
  immediate: string[];
  shortTerm: string[];
  longTerm: string[];
  preventive: string[];
  detective: string[];
  responsive: string[];
}

interface ThreatModel {
  threatActors: ThreatActor[];
  attackScenarios: AttackScenario[];
  assetValue: 'low' | 'medium' | 'high' | 'critical';
  exposureLevel: 'internal' | 'partner' | 'public';
}

interface DataFlowRisk {
  dataType: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  encryption: boolean;
  transit: boolean;
  storage: boolean;
  processing: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface BusinessContext {
  industry: string;
  regulations: string[];
  geographies: string[];
  customerTypes: string[];
  dataTypes: string[];
}

interface NetworkExposure {
  internetFacing: boolean;
  internalNetwork: boolean;
  partnerNetwork: boolean;
  ports: number[];
  protocols: string[];
}

interface DataClassification {
  pii: boolean;
  phi: boolean;
  financial: boolean;
  intellectual: boolean;
  classified: boolean;
  level: 'public' | 'internal' | 'confidential' | 'restricted';
}

interface StandardCompliance {
  standard: string;
  version: string;
  score: number;
  requiredScore: number;
  status: 'compliant' | 'non-compliant' | 'partial';
  gaps: ComplianceGap[];
}

interface ComplianceRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: ComplianceCategory;
  title: string;
  description: string;
  impact: BusinessImpact;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  dependencies: string[];
}

interface SecurityRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: SecurityCategory;
  title: string;
  description: string;
  impact: SecurityImpact;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  dependencies: string[];
}

interface CertificationStatus {
  certification: string;
  status: 'certified' | 'pending' | 'expired' | 'non-compliant';
  expiryDate?: Date;
  nextAssessment?: Date;
  requirements: string[];
}

interface ThreatAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  threatLandscape: ThreatLandscape;
  vulnerabilityExposure: VulnerabilityExposure;
  controlEffectiveness: ControlEffectiveness;
  residualRisk: ResidualRisk;
}

interface SecurityPosture {
  maturityLevel: 'initial' | 'developing' | 'defined' | 'managed' | 'optimizing';
  controlCategories: ControlCategory[];
  benchmarkComparison: BenchmarkComparison;
  improvementPlan: ImprovementPlan;
}

interface ComplianceGap {
  requirement: string;
  currentState: string;
  targetState: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

interface ThreatActor {
  type: 'nation-state' | 'criminal' | 'hacktivist' | 'insider' | 'competitor';
  sophistication: 'low' | 'medium' | 'high';
  motivation: string[];
  capabilities: string[];
}

interface AttackScenario {
  name: string;
  steps: string[];
  probability: 'low' | 'medium' | 'high';
  impact: SecurityImpact;
  mitigations: string[];
}

interface DataExposureRisk {
  recordCount: number;
  dataTypes: string[];
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  regulatoryImpact: string[];
}

interface SystemAccessRisk {
  privilegeLevel: 'user' | 'admin' | 'system' | 'root';
  systemCriticality: 'low' | 'medium' | 'high' | 'critical';
  lateralMovement: boolean;
  persistencePossible: boolean;
}

interface ThreatLandscape {
  activeThreats: string[];
  emergingThreats: string[];
  industryTrends: string[];
  geographicRisks: string[];
}

interface VulnerabilityExposure {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  patchingEfficiency: number;
  zeroDay: boolean;
}

interface ControlEffectiveness {
  preventive: number;
  detective: number;
  responsive: number;
  overall: number;
  gaps: string[];
}

interface ResidualRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  acceptanceStatus: 'accepted' | 'mitigating' | 'transferring' | 'avoiding';
  mitigationPlan: string[];
  timeline: string;
}

interface ControlCategory {
  name: string;
  maturity: 'initial' | 'developing' | 'defined' | 'managed' | 'optimizing';
  effectiveness: number;
  coverage: number;
  gaps: string[];
}

interface BenchmarkComparison {
  industry: string;
  peerScore: number;
  ourScore: number;
  ranking: string;
  improvements: string[];
}

interface ImprovementPlan {
  phases: ImprovementPhase[];
  budget: number;
  timeline: string;
  expectedBenefits: string[];
}

interface ImprovementPhase {
  name: string;
  duration: string;
  activities: string[];
  budget: number;
  expectedOutcome: string;
}

export class ComplianceSecurityMonitor {
  private complianceRules: ComplianceRule[] = [];
  private securityRules: SecurityRule[] = [];
  private visualIndicators: Map<string, VisualIndicator[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  public async performComplianceAudit(graph: ProjectGraph): Promise<ComplianceReport> {
    const violations: ComplianceViolation[] = [];
    const visualIndicators: Map<string, VisualIndicator[]> = new Map();

    for (const component of Object.values(graph.components)) {
      const context: ComplianceContext = {
        graph,
        component,
        dataFlows: graph.dataFlows?.filter(df =>
          df.source === component.id || df.target === component.id
        ) || [],
        dependencies: graph.dependencies.nodes.filter(node =>
          node.id === component.id
        ),
        businessContext: await this.getBusinessContext(component)
      };

      for (const rule of this.complianceRules) {
        const ruleViolations = await rule.checkFunction(context);
        violations.push(...ruleViolations);

        if (ruleViolations.length > 0) {
          const indicators = this.createComplianceIndicators(ruleViolations);
          const existing = visualIndicators.get(component.id) || [];
          visualIndicators.set(component.id, [...existing, ...indicators]);
        }
      }
    }

    return {
      id: this.generateId(),
      timestamp: new Date(),
      projectId: graph.projectName,
      overallScore: this.calculateComplianceScore(violations),
      violations,
      standardsCompliance: await this.assessStandardsCompliance(violations),
      recommendations: this.generateComplianceRecommendations(violations),
      visualIndicators,
      auditReady: this.isAuditReady(violations),
      certificationStatus: await this.getCertificationStatus(graph)
    };
  }

  public async performSecurityAssessment(graph: ProjectGraph): Promise<SecurityReport> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const visualIndicators: Map<string, VisualIndicator[]> = new Map();

    for (const component of Object.values(graph.components)) {
      const context: SecurityContext = {
        graph,
        component,
        dataFlows: graph.dataFlows?.filter(df =>
          df.source === component.id || df.target === component.id
        ) || [],
        dependencies: graph.dependencies.nodes.filter(node =>
          node.id === component.id
        ),
        networkExposure: await this.assessNetworkExposure(component),
        dataClassification: await this.classifyData(component)
      };

      for (const rule of this.securityRules) {
        const ruleVulnerabilities = await rule.checkFunction(context);
        vulnerabilities.push(...ruleVulnerabilities);

        if (ruleVulnerabilities.length > 0) {
          const indicators = this.createSecurityIndicators(ruleVulnerabilities);
          const existing = visualIndicators.get(component.id) || [];
          visualIndicators.set(component.id, [...existing, ...indicators]);
        }
      }
    }

    return {
      id: this.generateId(),
      timestamp: new Date(),
      projectId: graph.projectName,
      riskScore: this.calculateRiskScore(vulnerabilities),
      vulnerabilities,
      threatAssessment: await this.performThreatAssessment(vulnerabilities, graph),
      recommendations: this.generateSecurityRecommendations(vulnerabilities),
      visualIndicators,
      penetrationTestReady: this.isPenetrationTestReady(vulnerabilities),
      securityPosture: await this.assessSecurityPosture(graph, vulnerabilities)
    };
  }

  public async getContinuousMonitoring(graph: ProjectGraph): Promise<{
    compliance: ComplianceReport;
    security: SecurityReport;
    trends: MonitoringTrends;
    alerts: MonitoringAlert[];
  }> {
    const [compliance, security] = await Promise.all([
      this.performComplianceAudit(graph),
      this.performSecurityAssessment(graph)
    ]);

    const trends = await this.analyzeTrends(compliance, security);
    const alerts = this.generateAlerts(compliance, security);

    return {
      compliance,
      security,
      trends,
      alerts
    };
  }

  public getVisualIndicators(componentId: string): VisualIndicator[] {
    return this.visualIndicators.get(componentId) || [];
  }

  private initializeDefaultRules(): void {
    this.complianceRules = [
      {
        id: 'gdpr-data-processing',
        name: 'GDPR Data Processing Compliance',
        description: 'Ensures personal data processing complies with GDPR requirements',
        category: 'data-privacy',
        severity: 'critical',
        standards: ['GDPR', 'ISO 27001'],
        checkFunction: async (context) => this.checkGDPRCompliance(context)
      },
      {
        id: 'sox-audit-logging',
        name: 'SOX Audit Logging Requirements',
        description: 'Verifies audit logging meets SOX compliance standards',
        category: 'audit-logging',
        severity: 'high',
        standards: ['SOX', 'COSO'],
        checkFunction: async (context) => this.checkSOXLogging(context)
      },
      {
        id: 'hipaa-phi-protection',
        name: 'HIPAA PHI Protection',
        description: 'Ensures protected health information is properly secured',
        category: 'data-privacy',
        severity: 'critical',
        standards: ['HIPAA', 'NIST'],
        checkFunction: async (context) => this.checkHIPAACompliance(context)
      },
      {
        id: 'pci-dss-cardholder-data',
        name: 'PCI DSS Cardholder Data Protection',
        description: 'Validates cardholder data protection requirements',
        category: 'encryption',
        severity: 'critical',
        standards: ['PCI DSS'],
        checkFunction: async (context) => this.checkPCIDSSCompliance(context)
      }
    ];

    this.securityRules = [
      {
        id: 'sql-injection-prevention',
        name: 'SQL Injection Prevention',
        description: 'Detects potential SQL injection vulnerabilities',
        category: 'injection',
        severity: 'high',
        cweId: 'CWE-89',
        owaspCategory: 'A03:2021',
        checkFunction: async (context) => this.checkSQLInjection(context)
      },
      {
        id: 'authentication-bypass',
        name: 'Authentication Bypass Detection',
        description: 'Identifies authentication bypass vulnerabilities',
        category: 'authentication',
        severity: 'critical',
        cweId: 'CWE-287',
        owaspCategory: 'A07:2021',
        checkFunction: async (context) => this.checkAuthenticationBypass(context)
      },
      {
        id: 'sensitive-data-exposure',
        name: 'Sensitive Data Exposure',
        description: 'Detects exposure of sensitive data',
        category: 'sensitive-data',
        severity: 'high',
        cweId: 'CWE-200',
        owaspCategory: 'A02:2021',
        checkFunction: async (context) => this.checkSensitiveDataExposure(context)
      },
      {
        id: 'insecure-deserialization',
        name: 'Insecure Deserialization',
        description: 'Identifies insecure deserialization patterns',
        category: 'insecure-deserialization',
        severity: 'medium',
        cweId: 'CWE-502',
        owaspCategory: 'A08:2021',
        checkFunction: async (context) => this.checkInsecureDeserialization(context)
      }
    ];
  }

  private async checkGDPRCompliance(context: ComplianceContext): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const personalDataFlows = context.dataFlows.filter(df =>
      this.containsPersonalData(df.data)
    );

    for (const flow of personalDataFlows) {
      if (!this.hasConsentMechanism(context.component)) {
        violations.push({
          id: this.generateId(),
          ruleId: 'gdpr-data-processing',
          componentId: context.component.id,
          severity: 'critical',
          message: 'Missing consent mechanism for personal data processing',
          description: 'GDPR requires explicit consent for processing personal data',
          location: this.getComponentLocation(context.component),
          suggestedFix: 'Implement consent collection and management system',
          businessImpact: {
            financial: 4000000,
            reputation: 'high',
            operational: 'medium',
            regulatory: 'high',
            customerTrust: 'high'
          },
          auditTrail: [],
          remediationSteps: [
            {
              step: 1,
              description: 'Implement consent collection mechanism',
              priority: 'high',
              effort: 'high',
              automated: false,
              dependencies: ['legal-review']
            }
          ],
          complianceStandards: ['GDPR Article 6', 'GDPR Article 7']
        });
      }

      if (!this.hasDataMinimization(flow)) {
        violations.push({
          id: this.generateId(),
          ruleId: 'gdpr-data-processing',
          componentId: context.component.id,
          severity: 'high',
          message: 'Data minimization principle violation',
          description: 'Processing more personal data than necessary',
          location: this.getComponentLocation(context.component),
          suggestedFix: 'Implement data minimization controls',
          businessImpact: {
            financial: 2000000,
            reputation: 'medium',
            operational: 'low',
            regulatory: 'high',
            customerTrust: 'medium'
          },
          auditTrail: [],
          remediationSteps: [
            {
              step: 1,
              description: 'Audit data collection points',
              priority: 'medium',
              effort: 'medium',
              automated: true,
              dependencies: ['data-inventory']
            }
          ],
          complianceStandards: ['GDPR Article 5']
        });
      }
    }

    return violations;
  }

  private async checkSOXLogging(context: ComplianceContext): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    if (!this.hasAuditLogging(context.component)) {
      violations.push({
        id: this.generateId(),
        ruleId: 'sox-audit-logging',
        componentId: context.component.id,
        severity: 'high',
        message: 'Missing SOX-compliant audit logging',
        description: 'Financial systems must maintain comprehensive audit trails',
        location: this.getComponentLocation(context.component),
        suggestedFix: 'Implement comprehensive audit logging system',
        businessImpact: {
          financial: 1000000,
          reputation: 'high',
          operational: 'medium',
          regulatory: 'high',
          customerTrust: 'medium'
        },
        auditTrail: [],
        remediationSteps: [
          {
            step: 1,
            description: 'Implement audit logging framework',
            priority: 'high',
            effort: 'medium',
            automated: true,
            dependencies: ['logging-infrastructure']
          }
        ],
        complianceStandards: ['SOX Section 404', 'COSO Framework']
      });
    }

    return violations;
  }

  private async checkHIPAACompliance(context: ComplianceContext): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const phiFlows = context.dataFlows.filter(df =>
      this.containsPHI(df.data)
    );

    for (const flow of phiFlows) {
      if (!this.hasEncryptionInTransit(flow)) {
        violations.push({
          id: this.generateId(),
          ruleId: 'hipaa-phi-protection',
          componentId: context.component.id,
          severity: 'critical',
          message: 'PHI transmitted without encryption',
          description: 'HIPAA requires encryption of PHI in transit',
          location: this.getComponentLocation(context.component),
          suggestedFix: 'Implement TLS encryption for PHI transmission',
          businessImpact: {
            financial: 5000000,
            reputation: 'high',
            operational: 'high',
            regulatory: 'high',
            customerTrust: 'high'
          },
          auditTrail: [],
          remediationSteps: [
            {
              step: 1,
              description: 'Implement TLS encryption',
              priority: 'high',
              effort: 'low',
              automated: true,
              dependencies: ['ssl-certificates']
            }
          ],
          complianceStandards: ['HIPAA Security Rule', '45 CFR 164.312(e)(1)']
        });
      }
    }

    return violations;
  }

  private async checkPCIDSSCompliance(context: ComplianceContext): Promise<ComplianceViolation[]> {
    const violations: ComplianceViolation[] = [];

    const cardholderDataFlows = context.dataFlows.filter(df =>
      this.containsCardholderData(df.data)
    );

    for (const flow of cardholderDataFlows) {
      if (!this.hasTokenization(flow)) {
        violations.push({
          id: this.generateId(),
          ruleId: 'pci-dss-cardholder-data',
          componentId: context.component.id,
          severity: 'critical',
          message: 'Cardholder data not tokenized',
          description: 'PCI DSS requires protection of stored cardholder data',
          location: this.getComponentLocation(context.component),
          suggestedFix: 'Implement tokenization for cardholder data',
          businessImpact: {
            financial: 10000000,
            reputation: 'high',
            operational: 'high',
            regulatory: 'high',
            customerTrust: 'high'
          },
          auditTrail: [],
          remediationSteps: [
            {
              step: 1,
              description: 'Implement tokenization service',
              priority: 'high',
              effort: 'high',
              automated: false,
              dependencies: ['tokenization-vendor', 'security-review']
            }
          ],
          complianceStandards: ['PCI DSS Requirement 3']
        });
      }
    }

    return violations;
  }

  private async checkSQLInjection(context: SecurityContext): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    const dbInteractions = context.dataFlows.filter(df =>
      this.isDatabaseInteraction(df)
    );

    for (const interaction of dbInteractions) {
      if (!this.usesParameterizedQueries(interaction)) {
        vulnerabilities.push({
          id: this.generateId(),
          ruleId: 'sql-injection-prevention',
          componentId: context.component.id,
          severity: 'high',
          cveScore: 7.5,
          attackVector: {
            network: true,
            local: false,
            physical: false,
            userInteraction: false,
            privilegeRequired: 'none',
            complexity: 'low'
          },
          description: 'SQL injection vulnerability due to dynamic query construction',
          location: this.getComponentLocation(context.component),
          exploitability: 'high',
          impact: {
            confidentiality: 'high',
            integrity: 'high',
            availability: 'medium',
            dataExposure: {
              recordCount: 1000000,
              dataTypes: ['user_data', 'financial'],
              sensitivity: 'high',
              regulatoryImpact: ['GDPR', 'PCI DSS']
            },
            systemAccess: {
              privilegeLevel: 'admin',
              systemCriticality: 'high',
              lateralMovement: true,
              persistencePossible: true
            }
          },
          mitigation: {
            immediate: ['Input validation', 'Web application firewall'],
            shortTerm: ['Parameterized queries', 'Code review'],
            longTerm: ['ORM implementation', 'Security training'],
            preventive: ['Static analysis', 'Secure coding standards'],
            detective: ['SQL injection monitoring', 'Anomaly detection'],
            responsive: ['Incident response plan', 'Data breach procedures']
          },
          threatModel: {
            threatActors: [
              {
                type: 'criminal',
                sophistication: 'medium',
                motivation: ['financial', 'data-theft'],
                capabilities: ['automated-scanning', 'exploit-kits']
              }
            ],
            attackScenarios: [
              {
                name: 'Automated SQL injection attack',
                steps: ['Scan for vulnerable endpoints', 'Test injection payloads', 'Extract data'],
                probability: 'high',
                impact: {
                  confidentiality: 'high',
                  integrity: 'high',
                  availability: 'medium',
                  dataExposure: {
                    recordCount: 1000000,
                    dataTypes: ['user_data'],
                    sensitivity: 'high',
                    regulatoryImpact: ['GDPR']
                  },
                  systemAccess: {
                    privilegeLevel: 'admin',
                    systemCriticality: 'high',
                    lateralMovement: true,
                    persistencePossible: true
                  }
                },
                mitigations: ['WAF', 'Input validation']
              }
            ],
            assetValue: 'critical',
            exposureLevel: 'public'
          },
          dataFlowRisk: [
            {
              dataType: 'user_credentials',
              classification: 'restricted',
              encryption: false,
              transit: true,
              storage: true,
              processing: true,
              riskLevel: 'critical'
            }
          ]
        });
      }
    }

    return vulnerabilities;
  }

  private async checkAuthenticationBypass(context: SecurityContext): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    if (this.hasAuthenticationBypass(context.component)) {
      vulnerabilities.push({
        id: this.generateId(),
        ruleId: 'authentication-bypass',
        componentId: context.component.id,
        severity: 'critical',
        cveScore: 9.1,
        attackVector: {
          network: true,
          local: false,
          physical: false,
          userInteraction: false,
          privilegeRequired: 'none',
          complexity: 'low'
        },
        description: 'Authentication bypass vulnerability allows unauthorized access',
        location: this.getComponentLocation(context.component),
        exploitability: 'high',
        impact: {
          confidentiality: 'high',
          integrity: 'high',
          availability: 'high',
          dataExposure: {
            recordCount: 10000000,
            dataTypes: ['all_user_data', 'system_data'],
            sensitivity: 'critical',
            regulatoryImpact: ['GDPR', 'HIPAA', 'SOX']
          },
          systemAccess: {
            privilegeLevel: 'admin',
            systemCriticality: 'critical',
            lateralMovement: true,
            persistencePossible: true
          }
        },
        mitigation: {
          immediate: ['Disable vulnerable endpoint', 'Emergency patching'],
          shortTerm: ['Authentication review', 'Session management'],
          longTerm: ['Multi-factor authentication', 'Zero trust architecture'],
          preventive: ['Security testing', 'Code review'],
          detective: ['Authentication monitoring', 'Anomaly detection'],
          responsive: ['Incident response', 'User notification']
        },
        threatModel: {
          threatActors: [
            {
              type: 'criminal',
              sophistication: 'high',
              motivation: ['financial', 'espionage'],
              capabilities: ['advanced-persistent-threat', 'zero-day-exploits']
            }
          ],
          attackScenarios: [
            {
              name: 'Authentication bypass exploitation',
              steps: ['Identify bypass mechanism', 'Gain unauthorized access', 'Escalate privileges'],
              probability: 'medium',
              impact: {
                confidentiality: 'high',
                integrity: 'high',
                availability: 'high',
                dataExposure: {
                  recordCount: 10000000,
                  dataTypes: ['all_data'],
                  sensitivity: 'critical',
                  regulatoryImpact: ['All applicable']
                },
                systemAccess: {
                  privilegeLevel: 'system',
                  systemCriticality: 'critical',
                  lateralMovement: true,
                  persistencePossible: true
                }
              },
              mitigations: ['MFA', 'Session management']
            }
          ],
          assetValue: 'critical',
          exposureLevel: 'public'
        },
        dataFlowRisk: [
          {
            dataType: 'authentication_tokens',
            classification: 'restricted',
            encryption: true,
            transit: true,
            storage: true,
            processing: true,
            riskLevel: 'critical'
          }
        ]
      });
    }

    return vulnerabilities;
  }

  private async checkSensitiveDataExposure(context: SecurityContext): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    const sensitiveFlows = context.dataFlows.filter(df =>
      this.containsSensitiveData(df.data)
    );

    for (const flow of sensitiveFlows) {
      if (!this.hasProperEncryption(flow)) {
        vulnerabilities.push({
          id: this.generateId(),
          ruleId: 'sensitive-data-exposure',
          componentId: context.component.id,
          severity: 'high',
          cveScore: 6.5,
          attackVector: {
            network: true,
            local: false,
            physical: false,
            userInteraction: false,
            privilegeRequired: 'low',
            complexity: 'medium'
          },
          description: 'Sensitive data exposed without proper encryption',
          location: this.getComponentLocation(context.component),
          exploitability: 'medium',
          impact: {
            confidentiality: 'high',
            integrity: 'low',
            availability: 'low',
            dataExposure: {
              recordCount: 500000,
              dataTypes: ['personal_data', 'financial'],
              sensitivity: 'high',
              regulatoryImpact: ['GDPR', 'CCPA']
            },
            systemAccess: {
              privilegeLevel: 'user',
              systemCriticality: 'medium',
              lateralMovement: false,
              persistencePossible: false
            }
          },
          mitigation: {
            immediate: ['Data encryption', 'Access controls'],
            shortTerm: ['Encryption at rest', 'Key management'],
            longTerm: ['Data classification', 'DLP implementation'],
            preventive: ['Secure coding', 'Data discovery'],
            detective: ['Data monitoring', 'Access logging'],
            responsive: ['Breach response', 'Customer notification']
          },
          threatModel: {
            threatActors: [
              {
                type: 'criminal',
                sophistication: 'low',
                motivation: ['financial', 'identity-theft'],
                capabilities: ['basic-tools', 'social-engineering']
              }
            ],
            attackScenarios: [
              {
                name: 'Data interception attack',
                steps: ['Network monitoring', 'Traffic analysis', 'Data extraction'],
                probability: 'medium',
                impact: {
                  confidentiality: 'high',
                  integrity: 'low',
                  availability: 'low',
                  dataExposure: {
                    recordCount: 500000,
                    dataTypes: ['personal'],
                    sensitivity: 'high',
                    regulatoryImpact: ['GDPR']
                  },
                  systemAccess: {
                    privilegeLevel: 'user',
                    systemCriticality: 'medium',
                    lateralMovement: false,
                    persistencePossible: false
                  }
                },
                mitigations: ['TLS encryption', 'VPN']
              }
            ],
            assetValue: 'high',
            exposureLevel: 'public'
          },
          dataFlowRisk: [
            {
              dataType: 'personal_information',
              classification: 'confidential',
              encryption: false,
              transit: true,
              storage: false,
              processing: true,
              riskLevel: 'high'
            }
          ]
        });
      }
    }

    return vulnerabilities;
  }

  private async checkInsecureDeserialization(context: SecurityContext): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    if (this.hasInsecureDeserialization(context.component)) {
      vulnerabilities.push({
        id: this.generateId(),
        ruleId: 'insecure-deserialization',
        componentId: context.component.id,
        severity: 'medium',
        cveScore: 5.4,
        attackVector: {
          network: true,
          local: false,
          physical: false,
          userInteraction: true,
          privilegeRequired: 'low',
          complexity: 'high'
        },
        description: 'Insecure deserialization may lead to remote code execution',
        location: this.getComponentLocation(context.component),
        exploitability: 'medium',
        impact: {
          confidentiality: 'medium',
          integrity: 'high',
          availability: 'medium',
          dataExposure: {
            recordCount: 100000,
            dataTypes: ['application_data'],
            sensitivity: 'medium',
            regulatoryImpact: ['SOX']
          },
          systemAccess: {
            privilegeLevel: 'user',
            systemCriticality: 'medium',
            lateralMovement: true,
            persistencePossible: true
          }
        },
        mitigation: {
          immediate: ['Input validation', 'Serialization review'],
          shortTerm: ['Safe serialization libraries', 'Type checking'],
          longTerm: ['Architecture review', 'Secure design patterns'],
          preventive: ['Static analysis', 'Security testing'],
          detective: ['Runtime monitoring', 'Anomaly detection'],
          responsive: ['Incident response', 'System isolation']
        },
        threatModel: {
          threatActors: [
            {
              type: 'criminal',
              sophistication: 'medium',
              motivation: ['financial', 'malware-deployment'],
              capabilities: ['exploit-development', 'payload-crafting']
            }
          ],
          attackScenarios: [
            {
              name: 'Deserialization exploit',
              steps: ['Craft malicious payload', 'Submit serialized data', 'Execute arbitrary code'],
              probability: 'low',
              impact: {
                confidentiality: 'medium',
                integrity: 'high',
                availability: 'medium',
                dataExposure: {
                  recordCount: 100000,
                  dataTypes: ['system'],
                  sensitivity: 'medium',
                  regulatoryImpact: []
                },
                systemAccess: {
                  privilegeLevel: 'user',
                  systemCriticality: 'medium',
                  lateralMovement: true,
                  persistencePossible: true
                }
              },
              mitigations: ['Input validation', 'Safe libraries']
            }
          ],
          assetValue: 'medium',
          exposureLevel: 'internal'
        },
        dataFlowRisk: [
          {
            dataType: 'serialized_objects',
            classification: 'internal',
            encryption: false,
            transit: true,
            storage: false,
            processing: true,
            riskLevel: 'medium'
          }
        ]
      });
    }

    return vulnerabilities;
  }

  private createComplianceIndicators(violations: ComplianceViolation[]): VisualIndicator[] {
    return violations.map(violation => ({
      type: 'badge',
      position: 'top-right',
      color: this.getSeverityColor(violation.severity),
      icon: 'compliance-warning',
      text: violation.severity.toUpperCase(),
      severity: violation.severity,
      blinking: violation.severity === 'critical',
      tooltip: `${violation.message} - ${violation.complianceStandards.join(', ')}`,
      actionable: true,
      onClick: () => this.showComplianceDetails(violation)
    }));
  }

  private createSecurityIndicators(vulnerabilities: SecurityVulnerability[]): VisualIndicator[] {
    return vulnerabilities.map(vuln => ({
      type: 'overlay',
      position: 'center',
      color: this.getSeverityColor(vuln.severity),
      icon: 'security-alert',
      text: `CVE ${vuln.cveScore?.toFixed(1)}`,
      severity: vuln.severity,
      blinking: vuln.severity === 'critical',
      tooltip: `${vuln.description} - CVSS: ${vuln.cveScore}`,
      actionable: true,
      onClick: () => this.showSecurityDetails(vuln)
    }));
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  }

  private calculateComplianceScore(violations: ComplianceViolation[]): number {
    const totalComponents = 100;
    const criticalWeight = 4;
    const highWeight = 3;
    const mediumWeight = 2;
    const lowWeight = 1;

    const weightedViolations = violations.reduce((sum, v) => {
      switch (v.severity) {
        case 'critical': return sum + criticalWeight;
        case 'high': return sum + highWeight;
        case 'medium': return sum + mediumWeight;
        case 'low': return sum + lowWeight;
        default: return sum;
      }
    }, 0);

    return Math.max(0, 100 - (weightedViolations / totalComponents * 100));
  }

  private calculateRiskScore(vulnerabilities: SecurityVulnerability[]): number {
    const totalPossibleScore = 10;
    const averageCVSS = vulnerabilities.reduce((sum, v) => sum + (v.cveScore || 0), 0) / vulnerabilities.length;
    return Math.min(totalPossibleScore, averageCVSS || 0);
  }

  private async assessStandardsCompliance(violations: ComplianceViolation[]): Promise<StandardCompliance[]> {
    const standards = ['GDPR', 'SOX', 'HIPAA', 'PCI DSS', 'ISO 27001'];

    return standards.map(standard => ({
      standard,
      version: '2023',
      score: this.calculateStandardScore(standard, violations),
      requiredScore: 85,
      status: this.calculateStandardScore(standard, violations) >= 85 ? 'compliant' : 'non-compliant',
      gaps: this.identifyComplianceGaps(standard, violations)
    }));
  }

  private generateComplianceRecommendations(violations: ComplianceViolation[]): ComplianceRecommendation[] {
    return violations
      .filter(v => v.severity === 'critical' || v.severity === 'high')
      .map(v => ({
        priority: v.severity,
        category: 'data-privacy',
        title: `Address ${v.message}`,
        description: v.suggestedFix,
        impact: v.businessImpact,
        effort: 'medium',
        timeline: v.severity === 'critical' ? '1 week' : '1 month',
        dependencies: v.remediationSteps.flatMap(step => step.dependencies)
      }));
  }

  private generateSecurityRecommendations(vulnerabilities: SecurityVulnerability[]): SecurityRecommendation[] {
    return vulnerabilities
      .filter(v => v.severity === 'critical' || v.severity === 'high')
      .map(v => ({
        priority: v.severity,
        category: v.category,
        title: `Mitigate ${v.description}`,
        description: v.mitigation.immediate.join(', '),
        impact: v.impact,
        effort: 'high',
        timeline: v.severity === 'critical' ? '1 day' : '1 week',
        dependencies: []
      }));
  }

  private async performThreatAssessment(vulnerabilities: SecurityVulnerability[], graph: ProjectGraph): Promise<ThreatAssessment> {
    return {
      overallRisk: this.calculateOverallRisk(vulnerabilities),
      threatLandscape: {
        activeThreats: ['APT groups', 'Ransomware', 'Insider threats'],
        emergingThreats: ['AI-powered attacks', 'Supply chain attacks'],
        industryTrends: ['Increased targeting', 'Sophisticated techniques'],
        geographicRisks: ['State-sponsored attacks']
      },
      vulnerabilityExposure: {
        criticalCount: vulnerabilities.filter(v => v.severity === 'critical').length,
        highCount: vulnerabilities.filter(v => v.severity === 'high').length,
        mediumCount: vulnerabilities.filter(v => v.severity === 'medium').length,
        lowCount: vulnerabilities.filter(v => v.severity === 'low').length,
        patchingEfficiency: 85,
        zeroDay: false
      },
      controlEffectiveness: {
        preventive: 75,
        detective: 80,
        responsive: 70,
        overall: 75,
        gaps: ['Real-time monitoring', 'Automated response']
      },
      residualRisk: {
        level: 'medium',
        acceptanceStatus: 'mitigating',
        mitigationPlan: ['Implement WAF', 'Enhanced monitoring'],
        timeline: '3 months'
      }
    };
  }

  private async assessSecurityPosture(graph: ProjectGraph, vulnerabilities: SecurityVulnerability[]): Promise<SecurityPosture> {
    return {
      maturityLevel: 'defined',
      controlCategories: [
        {
          name: 'Access Control',
          maturity: 'managed',
          effectiveness: 85,
          coverage: 90,
          gaps: ['Privileged access management']
        },
        {
          name: 'Data Protection',
          maturity: 'developing',
          effectiveness: 70,
          coverage: 75,
          gaps: ['Encryption at rest', 'Data classification']
        }
      ],
      benchmarkComparison: {
        industry: 'Technology',
        peerScore: 78,
        ourScore: 82,
        ranking: 'Above Average',
        improvements: ['Incident response', 'Security awareness']
      },
      improvementPlan: {
        phases: [
          {
            name: 'Quick Wins',
            duration: '1 month',
            activities: ['Patch management', 'Basic monitoring'],
            budget: 50000,
            expectedOutcome: 'Reduce critical vulnerabilities by 80%'
          },
          {
            name: 'Strategic Improvements',
            duration: '6 months',
            activities: ['Zero trust implementation', 'Advanced monitoring'],
            budget: 200000,
            expectedOutcome: 'Achieve industry leading security posture'
          }
        ],
        budget: 250000,
        timeline: '7 months',
        expectedBenefits: ['Reduced risk', 'Improved compliance', 'Better customer trust']
      }
    };
  }

  private async analyzeTrends(compliance: ComplianceReport, security: SecurityReport): Promise<MonitoringTrends> {
    return {
      complianceScoreTrend: {
        current: compliance.overallScore,
        previous: 82,
        trend: 'improving',
        projection: 88
      },
      securityRiskTrend: {
        current: security.riskScore,
        previous: 6.2,
        trend: 'stable',
        projection: 5.8
      },
      violationsTrend: {
        critical: { current: 2, previous: 3, trend: 'improving' },
        high: { current: 5, previous: 7, trend: 'improving' },
        medium: { current: 12, previous: 10, trend: 'worsening' },
        low: { current: 8, previous: 8, trend: 'stable' }
      },
      vulnerabilitiesTrend: {
        critical: { current: 1, previous: 2, trend: 'improving' },
        high: { current: 3, previous: 4, trend: 'improving' },
        medium: { current: 8, previous: 6, trend: 'worsening' },
        low: { current: 15, previous: 12, trend: 'worsening' }
      }
    };
  }

  private generateAlerts(compliance: ComplianceReport, security: SecurityReport): MonitoringAlert[] {
    const alerts: MonitoringAlert[] = [];

    const criticalViolations = compliance.violations.filter(v => v.severity === 'critical');
    const criticalVulnerabilities = security.vulnerabilities.filter(v => v.severity === 'critical');

    if (criticalViolations.length > 0) {
      alerts.push({
        id: this.generateId(),
        type: 'compliance',
        severity: 'critical',
        title: `${criticalViolations.length} Critical Compliance Violations`,
        description: 'Immediate attention required for regulatory compliance',
        timestamp: new Date(),
        acknowledged: false,
        actions: ['Review violations', 'Implement fixes', 'Update compliance status']
      });
    }

    if (criticalVulnerabilities.length > 0) {
      alerts.push({
        id: this.generateId(),
        type: 'security',
        severity: 'critical',
        title: `${criticalVulnerabilities.length} Critical Security Vulnerabilities`,
        description: 'High risk vulnerabilities require immediate patching',
        timestamp: new Date(),
        acknowledged: false,
        actions: ['Apply security patches', 'Implement mitigations', 'Monitor for exploitation']
      });
    }

    return alerts;
  }

  private isAuditReady(violations: ComplianceViolation[]): boolean {
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    return criticalViolations.length === 0;
  }

  private isPenetrationTestReady(vulnerabilities: SecurityVulnerability[]): boolean {
    const criticalVulnerabilities = vulnerabilities.filter(v => v.severity === 'critical');
    return criticalVulnerabilities.length === 0;
  }

  private async getCertificationStatus(graph: ProjectGraph): Promise<CertificationStatus[]> {
    return [
      {
        certification: 'SOC 2 Type II',
        status: 'certified',
        expiryDate: new Date('2024-12-31'),
        nextAssessment: new Date('2024-10-01'),
        requirements: ['Access controls', 'Availability', 'Processing integrity']
      },
      {
        certification: 'ISO 27001',
        status: 'pending',
        nextAssessment: new Date('2024-06-01'),
        requirements: ['Risk assessment', 'Security controls', 'Continuous improvement']
      }
    ];
  }

  private showComplianceDetails(violation: ComplianceViolation): void {
    console.log('Compliance violation details:', violation);
  }

  private showSecurityDetails(vulnerability: SecurityVulnerability): void {
    console.log('Security vulnerability details:', vulnerability);
  }

  private async getBusinessContext(component: ComponentInfo): Promise<BusinessContext> {
    return {
      industry: 'Technology',
      regulations: ['GDPR', 'CCPA', 'SOX'],
      geographies: ['US', 'EU', 'Global'],
      customerTypes: ['B2B', 'B2C'],
      dataTypes: ['Personal', 'Financial', 'Health']
    };
  }

  private async assessNetworkExposure(component: ComponentInfo): Promise<NetworkExposure> {
    return {
      internetFacing: component.name.includes('api') || component.name.includes('web'),
      internalNetwork: true,
      partnerNetwork: false,
      ports: [80, 443, 8080],
      protocols: ['HTTP', 'HTTPS', 'WebSocket']
    };
  }

  private async classifyData(component: ComponentInfo): Promise<DataClassification> {
    const containsPII = component.name.includes('user') || component.name.includes('profile');
    const containsPHI = component.name.includes('health') || component.name.includes('medical');
    const containsFinancial = component.name.includes('payment') || component.name.includes('billing');

    return {
      pii: containsPII,
      phi: containsPHI,
      financial: containsFinancial,
      intellectual: false,
      classified: false,
      level: containsPHI || containsFinancial ? 'restricted' : containsPII ? 'confidential' : 'internal'
    };
  }

  private containsPersonalData(data: any): boolean {
    const personalDataKeywords = ['email', 'name', 'address', 'phone', 'ssn', 'id'];
    return personalDataKeywords.some(keyword =>
      JSON.stringify(data).toLowerCase().includes(keyword)
    );
  }

  private containsPHI(data: any): boolean {
    const phiKeywords = ['medical', 'health', 'diagnosis', 'treatment', 'prescription'];
    return phiKeywords.some(keyword =>
      JSON.stringify(data).toLowerCase().includes(keyword)
    );
  }

  private containsCardholderData(data: any): boolean {
    const cardDataKeywords = ['credit', 'card', 'pan', 'cvv', 'expiry'];
    return cardDataKeywords.some(keyword =>
      JSON.stringify(data).toLowerCase().includes(keyword)
    );
  }

  private containsSensitiveData(data: any): boolean {
    return this.containsPersonalData(data) || this.containsPHI(data) || this.containsCardholderData(data);
  }

  private hasConsentMechanism(component: ComponentInfo): boolean {
    return component.name.toLowerCase().includes('consent') ||
           component.name.toLowerCase().includes('permission');
  }

  private hasDataMinimization(flow: DataFlow): boolean {
    return flow.data && Object.keys(flow.data).length <= 5;
  }

  private hasAuditLogging(component: ComponentInfo): boolean {
    return component.name.toLowerCase().includes('audit') ||
           component.name.toLowerCase().includes('log');
  }

  private hasEncryptionInTransit(flow: DataFlow): boolean {
    return flow.metadata?.encrypted === true;
  }

  private hasTokenization(flow: DataFlow): boolean {
    return flow.metadata?.tokenized === true;
  }

  private isDatabaseInteraction(flow: DataFlow): boolean {
    return flow.type === 'database' || flow.target.includes('db') || flow.target.includes('database');
  }

  private usesParameterizedQueries(flow: DataFlow): boolean {
    return flow.metadata?.parameterized === true;
  }

  private hasAuthenticationBypass(component: ComponentInfo): boolean {
    return component.name.toLowerCase().includes('bypass') ||
           component.name.toLowerCase().includes('skip');
  }

  private hasProperEncryption(flow: DataFlow): boolean {
    return flow.metadata?.encrypted === true && flow.metadata?.algorithm?.includes('AES');
  }

  private hasInsecureDeserialization(component: ComponentInfo): boolean {
    return component.name.toLowerCase().includes('deserialize') &&
           !component.name.toLowerCase().includes('safe');
  }

  private getComponentLocation(component: ComponentInfo): CodeLocation {
    return {
      file: component.file || 'unknown',
      line: 1,
      column: 1,
      function: component.name,
      context: `Component: ${component.name}`
    };
  }

  private calculateStandardScore(standard: string, violations: ComplianceViolation[]): number {
    const relevantViolations = violations.filter(v =>
      v.complianceStandards.some(s => s.includes(standard))
    );
    const totalPenalty = relevantViolations.reduce((sum, v) => {
      switch (v.severity) {
        case 'critical': return sum + 25;
        case 'high': return sum + 15;
        case 'medium': return sum + 10;
        case 'low': return sum + 5;
        default: return sum;
      }
    }, 0);

    return Math.max(0, 100 - totalPenalty);
  }

  private identifyComplianceGaps(standard: string, violations: ComplianceViolation[]): ComplianceGap[] {
    return violations
      .filter(v => v.complianceStandards.some(s => s.includes(standard)))
      .map(v => ({
        requirement: v.complianceStandards[0],
        currentState: 'Non-compliant',
        targetState: 'Compliant',
        effort: 'medium',
        timeline: '3 months'
      }));
  }

  private calculateOverallRisk(vulnerabilities: SecurityVulnerability[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'high';
    if (highCount > 0) return 'medium';
    return 'low';
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

interface MonitoringTrends {
  complianceScoreTrend: {
    current: number;
    previous: number;
    trend: 'improving' | 'stable' | 'worsening';
    projection: number;
  };
  securityRiskTrend: {
    current: number;
    previous: number;
    trend: 'improving' | 'stable' | 'worsening';
    projection: number;
  };
  violationsTrend: {
    critical: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
    high: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
    medium: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
    low: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
  };
  vulnerabilitiesTrend: {
    critical: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
    high: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
    medium: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
    low: { current: number; previous: number; trend: 'improving' | 'stable' | 'worsening' };
  };
}

interface MonitoringAlert {
  id: string;
  type: 'compliance' | 'security' | 'performance' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
  actions: string[];
}