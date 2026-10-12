// TubeLayout: YouTube の再生ページの配置を設定に合わせて変える
//
// 配置・大きさ・表示の切り替えはすべて CSS（<style id="tubelayout-style">）で行う。
// DOM を動かすのは「コメントを横の列に置く」だけで、概要欄を開くのはボタンをクリックするだけ。
// YouTube はウィンドウが狭いと 1 列表示になり、自分で #related を #below へ移す。
// そのときはコメントを元の位置へ戻し、YouTube の組み替えとぶつからないようにする。
(() => {
  'use strict';

  const F = 'ytd-watch-flexy';
  const RATIO = 'var(--ytd-watch-flexy-width-ratio, 16) / var(--ytd-watch-flexy-height-ratio, 9)';
  let settings = { ...TubeLayoutDefaults };

  const num = (v) => (Number(v) > 0 ? Number(v) : 0);

  function buildCss(s) {
    if (!s.enabled) return '';
    const r = [];

    // ---- 2 列にする最小の幅 ----
    // page.js がしきい値を下げて 2 列にしたとき、プレイヤー側の最小幅（既定 480px × 16/9）のままだと横にはみ出すので下げる
    if (num(s.twoColumnMinWidth)) {
      r.push(`${F}[is-two-columns_] {
  --ytd-watch-flexy-min-player-width: calc(240px * ${RATIO}) !important;
  --ytd-watch-flexy-min-player-height: 240px !important;
  --ytd-watch-flexy-sidebar-min-width: 240px !important;
}
${F}[is-two-columns_] #columns { min-width: 0 !important; }
${F}[is-two-columns_] #primary { min-width: 0 !important; }`);
    }

    // ---- プレイヤー ----
    // プレイヤーの大きさは ytd-watch-flexy の CSS 変数で決まる（#primary の最大幅もこの変数に従う）。
    // シアターモードと全画面には当てない
    // YouTube の既定ではプレイヤーは画面の高さに収まる大きさまでしか広がらず、ウィンドウが横長だと
    // 列全体が中央に寄って左右に余白が出る。playerFill はこの上限を外し、プレイヤーの列を横幅いっぱいに広げる
    // 縦長の動画（ショートなど。YouTube が is-vertical-video_ を付け、縦横比の変数を 9:16 にする）は、
    // 高さの上限を外すと幅に合わせて縦に際限なく伸びるので、横幅いっぱいにはしない
    const h = num(s.playerMaxHeight);
    const w = num(s.playerMaxWidth);
    const fill = !!s.playerFill;
    const PLAYER = `${F}:not([theater]):not([fullscreen])`;
    const playerVars = (sel, fillMode) => {
      const NONE = '100000px';
      let height = h ? `${h}vh` : fillMode ? NONE : 'calc(100vh - var(--ytd-watch-flexy-non-player-height))';
      let width = height === NONE ? NONE : `calc(${height} * ${RATIO})`;
      if (w) {
        width = width === NONE ? `${w}px` : `min(${w}px, ${width})`;
        height = height === NONE ? `calc(${w}px / (${RATIO}))` : `min(${height}, calc(${w}px / (${RATIO})))`;
      }
      r.push(`${sel} {
  --ytd-watch-flexy-max-player-width: ${width} !important;
  --ytd-watch-flexy-max-player-width-wide-screen: ${width} !important;
  --ytd-watch-flexy-max-player-height: ${height} !important;
  --ytd-watch-flexy-min-player-width: calc(240px * ${RATIO}) !important;
  --ytd-watch-flexy-min-player-height: 240px !important;
}`);
    };
    // YouTube はプレイヤーの枠を動画の縦横比どおりに作るので、4:3 などの動画では同じ幅でも枠が高くなる。
    // playerFixedFrame は縦長でない動画の縦横比の変数を 16:9 に固定する（動画は枠の中に黒帯付きで収まる）。
    // YouTube は関連動画の列の幅も動画の縦横比から決める（4:3 だと列が広がりプレイヤー側が細くなる）ので、
    // 列の幅を一定にするフラグは page.js が切る。両方そろって動画によらず同じ高さになる
    if (s.playerFixedFrame) {
      r.push(`${PLAYER}:not([is-vertical-video_]) { --ytd-watch-flexy-width-ratio: 16 !important; --ytd-watch-flexy-height-ratio: 9 !important; }`);
    }
    if (fill) {
      const WIDE = `${PLAYER}:not([is-vertical-video_])`;
      playerVars(WIDE, true);
      // 横幅いっぱいでも枠の高さは画面に収まる高さまでにする（枠の高さは #player-container-inner の padding-top で幅から決まる）。
      // 収まらない分は動画の左右に黒帯が出る。高さの上限を指定したときは playerVars がその高さに収める
      if (!h) {
        r.push(`${WIDE} #player-container-inner {
  padding-top: min(calc(var(--ytd-watch-flexy-height-ratio) / var(--ytd-watch-flexy-width-ratio) * 100%), calc(100vh - var(--ytd-watch-flexy-non-player-height))) !important;
}`);
      }
      // 列の幅は縦長の動画でも広げる（プレイヤーは列の中で中央に置かれる）。でないと高さの上限を併用したときに列ごと細くなり、左右に余白が出る
      if (!w) {
        r.push(`${PLAYER} #columns { max-width: none !important; }
${PLAYER} #primary { max-width: none !important; }`);
      }
      if (h || w) playerVars(`${PLAYER}[is-vertical-video_]`, false);
    } else if (h || w) {
      playerVars(PLAYER, false);
    }
    if (s.playerSquare) {
      r.push(`${F} ytd-player, ${F} #ytd-player, ${F} #movie_player, ${F} #player-container,
${F} .html5-video-container, ${F} video.html5-main-video { border-radius: 0 !important; }`);
    }
    if (s.hideAmbient) {
      r.push(`${F} #cinematics, ${F} #cinematics-container { display: none !important; }`);
    }

    // ---- 右端のアイコン列（サイドレール）----
    // #fixed-side-menu は画面の右端に固定表示され、YouTube は #columns の右にその幅の余白
    // （--ytd-watch-flexy-fixed-side-menu-width）を取っている。動かすか隠すときは余白も消す
    if (s.sideRail === 'hidden' || s.sideRail === 'top') {
      r.push(`${F} { --ytd-watch-flexy-fixed-side-menu-width: 0px !important; }
${F} #columns::after { width: 0 !important; min-width: 0 !important; }`);
    }
    if (s.sideRail === 'hidden') {
      r.push(`${F} #fixed-side-menu { display: none !important; }`);
    } else if (s.sideRail === 'top') {
      // placeSideMenu が #secondary-inner の先頭へ移す。縦並び・固定表示・左の境界線をやめ、
      // 各ボタンはアイコンの横にラベルを置いて横一列に並べる。隅に出る「折りたたむ」ボタンは隠す
      const M = `${F} #secondary-inner > #fixed-side-menu`;
      r.push(`${M} { position: static !important; margin: 0 0 12px !important; }
${M} .ytSideRailViewModelHost {
  flex-direction: row !important; flex-wrap: nowrap !important; gap: 6px !important;
  height: auto !important; border: none !important; border-image: none !important; padding: 0 !important;
}
${M} .ytSideRailViewModelButton { margin: 0 !important; min-width: 0 !important; flex: 0 1 auto !important; transform: none !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }
${M} .ytSpecButtonShapeWithLabelHost { flex-direction: row !important; gap: 4px !important; min-width: 0 !important; }
${M} .ytSpecButtonShapeWithLabelLabel {
  max-width: none !important; min-width: 0 !important; margin: 0 6px 0 0 !important; font-size: 1.4rem !important; line-height: 2rem !important;
  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; -webkit-line-clamp: unset !important; display: block !important;
}
${M} .ytSpecButtonShapeWithLabelLabel * { white-space: nowrap !important; word-break: keep-all !important; }
${M} .ytSideRailViewModelHideButtonContainer, ${M} .ytSideRailViewModelCollapsedContainer { display: none !important; }`);
    }

    // ---- 関連動画（横の列）----
    if (s.relatedPosition === 'left') {
      r.push(`${F}[is-two-columns_] #columns { flex-direction: row-reverse !important; }
${F}[is-two-columns_] #secondary { padding-left: var(--ytd-watch-flexy-horizontal-page-margin, 16px) !important; padding-right: 0 !important; }
${F}[is-two-columns_] #primary { margin-left: 24px !important; }`);
    } else if (s.relatedPosition === 'hidden') {
      r.push(`${F} #related { display: none !important; }`);
    }
    // 関連動画を隠したとき、横の列に何も残らなければ列ごと消してプレイヤー側を広げる。
    // チャット・再生リスト・開いているパネル（文字起こし・チャプターなど）・コメントがあれば残す
    if (s.relatedPosition === 'hidden') {
      r.push(`${F}[is-two-columns_] #secondary:not(:has(
  ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"],
  #playlist:not([hidden]), ytd-live-chat-frame:not([hidden]), ytd-comments#comments
)) { display: none !important; }`);
    }
    const sw = num(s.sidebarWidth);
    if (sw) {
      // 幅を広げすぎてページが横にはみ出さないよう、プレイヤー側に 480px は残す。
      // YouTube はプレイヤー側の最小幅（既定 480px × 16/9）を持っているので、それも下げる
      const width = `min(${sw}px, calc(100vw - 480px))`;
      r.push(`${F}[is-two-columns_] {
  --ytd-watch-flexy-sidebar-width: ${width} !important;
  --ytd-watch-flexy-min-player-width: calc(240px * ${RATIO}) !important;
  --ytd-watch-flexy-min-player-height: 240px !important;
}
${F}[is-two-columns_] #secondary { width: ${width} !important; min-width: ${width} !important; max-width: ${width} !important; flex: none !important; }`);
    }
    const tw = num(s.relatedThumbWidth);
    if (tw) {
      // 新しい表示（yt-lockup-view-model）と旧来の表示（ytd-compact-video-renderer）の両方
      r.push(`${F} #related .ytLockupViewModelContentImage,
${F} #related ytd-compact-video-renderer ytd-thumbnail,
${F} #related ytd-compact-video-renderer #dismissible > ytd-thumbnail {
  width: ${tw}px !important; min-width: ${tw}px !important; max-width: ${tw}px !important; flex: none !important;
}
${F} #related .ytLockupViewModelContentImage yt-thumbnail-view-model { width: 100% !important; }`);
    }
    const ts = num(s.relatedTextSize);
    if (ts) {
      r.push(`${F} #related .ytLockupMetadataViewModelTitle,
${F} #related .ytLockupMetadataViewModelTitle span,
${F} #related ytd-compact-video-renderer #video-title {
  font-size: ${ts}px !important; line-height: 1.4 !important; max-height: none !important;
}
${F} #related .ytLockupMetadataViewModelMetadata,
${F} #related .ytLockupMetadataViewModelMetadata span,
${F} #related ytd-compact-video-renderer #metadata,
${F} #related ytd-compact-video-renderer #metadata yt-formatted-string {
  font-size: ${Math.max(12, Math.round(ts * 0.86))}px !important; line-height: 1.4 !important;
}`);
    }
    if (s.hideRelatedChips) {
      r.push(`${F} #related yt-related-chip-cloud-renderer, ${F} #related yt-chip-cloud-renderer { display: none !important; }`);
    }
    if (s.hideRelatedShorts) {
      r.push(`${F} #related ytd-reel-shelf-renderer, ${F} #related grid-shelf-view-model,
${F} #related ytm-shorts-lockup-view-model, ${F} #related ytm-shorts-lockup-view-model-v2,
${F} #related ytd-item-section-renderer ytd-rich-shelf-renderer,
${F} #related yt-lockup-view-model:has(a[href^="/shorts/"]),
${F} #related ytd-compact-video-renderer:has(a[href^="/shorts/"]) { display: none !important; }`);
    }

    // ---- コメント・概要欄 ----
    if (s.commentsPosition === 'hidden') {
      r.push(`${F} ytd-comments#comments, ${F} ytd-watch-metadata #comment-teaser { display: none !important; }`);
    } else if (s.commentsPosition === 'side') {
      // コメントは読み込みが続くと際限なく伸び、下の関連動画に届かなくなる。高さを決めて枠の中でスクロールさせる
      const ch = num(s.sideCommentsHeight);
      const height = ch ? `${ch}vh` : 'calc(100vh - var(--ytd-watch-flexy-masthead-height, 56px) - 24px)';
      r.push(`${F} #secondary-inner > ytd-comments#comments {
  display: block; max-height: ${height}; overflow-y: auto; overscroll-behavior: contain;
  margin: 0 0 16px; padding-right: 8px; box-sizing: border-box;
}
${F} #secondary-inner > ytd-comments#comments ytd-item-section-renderer#sections { margin-top: 0 !important; }`);
    }

    // ---- タイトル・ボタン ----
    const tt = num(s.titleSize);
    if (tt) {
      r.push(`${F} ytd-watch-metadata #title h1, ${F} ytd-watch-metadata #title h1 yt-formatted-string {
  font-size: ${tt}px !important; line-height: 1.35 !important; max-height: none !important;
}`);
    }
    if (s.hideActions) {
      r.push(`${F} ytd-watch-metadata #actions { display: none !important; }`);
    } else if (s.hideActionLabels) {
      // 高評価の数は残す。文字を消したボタンは左右の余白をそろえてアイコンだけの丸いボタンにする
      const label = ':is(.ytSpecButtonShapeNextButtonTextContent, .yt-spec-button-shape-next__button-text-content)';
      r.push(`${F} ytd-watch-metadata #actions button:not(like-button-view-model button):has(> ${label}) > ${label} { display: none !important; }
${F} ytd-watch-metadata #actions button:not(like-button-view-model button):has(> ${label}) { padding: 0 8px !important; }
${F} ytd-watch-metadata #actions button:not(like-button-view-model button):has(> ${label}) > :is(.ytSpecButtonShapeNextIcon, .yt-spec-button-shape-next__icon) { margin: 0 !important; }`);
    }
    if (s.hideShelves) {
      r.push(`${F} #ticket-shelf, ${F} #merch-shelf, ${F} ytd-merch-shelf-renderer, ${F} #shopping-timely-shelf,
${F} #donation-shelf, ${F} ytd-watch-metadata #product-shelf, ${F} ytd-watch-metadata #shopping-description-shelf { display: none !important; }`);
    }

    return r.join('\n');
  }

  // ---- CSS の適用 ----
  let styleEl = null;
  function applyCss() {
    const root = document.documentElement;
    if (!root) return;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'tubelayout-style';
    }
    // YouTube がヘッドを書き換えても残るよう、<html> の直下に置く（document_start では head がまだない）
    if (!styleEl.isConnected) root.appendChild(styleEl);
    const css = buildCss(settings);
    if (styleEl.textContent !== css) {
      styleEl.textContent = css;
      // プレイヤーは resize を受けて動画の表示サイズを計算し直す
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  }

  // ---- コメントを横の列へ ----
  let commentsHome = null; // 元の親（#below の中の箱）
  function placeComments() {
    const flexy = document.querySelector(F);
    if (!flexy) return;
    const comments = flexy.querySelector('ytd-comments#comments');
    const side = flexy.querySelector('#secondary-inner');
    if (!comments || !side) return;
    if (!side.contains(comments)) commentsHome = comments.parentElement;
    const wantSide = settings.enabled && settings.commentsPosition === 'side' && flexy.hasAttribute('is-two-columns_');
    if (wantSide) {
      // チャット・再生リスト・パネルの後、関連動画の前
      const related = side.querySelector(':scope > #related');
      if (comments.parentElement !== side || comments.nextElementSibling !== related) side.insertBefore(comments, related);
    } else if (commentsHome && comments.parentElement !== commentsHome) {
      commentsHome.appendChild(comments);
    }
    // YouTube は 1 列表示に切り替えるとき、関連動画をコメントの直前へ差し込む。コメントが横の列にあると
    // 関連動画も横の列（1 列表示では隠れる）に入ってしまうので、YouTube が本来置く位置へ移す
    if (!flexy.hasAttribute('is-two-columns_') && commentsHome && comments.parentElement === commentsHome) {
      const related = side.querySelector(':scope > #related');
      if (related) commentsHome.insertBefore(related, comments);
    }
  }

  // ---- 右端のアイコン列を右の列の先頭へ ----
  // 元の場所は ytd-watch-flexy の直下（#columns の後ろ）。設定を戻したときと 1 列表示のときは元へ戻す
  let sideMenuHome = null;
  let sideMenuNext = null;
  function placeSideMenu() {
    const flexy = document.querySelector(F);
    if (!flexy) return;
    const menu = flexy.querySelector('#fixed-side-menu');
    const side = flexy.querySelector('#secondary-inner');
    if (!menu || !side) return;
    if (!side.contains(menu)) {
      sideMenuHome = menu.parentElement;
      sideMenuNext = menu.nextSibling;
    }
    const wantTop = settings.enabled && settings.sideRail === 'top' && flexy.hasAttribute('is-two-columns_');
    if (wantTop) {
      if (side.firstElementChild !== menu) side.insertBefore(menu, side.firstElementChild);
    } else if (sideMenuHome && menu.parentElement !== sideMenuHome) {
      sideMenuHome.insertBefore(menu, sideMenuNext && sideMenuNext.parentNode === sideMenuHome ? sideMenuNext : null);
    }
  }

  // ---- 概要欄を最初から開く ----
  // 動画が変わってからしばらくの間、閉じていれば開く。説明の差し替えが遅れて閉じ直されることがあるので 1 回では終えない。
  // 利用者が自分で閉じたら、その動画ではもう開かない
  const EXPAND_WINDOW_MS = 8000;
  let expandUntil = 0;
  let expandTimer = null;
  function expandDescription() {
    if (!settings.enabled || !settings.expandDescription || Date.now() > expandUntil) return;
    const exp = document.querySelector(`${F} ytd-watch-metadata ytd-text-inline-expander#description-inline-expander`);
    if (!exp || exp.hasAttribute('is-expanded')) return;
    const btn = exp.querySelector('#expand');
    if (btn && btn.offsetParent) btn.click();
  }
  function scheduleExpand() {
    expandUntil = Date.now() + EXPAND_WINDOW_MS;
    clearInterval(expandTimer);
    expandTimer = setInterval(() => {
      if (Date.now() > expandUntil) clearInterval(expandTimer);
      else expandDescription();
    }, 700);
  }
  document.addEventListener('click', (e) => {
    if (e.isTrusted && e.target instanceof Element && e.target.closest(`${F} #description-inline-expander #collapse`)) expandUntil = 0;
  }, true);

  // ---- 再生ページの監視 ----
  // YouTube はページ内遷移で ytd-watch-flexy を作り直さず使い回す。属性の変化（1 列／2 列、動画の切り替え）を見る
  let watched = null;

  // 直近に開いた再生ページの状態を chrome.storage.local に残し、設定画面の「動作の確認」で見せる
  function recordStatus() {
    const flexy = document.querySelector(F);
    const visible = ['ytd-watch-flexy', 'ytd-watch-grid', 'ytd-watch-fixie'].filter((t) => {
      const e = document.querySelector(t);
      return e && e.getBoundingClientRect().height > 0;
    });
    let page = null;
    try {
      page = JSON.parse(document.documentElement.getAttribute('data-tubelayout-page') || 'null');
    } catch (e) {
      page = null;
    }
    // YouTube の内部状態（部品・2 列かどうか）が正常でも、関連動画がプレイヤーの下へ差し替えられていることがある。
    // 利用者に見えているとおりに、関連動画が実際にどこにあるかを残す
    const related = flexy && flexy.querySelector('#related');
    let relatedLocation = 'none';
    if (related && related.getBoundingClientRect().height > 0) {
      relatedLocation = related.closest('#secondary') ? 'side' : related.closest('#below') ? 'below' : 'other';
    } else if (related) {
      relatedLocation = 'hidden';
    }
    const status = {
      at: Date.now(),
      relatedLocation,
      sideRail: !!(flexy && flexy.hasAttribute('side-rail-dismissible-panels')),
      version: chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : '',
      watchElement: visible.join(','),
      twoColumns: !!(flexy && flexy.hasAttribute('is-two-columns_')),
      windowWidth: window.innerWidth,
      page,
    };
    try {
      if (chrome.storage.local) chrome.storage.local.set({ status });
    } catch (e) {
      // 拡張が再読み込みされて古い content script が切り離されたときなど
    }
  }
  let recordTimer = null;
  function scheduleRecord() {
    clearTimeout(recordTimer);
    recordTimer = setTimeout(recordStatus, 1500);
  }
  window.addEventListener('resize', scheduleRecord);
  const flexyObserver = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'video-id')) scheduleExpand();
    scheduleRecord();
    placeComments();
    placeSideMenu();
    // 1 列／2 列の切り替えに伴う YouTube 側の要素の移動が、属性の変化より後になることがあるので、少し後にもう一度
    setTimeout(() => {
      placeComments();
      placeSideMenu();
    }, 300);
  });
  function attach() {
    applyCss();
    if (location.pathname === '/watch') scheduleRecord();
    const flexy = document.querySelector(F);
    if (!flexy) return false;
    if (watched !== flexy) {
      flexyObserver.disconnect();
      flexyObserver.observe(flexy, { attributes: true, attributeFilter: ['is-two-columns_', 'video-id', 'theater'] });
      watched = flexy;
      scheduleExpand();
    }
    placeComments();
    placeSideMenu();
    return true;
  }
  document.addEventListener('yt-navigate-finish', () => {
    attach();
    scheduleExpand();
  });
  // 最初の読み込みでは再生ページ（ytd-watch-flexy、新しいレイアウトなら別の要素）ができるまで待つ
  const startTimer = setInterval(() => {
    if (attach() || document.querySelector('ytd-watch-grid, ytd-watch-fixie')) clearInterval(startTimer);
  }, 500);
  setTimeout(() => clearInterval(startTimer), 60000);

  // ---- 設定 ----
  // page.js（MAIN world）は chrome.storage を読めないので、page.js が使う設定を localStorage に写す
  function syncPageConfig() {
    try {
      localStorage.setItem('tubelayout-page', JSON.stringify({
        classic: settings.enabled && settings.classicLayout,
        twoColumnMinWidth: settings.enabled ? num(settings.twoColumnMinWidth) : 0,
        fixedSidebar: settings.enabled && !!settings.playerFixedFrame,
      }));
    } catch (e) {
      // 書けなければ page.js は既定で動く
    }
  }
  function apply() {
    syncPageConfig();
    applyCss();
    placeComments();
    placeSideMenu();
    if (settings.expandDescription) scheduleExpand();
  }
  chrome.storage.sync.get(TubeLayoutDefaults, (s) => {
    settings = { ...TubeLayoutDefaults, ...s };
    apply();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const k in changes) settings[k] = changes[k].newValue === undefined ? TubeLayoutDefaults[k] : changes[k].newValue;
    apply();
  });
  applyCss();
})();
