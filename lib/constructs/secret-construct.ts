import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { ISecret, RotationSchedule, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Default custom header name for API Gateway access restriction.
 */
const DEFAULT_CUSTOM_HEADER_NAME = 'x-origin-verify';

/**
 * Default rotation interval in days.
 */
const DEFAULT_ROTATION_DAYS = 7;

/**
 * Default SSM prefix for parameters.
 */
const DEFAULT_SSM_PREFIX = '/myapp/security/';

/**
 * Properties for SecretConstruct.
 */
export interface SecretConstructProps {
  /**
   * Custom header name for API Gateway access restriction.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Secret rotation interval in days.
   * @default 7
   */
  readonly rotationDays?: number;

  /**
   * SSM Parameter Store prefix for updating during rotation.
   * Required for rotation Lambda to update SSM parameters.
   * @default '/myapp/security/'
   */
  readonly ssmPrefix?: string;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * A low-level CDK construct that creates a Secrets Manager secret
 * with automatic rotation for custom header values.
 *
 * This construct creates:
 * - A Secrets Manager secret containing a UUID for custom header validation
 * - A rotation Lambda function that generates new UUID values
 * - Automatic rotation schedule (default: every 7 days)
 *
 * The rotation Lambda also updates the SSM Parameter with the new secret ARN
 * to ensure cross-region consistency.
 *
 * @example
 * const secret = new SecretConstruct(this, 'Secret', {
 *   customHeaderName: 'x-origin-verify',
 *   rotationDays: 14,
 *   ssmPrefix: '/myapp/security/',
 * });
 *
 * // Use the secret ARN
 * console.log(secret.secretArn);
 */
export class SecretConstruct extends Construct {
  /**
   * The Secrets Manager secret.
   */
  public readonly secret: ISecret;

  /**
   * The Secrets Manager secret ARN.
   */
  public readonly secretArn: string;

  /**
   * The custom header name.
   */
  public readonly customHeaderName: string;

  /**
   * The rotation Lambda function.
   */
  public readonly rotationFunction: IFunction;

  /**
   * The SSM prefix used for parameters.
   */
  private readonly ssmPrefix: string;

  /**
   * The rotation interval in days.
   */
  private readonly rotationDays: number;

  constructor(scope: Construct, id: string, props?: SecretConstructProps) {
    super(scope, id);

    // Set default values
    this.customHeaderName = props?.customHeaderName ?? DEFAULT_CUSTOM_HEADER_NAME;
    this.rotationDays = props?.rotationDays ?? DEFAULT_ROTATION_DAYS;
    this.ssmPrefix = props?.ssmPrefix ?? DEFAULT_SSM_PREFIX;
    const removalPolicy = props?.removalPolicy ?? RemovalPolicy.DESTROY;

    // Create the secret with initial UUID value
    const secret = new Secret(this, 'Secret', {
      secretName: `${this.ssmPrefix}custom-header-secret`,
      description: `Custom header value for ${this.customHeaderName}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ headerName: this.customHeaderName }),
        generateStringKey: 'headerValue',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 36, // UUID-like length
      },
      removalPolicy,
    });

    this.secret = secret;
    this.secretArn = secret.secretArn;

    // Create rotation Lambda function
    this.rotationFunction = new NodejsFunction(this, 'RotationFunction', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/rotation-handler.ts'),
      handler: 'handler',
      timeout: Duration.seconds(30),
      environment: {
        SECRET_ARN: secret.secretArn,
        SSM_PREFIX: this.ssmPrefix,
        CUSTOM_HEADER_NAME: this.customHeaderName,
      },
      description: 'Rotates custom header secret and updates SSM parameters',
    });

    // Grant permissions to the rotation Lambda
    secret.grantRead(this.rotationFunction);
    secret.grantWrite(this.rotationFunction);

    // Grant SSM parameter update permissions
    this.rotationFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:PutParameter', 'ssm:GetParameter'],
        resources: [`arn:aws:ssm:*:*:parameter${this.ssmPrefix}*`],
      })
    );

    // Configure rotation schedule
    new RotationSchedule(this, 'RotationSchedule', {
      secret,
      rotationLambda: this.rotationFunction,
      automaticallyAfter: Duration.days(this.rotationDays),
    });
  }
}
