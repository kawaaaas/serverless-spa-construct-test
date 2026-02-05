import { RemovalPolicy } from 'aws-cdk-lib';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

/**
 * Default rate limit for WAF (requests per 5 minutes).
 */
const DEFAULT_RATE_LIMIT = 2000;

/**
 * Properties for WafConstruct.
 */
export interface WafConstructProps {
  /**
   * Rate limit for WAF (requests per 5 minutes).
   * @default 2000
   */
  readonly rateLimit?: number;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * A low-level CDK construct that creates a WAF WebACL for CloudFront.
 *
 * This construct creates a WAF WebACL with CLOUDFRONT scope that includes:
 * - Rate limiting rule (default: 2000 requests per 5 minutes)
 * - AWS Managed Rules Common Rule Set
 * - AWS Managed Rules SQLi Rule Set
 *
 * Note: This construct must be deployed in us-east-1 region because
 * WAF WebACLs with CLOUDFRONT scope can only be created in us-east-1.
 *
 * @example
 * const waf = new WafConstruct(this, 'Waf', {
 *   rateLimit: 3000,
 * });
 *
 * // Use the WAF WebACL ARN with CloudFront
 * console.log(waf.webAclArn);
 */
export class WafConstruct extends Construct {
  /**
   * The WAF WebACL.
   */
  public readonly webAcl: CfnWebACL;

  /**
   * The WAF WebACL ARN.
   */
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props?: WafConstructProps) {
    super(scope, id);

    const rateLimit = props?.rateLimit ?? DEFAULT_RATE_LIMIT;

    // Create WAF WebACL with CLOUDFRONT scope
    this.webAcl = new CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'WebAclMetric',
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rule 1: Rate limiting
        {
          name: 'RateLimitRule',
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: rateLimit,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRuleMetric',
            sampledRequestsEnabled: true,
          },
        },
        // Rule 2: AWS Managed Rules Common Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSetMetric',
            sampledRequestsEnabled: true,
          },
        },
        // Rule 3: AWS Managed Rules SQLi Rule Set
        {
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesSQLiRuleSetMetric',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Set the WebACL ARN
    this.webAclArn = this.webAcl.attrArn;
  }
}
