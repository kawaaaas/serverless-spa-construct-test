import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { WafConstruct } from '../../lib/constructs/waf-construct';

describe('WafConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    // WAF WebACL with CLOUDFRONT scope must be in us-east-1
    stack = new Stack(app, 'TestStack', {
      env: { region: 'us-east-1' },
    });
  });

  describe('WAF WebACL Creation', () => {
    test('creates WAF WebACL with CLOUDFRONT scope', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Scope: 'CLOUDFRONT',
      });
    });

    test('creates exactly one WAF WebACL', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::WAFv2::WebACL', 1);
    });

    test('sets default action to allow', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        DefaultAction: { Allow: {} },
      });
    });

    test('enables CloudWatch metrics', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        VisibilityConfig: {
          CloudWatchMetricsEnabled: true,
          SampledRequestsEnabled: true,
        },
      });
    });
  });

  describe('WAF Rules', () => {
    test('contains exactly 3 rules', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({ Name: 'RateLimitRule' }),
          Match.objectLike({ Name: 'AWSManagedRulesCommonRuleSet' }),
          Match.objectLike({ Name: 'AWSManagedRulesSQLiRuleSet' }),
        ]),
      });
    });

    test('contains rate limit rule with default value of 2000', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Priority: 1,
            Action: { Block: {} },
            Statement: {
              RateBasedStatement: {
                Limit: 2000,
                AggregateKeyType: 'IP',
              },
            },
          }),
        ]),
      });
    });

    test('contains AWSManagedRulesCommonRuleSet', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesCommonRuleSet',
            Priority: 2,
            OverrideAction: { None: {} },
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesCommonRuleSet',
              },
            },
          }),
        ]),
      });
    });

    test('contains AWSManagedRulesSQLiRuleSet', () => {
      new WafConstruct(stack, 'Waf');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'AWSManagedRulesSQLiRuleSet',
            Priority: 3,
            OverrideAction: { None: {} },
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesSQLiRuleSet',
              },
            },
          }),
        ]),
      });
    });
  });

  describe('Custom Rate Limit', () => {
    test('uses custom rateLimit value when provided', () => {
      new WafConstruct(stack, 'Waf', {
        rateLimit: 5000,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Statement: {
              RateBasedStatement: {
                Limit: 5000,
              },
            },
          }),
        ]),
      });
    });

    test('uses different custom rateLimit value', () => {
      new WafConstruct(stack, 'Waf', {
        rateLimit: 1000,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Statement: {
              RateBasedStatement: {
                Limit: 1000,
              },
            },
          }),
        ]),
      });
    });
  });

  describe('Output Properties', () => {
    test('exposes webAcl property', () => {
      const waf = new WafConstruct(stack, 'Waf');

      expect(waf.webAcl).toBeDefined();
    });

    test('exposes webAclArn property', () => {
      const waf = new WafConstruct(stack, 'Waf');

      expect(waf.webAclArn).toBeDefined();
    });
  });
});
