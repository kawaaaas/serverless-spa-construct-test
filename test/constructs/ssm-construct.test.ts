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

  const propsWithEdgeFunction = {
    ...defaultProps,
    edgeFunctionVersionArn: 'arn:aws:lambda:us-east-1:123456789012:function:edge-function:1',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { region: 'us-east-1' },
    });
  });

  describe('SSM Parameter Creation', () => {
    test('creates exactly 3 SSM Parameters without edge function', () => {
      new SsmConstruct(stack, 'Ssm', defaultProps);

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::SSM::Parameter', 3);
    });

    test('creates exactly 4 SSM Parameters with edge function', () => {
      new SsmConstruct(stack, 'Ssm', propsWithEdgeFunction);

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::SSM::Parameter', 4);
    });

    test('creates exactly 4 SSM Parameters with certificate ARN', () => {
      new SsmConstruct(stack, 'Ssm', {
        ...defaultProps,
        certificateArn:
          'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::SSM::Parameter', 4);
    });

    test('creates certificate-arn parameter with correct value', () => {
      const certArn =
        'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012';
      new SsmConstruct(stack, 'Ssm', {
        ...defaultProps,
        certificateArn: certArn,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/myapp/security/certificate-arn',
        Value: certArn,
        Type: 'String',
        Description: 'ACM certificate ARN for CloudFront custom domain',
      });
    });

    test('does not create certificate-arn parameter when certificateArn is not provided', () => {
      new SsmConstruct(stack, 'Ssm', defaultProps);

      const template = Template.fromStack(stack);
      const params = template.findResources('AWS::SSM::Parameter');
      const paramNames = Object.values(params).map((p) => p.Properties.Name);
      expect(paramNames).not.toContain('/myapp/security/certificate-arn');
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

    test('creates edge-function-version-arn parameter with correct value', () => {
      new SsmConstruct(stack, 'Ssm', propsWithEdgeFunction);

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/myapp/security/edge-function-version-arn',
        Value: propsWithEdgeFunction.edgeFunctionVersionArn,
        Type: 'String',
        Description: 'Lambda@Edge function version ARN for CloudFront origin request',
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

    test('uses custom ssmPrefix for edge function version ARN', () => {
      new SsmConstruct(stack, 'Ssm', {
        ...propsWithEdgeFunction,
        ssmPrefix: '/custom/prefix/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/custom/prefix/edge-function-version-arn',
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

    test('exposes edgeFunctionVersionArnParameter property when provided', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', propsWithEdgeFunction);

      expect(ssm.edgeFunctionVersionArnParameter).toBeDefined();
    });

    test('edgeFunctionVersionArnParameter is undefined when not provided', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', defaultProps);

      expect(ssm.edgeFunctionVersionArnParameter).toBeUndefined();
    });

    test('exposes certificateArnParameter property when provided', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', {
        ...defaultProps,
        certificateArn:
          'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
      });

      expect(ssm.certificateArnParameter).toBeDefined();
    });

    test('certificateArnParameter is undefined when not provided', () => {
      const ssm = new SsmConstruct(stack, 'Ssm', defaultProps);

      expect(ssm.certificateArnParameter).toBeUndefined();
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
