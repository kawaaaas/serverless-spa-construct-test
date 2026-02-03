# 実装計画: DatabaseConstruct

## 概要

DynamoDBテーブルを作成する低レベルCDKコンストラクトを実装する。シングルテーブル設計をデフォルトとし、Propsによる柔軟なカスタマイズをサポートする。

## タスク

- [ ] 1. DatabaseConstructの基本実装
  - [ ] 1.1 DatabaseConstructPropsインターフェースを定義する
    - tableName, partitionKey, sortKey, globalSecondaryIndexes, tablePropsの5つのオプショナルプロパティを定義
    - JSDocコメントでデフォルト値を明記
    - _要件: 1.1, 1.2, 1.3, 3.1, 3.2, 4.1, 5.1_
  - [ ] 1.2 DatabaseConstructクラスを実装する
    - table, tableName, tableArnの3つのpublic readonlyプロパティを定義
    - デフォルトでPK/SK（文字列型）、オンデマンド課金、RemovalPolicy.DESTROYを設定
    - sortKey: nullの場合はソートキーなしでテーブルを作成
    - globalSecondaryIndexesが指定された場合はGSIを追加
    - tablePropsでデフォルト設定を上書き可能に
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

- [ ] 2. ユニットテストの実装
  - [ ] 2.1 デフォルト設定のテストを実装する
    - デフォルトのPK/SKが正しく設定されることを検証
    - オンデマンド課金モードが設定されることを検証
    - RemovalPolicy.DESTROYが設定されることを検証
    - _要件: 1.2, 1.3, 2.1, 5.3_
  - [ ] 2.2 カスタムキー設定のテストを実装する
    - カスタムpartitionKeyが正しく適用されることを検証
    - カスタムsortKeyが正しく適用されることを検証
    - sortKey: nullでソートキーなしテーブルが作成されることを検証
    - _要件: 3.1, 3.2, 3.3_
  - [ ] 2.3 GSIとtablePropsのテストを実装する
    - GSIが正しく追加されることを検証
    - tablePropsでデフォルト設定が上書きされることを検証
    - _要件: 4.1, 5.1, 5.2_
  - [ ] 2.4 出力プロパティのテストを実装する
    - table, tableName, tableArnが正しく公開されることを検証
    - _要件: 6.1, 6.2, 6.3_

- [ ] 3. チェックポイント - テスト実行
  - 全てのテストが通ることを確認し、問題があればユーザーに確認する

- [ ] 4. エクスポートとドキュメント
  - [ ] 4.1 lib/index.tsでDatabaseConstructをエクスポートする
    - DatabaseConstructとDatabaseConstructPropsをエクスポート
    - _要件: 6.1_

- [ ] 5. 最終チェックポイント
  - 全てのテストが通ることを確認し、問題があればユーザーに確認する

## 備考

- テストはCDK Assertionsライブラリを使用
- コードとコメントは英語で記述
- ファイルパス: lib/constructs/database-construct.ts, test/constructs/database-construct.test.ts
