import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuthConstruct } from '../../lib/constructs/auth-construct';

describe('AuthConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('User Pool', () => {
    test('creates User Pool resource', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Cognito::UserPool', 1);
    });

    test('enables self sign-up', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AdminCreateUserConfig: {
          AllowAdminCreateUserOnly: false,
        },
      });
    });

    test('uses email as sign-in alias', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UsernameAttributes: ['email'],
      });
    });

    test('enables email auto-verification', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        AutoVerifiedAttributes: ['email'],
      });
    });
  });

  describe('Password Policy', () => {
    test('sets minimum password length to 8', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            MinimumLength: 8,
          },
        },
      });
    });

    test('requires lowercase characters', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            RequireLowercase: true,
          },
        },
      });
    });

    test('requires digits', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        Policies: {
          PasswordPolicy: {
            RequireNumbers: true,
          },
        },
      });
    });
  });

  describe('User Pool Client', () => {
    test('creates User Pool Client resource', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    });

    test('does not generate client secret', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        GenerateSecret: false,
      });
    });

    test('enables USER_SRP_AUTH flow', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: Match.arrayWith(['ALLOW_USER_SRP_AUTH']),
      });
    });

    test('enables ALLOW_REFRESH_TOKEN_AUTH flow', () => {
      new AuthConstruct(stack, 'Auth');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ExplicitAuthFlows: Match.arrayWith(['ALLOW_REFRESH_TOKEN_AUTH']),
      });
    });
  });

  describe('Props Override', () => {
    test('overrides User Pool props', () => {
      new AuthConstruct(stack, 'Auth', {
        userPoolProps: {
          userPoolName: 'CustomPoolName',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPool', {
        UserPoolName: 'CustomPoolName',
      });
    });

    test('overrides User Pool Client props', () => {
      new AuthConstruct(stack, 'Auth', {
        userPoolClientProps: {
          userPoolClientName: 'CustomClientName',
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
        ClientName: 'CustomClientName',
      });
    });
  });

  describe('Output Properties', () => {
    test('exposes userPool property', () => {
      const auth = new AuthConstruct(stack, 'Auth');

      expect(auth.userPool).toBeDefined();
    });

    test('exposes userPoolClient property', () => {
      const auth = new AuthConstruct(stack, 'Auth');

      expect(auth.userPoolClient).toBeDefined();
    });

    test('exposes userPoolId property', () => {
      const auth = new AuthConstruct(stack, 'Auth');

      expect(auth.userPoolId).toBeDefined();
      expect(typeof auth.userPoolId).toBe('string');
    });

    test('exposes userPoolClientId property', () => {
      const auth = new AuthConstruct(stack, 'Auth');

      expect(auth.userPoolClientId).toBeDefined();
      expect(typeof auth.userPoolClientId).toBe('string');
    });
  });
});
