# 実装計画: ServerlessSpaSecurityConstruct

## 概要

ServerlessSpaSecurityConstructは、CloudFront用のWAF WebACLとSecrets Managerによるカスタムヘッダーローテーションを提供するus-east-1専用のL3コンストラクトである。低レベルコンストラクト（WafConstruct, SecretConstruct, SsmConstruct）を統合し、ServerlessSpaを拡張してクロスリージョンでのセキュリティ統合を実現する。

## コンストラクト階層

```
ServerlessSpaSecurityConstruct (高レベル)
├── WafConstruct (低レベル)
│   └── WAF WebACL (CLOUDFRONT scope)
├── SecretConstruct (低レベル)
│   ├── Secrets Manager Secret
│   └── Rotation Lambda
└── SsmConstruct (低レベル)
    ├── SSM Parameter (waf-acl-arn)
    ├── SSM Parameter (custom-header-name)
    └── SSM Parameter (secret-arn)
```

## タスク

- [x] 1. ServerlessSpaSecurityConstructの基本実装
  - [x] 1.1 ServerlessSpaSecurityConstructPropsインターフェースを定義する
    - waf, secret, ssm, removalPolicyプロパティを定義（低レベルコンストラクトのProps集合体）
    - _要件: 1.5, 3.4, 4.4_
  - [x] 1.2 ServerlessSpaSecurityConstructクラスの骨格を作成する
    - リージョンバリデーション（us-east-1チェック）を実装
    - 公開プロパティ（webAclArn, secretArn, customHeaderName, ssmPrefix）を定義
    - _要件: 8.4, 1.6, 2.3, 2.4_
  - [x] 1.3 リージョンバリデーションのユニットテストを作成する
    - us-east-1以外でエラーが発生することを検証
    - _要件: 8.4_

- [x] 2. WafConstruct実装（低レベル）
  - [x] 2.1 WafConstructPropsインターフェースを定義する
    - rateLimit, removalPolicyプロパティを定義
    - _要件: 1.5_
  - [x] 2.2 WafConstructクラスを実装する
    - SCOPE: CLOUDFRONTでWAF WebACLを作成
    - レート制限ルール（デフォルト2000/5分）を追加
    - AWSManagedRulesCommonRuleSetを追加
    - AWSManagedRulesSQLiRuleSetを追加
    - webAcl, webAclArnプロパティを公開
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [x] 2.3 WafConstructのユニットテストを作成する
    - SCOPE: CLOUDFRONTで作成されることを検証
    - 3つのルールが含まれることを検証
    - カスタムrateLimit値が反映されることを検証
    - _要件: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. SecretConstruct実装（低レベル）
  - [x] 3.1 SecretConstructPropsインターフェースを定義する
    - customHeaderName, rotationDays, ssmPrefix, removalPolicyプロパティを定義
    - _要件: 3.4_
  - [x] 3.2 SecretConstructクラスを実装する
    - カスタムヘッダー値を格納するシークレットを作成
    - 初期値としてランダムUUIDを生成
    - secret, secretArn, customHeaderNameプロパティを公開
    - _要件: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.3 ローテーションLambda関数を作成する
    - Node.js 20.xランタイムで作成
    - 新しいUUID値を生成してシークレットを更新
    - SSM Parameterも同時に更新
    - rotationFunctionプロパティを公開
    - _要件: 3.1, 3.2, 3.3_
  - [x] 3.4 シークレットローテーションを設定する
    - rotationDays間隔（デフォルト7日）でローテーション
    - _要件: 3.4, 3.5_
  - [x] 3.5 SecretConstructのユニットテストを作成する
    - シークレットが作成されることを検証
    - ローテーションLambdaが作成されることを検証
    - ローテーション設定が存在することを検証
    - カスタムrotationDays値が反映されることを検証
    - _要件: 2.1, 3.1, 3.4, 3.5_

- [x] 4. SsmConstruct実装（低レベル）
  - [x] 4.1 SsmConstructPropsインターフェースを定義する
    - ssmPrefix, webAclArn, customHeaderName, secretArnプロパティを定義
    - _要件: 4.4_
  - [x] 4.2 SsmConstructクラスを実装する
    - {ssmPrefix}waf-acl-arn パラメータを作成
    - {ssmPrefix}custom-header-name パラメータを作成
    - {ssmPrefix}secret-arn パラメータを作成
    - wafAclArnParameter, customHeaderNameParameter, secretArnParameter, ssmPrefixプロパティを公開
    - _要件: 4.1, 4.2, 4.3, 4.5, 4.6_
  - [x] 4.3 SsmConstructのユニットテストを作成する
    - 3つのパラメータが作成されることを検証
    - カスタムssmPrefixが反映されることを検証
    - デフォルトssmPrefixが使用されることを検証
    - _要件: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 5. ServerlessSpaSecurityConstruct統合実装
  - [x] 5.1 ServerlessSpaSecurityConstructで低レベルコンストラクトを統合する
    - WafConstructを作成
    - SecretConstructを作成（ssmPrefixを自動ワイヤリング）
    - SsmConstructを作成（webAclArn, customHeaderName, secretArnを自動ワイヤリング）
    - waf, secret, ssmプロパティを公開
    - 便利プロパティ（webAclArn, secretArn, customHeaderName, ssmPrefix）を公開
    - _要件: 1.6, 2.3, 2.4, 4.4_
  - [x] 5.2 ServerlessSpaSecurityConstruct統合のユニットテストを作成する
    - 全ての低レベルコンストラクトが作成されることを検証
    - Props透過的転送が機能することを検証
    - 便利プロパティが正しく公開されることを検証
    - _要件: 1.5, 3.4, 4.4_

- [x] 6. チェックポイント - ServerlessSpaSecurityConstruct完成確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

- [x] 7. ServerlessSpa拡張 - SecurityConfig追加
  - [x] 7.1 SecurityConfigインターフェースを定義する
    - ssmPrefix, securityRegionプロパティを定義
    - ServerlessSpaPropsにsecurityプロパティを追加
    - _要件: 5.1_
  - [x] 7.2 AwsCustomResourceでクロスリージョンSSM取得を実装する
    - us-east-1リージョンを明示的に指定
    - waf-acl-arn, custom-header-name, secret-arnを取得
    - _要件: 5.1, 5.4_
  - [x] 7.3 AwsCustomResourceのユニットテストを作成する
    - securityプロパティ指定時にAwsCustomResourceが作成されることを検証
    - us-east-1リージョンが指定されることを検証
    - _要件: 5.1, 5.4_

- [x] 8. FrontendConstruct拡張 - WAF適用
  - [x] 8.1 FrontendConstructPropsにwebAclArnプロパティを追加する
    - オプショナルプロパティとして定義
    - _要件: 6.1_
  - [x] 8.2 CloudFrontディストリビューションにWAF WebACLを適用する
    - webAclArnが指定された場合のみ適用
    - _要件: 6.1, 6.2_
  - [x] 8.3 CloudFront WAF適用のユニットテストを作成する
    - webAclArn指定時にWAFが適用されることを検証
    - webAclArn未指定時にWAFが適用されないことを検証
    - _要件: 6.1, 6.2_

- [x] 9. ApiConstruct拡張 - Secrets Manager統合
  - [x] 9.1 ApiConstructPropsにsecretArnプロパティを追加する
    - オプショナルプロパティとして定義
    - _要件: 7.1_
  - [x] 9.2 LambdaにSecrets Manager読み取り権限を付与する
    - secretArnが指定された場合のみ権限を付与
    - _要件: 7.1_
  - [x] 9.3 ApiConstruct Secrets Manager統合のユニットテストを作成する
    - secretArn指定時にLambdaがSecrets Manager権限を持つことを検証
    - _要件: 7.1_

- [x] 10. ServerlessSpa統合
  - [x] 10.1 ServerlessSpaでセキュリティ設定を統合する
    - securityプロパティが指定された場合、AwsCustomResourceで値を取得
    - 取得した値をFrontendConstructとApiConstructに渡す
    - _要件: 5.2, 5.3_
  - [x] 10.2 ServerlessSpaセキュリティ統合のユニットテストを作成する
    - securityプロパティ指定時にCloudFrontにWAFが適用されることを検証
    - securityプロパティ指定時にLambdaがSecrets Manager権限を持つことを検証
    - _要件: 5.2, 5.3, 6.1, 7.1_

- [x] 11. チェックポイント - 全体統合確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

- [x] 12. エクスポートとドキュメント
  - [x] 12.1 lib/index.tsにコンストラクトをエクスポートする
    - ServerlessSpaSecurityConstruct, ServerlessSpaSecurityConstructPropsをエクスポート
    - WafConstruct, WafConstructPropsをエクスポート
    - SecretConstruct, SecretConstructPropsをエクスポート
    - SsmConstruct, SsmConstructPropsをエクスポート
  - [x] 12.2 コンストラクトにJSDocコメントを追加する
    - クラス、プロパティ、メソッドにドキュメントを追加

- [x] 13. 最終チェックポイント
  - 全てのテストが通ることを確認し、質問があればユーザーに確認する

## 備考

- 全てのタスクは必須（テスト含む）
- 各タスクは要件ドキュメントの該当要件を参照
- TypeScriptで実装、コメントは英語で記述
- 実装後は `npm run format` と `npm run lint` を実行
- 低レベルコンストラクトは単独でも使用可能な設計とする
