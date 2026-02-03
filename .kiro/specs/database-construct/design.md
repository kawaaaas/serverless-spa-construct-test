# 設計ドキュメント

## 概要

DatabaseConstructは、DynamoDBテーブルを作成する低レベルCDKコンストラクトである。シングルテーブル設計をデフォルトとし、オンデマンドキャパシティによるコスト最適化を実現する。Propsパターンにより柔軟なカスタマイズが可能で、他のコンストラクト（ApiConstruct等）から参照できるようテーブル情報を公開する。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                   DatabaseConstruct                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              DynamoDB Table                      │    │
│  │                                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐            │    │
│  │  │ Partition Key │  │   Sort Key   │            │    │
│  │  │  (PK: String) │  │ (SK: String) │            │    │
│  │  └──────────────┘  └──────────────┘            │    │
│  │                                                  │    │
│  │  ┌──────────────────────────────────────────┐  │    │
│  │  │     Global Secondary Indexes (Optional)   │  │    │
│  │  └──────────────────────────────────────────┘  │    │
│  │                                                  │    │
│  │  Billing Mode: PAY_PER_REQUEST (default)       │    │
│  │  Removal Policy: DESTROY (default)             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Outputs:                                                │
│  - table: ITable                                         │
│  - tableName: string                                     │
│  - tableArn: string                                      │
└─────────────────────────────────────────────────────────┘
```

## コンポーネントとインターフェース

### DatabaseConstructProps

```typescript
import { Attribute, GlobalSecondaryIndexProps, TableProps } from 'aws-cdk-lib/aws-dynamodb';

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
   */
  readonly tableProps?: Partial<TableProps>;
}
```

### DatabaseConstruct クラス

```typescript
import { Construct } from 'constructs';
import { ITable, Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib/core';

export class DatabaseConstruct extends Construct {
  /**
   * The DynamoDB table created by this construct.
   */
  public readonly table: ITable;

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
    // Implementation
  }
}
```

## データモデル

### デフォルトキー設計

シングルテーブル設計に適したデフォルトキー構成：

| 属性名 | 型     | 説明                                                  |
| ------ | ------ | ----------------------------------------------------- |
| PK     | String | パーティションキー（エンティティタイプ#ID形式を想定） |
| SK     | String | ソートキー（関連データの階層化に使用）                |

### デフォルト設定値

| 設定項目            | デフォルト値    | 理由                                 |
| ------------------- | --------------- | ------------------------------------ |
| billingMode         | PAY_PER_REQUEST | コスト最適化（使用量に応じた課金）   |
| removalPolicy       | DESTROY         | 開発環境での迅速なクリーンアップ     |
| pointInTimeRecovery | false           | コスト削減（必要に応じて有効化可能） |

## 正当性プロパティ

_正当性プロパティとは、システムの全ての有効な実行において真であるべき特性や振る舞いを形式的に記述したものである。これらは人間が読める仕様と機械で検証可能な正当性保証の橋渡しとなる。_

### プロパティ1: デフォルトパーティションキー

_任意の_ DatabaseConstructインスタンスにおいて、partitionKeyが指定されない場合、作成されるテーブルのパーティションキーは名前が"PK"で型がSTRINGである。

**検証対象: 要件 1.2**

### プロパティ2: デフォルトソートキー

_任意の_ DatabaseConstructインスタンスにおいて、sortKeyが指定されない場合、作成されるテーブルのソートキーは名前が"SK"で型がSTRINGである。

**検証対象: 要件 1.3**

### プロパティ3: オンデマンド課金モード

_任意の_ DatabaseConstructインスタンスにおいて、tablePropsでbillingModeが指定されない場合、作成されるテーブルの課金モードはPAY_PER_REQUESTである。

**検証対象: 要件 2.1**

### プロパティ4: カスタムパーティションキー

_任意の_ partitionKey設定において、指定されたパーティションキーが作成されるテーブルに正しく適用される。

**検証対象: 要件 3.1**

### プロパティ5: カスタムソートキー

_任意の_ sortKey設定において、指定されたソートキーが作成されるテーブルに正しく適用される。

**検証対象: 要件 3.2**

### プロパティ6: ソートキーなしテーブル

_任意の_ DatabaseConstructインスタンスにおいて、sortKeyがnullとして指定された場合、作成されるテーブルにはソートキーが存在しない。

**検証対象: 要件 3.3**

### プロパティ7: GSI追加

_任意の_ globalSecondaryIndexes設定において、指定されたGSIが作成されるテーブルに正しく追加される。

**検証対象: 要件 4.1**

### プロパティ8: tableProps上書き

_任意の_ tableProps設定において、指定されたプロパティがデフォルト設定を正しく上書きする。

**検証対象: 要件 5.1**

### プロパティ9: リソース参照公開

_任意の_ DatabaseConstructインスタンスにおいて、table、tableName、tableArnプロパティが正しく公開され、作成されたテーブルの情報と一致する。

**検証対象: 要件 6.1, 6.2, 6.3**

## エラーハンドリング

### バリデーション

DatabaseConstructは以下のバリデーションを行う：

1. **partitionKeyの型チェック**: CDKのAttribute型に準拠していることを確認
2. **GSI設定の整合性**: GSIのキー設定がテーブルのキー設定と矛盾しないことを確認

### エラーメッセージ

CDKの標準的なバリデーションエラーメッセージを使用する。カスタムバリデーションは最小限に抑え、CDKの既存機能を活用する。

## テスト戦略

### テストアプローチ

CDK Assertionsライブラリを使用したユニットテストを実施する。Template.fromStack()を使用してCloudFormationテンプレートを検証する。

### テストケース

1. **デフォルト設定テスト**
   - デフォルトのPK/SKが正しく設定されること
   - オンデマンド課金モードが設定されること
   - RemovalPolicy.DESTROYが設定されること

2. **カスタムキーテスト**
   - カスタムpartitionKeyが正しく適用されること
   - カスタムsortKeyが正しく適用されること
   - sortKey: nullでソートキーなしテーブルが作成されること

3. **GSIテスト**
   - GSIが正しく追加されること
   - 複数GSIが追加できること

4. **tablePropsテスト**
   - tablePropsでデフォルト設定が上書きされること
   - billingModeの上書きが機能すること

5. **出力テスト**
   - table、tableName、tableArnが正しく公開されること

### テストファイル構成

```
test/
└── constructs/
    └── database-construct.test.ts
```

### テスト実装例

```typescript
import { App, Stack } from 'aws-cdk-lib/core';
import { Template } from 'aws-cdk-lib/assertions';
import { DatabaseConstruct } from '../../lib/constructs/database-construct';

describe('DatabaseConstruct', () => {
  test('creates table with default PK and SK', () => {
    const app = new App();
    const stack = new Stack(app, 'TestStack');

    new DatabaseConstruct(stack, 'Database');

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  });
});
```
