import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { SecretConstruct } from '../../lib/constructs/secret-construct';

describe('SecretConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { region: 'us-east-1' },
    });
  });

  describe('Secrets Manager Secret Creation', () => {
    test('creates Secrets Manager secret', () => {
      new SecretConstruct(stack, 'Secret');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        GenerateSecretString: Match.objectLike({
          GenerateStringKey: 'headerValue',
        }),
      });
    });

    test('creates exactly one secret', () => {
      new SecretConstruct(stack, 'Secret');

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::SecretsManager::Secret', 1);
    });

    test('uses default custom header name in secret template', () => {
      new SecretConstruct(stack, 'Secret');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        GenerateSecretString: Match.objectLike({
          SecretStringTemplate: JSON.stringify({ headerName: 'x-origin-verify' }),
        }),
      });
    });

    test('uses custom header name when provided', () => {
      new SecretConstruct(stack, 'Secret', {
        customHeaderName: 'x-custom-header',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        GenerateSecretString: Match.objectLike({
          SecretStringTemplate: JSON.stringify({ headerName: 'x-custom-header' }),
        }),
      });
    });
  });

  describe('Rotation Lambda Creation', () => {
    test('creates rotation Lambda function', () => {
      new SecretConstruct(stack, 'Secret');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs20.x',
        Description: 'Rotates custom header secret and updates SSM parameters',
      });
    });

    test('rotation Lambda has correct environment variables', () => {
      new SecretConstruct(stack, 'Secret', {
        ssmPrefix: '/test/prefix/',
        customHeaderName: 'x-test-header',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            SSM_PREFIX: '/test/prefix/',
            CUSTOM_HEADER_NAME: 'x-test-header',
          }),
        },
      });
    });

    test('rotation Lambda has SSM permissions', () => {
      new SecretConstruct(stack, 'Secret');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['ssm:PutParameter', 'ssm:GetParameter'],
            }),
          ]),
        },
      });
    });
  });

  describe('Rotation Schedule', () => {
    test('creates rotation schedule', () => {
      new SecretConstruct(stack, 'Secret');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
        RotationRules: Match.objectLike({
          ScheduleExpression: 'rate(7 days)',
        }),
      });
    });

    test('uses custom rotation days when provided', () => {
      new SecretConstruct(stack, 'Secret', {
        rotationDays: 14,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
        RotationRules: Match.objectLike({
          ScheduleExpression: 'rate(14 days)',
        }),
      });
    });

    test('uses different custom rotation days', () => {
      new SecretConstruct(stack, 'Secret', {
        rotationDays: 30,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
        RotationRules: Match.objectLike({
          ScheduleExpression: 'rate(30 days)',
        }),
      });
    });
  });

  describe('Output Properties', () => {
    test('exposes secret property', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret');

      expect(secretConstruct.secret).toBeDefined();
    });

    test('exposes secretArn property', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret');

      expect(secretConstruct.secretArn).toBeDefined();
    });

    test('exposes customHeaderName property with default value', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret');

      expect(secretConstruct.customHeaderName).toBe('x-origin-verify');
    });

    test('exposes customHeaderName property with custom value', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret', {
        customHeaderName: 'x-custom-header',
      });

      expect(secretConstruct.customHeaderName).toBe('x-custom-header');
    });

    test('exposes rotationFunction property', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret');

      expect(secretConstruct.rotationFunction).toBeDefined();
    });
  });

  describe('Replica Regions', () => {
    test('exposes replicaRegions property with default value', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret');

      expect(secretConstruct.replicaRegions).toEqual(['ap-northeast-1']);
    });

    test('exposes replicaRegions property with custom value', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret', {
        replicaRegions: ['eu-west-1', 'ap-southeast-1'],
      });

      expect(secretConstruct.replicaRegions).toEqual(['eu-west-1', 'ap-southeast-1']);
    });

    test('throws error when us-east-1 is specified as replica region', () => {
      expect(() => {
        new SecretConstruct(stack, 'Secret', {
          replicaRegions: ['us-east-1'],
        });
      }).toThrow('us-east-1 cannot be specified as a replica region (it is the primary region)');
    });

    test('throws error when us-east-1 is included among other replica regions', () => {
      expect(() => {
        new SecretConstruct(stack, 'Secret', {
          replicaRegions: ['ap-northeast-1', 'us-east-1', 'eu-west-1'],
        });
      }).toThrow('us-east-1 cannot be specified as a replica region (it is the primary region)');
    });

    test('allows empty replica regions array', () => {
      const secretConstruct = new SecretConstruct(stack, 'Secret', {
        replicaRegions: [],
      });

      expect(secretConstruct.replicaRegions).toEqual([]);
    });

    test('configures default replication in CloudFormation template', () => {
      new SecretConstruct(stack, 'Secret');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        ReplicaRegions: [{ Region: 'ap-northeast-1' }],
      });
    });

    test('configures custom replication regions in CloudFormation template', () => {
      new SecretConstruct(stack, 'Secret', {
        replicaRegions: ['eu-west-1', 'ap-southeast-1'],
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        ReplicaRegions: [{ Region: 'eu-west-1' }, { Region: 'ap-southeast-1' }],
      });
    });

    test('configures single replication region in CloudFormation template', () => {
      new SecretConstruct(stack, 'Secret', {
        replicaRegions: ['eu-central-1'],
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        ReplicaRegions: [{ Region: 'eu-central-1' }],
      });
    });

    test('does not configure replication when empty array is provided', () => {
      new SecretConstruct(stack, 'Secret', {
        replicaRegions: [],
      });

      const template = Template.fromStack(stack);
      // When replicaRegions is empty, the ReplicaRegions property should not be present
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        ReplicaRegions: Match.absent(),
      });
    });
  });
});
