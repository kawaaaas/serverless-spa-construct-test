import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as path from 'path';
import { ServerlessSpaConstruct } from './constructs/serverless-spa';

export class ServerlessSpaMainStack extends cdk.Stack {
  /**
   * The ServerlessSpaConstruct instance.
   */
  public readonly serverlessSpa: ServerlessSpaConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the ServerlessSpaConstruct with custom domain and WAF security integration
    this.serverlessSpa = ServerlessSpaConstruct.withCustomDomainAndWaf(this, 'ServerlessSpa', {
      lambdaEntry: path.join(__dirname, '../lambda/handler.ts'),
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      domainName: 'www.kawaaaas.com',
      alternativeDomainNames: ['kawaaaas.com'],
      hostedZoneId: 'Z05304943LWOKTQXC7P8D',
      zoneName: 'kawaaaas.com',
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
