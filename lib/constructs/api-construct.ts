import { Duration } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  IRestApi,
  LambdaIntegration,
  MethodOptions,
  RestApi,
  RestApiProps,
} from 'aws-cdk-lib/aws-apigateway';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { AnyPrincipal, Effect, PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * Properties for ApiConstruct.
 */
export interface ApiConstructProps {
  /**
   * The DynamoDB table for Lambda to access.
   * Required - Lambda will have read/write permissions to this table.
   */
  readonly table: ITable;

  /**
   * Optional Cognito User Pool for JWT authentication.
   * If provided, a Cognito Authorizer will be created and applied to all endpoints.
   */
  readonly userPool?: IUserPool;

  /**
   * Custom header name for CloudFront-only access restriction.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Custom header secret value for CloudFront-only access restriction.
   * If not provided, a random UUID will be generated.
   * @default - A random UUID is generated
   */
  readonly customHeaderSecret?: string;

  /**
   * Optional Secrets Manager secret ARN for custom header validation.
   * If provided, Lambda will be granted read permission to this secret.
   */
  readonly secretArn?: string;

  /**
   * Path to the Lambda handler entry file.
   * If not provided, uses the default handler at lambda/handler.ts.
   * @default - Uses built-in handler at lambda/handler.ts
   * @example './src/api/handler.ts'
   */
  readonly entry?: string;

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
 * - Proxy integration routing all requests to Lambda
 */
export class ApiConstruct extends Construct {
  /**
   * The REST API created by this construct.
   */
  public readonly api: IRestApi;

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
   * The custom header secret value used for CloudFront-only access restriction.
   */
  public readonly customHeaderSecret: string;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // Set custom header values
    this.customHeaderName = props.customHeaderName ?? 'x-origin-verify';
    this.customHeaderSecret = props.customHeaderSecret ?? crypto.randomUUID();

    // Determine Lambda entry point
    const entry = props.entry ?? path.join(__dirname, '../../lambda/handler.ts');

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

    // Grant Lambda read/write access to DynamoDB table
    props.table.grantReadWriteData(lambdaHandler);

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

    // Create REST API with resource policy for CloudFront-only access
    const restApi = new RestApi(this, 'RestApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
      },
      policy: new PolicyDocument({
        statements: [
          // Deny requests without the correct custom header
          new PolicyStatement({
            effect: Effect.DENY,
            principals: [new AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*/*/*'],
            conditions: {
              StringNotEquals: {
                [`aws:Referer`]: this.customHeaderSecret,
              },
            },
          }),
          // Allow all other requests (after deny check)
          new PolicyStatement({
            effect: Effect.ALLOW,
            principals: [new AnyPrincipal()],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*/*/*'],
          }),
        ],
      }),
      ...props.restApiProps,
    });

    this.api = restApi;
    this.apiUrl = restApi.url;

    // Create Lambda integration
    const lambdaIntegration = new LambdaIntegration(lambdaHandler);

    // Configure method options with Cognito Authorizer if userPool is provided
    let methodOptions: MethodOptions | undefined;

    if (props.userPool) {
      const authorizer = new CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
        cognitoUserPools: [props.userPool],
      });

      methodOptions = {
        authorizer,
        authorizationType: AuthorizationType.COGNITO,
      };
    }

    // Add ANY method to root path (/)
    restApi.root.addMethod('ANY', lambdaIntegration, methodOptions);

    // Add proxy resource ({proxy+}) with ANY method
    const proxyResource = restApi.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', lambdaIntegration, methodOptions);
  }
}
