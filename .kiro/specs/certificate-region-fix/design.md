# ACM証明書リージョン修正 バグフィックス設計

## 概要

FrontendConstructがACM証明書をメインスタックのリージョン（例: ap-northeast-1）で作成してしまい、CloudFrontがus-east-1の証明書のみを受け付けるためデプロイが失敗するバグを修正する。

修正アプローチ: 既存のクロスリージョンパターン（ServerlessSpaSecurityConstruct → SSM → AwsCustomResource）に従い、ACM証明書をus-east-1のセキュリティスタックで作成し、SSMパラメータ経由でメインスタックに共有する。FrontendConstructの自前証明書作成ロジックは削除し、外部からの証明書注入を必須とする。

## 用語集

- **Bug_Condition (C)**: FrontendConstructがdomainNameを受け取り、certificateが未指定の場合にメインスタックリージョンで`new Certificate()`を実行する条件
- **Property (P)**: ACM証明書がus-east-1で作成され、SSM経由でメインスタックに共有され、CloudFrontに正しく適用される動作
- **Preservation**: カスタムドメインなしのデプロイ（minimal、withWaf）、既存のSSMクロスリージョン取得、WAF/Secret/Lambda@Edge作成が変更されない
- **CertificateConstruct**: us-east-1セキュリティスタックに新規作成するACM証明書コンストラクト
- **ServerlessSpaSecurityConstruct**: us-east-1にデプロイされるセキュリティリソース管理コンストラクト（WAF、Secret、Lambda@Edge、SSM）
- **ServerlessSpaConstruct**: メインリージョンにデプロイされるSPAインフラ管理コンストラクト
- **FrontendConstruct**: S3 + CloudFrontの静的ホスティングコンストラクト
- **SsmConstruct**: SSMパラメータストアによるクロスリージョン値共有コンストラクト

## バグ詳細

### 障害条件

`ServerlessSpaConstruct.withCustomDomain()`または`withCustomDomainAndWaf()`を使用した場合、FrontendConstructがメインスタックリージョンで`new Certificate()`を実行する。CloudFrontはus-east-1の証明書のみを受け付けるため、ap-northeast-1等で作成された証明書ではデプロイが失敗する。

**形式仕様:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type FrontendConstructProps
  OUTPUT: boolean

  RETURN input.domainName IS NOT undefined
         AND input.certificate IS undefined
         AND input.hostedZoneId IS NOT undefined
         AND input.zoneName IS NOT undefined
         AND Stack.of(this).region != 'us-east-1'
END FUNCTION
```

### 具体例

- `ServerlessSpaConstruct.withCustomDomain()` で domainName='www.example.com' を ap-northeast-1 にデプロイ → FrontendConstructが ap-northeast-1 で証明書作成 → CloudFrontが `Invalid request provided: The specified SSL certificate doesn't exist, isn't in us-east-1 region` エラーで失敗
- `ServerlessSpaConstruct.withCustomDomainAndWaf()` で domainName='app.example.com' を ap-northeast-1 にデプロイ → 同様のリージョン不一致エラーで失敗
- FrontendConstructに domainName と hostedZoneId/zoneName を渡すが certificate を渡さない → メインスタックリージョンで無効な証明書が作成される
- FrontendConstructに domainName と certificate（us-east-1で作成済み）を渡す → 正常動作（これは変更しない）

## 期待される動作

### 保全要件

**変更されない動作:**

- `ServerlessSpaConstruct.minimal()` によるCloudFrontデフォルトドメインでのデプロイ
- `ServerlessSpaConstruct.withWaf()` によるWAF保護付きデプロイ（カスタムドメインなし）
- FrontendConstructに外部作成済みの certificate を直接渡した場合の動作
- ServerlessSpaSecurityConstructの既存ファクトリメソッド（`minimal`、`withWaf`）の動作
- 既存のSSMパラメータ（waf-acl-arn、custom-header-name、secret-arn、edge-function-version-arn）のクロスリージョン取得
- FrontendConstructのS3バケット、CloudFront Function（SPAルーティング）、API Gatewayルーティング、WAF WebACL適用

**スコープ:**
カスタムドメインを使用しないデプロイパス、および外部から証明書を直接注入するパスは、この修正の影響を一切受けない。

## 仮説的根本原因

バグの分析に基づき、最も可能性の高い原因は以下の通り:

1. **FrontendConstructの証明書自動作成ロジック**: FrontendConstructの `constructor` 内で `new Certificate()` を実行しており、これはスタックのリージョンで証明書を作成する。CloudFrontはus-east-1の証明書のみを受け付けるため、メインスタックがus-east-1以外の場合に失敗する
   - 該当コード: `frontend-construct.ts` の行 189-196
   - `Certificate` コンストラクトはスタックのリージョンにリソースを作成する
   - CloudFrontの `ViewerCertificate` はus-east-1のACM証明書のみをサポート

2. **アーキテクチャ設計の欠陥**: 証明書作成がメインスタック側に配置されている設計自体が問題。WAFやLambda@Edgeと同様に、CloudFrontが必要とするグローバルリソースはus-east-1のセキュリティスタックで作成すべき

3. **クロスリージョンパターンの未適用**: WAF、Secret、Lambda@Edgeには既にSSM経由のクロスリージョン共有パターンが実装されているが、ACM証明書にはこのパターンが適用されていない

## 正当性プロパティ

Property 1: 障害条件 - ACM証明書のus-east-1作成

_For any_ デプロイ構成で、カスタムドメインが指定され（domainName、hostedZoneId、zoneName）、`ServerlessSpaSecurityConstruct.withCertificate()`または`withWafAndCertificate()`を使用した場合、修正後のコードはus-east-1でACM証明書を作成し、SSMパラメータ（`{ssmPrefix}certificate-arn`）に証明書ARNを保存し、メインスタックのServerlessSpaConstructがSSM経由で証明書ARNを取得してFrontendConstructのCloudFrontディストリビューションに正しく適用する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: 保全 - カスタムドメインなしデプロイの動作維持

_For any_ デプロイ構成で、カスタムドメインが指定されない場合（`minimal()`、`withWaf()`）、修正後のコードは修正前と同一の動作を維持し、CloudFrontデフォルトドメインでの正常デプロイ、WAF保護、既存SSMパラメータのクロスリージョン取得が変更されない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## 修正実装

### 必要な変更

根本原因分析が正しいと仮定して:

**ファイル**: `lib/constructs/certificate-construct.ts`（新規作成）

**変更内容**:

1. **CertificateConstruct新規作成**: WafConstructと同様の低レベルコンストラクトとして、us-east-1でACM証明書を作成する
   - Props: `domainName`（必須）、`hostedZoneId`（必須）、`zoneName`（必須）、`alternativeDomainNames`（オプション）
   - DNS検証を使用（`CertificateValidation.fromDns(hostedZone)`）
   - 公開プロパティ: `certificate: ICertificate`、`certificateArn: string`

**ファイル**: `lib/constructs/ssm-construct.ts`

**変更内容**: 2. **SsmConstructProps拡張**: `certificateArn?: string` プロパティを追加

- 新しいSSMパラメータ `{ssmPrefix}certificate-arn` を条件付きで作成
- 公開プロパティ: `certificateArnParameter?: IStringParameter`

**ファイル**: `lib/constructs/serverless-spa-security-construct.ts`

**変更内容**: 3. **新規ファクトリメソッド追加**:

- `withCertificate(scope, id, props: WithCertificateSecurityProps)`: カスタムヘッダー + 証明書（WAFなし）
- `withWafAndCertificate(scope, id, props: WithWafAndCertificateSecurityProps)`: WAF + カスタムヘッダー + 証明書

4. **Props型追加**: `WithCertificateSecurityProps`、`WithWafAndCertificateSecurityProps`
   - domainName、hostedZoneId、zoneName、alternativeDomainNames を含む
5. **コンストラクタ拡張**: `enableCertificate`フラグとドメイン関連propsを受け取り、CertificateConstructを条件付きで作成
6. **SSM連携**: 証明書ARNをSsmConstructに渡してSSMパラメータに保存
7. **公開プロパティ追加**: `certificateConstruct?: CertificateConstruct`、`certificateArn?: string`

**ファイル**: `lib/constructs/serverless-spa.ts`

**変更内容**: 8. **withCustomDomain / withCustomDomainAndWaf修正**: セキュリティスタックからSSM経由で証明書ARNを取得するパターンに変更

- `WithCustomDomainProps`にssmPrefix、securityRegionを追加
- `WithCustomDomainAndWafProps`は既にssmPrefixを持つため変更不要
- SSMリーダーで`certificate-arn`パラメータを追加取得
- `Certificate.fromCertificateArn()`でICertificateに変換してFrontendConstructに渡す

9. **hostedZoneId/zoneNameの削除**: メインスタック側ではドメイン名のみ必要（証明書はSSM経由で取得）。ただしRoute53 AレコードはFrontendConstructで作成するため、hostedZoneId/zoneNameは引き続き必要

**ファイル**: `lib/constructs/frontend-construct.ts`

**変更内容**: 10. **自前証明書作成ロジック削除**: `new Certificate()` による自動作成コードを削除11. **バリデーション変更**: domainNameが指定されcertificateが未指定の場合、hostedZoneId/zoneNameの有無に関わらずエラーをスローし、証明書の外部注入を必須とする - エラーメッセージ: 証明書はus-east-1で作成する必要があり、ServerlessSpaSecurityConstructのwithCertificate/withWafAndCertificateを使用するか、外部で作成した証明書を渡すよう案内12. **import削除**: `Certificate`、`CertificateValidation` のimportを削除（不要になるため）

**ファイル**: `lib/index.ts`

**変更内容**: 13. **エクスポート追加**: `CertificateConstruct` と関連Props型をパブリックAPIとしてエクスポート

## テスト戦略

### 検証アプローチ

テスト戦略は2段階のアプローチに従う: まず未修正コードでバグを再現するカウンターサンプルを表面化させ、次に修正が正しく動作し既存動作が保全されることを検証する。

### 探索的障害条件チェック

**目標**: 修正実装前にバグを再現するカウンターサンプルを表面化させ、根本原因分析を確認または反証する。反証した場合は再仮説が必要。

**テスト計画**: FrontendConstructにdomainNameとhostedZoneId/zoneNameを渡し、certificateを渡さない場合のテンプレートを検証する。未修正コードでは`AWS::CertificateManager::Certificate`がメインスタックリージョンで作成されることを確認する。

**テストケース**:

1. **FrontendConstruct証明書自動作成テスト**: domainNameとhostedZoneId/zoneNameを渡し、certificateを渡さない → `AWS::CertificateManager::Certificate`リソースがFrontendConstruct内に作成される（未修正コードで発生）
2. **withCustomDomainファクトリメソッドテスト**: withCustomDomainでデプロイ構成を作成 → FrontendConstruct内に証明書が作成される（未修正コードで発生）
3. **withCustomDomainAndWafファクトリメソッドテスト**: withCustomDomainAndWafでデプロイ構成を作成 → FrontendConstruct内に証明書が作成される（未修正コードで発生）

**期待されるカウンターサンプル**:

- FrontendConstruct内に`AWS::CertificateManager::Certificate`リソースが作成される
- 原因: FrontendConstructのコンストラクタ内で`new Certificate()`が実行されている

### 修正チェック

**目標**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**擬似コード:**

```
FOR ALL input WHERE isBugCondition(input) DO
  securityStack := ServerlessSpaSecurityConstruct.withCertificate(input)
  template := Template.fromStack(securityStack)
  ASSERT template HAS 'AWS::CertificateManager::Certificate'
  ASSERT template HAS SSM Parameter '{ssmPrefix}certificate-arn'

  mainStack := ServerlessSpaConstruct.withCustomDomain(input)
  mainTemplate := Template.fromStack(mainStack)
  ASSERT mainTemplate HAS CloudFront Distribution WITH certificate
  ASSERT mainTemplate DOES NOT HAVE 'AWS::CertificateManager::Certificate'
END FOR
```

### 保全チェック

**目標**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同一の結果を生成することを検証する。

**擬似コード:**

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT ServerlessSpaConstruct_original(input) = ServerlessSpaConstruct_fixed(input)
END FOR
```

**テストアプローチ**: CDK assertions（Template.fromStack）を使用したスナップショット比較とfine-grained assertionsにより、非バグ入力に対する動作の同一性を検証する。

**テスト計画**: 未修正コードでminimal()、withWaf()、外部証明書直接渡しの動作を観察し、修正後も同一のCloudFormationテンプレートが生成されることを検証する。

**テストケース**:

1. **minimal()保全テスト**: domainNameなしでminimal()を使用 → CloudFrontデフォルトドメインで正常デプロイ、証明書リソースなし
2. **withWaf()保全テスト**: domainNameなしでwithWaf()を使用 → WAF付きで正常デプロイ、証明書リソースなし
3. **外部証明書直接渡し保全テスト**: FrontendConstructにdomainNameとcertificateを直接渡す → 提供された証明書がCloudFrontに適用
4. **既存SecurityConstruct保全テスト**: minimal()、withWaf()ファクトリメソッドが従来通り動作

### ユニットテスト

- **CertificateConstruct**: ACM証明書がDNS検証で作成されること、domainName/alternativeDomainNamesが正しく設定されること
- **SsmConstruct**: certificateArnが渡された場合にSSMパラメータが作成されること、渡されない場合は作成されないこと
- **ServerlessSpaSecurityConstruct**: withCertificate()で証明書+SSMパラメータが作成されること、withWafAndCertificate()でWAF+証明書+SSMパラメータが作成されること
- **FrontendConstruct**: domainNameありcertificateなしでバリデーションエラーがスローされること、certificateありで正常動作すること、自前証明書作成ロジックが削除されていること
- **ServerlessSpaConstruct**: withCustomDomain()でSSMから証明書ARNを取得しFrontendConstructに渡すこと、withCustomDomainAndWaf()で同様に動作すること

### プロパティベーステスト

- 任意のdomainName/hostedZoneId/zoneName組み合わせに対して、CertificateConstructが常にACM証明書を作成すること
- 任意のSSMパラメータ構成に対して、SsmConstructが指定されたパラメータのみを作成すること
- 任意のFrontendConstructProps（domainNameあり、certificateなし）に対して、常にバリデーションエラーがスローされること

### 統合テスト

- セキュリティスタック（us-east-1）でwithCertificate()を使用し、メインスタックでwithCustomDomain()を使用するフルフロー
- セキュリティスタックでwithWafAndCertificate()を使用し、メインスタックでwithCustomDomainAndWaf()を使用するフルフロー
- 既存のminimal() + minimal()構成が変更なく動作すること
