# テスト戦略

## テストの種類

### 1. スナップショットテスト

CloudFormationテンプレートの変更を検知する。

```typescript
import { Template } from 'aws-cdk-lib/assertions';

test('snapshot test', () => {
  const app = new App();
  const stack = new MyStack(app, 'TestStack');
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
```

### 2. Fine-grained Assertions

特定のリソースが正しく作成されることを検証する。

```typescript
test('creates S3 bucket with correct settings', () => {
  const template = Template.fromStack(stack);
  
  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [{
        ServerSideEncryptionByDefault: {
          SSEAlgorithm: 'AES256'
        }
      }]
    }
  });
});
```

### 3. 統合テスト（手動）

実際にデプロイして動作確認を行う。

- CloudFront経由でSPAにアクセスできること
- API Gateway経由でLambdaが呼び出せること
- Cognito認証が機能すること

## テストファイル構成

```
test/
├── constructs/
│   ├── serverless-spa.test.ts
│   ├── frontend-construct.test.ts
│   ├── auth-construct.test.ts
│   ├── api-construct.test.ts
│   └── database-construct.test.ts
└── snapshot/
    └── main-stack.test.ts
```

## テスト実行

```bash
# Run all tests
npm test

# Run specific test
npm test -- --testPathPattern=serverless-spa

# Update snapshots
npm test -- -u
```

## テスト方針

- 各コンストラクトに対してユニットテストを作成
- 重要なリソース設定はFine-grained Assertionsで検証
- スナップショットテストで意図しない変更を検知
- 統合テストは手動でデプロイして確認

## カバレッジ目標

- 全コンストラクトのProps検証
- セキュリティ関連設定の検証
- リソース間の依存関係の検証
