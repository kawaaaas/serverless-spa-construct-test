import { App, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { DatabaseConstruct } from '../../lib/constructs/database-construct';

describe('DatabaseConstruct', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('Default settings', () => {
    test('creates table with default PK (string type)', () => {
      new DatabaseConstruct(stack, 'Database');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: Match.arrayWith([{ AttributeName: 'PK', KeyType: 'HASH' }]),
        AttributeDefinitions: Match.arrayWith([{ AttributeName: 'PK', AttributeType: 'S' }]),
      });
    });

    test('creates table with default SK (string type)', () => {
      new DatabaseConstruct(stack, 'Database');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: Match.arrayWith([{ AttributeName: 'SK', KeyType: 'RANGE' }]),
        AttributeDefinitions: Match.arrayWith([{ AttributeName: 'SK', AttributeType: 'S' }]),
      });
    });

    test('creates table with PAY_PER_REQUEST billing mode', () => {
      new DatabaseConstruct(stack, 'Database');

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('creates table with DESTROY removal policy', () => {
      new DatabaseConstruct(stack, 'Database');

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });
  });

  describe('Custom key settings', () => {
    test('applies custom partitionKey', () => {
      new DatabaseConstruct(stack, 'Database', {
        partitionKey: { name: 'userId', type: AttributeType.STRING },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: Match.arrayWith([{ AttributeName: 'userId', KeyType: 'HASH' }]),
        AttributeDefinitions: Match.arrayWith([{ AttributeName: 'userId', AttributeType: 'S' }]),
      });
    });

    test('applies custom sortKey', () => {
      new DatabaseConstruct(stack, 'Database', {
        sortKey: { name: 'timestamp', type: AttributeType.NUMBER },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: Match.arrayWith([{ AttributeName: 'timestamp', KeyType: 'RANGE' }]),
        AttributeDefinitions: Match.arrayWith([{ AttributeName: 'timestamp', AttributeType: 'N' }]),
      });
    });

    test('creates table without sort key when sortKey is null', () => {
      new DatabaseConstruct(stack, 'Database', {
        sortKey: null,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [{ AttributeName: 'PK', KeyType: 'HASH' }],
      });
    });
  });

  describe('GSI and tableProps', () => {
    test('adds GSI when globalSecondaryIndexes is specified', () => {
      new DatabaseConstruct(stack, 'Database', {
        globalSecondaryIndexes: [
          {
            indexName: 'GSI1',
            partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
            sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
          },
        ],
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
          }),
        ]),
      });
    });

    test('overrides default settings with tableProps', () => {
      new DatabaseConstruct(stack, 'Database', {
        tableProps: {
          billingMode: BillingMode.PROVISIONED,
          readCapacity: 5,
          writeCapacity: 5,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: Match.absent(),
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      });
    });

    test('overrides removal policy with tableProps', () => {
      new DatabaseConstruct(stack, 'Database', {
        tableProps: {
          removalPolicy: RemovalPolicy.RETAIN,
        },
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });
  });

  describe('Output properties', () => {
    test('exposes table property as Table', () => {
      const construct = new DatabaseConstruct(stack, 'Database');

      expect(construct.table).toBeDefined();
      expect(construct.table.tableName).toBeDefined();
      expect(construct.table.tableArn).toBeDefined();
    });

    test('exposes tableName property', () => {
      const construct = new DatabaseConstruct(stack, 'Database');

      expect(construct.tableName).toBeDefined();
      expect(typeof construct.tableName).toBe('string');
    });

    test('exposes tableArn property', () => {
      const construct = new DatabaseConstruct(stack, 'Database');

      expect(construct.tableArn).toBeDefined();
      expect(typeof construct.tableArn).toBe('string');
    });

    test('tableName and tableArn match the created table', () => {
      const construct = new DatabaseConstruct(stack, 'Database');

      expect(construct.tableName).toBe(construct.table.tableName);
      expect(construct.tableArn).toBe(construct.table.tableArn);
    });
  });
});
