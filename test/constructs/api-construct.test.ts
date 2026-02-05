import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ApiConstruct } from '../../lib/constructs/api-construct';

describe('ApiConstruct', () => {
  let app: App;
  let stack: Stack;
  let table: Table;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
    table = new Table(stack, 'TestTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
  });

  describe('REST API', () => {
    test('creates REST API resource', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    });

    test('creates REST API with resource policy', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Policy: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Effect: 'Deny',
              Action: 'execute-api:Invoke',
              Condition: Match.anyValue(),
            }),
            Match.objectLike({
              Effect: 'Allow',
              Action: 'execute-api:Invoke',
            }),
          ]),
        }),
      });
    });

    test('enables CORS by default', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      // CORS is enabled via OPTIONS method on resources
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS',
      });
    });
  });

  describe('Lambda Function', () => {
    test('creates Lambda function', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Lambda::Function', 1);
    });

    test('uses Node.js 20.x runtime', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
      });
    });

    test('sets default memory size to 128MB', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 128,
      });
    });

    test('sets default timeout to 30 seconds', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 30,
      });
    });

    test('sets TABLE_NAME environment variable', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            TABLE_NAME: Match.anyValue(),
          },
        },
      });
    });

    test('grants Lambda read/write access to DynamoDB table', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
                'dynamodb:BatchWriteItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('API Gateway Integration', () => {
    test('creates proxy resource {proxy+}', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: '{proxy+}',
      });
    });

    test('creates ANY method on root path', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'ANY',
        Integration: {
          Type: 'AWS_PROXY',
        },
      });
    });

    test('creates ANY method on proxy resource', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      // Count ANY methods - should have at least 2 (root and proxy)
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'ANY',
        },
      });
      expect(Object.keys(methods).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Cognito Authorizer', () => {
    test('creates Cognito Authorizer when userPool is provided', () => {
      const userPool = new UserPool(stack, 'UserPool');
      new ApiConstruct(stack, 'Api', { table, userPool });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
      template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
      });
    });

    test('does not create Authorizer when userPool is not provided', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::Authorizer', 0);
    });

    test('applies Cognito Authorizer to methods when userPool is provided', () => {
      const userPool = new UserPool(stack, 'UserPool');
      new ApiConstruct(stack, 'Api', { table, userPool });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'ANY',
        AuthorizationType: 'COGNITO_USER_POOLS',
      });
    });
  });

  describe('Custom Header', () => {
    test('uses default custom header name', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.customHeaderName).toBe('x-origin-verify');
    });

    test('uses custom header name when provided', () => {
      const api = new ApiConstruct(stack, 'Api', {
        table,
        customHeaderName: 'x-custom-header',
      });

      expect(api.customHeaderName).toBe('x-custom-header');
    });

    test('generates custom header secret when not provided', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.customHeaderSecret).toBeDefined();
      expect(typeof api.customHeaderSecret).toBe('string');
      expect(api.customHeaderSecret.length).toBeGreaterThan(0);
    });

    test('uses custom header secret when provided', () => {
      const api = new ApiConstruct(stack, 'Api', {
        table,
        customHeaderSecret: 'my-secret-value',
      });

      expect(api.customHeaderSecret).toBe('my-secret-value');
    });
  });

  describe('Props Override', () => {
    test('overrides Lambda props', () => {
      new ApiConstruct(stack, 'Api', {
        table,
        lambdaProps: {
          memorySize: 256,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 256,
      });
    });

    test('overrides REST API props', () => {
      new ApiConstruct(stack, 'Api', {
        table,
        restApiProps: {
          description: 'Custom API description',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Description: 'Custom API description',
      });
    });
  });

  describe('Output Properties', () => {
    test('exposes api property', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.api).toBeDefined();
    });

    test('exposes handler property', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.handler).toBeDefined();
    });

    test('exposes apiUrl property', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.apiUrl).toBeDefined();
      expect(typeof api.apiUrl).toBe('string');
    });

    test('exposes customHeaderName property', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.customHeaderName).toBeDefined();
      expect(typeof api.customHeaderName).toBe('string');
    });

    test('exposes customHeaderSecret property', () => {
      const api = new ApiConstruct(stack, 'Api', { table });

      expect(api.customHeaderSecret).toBeDefined();
      expect(typeof api.customHeaderSecret).toBe('string');
    });
  });

  describe('Secrets Manager Integration', () => {
    test('grants Lambda Secrets Manager read permission when secretArn is provided', () => {
      new ApiConstruct(stack, 'Api', {
        table,
        secretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123',
      });

      const template = Template.fromStack(stack);
      // CDK creates separate policies for different grants
      // Check that there's a policy with Secrets Manager permissions
      const policies = template.findResources('AWS::IAM::Policy');
      let hasSecretsManagerPermission = false;

      for (const policyKey of Object.keys(policies)) {
        const policy = policies[policyKey];
        const statements = policy.Properties?.PolicyDocument?.Statement || [];
        for (const statement of statements) {
          if (Array.isArray(statement.Action)) {
            if (
              statement.Action.includes('secretsmanager:GetSecretValue') &&
              statement.Action.includes('secretsmanager:DescribeSecret')
            ) {
              hasSecretsManagerPermission = true;
              // Verify the resource is the correct secret ARN
              expect(statement.Resource).toBe(
                'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123'
              );
              expect(statement.Effect).toBe('Allow');
            }
          }
        }
      }

      expect(hasSecretsManagerPermission).toBe(true);
    });

    test('does not grant Secrets Manager permission when secretArn is not provided', () => {
      new ApiConstruct(stack, 'Api', { table });

      const template = Template.fromStack(stack);
      const policies = template.findResources('AWS::IAM::Policy');

      // Check that no policy contains secretsmanager:GetSecretValue action
      for (const policyKey of Object.keys(policies)) {
        const policy = policies[policyKey];
        const statements = policy.Properties?.PolicyDocument?.Statement || [];
        for (const statement of statements) {
          if (Array.isArray(statement.Action)) {
            expect(statement.Action).not.toContain('secretsmanager:GetSecretValue');
          } else {
            expect(statement.Action).not.toBe('secretsmanager:GetSecretValue');
          }
        }
      }
    });
  });
});
