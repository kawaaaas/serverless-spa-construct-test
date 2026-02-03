# 実装計画: AuthConstruct

## 概要

Cognito User Poolを作成する低レベルCDKコンストラクトを実装する。Liteティアをデフォルトで使用し、SPA認証に最適化された設定を提供する。

## タスク

- [ ] 1. AuthConstructの基本実装
  - [ ] 1.1 AuthConstructPropsインターフェースを定義する
    - userPoolProps?: Partial<UserPoolProps>
    - userPoolClientProps?: Partial<UserPoolClientProps>
    - _要件: 1.5, 2.5_
  - [ ] 1.2 AuthConstructクラスの基本構造を実装する
    - Constructを継承
    - 公開プロパティ: userPool, userPoolClient, userPoolId, userPoolClientId
    - _要件: 5.1, 5.2, 5.3, 5.4_

- [ ] 2. User Pool実装
  - [ ] 2.1 デフォルト設定でUser Poolを作成する
    - セルフサインアップ有効
    - メールアドレスをサインインエイリアスとして使用
    - メールアドレスの自動検証有効
    - 削除ポリシーは設定しない（スタックレベルで管理）
    - _要件: 1.1, 1.2, 1.3, 1.4, 6.1_
  - [ ] 2.2 パスワードポリシーを設定する
    - 最小長: 8文字
    - 小文字必須
    - 数字必須
    - _要件: 4.1, 4.2, 4.3_
  - [ ] 2.3 userPoolPropsによる上書き機能を実装する
    - スプレッド演算子でデフォルト設定とマージ
    - _要件: 1.5, 4.4_

- [ ] 3. User Pool Client実装
  - [ ] 3.1 デフォルト設定でUser Pool Clientを作成する
    - クライアントシークレットなし（generateSecret: false）
    - USER_SRP_AUTH認証フロー有効
    - ALLOW_REFRESH_TOKEN_AUTH認証フロー有効
    - _要件: 2.1, 2.2, 2.3, 2.4_
  - [ ] 3.2 userPoolClientPropsによる上書き機能を実装する
    - スプレッド演算子でデフォルト設定とマージ
    - _要件: 2.5_

- [ ] 4. チェックポイント - 実装確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

- [ ] 5. ユニットテスト実装
  - [ ] 5.1 User Pool作成テストを実装する
    - User Poolリソースが作成されること
    - セルフサインアップが有効であること
    - メールアドレスがサインインエイリアスとして設定されること
    - _要件: 1.1, 1.2, 1.3, 1.4_
  - [ ] 5.2 パスワードポリシーテストを実装する
    - 最小パスワード長が8文字であること
    - 小文字・数字が必須であること
    - _要件: 4.1, 4.2, 4.3_
  - [ ] 5.3 User Pool Clientテストを実装する
    - クライアントシークレットが生成されないこと
    - 認証フローが正しく設定されること
    - _要件: 2.1, 2.2, 2.3, 2.4_
  - [ ] 5.4 Props上書きテストを実装する
    - userPoolPropsでデフォルト設定が上書きされること
    - userPoolClientPropsでデフォルト設定が上書きされること
    - _要件: 1.5, 2.5_
  - [ ] 5.5 出力プロパティテストを実装する
    - userPool, userPoolClient, userPoolId, userPoolClientIdが公開されること
    - _要件: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. エクスポート設定
  - [ ] 6.1 lib/index.tsにAuthConstructをエクスポートする
    - AuthConstruct, AuthConstructPropsをエクスポート

- [ ] 7. 最終チェックポイント
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

## 備考

- 実装言語: TypeScript
- テストフレームワーク: Jest + CDK Assertions
- ファイル配置: lib/constructs/auth-construct.ts, test/constructs/auth-construct.test.ts
