import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as path from 'path';
import { ServerlessSpa } from './constructs/serverless-spa';

export class ServerlessSpaMainStack extends cdk.Stack {
  /**
   * The ServerlessSpa construct instance.
   */
  public readonly serverlessSpa: ServerlessSpa;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the ServerlessSpa construct with WAF security integration
    this.serverlessSpa = ServerlessSpa.withWaf(this, 'ServerlessSpa', {
      lambdaEntry: path.join(__dirname, '../lambda/handler.ts'),
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      ssmPrefix: '/serverless-spa/security/',
      securityRegion: 'us-east-1',
      advanced: {
        tags: {
          Project: 'ServerlessSpaTest',
          Environment: 'Development',
        },
      },
    });

    // Output useful values
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.serverlessSpa.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.serverlessSpa.apiUrl,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.serverlessSpa.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.serverlessSpa.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: this.serverlessSpa.tableName,
      description: 'DynamoDB table name',
    });
  }
}
