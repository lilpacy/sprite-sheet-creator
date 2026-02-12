## Principles

web検索が必要な場合は、ais mcpサーバーのgpt5_reason_browseツールをreasoning_effort lowで使うこと。
エラー解決できない場合は、ais mcpサーバーのgpt5_reason_browseツールをreasoning_effort mediumで使うこと。
それでもエラー解決できない場合は、ais mcpサーバーのgpt5_reason_browseツールをreasoning_effort highで使うこと。

## 出力スタイル

- **人間向けの説明テキスト**は、1回の返信あたり最大40行に収める。
- ただし、以下は40行制限の対象外とする:
  - Write, Edit, MultiEdit, Task などの**ツールに渡すコードやファイル内容**
  - コードブロック内のコード
- 大きなコードを生成・編集する場合は、ツール呼び出しを複数回に分割してよい。
- コード生成の途中で出力が打ち切られそうな場合でも、ユーザーに continue を入力させず、自分で次のステップを提案してツールを呼び出して続行すること。

