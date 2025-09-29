import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { AuditLogger } from './AuditLogger';
import { PermissionGuard } from './PermissionGuard';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  roles: Role[];
  isActive: boolean;
  lastLogin?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | '*';
  conditions?: PermissionCondition[];
  description?: string;
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex';
  value: any;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scope?: string[];
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  userId: string;
  permissions: Permission[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
  rateLimitPerHour?: number;
  createdAt: Date;
}

export interface AuthContext {
  user: User;
  token?: string;
  apiKey?: ApiKey;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpirationTime: string;
  refreshTokenExpirationTime: string;
  bcryptRounds: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  apiKeyExpirationDays: number;
  enableAuditLogging: boolean;
  enableRateLimiting: boolean;
  allowedOrigins: string[];
  requireTwoFactor: boolean;
}

export interface LoginAttempt {
  username: string;
  ipAddress: string;
  success: boolean;
  timestamp: Date;
  userAgent?: string;
  failureReason?: string;
}

export interface SecurityMetrics {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  totalApiKeys: number;
  activeApiKeys: number;
  loginAttemptsLast24h: number;
  failedLoginsLast24h: number;
  suspiciousActivities: number;
}

export class SecurityManager extends EventEmitter {
  private users: Map<string, User> = new Map();
  private roles: Map<string, Role> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private refreshTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();
  private loginAttempts: LoginAttempt[] = [];
  private auditLogger: AuditLogger;
  private permissionGuard: PermissionGuard;
  private config: SecurityConfig;
  private encryptionKey: Buffer;

  constructor(config: Partial<SecurityConfig> = {}) {
    super();

    this.config = {
      jwtSecret: config.jwtSecret || this.generateSecureSecret(),
      jwtExpirationTime: config.jwtExpirationTime || '1h',
      refreshTokenExpirationTime: config.refreshTokenExpirationTime || '7d',
      bcryptRounds: config.bcryptRounds || 12,
      maxFailedLoginAttempts: config.maxFailedLoginAttempts || 5,
      lockoutDurationMinutes: config.lockoutDurationMinutes || 30,
      apiKeyExpirationDays: config.apiKeyExpirationDays || 365,
      enableAuditLogging: config.enableAuditLogging ?? true,
      enableRateLimiting: config.enableRateLimiting ?? true,
      allowedOrigins: config.allowedOrigins || ['*'],
      requireTwoFactor: config.requireTwoFactor ?? false,
      ...config
    };

    this.encryptionKey = crypto.randomBytes(32);
    this.auditLogger = new AuditLogger();
    this.permissionGuard = new PermissionGuard();

    this.initializeDefaultRoles();
    this.startCleanupTasks();
  }

  // Authentication Methods

  async authenticate(username: string, password: string, context: Partial<AuthContext> = {}): Promise<AuthToken> {
    const user = this.findUserByUsername(username);
    const ipAddress = context.ipAddress || 'unknown';

    // Record login attempt
    const loginAttempt: LoginAttempt = {
      username,
      ipAddress,
      success: false,
      timestamp: new Date(),
      userAgent: context.userAgent
    };

    if (!user) {
      loginAttempt.failureReason = 'User not found';
      this.recordLoginAttempt(loginAttempt);
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      loginAttempt.failureReason = 'User inactive';
      this.recordLoginAttempt(loginAttempt);
      throw new Error('Account is inactive');
    }

    if (this.isUserLocked(user)) {
      loginAttempt.failureReason = 'Account locked';
      this.recordLoginAttempt(loginAttempt);
      throw new Error('Account is temporarily locked');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      await this.handleFailedLogin(user);
      loginAttempt.failureReason = 'Invalid password';
      this.recordLoginAttempt(loginAttempt);
      throw new Error('Invalid credentials');
    }

    // Successful login
    await this.handleSuccessfulLogin(user);
    loginAttempt.success = true;
    this.recordLoginAttempt(loginAttempt);

    const authToken = await this.generateAuthToken(user);

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('auth.login', {
        userId: user.id,
        username: user.username,
        ipAddress,
        userAgent: context.userAgent
      });
    }

    this.emit('user:login', { user, context });
    return authToken;
  }

  async authenticateWithApiKey(apiKey: string, context: Partial<AuthContext> = {}): Promise<AuthContext> {
    const keyHash = this.hashApiKey(apiKey);
    const apiKeyRecord = Array.from(this.apiKeys.values()).find(k => k.keyHash === keyHash);

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      throw new Error('Invalid API key');
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      throw new Error('API key expired');
    }

    const user = this.users.get(apiKeyRecord.userId);
    if (!user || !user.isActive) {
      throw new Error('User associated with API key is not active');
    }

    // Update API key usage
    apiKeyRecord.lastUsed = new Date();
    apiKeyRecord.usageCount++;

    const authContext: AuthContext = {
      user,
      apiKey: apiKeyRecord,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date()
    };

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('auth.api_key', {
        userId: user.id,
        apiKeyId: apiKeyRecord.id,
        ipAddress: context.ipAddress
      });
    }

    this.emit('user:api_auth', { authContext });
    return authContext;
  }

  async refreshAuthToken(refreshToken: string): Promise<AuthToken> {
    const tokenData = this.refreshTokens.get(refreshToken);
    if (!tokenData || tokenData.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = this.users.get(tokenData.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Remove old refresh token
    this.refreshTokens.delete(refreshToken);

    const authToken = await this.generateAuthToken(user);

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('auth.token_refresh', {
        userId: user.id,
        username: user.username
      });
    }

    return authToken;
  }

  async logout(token: string, context: Partial<AuthContext> = {}): Promise<void> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      const user = this.users.get(decoded.userId);

      if (user && this.config.enableAuditLogging) {
        await this.auditLogger.log('auth.logout', {
          userId: user.id,
          username: user.username,
          ipAddress: context.ipAddress
        });
      }

      this.emit('user:logout', { user, context });
    } catch (error) {
      // Token is invalid or expired, which is fine for logout
    }
  }

  // User Management

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    roles?: string[];
    metadata?: Record<string, any>;
  }): Promise<User> {
    if (this.findUserByUsername(userData.username)) {
      throw new Error('Username already exists');
    }

    if (this.findUserByEmail(userData.email)) {
      throw new Error('Email already exists');
    }

    const passwordHash = await bcrypt.hash(userData.password, this.config.bcryptRounds);
    const roles = userData.roles ? userData.roles.map(roleId => this.roles.get(roleId)).filter(Boolean) as Role[] : [];

    const user: User = {
      id: this.generateId(),
      username: userData.username,
      email: userData.email,
      passwordHash,
      roles,
      isActive: true,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: userData.metadata
    };

    this.users.set(user.id, user);

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('user.created', {
        userId: user.id,
        username: user.username,
        email: user.email,
        roles: roles.map(r => r.name)
      });
    }

    this.emit('user:created', user);
    return user;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, this.config.bcryptRounds);
      delete updates.password;
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('user.updated', {
        userId,
        changes: Object.keys(updates)
      });
    }

    this.emit('user:updated', updatedUser);
    return updatedUser;
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Deactivate instead of hard delete for audit purposes
    await this.updateUser(userId, { isActive: false });

    // Remove all API keys for this user
    Array.from(this.apiKeys.values())
      .filter(key => key.userId === userId)
      .forEach(key => this.apiKeys.delete(key.id));

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('user.deleted', {
        userId,
        username: user.username
      });
    }

    this.emit('user:deleted', user);
  }

  // API Key Management

  async createApiKey(userId: string, name: string, permissions: Permission[], options: {
    expiresInDays?: number;
    rateLimitPerHour?: number;
  } = {}): Promise<{ apiKey: ApiKey; key: string }> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const key = this.generateApiKey();
    const keyHash = this.hashApiKey(key);

    const expiresAt = options.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + this.config.apiKeyExpirationDays * 24 * 60 * 60 * 1000);

    const apiKey: ApiKey = {
      id: this.generateId(),
      name,
      keyHash,
      userId,
      permissions,
      isActive: true,
      expiresAt,
      usageCount: 0,
      rateLimitPerHour: options.rateLimitPerHour,
      createdAt: new Date()
    };

    this.apiKeys.set(apiKey.id, apiKey);

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('api_key.created', {
        userId,
        apiKeyId: apiKey.id,
        apiKeyName: name,
        permissions: permissions.map(p => `${p.resource}:${p.action}`)
      });
    }

    this.emit('api_key:created', apiKey);
    return { apiKey, key };
  }

  async revokeApiKey(apiKeyId: string): Promise<void> {
    const apiKey = this.apiKeys.get(apiKeyId);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    apiKey.isActive = false;

    if (this.config.enableAuditLogging) {
      await this.auditLogger.log('api_key.revoked', {
        apiKeyId,
        apiKeyName: apiKey.name,
        userId: apiKey.userId
      });
    }

    this.emit('api_key:revoked', apiKey);
  }

  // Authorization Methods

  async authorize(authContext: AuthContext, resource: string, action: string, resourceData?: any): Promise<boolean> {
    return this.permissionGuard.checkPermission(authContext, resource, action, resourceData);
  }

  async hasPermission(user: User, resource: string, action: string): Promise<boolean> {
    const authContext: AuthContext = {
      user,
      timestamp: new Date()
    };
    return this.authorize(authContext, resource, action);
  }

  // Data Encryption Methods

  encrypt(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Utility Methods

  getSecurityMetrics(): SecurityMetrics {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentAttempts = this.loginAttempts.filter(attempt => attempt.timestamp >= last24h);

    return {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.isActive).length,
      lockedUsers: Array.from(this.users.values()).filter(u => this.isUserLocked(u)).length,
      totalApiKeys: this.apiKeys.size,
      activeApiKeys: Array.from(this.apiKeys.values()).filter(k => k.isActive).length,
      loginAttemptsLast24h: recentAttempts.length,
      failedLoginsLast24h: recentAttempts.filter(a => !a.success).length,
      suspiciousActivities: this.detectSuspiciousActivities()
    };
  }

  // Private Methods

  private async generateAuthToken(user: User): Promise<AuthToken> {
    const payload = {
      userId: user.id,
      username: user.username,
      roles: user.roles.map(r => r.name),
      permissions: this.getAllUserPermissions(user)
    };

    const accessToken = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpirationTime
    });

    const refreshToken = this.generateRefreshToken();
    const refreshExpiration = new Date();
    refreshExpiration.setTime(refreshExpiration.getTime() + this.parseTimeToMs(this.config.refreshTokenExpirationTime));

    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      expiresAt: refreshExpiration
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTimeToMs(this.config.jwtExpirationTime) / 1000,
      tokenType: 'Bearer'
    };
  }

  private getAllUserPermissions(user: User): string[] {
    const permissions = new Set<string>();
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        permissions.add(`${permission.resource}:${permission.action}`);
      });
    });
    return Array.from(permissions);
  }

  private findUserByUsername(username: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  private findUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  private isUserLocked(user: User): boolean {
    return user.lockedUntil ? user.lockedUntil > new Date() : false;
  }

  private async handleFailedLogin(user: User): Promise<void> {
    user.failedLoginAttempts++;
    user.updatedAt = new Date();

    if (user.failedLoginAttempts >= this.config.maxFailedLoginAttempts) {
      user.lockedUntil = new Date(Date.now() + this.config.lockoutDurationMinutes * 60 * 1000);
      this.emit('user:locked', user);
    }
  }

  private async handleSuccessfulLogin(user: User): Promise<void> {
    user.lastLogin = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.updatedAt = new Date();
  }

  private recordLoginAttempt(attempt: LoginAttempt): void {
    this.loginAttempts.push(attempt);

    // Keep only last 1000 attempts
    if (this.loginAttempts.length > 1000) {
      this.loginAttempts = this.loginAttempts.slice(-1000);
    }
  }

  private generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateApiKey(): string {
    return 'grf_' + crypto.randomBytes(32).toString('hex');
  }

  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private parseTimeToMs(timeString: string): number {
    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }

  private initializeDefaultRoles(): void {
    const adminPermissions: Permission[] = [
      { id: 'admin_all', name: 'Admin All', resource: '*', action: '*' }
    ];

    const userPermissions: Permission[] = [
      { id: 'read_own', name: 'Read Own Data', resource: 'user', action: 'read' },
      { id: 'update_own', name: 'Update Own Data', resource: 'user', action: 'update' }
    ];

    const adminRole: Role = {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: adminPermissions,
      isSystem: true,
      createdAt: new Date()
    };

    const userRole: Role = {
      id: 'user',
      name: 'User',
      description: 'Basic user access',
      permissions: userPermissions,
      isSystem: true,
      createdAt: new Date()
    };

    this.roles.set(adminRole.id, adminRole);
    this.roles.set(userRole.id, userRole);
  }

  private startCleanupTasks(): void {
    // Clean up expired refresh tokens every hour
    setInterval(() => {
      const now = new Date();
      for (const [token, data] of this.refreshTokens.entries()) {
        if (data.expiresAt < now) {
          this.refreshTokens.delete(token);
        }
      }
    }, 60 * 60 * 1000);

    // Clean up old login attempts every day
    setInterval(() => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
      this.loginAttempts = this.loginAttempts.filter(attempt => attempt.timestamp >= cutoff);
    }, 24 * 60 * 60 * 1000);
  }

  private detectSuspiciousActivities(): number {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentFailures = this.loginAttempts.filter(
      attempt => !attempt.success && attempt.timestamp >= last24h
    );

    // Group by IP and count failures
    const ipFailures = new Map<string, number>();
    recentFailures.forEach(attempt => {
      const count = ipFailures.get(attempt.ipAddress) || 0;
      ipFailures.set(attempt.ipAddress, count + 1);
    });

    // Count IPs with more than 10 failures as suspicious
    return Array.from(ipFailures.values()).filter(count => count > 10).length;
  }
}