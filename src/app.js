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
  Friends: "دوستان",
  Profile: "پروفایل",
  "Add a friend": "افزودن دوست",
  "Their username": "نام کاربری دوست",
  "Send request": "ارسال درخواست",
  "Friend requests": "درخواست‌های دوستی",
  "Online": "آنلاین",
  "Offline": "آفلاین",
  "Sent requests": "درخواست‌های ارسال‌شده",
  Accept: "پذیرفتن",
  Decline: "رد کردن",
  Cancel: "لغو",
  Remove: "حذف",
  "Tap again to remove": "برای حذف دوباره بزنید",
  "Playing {game}": "در حال بازی {game}",
  "Last online {when}": "آخرین بازدید {when}",
  "No friends yet": "هنوز دوستی ندارید",
  "Add friends by their username to see when they're online and what they play.": "دوستانتان را با نام کاربری اضافه کنید تا ببینید کی آنلاین هستند و چه بازی می‌کنند.",
  "Request sent.": "درخواست ارسال شد.",
  "You're now friends.": "حالا با هم دوست هستید.",
  "No one has that username.": "کسی با این نام کاربری پیدا نشد.",
  "That's you.": "این خودتان هستید.",
  "You're already friends.": "از قبل دوست هستید.",
  "Already sent; waiting for them.": "قبلاً فرستاده‌اید؛ منتظر پاسخ است.",
  "Choose your username": "نام کاربری خود را انتخاب کنید",
  "It's how friends find you and the name others see. Your real name and email stay private.": "دوستان شما را با این نام پیدا می‌کنند و دیگران همین را می‌بینند. نام واقعی و ایمیلتان خصوصی می‌ماند.",
  Username: "نام کاربری",
  "3–20 letters, numbers or _": "۳ تا ۲۰ حرف انگلیسی، عدد یا _",
  "About you": "درباره‌ی شما",
  "Who can see your profile": "چه کسانی پروفایل شما را ببینند",
  Everyone: "همه",
  "Friends only": "فقط دوستان",
  "Only me": "فقط خودم",
  Save: "ذخیره",
  "Saved.": "ذخیره شد.",
  "That username is taken.": "این نام کاربری گرفته شده است.",
  "Use 3–20 letters, numbers or _.": "از ۳ تا ۲۰ حرف انگلیسی، عدد یا _ استفاده کنید.",
  "Edit profile": "ویرایش پروفایل",
  "View on the website": "مشاهده در وب‌سایت",
  Level: "سطح",
  Games: "بازی‌ها",
  "Hours played": "ساعت بازی",
  "Recent activity": "فعالیت اخیر",
  "{h} hrs on record": "{h} ساعت بازی",
  "Last played {when}": "آخرین اجرا {when}",
  "This profile is private.": "این پروفایل خصوصی است.",
  "Add friend": "افزودن دوست",
  "Request sent": "درخواست ارسال شد",
  "Friends ✓": "دوست ✓",
  "Playtime": "زمان بازی",
  "Member since {when}": "عضو از {when}",
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
// "Playing {game}" and the like: translate, then fill in the parts.
const tf = (s, parts) => t(s).replace(/\{(\w+)\}/g, (_, k) => parts[k] ?? "");
const hours = (minutes) => digits((Math.round(((minutes || 0) / 60) * 10) / 10).toString());
const ago = (iso) => {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  const fa = LANG === "fa";
  if (mins < 60) return fa ? `${digits(mins || 1)} دقیقه پیش` : `${mins || 1} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return fa ? `${digits(hrs)} ساعت پیش` : `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return fa ? `${digits(days)} روز پیش` : `${days} d ago`;
};

// ---------- Tiny DOM builder ----------
const h = (tag, attrs, ...kids) => {
  const [name, ...cls] = tag.split(".");
  const el = document.createElement(name || "div");
  if (cls.length) el.className = cls.join(" ");
  if (attrs && (attrs.nodeType || Array.isArray(attrs) || typeof attrs !== "object")) {
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
const STATE = { me: null, catalog: [], deviceName: "", view: "store", detail: null, friends: [], playtime: {}, profile: null, playing: null };
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
  { id: "friends", label: "Friends", icon: '<circle cx="9" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 20a6 6 0 0 1 12 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="17" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 14.2a5 5 0 0 1 5.5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
  { id: "profile", label: "Profile", icon: '<circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
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
      h("span", t(tab.label)),
      tab.id === "friends" ? h("span.tab__badge", { hidden: true }) : null
    );
    tabEls[tab.id] = el;
    nav.append(el);
  });
  const initial = (STATE.me.email || "S").trim().charAt(0).toUpperCase();
  const acct = h("button.rail__acct", { title: STATE.me.email || "" }, initial);
  acct.addEventListener("click", (e) => openAccount(e, acct));

  viewEl = h("div.view");
  app.replaceChildren(h("div.shell", h("aside.rail", nav, h("div.rail__spacer"), acct), viewEl));
  updateFriendBadge();
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
  if (view === "detail" && ["store", "library", "downloads", "profile"].includes(STATE.view)) STATE.backTab = STATE.view;
  STATE.view = view;
  STATE.param = param;
  if (view === "user") movePill("friends");
  else if (view !== "detail") movePill(view);
  else movePill(STATE.backTab || "store");
  subs = {};
  const content =
    view === "store"
      ? storeView()
      : view === "library"
        ? libraryView()
        : view === "downloads"
          ? downloadsView()
          : view === "friends"
            ? friendsView()
            : view === "profile"
              ? profileView(null)
              : view === "user"
                ? profileView(param)
                : detailView(param);
  const inner = h("div.view__in", content);
  viewEl.replaceChildren(inner);
  viewEl.scrollTop = 0;
  watchReveals(viewEl);
};
const render = () => {
  buildShell();
  route(STATE.view === "detail" || STATE.view === "user" ? "store" : STATE.view);
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
  // One clear call to action per state — no duplicate "View"/"Overview".
  const actions = g.owned
    ? [
        h("button.button.button--primary.button--lg", { onclick: () => route("detail", g.id) }, t("View")),
        h("span.feat__price.card__own", t("Owned")),
      ]
    : [
        h("button.button.button--primary.button--lg", { onclick: () => buyOnSite(g) }, t("Buy on the website")),
        h("button.button.button--ghost.button--lg", { onclick: () => route("detail", g.id) }, t("View")),
        h("span.feat__price", money(g)),
      ];
  const feat = h(
    "div.feat.reveal",
    bg,
    h("div.feat__shade"),
    h(
      "div.feat__body",
      h("p.feat__kicker", t("Featured")),
      h("h2.feat__title", { translate: "no" }, g.title),
      h("div.feat__meta", ...metaChips(g)),
      h("div.feat__actions", ...actions)
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
  const played = STATE.playtime[g.work_id || g.id];
  if (g.owned && played) rows.push(["Playtime", tf("{h} hrs on record", { h: hours(played.minutes) })]);

  const setPlay = () => {
    action.textContent = t("Play");
    action.disabled = false;
    action.onclick = async () => {
      action.disabled = true;
      try {
        await invoke("play", { workId: g.work_id || g.id, licenseId: g.license_id });
        STATE.playing = g.work_id || g.id;
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
    const deviceCount = h("span", `${digits(g.devices || 0)} / ${digits(g.max_devices)}`);
    const manage = h("button.mini", LANG === "fa" ? "مدیریت دستگاه‌ها" : "Manage devices");
    const deviceList = h("div");
    manage.addEventListener("click", async () => {
      manage.disabled = true;
      try {
        const devices = await invoke("devices", { licenseId: g.license_id });
        g.devices = devices.length;
        deviceCount.textContent = `${digits(g.devices)} / ${digits(g.max_devices)}`;
        deviceList.replaceChildren();
        for (const device of devices) {
          const release = h("button.mini", LANG === "fa" ? "آزاد کردن" : "Release");
          const row = h("div.side-card__row", h("span", device.device_name || "PC"), release);
          release.addEventListener("click", async () => {
            release.disabled = true;
            try {
              await invoke("release_device", { licenseId: g.license_id, deviceHash: device.device_hash });
              row.remove();
              g.devices = Math.max(0, g.devices - 1);
              deviceCount.textContent = `${digits(g.devices)} / ${digits(g.max_devices)}`;
              if (!deviceList.children.length) deviceList.textContent = LANG === "fa" ? "دستگاهی ثبت نشده است." : "No devices registered.";
            } catch { release.disabled = false; note.textContent = t("Something went wrong. Try again."); }
          });
          deviceList.append(row);
        }
        if (!devices.length) deviceList.textContent = LANG === "fa" ? "دستگاهی ثبت نشده است." : "No devices registered.";
      } catch { note.textContent = t("Something went wrong. Try again."); }
      finally { manage.disabled = false; }
    });
    extra.append(manage, deviceList);
    extra.append(
      h("div.keybox", h("code", { translate: "no" }, g.code), copyMini(g.code)),
      g.max_devices != null
        ? h("div.side-card__row", h("span", t("devices")), deviceCount)
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

// ---------- Online: presence, friends, profiles ----------
// A heartbeat every minute keeps the account "online" (and says which game
// is running); the friends list refreshes every 30 seconds. All of it is
// read through the backend, which only lets through the social functions.
let onlineTimers = [];
let onlineListening = false;
const goOnline = () => {
  onlineTimers.forEach(clearInterval);
  const beat = () => invoke("heartbeat").catch(() => {});
  beat();
  loadFriends();
  loadPlaytime();
  loadMyProfile();
  onlineTimers = [setInterval(beat, 60000), setInterval(loadFriends, 30000)];
  if (onlineListening) return;
  onlineListening = true;
  listen("game-started", (e) => {
    STATE.playing = e.payload;
  });
  listen("game-exited", () => {
    STATE.playing = null;
    setTimeout(loadPlaytime, 1500);
  });
};

const loadFriends = async () => {
  try {
    STATE.friends = (await invoke("social_call", { action: "my_friends" })) || [];
  } catch (e) {
    return;
  }
  updateFriendBadge();
  // Redraw the friends page in place, unless the member is typing in it.
  if (STATE.view === "friends" && !viewEl.contains(document.activeElement)) route("friends");
};

const loadPlaytime = async () => {
  try {
    const rows = (await invoke("social_call", { action: "my_playtime" })) || [];
    STATE.playtime = Object.fromEntries(rows.map((r) => [r.work_id, r]));
  } catch (e) {}
};

const loadMyProfile = async () => {
  try {
    STATE.profile = await invoke("my_profile");
  } catch (e) {}
};

const updateFriendBadge = () => {
  const badge = document.querySelector(".tab__badge");
  if (!badge) return;
  const waiting = STATE.friends.filter((f) => f.relation === "received").length;
  badge.hidden = !waiting;
  badge.textContent = digits(waiting);
};

const avatarEl = (person, size) => {
  const box = h("span.ava", { style: `--s:${size || 40}px` });
  if (person.avatar_url) box.append(h("img", { src: person.avatar_url, alt: "", onerror: (e) => e.target.remove() }));
  else box.textContent = (person.handle || "?").charAt(0).toUpperCase();
  if (person.online) box.classList.add(person.playing_title || person.playing ? "is-playing" : "is-online");
  return box;
};

const statusText = (f) =>
  f.playing_title ? tf("Playing {game}", { game: f.playing_title }) : f.online ? t("Online") : f.last_seen_at ? tf("Last online {when}", { when: ago(f.last_seen_at) }) : t("Offline");

const friendsView = () => {
  const wrap = h("div.wrap");
  const input = h("input.is-text", { type: "text", placeholder: t("Their username"), maxlength: 20, spellcheck: "false" });
  const send = h("button.button.button--primary", {}, t("Send request"));
  const note = h("p.side-card__note");
  const ask = async () => {
    const handle = input.value.trim();
    if (handle.length < 3) return;
    send.disabled = true;
    note.classList.remove("is-error");
    try {
      const r = await invoke("social_call", { action: "friend_request", args: { p_handle: handle } });
      const msg = {
        sent: "Request sent.",
        accepted: "You're now friends.",
        not_found: "No one has that username.",
        self: "That's you.",
        already: "You're already friends.",
        pending: "Already sent; waiting for them.",
      }[r];
      note.textContent = t(msg || "Something went wrong. Try again.");
      note.classList.toggle("is-error", !["sent", "accepted"].includes(r));
      if (r === "sent" || r === "accepted") {
        input.value = "";
        await loadFriends();
        route("friends");
      }
    } catch (e) {
      note.textContent = t("Something went wrong. Try again.");
      note.classList.add("is-error");
    }
    send.disabled = false;
  };
  send.addEventListener("click", ask);
  input.addEventListener("keydown", (e) => e.key === "Enter" && ask());

  wrap.append(
    h(
      "div.head",
      h("div", h("h2", t("Friends")), h("p", t("Add friends by their username to see when they're online and what they play."))),
      h("div", h("div.redeem", input, send), note)
    )
  );

  const by = (rel) => STATE.friends.filter((f) => f.relation === rel);
  const friends = by("friend");
  const groups = [
    ["Friend requests", by("received")],
    ["Online", friends.filter((f) => f.online)],
    ["Offline", friends.filter((f) => !f.online)],
    ["Sent requests", by("sent")],
  ];
  if (!STATE.friends.length) {
    wrap.append(
      h(
        "div.empty",
        h("img", { src: "logo.webp", alt: "" }),
        h("p", { style: "color:var(--text);font-weight:700" }, t("No friends yet")),
        h("p", t("Add friends by their username to see when they're online and what they play."))
      )
    );
    return wrap;
  }
  for (const [title, list] of groups) {
    if (!list.length) continue;
    wrap.append(h("h3.flist__title", `${t(title)} (${digits(list.length)})`), h("div.flist", list.map(friendRow)));
  }
  return wrap;
};

const friendRow = (f) => {
  const actions = h("div.frow__actions");
  const act = async (fn) => {
    actions.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      await fn();
    } catch (e) {
      toast(t("Something went wrong. Try again."), "err");
    }
    await loadFriends();
    route("friends");
  };
  if (f.relation === "received") {
    actions.append(
      h("button.mini.mini--accent", { onclick: () => act(() => invoke("social_call", { action: "friend_respond", args: { p_user: f.user_id, p_accept: true } })) }, t("Accept")),
      h("button.mini", { onclick: () => act(() => invoke("social_call", { action: "friend_respond", args: { p_user: f.user_id, p_accept: false } })) }, t("Decline"))
    );
  } else {
    const remove = h("button.mini", f.relation === "sent" ? t("Cancel") : t("Remove"));
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      if (f.relation === "friend" && !remove.classList.contains("is-asking")) {
        remove.classList.add("is-asking");
        remove.textContent = t("Tap again to remove");
        setTimeout(() => {
          remove.classList.remove("is-asking");
          remove.textContent = t("Remove");
        }, 3500);
        return;
      }
      act(() => invoke("social_call", { action: "friend_remove", args: { p_user: f.user_id } }));
    });
    actions.append(remove);
  }
  const row = h(
    "div.frow.reveal",
    h(
      "button.frow__who",
      { onclick: () => f.handle && route("user", f.handle) },
      avatarEl(f, 44),
      h("span.frow__text", h("span.frow__name", { translate: "no" }, f.handle || "—"), h("span.frow__status", f.relation === "friend" ? statusText(f) : ""))
    ),
    actions
  );
  if (f.playing_title) row.classList.add("is-playing");
  else if (f.online) row.classList.add("is-online");
  return row;
};

// A profile: your own (handle null) or someone else's, by username.
const profileView = (handle) => {
  const wrap = h("div.wrap");
  const mine = !handle;
  if (mine && !(STATE.profile && STATE.profile.handle)) {
    wrap.append(profileForm(true));
    return wrap;
  }
  const target = handle || STATE.profile.handle;
  const body = h("div", h("div.loading", h("span")));
  wrap.append(body);
  invoke("social_call", { action: "public_profile", args: { p_handle: target } })
    .then((p) => body.replaceChildren(p ? profileCard(p) : h("div.empty", h("p", t("No one has that username.")))))
    .then(() => watchReveals(viewEl))
    .catch(() => body.replaceChildren(h("div.empty", h("p", t("Something went wrong. Try again.")))));
  return wrap;
};

const profileCard = (p) => {
  const status = p.playing ? tf("Playing {game}", { game: p.playing.title }) : p.online ? t("Online") : p.last_seen_at ? tf("Last online {when}", { when: ago(p.last_seen_at) }) : t("Offline");
  const actions = h("div.prof__actions");
  if (p.relation === "self") {
    const edit = h("button.button.button--ghost", t("Edit profile"));
    edit.addEventListener("click", () => {
      const host = viewEl.querySelector(".view__in .wrap");
      host.replaceChildren(profileForm(false));
    });
    actions.append(edit);
  } else if (p.relation === "none") {
    const add = h("button.button.button--primary", t("Add friend"));
    add.addEventListener("click", async () => {
      add.disabled = true;
      try {
        const r = await invoke("social_call", { action: "friend_request", args: { p_handle: p.handle } });
        add.textContent = r === "accepted" ? t("Friends ✓") : t("Request sent");
        loadFriends();
      } catch (e) {
        add.disabled = false;
      }
    });
    actions.append(add);
  } else {
    actions.append(h("span.chip", p.relation === "friend" ? t("Friends ✓") : t("Request sent")));
  }
  actions.append(
    h("button.button.button--ghost", { onclick: () => invoke("open_url", { url: `${SITE}/user?u=${encodeURIComponent(p.handle)}` }) }, t("View on the website"))
  );

  const head = h(
    "div.prof__head.reveal",
    avatarEl({ ...p, online: p.online && !p.hidden }, 96),
    h(
      "div.prof__who",
      h("h2.prof__name", { translate: "no" }, p.handle),
      p.hidden ? h("p.prof__status", t("This profile is private.")) : h(`p.prof__status${p.playing ? ".is-playing" : p.online ? ".is-online" : ""}`, status),
      p.bio && !p.hidden ? h("p.prof__bio", { dir: "auto" }, p.bio) : null,
      actions
    ),
    p.hidden ? null : h("div.prof__level", h("span", t("Level")), h("strong", digits(p.level)))
  );
  if (p.hidden) return head;

  const stats = h(
    "div.prof__stats.reveal",
    [
      ["Games", digits(p.games.length)],
      ["Hours played", hours(p.minutes_played)],
      ["Friends", digits(p.friends)],
    ].map(([k, v]) => h("div.prof__stat", h("strong", v), h("span", t(k))))
  );
  const games = h(
    "div.flist",
    p.games.map((g) =>
      h(
        "div.pgame.reveal",
        { onclick: () => gameById(g.work_id) && route("detail", g.work_id) },
        h("img", { src: art(g.cover_url), alt: "", onerror: (e) => (e.target.src = "logo.webp") }),
        h(
          "div.pgame__text",
          h("span.pgame__name", { translate: "no" }, g.title),
          h("span.pgame__meta", tf("{h} hrs on record", { h: hours(g.minutes) }), g.last_played ? ` · ${tf("Last played {when}", { when: ago(g.last_played) })}` : "")
        )
      )
    )
  );
  return h(
    "div",
    head,
    stats,
    h("p.prof__since", tf("Member since {when}", { when: new Date(p.member_since).toLocaleDateString(LANG === "fa" ? "fa-IR" : "en-GB", { year: "numeric", month: "long" }) })),
    p.games.length ? h("h3.flist__title", t("Recent activity")) : null,
    games
  );
};

// Choose a username (first time) or edit the profile.
const profileForm = (first) => {
  const current = STATE.profile || {};
  const handle = h("input", { type: "text", value: current.handle || "", maxlength: 20, spellcheck: "false", placeholder: t("3–20 letters, numbers or _") });
  const bio = h("textarea", { maxlength: 300, rows: 3 });
  bio.value = current.bio || "";
  const vis = h(
    "div.seg",
    [
      ["public", "Everyone"],
      ["friends", "Friends only"],
      ["private", "Only me"],
    ].map(([v, label]) =>
      h("label.seg__opt", h("input", { type: "radio", name: "vis", value: v, checked: (current.visibility || "public") === v }), h("span", t(label)))
    )
  );
  const note = h("p.side-card__note");
  const save = h("button.button.button--primary", t("Save"));
  save.addEventListener("click", async () => {
    const value = handle.value.trim();
    note.classList.add("is-error");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(value)) {
      note.textContent = t("Use 3–20 letters, numbers or _.");
      return handle.focus();
    }
    save.disabled = true;
    note.textContent = "";
    try {
      await invoke("save_profile", { handle: value, bio: bio.value, visibility: vis.querySelector("input:checked").value });
      await loadMyProfile();
      toast(t("Saved."), "ok");
      route("profile");
    } catch (e) {
      const c = String(e);
      note.textContent = c === "handle-taken" ? t("That username is taken.") : c === "handle-invalid" ? t("Use 3–20 letters, numbers or _.") : t("Something went wrong. Try again.");
      save.disabled = false;
    }
  });
  const field = (label, el) => h("label.field", h("span", t(label)), el);
  return h(
    "div.pform.reveal",
    h("h2", first ? t("Choose your username") : t("Edit profile")),
    h("p.pform__lead", t("It's how friends find you and the name others see. Your real name and email stay private.")),
    field("Username", handle),
    field("About you", bio),
    h("div.field", h("span", t("Who can see your profile")), vis),
    note,
    h("div.prof__actions", save, first ? null : h("button.button.button--ghost", { onclick: () => route("profile") }, t("Cancel")))
  );
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
  goOnline();
};

wireWindow();
window.addEventListener("DOMContentLoaded", boot);
if (document.readyState !== "loading") boot();
