import { Arn, ArnFormat, Duration, Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  IdentitySource,
  LambdaIntegration,
  MethodOptions,
  RequestAuthorizer,
  RestApi,
  RestApiProps,
} from 'aws-cdk-lib/aws-apigateway';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Properties for ApiConstruct.
 */
export interface ApiConstructProps {
  /**
   * The DynamoDB table for Lambda to access.
   * Required - Lambda will have read/write permissions to this table.
   */
  readonly table: Table;

  /**
   * Optional Cognito User Pool for JWT authentication.
   * If provided, a Cognito Authorizer will be created and applied to all endpoints.
   */
  readonly userPool?: IUserPool;

  /**
   * Optional Cognito User Pool Client ID for JWT validation in Lambda Authorizer.
   * Required when both userPool and secretArn are provided.
   */
  readonly userPoolClientId?: string;

  /**
   * Custom header name for CloudFront-only access restriction.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Optional Secrets Manager secret ARN for custom header validation.
   * If provided and enableLambdaAuthorizer is true, a Lambda Authorizer will be created.
   * The ARN will be converted to the local region for accessing the replica.
   */
  readonly secretArn?: string;

  /**
   * Enable Lambda Authorizer for custom header validation.
   * Requires secretArn to be provided.
   * @default true when secretArn is provided
   */
  readonly enableLambdaAuthorizer?: boolean;

  /**
   * Cache TTL for Lambda Authorizer secret value in seconds.
   * @default 300 (5 minutes)
   */
  readonly authorizerCacheTtlSeconds?: number;

  /**
   * Path to the Lambda handler entry file.
   * If not provided, uses the default handler at lambda/handler.ts.
   * @default - Uses built-in handler at lambda/handler.ts
   * @example './src/api/handler.ts'
   */
  readonly entry: string;

  /**
   * Additional Lambda function properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly lambdaProps?: Partial<NodejsFunctionProps>;

  /**
   * Additional REST API properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly restApiProps?: Partial<RestApiProps>;
}

/**
 * A CDK construct that creates an API Gateway (REST) with Lambda backend.
 *
 * This construct provides:
 * - REST API with resource policy for CloudFront-only access
 * - Lambda function with DynamoDB read/write permissions
 * - Optional Cognito Authorizer for JWT authentication
 * - Optional Lambda Authorizer for custom header validation
 * - Proxy integration routing all requests to Lambda
 */
export class ApiConstruct extends Construct {
  /**
   * The REST API created by this construct.
   */
  public readonly api: RestApi;

  /**
   * The Lambda function created by this construct.
   */
  public readonly handler: IFunction;

  /**
   * The URL of the REST API endpoint.
   */
  public readonly apiUrl: string;

  /**
   * The custom header name used for CloudFront-only access restriction.
   */
  public readonly customHeaderName: string;

  /**
   * The Lambda Authorizer function for custom header validation.
   * Only created when secretArn is provided and enableLambdaAuthorizer is true.
   */
  public readonly authorizerFunction?: IFunction;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // Set custom header name
    this.customHeaderName = props.customHeaderName ?? 'x-origin-verify';

    // Determine Lambda entry point
    const entry = props.entry;

    // Create Lambda function
    const lambdaHandler = new NodejsFunction(this, 'Handler', {
      runtime: Runtime.NODEJS_20_X,
      memorySize: 128,
      timeout: Duration.seconds(30),
      entry,
      handler: 'handler',
      environment: {
        TABLE_NAME: props.table.tableName,
        ...props.lambdaProps?.environment,
      },
      ...props.lambdaProps,
    });

    // Grant Lambda read/write access to DynamoDB table using grants property
    props.table.grants.readWriteData(lambdaHandler);

    // Grant Lambda read access to Secrets Manager secret if secretArn is provided
    if (props.secretArn) {
      lambdaHandler.addToRolePolicy(
        new PolicyStatement({
          actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
          resources: [props.secretArn],
        })
      );
    }

    this.handler = lambdaHandler;

    // Create REST API
    const restApi = new RestApi(this, 'RestApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
      },
      ...props.restApiProps,
    });

    this.api = restApi;
    this.apiUrl = restApi.url;

    // Create Lambda integration
    const lambdaIntegration = new LambdaIntegration(lambdaHandler);

    // Determine if Lambda Authorizer should be created
    const enableLambdaAuthorizer =
      props.enableLambdaAuthorizer !== undefined
        ? props.enableLambdaAuthorizer
        : props.secretArn !== undefined;

    // Determine if we should use Lambda Authorizer (instead of Cognito Authorizer)
    // Use Lambda Authorizer when:
    // 1. Both userPool and secretArn are provided (validate both JWT and custom header)
    // 2. Only secretArn is provided (validate custom header only)
    const useLambdaAuthorizer =
      enableLambdaAuthorizer && props.secretArn && (props.userPool || !props.userPool);

    // Create Lambda Authorizer function if needed
    if (useLambdaAuthorizer) {
      // Convert secret ARN to local region for accessing the replica
      const localRegion = Stack.of(this).region;
      const localSecretArn = this.convertSecretArnToRegion(props.secretArn!, localRegion);

      // Prepare environment variables
      const authorizerEnv: Record<string, string> = {
        SECRET_ARN: localSecretArn,
        CUSTOM_HEADER_NAME: this.customHeaderName,
        CACHE_TTL_SECONDS: String(props.authorizerCacheTtlSeconds ?? 300),
      };

      // Add Cognito configuration if userPool is provided
      if (props.userPool) {
        authorizerEnv.USER_POOL_ID = props.userPool.userPoolId;

        // Client ID is required for JWT validation
        if (!props.userPoolClientId) {
          throw new Error(
            'userPoolClientId is required when both userPool and secretArn are provided for Lambda Authorizer'
          );
        }
        authorizerEnv.CLIENT_ID = props.userPoolClientId;
      }

      // Create Lambda Authorizer function
      const authorizerHandler = new NodejsFunction(this, 'AuthorizerHandler', {
        runtime: Runtime.NODEJS_20_X,
        memorySize: 128,
        timeout: Duration.seconds(10),
        entry: path.join(__dirname, '../lambda/custom-header-authorizer.ts'),
        handler: 'handler',
        environment: authorizerEnv,
      });

      // Grant Lambda Authorizer read access to Secrets Manager replica
      authorizerHandler.addToRolePolicy(
        new PolicyStatement({
          actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
          resources: [localSecretArn],
        })
      );

      this.authorizerFunction = authorizerHandler;
    }

    // Configure method options with authorizers
    let methodOptions: MethodOptions | undefined;

    if (useLambdaAuthorizer && this.authorizerFunction) {
      // Lambda Authorizer for custom header validation (and optionally JWT validation)
      // Note: identitySources only includes Authorization header.
      // The custom header (x-origin-verify) is validated inside the Lambda Authorizer,
      // not as an identity source. Including it in identitySources would cause
      // API Gateway to reject requests before the Authorizer is invoked if the
      // header is missing from the initial request context.
      const lambdaAuthorizer = new RequestAuthorizer(this, 'LambdaAuthorizer', {
        handler: this.authorizerFunction,
        identitySources: [IdentitySource.header('Authorization')],
        resultsCacheTtl: Duration.seconds(0), // Disable API Gateway caching, use Lambda caching
      });

      methodOptions = {
        authorizer: lambdaAuthorizer,
        authorizationType: AuthorizationType.CUSTOM,
      };
    } else if (props.userPool && !useLambdaAuthorizer) {
      // Cognito Authorizer only (when secretArn is not provided)
      const cognitoAuthorizer = new CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
        cognitoUserPools: [props.userPool],
      });

      methodOptions = {
        authorizer: cognitoAuthorizer,
        authorizationType: AuthorizationType.COGNITO,
      };
    }

    // Add ANY method to root path (/)
    restApi.root.addMethod('ANY', lambdaIntegration, methodOptions);

    // Add proxy resource ({proxy+}) with ANY method
    const proxyResource = restApi.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration, methodOptions);
  }

  /**
   * Converts a Secrets Manager ARN to a different region using CDK's Arn utilities.
   * Used to convert the primary secret ARN (us-east-1) to the local region for accessing the replica.
   *
   * @param secretArn The original secret ARN
   * @param targetRegion The target region
   * @returns The secret ARN with the region replaced
   */
  private convertSecretArnToRegion(secretArn: string, targetRegion: string): string {
    const arnComponents = Arn.split(secretArn, ArnFormat.COLON_RESOURCE_NAME);
    return Arn.format(
      {
        ...arnComponents,
        region: targetRegion,
      },
      Stack.of(this)
    );
  }
}
