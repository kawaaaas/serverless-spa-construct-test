import { RemovalPolicy, Stack, Token } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecretConstruct, SecretConstructProps } from './secret-construct';
import { SsmConstruct, SsmConstructProps } from './ssm-construct';
import { WafConstruct, WafConstructProps } from './waf-construct';

/**
 * Properties for ServerlessSpaSecurityConstruct.
 *
 * This high-level construct integrates WafConstruct, SecretConstruct,
 * and SsmConstruct for CloudFront security in us-east-1 region.
 */
export interface ServerlessSpaSecurityConstructProps {
  /**
   * Optional WafConstruct properties.
   * These will be passed through to WafConstruct.
   */
  readonly waf?: WafConstructProps;

  /**
   * Optional SecretConstruct properties.
   * These will be passed through to SecretConstruct.
   * Note: 'ssmPrefix' is auto-wired from ssm.ssmPrefix.
   */
  readonly secret?: Omit<SecretConstructProps, 'ssmPrefix'>;

  /**
   * Optional SsmConstruct properties.
   * Note: 'webAclArn', 'customHeaderName', 'secretArn' are auto-wired.
   */
  readonly ssm?: Pick<SsmConstructProps, 'ssmPrefix'>;

  /**
   * Removal policy for resources.
   * @default RemovalPolicy.DESTROY
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * A high-level CDK construct that creates security resources for CloudFront.
 * This construct must be deployed in us-east-1 region.
 *
 * This construct integrates:
 * - WafConstruct: WAF WebACL with CLOUDFRONT scope
 * - SecretConstruct: Secrets Manager with rotation for custom header
 * - SsmConstruct: SSM Parameters for cross-region sharing
 *
 * Dependencies between constructs are automatically wired:
 * - SsmConstruct receives webAclArn, customHeaderName, secretArn from other constructs
 * - SecretConstruct receives ssmPrefix for rotation Lambda
 *
 * @example
 * // Deploy in us-east-1 region
 * const securityStack = new Stack(app, 'SecurityStack', {
 *   env: { region: 'us-east-1' },
 * });
 *
 * const security = new ServerlessSpaSecurityConstruct(securityStack, 'Security', {
 *   waf: { rateLimit: 3000 },
 *   secret: { rotationDays: 14 },
 *   ssm: { ssmPrefix: '/myapp/security/' },
 * });
 */
export class ServerlessSpaSecurityConstruct extends Construct {
  /**
   * The WafConstruct instance.
   */
  public readonly waf: WafConstruct;

  /**
   * The SecretConstruct instance.
   */
  public readonly secret: SecretConstruct;

  /**
   * The SsmConstruct instance.
   */
  public readonly ssm: SsmConstruct;

  /**
   * The WAF WebACL ARN for CloudFront.
   * Convenience property for waf.webAclArn.
   */
  public readonly webAclArn: string;

  /**
   * The Secrets Manager secret ARN.
   * Convenience property for secret.secretArn.
   */
  public readonly secretArn: string;

  /**
   * The custom header name.
   * Convenience property for secret.customHeaderName.
   */
  public readonly customHeaderName: string;

  /**
   * The SSM prefix used for parameters.
   * Convenience property for ssm.ssmPrefix.
   */
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props?: ServerlessSpaSecurityConstructProps) {
    super(scope, id);

    // Validate region is us-east-1
    const region = Stack.of(this).region;
    if (region !== 'us-east-1' && !Token.isUnresolved(region)) {
      throw new Error(
        `ServerlessSpaSecurityConstruct must be deployed in us-east-1 region. Current region: ${region}`
      );
    }

    // Determine the SSM prefix (used by multiple constructs)
    const ssmPrefix = props?.ssm?.ssmPrefix ?? '/myapp/security/';
    const removalPolicy = props?.removalPolicy ?? RemovalPolicy.DESTROY;

    // Create WafConstruct
    this.waf = new WafConstruct(this, 'Waf', {
      rateLimit: props?.waf?.rateLimit,
      removalPolicy: props?.waf?.removalPolicy ?? removalPolicy,
    });

    // Create SecretConstruct with auto-wired ssmPrefix
    this.secret = new SecretConstruct(this, 'Secret', {
      customHeaderName: props?.secret?.customHeaderName,
      rotationDays: props?.secret?.rotationDays,
      ssmPrefix: ssmPrefix, // Auto-wired from ssm.ssmPrefix
      removalPolicy: props?.secret?.removalPolicy ?? removalPolicy,
    });

    // Create SsmConstruct with auto-wired values from other constructs
    this.ssm = new SsmConstruct(this, 'Ssm', {
      ssmPrefix: ssmPrefix,
      webAclArn: this.waf.webAclArn, // Auto-wired from WafConstruct
      customHeaderName: this.secret.customHeaderName, // Auto-wired from SecretConstruct
      secretArn: this.secret.secretArn, // Auto-wired from SecretConstruct
    });

    // Set convenience properties
    this.webAclArn = this.waf.webAclArn;
    this.secretArn = this.secret.secretArn;
    this.customHeaderName = this.secret.customHeaderName;
    this.ssmPrefix = this.ssm.ssmPrefix;
  }
}
