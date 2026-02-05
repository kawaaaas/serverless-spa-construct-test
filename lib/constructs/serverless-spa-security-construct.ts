import { RemovalPolicy, Stack, Token } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaEdgeConstruct } from './lambda-edge-construct';
import { SecretConstruct, SecretConstructProps } from './secret-construct';
import { SsmConstruct, SsmConstructProps } from './ssm-construct';
import { WafConstruct, WafConstructProps } from './waf-construct';

// ============================================================================
// Base Types for Advanced Customization
// ============================================================================

/**
 * Advanced customization options for fine-grained control.
 * Use these only when you need to override default behaviors.
 */
export interface SecurityAdvancedOptions {
  /** Override WafConstruct settings */
  readonly waf?: WafConstructProps;
  /** Override SecretConstruct settings (ssmPrefix is auto-wired) */
  readonly secret?: Omit<SecretConstructProps, 'ssmPrefix'>;
  /** Regions to replicate the secret to @default ['ap-northeast-1'] */
  readonly replicaRegions?: string[];
  /** Cache TTL for Lambda@Edge secret value in seconds @default 300 */
  readonly edgeCacheTtlSeconds?: number;
  /** Removal policy for all resources @default RemovalPolicy.DESTROY */
  readonly removalPolicy?: RemovalPolicy;
}

// ============================================================================
// Factory Method Props - Clear Required vs Optional
// ============================================================================

/**
 * Props for ServerlessSpaSecurityConstruct.minimal() - Custom header only (no WAF).
 *
 * @example
 * ```typescript
 * ServerlessSpaSecurityConstruct.minimal(this, 'Security', {
 *   ssmPrefix: '/myapp/security/',
 * });
 * ```
 */
export interface MinimalSecurityProps {
  // === REQUIRED ===
  /** SSM Parameter Store prefix for cross-region sharing */
  readonly ssmPrefix: string;

  // === OPTIONAL ===
  /** Advanced customization options */
  readonly advanced?: SecurityAdvancedOptions;
}

/**
 * Props for ServerlessSpaSecurityConstruct.withWaf() - Full security with WAF.
 *
 * @example
 * ```typescript
 * ServerlessSpaSecurityConstruct.withWaf(this, 'Security', {
 *   ssmPrefix: '/myapp/security/',
 *   rateLimit: 3000,
 * });
 * ```
 */
export interface WithWafSecurityProps {
  // === REQUIRED ===
  /** SSM Parameter Store prefix for cross-region sharing */
  readonly ssmPrefix: string;

  // === OPTIONAL ===
  /** WAF rate limit (requests per 5 minutes) @default 2000 */
  readonly rateLimit?: number;
  /** Advanced customization options */
  readonly advanced?: SecurityAdvancedOptions;
}

/**
 * Legacy props for direct constructor usage.
 * Prefer using factory methods for clearer API.
 */
export interface ServerlessSpaSecurityConstructProps {
  /**
   * Whether to create WAF WebACL.
   * Set to false if you don't need WAF protection.
   * @default true
   */
  readonly enableWaf?: boolean;

  /**
   * Whether to create custom header secret and Lambda@Edge function.
   * Set to false if you don't need custom header protection.
   * @default true
   */
  readonly enableCustomHeader?: boolean;

  /**
   * Optional WafConstruct properties.
   * These will be passed through to WafConstruct.
   * Only used when enableWaf is true.
   */
  readonly waf?: WafConstructProps;

  /**
   * Optional SecretConstruct properties.
   * These will be passed through to SecretConstruct.
   * Note: 'ssmPrefix' is auto-wired from ssm.ssmPrefix.
   * Only used when enableCustomHeader is true.
   */
  readonly secret?: Omit<SecretConstructProps, 'ssmPrefix'>;

  /**
   * Optional SsmConstruct properties.
   * Note: 'webAclArn', 'customHeaderName', 'secretArn' are auto-wired.
   */
  readonly ssm?: Pick<SsmConstructProps, 'ssmPrefix'>;

  /**
   * Regions to replicate the secret to.
   * @default ['ap-northeast-1']
   */
  readonly replicaRegions?: string[];

  /**
   * Cache TTL for Lambda@Edge secret value in seconds.
   * @default 300 (5 minutes)
   */
  readonly edgeCacheTtlSeconds?: number;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * A high-level CDK construct that creates security resources for CloudFront.
 * This construct must be deployed in us-east-1 region.
 *
 * ## Recommended: Use Factory Methods
 *
 * Factory methods provide clear, use-case specific APIs:
 *
 * ```typescript
 * // Minimal setup - Custom header only (no WAF)
 * ServerlessSpaSecurityConstruct.minimal(this, 'Security', {
 *   ssmPrefix: '/myapp/security/',
 * });
 *
 * // With WAF protection
 * ServerlessSpaSecurityConstruct.withWaf(this, 'Security', {
 *   ssmPrefix: '/myapp/security/',
 *   rateLimit: 3000,
 * });
 * ```
 *
 * ## Architecture
 *
 * This construct integrates:
 * - WafConstruct: WAF WebACL with CLOUDFRONT scope (optional)
 * - SecretConstruct: Secrets Manager with rotation for custom header
 * - LambdaEdgeConstruct: Lambda@Edge for adding custom header to origin requests
 * - SsmConstruct: SSM Parameters for cross-region sharing
 *
 * Dependencies between constructs are automatically wired:
 * - SsmConstruct receives webAclArn, customHeaderName, secretArn, edgeFunctionVersionArn from other constructs
 * - SecretConstruct receives ssmPrefix for rotation Lambda
 * - LambdaEdgeConstruct receives secretArn from SecretConstruct
 */
export class ServerlessSpaSecurityConstruct extends Construct {
  // ============================================================================
  // Factory Methods - Recommended API
  // ============================================================================

  /**
   * Creates a minimal ServerlessSpaSecurityConstruct with custom header only (no WAF).
   * Best for: Development, testing, or when WAF is not needed.
   */
  public static minimal(
    scope: Construct,
    id: string,
    props: MinimalSecurityProps
  ): ServerlessSpaSecurityConstruct {
    return new ServerlessSpaSecurityConstruct(scope, id, {
      enableWaf: false,
      enableCustomHeader: true,
      ssm: {
        ssmPrefix: props.ssmPrefix,
      },
      waf: props.advanced?.waf,
      secret: props.advanced?.secret,
      replicaRegions: props.advanced?.replicaRegions,
      edgeCacheTtlSeconds: props.advanced?.edgeCacheTtlSeconds,
      removalPolicy: props.advanced?.removalPolicy,
    });
  }

  /**
   * Creates a ServerlessSpaSecurityConstruct with WAF protection.
   * Best for: Production deployments requiring WAF protection.
   */
  public static withWaf(
    scope: Construct,
    id: string,
    props: WithWafSecurityProps
  ): ServerlessSpaSecurityConstruct {
    return new ServerlessSpaSecurityConstruct(scope, id, {
      enableWaf: true,
      enableCustomHeader: true,
      ssm: {
        ssmPrefix: props.ssmPrefix,
      },
      waf: {
        ...props.advanced?.waf,
        rateLimit: props.rateLimit ?? props.advanced?.waf?.rateLimit,
      },
      secret: props.advanced?.secret,
      replicaRegions: props.advanced?.replicaRegions,
      edgeCacheTtlSeconds: props.advanced?.edgeCacheTtlSeconds,
      removalPolicy: props.advanced?.removalPolicy,
    });
  }

  // ============================================================================
  // Instance Properties
  // ============================================================================
  /**
   * The WafConstruct instance.
   * Only available when enableWaf is true.
   */
  public readonly waf?: WafConstruct;

  /**
   * The SecretConstruct instance.
   * Only available when enableCustomHeader is true.
   */
  public readonly secret?: SecretConstruct;

  /**
   * The LambdaEdgeConstruct instance.
   * Only available when enableCustomHeader is true.
   */
  public readonly lambdaEdge?: LambdaEdgeConstruct;

  /**
   * The SsmConstruct instance.
   */
  public readonly ssm: SsmConstruct;

  /**
   * The WAF WebACL ARN for CloudFront.
   * Only available when enableWaf is true.
   */
  public readonly webAclArn?: string;

  /**
   * The Secrets Manager secret ARN.
   * Only available when enableCustomHeader is true.
   */
  public readonly secretArn?: string;

  /**
   * The custom header name.
   * Only available when enableCustomHeader is true.
   */
  public readonly customHeaderName?: string;

  /**
   * The SSM prefix used for parameters.
   * Convenience property for ssm.ssmPrefix.
   */
  public readonly ssmPrefix: string;

  /**
   * The Lambda@Edge function version ARN.
   * Only available when enableCustomHeader is true.
   */
  public readonly edgeFunctionVersionArn?: string;

  /**
   * Protected constructor - use factory methods instead.
   * @see ServerlessSpaSecurityConstruct.minimal
   * @see ServerlessSpaSecurityConstruct.withWaf
   */
  // eslint-disable-next-line cdk/construct-props-struct-name
  protected constructor(scope: Construct, id: string, props?: ServerlessSpaSecurityConstructProps) {
    super(scope, id);

    // Validate region is us-east-1
    const region = Stack.of(this).region;
    if (region !== 'us-east-1' && !Token.isUnresolved(region)) {
      throw new Error(
        `ServerlessSpaSecurityConstruct must be deployed in us-east-1 region. Current region: ${region}`
      );
    }

    // Determine the SSM prefix (used by multiple constructs)
    const ssmPrefix = props?.ssm?.ssmPrefix ?? '/myapp/security/';
    const removalPolicy = props?.removalPolicy ?? RemovalPolicy.DESTROY;
    const enableWaf = props?.enableWaf ?? true;
    const enableCustomHeader = props?.enableCustomHeader ?? true;

    // Conditionally create WafConstruct
    if (enableWaf) {
      this.waf = new WafConstruct(this, 'Waf', {
        rateLimit: props?.waf?.rateLimit,
        removalPolicy: props?.waf?.removalPolicy ?? removalPolicy,
      });
      this.webAclArn = this.waf.webAclArn;
    }

    // Conditionally create SecretConstruct and LambdaEdgeConstruct
    if (enableCustomHeader) {
      // Create SecretConstruct with auto-wired ssmPrefix and replicaRegions
      this.secret = new SecretConstruct(this, 'Secret', {
        customHeaderName: props?.secret?.customHeaderName,
        rotationDays: props?.secret?.rotationDays,
        ssmPrefix: ssmPrefix, // Auto-wired from ssm.ssmPrefix
        replicaRegions: props?.replicaRegions ?? props?.secret?.replicaRegions,
        removalPolicy: props?.secret?.removalPolicy ?? removalPolicy,
      });

      // Create LambdaEdgeConstruct with auto-wired secretName
      this.lambdaEdge = new LambdaEdgeConstruct(this, 'LambdaEdge', {
        secretName: this.secret.secretName, // Auto-wired from SecretConstruct (plain string, not token)
        customHeaderName: this.secret.customHeaderName, // Auto-wired from SecretConstruct
        cacheTtlSeconds: props?.edgeCacheTtlSeconds,
        removalPolicy,
      });

      this.secretArn = this.secret.secretArn;
      this.customHeaderName = this.secret.customHeaderName;
      this.edgeFunctionVersionArn = this.lambdaEdge.functionVersion.functionArn;
    }

    // Create SsmConstruct with auto-wired values from other constructs
    this.ssm = new SsmConstruct(this, 'Ssm', {
      ssmPrefix: ssmPrefix,
      webAclArn: this.webAclArn, // Auto-wired from WafConstruct (if enabled)
      customHeaderName: this.customHeaderName, // Auto-wired from SecretConstruct (if enabled)
      secretArn: this.secretArn, // Auto-wired from SecretConstruct (if enabled)
      edgeFunctionVersionArn: this.edgeFunctionVersionArn, // Auto-wired from LambdaEdgeConstruct (if enabled)
    });

    // Set convenience properties
    this.ssmPrefix = this.ssm.ssmPrefix;
  }
}
