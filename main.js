/* lol */

if (typeof browser == "undefined" && typeof chrome == "object") {
    console.log('polyfilling chrome lol');
    browser = chrome;
    if (!browser.menus) browser.menus = browser.contextMenus;
    if (!browser.browserAction) browser.browserAction = browser.action;
}

const SCHEMES = [
        /^(http)s?:$/, /^(file):$/, /^s?(ftp):$/, /^(about):$/, /(.*)/];

function compareSchemes (a, b) {
    let elems = [a, b].map(x => {
        let scheme = x.protocol.toLowerCase();
        let rank   = SCHEMES.findIndex(y => { return scheme.match(y); });
        return [rank, scheme.match(SCHEMES[rank])[1]];
    });
    let cmp = elems[0][0] - elems[1][0];
    if (cmp == 0) {
        a = elems[0][1];
        b = elems[1][1];
        return a < b ? -1 : a > b ? 1 : 0;
    }
    return cmp;
}

function compareDomains (a, b) {
    let elems = [a, b].map(x => {
        x = x.hostname.toLowerCase().replace(/^www\d*\./, '');
        return x.split('.').reverse();
    });

    while (elems[0].length > 0 || elems[1].length > 0) {
        let d1 = elems[0].shift() || '';
        let d2 = elems[1].shift() || '';
        if (d1 == d2) continue;
        return d1 < d2 ? -1 : 1;
    }

    return 0;
}

function compareLocal (a, b) {
    let elems = [a, b].map(x => {
        return x.pathname + x.search + x.hash;
    });
    a = elems[0];
    b = elems[1];
    return a < b ? -1 : a > b ? 1 : 0;
}

function compareURIs (a, b) {
    if (!(a instanceof URL)) a = new URL(a);
    if (!(b instanceof URL)) b = new URL(b);

    // console.debug(`${a} <=> ${b}`);

    let cmp = compareSchemes(a, b);
    if (cmp === 0) {
        cmp = compareDomains(a, b);
        // Fork change:
        //   I find comparing URIs is too much control.
        //   Whereas sorting by domain is sensible in
        //   my opniion, because each domain stands for
        //   a specific function I do on that site.
        //   So check only domain and be stable in
        //   other regards.
        //   Thanks to the author of extension, this is
        //   supereasy to modify.
        // if (cmp === 0) cmp = compareLocal(a, b);
    }
    // console.debug(`${a} ${cmp < 0 ? '<' : cmp > 0 ? '>' : '='} ${b}`);
    return cmp;
}

function compareTabs (a, b) {
    // note the inversion here is deliberate
    let ap = a.pinned ? 0 : 1;
    let bp = b.pinned ? 0 : 1;
    // pinned tabs always come before unpinned tabs
    let cmp = ap - bp;

    // Loaded tabs are at the top of the list.
    let ad = a.discarded ? 1 : 0;
    let bd = b.discarded ? 1 : 0;
    cmp = ad - bd;

    if (cmp === 0) {
        cmp = compareURIs(a.url, b.url);
        if (cmp === 0) {
            // we want this reversed
            //cmp = b.lastAccessed - a.lastAccessed;
            // Fork change:
            //   Don't sort by access time. Rather
            //   Rather be stable, so that newer tabs
            //   open at the tail.
        }
    }

    return cmp;
}

function moveTabs (id, spec, fn) {
    if (browser.tabs.move.length == 1) {
        let p = browser.tabs.move(id, spec);
        return fn ? p.then(fn) : p;
    }
    return browser.tabs.move(id, spec, fn || function () {});
}

function getTabs (spec, func) {
    if (browser.tabs.query.length == 1)
        return browser.tabs.query(spec).then(func);
    return browser.tabs.query(spec, func);
}

function sortTabsByDomain (tab) {
    browser.storage.sync.get('pinned-tabs').then(p => {
        p = typeof p['pinned-tabs'] === 'undefined' ? true : p['pinned-tabs'];

        let mt = t => {
            t.sort(compareTabs);
            for (let i = 0; i < t.length; i++) {
                if (t[i].pinned && !p) continue;
                moveTabs(t[i].id, { index: i });
            }
        };

        getTabs({ currentWindow: true }, mt);
    });
}


browser.browserAction.onClicked.addListener(sortTabsByDomain);

/* Here is all the crap to do with Tabs To New Window */

// This function is a noop for now
function menuCreated (m) {
    if (typeof m !== 'undefined') console.log(m);
}

// This structure maps menu item IDs to sets of tabs. It is referenced
// when a menu item is clicked, and it is torn down and repopulated
// every time the menu is refreshed.
const TAB_MAP = {};

const CONTEXTS = ['all', 'page', 'action']; // 'tab'

setTimeout(function periodic () {
  sortTabsByDomain();
  setTimeout(periodic, 5000);
});
