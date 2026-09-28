// The launcher window. It only ever asks the backend (Rust) to do things;
// the backend holds the session and talks to the server. Bilingual, like
// the rest of SauFox.
const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args);
const listen = (event, cb) => window.__TAURI__.event.listen(event, cb);
const app = document.getElementById("app");
const SITE = "https://saufoxentertainment.ir";

// ---------- Language ----------
const FA = {
  "Customer launcher": "لانچر مشتریان",
  "SauFox Entertainment": "ساوفاکس اینترتینمنت",
  "Your games, in one place.": "بازی‌های شما، یک‌جا.",
  "Sign in with your SauFox account": "ورود با حساب ساوفاکس",
  "Opening your browser…": "در حال باز کردن مرورگر…",
  "Waiting for you to allow it in the browser…": "منتظر تأیید شما در مرورگر…",
  "Sign out": "خروج",
  "Your games": "بازی‌های شما",
  "Have a game key?": "کلید بازی دارید؟",
  "Add": "افزودن",
  "Install": "نصب",
  "Play": "اجرا",
  "Update": "به‌روزرسانی",
  "Installing…": "در حال نصب…",
  "Downloading…": "در حال دانلود…",
  "Checking…": "در حال بررسی…",
  "Unpacking…": "در حال باز کردن…",
  "Installed": "نصب‌شده",
  "Copy": "کپی",
  "Copied": "کپی شد",
  "Your library is empty": "کتابخانه‌ی شما خالی است",
  "Games you buy or unlock will appear here.": "بازی‌هایی که می‌خرید یا فعال می‌کنید اینجا می‌آیند.",
  "Browse games": "دیدن بازی‌ها",
  "This computer counts toward the key's device limit.": "این کامپیوتر جزو سقف دستگاه‌های کلید حساب می‌شود.",
  "You've reached this key's device limit.": "به سقف دستگاه‌های این کلید رسیده‌اید.",
  "That key isn't valid.": "این کلید معتبر نیست.",
  "That key is already on another account.": "این کلید روی حساب دیگری فعال شده است.",
  "Added to your library.": "به کتابخانه افزوده شد.",
  "Not available for Windows yet.": "هنوز برای ویندوز آماده نیست.",
  "Something went wrong. Try again.": "مشکلی پیش آمد. دوباره امتحان کنید.",
  "gift": "هدیه",
  "Need help?": "کمک می‌خواهید؟",
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

// ---------- A tiny DOM builder ----------
const h = (tag, attrs, ...kids) => {
  const [name, ...cls] = tag.split(".");
  const el = document.createElement(name || "div");
  if (cls.length) el.className = cls.join(" ");
  if (attrs && attrs.nodeType) {
    kids.unshift(attrs);
    attrs = null;
  }
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "src" || k === "html") el[k === "html" ? "innerHTML" : "src"] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

const fmtSize = (bytes) => {
  if (!bytes) return "";
  const gb = bytes / 1e9;
  if (gb >= 1) return `${digits(gb.toFixed(1))} GB`;
  return `${digits(Math.round(bytes / 1e6))} MB`;
};

// ---------- Sign-in screen ----------
const gate = (problem) => {
  applyLang();
  const go = h("button.button.button--primary.gate__go", {}, t("Sign in with your SauFox account"));
  const hint = h("p.gate__lead");
  go.addEventListener("click", async () => {
    go.disabled = true;
    hint.textContent = t("Waiting for you to allow it in the browser…");
    try {
      await invoke("sign_in");
      start();
    } catch (e) {
      go.disabled = false;
      hint.textContent = "";
      showProblem(String(e));
    }
  });
  const showProblem = (msg) => {
    const map = {
      "sign-in cancelled": LANG === "fa" ? "ورود لغو شد." : "Sign-in cancelled.",
      "sign-in timed out": LANG === "fa" ? "زمان ورود تمام شد." : "Sign-in timed out.",
    };
    problemEl.textContent = map[msg] || t("Something went wrong. Try again.");
  };
  const problemEl = h("p.gate__problem", { role: "alert" }, problem ? t("Something went wrong. Try again.") : "");
  app.replaceChildren(
    h(
      "div.gate",
      h(
        "div.gate__card",
        h("img.gate__logo", { src: "logo.webp", alt: "SauFox" }),
        h("p.gate__kicker", t("Customer launcher")),
        h("h1.gate__title", "SauFox Entertainment"),
        h("p.gate__lead", t("Your games, in one place.")),
        problemEl,
        go,
        hint,
        h("button.top__out", { onclick: toggleLang }, LANG === "fa" ? "English" : "فارسی")
      )
    )
  );
};

const toggleLang = () => {
  LANG = LANG === "fa" ? "en" : "fa";
  try {
    localStorage.setItem("saufox.launcher.lang", LANG);
  } catch (e) {}
  start();
};

// ---------- The library ----------
const copyBtn = (code) => {
  const b = h("button", { title: t("Copy") }, t("Copy"));
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      b.textContent = t("Copied");
      setTimeout(() => (b.textContent = t("Copy")), 1400);
    } catch (e) {}
  });
  return b;
};

const gameCard = (game) => {
  const installed = game.installed;
  const build = game.build;
  const note = h("p.card__note");
  const bar = h("span");
  const barWrap = h("div.card__bar", { hidden: true }, bar);
  const action = h("button.button.button--primary.card__action");

  const setPlay = () => {
    action.textContent = t("Play");
    action.disabled = false;
    action.onclick = async () => {
      action.disabled = true;
      try {
        await invoke("play", { workId: game.work_id, licenseId: game.license_id });
      } catch (e) {
        note.textContent = t("Something went wrong. Try again.");
        note.classList.add("is-error");
      }
      setTimeout(() => (action.disabled = false), 2500);
    };
  };
  const setInstall = (label) => {
    action.textContent = label;
    action.disabled = false;
    action.onclick = () => doInstall();
  };
  const doInstall = async () => {
    action.disabled = true;
    note.classList.remove("is-error");
    note.textContent = "";
    barWrap.hidden = false;
    try {
      await invoke("install_game", {
        workId: game.work_id,
        licenseId: game.license_id,
        buildId: build.id,
        version: build.version,
        sha256: build.sha256 || null,
      });
      barWrap.hidden = true;
      game.installed = { version: build.version, build_id: build.id };
      setPlay();
    } catch (e) {
      barWrap.hidden = true;
      note.classList.add("is-error");
      const msg = String(e);
      note.textContent = msg === "device-limit" ? t("You've reached this key's device limit.") : t("Something went wrong. Try again.");
      setInstall(t("Install"));
    }
  };

  progressHandlers[game.work_id] = (p) => {
    barWrap.hidden = false;
    const pct = p.total ? Math.min(100, Math.round((p.received / p.total) * 100)) : 0;
    bar.style.width = `${pct}%`;
    const phase =
      p.phase === "download" ? `${t("Downloading…")} ${digits(pct)}%` : p.phase === "verify" ? t("Checking…") : p.phase === "install" ? t("Unpacking…") : "";
    note.textContent = phase;
  };

  if (!build) {
    action.textContent = t("Install");
    action.disabled = true;
    note.textContent = t("Not available for Windows yet.");
  } else if (installed && installed.build_id === build.id) {
    setPlay();
    note.textContent = `v${digits(build.version)} · ${t("Installed")}`;
  } else if (installed) {
    setInstall(t("Update"));
    note.textContent = `v${digits(build.version)} · ${fmtSize(build.size_bytes)}`;
  } else {
    setInstall(t("Install"));
    note.textContent = fmtSize(build.size_bytes);
  }

  return h(
    "div.card",
    h(
      "div.card__art",
      game.mine ? null : h("span.card__badge", t("gift")),
      h("img", { src: game.cover_url ? `${SITE}/${game.cover_url}` : "logo.webp", alt: "", onerror: (e) => (e.target.src = "logo.webp") })
    ),
    h("div.card__title", { title: game.title, translate: "no" }, game.title || game.work_id),
    h("div.card__key", h("code", game.code), copyBtn(game.code)),
    action,
    barWrap,
    note
  );
};

let progressHandlers = {};

const shell = (me, games) => {
  applyLang();
  progressHandlers = {};
  const grid =
    games.length === 0
      ? h(
          "div.empty",
          h("img", { src: "logo.webp", alt: "" }),
          h("p", t("Your library is empty")),
          h("p", t("Games you buy or unlock will appear here.")),
          h("button.button", { onclick: () => invoke("open_url", { url: `${SITE}/` }) }, t("Browse games"))
        )
      : h("div.grid", games.map(gameCard));

  const code = h("input", { type: "text", placeholder: "SFOX-XXXX-XXXX-XXXX-XXXX", maxlength: 24, spellcheck: "false" });
  const redeemNote = h("p.card__note");
  const addBtn = h("button.button.button--primary", {}, t("Add"));
  const doRedeem = async () => {
    const value = code.value.trim();
    if (value.replace(/[^A-Za-z0-9]/g, "").length < 8) return;
    addBtn.disabled = true;
    redeemNote.textContent = "";
    redeemNote.classList.remove("is-error");
    try {
      await invoke("redeem", { code: value });
      code.value = "";
      start();
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

  app.replaceChildren(
    h(
      "div.app",
      h(
        "header.top",
        h("img.top__brand", { src: "wordmark.webp", alt: "SauFox" }),
        h("div.top__spacer"),
        h(
          "div.top__me",
          h("span.top__email", { translate: "no" }, me.email || ""),
          h("button.top__out", { onclick: toggleLang }, LANG === "fa" ? "English" : "فارسی"),
          h(
            "button.top__out",
            {
              onclick: async () => {
                await invoke("sign_out");
                start();
              },
            },
            t("Sign out")
          )
        )
      ),
      h(
        "main.main",
        h("div.hello", h("h1", t("Your games"))),
        h("div.redeem", code, addBtn),
        redeemNote,
        grid
      ),
      h(
        "footer.foot",
        h("span", deviceName ? (LANG === "fa" ? `این کامپیوتر: ${deviceName}` : `This PC: ${deviceName}`) : ""),
        h("a", { onclick: () => invoke("open_url", { url: "https://portal.saufoxentertainment.ir/" }) }, t("Need help?"))
      )
    )
  );
};

// ---------- Start ----------
let deviceName = "";
let progressBound = false;
const start = async () => {
  app.replaceChildren(h("div.loading", h("span")));
  if (!progressBound) {
    progressBound = true;
    listen("install-progress", (e) => {
      const fn = progressHandlers[e.payload.work_id];
      if (fn) fn(e.payload);
    });
  }
  let me;
  try {
    me = await invoke("me");
  } catch (e) {
    me = null;
  }
  if (!me) return gate();
  try {
    deviceName = (await invoke("device_info")).name || "";
  } catch (e) {}
  try {
    const games = await invoke("library");
    shell(me, games);
  } catch (e) {
    // The session may have ended.
    await invoke("sign_out").catch(() => {});
    gate(true);
  }
};

window.addEventListener("DOMContentLoaded", start);
if (document.readyState !== "loading") start();
