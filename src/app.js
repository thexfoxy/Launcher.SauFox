// The launcher window — a Steam-like store + library over a cyberpunk glass
// shell. It only ever asks the backend (Rust) to do things; the backend holds
// the session and talks to the server. Buying always bounces to the website,
// so money changes hands there and only there. Bilingual, like the rest of
// SauFox, and every motion respects prefers-reduced-motion.
const T = window.__TAURI__;
const invoke = (cmd, args) => T.core.invoke(cmd, args);
const listen = (event, cb) => T.event.listen(event, cb);
const app = document.getElementById("app");
const SITE = "https://saufoxentertainment.ir";
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Language ----------
const FA = {
  "Customer launcher": "لانچر مشتریان",
  "Your games, one launcher.": "بازی‌های شما، یک لانچر.",
  "Sign in with your SauFox account": "ورود با حساب ساوفاکس",
  "Waiting for you to allow it in the browser…": "منتظر تأیید شما در مرورگر…",
  "Sign-in cancelled.": "ورود لغو شد.",
  "Sign-in timed out.": "زمان ورود تمام شد.",
  "Sign out": "خروج",
  Store: "فروشگاه",
  Library: "کتابخانه",
  Downloads: "دانلودها",
  "Store — all our games": "فروشگاه — همه‌ی بازی‌ها",
  "Buy on the website, play here.": "در سایت بخرید، اینجا بازی کنید.",
  "Featured": "ویژه",
  "Your library": "کتابخانه‌ی شما",
  "Everything you own, ready to install.": "هرچه دارید، آماده‌ی نصب.",
  "Have a game key?": "کلید بازی دارید؟",
  Add: "افزودن",
  Buy: "خرید",
  "Buy on the website": "خرید از وب‌سایت",
  "View": "مشاهده",
  Install: "نصب",
  Play: "اجرا",
  Update: "به‌روزرسانی",
  "Installing…": "در حال نصب…",
  "Downloading…": "در حال دانلود…",
  "Checking…": "در حال بررسی…",
  "Unpacking…": "در حال باز کردن…",
  Installed: "نصب‌شده",
  Owned: "خریداری‌شده",
  "In library": "در کتابخانه",
  Copy: "کپی",
  Copied: "کپی شد",
  "Your key": "کلید شما",
  "Your library is empty": "کتابخانه‌ی شما خالی است",
  "Games you buy or unlock will appear here.": "بازی‌هایی که می‌خرید یا فعال می‌کنید اینجا می‌آیند.",
  "Browse the store": "دیدن فروشگاه",
  "No active downloads": "دانلود فعالی نیست",
  "Installs in progress will show up here.": "نصب‌های در حال انجام اینجا نمایش داده می‌شوند.",
  Back: "بازگشت",
  Overview: "معرفی",
  Screenshots: "تصاویر",
  "About this game": "درباره‌ی این بازی",
  Rating: "رده‌بندی",
  Platforms: "پلتفرم‌ها",
  Genres: "ژانرها",
  Reviews: "نقدها",
  reviews: "نقد",
  Free: "رایگان",
  gift: "هدیه",
  "This computer counts toward the key's device limit.": "این کامپیوتر جزو سقف دستگاه‌های کلید حساب می‌شود.",
  "You've reached this key's device limit.": "به سقف دستگاه‌های این کلید رسیده‌اید.",
  "That key isn't valid.": "این کلید معتبر نیست.",
  "That key is already on another account.": "این کلید روی حساب دیگری فعال شده است.",
  "Added to your library.": "به کتابخانه افزوده شد.",
  "Not available for Windows yet.": "هنوز برای ویندوز آماده نیست.",
  "Something went wrong. Try again.": "مشکلی پیش آمد. دوباره امتحان کنید.",
  "Need help?": "کمک می‌خواهید؟",
  "This PC": "این کامپیوتر",
  devices: "دستگاه",
};
let LANG = "en";
try {
  LANG = localStorage.getItem("saufox.launcher.lang") || ((navigator.language || "").startsWith("fa") ? "fa" : "en");
} catch (e) {}
const t = (s) => (LANG === "fa" && FA[s]) || s;
const applyLang = () => {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === "fa" ? "rtl" : "ltr";
};
const digits = (n) => (LANG === "fa" ? String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : String(n));

// ---------- Tiny DOM builder ----------
const h = (tag, attrs, ...kids) => {
  const [name, ...cls] = tag.split(".");
  const el = document.createElement(name || "div");
  if (cls.length) el.className = cls.join(" ");
  if (attrs && (attrs.nodeType || typeof attrs !== "object")) {
    kids.unshift(attrs);
    attrs = null;
  }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "src") el.src = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};
const svg = (paths, attrs) => {
  const s = `<svg viewBox="0 0 24 24">${paths}</svg>`;
  const wrap = h("span", { html: s });
  const el = wrap.firstChild;
  for (const k in attrs || {}) el.setAttribute(k, attrs[k]);
  return el;
};

const fmtSize = (bytes) => {
  if (!bytes) return "";
  const gb = bytes / 1e9;
  if (gb >= 1) return `${digits(gb.toFixed(1))} GB`;
  return `${digits(Math.round(bytes / 1e6))} MB`;
};
const money = (g) => {
  if (LANG === "fa") return g.price_irr == null ? t("Free") : `${Number(g.price_irr).toLocaleString("fa-IR")} ریال`;
  return g.price_usd == null ? t("Free") : `$${Number(g.price_usd).toFixed(2)}`;
};
const art = (path) => (path ? (/^https?:/.test(path) ? path : `${SITE}/${path}`) : "logo.webp");
const synopsisOf = (g) => (LANG === "fa" ? g.synopsis_fa || g.synopsis : g.synopsis || g.synopsis_fa) || "";

// ---------- Motion helpers ----------
// A soft light that follows the pointer (feeds the CSS --mx/--my vars).
const glow = (el) => {
  if (reduce) return el;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
  return el;
};
// A gentle 3-D tilt toward the pointer, for the store cards.
const tilt = (el) => {
  if (reduce) return el;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) translateY(-6px)`;
  });
  el.addEventListener("pointerleave", () => (el.style.transform = ""));
  return el;
};
// Reveal children as they scroll into view, lightly staggered.
let revealObs = null;
const watchReveals = (root) => {
  if (reduce) {
    root.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-in"));
    return;
  }
  if (revealObs) revealObs.disconnect();
  revealObs = new IntersectionObserver(
    (entries) => {
      for (const en of entries)
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          revealObs.unobserve(en.target);
        }
    },
    { root, threshold: 0.08 }
  );
  root.querySelectorAll(".reveal").forEach((n, i) => {
    n.style.transitionDelay = `${Math.min(i * 45, 400)}ms`;
    revealObs.observe(n);
  });
};

// ---------- Toast & lightbox ----------
let toastTimer = null;
const toast = (msg, kind) => {
  document.querySelector(".toast")?.remove();
  const el = h("div", { class: `toast${kind ? ` is-${kind}` : ""}` }, msg);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
};
const lightbox = (srcs, i) => {
  const box = h("div.lightbox", h("img", { src: srcs[i], alt: "" }));
  box.addEventListener("click", () => box.remove());
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      box.remove();
      document.removeEventListener("keydown", esc);
    }
  });
  document.body.append(box);
};

// ---------- Install progress (shared across views) ----------
const installState = {}; // work_id -> { phase, pct, received, total }
const downloading = new Set();
let subs = {}; // work_id -> [fn]
const subscribe = (id, fn) => {
  (subs[id] = subs[id] || []).push(fn);
  if (installState[id]) fn(installState[id]);
};
let progressBound = false;
const bindProgress = () => {
  if (progressBound) return;
  progressBound = true;
  listen("install-progress", (e) => {
    const p = e.payload;
    const pct = p.total ? Math.min(100, Math.round((p.received / p.total) * 100)) : 0;
    installState[p.work_id] = { phase: p.phase, pct, received: p.received, total: p.total };
    (subs[p.work_id] || []).forEach((fn) => fn(installState[p.work_id]));
  });
};
const phaseText = (s) =>
  s.phase === "download" ? `${t("Downloading…")} ${digits(s.pct)}%` : s.phase === "verify" ? t("Checking…") : s.phase === "install" ? t("Unpacking…") : "";

// ---------- State ----------
const STATE = { me: null, catalog: [], deviceName: "", view: "store", detail: null };
const gameById = (id) => STATE.catalog.find((g) => g.id === id);
const owned = () => STATE.catalog.filter((g) => g.owned);

const refresh = async () => {
  try {
    STATE.catalog = (await invoke("catalog")) || [];
  } catch (e) {
    STATE.catalog = [];
  }
};

// ---------- Window controls ----------
const wireWindow = () => {
  let win;
  try {
    const w = T.window;
    win = (w.getCurrentWindow || w.getCurrent).call(w);
  } catch (e) {
    return;
  }
  document.querySelectorAll("[data-win]").forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.win;
      if (a === "min") win.minimize();
      else if (a === "max") win.toggleMaximize();
      else win.close();
    };
  });
};

// ---------- Sign-in gate ----------
const gate = (problem) => {
  applyLang();
  const problemEl = h("p.gate__problem", { role: "alert" }, problem ? t("Something went wrong. Try again.") : "");
  const hint = h("p.gate__problem");
  const go = glow(h("button.button.button--primary.button--lg.gate__go", {}, t("Sign in with your SauFox account")));
  go.addEventListener("click", async () => {
    go.disabled = true;
    problemEl.textContent = "";
    hint.textContent = t("Waiting for you to allow it in the browser…");
    try {
      await invoke("sign_in");
      boot();
    } catch (e) {
      go.disabled = false;
      hint.textContent = "";
      const msg = String(e);
      problemEl.textContent =
        msg === "sign-in cancelled" ? t("Sign-in cancelled.") : msg === "sign-in timed out" ? t("Sign-in timed out.") : t("Something went wrong. Try again.");
    }
  });
  app.replaceChildren(
    h(
      "div.gate",
      h(
        "div.gate__card",
        h("img.gate__logo", { src: "logo.webp", alt: "SauFox" }),
        h("p.gate__kicker", t("Customer launcher")),
        h("h1.gate__title", "SauFox Entertainment"),
        h("p.gate__lead", t("Your games, one launcher.")),
        problemEl,
        go,
        hint,
        h("div.gate__foot", h("button.linky", { onclick: toggleLang }, LANG === "fa" ? "English" : "فارسی"))
      )
    )
  );
};

const toggleLang = () => {
  LANG = LANG === "fa" ? "en" : "fa";
  try {
    localStorage.setItem("saufox.launcher.lang", LANG);
  } catch (e) {}
  applyLang();
  if (STATE.me) render();
  else gate();
};

// ---------- The shell (rail + view) ----------
const TABS = [
  { id: "store", label: "Store", icon: '<path d="M4 9h16l-1 11H5L4 9z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 9V7a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.7"/>' },
  { id: "library", label: "Library", icon: '<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>' },
  { id: "downloads", label: "Downloads", icon: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
];

let viewEl, pillEl, tabEls;
const buildShell = () => {
  applyLang();
  tabEls = {};
  pillEl = h("div.rail__pill");
  const nav = h("div.rail__nav", pillEl);
  TABS.forEach((tab) => {
    const el = h(
      "button.tab",
      { onclick: () => route(tab.id) },
      h("span", { html: `<svg viewBox="0 0 24 24">${tab.icon}</svg>` }).firstChild,
      h("span", t(tab.label))
    );
    tabEls[tab.id] = el;
    nav.append(el);
  });
  const initial = (STATE.me.email || "S").trim().charAt(0).toUpperCase();
  const acct = h("button.rail__acct", { title: STATE.me.email || "" }, initial);
  acct.addEventListener("click", (e) => openAccount(e, acct));

  viewEl = h("div.view");
  app.replaceChildren(h("div.shell", h("aside.rail", nav, h("div.rail__spacer"), acct), viewEl));
};

const openAccount = (e, anchor) => {
  document.querySelector(".pop")?.remove();
  const r = anchor.getBoundingClientRect();
  const pop = h(
    "div.pop",
    h("div.pop__email", { translate: "no" }, STATE.me.email || ""),
    h(
      "button.pop__item",
      { onclick: () => { pop.remove(); toggleLang(); } },
      svg('<path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
      LANG === "fa" ? "English" : "فارسی"
    ),
    h(
      "button.pop__item",
      { onclick: () => { pop.remove(); invoke("open_url", { url: "https://portal.saufoxentertainment.ir/" }); } },
      svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .8-1 1.7M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
      t("Need help?")
    ),
    h(
      "button.pop__item",
      { onclick: async () => { pop.remove(); await invoke("sign_out"); boot(); } },
      svg('<path d="M15 12H4m0 0l4-4m-4 4l4 4M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
      t("Sign out")
    )
  );
  pop.style.left = `${r.right + 10}px`;
  pop.style.bottom = `${window.innerHeight - r.bottom}px`;
  document.body.append(pop);
  setTimeout(() => document.addEventListener("pointerdown", function away(ev) {
    if (!pop.contains(ev.target) && ev.target !== anchor) {
      pop.remove();
      document.removeEventListener("pointerdown", away);
    }
  }), 0);
};

const movePill = (id) => {
  const el = tabEls[id];
  if (!el || !pillEl) return;
  pillEl.style.opacity = "1";
  pillEl.style.transform = `translateY(${el.offsetTop}px)`;
  for (const k in tabEls) tabEls[k].classList.toggle("is-active", k === id);
};

// ---------- Router ----------
const route = (view, param) => {
  // Remember which list a detail page was opened from, for the Back button.
  if (view === "detail" && ["store", "library", "downloads"].includes(STATE.view)) STATE.backTab = STATE.view;
  STATE.view = view;
  if (view !== "detail") movePill(view);
  else movePill(STATE.backTab || "store");
  subs = {};
  const content =
    view === "store" ? storeView() : view === "library" ? libraryView() : view === "downloads" ? downloadsView() : detailView(param);
  const inner = h("div.view__in", content);
  viewEl.replaceChildren(inner);
  viewEl.scrollTop = 0;
  watchReveals(viewEl);
};
const render = () => {
  buildShell();
  route(STATE.view === "detail" ? "store" : STATE.view);
};

// ---------- Store ----------
const storeView = () => {
  const games = STATE.catalog;
  const featured = games[0];
  const wrap = h("div.wrap");
  if (featured) wrap.append(featuredHero(featured));
  wrap.append(
    h("div.head", h("div", h("h2", t("Store — all our games")), h("p", t("Buy on the website, play here.")))),
    h("div.grid", games.map((g, i) => storeCard(g, i)))
  );
  return wrap;
};

const featuredHero = (g) => {
  const bg = h("div.feat__bg");
  bg.style.backgroundImage = `url("${art(g.hero_url || g.cover_url)}")`;
  if (g.hero_focus) bg.style.backgroundPosition = g.hero_focus;
  const buy = g.owned
    ? h("button.button.button--primary.button--lg", { onclick: () => route("detail", g.id) }, t("View"))
    : h("button.button.button--primary.button--lg", { onclick: () => buyOnSite(g) }, t("Buy on the website"));
  const feat = h(
    "div.feat.reveal",
    bg,
    h("div.feat__shade"),
    h(
      "div.feat__body",
      h("p.feat__kicker", t("Featured")),
      h("h2.feat__title", { translate: "no" }, g.title),
      h("div.feat__meta", ...metaChips(g)),
      h(
        "div.feat__actions",
        buy,
        h("button.button.button--ghost.button--lg", { onclick: () => route("detail", g.id) }, t("Overview")),
        g.owned ? h("span.feat__price", { class: "card__own" }, t("Owned")) : h("span.feat__price", money(g))
      )
    )
  );
  feat.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    route("detail", g.id);
  });
  return feat;
};

const metaChips = (g) => {
  const chips = [];
  if (g.rating) chips.push(h("span.chip", { translate: "no" }, g.rating));
  (g.platforms || []).forEach((p) => chips.push(h("span.chip", { translate: "no" }, p)));
  const avg = g.review_count ? g.review_sum / g.review_count : 0;
  if (g.review_count) chips.push(h("span.chip", stars(avg / 2), ` ${digits(avg.toFixed(1))}`));
  return chips;
};
const stars = (n) => {
  const full = Math.round(n);
  return h("span.stars", h("span", "★★★★★".slice(0, full)), h("span.off", "★★★★★".slice(full)));
};

const storeCard = (g, i) => {
  const badge = g.owned
    ? h("span.card__badge.card__badge--own", t("Owned"))
    : null;
  const card = tilt(
    glow(
      h(
        "div.card.reveal",
        { onclick: () => route("detail", g.id) },
        h(
          "div.card__art",
          badge,
          h("span.card__glin"),
          h("img", { src: art(g.cover_url), alt: "", onerror: (e) => (e.target.src = "logo.webp") })
        ),
        h(
          "div.card__foot",
          h("div.card__name", { translate: "no" }, g.title),
          h("div.card__sub", g.owned ? h("span.card__own", t("In library")) : h("span.card__price", money(g)), h("span", (g.platforms || [])[0] || ""))
        )
      )
    )
  );
  return card;
};

// ---------- Game detail ----------
const detailView = (id) => {
  const g = gameById(id);
  if (!g) return storeView();
  STATE.detail = id;
  const wrap = h("div");

  const hero = h("div.detail__hero");
  const bg = h("div.detail__bg");
  bg.style.backgroundImage = `url("${art(g.hero_url || g.cover_url)}")`;
  if (g.hero_focus) bg.style.backgroundPosition = g.hero_focus;
  hero.append(bg);

  const back = h("button.back", { onclick: () => route(STATE.backTab || "store") }, svg('<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2"/>'), t("Back"));

  const shots = (g.stills || []).length
    ? h(
        "div.shots.reveal",
        (g.stills || []).map((s, i) =>
          h("div.shot", { onclick: () => lightbox((g.stills || []).map(art), i) }, h("img", { src: art(s), alt: "", loading: "lazy" }))
        )
      )
    : null;

  const syn = synopsisOf(g);
  const left = h(
    "div",
    h("h1.detail__title", { translate: "no" }, g.title),
    h("div.detail__meta", ...metaChips(g)),
    shots,
    syn ? h("div.reveal", h("h3", { style: "color:var(--text);margin:0 0 8px" }, t("About this game")), h("p.prose", syn)) : null
  );

  const side = detailSide(g);

  wrap.append(hero, back, h("div.detail__grid", left, side));
  return wrap;
};

const detailSide = (g) => {
  const note = h("p.side-card__note");
  const bar = h("span");
  const barWrap = h("div.bar", { hidden: true }, bar);
  const action = h("button.button.button--primary.button--wide");
  const extra = h("div");

  const rows = [];
  if (g.rating) rows.push(["Rating", g.rating]);
  if ((g.platforms || []).length) rows.push(["Platforms", (g.platforms || []).join(", ")]);
  if ((g.genres || []).length) rows.push(["Genres", (g.genres || []).join(", ")]);
  if (g.review_count) rows.push(["Reviews", `${digits(g.review_count)} ${t("reviews")}`]);

  const setPlay = () => {
    action.textContent = t("Play");
    action.disabled = false;
    action.onclick = async () => {
      action.disabled = true;
      try {
        await invoke("play", { workId: g.work_id || g.id, licenseId: g.license_id });
      } catch (e) {
        toast(t("Something went wrong. Try again."), "err");
      }
      setTimeout(() => (action.disabled = false), 2500);
    };
  };
  const setInstall = (label) => {
    action.textContent = label;
    action.disabled = false;
    action.onclick = () => runInstall(g, { action, note, bar, barWrap, onDone: () => { note.textContent = `v${digits(g.build.version)} · ${t("Installed")}`; setPlay(); } });
  };

  if (!g.owned) {
    action.textContent = t("Buy on the website");
    action.onclick = () => buyOnSite(g);
    note.textContent = "";
  } else if (!g.build) {
    action.textContent = t("Install");
    action.disabled = true;
    note.textContent = t("Not available for Windows yet.");
  } else if (g.installed && g.installed.build_id === g.build.id) {
    setPlay();
    note.textContent = `v${digits(g.build.version)} · ${t("Installed")}`;
  } else if (g.installed) {
    setInstall(t("Update"));
    note.textContent = `v${digits(g.build.version)} · ${fmtSize(g.build.size_bytes)}`;
  } else {
    setInstall(t("Install"));
    note.textContent = fmtSize(g.build.size_bytes);
  }

  // Live progress if this game is mid-install.
  subscribe(g.work_id || g.id, (s) => {
    if (s.pct >= 100 && s.phase === "install") return;
    barWrap.hidden = false;
    bar.style.width = `${s.pct}%`;
    note.textContent = phaseText(s);
  });

  if (g.owned && g.code) {
    extra.append(
      h("div.keybox", h("code", { translate: "no" }, g.code), copyMini(g.code)),
      g.max_devices != null
        ? h("div.side-card__row", h("span", t("devices")), h("span", `${digits(g.devices || 0)} / ${digits(g.max_devices)}`))
        : null
    );
  }

  return h(
    "div.side-card.reveal",
    h("h4", g.owned ? t("Owned") : t("Buy")),
    g.owned ? h("div.side-card__price", { class: "card__own" }, t("In library")) : h("div.side-card__price", money(g)),
    action,
    barWrap,
    note,
    ...rows.map(([k, v]) => h("div.side-card__row", h("span", t(k)), h("span", { translate: k === "Rating" || k === "Platforms" || k === "Genres" ? "no" : null }, v))),
    extra
  );
};

const copyMini = (code) => {
  const b = h("button.mini", t("Copy"));
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      b.textContent = t("Copied");
      setTimeout(() => (b.textContent = t("Copy")), 1400);
    } catch (e) {}
  });
  return b;
};

// ---------- Install runner ----------
const runInstall = async (g, ui) => {
  const build = g.build;
  ui.action.disabled = true;
  ui.note.classList.remove("is-error");
  ui.barWrap.hidden = false;
  downloading.add(g.work_id || g.id);
  try {
    await invoke("install_game", {
      workId: g.work_id || g.id,
      licenseId: g.license_id,
      buildId: build.id,
      version: build.version,
      sha256: build.sha256 || null,
    });
    downloading.delete(g.work_id || g.id);
    delete installState[g.work_id || g.id];
    g.installed = { version: build.version, build_id: build.id };
    ui.barWrap.hidden = true;
    ui.onDone && ui.onDone();
    toast(`${g.title} · ${t("Installed")}`, "ok");
    if (STATE.view === "downloads") route("downloads");
  } catch (e) {
    downloading.delete(g.work_id || g.id);
    delete installState[g.work_id || g.id];
    ui.barWrap.hidden = true;
    ui.note.classList.add("is-error");
    const msg = String(e);
    ui.note.textContent = msg === "device-limit" ? t("You've reached this key's device limit.") : t("Something went wrong. Try again.");
    ui.action.disabled = false;
    ui.action.textContent = g.installed ? t("Update") : t("Install");
    ui.action.onclick = () => runInstall(g, ui);
  }
};

const buyOnSite = (g) => {
  invoke("open_url", { url: `${SITE}/checkout?id=${encodeURIComponent(g.id)}` });
  toast(LANG === "fa" ? "خرید در مرورگر باز شد…" : "Opening checkout in your browser…");
};

// ---------- Library ----------
const libraryView = () => {
  const games = owned();
  const wrap = h("div.wrap");

  const code = h("input", { type: "text", placeholder: "SFOX-XXXX-XXXX-XXXX-XXXX", maxlength: 24, spellcheck: "false" });
  const addBtn = h("button.button.button--primary", {}, t("Add"));
  const redeemNote = h("p.side-card__note");
  const doRedeem = async () => {
    const value = code.value.trim();
    if (value.replace(/[^A-Za-z0-9]/g, "").length < 8) return;
    addBtn.disabled = true;
    redeemNote.textContent = "";
    redeemNote.classList.remove("is-error");
    try {
      await invoke("redeem", { code: value });
      code.value = "";
      toast(t("Added to your library."), "ok");
      await refresh();
      route("library");
    } catch (e) {
      addBtn.disabled = false;
      redeemNote.classList.add("is-error");
      const c = String(e);
      redeemNote.textContent = c.includes("SF032")
        ? t("That key is already on another account.")
        : c.includes("SF031")
          ? t("That key isn't valid.")
          : t("Something went wrong. Try again.");
    }
  };
  addBtn.addEventListener("click", doRedeem);
  code.addEventListener("keydown", (e) => e.key === "Enter" && doRedeem());

  wrap.append(
    h("div.head", h("div", h("h2", t("Your library")), h("p", t("Everything you own, ready to install."))), h("div", h("div.redeem", code, addBtn), redeemNote))
  );

  if (games.length === 0) {
    wrap.append(
      h(
        "div.empty",
        h("img", { src: "logo.webp", alt: "" }),
        h("p", { style: "color:var(--text);font-weight:700" }, t("Your library is empty")),
        h("p", t("Games you buy or unlock will appear here.")),
        h("button.button.button--primary", { onclick: () => route("store") }, t("Browse the store"))
      )
    );
  } else {
    wrap.append(h("div.grid", games.map((g, i) => storeCard(g, i))));
  }
  return wrap;
};

// ---------- Downloads ----------
const downloadsView = () => {
  const wrap = h("div.wrap");
  wrap.append(h("div.head", h("div", h("h2", t("Downloads")))));
  const active = STATE.catalog.filter((g) => downloading.has(g.work_id || g.id));
  if (active.length === 0) {
    wrap.append(
      h(
        "div.empty",
        h("img", { src: "logo.webp", alt: "" }),
        h("p", { style: "color:var(--text);font-weight:700" }, t("No active downloads")),
        h("p", t("Installs in progress will show up here."))
      )
    );
    return wrap;
  }
  const list = h("div.dl");
  active.forEach((g) => {
    const bar = h("span");
    const note = h("div.dl-row__note");
    subscribe(g.work_id || g.id, (s) => {
      bar.style.width = `${s.pct}%`;
      note.textContent = phaseText(s);
    });
    list.append(
      h(
        "div.dl-row.reveal",
        h("img", { src: art(g.cover_url), alt: "" }),
        h("div.dl-row__body", h("div.dl-row__name", { translate: "no" }, g.title), note, h("div.bar", bar)),
        h("button.mini", { onclick: () => route("detail", g.id) }, t("View"))
      )
    );
  });
  wrap.append(list);
  return wrap;
};

// ---------- Boot ----------
const boot = async () => {
  applyLang();
  app.replaceChildren(h("div.loading", h("span")));
  bindProgress();
  let me;
  try {
    me = await invoke("me");
  } catch (e) {
    me = null;
  }
  if (!me) return gate();
  STATE.me = me;
  try {
    STATE.deviceName = (await invoke("device_info")).name || "";
  } catch (e) {}
  await refresh();
  STATE.view = "store";
  render();
};

wireWindow();
window.addEventListener("DOMContentLoaded", boot);
if (document.readyState !== "loading") boot();
