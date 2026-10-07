// 設定画面。SECTIONS（設定の一覧）から操作盤を組み立て、変更したらすぐ chrome.storage.sync に保存する。
// 左の見取り図は、設定から再生ページの配置を大まかに計算して描く（仮想のウィンドウ 1920 × 900）。
// 数値の設定の 0 は「YouTube の既定のまま」を表す
(() => {
  'use strict';

  const D = TubeLayoutDefaults;
  let s = { ...D };

  // ---- セグメントボタンの図（72 × 46）----
  // [クラス, x, y, 幅, 高さ]。fr = 枠、bx = 部品、hl = その選択肢で変わる部分
  const svg = (parts) => `<svg viewBox="0 0 72 46" aria-hidden="true"><rect class="fr" x="1" y="1" width="70" height="44" rx="3"/>${parts.map(([c, x, y, w, h]) => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`).join('')}</svg>`;
  const ICONS = {
    classicOn: svg([['bx', 5, 5, 40, 22], ['bx', 5, 30, 40, 4], ['bx', 5, 37, 40, 4], ['hl', 49, 5, 18, 8], ['hl', 49, 16, 18, 8], ['hl', 49, 27, 18, 8]]),
    classicOff: svg([['bx', 12, 5, 44, 22], ['hl', 12, 31, 13, 10], ['hl', 28, 31, 13, 10], ['hl', 44, 31, 12, 10], ['bx', 62, 5, 5, 20]]),
    fitHeight: svg([['hl', 4, 5, 8, 36], ['bx', 15, 5, 32, 18], ['bx', 50, 5, 14, 36], ['hl', 66, 5, 3, 36]]),
    fill: svg([['hl', 5, 5, 42, 24], ['bx', 50, 5, 17, 36]]),
    relRight: svg([['bx', 5, 5, 40, 22], ['bx', 5, 30, 40, 11], ['hl', 49, 5, 18, 36]]),
    relLeft: svg([['hl', 5, 5, 18, 36], ['bx', 27, 5, 40, 22], ['bx', 27, 30, 40, 11]]),
    relHidden: svg([['bx', 5, 5, 62, 26], ['bx', 5, 34, 62, 7]]),
    comBelow: svg([['bx', 5, 5, 40, 20], ['hl', 5, 28, 40, 13], ['bx', 49, 5, 18, 36]]),
    comSide: svg([['bx', 5, 5, 40, 20], ['bx', 5, 28, 40, 6], ['hl', 49, 5, 18, 17], ['bx', 49, 25, 18, 16]]),
    comHidden: svg([['bx', 5, 5, 40, 20], ['bx', 5, 28, 40, 6], ['bx', 49, 5, 18, 36]]),
    railDefault: svg([['bx', 5, 5, 34, 20], ['bx', 42, 5, 16, 36], ['hl', 62, 5, 5, 26]]),
    railTop: svg([['bx', 5, 5, 38, 20], ['hl', 47, 5, 20, 5], ['bx', 47, 13, 20, 28]]),
    railHidden: svg([['bx', 5, 5, 40, 20], ['bx', 49, 5, 18, 36]]),
  };

  // ---- 設定の一覧 ----
  // type: segment（図入りの選択）| toggle | range（0 は既定。base は既定のときのつまみの位置）| diag
  // reload: YouTube のタブを読み込み直したときに反映される設定。showIf: 表示する条件
  const SECTIONS = [
    {
      id: 'layout', title: 'レイアウト', lead: 'YouTube が試験的に出している新しい再生ページを使うかどうか。',
      items: [
        { key: 'classicLayout', type: 'segment', reload: true, title: '再生ページの形', options: [
          [true, '以前のレイアウト', ICONS.classicOn], [false, '新しいレイアウト', ICONS.classicOff]],
        hint: '新しいレイアウトは、関連動画がプレイヤーの下に並ぶ形です。下の各設定は以前のレイアウト向けです。' },
        { key: 'twoColumnMinWidth', type: 'range', reload: true, title: '右に関連動画を出す最小のウィンドウ幅', min: 600, max: 1600, step: 10, unit: 'px', base: 1000, zeroLabel: '既定 1000px',
          hint: 'ウィンドウがこれより狭いと 1 列になり、関連動画がプレイヤーの下に回ります。' },
      ],
    },
    {
      id: 'player', title: 'プレイヤー', lead: 'ウィンドウが横長だと、YouTube はプレイヤーを画面の高さに収まる大きさで止めるので、左右に余白が出ます。',
      items: [
        { key: 'playerFill', type: 'segment', title: '大きさ', options: [
          [false, '画面の高さに収める', ICONS.fitHeight], [true, '横幅いっぱい', ICONS.fill]],
        hint: '「横幅いっぱい」はプレイヤーの列を横いっぱいに広げ、左右の余白をなくします。プレイヤーの下が画面からはみ出すことがあります。' },
        { key: 'playerMaxHeight', type: 'range', title: '高さの上限', min: 20, max: 100, step: 1, unit: '%', base: 88, zeroLabel: '既定',
          hint: '画面の高さに対する割合です。' },
        { key: 'playerMaxWidth', type: 'range', title: '幅の上限', min: 480, max: 3000, step: 10, unit: 'px', base: 3000, zeroLabel: '上限なし' },
        { key: 'playerSquare', type: 'toggle', title: '角を丸めない' },
        { key: 'hideAmbient', type: 'toggle', title: '周りの光（アンビエント モード）を消す' },
      ],
    },
    {
      id: 'related', title: '関連動画', lead: '右（または左）の列に並ぶおすすめの動画。',
      items: [
        { key: 'relatedPosition', type: 'segment', title: '位置', options: [
          ['right', '右', ICONS.relRight], ['left', '左', ICONS.relLeft], ['hidden', '表示しない', ICONS.relHidden]] },
        { key: 'sidebarWidth', type: 'range', title: '列の幅', min: 240, max: 1000, step: 10, unit: 'px', base: 400, zeroLabel: '既定',
          hint: '細くして左右に余白が出るときは、プレイヤーを「横幅いっぱい」にしてください。' },
        { key: 'relatedThumbWidth', type: 'range', title: 'サムネイルの幅', min: 80, max: 600, step: 10, unit: 'px', base: 250, zeroLabel: '既定' },
        { key: 'relatedTextSize', type: 'range', title: 'タイトルの文字', min: 10, max: 28, step: 1, unit: 'px', base: 14, zeroLabel: '既定 14px' },
        { key: 'hideRelatedChips', type: 'toggle', title: '上の絞り込みボタン（「すべて」など）を隠す' },
        { key: 'hideRelatedShorts', type: 'toggle', title: 'ショート動画を隠す' },
      ],
    },
    {
      id: 'comments', title: 'コメント・概要欄', lead: 'コメントを横の列に置くと、決まった高さの枠の中でスクロールします。',
      items: [
        { key: 'commentsPosition', type: 'segment', title: 'コメントの位置', options: [
          ['below', 'プレイヤーの下', ICONS.comBelow], ['side', '横の列', ICONS.comSide], ['hidden', '表示しない', ICONS.comHidden]] },
        { key: 'sideCommentsHeight', type: 'range', title: '横の列の枠の高さ', min: 20, max: 100, step: 1, unit: '%', base: 90, zeroLabel: '既定',
          showIf: (v) => v.commentsPosition === 'side', hint: '画面の高さに対する割合です。' },
        { key: 'expandDescription', type: 'toggle', title: '概要欄を最初から開く' },
      ],
    },
    {
      id: 'rail', title: '右端のアイコン列', lead: '概要・コメント・質問する・チャットのパネルを開くボタンの列。アカウントによっては出ません。',
      items: [
        { key: 'sideRail', type: 'segment', title: '表示のしかた', options: [
          ['default', '右端に縦', ICONS.railDefault], ['top', '関連動画の上に横一列', ICONS.railTop], ['hidden', '表示しない', ICONS.railHidden]],
        hint: '「表示しない」にすると、この列にしかないボタン（「質問する」など）は使えなくなります。' },
      ],
    },
    {
      id: 'title', title: 'タイトル・ボタン', lead: 'プレイヤーの下のタイトルと、高評価・共有などのボタン。',
      items: [
        { key: 'titleSize', type: 'range', title: 'タイトルの文字', min: 12, max: 40, step: 1, unit: 'px', base: 20, zeroLabel: '既定 20px' },
        { key: 'hideActionLabels', type: 'toggle', title: 'ボタンの文字を隠してアイコンだけにする（高評価の数は残す）' },
        { key: 'hideActions', type: 'toggle', title: 'ボタンの列をすべて隠す' },
        { key: 'hideShelves', type: 'toggle', title: 'チケット・グッズ・ショッピングの棚を隠す' },
      ],
    },
    { id: 'diag', title: '動作の確認', lead: '最後に開いた YouTube の再生ページの状態です。うまく動かないときはここを見てください。', diag: true },
  ];
  const ITEMS = SECTIONS.flatMap((sec) => (sec.items || []).map((it) => ({ ...it, section: sec.id })));

  // ---- 操作盤を組み立てる ----
  const panel = document.getElementById('panel');
  const h = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v);
    }
    for (const c of children) if (c != null) e.append(c);
    return e;
  };
  const controls = new Map(); // key → { item, el, update(value) }

  SECTIONS.forEach((sec) => {
    const card = h('section', { class: 'card' + (sec.diag ? ' always' : ''), id: `sec-${sec.id}`, 'data-section': sec.id, 'aria-labelledby': `h-${sec.id}` },
      h('div', { class: 'card-head' }, h('h2', { id: `h-${sec.id}` }, sec.title)),
      sec.lead ? h('p', { class: 'card-lead' }, sec.lead) : null);
    if (sec.diag) card.append(h('dl', { class: 'diag', id: 'diag' }));
    for (const it of sec.items || []) card.append(buildItem({ ...it, section: sec.id }));
    card.addEventListener('mouseenter', () => lightMock(sec.id, true));
    card.addEventListener('mouseleave', () => lightMock(sec.id, false));
    panel.append(card);
  });

  function titleNode(it) {
    return h('span', { class: 'item-title' }, it.title, it.reload ? h('span', { class: 'reload-mark' }, '再読み込みで反映') : null);
  }

  function buildItem(it) {
    const wrap = h('div', { class: 'item', 'data-key': it.key });
    if (it.type === 'toggle') {
      // DADS には切り替えスイッチがないので、チェックボックス（ラベルは右）にする
      const input = h('input', { type: 'checkbox', class: 'checkbox', id: `f-${it.key}` });
      input.addEventListener('change', () => set(it, input.checked));
      const label = h('label', { class: 'check-row', for: `f-${it.key}` }, input, titleNode(it));
      wrap.append(label);
      controls.set(it.key, { item: it, wrap, update: (v) => { input.checked = !!v; } });
    } else if (it.type === 'segment') {
      // 選択中は枠・面の色に加えて丸印でも示す（色だけで伝えない）
      const group = h('div', { class: 'segment', role: 'group', 'aria-label': it.title });
      const buttons = it.options.map(([value, label, icon]) => {
        const b = h('button', { type: 'button', class: 'seg', 'aria-pressed': 'false' }, h('span', { class: 'seg-indicator', 'aria-hidden': 'true' }), h('span', { html: icon }), h('span', { class: 'seg-label' }, label));
        b.addEventListener('click', () => set(it, value));
        group.append(b);
        return [value, b];
      });
      wrap.append(h('div', { class: 'item-head' }, titleNode(it)), group);
      controls.set(it.key, { item: it, wrap, update: (v) => buttons.forEach(([value, b]) => b.setAttribute('aria-pressed', String(value === v))) });
    } else if (it.type === 'range') {
      const badge = h('span', { class: 'value' });
      const range = h('input', { type: 'range', min: it.min, max: it.max, step: it.step, 'aria-label': it.title });
      const reset = h('button', { type: 'button', class: 'btn btn-text', 'aria-label': `${it.title}を既定に戻す` }, '既定に戻す');
      range.addEventListener('input', () => set(it, Number(range.value), 500));
      reset.addEventListener('click', () => set(it, 0));
      wrap.append(h('div', { class: 'item-head' }, titleNode(it), badge), h('div', { class: 'slider-row' }, range, reset));
      controls.set(it.key, {
        item: it, wrap,
        update: (v) => {
          const n = Number(v) > 0 ? Number(v) : 0;
          const pos = n || it.base;
          range.value = pos;
          range.classList.toggle('is-default', !n);
          range.style.setProperty('--fill', `${((pos - it.min) / (it.max - it.min)) * 100}%`);
          badge.textContent = n ? `${n}${it.unit}` : it.zeroLabel;
          badge.classList.toggle('default', !n);
          reset.disabled = !n;
        },
      });
    }
    if (it.hint) wrap.append(h('p', { class: 'hint' }, it.hint));
    return wrap;
  }

  // ---- 状態の反映・保存 ----
  const enabledEl = document.getElementById('enabled');
  enabledEl.addEventListener('change', () => set({ key: 'enabled' }, enabledEl.checked));

  function render() {
    enabledEl.checked = !!s.enabled;
    document.body.classList.toggle('disabled', !s.enabled);
    for (const { item, wrap, update } of controls.values()) {
      update(s[item.key]);
      wrap.hidden = item.showIf ? !item.showIf(s) : false;
    }
    drawMock();
  }

  const status = document.getElementById('status');
  let statusTimer = null;
  function flash(text) {
    status.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ''; }, 2500);
  }

  // スライダーを動かしている間は同期ストレージの書き込み回数の上限に当たらないよう、少し待ってまとめて保存する
  const timers = new Map();
  function set(it, value, delay = 0) {
    s[it.key] = value;
    render();
    clearTimeout(timers.get(it.key));
    timers.set(it.key, setTimeout(() => {
      timers.delete(it.key);
      chrome.storage.sync.set({ [it.key]: value }, () => flash(it.reload ? '保存しました。YouTube のタブを読み込み直すと反映されます' : '保存しました'));
    }, delay));
  }

  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('すべての設定を既定に戻しますか？')) return;
    s = { ...D };
    render();
    chrome.storage.sync.set({ ...D }, () => flash('既定に戻しました'));
  });

  // ---- 見取り図 ----
  // 仮想のウィンドウ（幅 1920、画面の高さ 900）での配置を大まかに計算し、高さ 1500 までを描く
  const VW = 1920;
  const VH = 900;
  const MH = 1500;
  const MAST = 56;
  const GAP = 16;
  const mock = document.getElementById('mock');
  const num = (v) => (Number(v) > 0 ? Number(v) : 0);

  function box(cls, x, y, w, hh, opts = {}) {
    const e = h('div', { class: `m ${cls}` });
    Object.assign(e.style, {
      left: `${(x / VW) * 100}%`, top: `${(y / MH) * 100}%`,
      width: `${(Math.max(0, w) / VW) * 100}%`, height: `${(Math.max(0, hh) / MH) * 100}%`,
    });
    if (opts.radius != null) e.style.borderRadius = opts.radius;
    if (opts.section) e.dataset.section = opts.section;
    if (opts.tag) e.append(h('span', { class: `tag${opts.tagTop ? ' top' : ''}` }, opts.tag));
    if (opts.title) e.title = opts.title;
    mock.append(e);
    return e;
  }

  function drawMock() {
    mock.textContent = '';
    box('mast', 0, 0, VW, MAST);
    if (s.classicLayout) drawClassic();
    else drawNew();
    box('screen-edge', 0, VH, VW, 0);
  }

  // 右端のアイコン列（縦）
  function railColumn(x) {
    box('solid', x, MAST + 8, 48, 4 * 64, { section: 'rail', title: '右端のアイコン列' });
    for (let i = 0; i < 4; i++) box('line', x + 8, MAST + 20 + i * 64, 32, 32);
  }

  function drawNew() {
    // YouTube の新しいレイアウト: プレイヤーが中央、関連動画は下にグリッド
    const railW = 64;
    const pw = Math.min(VW - GAP * 2 - railW, (VH - MAST - 12 - 136) * 16 / 9);
    const px = (VW - railW - pw) / 2;
    let y = MAST + 12;
    box('player solid', px, y, pw, pw * 9 / 16, { section: 'layout', tag: 'プレイヤー', radius: '8px' });
    y += pw * 9 / 16 + 14;
    box('line', px, y, pw * 0.55, 26);
    y += 70;
    const cw = (pw - 2 * 20) / 3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        box('', px + c * (cw + 20), y, cw, cw * 9 / 16, { section: 'layout' });
        box('line', px + c * (cw + 20), y + cw * 9 / 16 + 10, cw * 0.8, 16);
      }
      y += cw * 9 / 16 + 60;
    }
    railColumn(VW - GAP - 48);
    mock.append(h('div', { class: 'banner' }, '新しいレイアウト ― 下の設定は効きません'));
  }

  function drawClassic() {
    const railMode = s.sideRail;
    const railW = railMode === 'default' ? 64 : 0;
    const hasRelated = s.relatedPosition !== 'hidden';
    const commentsSide = s.commentsPosition === 'side';
    const hasSide = hasRelated || commentsSide || railMode === 'top';
    const usable = VW - railW;

    let sideW = 0;
    if (hasSide) {
      sideW = num(s.sidebarWidth) || Math.round(Math.min(700, Math.max(320, VW * 0.275)));
      sideW = Math.min(sideW, usable - 480);
    }
    const avail = usable - GAP * 2 - (hasSide ? sideW + GAP : 0);
    const hp = num(s.playerMaxHeight);
    const wp = num(s.playerMaxWidth);
    const capH = hp ? VH * hp / 100 : s.playerFill ? Infinity : VH - 116;
    const capW = Math.min(capH * 16 / 9, wp || Infinity);
    const playerW = Math.min(avail, capW);
    const primaryW = s.playerFill && !wp ? avail : playerW;
    const content = primaryW + (hasSide ? GAP + sideW : 0);
    const x0 = GAP + Math.max(0, (usable - GAP * 2 - content) / 2);
    const leftSide = hasSide && s.relatedPosition === 'left';
    const px = leftSide ? x0 + sideW + GAP : x0;
    const sx = leftSide ? x0 : x0 + primaryW + GAP;

    // 左右の余白（あれば）を薄く示す
    if (x0 > GAP + 4) {
      box('ghost', GAP, MAST + 12, x0 - GAP * 1.5, 240, { section: 'player', title: '左右の余白（プレイヤーを「横幅いっぱい」にすると消えます）' });
    }

    // ---- プレイヤー側の列 ----
    let y = MAST + 12;
    const ph = playerW * 9 / 16;
    const player = box('player solid', px, y, playerW, ph, { section: 'player', tag: 'プレイヤー', radius: s.playerSquare ? '0' : '8px' });
    if (!s.hideAmbient) player.classList.add('glow');
    y += ph + 14;
    const titleH = (num(s.titleSize) || 20) * 1.4;
    box('solid', px, y, Math.min(primaryW * 0.62, 1100), titleH, { section: 'title', title: 'タイトル' });
    y += titleH + 14;
    box('solid', px, y, 40, 40, { section: 'title', radius: '50%' });
    box('line', px + 52, y + 8, 160, 22);
    if (!s.hideActions) {
      const aw = s.hideActionLabels ? 230 : 440;
      box('', px + primaryW - aw, y, aw, 40, { section: 'title', title: 'ボタンの列', radius: '20px' });
    }
    y += 58;
    if (!s.hideShelves) {
      box('ghost', px, y, primaryW, 110, { section: 'title', tag: 'チケット・グッズの棚' });
      y += 124;
    }
    const dh = s.expandDescription ? 300 : 110;
    box('', px, y, primaryW, dh, { section: 'comments', tag: s.expandDescription ? '概要欄（開いた状態）' : '概要欄' });
    y += dh + 18;
    if (s.commentsPosition === 'below') {
      box('', px, y, primaryW, MH - y + 20, { section: 'comments', tag: 'コメント', tagTop: true });
    }

    // ---- 横の列 ----
    if (hasSide) {
      let sy = MAST + 12;
      if (railMode === 'top') {
        box('solid', sx, sy, sideW, 40, { section: 'rail', title: 'アイコン列（横一列）', radius: '20px' });
        sy += 54;
      }
      if (commentsSide) {
        const ch = num(s.sideCommentsHeight) ? VH * num(s.sideCommentsHeight) / 100 : VH - 80;
        box('', sx, sy, sideW, ch, { section: 'comments', tag: 'コメント', tagTop: true });
        sy += ch + 18;
      }
      if (hasRelated) {
        const tw = Math.min(num(s.relatedThumbWidth) || Math.round(Math.min(sideW * 0.55, 300)), sideW - 40);
        const th = tw * 9 / 16;
        const ts = num(s.relatedTextSize) || 14;
        const zone = box('ghost', sx - 4, sy - 4, sideW + 8, MH - sy + 20, { section: 'related', tag: '関連動画', tagTop: true });
        zone.style.zIndex = '1';
        zone.style.borderColor = 'transparent';
        while (sy < MH) {
          box('', sx, sy, tw, th);
          const tx = sx + tw + 12;
          const tWidth = Math.max(0, sideW - tw - 12);
          if (tWidth > 20) {
            box('line', tx, sy + 4, tWidth * 0.95, ts);
            box('line', tx, sy + 4 + ts * 1.6, tWidth * 0.6, ts);
          }
          sy += Math.max(th, ts * 4) + 12;
        }
      }
    }
    if (railMode === 'default') railColumn(VW - GAP - 48);
  }

  // 見取り図とカードの対応: カードに乗ると図の該当部分を光らせ、図をクリックするとカードへ移動する
  function lightMock(section, on) {
    mock.querySelectorAll(`[data-section="${section}"]`).forEach((e) => e.classList.toggle('lit', on));
  }
  mock.addEventListener('click', (e) => {
    const target = e.target.closest('[data-section]');
    if (!target) return;
    const card = document.getElementById(`sec-${target.dataset.section}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.classList.remove('flash');
    void card.offsetWidth;
    card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1500);
  });
  mock.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-section]');
    document.querySelectorAll('.card.lit').forEach((c) => c.classList.remove('lit'));
    if (target) {
      const card = document.getElementById(`sec-${target.dataset.section}`);
      if (card) card.classList.add('lit');
    }
  });
  mock.addEventListener('mouseleave', () => document.querySelectorAll('.card.lit').forEach((c) => c.classList.remove('lit')));

  // ---- 動作の確認 ----
  // content.js が chrome.storage.local の status に残した、直近の再生ページの状態を表示する
  const diag = document.getElementById('diag');
  function row(label, text, bad) {
    const dd = h('dd', bad ? { class: 'bad' } : {}, text);
    diag.append(h('dt', {}, label), dd);
  }
  function showStatus(st, cur) {
    diag.textContent = '';
    const version = chrome.runtime.getManifest().version;
    row('拡張の版', version);
    if (!st) {
      row('再生ページ', 'まだ記録がありません。YouTube の再生ページを開くか、タブを読み込み直してください', true);
      return;
    }
    row('記録した時刻', new Date(st.at).toLocaleString('ja-JP'));
    if (st.version !== version) {
      row('注意', `記録したときの拡張の版（${st.version}）が今の版と違います。YouTube のタブを読み込み直してください`, true);
    }
    const names = { 'ytd-watch-flexy': '以前のレイアウト', 'ytd-watch-grid': '新しいレイアウト（関連動画がプレイヤーの下）', 'ytd-watch-fixie': '新しいレイアウト（プレイヤーが画面いっぱい）' };
    const el = st.watchElement || '';
    row('レイアウト', el ? `${names[el] || el}（${el}）` : '再生ページが見つかりません', el !== 'ytd-watch-flexy' && cur.classicLayout);
    if (el === 'ytd-watch-flexy') {
      const narrow = !st.twoColumns;
      row('列', narrow ? '1 列' : '2 列', narrow);
      const where = { side: '右の列', below: 'プレイヤーの下', hidden: '表示されていない', other: 'その他の位置', none: '見つからない' };
      if (st.relatedLocation) {
        const wantSide = cur.enabled && cur.classicLayout && cur.relatedPosition !== 'hidden';
        row('関連動画の位置', where[st.relatedLocation] || st.relatedLocation, wantSide && st.relatedLocation !== 'side');
      }
      if (st.sideRail) {
        if (cur.enabled && cur.classicLayout) row('注意', '右端のアイコン列の「閉じられるパネル」が有効なままです（関連動画がプレイヤーの下に回る原因）。TubeLayout を再読み込みしてから、YouTube のタブを読み込み直してください', true);
        else row('メモ', '右端のアイコン列の「閉じられるパネル」が有効です。「以前のレイアウト」にすると、関連動画が右の列に戻ります');
      }
      const threshold = num(cur.twoColumnMinWidth) || 1000;
      row('ウィンドウの幅', `${st.windowWidth}px（${threshold}px 以上で 2 列）`, narrow);
    }
    const p = st.page;
    if (!p) {
      row('ページ側の処理', '動いていません。chrome://extensions で TubeLayout を再読み込み（↻）してから、YouTube のタブを読み込み直してください', true);
    } else {
      const parts = [];
      parts.push(p.classic ? '以前のレイアウトに切り替え: する' : '以前のレイアウトに切り替え: しない');
      parts.push(p.twoColumnMinWidth ? `2 列の最小幅: ${p.twoColumnMinWidth}px` : '2 列の最小幅: YouTube の既定');
      parts.push(p.hooked ? 'フラグの書き換え: できた' : 'フラグの書き換え: できなかった');
      const orig = Object.entries(p.original || {}).map(([k, v]) => `${k}=${v}`).join(', ');
      if (orig) parts.push(`YouTube の元の値: ${orig}`);
      row('ページ側の処理', parts.join(' / '), (p.classic || p.twoColumnMinWidth) && !p.hooked);
    }
  }
  function refreshStatus() {
    chrome.storage.local.get({ status: null }, ({ status: st }) => showStatus(st, s));
  }

  // ---- 起動 ----
  chrome.storage.sync.get(D, (stored) => {
    s = { ...D, ...stored };
    render();
    refreshStatus();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.status) refreshStatus();
    if (area === 'sync') {
      // 別のタブの設定画面で変えたときなど
      let changed = false;
      for (const k in changes) {
        const v = changes[k].newValue === undefined ? D[k] : changes[k].newValue;
        if (s[k] !== v && !timers.has(k)) { s[k] = v; changed = true; }
      }
      if (changed) render();
    }
  });
  render();
})();
