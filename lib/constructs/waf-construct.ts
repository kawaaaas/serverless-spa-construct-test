import { RemovalPolicy } from 'aws-cdk-lib';
import { CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

/**
 * Default rate limit for WAF (requests per 5 minutes).
 */
const DEFAULT_RATE_LIMIT = 2000;

/**
 * WAF rule configuration for custom rules.
 */
export interface WafRuleConfig {
  /**
   * Rule name.
   */
  readonly name: string;

  /**
   * Rule priority. Lower numbers are evaluated first.
   */
  readonly priority: number;

  /**
   * Rule statement defining the match conditions.
   */
  readonly statement: CfnWebACL.StatementProperty;

  /**
   * Action to take when the rule matches.
   * Use { block: {} } to block, { allow: {} } to allow, { count: {} } to count only.
   * For managed rule groups, use overrideAction instead.
   */
  readonly action?: CfnWebACL.RuleActionProperty;

  /**
   * Override action for managed rule groups.
   * Use { none: {} } to use the rule group's actions, or { count: {} } to count only.
   */
  readonly overrideAction?: CfnWebACL.OverrideActionProperty;

  /**
   * CloudWatch metrics configuration.
   */
  readonly visibilityConfig?: CfnWebACL.VisibilityConfigProperty;
}

/**
 * Properties for WafConstruct.
 */
export interface WafConstructProps {
  /**
   * Rate limit for WAF (requests per 5 minutes).
   * Set to 0 to disable the default rate limiting rule.
   * @default 2000
   */
  readonly rateLimit?: number;

  /**
   * Whether to include AWS Managed Rules Common Rule Set.
   * @default true
   */
  readonly enableCommonRuleSet?: boolean;

  /**
   * Whether to include AWS Managed Rules SQLi Rule Set.
   * @default true
   */
  readonly enableSqliRuleSet?: boolean;

  /**
   * Custom WAF rules to add.
   * These rules will be added after the default rules.
   * @default - No custom rules
   */
  readonly customRules?: WafRuleConfig[];

  /**
   * Completely override all rules with custom configuration.
   * When provided, rateLimit, enableCommonRuleSet, enableSqliRuleSet, and customRules are ignored.
   * Use this for full control over WAF rules.
   * @default - Uses default rules with optional customRules
   */
  readonly rules?: CfnWebACL.RuleProperty[];

  /**
   * Default action when no rules match.
   * @default { allow: {} }
   */
  readonly defaultAction?: CfnWebACL.DefaultActionProperty;

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
 * - AWS Managed Rules Common Rule Set (optional, enabled by default)
 * - AWS Managed Rules SQLi Rule Set (optional, enabled by default)
 * - Support for custom rules
 * - Full rule override capability for advanced use cases
 *
 * Note: This construct must be deployed in us-east-1 region because
 * WAF WebACLs with CLOUDFRONT scope can only be created in us-east-1.
 *
 * @example
 * // Basic usage with defaults
 * const waf = new WafConstruct(this, 'Waf', {
 *   rateLimit: 3000,
 * });
 *
 * @example
 * // Add custom rules
 * const waf = new WafConstruct(this, 'Waf', {
 *   customRules: [{
 *     name: 'BlockBadBots',
 *     priority: 10,
 *     statement: {
 *       byteMatchStatement: {
 *         searchString: 'BadBot',
 *         fieldToMatch: { singleHeader: { name: 'user-agent' } },
 *         textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
 *         positionalConstraint: 'CONTAINS',
 *       },
 *     },
 *     action: { block: {} },
 *   }],
 * });
 *
 * @example
 * // Full control with custom rules array
 * const waf = new WafConstruct(this, 'Waf', {
 *   rules: [
 *     // Your complete custom rules configuration
 *   ],
 * });
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

    const defaultAction = props?.defaultAction ?? { allow: {} };

    // Build rules array
    let rules: CfnWebACL.RuleProperty[];

    if (props?.rules) {
      // Full override mode - use provided rules directly
      rules = props.rules;
    } else {
      // Build rules from configuration
      rules = [];
      let priority = 1;

      // Rule 1: Rate limiting (if enabled)
      const rateLimit = props?.rateLimit ?? DEFAULT_RATE_LIMIT;
      if (rateLimit > 0) {
        rules.push({
          name: 'RateLimitRule',
          priority: priority++,
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
        });
      }

      // Rule 2: AWS Managed Rules Common Rule Set (if enabled)
      const enableCommonRuleSet = props?.enableCommonRuleSet ?? true;
      if (enableCommonRuleSet) {
        rules.push({
          name: 'AWSManagedRulesCommonRuleSet',
          priority: priority++,
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
        });
      }

      // Rule 3: AWS Managed Rules SQLi Rule Set (if enabled)
      const enableSqliRuleSet = props?.enableSqliRuleSet ?? true;
      if (enableSqliRuleSet) {
        rules.push({
          name: 'AWSManagedRulesSQLiRuleSet',
          priority: priority++,
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
        });
      }

      // Add custom rules
      if (props?.customRules) {
        for (const customRule of props.customRules) {
          rules.push({
            name: customRule.name,
            priority: customRule.priority,
            action: customRule.action,
            overrideAction: customRule.overrideAction,
            statement: customRule.statement,
            visibilityConfig: customRule.visibilityConfig ?? {
              cloudWatchMetricsEnabled: true,
              metricName: `${customRule.name}Metric`,
              sampledRequestsEnabled: true,
            },
          });
        }
      }
    }

    // Create WAF WebACL with CLOUDFRONT scope
    this.webAcl = new CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'WebAclMetric',
        sampledRequestsEnabled: true,
      },
      rules,
    });

    // Set the WebACL ARN
    this.webAclArn = this.webAcl.attrArn;
  }
}
