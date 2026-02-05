import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ServerlessSpa } from '../../lib/constructs/serverless-spa';

describe('ServerlessSpa', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('All Constructs Creation', () => {
    /**
     * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 6.1
     */
    test('creates DynamoDB table with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
    });

    test('creates Cognito User Pool with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });

    test('creates Cognito User Pool Client with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    });

    test('creates API Gateway REST API with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    });

    test('creates Lambda function with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      // 2 Lambda functions: API handler + S3 autoDeleteObjects custom resource
      template.resourceCountIs('AWS::Lambda::Function', 2);
    });

    test('creates S3 bucket with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    test('creates CloudFront distribution with default props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    test('creates all resources without any props', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);

      // DynamoDB
      template.resourceCountIs('AWS::DynamoDB::Table', 1);

      // Cognito
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);

      // API Gateway + Lambda
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
      // 2 Lambda functions: API handler + S3 autoDeleteObjects custom resource
      template.resourceCountIs('AWS::Lambda::Function', 2);

      // S3 + CloudFront
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });
  });

  describe('Auto-wiring', () => {
    /**
     * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
     */
    test('Lambda has DynamoDB read/write permissions', () => {
      new ServerlessSpa(stack, 'App');

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

    test('Lambda has TABLE_NAME environment variable', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            TABLE_NAME: Match.anyValue(),
          },
        },
      });
    });

    test('creates Cognito Authorizer', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
      template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
      });
    });

    test('CloudFront has /api/* behavior', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          CacheBehaviors: Match.arrayWith([
            Match.objectLike({
              PathPattern: '/api/*',
            }),
          ]),
        },
      });
    });

    test('CloudFront sets custom header on API Gateway origin', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Origins: Match.arrayWith([
            Match.objectLike({
              CustomOriginConfig: Match.anyValue(),
              OriginCustomHeaders: Match.arrayWith([
                Match.objectLike({
                  HeaderName: 'x-origin-verify',
                }),
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('Props Pass-through', () => {
    /**
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4
     */
    test('passes database props to DatabaseConstruct', () => {
      new ServerlessSpa(stack, 'App', {
        database: {
          tableName: 'CustomTable',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'CustomTable',
      });
    });

    test('passes auth props to AuthConstruct', () => {
      new ServerlessSpa(stack, 'App', {
        auth: {
          userPoolProps: {
            userPoolName: 'CustomUserPool',
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'CustomUserPool',
      });
    });

    test('passes api props to ApiConstruct', () => {
      new ServerlessSpa(stack, 'App', {
        api: {
          lambdaProps: {
            memorySize: 256,
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 256,
      });
    });

    test('passes frontend props to FrontendConstruct', () => {
      new ServerlessSpa(stack, 'App', {
        frontend: {
          distributionProps: {
            comment: 'Custom distribution comment',
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Comment: 'Custom distribution comment',
        },
      });
    });
  });

  describe('Output Properties', () => {
    /**
     * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5
     */
    test('exposes database construct instance', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.database).toBeDefined();
      expect(spa.database.table).toBeDefined();
    });

    test('exposes auth construct instance', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.auth).toBeDefined();
      expect(spa.auth.userPool).toBeDefined();
    });

    test('exposes api construct instance', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.api).toBeDefined();
      expect(spa.api.api).toBeDefined();
    });

    test('exposes frontend construct instance', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.frontend).toBeDefined();
      expect(spa.frontend.distribution).toBeDefined();
    });

    test('exposes distributionDomainName convenience property', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.distributionDomainName).toBeDefined();
      expect(typeof spa.distributionDomainName).toBe('string');
      expect(spa.distributionDomainName).toBe(spa.frontend.distributionDomainName);
    });

    test('exposes apiUrl convenience property', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.apiUrl).toBeDefined();
      expect(typeof spa.apiUrl).toBe('string');
      expect(spa.apiUrl).toBe(spa.api.apiUrl);
    });

    test('exposes userPoolId convenience property', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.userPoolId).toBeDefined();
      expect(typeof spa.userPoolId).toBe('string');
      expect(spa.userPoolId).toBe(spa.auth.userPoolId);
    });

    test('exposes userPoolClientId convenience property', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.userPoolClientId).toBeDefined();
      expect(typeof spa.userPoolClientId).toBe('string');
      expect(spa.userPoolClientId).toBe(spa.auth.userPoolClientId);
    });

    test('exposes tableName convenience property', () => {
      const spa = new ServerlessSpa(stack, 'App');

      expect(spa.tableName).toBeDefined();
      expect(typeof spa.tableName).toBe('string');
      expect(spa.tableName).toBe(spa.database.tableName);
    });
  });

  describe('RemovalPolicy', () => {
    /**
     * Validates: Requirements 7.1, 7.2, 7.3, 7.4
     */
    test('applies DESTROY by default to DynamoDB table', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Delete',
      });
    });

    test('applies DESTROY by default to S3 bucket', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Delete',
      });
    });

    test('enables autoDeleteObjects by default', () => {
      new ServerlessSpa(stack, 'App');

      const template = Template.fromStack(stack);
      // autoDeleteObjects creates a custom resource for bucket cleanup
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 1);
    });

    test('applies custom RemovalPolicy.RETAIN to DynamoDB table', () => {
      new ServerlessSpa(stack, 'App', {
        removalPolicy: RemovalPolicy.RETAIN,
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
      });
    });

    test('applies custom RemovalPolicy.RETAIN to S3 bucket', () => {
      new ServerlessSpa(stack, 'App', {
        removalPolicy: RemovalPolicy.RETAIN,
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Retain',
      });
    });

    test('disables autoDeleteObjects when RemovalPolicy is RETAIN', () => {
      new ServerlessSpa(stack, 'App', {
        removalPolicy: RemovalPolicy.RETAIN,
      });

      const template = Template.fromStack(stack);
      // autoDeleteObjects should not create the custom resource
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 0);
    });

    test('disables autoDeleteObjects when RemovalPolicy is SNAPSHOT', () => {
      new ServerlessSpa(stack, 'App', {
        removalPolicy: RemovalPolicy.SNAPSHOT,
      });

      const template = Template.fromStack(stack);
      // autoDeleteObjects should not create the custom resource
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 0);
    });
  });

  describe('Tags', () => {
    /**
     * Validates: Requirements 8.1, 8.3
     */
    test('applies tags to DynamoDB table', () => {
      new ServerlessSpa(stack, 'App', {
        tags: {
          Environment: 'test',
          Project: 'my-app',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'test' },
          { Key: 'Project', Value: 'my-app' },
        ]),
      });
    });

    test('applies tags to S3 bucket', () => {
      new ServerlessSpa(stack, 'App', {
        tags: {
          Environment: 'test',
          Project: 'my-app',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'test' },
          { Key: 'Project', Value: 'my-app' },
        ]),
      });
    });

    test('applies tags to Lambda function', () => {
      new ServerlessSpa(stack, 'App', {
        tags: {
          Environment: 'test',
          Project: 'my-app',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'test' },
          { Key: 'Project', Value: 'my-app' },
        ]),
      });
    });

    test('applies multiple tags to all resources', () => {
      new ServerlessSpa(stack, 'App', {
        tags: {
          Environment: 'production',
          Project: 'my-app',
          Team: 'platform',
        },
      });

      const template = Template.fromStack(stack);

      // Verify tags on DynamoDB
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'production' },
          { Key: 'Project', Value: 'my-app' },
          { Key: 'Team', Value: 'platform' },
        ]),
      });

      // Verify tags on S3
      template.hasResourceProperties('AWS::S3::Bucket', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'production' },
          { Key: 'Project', Value: 'my-app' },
          { Key: 'Team', Value: 'platform' },
        ]),
      });
    });
  });
});
