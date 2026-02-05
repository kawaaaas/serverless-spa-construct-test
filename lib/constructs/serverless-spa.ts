import { RemovalPolicy, Tags } from 'aws-cdk-lib';
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

/**
 * Security configuration for cross-region WAF and custom header integration.
 *
 * This configuration enables ServerlessSpa to retrieve security settings
 * from SSM Parameter Store in us-east-1 (where ServerlessSpaSecurityConstruct
 * is deployed) and apply them to CloudFront and API Gateway.
 */
export interface SecurityConfig {
  /**
   * SSM Parameter Store prefix where security values are stored.
   * Must match the prefix used in ServerlessSpaSecurityConstruct.
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
 * Properties for ServerlessSpa.
 *
 * This high-level construct integrates DatabaseConstruct, AuthConstruct,
 * ApiConstruct, and FrontendConstruct with auto-wiring of dependencies.
 */
export interface ServerlessSpaProps {
  /**
   * Optional DatabaseConstruct properties.
   * These will be passed through to DatabaseConstruct.
   */
  readonly database?: DatabaseConstructProps;

  /**
   * Optional AuthConstruct properties.
   * These will be passed through to AuthConstruct.
   */
  readonly auth?: AuthConstructProps;

  /**
   * Optional ApiConstruct properties.
   * Note: 'table' and 'userPool' are auto-wired and cannot be overridden.
   */
  readonly api?: Omit<ApiConstructProps, 'table' | 'userPool'>;

  /**
   * Optional FrontendConstruct properties.
   * Note: 'api', 'customHeaderName', and 'customHeaderSecret' are auto-wired
   * and cannot be overridden.
   */
  readonly frontend?: Omit<
    FrontendConstructProps,
    'api' | 'customHeaderName' | 'customHeaderSecret'
  >;

  /**
   * Security configuration for WAF and custom header integration.
   * If provided, enables cross-region security integration with
   * ServerlessSpaSecurityConstruct deployed in us-east-1.
   *
   * When specified:
   * - WAF WebACL ARN is retrieved from SSM and applied to CloudFront
   * - Secret ARN is retrieved from SSM and passed to ApiConstruct for header validation
   */
  readonly security?: SecurityConfig;

  /**
   * Removal policy to apply to all resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Tags to apply to all resources.
   * @default - No tags
   */
  readonly tags?: { [key: string]: string };
}

/**
 * A high-level CDK construct that creates a complete serverless SPA infrastructure.
 *
 * This construct integrates:
 * - DatabaseConstruct: DynamoDB table for data storage
 * - AuthConstruct: Cognito User Pool for authentication
 * - ApiConstruct: API Gateway + Lambda for backend
 * - FrontendConstruct: S3 + CloudFront for static hosting
 *
 * Dependencies between constructs are automatically wired:
 * - ApiConstruct receives DatabaseConstruct.table and AuthConstruct.userPool
 * - FrontendConstruct receives ApiConstruct.api and custom header values
 */
export class ServerlessSpa extends Construct {
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

  constructor(scope: Construct, id: string, props?: ServerlessSpaProps) {
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
