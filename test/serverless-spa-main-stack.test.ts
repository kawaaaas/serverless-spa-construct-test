import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib/core';
import { ServerlessSpaMainStack } from '../lib/serverless-spa-main-stack';

describe('ServerlessSpaMainStack', () => {
  test('creates ServerlessSpa construct with all resources', () => {
    const app = new cdk.App();
    const stack = new ServerlessSpaMainStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // Verify DynamoDB table is created
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
    });

    // Verify Cognito User Pool is created
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
    });

    // Verify Lambda function is created
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
    });

    // Verify API Gateway is created
    template.hasResource('AWS::ApiGateway::RestApi', {});

    // Verify S3 bucket is created
    template.hasResource('AWS::S3::Bucket', {});

    // Verify CloudFront distribution is created
    template.hasResource('AWS::CloudFront::Distribution', {});
  });

  test('creates CfnOutputs', () => {
    const app = new cdk.App();
    const stack = new ServerlessSpaMainStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // Verify outputs are created
    template.hasOutput('DistributionDomainName', {});
    template.hasOutput('ApiUrl', {});
    template.hasOutput('UserPoolId', {});
    template.hasOutput('UserPoolClientId', {});
    template.hasOutput('TableName', {});
  });
});
