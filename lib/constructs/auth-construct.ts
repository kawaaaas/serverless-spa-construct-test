import {
  IUserPool,
  IUserPoolClient,
  UserPool,
  UserPoolClient,
  UserPoolClientProps,
  UserPoolProps,
} from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

/**
 * Properties for AuthConstruct.
 */
export interface AuthConstructProps {
  /**
   * Additional User Pool properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly userPoolProps?: Partial<UserPoolProps>;

  /**
   * Additional User Pool Client properties to override defaults.
   * These will be merged with the default configuration.
   */
  readonly userPoolClientProps?: Partial<UserPoolClientProps>;
}

/**
 * A CDK construct that creates a Cognito User Pool with sensible defaults for SPAs.
 *
 * This construct provides:
 * - Cognito User Pool with Lite tier (cost-optimized)
 * - Self sign-up enabled with email as sign-in alias
 * - Email verification enabled
 * - Secure password policy (min 8 chars, lowercase, digits required)
 * - User Pool Client without client secret (SPA-friendly)
 * - USER_SRP_AUTH and ALLOW_REFRESH_TOKEN_AUTH flows enabled
 */
export class AuthConstruct extends Construct {
  /**
   * The Cognito User Pool created by this construct.
   */
  public readonly userPool: IUserPool;

  /**
   * The Cognito User Pool Client created by this construct.
   */
  public readonly userPoolClient: IUserPoolClient;

  /**
   * The ID of the Cognito User Pool.
   */
  public readonly userPoolId: string;

  /**
   * The ID of the Cognito User Pool Client.
   */
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props?: AuthConstructProps) {
    super(scope, id);

    // Create User Pool with defaults
    const userPool = new UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      ...props?.userPoolProps,
    });

    // Create User Pool Client with defaults
    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        custom: false,
        userPassword: false,
      },
      ...props?.userPoolClientProps,
    });

    // Expose public properties
    this.userPool = userPool;
    this.userPoolClient = userPoolClient;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;
  }
}
