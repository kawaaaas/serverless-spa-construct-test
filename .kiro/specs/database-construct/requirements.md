# 要件ドキュメント

## はじめに

DatabaseConstructは、サーバーレスSPAアプリケーション向けのDynamoDBテーブルを作成する低レベルCDKコンストラクトである。シングルテーブル設計をデフォルトとし、オンデマンドキャパシティによるコスト最適化を実現する。他のコンストラクトから独立して使用可能であり、Propsによる柔軟なカスタマイズをサポートする。

## 用語集

- **DatabaseConstruct**: DynamoDBテーブルを作成するCDKコンストラクト
- **Table**: 作成されるDynamoDBテーブルリソース
- **PartitionKey**: DynamoDBテーブルのパーティションキー属性
- **SortKey**: DynamoDBテーブルのソートキー属性
- **GSI**: グローバルセカンダリインデックス（Global Secondary Index）
- **BillingMode**: DynamoDBの課金モード（オンデマンドまたはプロビジョンド）
- **Props**: コンストラクトの設定パラメータ

## 要件

### 要件1: テーブル作成

**ユーザーストーリー:** 開発者として、DynamoDBテーブルを簡単に作成したい。最小限の設定でシングルテーブル設計のテーブルをデプロイできるようにする。

#### 受け入れ基準

1. WHEN DatabaseConstructがインスタンス化される THEN THE Table SHALL パーティションキーを持つDynamoDBテーブルを作成する
2. WHEN partitionKeyが指定されない THEN THE Table SHALL デフォルトで"PK"（文字列型）をパーティションキーとして使用する
3. WHEN sortKeyが指定されない THEN THE Table SHALL デフォルトで"SK"（文字列型）をソートキーとして使用する
4. WHEN tableNameが指定される THEN THE Table SHALL 指定された名前でテーブルを作成する
5. WHEN tableNameが指定されない THEN THE Table SHALL CDKが自動生成する名前を使用する

### 要件2: コスト最適化

**ユーザーストーリー:** 個人開発者として、最小限のコストでDynamoDBを利用したい。デフォルト設定でコスト最適化された構成になるようにする。

#### 受け入れ基準

1. THE Table SHALL デフォルトでオンデマンド課金モード（PAY_PER_REQUEST）を使用する
2. WHEN tablePropsでbillingModeが指定される THEN THE Table SHALL 指定された課金モードを使用する
3. THE Table SHALL デフォルトでポイントインタイムリカバリを無効にする

### 要件3: キーのカスタマイズ

**ユーザーストーリー:** 開発者として、アプリケーションの要件に合わせてテーブルのキー設計をカスタマイズしたい。

#### 受け入れ基準

1. WHEN partitionKeyが指定される THEN THE Table SHALL 指定されたパーティションキーを使用する
2. WHEN sortKeyが指定される THEN THE Table SHALL 指定されたソートキーを使用する
3. WHEN sortKeyがnullとして明示的に指定される THEN THE Table SHALL ソートキーなしでテーブルを作成する

### 要件4: グローバルセカンダリインデックス

**ユーザーストーリー:** 開発者として、クエリパターンに応じてGSIを追加したい。

#### 受け入れ基準

1. WHEN globalSecondaryIndexesが指定される THEN THE Table SHALL 指定されたGSIをテーブルに追加する
2. WHEN globalSecondaryIndexesが指定されない THEN THE Table SHALL GSIなしでテーブルを作成する

### 要件5: 詳細設定のカスタマイズ

**ユーザーストーリー:** 開発者として、CDKのTablePropsを使用してテーブルの詳細設定をカスタマイズしたい。

#### 受け入れ基準

1. WHEN tablePropsが指定される THEN THE Table SHALL 指定されたプロパティでデフォルト設定を上書きする
2. WHEN tablePropsでremovalPolicyが指定される THEN THE Table SHALL 指定された削除ポリシーを使用する
3. THE Table SHALL デフォルトでRemovalPolicy.DESTROYを使用する（開発環境向け）

### 要件6: リソース参照の公開

**ユーザーストーリー:** 開発者として、作成されたテーブルを他のコンストラクトから参照したい。

#### 受け入れ基準

1. THE DatabaseConstruct SHALL tableプロパティとしてITable型のテーブル参照を公開する
2. THE DatabaseConstruct SHALL tableNameプロパティとしてテーブル名を公開する
3. THE DatabaseConstruct SHALL tableArnプロパティとしてテーブルARNを公開する
