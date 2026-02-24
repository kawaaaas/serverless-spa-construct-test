import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { ServerlessSpaConstruct as ServerlessSpa } from '../../lib/constructs/serverless-spa';

// Test Lambda handler path
const TEST_LAMBDA_ENTRY = path.join(__dirname, '../../lambda/handler.ts');

// Test DynamoDB partition key
const TEST_PARTITION_KEY = { name: 'PK', type: AttributeType.STRING };

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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
    });

    test('creates Cognito User Pool with default props', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });

    test('creates Cognito User Pool Client with default props', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    });

    test('creates API Gateway REST API with default props', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    });

    test('creates Lambda function with default props', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      // 2 Lambda functions: API handler + S3 autoDeleteObjects custom resource
      template.resourceCountIs('AWS::Lambda::Function', 2);
    });

    test('creates S3 bucket with default props', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    test('creates CloudFront distribution with default props', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    test('creates all resources with minimal factory method', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::ApiGateway::Authorizer', 1);
      template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
      });
    });

    test('CloudFront has /api/* behavior', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

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
  });

  describe('Props Pass-through via advanced', () => {
    /**
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4
     */
    test('passes database props to DatabaseConstruct', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          database: {
            tableName: 'CustomTable',
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'CustomTable',
      });
    });

    test('passes auth props to AuthConstruct', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          auth: {
            userPoolProps: {
              userPoolName: 'CustomUserPool',
            },
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'CustomUserPool',
      });
    });

    test('passes api props to ApiConstruct', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          api: {
            lambdaProps: {
              memorySize: 256,
            },
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        MemorySize: 256,
      });
    });

    test('passes frontend props to FrontendConstruct', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          frontend: {
            distributionProps: {
              comment: 'Custom distribution comment',
            },
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
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.database).toBeDefined();
      expect(spa.database.table).toBeDefined();
    });

    test('exposes auth construct instance', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.auth).toBeDefined();
      expect(spa.auth.userPool).toBeDefined();
    });

    test('exposes api construct instance', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.api).toBeDefined();
      expect(spa.api.api).toBeDefined();
    });

    test('exposes frontend construct instance', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.frontend).toBeDefined();
      expect(spa.frontend.distribution).toBeDefined();
    });

    test('exposes distributionDomainName convenience property', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.distributionDomainName).toBeDefined();
      expect(typeof spa.distributionDomainName).toBe('string');
      expect(spa.distributionDomainName).toBe(spa.frontend.distributionDomainName);
    });

    test('exposes apiUrl convenience property', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.apiUrl).toBeDefined();
      expect(typeof spa.apiUrl).toBe('string');
      expect(spa.apiUrl).toBe(spa.api.apiUrl);
    });

    test('exposes userPoolId convenience property', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.userPoolId).toBeDefined();
      expect(typeof spa.userPoolId).toBe('string');
      expect(spa.userPoolId).toBe(spa.auth.userPoolId);
    });

    test('exposes userPoolClientId convenience property', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.userPoolClientId).toBeDefined();
      expect(typeof spa.userPoolClientId).toBe('string');
      expect(spa.userPoolClientId).toBe(spa.auth.userPoolClientId);
    });

    test('exposes tableName convenience property', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Delete',
      });
    });

    test('applies DESTROY by default to S3 bucket', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Delete',
      });
    });

    test('enables autoDeleteObjects by default', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      // autoDeleteObjects creates a custom resource for bucket cleanup
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 1);
    });

    test('applies custom RemovalPolicy.RETAIN to DynamoDB table', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          removalPolicy: RemovalPolicy.RETAIN,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
      });
    });

    test('applies custom RemovalPolicy.RETAIN to S3 bucket', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          removalPolicy: RemovalPolicy.RETAIN,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        DeletionPolicy: 'Retain',
      });
    });

    test('disables autoDeleteObjects when RemovalPolicy is RETAIN', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          removalPolicy: RemovalPolicy.RETAIN,
        },
      });

      const template = Template.fromStack(stack);
      // autoDeleteObjects should not create the custom resource
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 0);
    });

    test('disables autoDeleteObjects when RemovalPolicy is SNAPSHOT', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          removalPolicy: RemovalPolicy.SNAPSHOT,
        },
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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          tags: {
            Environment: 'test',
            Project: 'my-app',
          },
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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          tags: {
            Environment: 'test',
            Project: 'my-app',
          },
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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          tags: {
            Environment: 'test',
            Project: 'my-app',
          },
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
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          tags: {
            Environment: 'production',
            Project: 'my-app',
            Team: 'platform',
          },
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

describe('ServerlessSpa Factory Methods', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('minimal()', () => {
    test('creates all resources with only lambdaEntry', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
      template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
      template.resourceCountIs('AWS::S3::Bucket', 1);
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });

    test('does not create AwsCustomResource (no security)', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('Custom::AWS', 0);
    });

    test('CloudFront does not have WebACLId', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: Match.not(
          Match.objectLike({
            WebACLId: Match.anyValue(),
          })
        ),
      });
    });

    test('passes advanced options to constructs', () => {
      ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        advanced: {
          database: {
            tableName: 'CustomTable',
          },
          tags: {
            Environment: 'test',
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'CustomTable',
        Tags: Match.arrayWith([{ Key: 'Environment', Value: 'test' }]),
      });
    });

    test('returns ServerlessSpa instance with all properties', () => {
      const spa = ServerlessSpa.minimal(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
      });

      expect(spa.database).toBeDefined();
      expect(spa.auth).toBeDefined();
      expect(spa.api).toBeDefined();
      expect(spa.frontend).toBeDefined();
      expect(spa.distributionDomainName).toBeDefined();
      expect(spa.apiUrl).toBeDefined();
      expect(spa.userPoolId).toBeDefined();
      expect(spa.tableName).toBeDefined();
    });
  });

  describe('withCustomDomain()', () => {
    test('creates CloudFront with custom domain alias', () => {
      ServerlessSpa.withCustomDomain(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: Match.arrayWith(['www.example.com']),
        },
      });
    });

    test('creates ACM certificate', () => {
      ServerlessSpa.withCustomDomain(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CertificateManager::Certificate', 1);
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'www.example.com',
      });
    });

    test('creates Route53 A record', () => {
      ServerlessSpa.withCustomDomain(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Route53::RecordSet', 1);
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'www.example.com.',
        Type: 'A',
      });
    });

    test('supports alternative domain names', () => {
      ServerlessSpa.withCustomDomain(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        alternativeDomainNames: ['example.com'],
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: Match.arrayWith(['www.example.com', 'example.com']),
        },
      });
    });

    test('does not create AwsCustomResource (no security)', () => {
      ServerlessSpa.withCustomDomain(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('Custom::AWS', 0);
    });

    test('passes advanced options to constructs', () => {
      ServerlessSpa.withCustomDomain(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        advanced: {
          removalPolicy: RemovalPolicy.RETAIN,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
      });
    });
  });

  describe('withWaf()', () => {
    test('creates AwsCustomResource for SSM parameter retrieval', () => {
      ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('Custom::AWS', 1);
    });

    test('retrieves SSM parameters with specified prefix', () => {
      ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/custom/prefix/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::AWS', {
        Create: Match.stringLikeRegexp('/custom/prefix/waf-acl-arn'),
      });
    });

    test('uses us-east-1 region by default', () => {
      ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::AWS', {
        Create: Match.stringLikeRegexp('"region":"us-east-1"'),
      });
    });

    test('uses custom securityRegion when specified', () => {
      ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/myapp/security/',
        securityRegion: 'eu-west-1',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::AWS', {
        Create: Match.stringLikeRegexp('"region":"eu-west-1"'),
      });
    });

    test('CloudFront has WebACLId', () => {
      ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          WebACLId: Match.anyValue(),
        },
      });
    });

    test('Lambda has Secrets Manager permissions', () => {
      ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('passes advanced options to constructs', () => {
      ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/myapp/security/',
        advanced: {
          auth: {
            userPoolProps: {
              userPoolName: 'CustomPool',
            },
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'CustomPool',
      });
    });

    test('exposes security properties', () => {
      const spa = ServerlessSpa.withWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        ssmPrefix: '/myapp/security/',
      });

      expect(spa.ssmParameterReader).toBeDefined();
      expect(spa.webAclArn).toBeDefined();
      expect(spa.secretArn).toBeDefined();
      expect(spa.securityCustomHeaderName).toBeDefined();
    });
  });

  describe('withCustomDomainAndWaf()', () => {
    test('creates CloudFront with custom domain and WAF', () => {
      ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);

      // Custom domain
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: Match.arrayWith(['www.example.com']),
          WebACLId: Match.anyValue(),
        },
      });

      // ACM certificate
      template.resourceCountIs('AWS::CertificateManager::Certificate', 1);

      // SSM parameter retrieval
      template.resourceCountIs('Custom::AWS', 1);
    });

    test('creates Route53 record and ACM certificate', () => {
      ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Route53::RecordSet', 1);
      template.hasResourceProperties('AWS::CertificateManager::Certificate', {
        DomainName: 'www.example.com',
      });
    });

    test('supports alternative domain names', () => {
      ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
        alternativeDomainNames: ['example.com', 'api.example.com'],
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: Match.arrayWith(['www.example.com', 'example.com', 'api.example.com']),
        },
      });
    });

    test('uses custom securityRegion', () => {
      ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
        securityRegion: 'eu-west-1',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::AWS', {
        Create: Match.stringLikeRegexp('"region":"eu-west-1"'),
      });
    });

    test('Lambda has Secrets Manager permissions', () => {
      ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('passes advanced options to constructs', () => {
      ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
        advanced: {
          database: {
            tableName: 'FullFeaturedTable',
          },
          tags: {
            Environment: 'production',
          },
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'FullFeaturedTable',
        Tags: Match.arrayWith([{ Key: 'Environment', Value: 'production' }]),
      });
    });

    test('returns ServerlessSpa instance with security properties', () => {
      const spa = ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
      });

      expect(spa.ssmParameterReader).toBeDefined();
      expect(spa.webAclArn).toBeDefined();
      expect(spa.secretArn).toBeDefined();
      expect(spa.securityCustomHeaderName).toBeDefined();
    });

    /**
     * Validates: Requirements 6.3
     */
    test('retrieves edge-function-version-arn from SSM parameters', () => {
      ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::AWS', {
        Create: Match.stringLikeRegexp('/myapp/security/edge-function-version-arn'),
      });
    });

    test('exposes edgeFunctionVersionArn property', () => {
      const spa = ServerlessSpa.withCustomDomainAndWaf(stack, 'App', {
        lambdaEntry: TEST_LAMBDA_ENTRY,
        partitionKey: TEST_PARTITION_KEY,
        domainName: 'www.example.com',
        hostedZoneId: 'Z1234567890ABC',
        zoneName: 'example.com',
        ssmPrefix: '/myapp/security/',
      });

      expect(spa.edgeFunctionVersionArn).toBeDefined();
    });
  });
});

describe('ServerlessSpa Lambda@Edge Integration', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  /**
   * Validates: Requirements 6.3
   */
  test('withWaf retrieves edge-function-version-arn from SSM', () => {
    ServerlessSpa.withWaf(stack, 'App', {
      lambdaEntry: TEST_LAMBDA_ENTRY,
      partitionKey: TEST_PARTITION_KEY,
      ssmPrefix: '/myapp/security/',
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('Custom::AWS', {
      Create: Match.stringLikeRegexp('/myapp/security/edge-function-version-arn'),
    });
  });

  test('withWaf exposes edgeFunctionVersionArn property', () => {
    const spa = ServerlessSpa.withWaf(stack, 'App', {
      lambdaEntry: TEST_LAMBDA_ENTRY,
      partitionKey: TEST_PARTITION_KEY,
      ssmPrefix: '/myapp/security/',
    });

    expect(spa.edgeFunctionVersionArn).toBeDefined();
  });
});
