# Serverless SPA Construct Test

A sample AWS CDK project demonstrating production-ready serverless infrastructure for Single Page Applications (SPA). This repository showcases reusable CDK constructs and best practices for deploying modern web applications on AWS.

## Overview

This project provides a complete serverless architecture for SPAs with authentication, API backend, and secure content delivery. It demonstrates:

- Custom CDK construct development and testing
- Multi-region deployment patterns
- Security best practices (WAF, Cognito, API Gateway resource policies)
- Real-world integration with a React frontend
- Comprehensive testing with CDK assertions

## Features

- **Frontend Delivery**: S3 + CloudFront CDN with optional custom domains
- **Authentication**: AWS Cognito User Pool with JWT-based authorization
- **API Backend**: API Gateway (REST) + Lambda functions
- **Database**: DynamoDB with on-demand billing
- **Security**: WAF protection, ACM certificates, Secrets Manager
- **DNS Management**: Route53 integration with alternative domain names
- **Cross-Region Support**: Lambda@Edge, secret replication, and SSM parameter sharing
- **Demo Application**: React 19 + Vite + Tailwind CSS with authentication flow

## Architecture

```
                                    ┌─────────────────┐
                                    │  Cognito        │
                                    │  User Pool      │
                                    │  (JWT issuer)   │
                                    └────────┬────────┘
                                             │ JWT verification
┌──────┐    ┌─────────────┐    ┌─────────────┴────────────┐
│ User │───▶│ CloudFront  │───▶│ API Gateway (REST)       │
└──────┘    │             │    │ - Resource policy        │
            │ /api/* ─────┼───▶│ - Cognito Authorizer     │
            │             │    └─────────────┬────────────┘
            │ /* ─────────┼───┐              │
            └─────────────┘   │              ▼
                              │    ┌─────────────────┐
                              │    │ Lambda          │
                              │    │ (Node.js)       │
                              │    └────────┬────────┘
                              │             │
                              ▼             ▼
                    ┌─────────────┐  ┌─────────────┐
                    │ S3 Bucket   │  │ DynamoDB    │
                    └─────────────┘  └─────────────┘
```

## Stack Configuration

This sample deploys two CDK stacks:

| Stack                        | Region         | Description                                  |
| ---------------------------- | -------------- | -------------------------------------------- |
| `ServerlessSpaSecurityStack` | us-east-1      | WAF, ACM certificate, Secrets, SSM parameters |
| `ServerlessSpaMainStack`     | ap-northeast-1 | Main application (DynamoDB, Cognito, API, S3) |

The security stack must be deployed in `us-east-1` because CloudFront requires WAF WebACLs and ACM certificates in that region.

## Prerequisites

- Node.js 18.x or later
- AWS CLI configured with appropriate credentials
- AWS account with permissions to create:
  - CloudFormation stacks
  - S3 buckets, CloudFront distributions
  - API Gateway, Lambda functions
  - DynamoDB tables, Cognito User Pools
  - WAF WebACLs, ACM certificates
  - Route53 hosted zone (for custom domains)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd serverless-spa-construct-test
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment variables (copy from example):

```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:

```env
DOMAIN_NAME=www.example.com
ZONE_NAME=example.com
HOSTED_ZONE_ID=Z1234567890ABC
ALTERNATIVE_DOMAIN_NAMES=example.com,alt.example.com
SSM_PREFIX=/serverless-spa/security/
WAF_RATE_LIMIT=2000
```

## Deployment

### Option 1: Deploy all stacks at once

```bash
npx cdk deploy --all
```

CDK automatically resolves dependencies and deploys `ServerlessSpaSecurityStack` first.

### Option 2: Deploy stacks individually

```bash
# 1. Deploy security stack (us-east-1)
npx cdk deploy ServerlessSpaSecurityStack

# 2. Deploy main application stack
npx cdk deploy ServerlessSpaMainStack
```

### Verify deployment

After deployment completes, CDK outputs will include:

- CloudFront distribution URL
- Cognito User Pool ID
- API Gateway endpoint
- Custom domain URL (if configured)

## Usage

### Synthesize CloudFormation templates

```bash
npx cdk synth
```

### View deployment changes

```bash
npx cdk diff
```

### Destroy resources

```bash
npx cdk destroy --all
```

Note: Some resources may fail to delete if they contain data (S3 buckets, DynamoDB tables). Manual cleanup may be required.

## Project Structure

```
├── bin/
│   └── serverless-spa-construct-test.ts    # CDK app entry point
├── lib/
│   ├── constructs/                         # Custom CDK constructs
│   │   ├── serverless-spa.ts               # High-level API
│   │   ├── serverless-spa-security-construct.ts  # Security construct
│   │   ├── frontend-construct.ts           # Low-level: S3 + CloudFront
│   │   ├── auth-construct.ts               # Low-level: Cognito
│   │   ├── api-construct.ts                # Low-level: API Gateway + Lambda
│   │   ├── database-construct.ts           # Low-level: DynamoDB
│   │   ├── certificate-construct.ts        # ACM certificate
│   │   ├── lambda-edge-construct.ts        # Lambda@Edge functions
│   │   ├── waf-construct.ts                # AWS WAFv2
│   │   ├── secret-construct.ts             # Secrets Manager
│   │   └── ssm-construct.ts                # SSM Parameter Store
│   ├── lambda/                             # Lambda function handlers
│   │   ├── custom-header-authorizer.ts     # Custom header authorization
│   │   ├── edge-origin-request.ts          # Edge origin request handler
│   │   └── rotation-handler.ts             # Secret rotation handler
│   ├── serverless-spa-main-stack.ts        # Main stack definition
│   ├── serverless-spa-security-stack.ts    # Security stack definition
│   └── index.ts                            # Public exports
├── lambda/
│   └── handler.ts                          # Sample Lambda handler
├── spa/                                    # Frontend SPA (Vite + React)
│   ├── src/
│   │   ├── pages/                          # Page components
│   │   │   ├── LoginPage.tsx
│   │   │   └── HomePage.tsx
│   │   ├── App.tsx                         # Main application component
│   │   ├── AuthContext.tsx                 # Authentication context
│   │   ├── auth.ts                         # Cognito authentication logic
│   │   ├── ProtectedRoute.tsx              # Route guard component
│   │   ├── config.ts                       # Configuration
│   │   └── main.tsx                        # Application entry point
│   ├── index.html
│   └── vite.config.ts
└── test/                                   # Test suite
    ├── constructs/                         # Construct unit tests
    │   ├── serverless-spa.test.ts
    │   ├── database-construct.test.ts
    │   ├── frontend-construct.test.ts
    │   └── ...
    └── serverless-spa-main-stack.test.ts
```

## Development

### Available Commands

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `npm run build`  | Compile TypeScript                       |
| `npm run watch`  | Watch mode for development               |
| `npm test`       | Run Jest tests                           |
| `npm run lint`   | Run ESLint checks                        |
| `npm run lint:fix` | Auto-fix ESLint issues                 |
| `npm run format` | Format code with Prettier                |
| `npm run format:check` | Check code formatting            |
| `npx cdk synth`  | Synthesize CloudFormation templates      |
| `npx cdk diff`   | Compare deployed stack with local state  |
| `npx cdk deploy` | Deploy stacks to AWS                     |
| `npx cdk destroy`| Remove stacks from AWS                   |

### Testing

Run the test suite:

```bash
npm test
```

Tests use Jest with CDK assertions to validate CloudFormation template generation. Test coverage includes:

- Construct property validation
- Default configuration testing
- Custom configuration overrides
- Output properties verification
- Cross-region resource integration

### Code Quality

This project uses:

- **TypeScript 5.9** with strict mode
- **ESLint** with CDK-specific rules
- **Prettier** for code formatting
- **Jest** for unit testing

## Construct API

### High-Level API

**ServerlessSpaConstruct** - Complete SPA setup with factory methods:

```typescript
// Minimal setup with CloudFront default domain
ServerlessSpaConstruct.minimal(scope, id, props)

// Custom domain from SecurityStack certificate
ServerlessSpaConstruct.withCustomDomain(scope, id, props)

// WAF protection without custom domain
ServerlessSpaConstruct.withWaf(scope, id, props)

// Full-featured production setup
ServerlessSpaConstruct.withCustomDomainAndWaf(scope, id, props)
```

**ServerlessSpaSecurityConstruct** - Security resources in us-east-1:

```typescript
// Custom header only
ServerlessSpaSecurityConstruct.minimal(scope, id, props)

// WAF protection
ServerlessSpaSecurityConstruct.withWaf(scope, id, props)

// Custom domain certificate
ServerlessSpaSecurityConstruct.withCertificate(scope, id, props)

// Full security suite
ServerlessSpaSecurityConstruct.withWafAndCertificate(scope, id, props)
```

### Low-Level API

Fine-grained control with individual constructs:

- `DatabaseConstruct` - DynamoDB table
- `AuthConstruct` - Cognito User Pool
- `ApiConstruct` - API Gateway + Lambda
- `FrontendConstruct` - S3 + CloudFront
- `CertificateConstruct` - ACM certificate
- `WafConstruct` - WAF WebACL
- `SecretConstruct` - Secrets Manager
- `LambdaEdgeConstruct` - Lambda@Edge functions
- `SsmConstruct` - SSM Parameter Store

## Security Considerations

- WAF rate limiting protects against DDoS attacks
- API Gateway resource policy restricts access to CloudFront only
- Cognito handles authentication with JWT tokens
- Secrets Manager provides encrypted secret storage with rotation
- Lambda@Edge injects custom headers for origin validation
- Cross-region secret replication for high availability

## Environment Variables

Create a `.env` file with the following configuration:

| Variable                  | Description                          | Required | Default                     |
| ------------------------- | ------------------------------------ | -------- | --------------------------- |
| `DOMAIN_NAME`             | Primary CloudFront domain            | No       | -                           |
| `ZONE_NAME`               | Route53 hosted zone name             | No       | -                           |
| `HOSTED_ZONE_ID`          | Route53 hosted zone ID               | No       | -                           |
| `ALTERNATIVE_DOMAIN_NAMES`| Additional domain aliases            | No       | -                           |
| `SSM_PREFIX`              | SSM parameter prefix                 | No       | `/serverless-spa/security/` |
| `WAF_RATE_LIMIT`          | WAF rate limit (per 5 minutes)       | No       | `2000`                      |

## Contributing

This is a sample repository for demonstration purposes. Contributions are welcome for:

- Bug fixes
- Documentation improvements
- Additional test coverage
- New construct features

Please ensure all tests pass before submitting pull requests:

```bash
npm test
npm run lint
npm run format:check
```

## License

MIT

## Acknowledgments

This project demonstrates AWS CDK best practices and modern serverless architecture patterns. It is intended as a reference implementation for building production-ready SPAs on AWS.
