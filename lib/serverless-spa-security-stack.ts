import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { ServerlessSpaSecurityConstruct } from './constructs/serverless-spa-security-construct';

/**
 * Stack for deploying security resources in us-east-1.
 * This stack must be deployed before the main ServerlessSpaConstructTestStack.
 */
export class ServerlessSpaSecurityStack extends cdk.Stack {
  /**
   * The ServerlessSpaSecurityConstruct instance.
   */
  public readonly security: ServerlessSpaSecurityConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const domainName = process.env.DOMAIN_NAME;
    const hostedZoneId = process.env.HOSTED_ZONE_ID;
    const zoneName = process.env.ZONE_NAME;
    const ssmPrefix = process.env.SSM_PREFIX ?? '/serverless-spa/security/';
    const wafRateLimit = Number(process.env.WAF_RATE_LIMIT ?? '2000');
    const alternativeDomainNames = process.env.ALTERNATIVE_DOMAIN_NAMES?.split(',').map((s) =>
      s.trim()
    );

    if (!domainName || !hostedZoneId || !zoneName) {
      throw new Error(
        'Required environment variables are missing: DOMAIN_NAME, HOSTED_ZONE_ID, ZONE_NAME. ' +
          'Copy .env.example to .env and fill in your values.'
      );
    }

    // Create the security construct with WAF protection and ACM certificate
    this.security = ServerlessSpaSecurityConstruct.withWafAndCertificate(this, 'Security', {
      ssmPrefix,
      rateLimit: wafRateLimit,
      domainName,
      hostedZoneId,
      zoneName,
      alternativeDomainNames,
    });
  }
}
