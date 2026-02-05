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
  }
}
