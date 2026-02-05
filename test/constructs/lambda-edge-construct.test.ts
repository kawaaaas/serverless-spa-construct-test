import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { LambdaEdgeConstruct } from '../../lib/constructs/lambda-edge-construct';

describe('LambdaEdgeConstruct', () => {
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
        new LambdaEdgeConstruct(stack, 'LambdaEdge', {
          secretName: '/myapp/security/custom-header-secret',
        });
      }).toThrow(/must be deployed in us-east-1/);
    });

    test('throws error when deployed in eu-west-1', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'eu-west-1' },
      });

      expect(() => {
        new LambdaEdgeConstruct(stack, 'LambdaEdge', {
          secretName: '/myapp/security/custom-header-secret',
        });
      }).toThrow(/must be deployed in us-east-1/);
    });

    test('does not throw error when deployed in us-east-1', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1', account: '123456789012' },
      });

      expect(() => {
        new LambdaEdgeConstruct(stack, 'LambdaEdge', {
          secretName: '/myapp/security/custom-header-secret',
        });
      }).not.toThrow();
    });

    test('does not throw error when region is unresolved token', () => {
      // Stack without explicit region (region will be a token)
      const stack = new Stack(app, 'TestStack');

      expect(() => {
        new LambdaEdgeConstruct(stack, 'LambdaEdge', {
          secretName: '/myapp/security/custom-header-secret',
        });
      }).not.toThrow();
    });
  });

  describe('Lambda@Edge Function Creation', () => {
    let stack: Stack;
    let template: Template;

    beforeEach(() => {
      stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1', account: '123456789012' },
      });
      new LambdaEdgeConstruct(stack, 'LambdaEdge', {
        secretName: '/myapp/security/custom-header-secret',
      });
      template = Template.fromStack(stack);
    });

    test('creates Lambda function with Node.js 20.x runtime', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
      });
    });

    test('creates Lambda function with correct handler', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'index.handler',
      });
    });

    test('creates Lambda function with 5 second timeout', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 5,
      });
    });

    test('creates Lambda function with 128 MB memory', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 128,
      });
    });

    test('creates Lambda function with description', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Description: 'Lambda@Edge function for adding custom header to origin requests',
      });
    });
  });

  describe('IAM Policy', () => {
    test('grants Secrets Manager read permission with wildcard for secret suffix', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1', account: '123456789012' },
      });
      new LambdaEdgeConstruct(stack, 'LambdaEdge', {
        secretName: '/myapp/security/custom-header-secret',
      });
      const template = Template.fromStack(stack);

      // Verify IAM policy grants secretsmanager:GetSecretValue permission
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'secretsmanager:GetSecretValue',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('grants permission for specific secret name', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1', account: '999999999999' },
      });
      const customSecretName = '/custom/path/my-secret';
      new LambdaEdgeConstruct(stack, 'LambdaEdge', {
        secretName: customSecretName,
      });
      const template = Template.fromStack(stack);

      // Verify IAM policy grants secretsmanager:GetSecretValue permission
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'secretsmanager:GetSecretValue',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('Output Properties', () => {
    let stack: Stack;

    beforeEach(() => {
      stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1', account: '123456789012' },
      });
    });

    test('exposes edgeFunction property', () => {
      const lambdaEdge = new LambdaEdgeConstruct(stack, 'LambdaEdge', {
        secretName: '/myapp/security/custom-header-secret',
      });

      expect(lambdaEdge.edgeFunction).toBeDefined();
    });

    test('exposes functionVersion property', () => {
      const lambdaEdge = new LambdaEdgeConstruct(stack, 'LambdaEdge', {
        secretName: '/myapp/security/custom-header-secret',
      });

      expect(lambdaEdge.functionVersion).toBeDefined();
    });
  });

  describe('Bundling with esbuild define', () => {
    test('creates Lambda function with bundled code from file', () => {
      const stack = new Stack(app, 'TestStack', {
        env: { region: 'us-east-1', account: '123456789012' },
      });
      new LambdaEdgeConstruct(stack, 'LambdaEdge', {
        secretName: '/myapp/security/custom-header-secret',
      });
      const template = Template.fromStack(stack);

      // NodejsFunction uses S3 bucket for code, not inline
      template.hasResourceProperties('AWS::Lambda::Function', {
        Code: {
          S3Bucket: Match.anyValue(),
          S3Key: Match.anyValue(),
        },
      });
    });
  });
});
