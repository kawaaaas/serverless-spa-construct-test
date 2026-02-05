import { RemovalPolicy, Tags } from 'aws-cdk-lib';
import { Attribute } from 'aws-cdk-lib/aws-dynamodb';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { ApiConstruct, ApiConstructProps } from './api-construct';
import { AuthConstruct, AuthConstructProps } from './auth-construct';
import { DatabaseConstruct, DatabaseConstructProps } from './database-construct';
import { FrontendConstruct, FrontendConstructProps } from './frontend-construct';

// ============================================================================
// Base Types for Advanced Customization
// ============================================================================

/**
 * Security configuration for cross-region WAF and custom header integration.
 */
export interface SecurityConfig {
  /**
   * SSM Parameter Store prefix where security values are stored.
   * @default '/myapp/security/'
   */
  readonly ssmPrefix?: string;

  /**
   * The region where ServerlessSpaSecurityConstruct is deployed.
   * @default 'us-east-1'
   */
  readonly securityRegion?: string;
}

/**
 * Advanced customization options for fine-grained control.
 * Use these only when you need to override default behaviors.
 */
export interface AdvancedOptions {
  /** Override DatabaseConstruct settings */
  readonly database?: DatabaseConstructProps;
  /** Override AuthConstruct settings */
  readonly auth?: AuthConstructProps;
  /** Override ApiConstruct settings (table/userPool are auto-wired) */
  readonly api?: Omit<ApiConstructProps, 'table' | 'userPool' | 'entry'>;
  /** Override FrontendConstruct settings (api/headers are auto-wired) */
  readonly frontend?: Omit<
    FrontendConstructProps,
    'api' | 'customHeaderName' | 'customHeaderSecret' | 'webAclArn'
  >;
  /** Security/WAF configuration */
  readonly security?: SecurityConfig;
  /** Removal policy for all resources @default RemovalPolicy.DESTROY */
  readonly removalPolicy?: RemovalPolicy;
  /** Tags to apply to all resources */
  readonly tags?: { [key: string]: string };
}

// ============================================================================
// Factory Method Props - Clear Required vs Optional
// ============================================================================

/**
 * Props for ServerlessSpa.minimal() - Simplest setup with CloudFront default domain.
 *
 * @example
 * ```typescript
 * ServerlessSpa.minimal(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   partitionKey: { name: 'PK', type: AttributeType.STRING },
 * });
 * ```
 */
export interface MinimalProps {
  // === REQUIRED ===
  /** Path to your Lambda handler file (e.g., './src/api/handler.ts') */
  readonly lambdaEntry: string;

  /**
   * DynamoDB partition key attribute.
   * @example { name: 'PK', type: AttributeType.STRING }
   */
  readonly partitionKey: Attribute;

  // === OPTIONAL ===
  /**
   * DynamoDB sort key attribute.
   * Set to null to create a table without sort key.
   * @default - No sort key
   */
  readonly sortKey?: Attribute | null;

  /** Advanced customization options */
  readonly advanced?: AdvancedOptions;
}

/**
 * Props for ServerlessSpa.withCustomDomain() - Custom domain with auto certificate.
 *
 * @example
 * ```typescript
 * ServerlessSpa.withCustomDomain(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   partitionKey: { name: 'PK', type: AttributeType.STRING },
 *   domainName: 'www.example.com',
 *   hostedZoneId: 'Z1234567890ABC',
 *   zoneName: 'example.com',
 * });
 * ```
 */
export interface WithCustomDomainProps {
  // === REQUIRED ===
  /** Path to your Lambda handler file */
  readonly lambdaEntry: string;

  /**
   * DynamoDB partition key attribute.
   * @example { name: 'PK', type: AttributeType.STRING }
   */
  readonly partitionKey: Attribute;

  /** Custom domain name (e.g., 'www.example.com') */
  readonly domainName: string;
  /** Route53 Hosted Zone ID (from AWS Console) */
  readonly hostedZoneId: string;
  /** Route53 Zone Name (e.g., 'example.com') */
  readonly zoneName: string;

  // === OPTIONAL ===
  /**
   * DynamoDB sort key attribute.
   * Set to null to create a table without sort key.
   * @default - No sort key
   */
  readonly sortKey?: Attribute | null;

  /** Additional domain aliases (e.g., ['example.com']) */
  readonly alternativeDomainNames?: string[];
  /** Advanced customization options */
  readonly advanced?: AdvancedOptions;
}

/**
 * Props for ServerlessSpa.withWaf() - WAF protection (requires SecurityStack in us-east-1).
 *
 * @example
 * ```typescript
 * // First deploy SecurityStack in us-east-1
 * ServerlessSpa.withWaf(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   partitionKey: { name: 'PK', type: AttributeType.STRING },
 *   ssmPrefix: '/myapp/security/',
 * });
 * ```
 */
export interface WithWafProps {
  // === REQUIRED ===
  /** Path to your Lambda handler file */
  readonly lambdaEntry: string;

  /**
   * DynamoDB partition key attribute.
   * @example { name: 'PK', type: AttributeType.STRING }
   */
  readonly partitionKey: Attribute;

  /** SSM prefix matching your ServerlessSpaSecurityConstruct */
  readonly ssmPrefix: string;

  // === OPTIONAL ===
  /**
   * DynamoDB sort key attribute.
   * Set to null to create a table without sort key.
   * @default - No sort key
   */
  readonly sortKey?: Attribute | null;

  /** Region where SecurityStack is deployed @default 'us-east-1' */
  readonly securityRegion?: string;
  /** Advanced customization options */
  readonly advanced?: AdvancedOptions;
}

/**
 * Props for ServerlessSpa.withCustomDomainAndWaf() - Full featured setup.
 *
 * @example
 * ```typescript
 * ServerlessSpa.withCustomDomainAndWaf(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   partitionKey: { name: 'PK', type: AttributeType.STRING },
 *   domainName: 'www.example.com',
 *   hostedZoneId: 'Z1234567890ABC',
 *   zoneName: 'example.com',
 *   ssmPrefix: '/myapp/security/',
 * });
 * ```
 */
export interface WithCustomDomainAndWafProps {
  // === REQUIRED ===
  /** Path to your Lambda handler file */
  readonly lambdaEntry: string;

  /**
   * DynamoDB partition key attribute.
   * @example { name: 'PK', type: AttributeType.STRING }
   */
  readonly partitionKey: Attribute;

  /** Custom domain name */
  readonly domainName: string;
  /** Route53 Hosted Zone ID */
  readonly hostedZoneId: string;
  /** Route53 Zone Name */
  readonly zoneName: string;
  /** SSM prefix matching your ServerlessSpaSecurityConstruct */
  readonly ssmPrefix: string;

  // === OPTIONAL ===
  /**
   * DynamoDB sort key attribute.
   * Set to null to create a table without sort key.
   * @default - No sort key
   */
  readonly sortKey?: Attribute | null;

  /** Additional domain aliases */
  readonly alternativeDomainNames?: string[];
  /** Region where SecurityStack is deployed @default 'us-east-1' */
  readonly securityRegion?: string;
  /** Advanced customization options */
  readonly advanced?: AdvancedOptions;
}

/**
 * Legacy props for direct constructor usage.
 * Prefer using factory methods for clearer API.
 */
export interface ServerlessSpaProps {
  readonly database?: DatabaseConstructProps;
  readonly auth?: AuthConstructProps;
  readonly api?: Omit<ApiConstructProps, 'table' | 'userPool'>;
  readonly frontend?: Omit<
    FrontendConstructProps,
    'api' | 'customHeaderName' | 'customHeaderSecret' | 'webAclArn'
  >;
  readonly security?: SecurityConfig;
  readonly removalPolicy?: RemovalPolicy;
  readonly tags?: { [key: string]: string };
}

/**
 * A high-level CDK construct that creates a complete serverless SPA infrastructure.
 *
 * ## Recommended: Use Factory Methods
 *
 * Factory methods provide clear, use-case specific APIs:
 *
 * ```typescript
 * // Simplest setup - CloudFront default domain
 * ServerlessSpa.minimal(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 * });
 *
 * // With custom domain (auto certificate creation)
 * ServerlessSpa.withCustomDomain(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   domainName: 'www.example.com',
 *   hostedZoneId: 'Z1234567890ABC',
 *   zoneName: 'example.com',
 * });
 *
 * // With WAF protection (requires SecurityStack in us-east-1)
 * ServerlessSpa.withWaf(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   ssmPrefix: '/myapp/security/',
 * });
 *
 * // Full featured: custom domain + WAF
 * ServerlessSpa.withCustomDomainAndWaf(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   domainName: 'www.example.com',
 *   hostedZoneId: 'Z1234567890ABC',
 *   zoneName: 'example.com',
 *   ssmPrefix: '/myapp/security/',
 * });
 * ```
 *
 * ## Architecture
 *
 * This construct creates:
 * - DynamoDB table (single-table design, on-demand)
 * - Cognito User Pool (JWT authentication)
 * - API Gateway + Lambda (backend API)
 * - S3 + CloudFront (static hosting)
 */
export class ServerlessSpa extends Construct {
  // ============================================================================
  // Factory Methods - Recommended API
  // ============================================================================

  /**
   * Creates a minimal ServerlessSpa with CloudFront default domain.
   * Best for: Development, testing, or when custom domain is not needed.
   */
  public static minimal(scope: Construct, id: string, props: MinimalProps): ServerlessSpa {
    return new ServerlessSpa(scope, id, {
      ...props.advanced,
      database: {
        ...props.advanced?.database,
        partitionKey: props.partitionKey,
        sortKey: props.sortKey,
      },
      api: {
        ...props.advanced?.api,
        entry: props.lambdaEntry,
      },
    });
  }

  /**
   * Creates a ServerlessSpa with custom domain and auto-generated ACM certificate.
   * Best for: Production deployments with your own domain.
   */
  public static withCustomDomain(
    scope: Construct,
    id: string,
    props: WithCustomDomainProps
  ): ServerlessSpa {
    return new ServerlessSpa(scope, id, {
      ...props.advanced,
      database: {
        ...props.advanced?.database,
        partitionKey: props.partitionKey,
        sortKey: props.sortKey,
      },
      api: {
        ...props.advanced?.api,
        entry: props.lambdaEntry,
      },
      frontend: {
        ...props.advanced?.frontend,
        domainName: props.domainName,
        hostedZoneId: props.hostedZoneId,
        zoneName: props.zoneName,
        alternativeDomainNames: props.alternativeDomainNames,
      },
    });
  }

  /**
   * Creates a ServerlessSpa with WAF protection.
   * Requires: ServerlessSpaSecurityConstruct deployed in us-east-1 first.
   * Best for: Production deployments requiring WAF protection.
   */
  public static withWaf(scope: Construct, id: string, props: WithWafProps): ServerlessSpa {
    return new ServerlessSpa(scope, id, {
      ...props.advanced,
      database: {
        ...props.advanced?.database,
        partitionKey: props.partitionKey,
        sortKey: props.sortKey,
      },
      api: {
        ...props.advanced?.api,
        entry: props.lambdaEntry,
      },
      security: {
        ssmPrefix: props.ssmPrefix,
        securityRegion: props.securityRegion,
      },
    });
  }

  /**
   * Creates a ServerlessSpa with custom domain AND WAF protection.
   * Requires: ServerlessSpaSecurityConstruct deployed in us-east-1 first.
   * Best for: Production deployments with custom domain and WAF.
   */
  public static withCustomDomainAndWaf(
    scope: Construct,
    id: string,
    props: WithCustomDomainAndWafProps
  ): ServerlessSpa {
    return new ServerlessSpa(scope, id, {
      ...props.advanced,
      database: {
        ...props.advanced?.database,
        partitionKey: props.partitionKey,
        sortKey: props.sortKey,
      },
      api: {
        ...props.advanced?.api,
        entry: props.lambdaEntry,
      },
      frontend: {
        ...props.advanced?.frontend,
        domainName: props.domainName,
        hostedZoneId: props.hostedZoneId,
        zoneName: props.zoneName,
        alternativeDomainNames: props.alternativeDomainNames,
      },
      security: {
        ssmPrefix: props.ssmPrefix,
        securityRegion: props.securityRegion,
      },
    });
  }

  // ============================================================================
  // Instance Properties
  // ============================================================================
  /**
   * The DatabaseConstruct instance.
   */
  public readonly database: DatabaseConstruct;

  /**
   * The AuthConstruct instance.
   */
  public readonly auth: AuthConstruct;

  /**
   * The ApiConstruct instance.
   */
  public readonly api: ApiConstruct;

  /**
   * The FrontendConstruct instance.
   */
  public readonly frontend: FrontendConstruct;

  /**
   * The domain name of the CloudFront distribution.
   * Convenience property for frontend.distributionDomainName.
   */
  public readonly distributionDomainName: string;

  /**
   * The URL of the REST API endpoint.
   * Convenience property for api.apiUrl.
   */
  public readonly apiUrl: string;

  /**
   * The ID of the Cognito User Pool.
   * Convenience property for auth.userPoolId.
   */
  public readonly userPoolId: string;

  /**
   * The ID of the Cognito User Pool Client.
   * Convenience property for auth.userPoolClientId.
   */
  public readonly userPoolClientId: string;

  /**
   * The name of the DynamoDB table.
   * Convenience property for database.tableName.
   */
  public readonly tableName: string;

  /**
   * The WAF WebACL ARN retrieved from SSM Parameter Store.
   * Only available when security config is provided.
   */
  public webAclArn?: string;

  /**
   * The custom header name retrieved from SSM Parameter Store.
   * Only available when security config is provided.
   */
  public securityCustomHeaderName?: string;

  /**
   * The secret ARN retrieved from SSM Parameter Store.
   * Only available when security config is provided.
   */
  public secretArn?: string;

  /**
   * The AwsCustomResource for retrieving SSM parameters from us-east-1.
   * Only available when security config is provided.
   */
  public ssmParameterReader?: AwsCustomResource;

  /**
   * Protected constructor - use factory methods instead.
   * @see ServerlessSpa.minimal
   * @see ServerlessSpa.withCustomDomain
   * @see ServerlessSpa.withWaf
   * @see ServerlessSpa.withCustomDomainAndWaf
   */
  protected constructor(scope: Construct, id: string, props?: ServerlessSpaProps) {
    super(scope, id);

    // Apply tags to all child resources
    if (props?.tags) {
      Object.entries(props.tags).forEach(([key, value]) => {
        Tags.of(this).add(key, value);
      });
    }

    const removalPolicy = props?.removalPolicy ?? RemovalPolicy.DESTROY;
    const autoDeleteObjects = removalPolicy === RemovalPolicy.DESTROY;

    // Create AwsCustomResource for cross-region SSM parameter retrieval if security config is provided
    if (props?.security) {
      const ssmPrefix = props.security.ssmPrefix ?? '/myapp/security/';
      const securityRegion = props.security.securityRegion ?? 'us-east-1';

      // Create AwsCustomResource to get SSM parameters from us-east-1
      const ssmCall = {
        service: 'SSM',
        action: 'getParameters',
        parameters: {
          Names: [
            `${ssmPrefix}waf-acl-arn`,
            `${ssmPrefix}custom-header-name`,
            `${ssmPrefix}secret-arn`,
          ],
        },
        region: securityRegion,
        physicalResourceId: PhysicalResourceId.of(`${id}-ssm-params`),
      };

      this.ssmParameterReader = new AwsCustomResource(this, 'SsmParameterReader', {
        onCreate: ssmCall,
        onUpdate: ssmCall,
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: AwsCustomResourcePolicy.ANY_RESOURCE,
        }),
      });

      // Extract values from the response
      this.webAclArn = this.ssmParameterReader.getResponseField('Parameters.0.Value');
      this.securityCustomHeaderName =
        this.ssmParameterReader.getResponseField('Parameters.1.Value');
      this.secretArn = this.ssmParameterReader.getResponseField('Parameters.2.Value');
    }

    // Create DatabaseConstruct
    this.database = new DatabaseConstruct(this, 'Database', {
      ...props?.database,
      tableProps: {
        ...props?.database?.tableProps,
        removalPolicy,
      },
    });

    // Create AuthConstruct
    this.auth = new AuthConstruct(this, 'Auth', {
      ...props?.auth,
    });

    // Create ApiConstruct with auto-wired dependencies
    // Pass secretArn from security config if available
    this.api = new ApiConstruct(this, 'Api', {
      table: this.database.table,
      userPool: this.auth.userPool,
      ...props?.api,
      ...(props?.security && { secretArn: this.secretArn }),
    });

    // Create FrontendConstruct with auto-wired dependencies
    // Pass webAclArn from security config if available
    this.frontend = new FrontendConstruct(this, 'Frontend', {
      api: this.api.api,
      customHeaderName: this.api.customHeaderName,
      customHeaderSecret: this.api.customHeaderSecret,
      ...props?.frontend,
      bucketProps: {
        ...props?.frontend?.bucketProps,
        removalPolicy,
        autoDeleteObjects,
      },
      ...(props?.security && { webAclArn: this.webAclArn }),
    });

    // Set convenience properties
    this.distributionDomainName = this.frontend.distributionDomainName;
    this.apiUrl = this.api.apiUrl;
    this.userPoolId = this.auth.userPoolId;
    this.userPoolClientId = this.auth.userPoolClientId;
    this.tableName = this.database.tableName;
  }
}
