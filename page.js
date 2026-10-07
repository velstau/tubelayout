// ページ側（MAIN world）で動く。YouTube の新しい再生ページのレイアウトを使わせず、以前のレイアウトで表示させる
//
// YouTube は実験フラグで再生ページの部品を選ぶ（kevlar_watch_fixie → ytd-watch-fixie、
// kevlar_watch_grid → ytd-watch-grid、どちらもなければ ytd-watch-flexy）。ytd-watch-grid では関連動画が
// プレイヤーの下にグリッドで並び、右の列にタイトル・概要欄・コメントが入る。
// フラグは設定オブジェクト（window.ytcfg.data_ = yt.config_）の EXPERIMENT_FLAGS にあり、YouTube は使うたびに
// そこを読むので、再生ページが作られる前に値を false にしておけば ytd-watch-flexy になる。
// EXPERIMENT_FLAGS が後から丸ごと差し替えられても効くよう、設定オブジェクトの EXPERIMENT_FLAGS を
// アクセサにして、入ってきたオブジェクトをその都度書き換える。
//
// 同じ方法で、2 列（右に関連動画）にする最小のウィンドウ幅（kevlar_watch_two_column_width_threshold、既定 1000px）も変える。
//
// MAIN world からは chrome.storage を読めないので、設定は content.js が localStorage（tubelayout-page）に写した値を
// 同期的に読む（設定を変えたときは YouTube のタブを読み込み直すと反映される）。
// 動作の記録は <html data-tubelayout-page="..."> に JSON で残し、content.js が設定画面の診断欄へ渡す
(() => {
  'use strict';

  const status = { classic: true, twoColumnMinWidth: 0, hooked: false, patchedObjects: 0, original: {} };

  function report() {
    try {
      document.documentElement.setAttribute('data-tubelayout-page', JSON.stringify(status));
    } catch (e) {
      // documentElement がまだないときは次の機会に書く
    }
  }

  // content.js が写した設定（{ classic, twoColumnMinWidth }）。読めなければ既定（以前のレイアウト・800px）
  let config = { classic: true, twoColumnMinWidth: 800 };
  try {
    const saved = JSON.parse(localStorage.getItem('tubelayout-page') || 'null');
    if (saved && typeof saved === 'object') config = { ...config, ...saved };
  } catch (e) {
    // localStorage が使えないときは既定のまま
  }
  status.classic = !!config.classic;
  status.twoColumnMinWidth = Number(config.twoColumnMinWidth) > 0 ? Number(config.twoColumnMinWidth) : 0;

  // 以前のレイアウトにするために false にするフラグ
  const CLASSIC_OFF = [
    // 再生ページの部品そのものを替える実験（ytd-watch-grid・ytd-watch-fixie）
    'kevlar_watch_grid',
    'kevlar_watch_fixie',
    // ytd-watch-flexy のまま配置を替える実験。右端のアイコン列（サイドレール）の「閉じられるパネル」では、
    // パネルを閉じている間、関連動画を右の列から抜いてプレイヤーの下にグリッドで並べ、プレイヤーを中央に大きく出す。
    // 差し替えのフラグだけを切ると「パネルを開いている間は関連動画を隠す」処理が働くので、固定パネル・分割スクロールも切る
    'web_side_rail_dismissible_panels',
    'web_side_rail_default_dismissed_panels',
    'web_fixed_panel_watch_next_grid_swap',
    'web_live_chat_panel_watch_next_grid_swap',
    'web_watch_enable_single_column_grid_view',
    'web_watch_eligible_to_switch_to_grid',
    'web_watch_fixed_default_panels',
    'web_watch_split_scroll',
    // シアターモードのボタンを消す実験
    'disable_theater_mode',
  ];

  // 書き換えるフラグと値
  //   CLASSIC_OFF: 新しいレイアウトを使わない
  //   kevlar_watch_two_column_width_threshold: 2 列にする最小のウィンドウ幅（YouTube 本体の読み込み時に 1 回だけ読まれる）
  const OVERRIDES = {};
  if (status.classic) {
    for (const f of CLASSIC_OFF) OVERRIDES[f] = false;
  }
  if (status.twoColumnMinWidth) OVERRIDES.kevlar_watch_two_column_width_threshold = status.twoColumnMinWidth;
  if (!Object.keys(OVERRIDES).length) {
    report();
    return;
  }

  // フラグのオブジェクトを書き換える。後から同じオブジェクトに書き戻されても値を変えさせない
  function patchFlags(flags) {
    if (!flags || typeof flags !== 'object') return;
    for (const [f, value] of Object.entries(OVERRIDES)) {
      const d = Object.getOwnPropertyDescriptor(flags, f);
      if (d && d.get) continue;
      if (d && !(f in status.original)) status.original[f] = d.value;
      Object.defineProperty(flags, f, { get: () => value, set: () => {}, configurable: true, enumerable: true });
    }
    status.patchedObjects++;
    report();
  }

  // 設定オブジェクトの EXPERIMENT_FLAGS をアクセサにする
  function hookConfig(data) {
    if (!data || typeof data !== 'object') return;
    const d = Object.getOwnPropertyDescriptor(data, 'EXPERIMENT_FLAGS');
    if (d && d.get && d.get.__tubelayout) return;
    let flags = d ? d.value : undefined;
    patchFlags(flags);
    const get = () => flags;
    get.__tubelayout = true;
    Object.defineProperty(data, 'EXPERIMENT_FLAGS', {
      get,
      set: (v) => {
        flags = v;
        patchFlags(v);
      },
      configurable: true,
      enumerable: true,
    });
    status.hooked = true;
    report();
  }

  // 設定オブジェクトは ytcfg.d() が返すもの（yt.config_ か ytcfg.data_）。YouTube 本体も同じオブジェクトを使う
  function tryHook() {
    const cfg = window.ytcfg;
    let data = null;
    try {
      data = cfg && typeof cfg.d === 'function' ? cfg.d() : (window.yt && window.yt.config_) || (cfg && cfg.data_);
    } catch (e) {
      data = null;
    }
    hookConfig(data);
    // yt.config_ が ytcfg.data_ と別のオブジェクトになっていることに備えて両方
    if (window.yt && window.yt.config_ && window.yt.config_ !== data) hookConfig(window.yt.config_);
  }

  // ytcfg はページ先頭のインライン スクリプトで作られる。MutationObserver のコールバックは各スクリプトの実行後
  // （次のスクリプトの前）に呼ばれるので、YouTube 本体のスクリプトが動く前に書き換えられる
  const mo = new MutationObserver(tryHook);
  mo.observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => {
    tryHook();
    mo.disconnect();
  });
  window.addEventListener('load', tryHook);
  document.addEventListener('yt-navigate-start', tryHook);
  report();
})();
