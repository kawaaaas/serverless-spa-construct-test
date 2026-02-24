import { RemovalPolicy, Stack, Tags } from 'aws-cdk-lib';
import { Attribute } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Version } from 'aws-cdk-lib/aws-lambda';
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
  readonly frontend?: Omit<FrontendConstructProps, 'api' | 'customHeaderName' | 'webAclArn'>;
  /** Security/WAF configuration */
  readonly security?: SecurityConfig;
  /** Removal policy for all resources @default - Inherits from app-level RemovalPolicy setting */
  readonly removalPolicy?: RemovalPolicy;
  /** Tags to apply to all resources */
  readonly tags?: { [key: string]: string };
}

// ============================================================================
// Factory Method Props - Clear Required vs Optional
// ============================================================================

/**
 * Props for ServerlessSpaConstruct.minimal() - Simplest setup with CloudFront default domain.
 *
 * @example
 * ```typescript
 * ServerlessSpaConstruct.minimal(this, 'App', {
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
 * Props for ServerlessSpaConstruct.withCustomDomain() - Custom domain with auto certificate.
 *
 * @example
 * ```typescript
 * ServerlessSpaConstruct.withCustomDomain(this, 'App', {
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
 * Props for ServerlessSpaConstruct.withWaf() - WAF protection (requires SecurityStack in us-east-1).
 *
 * @example
 * ```typescript
 * // First deploy SecurityStack in us-east-1
 * ServerlessSpaConstruct.withWaf(this, 'App', {
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
 * Props for ServerlessSpaConstruct.withCustomDomainAndWaf() - Full featured setup.
 *
 * @example
 * ```typescript
 * ServerlessSpaConstruct.withCustomDomainAndWaf(this, 'App', {
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
  readonly frontend?: Omit<FrontendConstructProps, 'api' | 'customHeaderName' | 'webAclArn'>;
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
 * ServerlessSpaConstruct.minimal(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 * });
 *
 * // With custom domain (auto certificate creation)
 * ServerlessSpaConstruct.withCustomDomain(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   domainName: 'www.example.com',
 *   hostedZoneId: 'Z1234567890ABC',
 *   zoneName: 'example.com',
 * });
 *
 * // With WAF protection (requires SecurityStack in us-east-1)
 * ServerlessSpaConstruct.withWaf(this, 'App', {
 *   lambdaEntry: './src/api/handler.ts',
 *   ssmPrefix: '/myapp/security/',
 * });
 *
 * // Full featured: custom domain + WAF
 * ServerlessSpaConstruct.withCustomDomainAndWaf(this, 'App', {
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
export class ServerlessSpaConstruct extends Construct {
  // ============================================================================
  // Factory Methods - Recommended API
  // ============================================================================

  /**
   * Creates a minimal ServerlessSpaConstruct with CloudFront default domain.
   * Best for: Development, testing, or when custom domain is not needed.
   */
  public static minimal(scope: Construct, id: string, props: MinimalProps): ServerlessSpaConstruct {
    return new ServerlessSpaConstruct(scope, id, {
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
   * Creates a ServerlessSpaConstruct with custom domain and auto-generated ACM certificate.
   * Best for: Production deployments with your own domain.
   */
  public static withCustomDomain(
    scope: Construct,
    id: string,
    props: WithCustomDomainProps
  ): ServerlessSpaConstruct {
    return new ServerlessSpaConstruct(scope, id, {
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
   * Creates a ServerlessSpaConstruct with WAF protection.
   * Requires: ServerlessSpaSecurityConstruct deployed in us-east-1 first.
   * Best for: Production deployments requiring WAF protection.
   */
  public static withWaf(scope: Construct, id: string, props: WithWafProps): ServerlessSpaConstruct {
    return new ServerlessSpaConstruct(scope, id, {
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
   * Creates a ServerlessSpaConstruct with custom domain AND WAF protection.
   * Requires: ServerlessSpaSecurityConstruct deployed in us-east-1 first.
   * Best for: Production deployments with custom domain and WAF.
   */
  public static withCustomDomainAndWaf(
    scope: Construct,
    id: string,
    props: WithCustomDomainAndWafProps
  ): ServerlessSpaConstruct {
    return new ServerlessSpaConstruct(scope, id, {
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
   * The Lambda@Edge function version ARN retrieved from SSM Parameter Store.
   * Only available when security config is provided.
   */
  public edgeFunctionVersionArn?: string;

  /**
   * The AwsCustomResource for retrieving SSM parameters from us-east-1.
   * Only available when security config is provided.
   */
  public ssmParameterReader?: AwsCustomResource;

  /**
   * Protected constructor - use factory methods instead.
   * @see ServerlessSpaConstruct.minimal
   * @see ServerlessSpaConstruct.withCustomDomain
   * @see ServerlessSpaConstruct.withWaf
   * @see ServerlessSpaConstruct.withCustomDomainAndWaf
   */
  // eslint-disable-next-line cdk/construct-props-struct-name
  protected constructor(scope: Construct, id: string, props?: ServerlessSpaProps) {
    super(scope, id);

    // Apply tags to all child resources
    if (props?.tags) {
      Object.entries(props.tags).forEach(([key, value]) => {
        Tags.of(this).add(key, value);
      });
    }

    const removalPolicy = props?.removalPolicy;

    // Create AwsCustomResource for cross-region SSM parameter retrieval if security config is provided
    if (props?.security) {
      const ssmPrefix = props.security.ssmPrefix ?? '/myapp/security/';
      const securityRegion = props.security.securityRegion ?? 'us-east-1';

      // SSM parameter ARN pattern for least-privilege access
      // Format: arn:aws:ssm:{region}:{account}:parameter{prefix}*
      // Note: SSM parameter ARNs do not have a leading slash after 'parameter'
      // when the parameter name starts with '/'
      const ssmParameterArnPattern = `arn:aws:ssm:${securityRegion}:${Stack.of(this).account}:parameter${ssmPrefix}*`;

      // Create individual AwsCustomResource for each SSM parameter to avoid
      // ordering issues with getParameters API (response order is not guaranteed)
      //
      // Note: physicalResourceId includes Date.now() to force CloudFormation to
      // re-invoke the custom resource on every deployment. Without this, the
      // static physical resource ID causes CloudFormation to skip the update,
      // leaving stale values (e.g., outdated Lambda@Edge version ARNs).
      const createSsmReader = (readerId: string, paramName: string): AwsCustomResource => {
        const call = {
          service: 'SSM',
          action: 'getParameter',
          parameters: {
            Name: `${ssmPrefix}${paramName}`,
          },
          region: securityRegion,
          physicalResourceId: PhysicalResourceId.of(`${id}-ssm-${paramName}-${Date.now()}`),
        };
        return new AwsCustomResource(this, readerId, {
          onCreate: call,
          onUpdate: call,
          policy: AwsCustomResourcePolicy.fromStatements([
            new PolicyStatement({
              actions: ['ssm:GetParameter'],
              resources: [ssmParameterArnPattern],
            }),
          ]),
        });
      };

      const wafAclReader = createSsmReader('SsmWafAclArn', 'waf-acl-arn');
      const headerNameReader = createSsmReader('SsmCustomHeaderName', 'custom-header-name');
      const secretArnReader = createSsmReader('SsmSecretArn', 'secret-arn');
      const edgeFnReader = createSsmReader(
        'SsmEdgeFunctionVersionArn',
        'edge-function-version-arn'
      );

      // Keep reference to one reader for backward compatibility
      this.ssmParameterReader = wafAclReader;

      // Extract values from individual responses
      this.webAclArn = wafAclReader.getResponseField('Parameter.Value');
      this.securityCustomHeaderName = headerNameReader.getResponseField('Parameter.Value');
      this.secretArn = secretArnReader.getResponseField('Parameter.Value');
      this.edgeFunctionVersionArn = edgeFnReader.getResponseField('Parameter.Value');
    }

    // Create DatabaseConstruct
    this.database = new DatabaseConstruct(this, 'Database', {
      ...props?.database,
      tableProps: {
        ...props?.database?.tableProps,
        ...(removalPolicy !== undefined && { removalPolicy }),
      },
    });

    // Create AuthConstruct
    this.auth = new AuthConstruct(this, 'Auth', {
      ...props?.auth,
    });

    // Create ApiConstruct with auto-wired dependencies
    // Pass secretArn and userPoolClientId from security config if available
    this.api = new ApiConstruct(this, 'Api', {
      entry: '',
      table: this.database.table,
      userPool: this.auth.userPool,
      userPoolClientId: this.auth.userPoolClientId,
      ...props?.api,
      ...(props?.security && { secretArn: this.secretArn }),
    });

    // Create FrontendConstruct with auto-wired dependencies
    // Pass webAclArn and edgeFunctionVersion from security config if available
    this.frontend = new FrontendConstruct(this, 'Frontend', {
      api: this.api.api,
      customHeaderName: this.api.customHeaderName,
      ...props?.frontend,
      bucketProps: {
        ...props?.frontend?.bucketProps,
        ...(removalPolicy !== undefined && {
          removalPolicy,
          autoDeleteObjects: removalPolicy === RemovalPolicy.DESTROY,
        }),
      },
      ...(props?.security && { webAclArn: this.webAclArn }),
      ...(props?.security &&
        this.edgeFunctionVersionArn && {
          edgeFunctionVersion: Version.fromVersionArn(
            this,
            'EdgeFunctionVersion',
            this.edgeFunctionVersionArn
          ),
        }),
    });

    // Set convenience properties
    this.distributionDomainName = this.frontend.distributionDomainName;
    this.apiUrl = this.api.apiUrl;
    this.userPoolId = this.auth.userPoolId;
    this.userPoolClientId = this.auth.userPoolClientId;
    this.tableName = this.database.tableName;
  }
}
