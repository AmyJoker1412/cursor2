(() => {
  const WRONG_KEY = "dangjian-quiz-wrong-ids-v1";
  const ORDER_KEY = "dangjian-quiz-order-v1";
  const SESSION_KEY = "dangjian-quiz-session-v1";

  const main = document.getElementById("main");
  const backBtn = document.getElementById("backBtn");
  const subtitle = document.getElementById("subtitle");

  /** @type {{title:string, count:number, questions:Array}} */
  let bank = { title: "", count: 0, questions: [] };
  let byId = new Map();

  const state = {
    view: "home", // home | sections | quiz | done
    mode: "all", // all | wrong | section
    section: null,
    queue: [],
    index: 0,
    selected: new Set(),
    revealed: false,
    lastCorrect: null,
    answered: 0,
    correctCount: 0,
  };

  /* ---------- 本地存储 ---------- */

  function loadWrongIds() {
    try {
      const raw = localStorage.getItem(WRONG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function saveWrongIds(set) {
    localStorage.setItem(WRONG_KEY, JSON.stringify([...set]));
  }

  function addWrong(id) {
    const set = loadWrongIds();
    set.add(id);
    saveWrongIds(set);
  }

  function removeWrong(id) {
    const set = loadWrongIds();
    set.delete(id);
    saveWrongIds(set);
  }

  function clearWrong() {
    saveWrongIds(new Set());
  }

  function loadOrder() {
    const v = localStorage.getItem(ORDER_KEY);
    return v === "seq" ? "seq" : "random";
  }

  function saveOrder(v) {
    localStorage.setItem(ORDER_KEY, v);
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.ids) || !s.ids.length) return null;
      if (s.index >= s.ids.length) return null;
      return s;
    } catch {
      return null;
    }
  }

  function saveSession() {
    if (state.view !== "quiz") return;
    const payload = {
      mode: state.mode,
      section: state.section,
      ids: state.queue.map((q) => q.id),
      index: state.index,
      answered: state.answered,
      correct: state.correctCount,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /* ---------- 工具函数 ---------- */

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function sections() {
    const map = new Map();
    for (const q of bank.questions) {
      if (!map.has(q.section)) map.set(q.section, []);
      map.get(q.section).push(q);
    }
    return [...map.entries()];
  }

  function sameAnswers(selected, answer) {
    if (selected.size !== answer.length) return false;
    return answer.every((a) => selected.has(a));
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setTopbar() {
    const showBack = state.view !== "home";
    backBtn.hidden = !showBack;
    if (state.view === "home") {
      subtitle.textContent = "手机刷题 · 错题本本地保存";
    } else if (state.view === "sections") {
      subtitle.textContent = "按章节练习";
    } else if (state.view === "quiz") {
      const q = state.queue[state.index];
      subtitle.textContent = q
        ? `${state.index + 1} / ${state.queue.length}`
        : "练习结束";
    } else {
      subtitle.textContent = "本轮练习结束";
    }
  }

  /* ---------- 练习流程 ---------- */

  function goHome() {
    state.view = "home";
    state.revealed = false;
    state.selected = new Set();
    render();
  }

  function buildQueue(mode, sectionName) {
    let list;
    if (mode === "wrong") {
      const wrong = loadWrongIds();
      list = bank.questions.filter((q) => wrong.has(q.id));
    } else if (mode === "section") {
      list = bank.questions.filter((q) => q.section === sectionName);
    } else {
      list = bank.questions.slice();
    }
    return loadOrder() === "seq" ? list : shuffle(list);
  }

  function startQuiz(mode, sectionName = null, opts = {}) {
    const resume = opts.resume !== false ? loadSession() : null;
    if (
      resume &&
      resume.mode === mode &&
      resume.section === sectionName &&
      resume.ids.length
    ) {
      const queue = resume.ids.map((id) => byId.get(id)).filter(Boolean);
      if (queue.length === resume.ids.length) {
        state.mode = mode;
        state.section = sectionName;
        state.queue = queue;
        state.index = Math.min(resume.index, queue.length - 1);
        state.answered = resume.answered || 0;
        state.correctCount = resume.correct || 0;
        state.selected = new Set();
        state.revealed = false;
        state.lastCorrect = null;
        state.view = "quiz";
        render();
        return;
      }
    }

    const list = buildQueue(mode, sectionName);
    if (!list.length) {
      state.view = "done";
      state.mode = mode;
      state.section = sectionName;
      state.queue = [];
      state.index = 0;
      state.answered = 0;
      state.correctCount = 0;
      render();
      return;
    }

    state.mode = mode;
    state.section = sectionName;
    state.queue = list;
    state.index = 0;
    state.selected = new Set();
    state.revealed = false;
    state.lastCorrect = null;
    state.answered = 0;
    state.correctCount = 0;
    state.view = "quiz";
    saveSession();
    render();
  }

  function currentQuestion() {
    return state.queue[state.index] || null;
  }

  function judge() {
    const q = currentQuestion();
    if (!q || state.revealed) return;
    if (state.selected.size === 0) return;

    const ok = sameAnswers(state.selected, q.answer);
    state.revealed = true;
    state.lastCorrect = ok;
    state.answered += 1;
    if (ok) {
      state.correctCount += 1;
      if (state.mode === "wrong") removeWrong(q.id);
      render();
      saveSession();
      window.setTimeout(() => {
        nextQuestion();
      }, 650);
    } else {
      addWrong(q.id);
      saveSession();
      render();
    }
  }

  function nextQuestion() {
    if (state.index >= state.queue.length - 1) {
      state.view = "done";
      clearSession();
      render();
      return;
    }
    state.index += 1;
    state.selected = new Set();
    state.revealed = false;
    state.lastCorrect = null;
    saveSession();
    render();
  }

  function toggleOption(letter) {
    const q = currentQuestion();
    if (!q || state.revealed) return;
    if (q.type === "single") {
      state.selected = new Set([letter]);
      judge();
      return;
    }
    if (state.selected.has(letter)) state.selected.delete(letter);
    else state.selected.add(letter);
    render();
  }

  /* ---------- 首页 / 章节 ---------- */

  function renderResumeCard() {
    const s = loadSession();
    if (!s) return "";
    const total = s.ids.length;
    const pct = Math.min(100, Math.round((s.index / total) * 100));
    const label =
      s.mode === "wrong" ? "错题重练" : s.mode === "all" ? "全部刷题" : "章节练习";
    const name = s.section ? ` · ${escapeHtml(s.section)}` : "";
    return `
      <div class="resume-card">
        <div class="resume-head">
          <span>继续上次：${label}${name}</span>
          <b>${s.index} / ${total}</b>
        </div>
        <div class="progress-bar"><span style="width:${pct}%"></span></div>
        <div class="resume-actions">
          <button class="btn btn-secondary btn-sm" data-action="resume" type="button">继续刷题</button>
          <button class="btn btn-ghost btn-sm" data-action="restart" type="button">重新开始</button>
        </div>
      </div>`;
  }

  function renderHome() {
    const wrongCount = loadWrongIds().size;
    const order = loadOrder();
    const resume = loadSession();

    main.innerHTML = `
      <section class="hero-card">
        <div class="stats">
          <div class="stat"><strong>${bank.count}</strong><span>总题数</span></div>
          <div class="stat"><strong>${wrongCount}</strong><span>本机错题</span></div>
          <div class="stat"><strong>${sections().length}</strong><span>章节</span></div>
        </div>
        ${renderResumeCard()}
        <div class="order-row">
          <span class="order-label">出题顺序</span>
          <div class="segmented">
            <button class="seg ${order === "seq" ? "on" : ""}" data-order="seq" type="button">顺序</button>
            <button class="seg ${order === "random" ? "on" : ""}" data-order="random" type="button">随机</button>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="all" type="button">${
            resume && resume.mode === "all" ? "开始新的全部刷题" : "全部刷题"
          }</button>
          <button class="btn btn-secondary" data-action="wrong" type="button">错题本（${wrongCount}）</button>
          <button class="btn btn-ghost" data-action="sections" type="button">按章节练习</button>
          <button class="btn btn-ghost" data-action="clear-wrong" type="button"${
            wrongCount ? "" : " disabled"
          }>清空错题本</button>
        </div>
        <div id="qr-slot"></div>
      </section>
    `;

    main.querySelector('[data-action="all"]').onclick = () =>
      startQuiz("all", null, { resume: false });
    main.querySelector('[data-action="wrong"]').onclick = () =>
      startQuiz("wrong", null, { resume: false });
    main.querySelector('[data-action="sections"]').onclick = () => {
      state.view = "sections";
      render();
    };
    main.querySelector('[data-action="clear-wrong"]').onclick = () => {
      if (wrongCount && confirm("确定清空错题本？")) {
        clearWrong();
        render();
      }
    };

    main.querySelectorAll("[data-order]").forEach((btn) => {
      btn.onclick = () => {
        saveOrder(btn.getAttribute("data-order"));
        renderHome();
      };
    });

    const resumeBtn = main.querySelector('[data-action="resume"]');
    if (resumeBtn) {
      resumeBtn.onclick = () => {
        const s = loadSession();
        if (s) startQuiz(s.mode, s.section);
      };
    }
    const restartBtn = main.querySelector('[data-action="restart"]');
    if (restartBtn) {
      restartBtn.onclick = () => {
        const s = loadSession();
        clearSession();
        startQuiz(s ? s.mode : "all", s ? s.section : null, {
          resume: false,
        });
      };
    }

    renderQrCard();
  }

  function renderQrCard() {
    const slot = document.getElementById("qr-slot");
    if (!slot) return;
    const here = location.hostname;
    const isLocal =
      here === "localhost" || here === "127.0.0.1" || here === "::1";

    fetch("api/info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info || !info.lan) return;
        const url = `http://${info.lan}:${info.port}/`;
        slot.innerHTML = `
          <div class="qr-card">
            <div class="qr-head">📱 手机同网访问</div>
            <div class="qr-box" id="qr-box"></div>
            <p class="qr-note">手机与电脑连同一个 WiFi，扫码或输入：<br/><code>${escapeHtml(
              url
            )}</code></p>
            ${
              isLocal
                ? ""
                : `<p class="qr-note subtle">你已在局域网设备上打开 ✅</p>`
            }
          </div>`;
        try {
          if (window.QRCode) {
            new QRCode(document.getElementById("qr-box"), {
              text: url,
              width: 168,
              height: 168,
              colorDark: "#1c1412",
              colorLight: "#ffffff",
              correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0,
            });
          }
        } catch (_) {
          /* 忽略二维码渲染失败，保留链接文本 */
        }
      })
      .catch(() => {
        /* 静态打开时无服务端，隐藏扫码卡片 */
      });
  }

  function renderSections() {
    const items = sections()
      .map(
        ([name, list]) => `
      <button class="section-item" type="button" data-section="${escapeHtml(name)}">
        <span>${escapeHtml(name)}</span>
        <small>${list.length} 题</small>
      </button>`
      )
      .join("");

    main.innerHTML = `
      <section class="panel">
        <p class="brand-sub" style="margin:0 0 8px">选择章节开始练习</p>
        <div class="section-list">${items}</div>
      </section>
    `;

    main.querySelectorAll("[data-section]").forEach((btn) => {
      btn.onclick = () =>
        startQuiz("section", btn.getAttribute("data-section"));
    });
  }

  /* ---------- 答题界面 ---------- */

  function renderQuiz() {
    const q = currentQuestion();
    if (!q) {
      state.view = "done";
      render();
      return;
    }

    const progress =
      ((state.index + (state.revealed ? 1 : 0)) / state.queue.length) * 100;
    const typeLabel = q.type === "single" ? "单选题" : "多选题";
    const optionHtml = Object.keys(q.options)
      .sort()
      .map((key) => {
        const classes = ["option"];
        if (state.selected.has(key)) classes.push("selected");
        if (state.revealed) {
          if (q.answer.includes(key)) classes.push("correct");
          else if (state.selected.has(key)) classes.push("wrong");
        }
        return `
          <button class="${classes.join(" ")}" type="button" data-key="${key}" ${
            state.revealed ? "disabled" : ""
          }>
            <span class="key">${key}</span>
            <span>${escapeHtml(q.options[key])}</span>
          </button>`;
      })
      .join("");

    let feedback = "";
    if (state.revealed) {
      if (state.lastCorrect) {
        feedback = `<div class="feedback ok">回答正确</div>`;
      } else {
        feedback = `<div class="feedback bad">回答错误。正确答案：${q.answer.join(
          ""
        )}（已加入错题本）</div>`;
      }
    }

    const multiActions =
      q.type === "multiple" && !state.revealed
        ? `<div class="quiz-actions">
            <button class="btn btn-primary" data-action="submit" type="button" ${
              state.selected.size ? "" : "disabled"
            }>提交答案</button>
          </div>`
        : "";

    const nextActions =
      state.revealed && !state.lastCorrect
        ? `<div class="quiz-actions">
            <button class="btn btn-primary" data-action="next" type="button">下一题</button>
          </div>`
        : "";

    main.innerHTML = `
      <section class="panel">
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
        <div class="meta-row">
          <span class="badge">${typeLabel}</span>
          <span class="meta-section">${escapeHtml(q.section)}</span>
        </div>
        <p class="stem">${escapeHtml(q.stem)}</p>
        <div class="options">${optionHtml}</div>
        ${feedback}
        ${multiActions}
        ${nextActions}
      </section>
    `;

    main.querySelectorAll("[data-key]").forEach((btn) => {
      btn.onclick = () => toggleOption(btn.getAttribute("data-key"));
    });
    const submit = main.querySelector('[data-action="submit"]');
    if (submit) submit.onclick = () => judge();
    const next = main.querySelector('[data-action="next"]');
    if (next) next.onclick = () => nextQuestion();
  }

  function renderDone() {
    const total = state.queue.length;
    const emptyWrong = state.mode === "wrong" && total === 0;
    const accuracy = total ? Math.round((state.correctCount / total) * 100) : 0;
    main.innerHTML = `
      <section class="panel">
        ${
          emptyWrong
            ? `<div class="empty">错题本是空的，先去刷几道题吧。</div>`
            : `<div class="empty">
                <p style="margin:0 0 8px;font-size:1.2rem;font-weight:700;color:var(--ink)">本轮完成</p>
                <p style="margin:0">共 ${total} 题，答对 ${state.correctCount} 题（正确率 ${accuracy}%）</p>
              </div>`
        }
        <div class="actions">
          <button class="btn btn-primary" data-action="again" type="button">再练一轮</button>
          <button class="btn btn-secondary" data-action="wrong" type="button"${
            loadWrongIds().size ? "" : " disabled"
          }>去错题本复习（${loadWrongIds().size}）</button>
          <button class="btn btn-ghost" data-action="home" type="button">返回首页</button>
        </div>
      </section>
    `;
    main.querySelector('[data-action="again"]').onclick = () =>
      startQuiz(state.mode, state.section, { resume: false });
    const wrongBtn = main.querySelector('[data-action="wrong"]');
    if (wrongBtn)
      wrongBtn.onclick = () => startQuiz("wrong", null, { resume: false });
    main.querySelector('[data-action="home"]').onclick = () => goHome();
  }

  function render() {
    setTopbar();
    if (state.view === "home") renderHome();
    else if (state.view === "sections") renderSections();
    else if (state.view === "quiz") renderQuiz();
    else renderDone();
  }

  backBtn.onclick = () => {
    if (
      state.view === "quiz" ||
      state.view === "done" ||
      state.view === "sections"
    ) {
      saveSession();
      goHome();
    }
  };

  async function init() {
    main.innerHTML = `<section class="panel"><div class="empty">题库加载中…</div></section>`;
    try {
      const res = await fetch("data/questions.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bank = await res.json();
      byId = new Map(bank.questions.map((q) => [q.id, q]));
      render();
    } catch (err) {
      main.innerHTML = `<section class="panel"><div class="empty">题库加载失败：${escapeHtml(
        err.message || String(err)
      )}<br/>请用本地服务器打开，不要直接双击 HTML。</div></section>`;
    }
  }

  init();
})();
