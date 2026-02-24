import {
  Attribute,
  AttributeType,
  BillingMode,
  GlobalSecondaryIndexProps,
  Table,
  TableProps,
} from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Properties for DatabaseConstruct.
 */
export interface DatabaseConstructProps {
  /**
   * Optional table name.
   * If not specified, CDK will generate a unique name.
   */
  readonly tableName?: string;

  /**
   * Partition key attribute.
   * @default { name: 'PK', type: AttributeType.STRING }
   */
  readonly partitionKey?: Attribute;

  /**
   * Sort key attribute.
   * Set to null to create a table without sort key.
   * @default { name: 'SK', type: AttributeType.STRING }
   */
  readonly sortKey?: Attribute | null;

  /**
   * Global secondary indexes to add to the table.
   * @default - No GSIs
   */
  readonly globalSecondaryIndexes?: GlobalSecondaryIndexProps[];

  /**
   * Additional table properties to override defaults.
   * These will be merged with the default configuration.
   * @default - Uses default settings (PAY_PER_REQUEST billing). Removal policy inherits from app-level setting.
   */
  readonly tableProps?: Partial<TableProps>;
}

/**
 * A CDK construct that creates a DynamoDB table with sensible defaults.
 *
 * This construct is designed for single-table design patterns and provides:
 * - Default partition key (PK) and sort key (SK) with string type
 * - On-demand billing mode for cost optimization
 * - DESTROY removal policy for development environments
 * - Support for GSIs and custom table properties
 */
export class DatabaseConstruct extends Construct {
  /**
   * The DynamoDB table created by this construct.
   * Exposes Table (not ITable) to enable use of the grants property.
   */
  public readonly table: Table;

  /**
   * The name of the DynamoDB table.
   */
  public readonly tableName: string;

  /**
   * The ARN of the DynamoDB table.
   */
  public readonly tableArn: string;

  constructor(scope: Construct, id: string, props?: DatabaseConstructProps) {
    super(scope, id);

    // Default partition key: PK (String)
    const partitionKey: Attribute = props?.partitionKey ?? {
      name: 'PK',
      type: AttributeType.STRING,
    };

    // Default sort key: SK (String), unless explicitly set to null
    const sortKey: Attribute | undefined =
      props?.sortKey === null
        ? undefined
        : (props?.sortKey ?? {
            name: 'SK',
            type: AttributeType.STRING,
          });

    // Build table properties with defaults
    const tableProps: TableProps = {
      tableName: props?.tableName,
      partitionKey,
      sortKey,
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      ...props?.tableProps,
    };

    // Create the DynamoDB table
    const table = new Table(this, 'Table', tableProps);

    // Add GSIs if specified
    if (props?.globalSecondaryIndexes) {
      for (const gsi of props.globalSecondaryIndexes) {
        table.addGlobalSecondaryIndex(gsi);
      }
    }

    // Expose public properties
    this.table = table;
    this.tableName = table.tableName;
    this.tableArn = table.tableArn;
  }
}
