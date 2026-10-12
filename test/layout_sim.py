# TubeLayout を実際の YouTube の再生ページで動かし、設定ごとの配置を記録する
#
# Google Chrome 147 は --load-extension で拡張を読み込めないので、chrome.storage の代用オブジェクトと
# settings.js・content.js をページに注入して動かす（content script と違い page context で動くが、DOM と CSS の扱いは同じ）。
#
# 使い方: python3 test/layout_sim.py ['<場面 JSON>']
#   場面:  [["名前", {設定}, [幅, 高さ]], ...]。省略時は下の SCENES。設定は既定値からの差分で、場面ごとに既定値へ戻してから当てる
#          （ページは読み込み直さず chrome.storage.onChanged 経由で切り替えるので、設定の即時反映も確かめられる）。
#          3 つ目は省略可。[幅, 高さ] ならその場面の前にウィンドウの大きさを変え（1 列／2 列の切り替えの確認用）、
#          文字列ならそのセレクタの要素をクリックしてページ内遷移する（例: "#related a.ytLockupViewModelContentImage"）
#   環境変数: URL=<再生ページ>  W=<ウィンドウ幅>  H=<ウィンドウ高さ>  OUT=<スクリーンショットの保存先フォルダ>（既定は test/）
#             SCROLL=<px>  撮影前にこの分だけ下へスクロールする
#             FORCE_FLAGS=<フラグ,...>  ページの HTML の EXPERIMENT_FLAGS にこのフラグを足す（「名前」は true、「名前=値」はその値）。
#             SIDE_RAIL_MENU=<JSON ファイル>  最初の読み込みのデータ（ytInitialData）に右端のアイコン列（fixedSideMenu）を足す。
#                          ログイン中のアカウントにだけサーバーから届く。例: test/side_rail_menu.json（ユーザーの画面の構造に合わせて作ったもの。
#                          ボタンの動作は推測。ページ内遷移の後のデータには入らない）
#             FORCE_FLAGS_FILE=<ファイル>  同じ指定を 1 行 1 つで書いたファイル（# で始まる行は無視）。例: test/flags_side_rail.txt
#                          例: kevlar_watch_grid（ログイン中のアカウントに出る新しいレイアウト ytd-watch-grid を再現する）
#             CLASSIC=0  page.js が読む localStorage を「以前のレイアウトにしない」にして始める
#             TWO_COL=<px>  page.js が読む「2 列にする最小のウィンドウ幅」（既定 800。0 で YouTube の既定 1000）
#             FIXED_SIDEBAR=1  page.js が読む「関連動画の列の幅を一定にする」（設定 playerFixedFrame と組で使う）
# 各場面で test/<名前>.png を撮り、主な要素の位置と大きさ（x, y, 幅, 高さ）を出力する。
import asyncio, json, os, sys
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(HERE, '..')
URL = os.environ.get('URL', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
W = int(os.environ.get('W', 1600))
H = int(os.environ.get('H', 1000))
OUT = os.environ.get('OUT', HERE)
SCROLL = int(os.environ.get('SCROLL', 0))
FORCE_FLAGS = [f.strip() for f in os.environ.get('FORCE_FLAGS', '').split(',') if f.strip()]
if os.environ.get('FORCE_FLAGS_FILE'):
    FORCE_FLAGS += [l.strip() for l in open(os.environ['FORCE_FLAGS_FILE'], encoding='utf-8') if l.strip() and not l.startswith('#')]


def flag_json(f):
    # "名前" は true、"名前=値" は値（数値として読めれば数値）
    name, _, value = f.partition('=')
    if not value:
        return f'"{name}":true,'
    try:
        v = json.loads(value)
    except ValueError:
        v = value
    return f'"{name}":{json.dumps(v)},'

SCENES = json.loads(sys.argv[1]) if len(sys.argv) > 1 else [
    ['default', {}],
    ['left_wide', {'relatedPosition': 'left', 'sidebarWidth': 520, 'relatedThumbWidth': 200, 'relatedTextSize': 16}],
    ['comments_side', {'commentsPosition': 'side', 'relatedPosition': 'hidden'}],
    ['player_small', {'playerMaxHeight': 45, 'playerSquare': True, 'titleSize': 26, 'hideActionLabels': True, 'hideShelves': True, 'expandDescription': True}],
]

STUB = """
(() => {
  if (window.top !== window) return;
  const store = {};
  const listeners = [];
  const chrome = {
    storage: {
      sync: {
        get(defaults, cb) { const r = { ...defaults }; for (const k in store) r[k] = store[k]; setTimeout(() => cb(r), 0); },
        set(obj, cb) {
          const changes = {};
          for (const k in obj) { changes[k] = { oldValue: store[k], newValue: obj[k] }; store[k] = obj[k]; }
          setTimeout(() => { listeners.forEach((l) => l(changes, 'sync')); cb && cb(); }, 0);
        },
      },
      onChanged: { addListener: (l) => listeners.push(l) },
    },
  };
  window.__tlSet = (obj) => chrome.storage.sync.set(obj);
  const run = () => { %s };
  if (document.documentElement) run();
  else { const mo = new MutationObserver(() => { if (document.documentElement) { mo.disconnect(); run(); } }); mo.observe(document, { childList: true }); }
})();
"""

MEASURE = """() => {
  const q = (s) => document.querySelector(s);
  const r = (s) => { const e = q(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width || b.height ? [b.x, b.y, b.width, b.height].map(Math.round) : 'hidden'; };
  const flexy = q('ytd-watch-flexy');
  const exp = q('#description-inline-expander');
  const comments = q('ytd-comments#comments');
  return {
    url: location.pathname + location.search,
    watchElement: ['ytd-watch-flexy', 'ytd-watch-grid', 'ytd-watch-fixie'].filter((t) => { const e = q(t); return e && e.getBoundingClientRect().height > 0; }).join(','),
    twoColumns: flexy && flexy.hasAttribute('is-two-columns_'),
    primary: r('#primary'), secondary: r('#secondary'), player: r('#movie_player'), video: r('video.html5-main-video'),
    related: r('#related'), relatedThumb: r('#related .ytLockupViewModelContentImage'), relatedTitle: r('#related .ytLockupMetadataViewModelTitle'),
    relatedTitleFont: q('#related .ytLockupMetadataViewModelTitle') && getComputedStyle(q('#related .ytLockupMetadataViewModelTitle')).fontSize,
    title: r('ytd-watch-metadata #title h1'), titleFont: q('ytd-watch-metadata #title h1') && getComputedStyle(q('ytd-watch-metadata #title h1')).fontSize,
    actions: r('ytd-watch-metadata #actions'), ticketShelf: r('#ticket-shelf'),
    comments: r('ytd-comments#comments'), commentsParent: comments && (comments.parentElement.id || comments.parentElement.className),
    commentThreads: document.querySelectorAll('ytd-comment-thread-renderer').length,
    firstComment: q('ytd-comment-thread-renderer #content-text') && q('ytd-comment-thread-renderer #content-text').textContent.trim().slice(0, 40),
    sideMenu: r('#fixed-side-menu'), sideMenuParent: q('#fixed-side-menu') && q('#fixed-side-menu').parentElement.id,
    sideMenuButtons: [...document.querySelectorAll('#fixed-side-menu toggle-button-view-model, #fixed-side-menu button-view-model')].filter((e) => e.matches('toggle-button-view-model') || !e.closest('toggle-button-view-model')).map((e) => { const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(Math.round).join(','); }),
    playerRadius: q('#ytd-player') && getComputedStyle(q('#ytd-player')).borderRadius,
    descriptionExpanded: exp && exp.hasAttribute('is-expanded'),
  };
}"""

DEFAULTS_JS = "() => window.__tlDefaults"


async def main():
    settings_js = open(os.path.join(EXT, 'settings.js'), encoding='utf-8').read()
    content_js = open(os.path.join(EXT, 'content.js'), encoding='utf-8').read()
    page_js = open(os.path.join(EXT, 'page.js'), encoding='utf-8').read()
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel='chrome', headless=True)
        ctx = await browser.new_context(viewport={'width': W, 'height': H}, locale='ja-JP', bypass_csp=True)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: print('[pageerror]', str(e)[:200]))
        # Google Fonts の読み込みを待ってスクリーンショットが止まることがあるので遮断する
        await page.route('**/fonts.googleapis.com/**', lambda r: r.abort())
        await page.route('**/fonts.gstatic.com/**', lambda r: r.abort())
        # init script は関数で包まれて評価されるので、settings.js の var はグローバルにならない。
        # 拡張と同じく settings.js → content.js の順に同じスコープで評価し、既定値は window.__tlDefaults で読む
        await page.add_init_script(STUB % (settings_js + '\nwindow.__tlDefaults = TubeLayoutDefaults;\n' + content_js))
        # page.js は拡張では MAIN world・document_start で動く。init script もページのスクリプトより先に動く
        # 実際の拡張では content.js が設定から localStorage に写す。最初の読み込みに間に合うよう先に入れておく
        page_config = {'classic': os.environ.get('CLASSIC') != '0', 'twoColumnMinWidth': int(os.environ.get('TWO_COL', 800)),
                       'fixedSidebar': os.environ.get('FIXED_SIDEBAR') == '1'}
        await page.add_init_script(f"localStorage.setItem('tubelayout-page', {json.dumps(json.dumps(page_config))})")
        await page.add_init_script(page_js)
        if FORCE_FLAGS or os.environ.get('SIDE_RAIL_MENU'):
            menu = open(os.environ['SIDE_RAIL_MENU'], encoding='utf-8').read() if os.environ.get('SIDE_RAIL_MENU') else None

            async def force(route):
                resp = await route.fetch()
                body = (await resp.text()).replace('"EXPERIMENT_FLAGS":{', '"EXPERIMENT_FLAGS":{' + ''.join(flag_json(f) for f in FORCE_FLAGS))
                if menu:
                    body = body.replace('"twoColumnWatchNextResults":{', '"twoColumnWatchNextResults":{"fixedSideMenu":' + json.dumps(json.loads(menu)) + ',', 1)
                await route.fulfill(response=resp, body=body)
            await page.route('https://www.youtube.com/watch*', force)
        await page.goto(URL, wait_until='domcontentloaded')
        await page.wait_for_timeout(7000)
        # コメントは画面に入ってから読み込まれる。一度スクロールして読み込ませてから戻す
        await page.mouse.wheel(0, 1200)
        await page.wait_for_timeout(2500)
        await page.mouse.wheel(0, -5000)
        await page.wait_for_timeout(800)
        defaults = await page.evaluate(DEFAULTS_JS)

        for name, s, *extra in SCENES:
            for x in extra:
                if isinstance(x, str):
                    await page.click(x)
                    await page.wait_for_timeout(5000)
                else:
                    await page.set_viewport_size({'width': x[0], 'height': x[1]})
                    await page.wait_for_timeout(1500)
            await page.evaluate('(o) => window.__tlSet(o)', {**defaults, **s})
            await page.wait_for_timeout(2500)
            if SCROLL:
                await page.mouse.wheel(0, SCROLL)
                await page.wait_for_timeout(1500)
            print(f'== {name} {json.dumps(s, ensure_ascii=False)}')
            print(json.dumps(await page.evaluate(MEASURE), ensure_ascii=False))
            await page.screenshot(path=os.path.join(OUT, f'{name}.png'))
            if SCROLL:
                await page.mouse.wheel(0, -SCROLL - 5000)
                await page.wait_for_timeout(800)
        await browser.close()


asyncio.run(main())
