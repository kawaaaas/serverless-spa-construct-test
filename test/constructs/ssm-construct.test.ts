import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { SsmConstruct } from '../../lib/constructs/ssm-construct';

describe('SsmConstruct', () => {
  let app: App;
  let stack: Stack;

  const defaultProps = {
    webAclArn: 'arn:aws:wafv2:us-east-1:123456789012:global/webacl/test-acl/12345678',
    customHeaderName: 'x-origin-verify',
    secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret-abc123',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { region: 'us-east-1' },
    });
  });

  describe('SSM Parameter Creation', () => {
    test('creates exactly 3 SSM Parameters', () => {
      new SsmConstruct(stack, 'Ssm', defaultProps);

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::SSM::Parameter', 3);
    });

    test('creates waf-acl-arn parameter with correct value', () => {
      new SsmConstruct(stack, 'Ssm', defaultProps);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/myapp/security/waf-acl-arn',
        Value: defaultProps.webAclArn,
        Type: 'String',
      });
    });

    test('creates custom-header-name parameter with correct value', () => {
      new SsmConstruct(stack, 'Ssm', defaultProps);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/myapp/security/custom-header-name',
        Value: defaultProps.customHeaderName,
        Type: 'String',
      });
    });

    test('creates secret-arn parameter with correct value', () => {
      new SsmConstruct(stack, 'Ssm', defaultProps);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/myapp/security/secret-arn',
        Value: defaultProps.secretArn,
        Type: 'String',
      });
    });
  });

  describe('Custom SSM Prefix', () => {
    test('uses custom ssmPrefix when provided', () => {
      new SsmConstruct(stack, 'Ssm', {
        ...defaultProps,
        ssmPrefix: '/custom/prefix/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/custom/prefix/waf-acl-arn',
      });
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/custom/prefix/custom-header-name',
      });
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/custom/prefix/secret-arn',
      });
    });

    test('uses default ssmPrefix when not provided', () => {
      new SsmConstruct(stack, 'Ssm', defaultProps);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/myapp/security/waf-acl-arn',
      });
    });
  });

  describe('Output Properties', () => {
    test('exposes wafAclArnParameter property', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', defaultProps);

      expect(ssm.wafAclArnParameter).toBeDefined();
    });

    test('exposes customHeaderNameParameter property', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', defaultProps);

      expect(ssm.customHeaderNameParameter).toBeDefined();
    });

    test('exposes secretArnParameter property', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', defaultProps);

      expect(ssm.secretArnParameter).toBeDefined();
    });

    test('exposes ssmPrefix property with default value', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', defaultProps);

      expect(ssm.ssmPrefix).toBe('/myapp/security/');
    });

    test('exposes ssmPrefix property with custom value', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', {
        ...defaultProps,
        ssmPrefix: '/custom/prefix/',
      });

      expect(ssm.ssmPrefix).toBe('/custom/prefix/');
    });
  });
});
