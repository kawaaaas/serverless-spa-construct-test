import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ServerlessSpaSecurityConstruct } from '../../lib/constructs/serverless-spa-security-construct';

describe('ServerlessSpaSecurityConstruct', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  describe('Region Validation', () => {
    test('throws error when deployed in ap-northeast-1', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'ap-northeast-1' },
      });

      expect(() => {
        new ServerlessSpaSecurityConstruct(stack, 'Security');
      }).toThrow(/must be deployed in us-east-1/);
    });

    test('throws error when deployed in eu-west-1', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'eu-west-1' },
      });

      expect(() => {
        new ServerlessSpaSecurityConstruct(stack, 'Security');
      }).toThrow(/must be deployed in us-east-1/);
    });

    test('does not throw error when deployed in us-east-1', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1' },
      });

      expect(() => {
        new ServerlessSpaSecurityConstruct(stack, 'Security');
      }).not.toThrow();
    });

    test('does not throw error when region is unresolved token', () => {
      // Stack without explicit region (region will be a token)
      const stack = new Stack(app, 'TestStack');

      expect(() => {
        new ServerlessSpaSecurityConstruct(stack, 'Security');
      }).not.toThrow();
    });
  });

  describe('Output Properties', () => {
    let stack: Stack;

    beforeEach(() => {
      stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1' },
      });
    });

    test('exposes webAclArn property', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.webAclArn).toBeDefined();
    });

    test('exposes secretArn property', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.secretArn).toBeDefined();
    });

    test('exposes customHeaderName property with default value', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.customHeaderName).toBe('x-origin-verify');
    });

    test('exposes customHeaderName property with custom value', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security', {
        secret: { customHeaderName: 'x-custom-header' },
      });

      expect(security.customHeaderName).toBe('x-custom-header');
    });

    test('exposes ssmPrefix property with default value', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.ssmPrefix).toBe('/myapp/security/');
    });

    test('exposes ssmPrefix property with custom value', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security', {
        ssm: { ssmPrefix: '/custom/prefix/' },
      });

      expect(security.ssmPrefix).toBe('/custom/prefix/');
    });
  });

  describe('Low-level Construct Integration', () => {
    let stack: Stack;
    let template: Template;

    beforeEach(() => {
      stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1' },
      });
      new ServerlessSpaSecurityConstruct(stack, 'Security');
      template = Template.fromStack(stack);
    });

    test('creates WAF WebACL resource', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Scope: 'CLOUDFRONT',
      });
    });

    test('creates Secrets Manager secret', () => {
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Description: 'Custom header value for x-origin-verify',
      });
    });

    test('creates rotation Lambda function', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
      });
    });

    test('creates three SSM parameters', () => {
      template.resourceCountIs('AWS::SSM::Parameter', 3);
    });
  });

  describe('Props Transparent Forwarding', () => {
    let stack: Stack;

    beforeEach(() => {
      stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1' },
      });
    });

    test('forwards rateLimit to WafConstruct', () => {
      new ServerlessSpaSecurityConstruct(stack, 'Security', {
        waf: { rateLimit: 5000 },
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: [
          {
            Name: 'RateLimitRule',
            Statement: {
              RateBasedStatement: {
                Limit: 5000,
              },
            },
          },
          {},
          {},
        ],
      });
    });

    test('forwards rotationDays to SecretConstruct', () => {
      new ServerlessSpaSecurityConstruct(stack, 'Security', {
        secret: { rotationDays: 14 },
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
        RotationRules: {
          ScheduleExpression: 'rate(14 days)',
        },
      });
    });

    test('forwards ssmPrefix to SsmConstruct', () => {
      new ServerlessSpaSecurityConstruct(stack, 'Security', {
        ssm: { ssmPrefix: '/custom/prefix/' },
      });
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/custom/prefix/waf-acl-arn',
      });
    });
  });

  describe('Convenience Properties', () => {
    let stack: Stack;

    beforeEach(() => {
      stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1' },
      });
    });

    test('webAclArn matches waf.webAclArn', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.webAclArn).toBe(security.waf.webAclArn);
    });

    test('secretArn matches secret.secretArn', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.secretArn).toBe(security.secret.secretArn);
    });

    test('customHeaderName matches secret.customHeaderName', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.customHeaderName).toBe(security.secret.customHeaderName);
    });

    test('ssmPrefix matches ssm.ssmPrefix', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.ssmPrefix).toBe(security.ssm.ssmPrefix);
    });

    test('exposes waf construct instance', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.waf).toBeDefined();
      expect(security.waf.webAcl).toBeDefined();
    });

    test('exposes secret construct instance', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.secret).toBeDefined();
      expect(security.secret.secret).toBeDefined();
    });

    test('exposes ssm construct instance', () => {
      const security = new ServerlessSpaSecurityConstruct(stack, 'Security');

      expect(security.ssm).toBeDefined();
      expect(security.ssm.wafAclArnParameter).toBeDefined();
    });
  });
});
