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

    const domainName = process.env.DOMAIN_NAME;
    const hostedZoneId = process.env.HOSTED_ZONE_ID;
    const zoneName = process.env.ZONE_NAME;
    const ssmPrefix = process.env.SSM_PREFIX ?? '/serverless-spa/security/';
    const alternativeDomainNames = process.env.ALTERNATIVE_DOMAIN_NAMES?.split(',').map((s) =>
      s.trim()
    );

    if (!domainName || !hostedZoneId || !zoneName) {
      throw new Error(
        'Required environment variables are missing: DOMAIN_NAME, HOSTED_ZONE_ID, ZONE_NAME. ' +
          'Copy .env.example to .env and fill in your values.'
      );
    }

    // Create the ServerlessSpaConstruct with custom domain and WAF security integration
    this.serverlessSpa = ServerlessSpaConstruct.withCustomDomainAndWaf(this, 'ServerlessSpa', {
      lambdaEntry: path.join(__dirname, '../lambda/handler.ts'),
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      domainName,
      alternativeDomainNames,
      hostedZoneId,
      zoneName,
      ssmPrefix,
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
