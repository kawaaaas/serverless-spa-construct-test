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
    // Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3, 6.1
    const userPool = new UserPool(this, 'UserPool', {
      // Self sign-up enabled (Requirement 1.2)
      selfSignUpEnabled: true,
      // Email as sign-in alias (Requirement 1.3)
      signInAliases: {
        email: true,
      },
      // Auto-verify email (Requirement 1.4)
      autoVerify: {
        email: true,
      },
      // Password policy (Requirements 4.1, 4.2, 4.3)
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
      // Note: Removal policy is not set here (Requirement 6.1)
      // It will be managed at the stack level
      // Props override (Requirement 1.5, 4.4)
      ...props?.userPoolProps,
    });

    // Create User Pool Client with defaults
    // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
    const userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool,
      // No client secret for SPA (Requirement 2.2)
      generateSecret: false,
      // Auth flows (Requirements 2.3, 2.4)
      authFlows: {
        userSrp: true,
        custom: false,
        userPassword: false,
      },
      // Props override (Requirement 2.5)
      ...props?.userPoolClientProps,
    });

    // Expose public properties
    this.userPool = userPool;
    this.userPoolClient = userPoolClient;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;
  }
}
