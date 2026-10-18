function style(root, id, css) { if (root.querySelector('#' + id))
    return; const s = document.createElement('style'); s.id = id; s.textContent = css; root.append(s); }
export function decorateController(el) {
    const root = el.shadowRoot;
    if (!root)
        return;
    for (const child of root.querySelectorAll('is-component[name^="control-button-primary"]'))
        if (child.shadowRoot)
            style(child.shadowRoot, 'pointer-focus', ':host(:not([data-dialog-active])) .wing:not(.focus):focus:not(:focus-visible) .wing-bg-default{display:block}:host(:not([data-dialog-active])) .wing:not(.focus):focus:not(:focus-visible) .wing-bg-focus{display:none}');
    for (const child of root.querySelectorAll('is-component[name^="control-button-primary"]'))
        if (child.shadowRoot)
            style(child.shadowRoot, 'compact-text-spacing', ':host .wing.small:not(.right) .text{left:12px;width:80px;gap:2px}:host .wing.small .text small,:host .wing.small .text strong{line-height:14px}');
    const wing = root.querySelector('is-component[name^="control-button-primary"]');
    const progress = root.querySelector('.progress');
    const betButton = wing?.shadowRoot?.querySelector('.wing');
    if (wing && progress && betButton) {
        progress.style.left = (parseFloat(wing.style.left) + betButton.offsetLeft) + 'px';
        progress.style.width = betButton.offsetWidth + 'px';
    }
    const amount = wing?.shadowRoot?.querySelector('.text strong');
    if (amount && el.options.stakeDisplay)
        amount.textContent = String(el.options.stakeDisplay);
    for (const text of wing?.shadowRoot?.querySelectorAll('.text small,.text strong') || []) {
        text.style.fontSize = '12px';
        let size = 12;
        while (text.scrollWidth > text.clientWidth + 1 && size > 10) {
            size -= .5;
            text.style.fontSize = size + 'px';
        }
    }
    const dialog = root.querySelector('dialog[aria-label="stake"]');
    if (!dialog || dialog.dataset.adapted)
        return;
    dialog.dataset.adapted = 'true';
    const outside = (e) => { const r = dialog.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    let beganOutside = false;
    dialog.addEventListener('pointerdown', e => { beganOutside = outside(e); });
    dialog.addEventListener('click', e => { if (beganOutside && outside(e)) {
        e.preventDefault();
        e.stopPropagation();
        dialog.close();
    } });
    const picker = dialog.querySelector('is-component');
    for (const value of picker?.shadowRoot?.querySelectorAll('is-component[name="bet-value"]') || []) {
        value.options = { ...value.options, label: Number(value.options.value).toLocaleString(String(el.options.locale || 'en-GB'), { minimumFractionDigits: Number(el.options.digits ?? 2), maximumFractionDigits: Number(el.options.digits ?? 2) }) };
    }
}
export function decorateBonus(el) {
    const root = el.shadowRoot;
    if (!root)
        return;
    const heading = root.querySelector('.bonus-modal-heading p');
    if (heading)
        heading.textContent = 'Buy four Royal Bonus spins or activate Extra Chance for your paid rounds.';
    style(root, 'royal-bonus-fit', '.bonus-modal{max-height:calc(100dvh - 24px)}.bonus-modal-scroll{overflow-y:auto;overscroll-behavior:contain}.bonus-modal-offers{padding-bottom:16px}.bonus-modal-offers>is-component{max-width:100%}');
    for (const card of root.querySelectorAll('is-component[name="bonus-buy"]')) {
        const cr = card.shadowRoot;
        if (!cr)
            continue;
        const img = cr.querySelector('.bonus-art img');
        if (img) {
            img.src = card.options.key === 'royal' ? '/assets/chest.png' : '/assets/royal-wand.png';
            img.alt = card.options.key === 'royal' ? 'Royal treasure chest' : 'Extra Chance magic wand';
            img.style.objectFit = 'contain';
        }
        style(cr, 'royal-card', ':host .bonus-art{pointer-events:none;left:auto;right:8px;width:90px;height:110px;top:55px}:host .bonus-buy-actions{flex-wrap:wrap}:host .bonus-buy{height:auto;min-height:192px}:host .bonus-copy p{max-width:65%}');
        for (const a of cr.querySelectorAll('.bonus-buy-actions>is-component')) {
            a.style.setProperty('--button-width', 'max-content');
            a.style.maxWidth = '100%';
            if (a.shadowRoot)
                style(a.shadowRoot, 'price-fit', `:host .button{min-width:${card.options.type === 'confirmation' ? 90 : 130}px;padding-inline:16px}`);
        }
    }
}
export function decorateHelp(el) {
    const root = el.shadowRoot, body = root?.querySelector('.help-scroll');
    if (!root || !body)
        return;
    style(root, 'royal-help-style', ':host .help-panel{background:var(--surface-background-primary);max-width:calc(100vw - 24px);height:min(588px,calc(100dvh - 36px))}:host .help-panel>is-component{display:block;width:100%;flex:none}.help-no-results{padding:16px}');
    if (root.querySelector('[data-royal-search-heading]'))
        return;
    const heading = document.createElement('is-component');
    heading.setAttribute('name', 'modal-heading');
    heading.dataset.royalSearchHeading = 'true';
    heading.options = { title: 'How to Play', search: 'yes' };
    root.querySelector('.modal-heading')?.replaceWith(heading);
    let query = '', index = 0, matches = [];
    const empty = document.createElement('p');
    empty.className = 'help-no-results';
    empty.role = 'status';
    empty.textContent = 'No matching help found.';
    empty.hidden = true;
    body.appendChild(empty);
    const layout = () => { const hr = heading.shadowRoot; if (!hr)
        return; style(hr, 'royal-heading-fit', ':host .history-heading{width:100%}:host .history-search{max-width:100%}@media(max-width:389px){:host .history-heading:has(.history-search){flex-wrap:wrap;gap:8px}:host .history-search{flex:1 1 244px}}'); hr.querySelector('input')?.setAttribute('aria-label', 'Search How to Play'); };
    const update = (scroll = false) => { heading.options = { title: 'How to Play', search: 'yes', searchOpen: heading.options.searchOpen, query, matchCount: matches.length, matchIndex: index }; layout(); for (const item of Array.from(body.children))
        item.removeAttribute('data-current-match'); matches[index]?.setAttribute('data-current-match', 'true'); if (scroll)
        matches[index]?.scrollIntoView({ block: 'nearest' }); };
    heading.shadowRoot?.addEventListener('input', event => { const input = event.target; if (input.dataset.field === 'query')
        heading.dispatchEvent(new CustomEvent('is-action', { detail: { action: 'change', value: { field: 'query', value: input.value } }, bubbles: true, composed: true })); });
    heading.addEventListener('is-action', event => {
        event.stopPropagation();
        const { action, value } = event.detail;
        if (action === 'close') {
            el.dispatchEvent(new CustomEvent('is-action', { detail: { action: 'close' }, bubbles: true, composed: true }));
            return;
        }
        if (action === 'change' && value.field === 'query' || action === 'search-close') {
            query = action === 'search-close' ? '' : String(value.value);
            index = 0;
            matches = [];
            const q = query.trim().toLocaleLowerCase();
            for (const item of Array.from(body.children)) {
                if (item === empty)
                    continue;
                item.hidden = !!q && !item.textContent?.toLocaleLowerCase().includes(q);
                if (q && !item.hidden)
                    matches.push(item);
            }
            empty.hidden = !q || matches.length > 0;
            update();
        }
        else if (['previous-match', 'next-match'].includes(action) && matches.length) {
            index = (index + (action === 'next-match' ? 1 : -1) + matches.length) % matches.length;
            update(true);
        }
        else
            layout();
    });
    layout();
}
function inject(el, id, css) { if (!el.shadowRoot || el.shadowRoot.querySelector('#' + id))
    return; const style = document.createElement('style'); style.id = id; style.textContent = css; el.shadowRoot.appendChild(style); }
export function decorateHeader(el) { inject(el, 'royal-header', ':host{display:block;width:100%}:host .current-header{width:100%;max-width:none}:host .replay-title{color:var(--text-color-default)!important}'); const balance = el.shadowRoot?.querySelector('is-component[name="balance"]'); if (balance)
    inject(balance, 'left-balance', ':host .balance{width:max-content;min-width:0;max-width:100%;background:transparent;border:0}:host .balance>button:not(.selected){display:none}:host .balance>button{align-items:flex-start;text-align:left}:host .balance>button.selected{margin:0;height:44px;background:var(--button-background-default)}:host .balance strong{font-size:var(--font-size-120);line-height:var(--line-height-140)}'); if (el.dataset.bridge)
    return; el.dataset.bridge = 'true'; el.shadowRoot?.addEventListener('click', event => { const button = event.target.closest('button[data-action]'); if (!button)
    return; event.stopImmediatePropagation(); event.preventDefault(); if (button.dataset.action === 'balance-select')
    return; el.dispatchEvent(new CustomEvent('is-action', { detail: { action: button.dataset.action }, bubbles: true, composed: true })); }, true); }
export function decorateFooter(el) { inject(el, 'royal-footer', ':host{display:block;width:100%}:host .last-win{width:100%;max-width:none}'); }
export function decorateHistory(el) {
    inject(el, 'royal-history', ':host .history{width:min(390px,calc(100vw - 24px));height:min(588px,calc(100dvh - 32px));background:var(--surface-background-primary);border:var(--stroke-weight-100) solid var(--stroke-color-default);border-radius:var(--border-radius-80);overflow:hidden}:host .history-scroll{overscroll-behavior:contain}:host .history-scroll>is-component{width:100%;height:100%}');
    const fit = (node) => { if (!node.shadowRoot)
        return; inject(node, 'royal-history-content', ':host{width:100%;min-width:0}:host([name="modal-heading"]) .history-heading{width:100%!important;background:transparent;border-radius:0}:host .history-heading,:host .history-list,:host .history-state,:host .history-atom{width:100%;max-width:100%}:host .history-state{height:100%;min-height:0;padding:24px 16px}:host .history-list>is-component,:host .history-date-group>is-component,:host .history-expanded>is-component{--history-atom-width:100%}:host .history-atom .atom-id,:host .history-atom .atom-stake,:host .history-atom .atom-winnings{flex:1;min-width:0;width:auto}:host .history-atom.atom-title{padding-right:50px}:host .history-list{border-radius:0}'); for (const child of node.shadowRoot.querySelectorAll('is-component'))
        fit(child); };
    for (const child of el.shadowRoot?.querySelectorAll('is-component') || [])
        fit(child);
}
function decorateOpening(el) { inject(el, 'royal-opening', ':host .onboarding-main{min-height:0;overflow-y:auto;overscroll-behavior:contain}@media(max-height:500px) and (min-width:600px){:host .onboarding-main{display:grid;grid-template-columns:1fr 1.2fr;gap:8px 24px;align-content:center;padding:12px 24px}:host .onboarding-main>h1{grid-column:1/-1;font-size:20px;line-height:26px}:host .onboarding-main>.tutorial-slider{grid-column:1;grid-row:2/4;height:100px!important;margin:0}:host .onboarding-main>.dots{grid-column:1;grid-row:4}:host .onboarding-main>.tutorial-copy{grid-column:2;grid-row:2;padding:0;margin:0}:host .onboarding-main>.tutorial-actions{grid-column:2;grid-row:3/5;margin:0!important}:host .tutorial-copy h2{font-size:18px!important;line-height:24px!important}:host .tutorial-copy p{font-size:14px!important;line-height:20px!important}:host .opening-prompt{margin:0}:host .onboarding-main>is-component[name="game-logo"]{--onboarding-logo-height:150px}}'); }
