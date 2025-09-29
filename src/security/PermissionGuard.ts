import { User, Role, Permission, PermissionCondition, AuthContext } from './SecurityManager';

export interface PermissionCheck {
  resource: string;
  action: string;
  context?: Record<string, any>;
  resourceData?: any;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  matchedPermissions: Permission[];
  deniedBy?: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  conditions: PolicyCondition[];
  priority: number;
  isActive: boolean;
}

export interface PolicyCondition {
  type: 'user' | 'role' | 'time' | 'ip' | 'resource' | 'custom';
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex' | 'greater_than' | 'less_than';
  value: any;
  description?: string;
}

export interface AccessPattern {
  userId: string;
  resource: string;
  action: string;
  frequency: number;
  lastAccess: Date;
  avgTimeBetweenAccess: number;
  suspicious: boolean;
}

export class PermissionGuard {
  private policies: Map<string, PolicyRule> = new Map();
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private permissionCache: Map<string, { result: PermissionResult; expiresAt: Date }> = new Map();
  private cacheExpirationMs: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeDefaultPolicies();
    this.startCleanupTasks();
  }

  async checkPermission(
    authContext: AuthContext,
    resource: string,
    action: string,
    resourceData?: any
  ): Promise<boolean> {
    const result = await this.evaluatePermissions(authContext, resource, action, resourceData);

    // Track access pattern
    this.trackAccessPattern(authContext.user.id, resource, action);

    return result.allowed;
  }

  async evaluatePermissions(
    authContext: AuthContext,
    resource: string,
    action: string,
    resourceData?: any
  ): Promise<PermissionResult> {
    // Check cache first
    const cacheKey = this.generateCacheKey(authContext.user.id, resource, action, resourceData);
    const cached = this.permissionCache.get(cacheKey);

    if (cached && cached.expiresAt > new Date()) {
      return cached.result;
    }

    const result = await this.performPermissionCheck(authContext, resource, action, resourceData);

    // Cache the result
    this.permissionCache.set(cacheKey, {
      result,
      expiresAt: new Date(Date.now() + this.cacheExpirationMs)
    });

    return result;
  }

  private async performPermissionCheck(
    authContext: AuthContext,
    resource: string,
    action: string,
    resourceData?: any
  ): Promise<PermissionResult> {
    const user = authContext.user;
    const matchedPermissions: Permission[] = [];

    // Step 1: Check explicit deny policies first
    const denyResult = await this.checkDenyPolicies(authContext, resource, action, resourceData);
    if (denyResult.denied) {
      return {
        allowed: false,
        reason: denyResult.reason,
        matchedPermissions: [],
        deniedBy: denyResult.policy
      };
    }

    // Step 2: Check API key permissions if using API key
    if (authContext.apiKey) {
      const apiKeyResult = this.checkApiKeyPermissions(authContext.apiKey.permissions, resource, action);
      if (!apiKeyResult.allowed) {
        return apiKeyResult;
      }
      matchedPermissions.push(...apiKeyResult.matchedPermissions);
    }

    // Step 3: Check user role permissions
    const roleResult = this.checkRolePermissions(user.roles, resource, action, resourceData);
    if (roleResult.allowed) {
      matchedPermissions.push(...roleResult.matchedPermissions);
    }

    // Step 4: Check allow policies
    const allowResult = await this.checkAllowPolicies(authContext, resource, action, resourceData);
    if (allowResult.allowed) {
      matchedPermissions.push(...allowResult.matchedPermissions);
    }

    const hasPermission = matchedPermissions.length > 0 || roleResult.allowed || allowResult.allowed;

    return {
      allowed: hasPermission,
      reason: hasPermission ? 'Permission granted' : 'No matching permissions found',
      matchedPermissions
    };
  }

  private checkApiKeyPermissions(permissions: Permission[], resource: string, action: string): PermissionResult {
    const matchedPermissions: Permission[] = [];

    for (const permission of permissions) {
      if (this.matchesPermission(permission, resource, action)) {
        matchedPermissions.push(permission);
      }
    }

    return {
      allowed: matchedPermissions.length > 0,
      reason: matchedPermissions.length > 0 ? 'API key permission granted' : 'No matching API key permissions',
      matchedPermissions
    };
  }

  private checkRolePermissions(roles: Role[], resource: string, action: string, resourceData?: any): PermissionResult {
    const matchedPermissions: Permission[] = [];

    for (const role of roles) {
      for (const permission of role.permissions) {
        if (this.matchesPermission(permission, resource, action)) {
          // Check permission conditions
          if (this.evaluatePermissionConditions(permission, resourceData)) {
            matchedPermissions.push(permission);
          }
        }
      }
    }

    return {
      allowed: matchedPermissions.length > 0,
      reason: matchedPermissions.length > 0 ? 'Role permission granted' : 'No matching role permissions',
      matchedPermissions
    };
  }

  private async checkDenyPolicies(
    authContext: AuthContext,
    resource: string,
    action: string,
    resourceData?: any
  ): Promise<{ denied: boolean; reason?: string; policy?: string }> {
    const denyPolicies = Array.from(this.policies.values())
      .filter(p => p.effect === 'deny' && p.isActive)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const policy of denyPolicies) {
      if (this.matchesPolicy(policy, resource, action)) {
        const conditionsMatch = await this.evaluatePolicyConditions(policy, authContext, resourceData);
        if (conditionsMatch) {
          return {
            denied: true,
            reason: `Access denied by policy: ${policy.name}`,
            policy: policy.id
          };
        }
      }
    }

    return { denied: false };
  }

  private async checkAllowPolicies(
    authContext: AuthContext,
    resource: string,
    action: string,
    resourceData?: any
  ): Promise<{ allowed: boolean; matchedPermissions: Permission[] }> {
    const allowPolicies = Array.from(this.policies.values())
      .filter(p => p.effect === 'allow' && p.isActive)
      .sort((a, b) => b.priority - a.priority);

    const matchedPermissions: Permission[] = [];

    for (const policy of allowPolicies) {
      if (this.matchesPolicy(policy, resource, action)) {
        const conditionsMatch = await this.evaluatePolicyConditions(policy, authContext, resourceData);
        if (conditionsMatch) {
          // Convert policy to permission for consistency
          const permission: Permission = {
            id: policy.id,
            name: policy.name,
            resource: policy.resource,
            action: policy.action,
            description: policy.description
          };
          matchedPermissions.push(permission);
        }
      }
    }

    return {
      allowed: matchedPermissions.length > 0,
      matchedPermissions
    };
  }

  private matchesPermission(permission: Permission, resource: string, action: string): boolean {
    // Check wildcard permissions
    if (permission.resource === '*' && permission.action === '*') {
      return true;
    }

    if (permission.resource === '*' && permission.action === action) {
      return true;
    }

    if (permission.resource === resource && permission.action === '*') {
      return true;
    }

    // Exact match
    if (permission.resource === resource && permission.action === action) {
      return true;
    }

    // Resource hierarchy matching (e.g., 'user.profile' matches 'user.*')
    if (permission.resource.endsWith('*')) {
      const prefix = permission.resource.slice(0, -1);
      if (resource.startsWith(prefix) && permission.action === action) {
        return true;
      }
    }

    return false;
  }

  private matchesPolicy(policy: PolicyRule, resource: string, action: string): boolean {
    return this.matchesPermission({
      id: policy.id,
      name: policy.name,
      resource: policy.resource,
      action: policy.action
    }, resource, action);
  }

  private evaluatePermissionConditions(permission: Permission, resourceData?: any): boolean {
    if (!permission.conditions || permission.conditions.length === 0) {
      return true;
    }

    return permission.conditions.every(condition => {
      return this.evaluateCondition(condition, resourceData);
    });
  }

  private async evaluatePolicyConditions(
    policy: PolicyRule,
    authContext: AuthContext,
    resourceData?: any
  ): Promise<boolean> {
    if (policy.conditions.length === 0) {
      return true;
    }

    return policy.conditions.every(condition => {
      return this.evaluatePolicyCondition(condition, authContext, resourceData);
    });
  }

  private evaluateCondition(condition: PermissionCondition, data?: any): boolean {
    if (!data) return true;

    const fieldValue = this.getNestedValue(data, condition.field);
    return this.compareValues(fieldValue, condition.operator, condition.value);
  }

  private evaluatePolicyCondition(
    condition: PolicyCondition,
    authContext: AuthContext,
    resourceData?: any
  ): boolean {
    let contextValue: any;

    switch (condition.type) {
      case 'user':
        contextValue = this.getNestedValue(authContext.user, condition.field);
        break;
      case 'role':
        contextValue = authContext.user.roles.map(r => r.name);
        break;
      case 'time':
        contextValue = new Date();
        break;
      case 'ip':
        contextValue = authContext.ipAddress;
        break;
      case 'resource':
        contextValue = resourceData ? this.getNestedValue(resourceData, condition.field) : null;
        break;
      case 'custom':
        contextValue = this.evaluateCustomCondition(condition, authContext, resourceData);
        break;
      default:
        return false;
    }

    return this.compareValues(contextValue, condition.operator, condition.value);
  }

  private evaluateCustomCondition(
    condition: PolicyCondition,
    authContext: AuthContext,
    resourceData?: any
  ): any {
    // Implement custom condition logic based on your needs
    switch (condition.field) {
      case 'time_of_day':
        return new Date().getHours();
      case 'day_of_week':
        return new Date().getDay();
      case 'user_age_days':
        return Math.floor((Date.now() - authContext.user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      default:
        return null;
    }
  }

  private compareValues(actualValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return actualValue === expectedValue;
      case 'not_equals':
        return actualValue !== expectedValue;
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      case 'contains':
        return typeof actualValue === 'string' && actualValue.includes(expectedValue);
      case 'regex':
        return typeof actualValue === 'string' && new RegExp(expectedValue).test(actualValue);
      case 'greater_than':
        return actualValue > expectedValue;
      case 'less_than':
        return actualValue < expectedValue;
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private trackAccessPattern(userId: string, resource: string, action: string): void {
    const key = `${userId}:${resource}:${action}`;
    const now = new Date();
    const existing = this.accessPatterns.get(key);

    if (existing) {
      const timeDiff = now.getTime() - existing.lastAccess.getTime();
      existing.frequency++;
      existing.avgTimeBetweenAccess = (existing.avgTimeBetweenAccess + timeDiff) / 2;
      existing.lastAccess = now;

      // Simple anomaly detection: if frequency is unusually high
      existing.suspicious = existing.frequency > 100 && existing.avgTimeBetweenAccess < 1000; // Less than 1 second
    } else {
      this.accessPatterns.set(key, {
        userId,
        resource,
        action,
        frequency: 1,
        lastAccess: now,
        avgTimeBetweenAccess: 0,
        suspicious: false
      });
    }
  }

  private generateCacheKey(userId: string, resource: string, action: string, resourceData?: any): string {
    const dataHash = resourceData ? JSON.stringify(resourceData) : '';
    return `${userId}:${resource}:${action}:${dataHash}`;
  }

  // Policy management methods

  addPolicy(policy: PolicyRule): void {
    this.policies.set(policy.id, policy);
    this.clearPermissionCache();
  }

  removePolicy(policyId: string): boolean {
    const removed = this.policies.delete(policyId);
    if (removed) {
      this.clearPermissionCache();
    }
    return removed;
  }

  updatePolicy(policyId: string, updates: Partial<PolicyRule>): boolean {
    const policy = this.policies.get(policyId);
    if (!policy) return false;

    this.policies.set(policyId, { ...policy, ...updates });
    this.clearPermissionCache();
    return true;
  }

  getPolicies(): PolicyRule[] {
    return Array.from(this.policies.values());
  }

  getAccessPatterns(): AccessPattern[] {
    return Array.from(this.accessPatterns.values());
  }

  getSuspiciousPatterns(): AccessPattern[] {
    return Array.from(this.accessPatterns.values()).filter(pattern => pattern.suspicious);
  }

  clearPermissionCache(): void {
    this.permissionCache.clear();
  }

  // Utility methods for common permission checks

  async canRead(authContext: AuthContext, resource: string, resourceData?: any): Promise<boolean> {
    return this.checkPermission(authContext, resource, 'read', resourceData);
  }

  async canWrite(authContext: AuthContext, resource: string, resourceData?: any): Promise<boolean> {
    return this.checkPermission(authContext, resource, 'write', resourceData);
  }

  async canCreate(authContext: AuthContext, resource: string, resourceData?: any): Promise<boolean> {
    return this.checkPermission(authContext, resource, 'create', resourceData);
  }

  async canUpdate(authContext: AuthContext, resource: string, resourceData?: any): Promise<boolean> {
    return this.checkPermission(authContext, resource, 'update', resourceData);
  }

  async canDelete(authContext: AuthContext, resource: string, resourceData?: any): Promise<boolean> {
    return this.checkPermission(authContext, resource, 'delete', resourceData);
  }

  async canExecute(authContext: AuthContext, resource: string, resourceData?: any): Promise<boolean> {
    return this.checkPermission(authContext, resource, 'execute', resourceData);
  }

  private initializeDefaultPolicies(): void {
    // Super admin policy
    this.addPolicy({
      id: 'super_admin_policy',
      name: 'Super Admin Access',
      description: 'Full system access for super administrators',
      resource: '*',
      action: '*',
      effect: 'allow',
      conditions: [
        {
          type: 'role',
          field: 'name',
          operator: 'in',
          value: ['super_admin', 'administrator'],
          description: 'Must have super admin or administrator role'
        }
      ],
      priority: 1000,
      isActive: true
    });

    // Deny access during maintenance hours
    this.addPolicy({
      id: 'maintenance_deny',
      name: 'Maintenance Window Restriction',
      description: 'Deny access during maintenance hours (2-4 AM)',
      resource: '*',
      action: '*',
      effect: 'deny',
      conditions: [
        {
          type: 'custom',
          field: 'time_of_day',
          operator: 'in',
          value: [2, 3],
          description: 'Between 2 AM and 4 AM'
        },
        {
          type: 'role',
          field: 'name',
          operator: 'not_in',
          value: ['super_admin', 'administrator'],
          description: 'Except for super admins'
        }
      ],
      priority: 900,
      isActive: true
    });

    // Self-service user profile policy
    this.addPolicy({
      id: 'self_service_profile',
      name: 'Self-Service Profile Access',
      description: 'Users can read and update their own profile',
      resource: 'user.profile',
      action: '*',
      effect: 'allow',
      conditions: [
        {
          type: 'resource',
          field: 'userId',
          operator: 'equals',
          value: '${user.id}',
          description: 'Resource must belong to the current user'
        }
      ],
      priority: 100,
      isActive: true
    });
  }

  private startCleanupTasks(): void {
    // Clean up cache every 10 minutes
    setInterval(() => {
      const now = new Date();
      for (const [key, cached] of this.permissionCache.entries()) {
        if (cached.expiresAt <= now) {
          this.permissionCache.delete(key);
        }
      }
    }, 10 * 60 * 1000);

    // Clean up old access patterns every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
      for (const [key, pattern] of this.accessPatterns.entries()) {
        if (pattern.lastAccess < cutoff) {
          this.accessPatterns.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }
}