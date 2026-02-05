import { IStringParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/**
 * Default SSM prefix for parameters.
 */
const DEFAULT_SSM_PREFIX = '/myapp/security/';

/**
 * Properties for SsmConstruct.
 */
export interface SsmConstructProps {
  /**
   * SSM Parameter Store prefix for cross-region sharing.
   * @default '/myapp/security/'
   */
  readonly ssmPrefix?: string;

  /**
   * WAF WebACL ARN to store in SSM.
   * Optional - only required when WAF is enabled.
   */
  readonly webAclArn?: string;

  /**
   * Custom header name to store in SSM.
   * Optional - only required when custom header is enabled.
   */
  readonly customHeaderName?: string;

  /**
   * Secret ARN to store in SSM.
   * Optional - only required when custom header is enabled.
   */
  readonly secretArn?: string;

  /**
   * Lambda@Edge function version ARN to store in SSM.
   * Used for cross-region CloudFront association.
   * Optional - only required when custom header is enabled.
   */
  readonly edgeFunctionVersionArn?: string;
}

/**
 * A low-level CDK construct that creates SSM Parameters for cross-region sharing.
 *
 * This construct creates SSM Parameters:
 * - {ssmPrefix}waf-acl-arn: WAF WebACL ARN for CloudFront
 * - {ssmPrefix}custom-header-name: Custom header name for API Gateway validation
 * - {ssmPrefix}secret-arn: Secrets Manager secret ARN
 * - {ssmPrefix}edge-function-version-arn: Lambda@Edge function version ARN (optional)
 *
 * These parameters enable cross-region sharing of security configuration
 * between the us-east-1 security stack and the main application stack.
 *
 * @example
 * const ssm = new SsmConstruct(this, 'Ssm', {
 *   ssmPrefix: '/myapp/security/',
 *   webAclArn: 'arn:aws:wafv2:us-east-1:123456789012:global/webacl/...',
 *   customHeaderName: 'x-origin-verify',
 *   secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:...',
 *   edgeFunctionVersionArn: 'arn:aws:lambda:us-east-1:123456789012:function:...:1',
 * });
 *
 * // Access the parameters
 * console.log(ssm.wafAclArnParameter.parameterName);
 */
export class SsmConstruct extends Construct {
  /**
   * The SSM Parameter for WAF ACL ARN.
   * Only created when webAclArn is provided.
   */
  public readonly wafAclArnParameter?: IStringParameter;

  /**
   * The SSM Parameter for custom header name.
   * Only created when customHeaderName is provided.
   */
  public readonly customHeaderNameParameter?: IStringParameter;

  /**
   * The SSM Parameter for secret ARN.
   * Only created when secretArn is provided.
   */
  public readonly secretArnParameter?: IStringParameter;

  /**
   * The SSM Parameter for Lambda@Edge function version ARN.
   * Only created when edgeFunctionVersionArn is provided.
   */
  public readonly edgeFunctionVersionArnParameter?: IStringParameter;

  /**
   * The SSM prefix used for parameters.
   */
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props: SsmConstructProps) {
    super(scope, id);

    // Set default values
    this.ssmPrefix = props.ssmPrefix ?? DEFAULT_SSM_PREFIX;

    // Create SSM Parameter for WAF ACL ARN (if provided)
    if (props.webAclArn) {
      this.wafAclArnParameter = new StringParameter(this, 'WafAclArnParameter', {
        parameterName: `${this.ssmPrefix}waf-acl-arn`,
        stringValue: props.webAclArn,
        description: 'WAF WebACL ARN for CloudFront',
      });
    }

    // Create SSM Parameter for custom header name (if provided)
    if (props.customHeaderName) {
      this.customHeaderNameParameter = new StringParameter(this, 'CustomHeaderNameParameter', {
        parameterName: `${this.ssmPrefix}custom-header-name`,
        stringValue: props.customHeaderName,
        description: 'Custom header name for API Gateway validation',
      });
    }

    // Create SSM Parameter for secret ARN (if provided)
    if (props.secretArn) {
      this.secretArnParameter = new StringParameter(this, 'SecretArnParameter', {
        parameterName: `${this.ssmPrefix}secret-arn`,
        stringValue: props.secretArn,
        description: 'Secrets Manager secret ARN for custom header value',
      });
    }

    // Create SSM Parameter for Lambda@Edge function version ARN (if provided)
    if (props.edgeFunctionVersionArn) {
      this.edgeFunctionVersionArnParameter = new StringParameter(
        this,
        'EdgeFunctionVersionArnParameter',
        {
          parameterName: `${this.ssmPrefix}edge-function-version-arn`,
          stringValue: props.edgeFunctionVersionArn,
          description: 'Lambda@Edge function version ARN for CloudFront origin request',
        }
      );
    }
  }
}
