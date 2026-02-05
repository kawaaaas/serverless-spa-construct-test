import { RemovalPolicy, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiConstruct, ApiConstructProps } from './api-construct';
import { AuthConstruct, AuthConstructProps } from './auth-construct';
import { DatabaseConstruct, DatabaseConstructProps } from './database-construct';
import { FrontendConstruct, FrontendConstructProps } from './frontend-construct';

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

  constructor(scope: Construct, id: string, props?: ServerlessSpaProps) {
    super(scope, id);

    // Apply tags to all child resources (Requirement 8.1, 8.3)
    if (props?.tags) {
      Object.entries(props.tags).forEach(([key, value]) => {
        Tags.of(this).add(key, value);
      });
    }

    // Determine removalPolicy (default: DESTROY) (Requirement 7.1, 7.2)
    const removalPolicy = props?.removalPolicy ?? RemovalPolicy.DESTROY;

    // Determine autoDeleteObjects based on removalPolicy (Requirement 7.3, 7.4)
    const autoDeleteObjects = removalPolicy === RemovalPolicy.DESTROY;

    // 3.1 Create DatabaseConstruct (Requirement 1.1, 3.1, 7.1, 7.2)
    // Pass database props transparently and apply removalPolicy to tableProps
    this.database = new DatabaseConstruct(this, 'Database', {
      ...props?.database,
      tableProps: {
        ...props?.database?.tableProps,
        removalPolicy,
      },
    });

    // 3.2 Create AuthConstruct (Requirement 1.2, 3.2)
    // Pass auth props transparently
    this.auth = new AuthConstruct(this, 'Auth', {
      ...props?.auth,
    });

    // 3.3 Create ApiConstruct (Requirement 1.3, 2.1, 2.2, 3.3)
    // Auto-wire: table from DatabaseConstruct, userPool from AuthConstruct
    // Pass api props transparently
    this.api = new ApiConstruct(this, 'Api', {
      table: this.database.table,
      userPool: this.auth.userPool,
      ...props?.api,
    });

    // 3.4 Create FrontendConstruct (Requirement 1.4, 2.3, 2.4, 2.5, 3.4, 7.3, 7.4)
    // Auto-wire: api, customHeaderName, customHeaderSecret from ApiConstruct
    // Pass frontend props transparently and set autoDeleteObjects based on removalPolicy
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
    });

    // Set convenience properties (Requirement 5.1, 5.2, 5.3, 5.4, 5.5)
    this.distributionDomainName = this.frontend.distributionDomainName;
    this.apiUrl = this.api.apiUrl;
    this.userPoolId = this.auth.userPoolId;
    this.userPoolClientId = this.auth.userPoolClientId;
    this.tableName = this.database.tableName;
  }
}
