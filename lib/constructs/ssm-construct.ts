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
   */
  readonly webAclArn: string;

  /**
   * Custom header name to store in SSM.
   */
  readonly customHeaderName: string;

  /**
   * Secret ARN to store in SSM.
   */
  readonly secretArn: string;
}

/**
 * A low-level CDK construct that creates SSM Parameters for cross-region sharing.
 *
 * This construct creates three SSM Parameters:
 * - {ssmPrefix}waf-acl-arn: WAF WebACL ARN for CloudFront
 * - {ssmPrefix}custom-header-name: Custom header name for API Gateway validation
 * - {ssmPrefix}secret-arn: Secrets Manager secret ARN
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
 * });
 *
 * // Access the parameters
 * console.log(ssm.wafAclArnParameter.parameterName);
 */
export class SsmConstruct extends Construct {
  /**
   * The SSM Parameter for WAF ACL ARN.
   */
  public readonly wafAclArnParameter: IStringParameter;

  /**
   * The SSM Parameter for custom header name.
   */
  public readonly customHeaderNameParameter: IStringParameter;

  /**
   * The SSM Parameter for secret ARN.
   */
  public readonly secretArnParameter: IStringParameter;

  /**
   * The SSM prefix used for parameters.
   */
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props: SsmConstructProps) {
    super(scope, id);

    // Set default values
    this.ssmPrefix = props.ssmPrefix ?? DEFAULT_SSM_PREFIX;

    // Create SSM Parameter for WAF ACL ARN
    this.wafAclArnParameter = new StringParameter(this, 'WafAclArnParameter', {
      parameterName: `${this.ssmPrefix}waf-acl-arn`,
      stringValue: props.webAclArn,
      description: 'WAF WebACL ARN for CloudFront',
    });

    // Create SSM Parameter for custom header name
    this.customHeaderNameParameter = new StringParameter(this, 'CustomHeaderNameParameter', {
      parameterName: `${this.ssmPrefix}custom-header-name`,
      stringValue: props.customHeaderName,
      description: 'Custom header name for API Gateway validation',
    });

    // Create SSM Parameter for secret ARN
    this.secretArnParameter = new StringParameter(this, 'SecretArnParameter', {
      parameterName: `${this.ssmPrefix}secret-arn`,
      stringValue: props.secretArn,
      description: 'Secrets Manager secret ARN for custom header value',
    });
  }
}
