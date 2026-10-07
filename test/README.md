# test — 実際の YouTube での検証スクリプト

TubeLayout（リポジトリ直下の拡張）を実際の YouTube の再生ページで動かし、設定ごとの配置を記録する。ユーザーに実機での確認を頼む前に、まずこれで確かめる。

## 前提

- ホストの python3 に Playwright がある
- Google Chrome（`/usr/bin/google-chrome`）を使う。Google Chrome 147 は `--load-extension` で拡張を読み込めないので、`chrome.storage` の代用オブジェクトと settings.js・content.js をページに注入して動かす

## layout_sim.py

```sh
# 既定の場面（既定・左配置・コメントを横の列・プレイヤーを小さく）を順に撮る
python3 test/layout_sim.py

# 場面を指定する。3 つ目は [幅, 高さ]（ウィンドウの大きさを変える）か、クリックするセレクタ（ページ内遷移）
python3 test/layout_sim.py '[["a", {"commentsPosition": "side"}], ["b", {"commentsPosition": "side"}, [900, 1000]], ["c", {"commentsPosition": "side"}, "#related a.ytLockupViewModelContentImage"]]'
```

場面ごとに `test/<名前>.png` を撮り、主な要素の位置と大きさ（x, y, 幅, 高さ）、コメントの置き場所と件数、概要欄が開いているかを出力する。ページは読み込み直さず、設定は `chrome.storage.onChanged` 経由で切り替える。環境変数はファイル冒頭のコメントにある。

## ユーザーの画面の再現

```sh
# ユーザーのアカウントの実験フラグ（再生ページの配置に関わるもの）を入れて開く。CLASSIC=0 で拡張が戻す前の状態
W=1918 CLASSIC=0 FORCE_FLAGS_FILE=test/flags_side_rail.txt python3 test/layout_sim.py '[["before", {}]]'
W=1918 FORCE_FLAGS_FILE=test/flags_side_rail.txt python3 test/layout_sim.py
```

ユーザーの画面の状態は `test/collect.js` で書き出してもらう（再生ページを F5 で開き直し、DevTools のコンソールに貼る。JSON がクリップボードにコピーされる）。実験フラグ・サーバーのデータの構造（中身は入れない）・再生ページの部品の並びが入る。新しい実験で配置が変わったら、フラグを `test/flags_*.txt` に写して再現する。サーバーのデータでしか出ない右端のアイコン列は、`SIDE_RAIL_MENU=test/side_rail_menu.json` で最初の読み込みのデータに足して再現する（ユーザーの画面から書き出した構造に合わせて作ったもので、ボタンの動作は推測）。

## 注意点

- ログインしていない状態の YouTube で確かめている。ログイン中のアカウントには新しい再生ページ（`ytd-watch-grid`）が出ることがあり、ログインなしでは出ない。**必ず `FORCE_FLAGS=kevlar_watch_grid,kevlar_watch_fixie` でも確かめる**（HTML の実験フラグを書き換えてそのレイアウトを再現する。page.js が効いていれば `watchElement` が `ytd-watch-flexy` になる）。ウィンドウ幅 1000px 前後（`W=900` など）でも確かめる。YouTube の既定では 1 列になる幅。ただしサーバーが返すデータの違いまでは再現できない
- ボタンの文字の有無などは、ログインしていなくても読み込むたびに変わることがある
- ヘッドレスではボタンのアイコンが描かれず、空の丸に見える
- 拡張として読み込んで確かめたいときは、Playwright 同梱の Chromium（`channel='chromium'`）なら `--load-extension` が使える。動画は再生できない（H.264 非対応）が、配置の確認と設定画面の動作確認には足りる
