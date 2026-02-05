import { Arn, ArnFormat, Duration, RemovalPolicy, Stack, Token } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Default custom header name for API Gateway access restriction.
 */
const DEFAULT_CUSTOM_HEADER_NAME = 'x-origin-verify';

/**
 * Default cache TTL in seconds (5 minutes).
 */
const DEFAULT_CACHE_TTL_SECONDS = 300;

/**
 * Properties for LambdaEdgeConstruct.
 */
export interface LambdaEdgeConstructProps {
  /**
   * The Secrets Manager secret name (not ARN).
   * The Lambda@Edge function will construct the ARN at runtime.
   * Must be in us-east-1 region.
   */
  readonly secretName: string;

  /**
   * Custom header name to add to requests.
   * @default 'x-origin-verify'
   */
  readonly customHeaderName?: string;

  /**
   * Cache TTL for secret value in seconds.
   * @default 300 (5 minutes)
   */
  readonly cacheTtlSeconds?: number;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * A low-level CDK construct that creates a Lambda@Edge function for CloudFront Origin Request.
 *
 * This construct creates:
 * - A Lambda@Edge function that retrieves secret values from Secrets Manager
 * - Adds custom headers to origin requests for API Gateway validation
 * - Implements in-memory caching to reduce Secrets Manager API calls
 *
 * Note: This construct must be deployed in us-east-1 region because
 * Lambda@Edge functions can only be created in us-east-1.
 *
 * The Lambda@Edge function uses NodejsFunction with esbuild's define option
 * to embed configuration at build time, since Lambda@Edge does not support
 * environment variables.
 *
 * @example
 * const lambdaEdge = new LambdaEdgeConstruct(this, 'LambdaEdge', {
 *   secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret',
 *   customHeaderName: 'x-origin-verify',
 *   cacheTtlSeconds: 300,
 * });
 *
 * // Use the function version for CloudFront
 * const functionVersion = lambdaEdge.functionVersion;
 */
export class LambdaEdgeConstruct extends Construct {
  /**
   * The Lambda@Edge function.
   */
  public readonly edgeFunction: NodejsFunction;

  /**
   * The Lambda function version for CloudFront association.
   */
  public readonly functionVersion: lambda.IVersion;

  constructor(scope: Construct, id: string, props: LambdaEdgeConstructProps) {
    super(scope, id);

    // Validate region is us-east-1
    const region = Stack.of(this).region;
    if (region !== 'us-east-1' && !Token.isUnresolved(region)) {
      throw new Error(
        `LambdaEdgeConstruct must be deployed in us-east-1 region. Current region: ${region}`
      );
    }

    // Set default values
    const customHeaderName = props.customHeaderName ?? DEFAULT_CUSTOM_HEADER_NAME;
    const cacheTtlSeconds = props.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
    const removalPolicy = props.removalPolicy ?? RemovalPolicy.DESTROY;

    // Create Lambda@Edge function using NodejsFunction with esbuild bundling
    // Configuration is embedded at build time using esbuild's define option
    // since Lambda@Edge does not support environment variables
    this.edgeFunction = new NodejsFunction(this, 'EdgeFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/edge-origin-request.ts'),
      handler: 'handler',
      timeout: Duration.seconds(5), // Lambda@Edge has max 5 seconds for origin request
      memorySize: 128,
      description: 'Lambda@Edge function for adding custom header to origin requests',
      currentVersionOptions: {
        removalPolicy,
      },
      bundling: {
        // Use esbuild's define option to embed configuration at build time
        // This replaces process.env.* references with actual values
        // Note: We use secret name instead of ARN to avoid CDK token issues
        define: {
          'process.env.SECRET_NAME': JSON.stringify(props.secretName),
          'process.env.CUSTOM_HEADER_NAME': JSON.stringify(customHeaderName),
          'process.env.CACHE_TTL_SECONDS': JSON.stringify(String(cacheTtlSeconds)),
        },
        // Minify for smaller bundle size (Lambda@Edge has size limits)
        minify: true,
        // Use ESM format for better tree-shaking
        format: OutputFormat.CJS,
        // Target Node.js 20
        target: 'node20',
      },
    });

    // Grant Secrets Manager read permission using secret name pattern
    // Lambda@Edge runs in us-east-1, so we grant access to the secret in us-east-1
    // Use Arn.format to properly handle token values for account ID
    const secretArnPattern = Arn.format(
      {
        service: 'secretsmanager',
        region: 'us-east-1',
        resource: 'secret',
        resourceName: `${props.secretName}*`,
        arnFormat: ArnFormat.COLON_RESOURCE_NAME,
      },
      Stack.of(this)
    );

    this.edgeFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArnPattern],
      })
    );

    // Store the function version for CloudFront association
    this.functionVersion = this.edgeFunction.currentVersion;
  }
}
