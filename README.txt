Yappanese N5 判定テスト
=======================

■ 使い方（PCで確認する）

1. このフォルダの中身をすべて同じ場所に置く
2. index.html をダブルクリック

   ※ ダブルクリックで動かない場合（questions.json が読めない）は、
     PowerShell でこのフォルダに移動し、以下を実行する。

       python -m http.server 8000

     ブラウザで http://localhost:8000 を開く。


■ スマホで使う

ブラウザで開き、「ホーム画面に追加」を選ぶとアプリとして使える。
そのためには HTTPS で公開する必要がある。

  無料で公開する例：
    1. github.com にファイルをアップロード
    2. Settings → Pages → 公開
    → https://ユーザー名.github.io/リポジトリ名/ で使える


■ ファイル

  index.html       アプリ本体
  questions.json   問題30問
  manifest.json    PWA設定
  sw.js            オフライン対応
  icon-192.png     アイコン
  icon-512.png     アイコン


■ 問題を変える

questions.json を編集する。
answer は「正解の選択肢が choices の何番目か」（0から数える）。
アプリ側で選択肢を毎回シャッフルするので、
answer をすべて 0 にしておいても問題ない。


■ 注意

JLPT公式問題ではない。
JLPT N5 の出題形式と難易度に準拠して作成した自作の評価ツール。
入管に提出する際は、その旨を明記すること。
