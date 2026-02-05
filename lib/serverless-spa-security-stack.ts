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

    // Create the security construct with WAF protection
    this.security = ServerlessSpaSecurityConstruct.withWaf(this, 'Security', {
      ssmPrefix: '/serverless-spa/security/',
      rateLimit: 2000,
    });
  }
}
