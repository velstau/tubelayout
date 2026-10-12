# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

TubeLayout：YouTube の再生ページの配置（プレイヤーの大きさ・関連動画・コメント・概要欄・タイトル周り）を設定で変える Chrome 拡張。Manifest V3・素の JS/HTML/CSS でビルドはない。**リポジトリ直下がそのまま拡張のフォルダ**で、Chrome の「パッケージ化されていない拡張機能を読み込む」で直接読み込める。MIT。

UI の文字サイズは最低 1.0rem にする（ユーザーの必須要望）。設定画面は、左に設定と連動する再生ページの見取り図、右に設定（図入りの選択肢・スライダー・チェックボックス）という構成で、ユーザーは「かなり使いやすい」と評価している。見た目はデジタル庁デザインシステム（DADS）準拠（ユーザーの要望）: 色は DADS のプリミティブ／ニュートラルカラー（公式 design-tokens の値。`options.css` の `:root` にトークン名を併記）、文字は Noto Sans JP と DADS のテキストスタイル（Std・Oln）、余白は 8px 単位、角丸は 8px／12px、フォーカスは Yellow-300 と Black の二重構造（変えてはいけない）。文字は 4.5:1 以上、枠線などは 3:1 以上のコントラストを守る。DADS にない切り替えスイッチは使わずチェックボックスにする。OS がダークモードでも白背景で表示する（ユーザーの要望）

## コマンド

```sh
# JS の構文チェック（ホストに node はないので使い捨てコンテナで）
docker run --rm -v "$PWD":/w -w /w node:24-alpine sh -c 'for f in *.js; do node --check $f || exit 1; done'

# 実際の YouTube で設定ごとの配置を記録する（使い方は test/README.md）
python3 test/layout_sim.py
```

単体テストはない。YouTube の DOM に依存するので、変更したら `test/layout_sim.py` で実際のページで確かめる。

## アーキテクチャ

- **ユーザーの画面の実際の原因（0.4.0 で確定）**：`ytd-watch-flexy` のまま、右端のアイコン列（サイドレール、サーバーのデータの `twoColumnWatchNextResults.fixedSideMenu`）と「閉じられるパネル」の実験（`web_side_rail_dismissible_panels` ほか）が有効で、パネルを閉じている間は関連動画（`#related`）を `#below` へ移してグリッドで並べ、プレイヤーを中央に大きく出す。内部状態は「2 列」のままなので、`is-two-columns_` を見ても気づけない。page.js の `CLASSIC_OFF` でこれらのフラグを false にする。グリッドへの差し替えのフラグだけを切ると「固定パネルを開いている間は関連動画を隠す」処理が働くので、固定パネル・分割スクロールのフラグも切っている。このフラグ一式は `test/flags_side_rail.txt`（ユーザーの画面から書き出したもの）で再現できる
- 画面の状態の書き出しは `test/collect.js`（コンソールに貼ると JSON をクリップボードへコピーする。データは構造だけで中身は入れない）。推測で直さず、まずこれでユーザーの実際の状態をもらう
- **YouTube の再生ページは 3 種類ある。** 実験フラグで `kevlar_watch_fixie` → `ytd-watch-fixie`、`kevlar_watch_grid` → `ytd-watch-grid`、どちらもなければ `ytd-watch-flexy`（以前のレイアウト）。ユーザーのログイン中のアカウントには `ytd-watch-grid`（関連動画がプレイヤーの下にグリッドで並び、右の列にタイトル・概要欄・コメント）が出ていた。ログインしていない状態では `ytd-watch-flexy` しか出ないので、ログインなしの検証だけで「動いた」と判断しない（0.1.0 はこれで、ユーザーの画面では何も効かなかった）
- `page.js` は MAIN world・document_start で動き、上の 2 つのフラグを `ytcfg` の `EXPERIMENT_FLAGS` 上で false に固定して `ytd-watch-flexy` を使わせる（設定 `classicLayout`、既定 ON）。YouTube はフラグを使うたびに設定オブジェクトから読むので、再生ページが作られる前に書き換えれば効く。MAIN world から chrome.storage は読めないので、content.js が localStorage に写した値を同期的に読む（変更はタブの読み込み直しで反映）
- 同じ方法で、`ytd-watch-flexy` が 2 列（右に関連動画）になる最小のウィンドウ幅 `kevlar_watch_two_column_width_threshold`（YouTube の既定 1000px ＋スクロールバー幅。本体の読み込み時に 1 回だけ読まれる）を設定 `twoColumnMinWidth`（既定 800）に変える。狭い幅で 2 列にするとプレイヤー側の最小幅（480px × 16/9）ではみ出すので、content.js の CSS で最小幅を下げている。（0.3.0 でユーザーの症状の原因と推測して入れたが、実際の原因は上のサイドレールだった。ユーザーのアカウントではもともと 800px）
- page.js が使う設定は localStorage の `tubelayout-page`（JSON）。page.js は動作を `<html data-tubelayout-page>` に残し、content.js がそれと直近の再生ページの状態を `chrome.storage.local` の `status` に保存して、設定画面の「動作の確認」に出す。ユーザーから「効かない」と言われたら、まずここを見てもらう
- 他の設定はすべて `ytd-watch-flexy` 向け。`ytd-watch-grid` には対応していない
- 右端のアイコン列（`#fixed-side-menu`、`position: fixed`）は、YouTube が `#columns::after` と `--ytd-watch-flexy-fixed-side-menu-width` でその幅の余白を取っている。設定 `sideRail` が `top` なら `placeSideMenu` が `#secondary-inner` の先頭へ移して横並びの CSS を当て、`hidden` なら隠す。どちらも余白を 0 にする。ラベルは内側の span が `pre-wrap` で折り返すので、そこにも `nowrap` を当てている
- YouTube はプレイヤーを「画面の高さに収まる大きさ」（`--ytd-watch-flexy-max-player-width` など）で止め、`#columns` を中央に寄せるので、横長のウィンドウでは左右に余白が出る。設定 `playerFill` はこの上限を外し、`#columns`・`#primary` の最大幅もなくす。縦長の動画（ショートを通常のプレイヤーで開いたときなど。`is-vertical-video_` が付き、縦横比の変数が 9:16 になる）では高さの上限を外すと幅に合わせて縦に伸び続けるので、`playerFill` は `:not([is-vertical-video_])` にだけ当てる。プレイヤーまわりを変えたら縦長の動画（例 `frPwxmWLyng`）でも確かめる
- **プレイヤーの高さは動画の縦横比で変わる。** 枠の高さは `#player-container-inner` の `padding-top`（縦横比の変数 × 幅）で決まり、さらに YouTube は関連動画の列の幅を動画の縦横比から JS で決める（`updateSidebarWidth`。フラグ `web_watch_use_sidebar_width_percentage` が有効なとき。ユーザーのアカウントでは有効）。4:3 の動画では列が広がってプレイヤー側が細くなる。設定 `playerFixedFrame` は縦横比の変数を 16:9 に固定し（content.js）、page.js がこのフラグを false にして列の幅を一定（`kevlar_watch_secondary_width`）にする。両方そろわないと高さは一定にならない。`playerFill` では高さの上限を外すので、`padding-top` を `min()` で画面に収まる高さまでに抑えている（4:3 などがはみ出していた）。検証は `FORCE_FLAGS_FILE=test/flags_side_rail.txt FIXED_SIDEBAR=1` で 16:9（`dQw4w9WgXcQ`）と 4:3（`jNQXAC9IVRw`）を比べる
- 設定のデフォルト値は `settings.js` の `TubeLayoutDefaults` にだけ置く。content script（manifest で settings.js → content.js の順。page.js は別の MAIN world の content script）と設定画面（options.html）の両方が読み込む。設定項目を足すときは `settings.js`・`content.js` の `buildCss` か DOM 処理・`options.js` の `SECTIONS`（操作部品はここから組み立てる。type は segment / toggle / range）を直し、見取り図に関わるなら `drawClassic` も直す
- **配置の変更は CSS が基本。** `content.js` の `buildCss` が設定から CSS を組み立て、`<html>` 直下の `<style id="tubelayout-style">` に入れる。セレクタは `ytd-watch-flexy` 起点。設定が変わると `chrome.storage.onChanged` で組み立て直し、`resize` イベントを送ってプレイヤーに動画の表示サイズを計算し直させる
- プレイヤーの大きさは `ytd-watch-flexy` の CSS 変数（`--ytd-watch-flexy-max-player-width` など）で決まり、`#primary` の最大幅もこれに従う。変数を上書きして変える（シアターモード・全画面は除く）
- **DOM を動かすのはコメントの横の列への移動だけ**（`placeComments`）。`ytd-comments#comments` を `#secondary-inner` の `#related` の直前へ移し、設定を戻したときや 1 列表示のときは元の親（`#below` の中の箱）へ戻す
- YouTube はウィンドウが狭いと 1 列表示（`is-two-columns_` 属性が消える）になり、自分で `#related` を「コメントの直前」へ移す。コメントが横の列にあると関連動画も横の列に入って隠れてしまうので、`placeComments` が `#below` 側へ移し直す。`ytd-watch-flexy` はページ内遷移で使い回されるので、その属性（`is-two-columns_`・`video-id`）を MutationObserver で見る
- 関連動画の各項目は新しい `yt-lockup-view-model`（クラス名は `ytLockupViewModel*` などのキャメルケース）。旧来の `ytd-compact-video-renderer` 向けのセレクタも並べてある。YouTube は A/B テストで DOM やクラス名を変えるので、効かなくなったら実際のページで DOM を調べ直す

## 配布

- 配布は Chrome ウェブストアではなく、vel.works の紹介ページ（https://vel.works/chrome_ext/tubelayout/）からの zip。`python3 scripts/release.py [--publish]` で `dist/tubelayout-<版>.zip` を作る（LICENSE は入れ、テスト・文書・スクリプトは入れない）。`--publish` で vel.works の紹介ページのフォルダ（`/var/docker/docker-shared/dev-server-php8/vel.works/chrome_ext/tubelayout/`）に置き、古い zip を消す
- 版を上げるときに直すもの: `manifest.json` の `version`、`CHANGELOG.md`、vel.works の紹介ページ（`<!-- download:start -->` と `<!-- changelog:start -->` の欄）と `vel.works/_build/data/catalog.json` の version。そのあと vel.works をビルドして `chrome_ext` と `top` を本番へ反映する（手順は `dev-server-php8/CLAUDE.md` と `vel.works/_build/README.md`）。git では `v<版>` のタグを付けて push する
- **manifest の `key` を消したり変えたりしない。** 拡張 ID（clmfnmabmbjgcjdddpnjapgdfcdjhagp）を固定する公開鍵で、変わると利用者の設定が消える。対応する秘密鍵はリポジトリの外（`~/.config/velworks/chromeext-keys/tubelayout.pem`）にある
- 公開リポジトリ（GitHub: https://github.com/velstau/tubelayout）。コミットの前に、追跡対象に個人情報が入っていないか確かめる（ホスト名・IP アドレス・認証情報は不可）。作者は `velstau <velstau@users.noreply.github.com>`
