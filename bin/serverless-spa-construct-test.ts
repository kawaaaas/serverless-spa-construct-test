#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import 'dotenv/config';
import { ServerlessSpaMainStack } from '../lib/serverless-spa-main-stack';
import { ServerlessSpaSecurityStack } from '../lib/serverless-spa-security-stack';

const app = new cdk.App();

// Security stack must be deployed in us-east-1 (required for CloudFront WAF)
const securityStack = new ServerlessSpaSecurityStack(app, 'ServerlessSpaSecurityStack', {
  env: {
    region: 'us-east-1',
  },
  crossRegionReferences: true,
});

// Main stack can be deployed in any region
const mainStack = new ServerlessSpaMainStack(app, 'ServerlessSpaMainStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  crossRegionReferences: true,
});

// Main stack depends on security stack for SSM parameters
mainStack.addDependency(securityStack);

// Apply RemovalPolicy.DESTROY to all resources for development/testing
cdk.RemovalPolicies.of(app).destroy();
