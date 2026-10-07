// 設定のデフォルト値。content script と設定画面の両方が読み込む（定義はここだけに置く）
// 数値の 0 は「YouTube の既定のまま」を表す
var TubeLayoutDefaults = {
  enabled: true,

  // YouTube の新しい再生ページのレイアウト（関連動画がプレイヤーの下に並ぶ形）を使わず、以前のレイアウトにする。
  // ページ側の page.js が読むので、変えたら YouTube のタブを読み込み直したときに反映される
  classicLayout: true,
  // この幅（px）以上のウィンドウでは 2 列（右に関連動画）で表示する。YouTube の既定は 1000px。0 は YouTube の既定のまま。
  // classicLayout と同じく page.js が読み、タブを読み込み直したときに反映される
  twoColumnMinWidth: 800,

  // 右端のアイコン列（概要・コメントなどのパネルを開くボタン。サイドレール）
  sideRail: 'default', // default（右端に縦） | top（右の列の先頭に横一列） | hidden

  // プレイヤー
  playerFill: false, // 横幅いっぱいに広げる（画面の高さに収める上限を外す。左右の余白が出なくなる）
  playerMaxHeight: 0, // 高さの上限（画面の高さに対する %）
  playerMaxWidth: 0, // 幅の上限（px）
  playerSquare: false, // 角を丸めない
  hideAmbient: false, // プレイヤーの周りの光（アンビエント モード）を消す

  // 関連動画
  relatedPosition: 'right', // right | left | hidden
  sidebarWidth: 0, // 横の列の幅（px）
  relatedThumbWidth: 0, // サムネイルの幅（px）
  relatedTextSize: 0, // タイトルの文字の大きさ（px）
  hideRelatedChips: false, // 上の絞り込みボタン（すべて・関連動画 など）
  hideRelatedShorts: false, // ショート動画の棚

  // コメント・概要欄
  commentsPosition: 'below', // below | side | hidden
  sideCommentsHeight: 0, // 横の列に置いたコメント欄の高さ（画面の高さに対する %）
  expandDescription: false, // 概要欄を最初から開く

  // タイトル・ボタン
  titleSize: 0, // タイトルの文字の大きさ（px）
  hideActionLabels: false, // 共有・保存などのボタンの文字を隠す（高評価の数は残す）
  hideActions: false, // ボタンの列ごと隠す
  hideShelves: false, // チケット・グッズ・ショッピングの棚
};
