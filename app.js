(function () {
  const STORAGE_KEY = "eihracat-destekleri-takip";
  var supabase = null;
  var saveToCloudTimer = null;
  var authMode = "signin";

  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const base = { done: {}, notes: {}, dates: {}, assignees: {}, deadlines: {} };
      if (!raw) return base;
      const parsed = JSON.parse(raw);
      return {
        done: parsed.done || {},
        notes: parsed.notes || {},
        dates: parsed.dates || {},
        assignees: parsed.assignees || {},
        deadlines: parsed.deadlines || {}
      };
    } catch (_) {
      return { done: {}, notes: {}, dates: {}, assignees: {}, deadlines: {} };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
    scheduleSaveToCloud();
  }

  if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY &&
      window.SUPABASE_URL.indexOf("PROJE_ID") === -1 && window.SUPABASE_ANON_KEY.indexOf("anon-key-buraya") === -1 &&
      window.supabase && typeof window.supabase.createClient === "function") {
    try {
      supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    } catch (_) {}
  }

  function scheduleSaveToCloud() {
    if (!supabase) return;
    if (saveToCloudTimer) clearTimeout(saveToCloudTimer);
    saveToCloudTimer = setTimeout(function () {
      saveToCloudTimer = null;
      saveToCloud();
    }, 800);
  }

  function saveToCloud() {
    if (!supabase) return;
    supabase.auth.getUser().then(function (r) {
      if (!r.data || !r.data.user) return;
      var payload = {
        user_id: r.data.user.id,
        data: {
          done: state.done,
          notes: state.notes,
          dates: state.dates,
          assignees: state.assignees,
          deadlines: state.deadlines
        },
        updated_at: new Date().toISOString()
      };
      supabase.from("takip_data").upsert(payload, { onConflict: "user_id" }).then(function () {}, function () {});
    });
  }

  function replaceState(data) {
    var base = { done: {}, notes: {}, dates: {}, assignees: {}, deadlines: {} };
    state.done = data && data.done ? data.done : base.done;
    state.notes = data && data.notes ? data.notes : base.notes;
    state.dates = data && data.dates ? data.dates : base.dates;
    state.assignees = data && data.assignees ? data.assignees : base.assignees;
    state.deadlines = data && data.deadlines ? data.deadlines : base.deadlines;
    saveState(state);
    fullRefresh();
  }

  function fullRefresh() {
    renderBoard();
    renderProgress();
  }

  var BOARD_LISTS = [
    { id: "on-sartlar", title: "1. Ön Şartlar", desc: "E-ihracat desteklerine başvurmadan önce sağlamanız gereken temel koşullar." },
    { id: "kapsama", title: "2. Kapsama Alınma", desc: "Statünüze göre destek kapsamına alınma başvurusu." },
    { id: "destekler", title: "3. Destek Başvuruları", desc: "Ön onay → harcama → ödeme başvurusu (6 ay içinde)." },
    { id: "yillik", title: "4. Yıllık Yükümlülükler", desc: "E-İhracat Değerlendirme Beyanı ve ortaklık değişikliği bildirimi." }
  ];

  const state = getState();

  function persistDone(id, done) {
    state.done[id] = done;
    saveState(state);
  }

  function persistNote(id, note) {
    if (note) state.notes[id] = note; else delete state.notes[id];
    saveState(state);
  }

  function persistDate(id, date) {
    if (date) state.dates[id] = date; else delete state.dates[id];
    saveState(state);
  }

  function persistAssignee(id, name) {
    if (name) state.assignees[id] = name; else delete state.assignees[id];
    saveState(state);
  }

  function persistDeadline(id, date) {
    if (date) state.deadlines[id] = date; else delete state.deadlines[id];
    saveState(state);
  }

  function getCounts() {
    var counts = {};
    var data = window.EIHRACAT_TODO_DATA || {};
    BOARD_LISTS.forEach(function (list) {
      var items = data[list.id] || [];
      var done = 0;
      items.forEach(function (item) { if (state.done[item.id]) done++; });
      counts[list.id] = { done: done, total: items.length };
    });
    return counts;
  }

  function renderProgress() {
    const counts = getCounts();
    let total = 0, completed = 0;
    Object.values(counts).forEach(function (c) {
      total += c.total;
      completed += c.done;
    });
    const pct = total ? Math.round((completed / total) * 100) : 0;
    const el = document.getElementById("progressText");
    if (el) el.textContent = pct + "%";
    updateSidebarCounts(counts);
  }

  function updateSidebarCounts(counts) {
    Object.keys(counts || {}).forEach(function (groupId) {
      const c = counts[groupId];
      const span = document.querySelector('.board-list-count[data-list="' + groupId + '"]');
      if (span) span.textContent = (c.done || 0) + "/" + (c.total || 0);
    });
  }

  function renderCard(item) {
    var done = state.done[item.id];
    var note = state.notes[item.id] || "";
    var date = state.dates[item.id] || "";
    var assignee = state.assignees[item.id] || "";
    var deadline = state.deadlines[item.id] || "";
    return (
      '<div class="board-card roadmap-step' + (done ? " done" : "") + '" data-id="' + item.id + '">' +
      '<div class="board-card-inner">' +
      '<span class="todo-check" role="button" tabindex="0" aria-label="Tamamla">' +
      (done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>' : "") +
      '</span>' +
      '<div class="todo-body">' +
      '<p class="todo-title">' + escapeHtml(item.title) + "</p>" +
      (item.detail ? '<p class="todo-detail">' + escapeHtml(item.detail) + "</p>" : "") +
      '<div class="todo-meta">' +
      (assignee ? '<span class="todo-assignee">Sorumlu: ' + escapeHtml(assignee) + "</span>" : "") +
      (deadline ? '<span class="todo-deadline">Termin: ' + escapeHtml(deadline) + "</span>" : "") +
      (date ? '<span class="todo-date">' + escapeHtml(date) + "</span>" : "") +
      (note ? '<span class="todo-note">' + escapeHtml(note) + "</span>" : "") +
      '<div class="note-field" style="display:none"><textarea placeholder="Not ekle..." rows="2"></textarea><button type="button" class="note-save-btn">Kaydet</button></div>' +
      '</div>' +
      '<div class="todo-actions">' +
      '<button type="button" class="assignee-btn" aria-label="Sorumlu">Sorumlu</button>' +
      '<button type="button" class="deadline-btn" aria-label="Termin">Termin</button>' +
      '<button type="button" class="note-btn" aria-label="Not">Not</button>' +
      '<button type="button" class="date-btn" aria-label="Tarih">Tarih</button>' +
      '</div></div></div>'
    );
  }

  function renderBoard() {
    var board = document.getElementById("board");
    if (!board) return;
    var data = window.EIHRACAT_TODO_DATA || {};
    var html = '';
    BOARD_LISTS.forEach(function (list) {
      var items = data[list.id] || [];
      var count = getCounts()[list.id];
      var countStr = (count ? count.done : 0) + "/" + (count ? count.total : 0);
      html += '<div class="board-list" data-list-id="' + list.id + '">' +
        '<div class="board-list-header">' +
        '<h3 class="board-list-title">' + escapeHtml(list.title) + '</h3>' +
        '<span class="board-list-count" data-list="' + list.id + '">' + countStr + '</span>' +
        '</div>' +
        '<p class="board-list-desc">' + escapeHtml(list.desc) + '</p>' +
        '<div class="board-list-cards">';
      items.forEach(function (item) {
        html += renderCard(item);
      });
      html += '</div></div>';
    });
    board.innerHTML = html;
    attachBoardEvents();
  }

  function attachBoardEvents() {
    var board = document.getElementById("board");
    if (!board) return;

    board.querySelectorAll(".todo-check").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const step = btn.closest(".roadmap-step");
        const id = step.getAttribute("data-id");
        const next = !state.done[id];
        state.done[id] = next;
        persistDone(id, next);
        step.classList.toggle("done", next);
        btn.innerHTML = next ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>' : "";
        renderProgress();
      });
    });

    board.querySelectorAll(".note-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.closest(".roadmap-step");
        const id = item.getAttribute("data-id");
        const meta = item.querySelector(".todo-meta");
        const noteField = meta.querySelector(".note-field");
        const textarea = noteField.querySelector("textarea");
        const isOpen = noteField.style.display !== "none";
        if (isOpen) {
          const val = textarea.value.trim();
          persistNote(id, val);
          const noteSpan = meta.querySelector(".todo-note");
          if (noteSpan) noteSpan.textContent = val; else if (val) {
            const span = document.createElement("span");
            span.className = "todo-note";
            span.textContent = val;
            meta.insertBefore(span, noteField);
          }
          noteField.style.display = "none";
          btn.classList.remove("active");
        } else {
          textarea.value = state.notes[id] || "";
          noteField.style.display = "block";
          textarea.focus();
          btn.classList.add("active");
        }
      });
    });

    board.querySelectorAll(".date-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.closest(".roadmap-step");
        const id = item.getAttribute("data-id");
        const current = state.dates[id] || "";
        const newDate = window.prompt("Tamamlanma veya hedef tarih (örn: 15.02.2025):", current);
        if (newDate === null) return;
        const trimmed = newDate.trim();
        persistDate(id, trimmed);
        const meta = item.querySelector(".todo-meta");
        let dateEl = meta.querySelector(".todo-date");
        if (trimmed) {
          if (!dateEl) {
            dateEl = document.createElement("span");
            dateEl.className = "todo-date";
            meta.insertBefore(dateEl, meta.firstChild);
          }
          dateEl.textContent = trimmed;
        } else if (dateEl) dateEl.remove();
      });
    });

    board.querySelectorAll(".assignee-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.closest(".roadmap-step");
        const id = item.getAttribute("data-id");
        const current = state.assignees[id] || "";
        const name = window.prompt("Sorumlu kişi adı:", current);
        if (name === null) return;
        const trimmed = name.trim();
        persistAssignee(id, trimmed);
        const meta = item.querySelector(".todo-meta");
        let assigneeEl = meta.querySelector(".todo-assignee");
        if (trimmed) {
          if (!assigneeEl) {
            assigneeEl = document.createElement("span");
            assigneeEl.className = "todo-assignee";
            meta.insertBefore(assigneeEl, meta.firstChild);
          }
          assigneeEl.textContent = "Sorumlu: " + trimmed;
        } else if (assigneeEl) assigneeEl.remove();
      });
    });

    board.querySelectorAll(".deadline-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.closest(".roadmap-step");
        const id = item.getAttribute("data-id");
        const current = state.deadlines[id] || "";
        const newDeadline = window.prompt("Termin tarihi (örn: 15.03.2025):", current);
        if (newDeadline === null) return;
        const trimmed = newDeadline.trim();
        persistDeadline(id, trimmed);
        const meta = item.querySelector(".todo-meta");
        let deadlineEl = meta.querySelector(".todo-deadline");
        if (trimmed) {
          if (!deadlineEl) {
            deadlineEl = document.createElement("span");
            deadlineEl.className = "todo-deadline";
            meta.insertBefore(deadlineEl, meta.firstChild);
          }
          deadlineEl.textContent = "Termin: " + trimmed;
        } else if (deadlineEl) deadlineEl.remove();
      });
    });

    board.querySelectorAll(".note-save-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var noteField = btn.closest(".note-field");
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var meta = item.querySelector(".todo-meta");
        var textarea = noteField.querySelector("textarea");
        var val = textarea ? textarea.value.trim() : "";
        persistNote(id, val);
        var noteSpan = meta.querySelector(".todo-note");
        if (val) {
          if (noteSpan) noteSpan.textContent = val;
          else {
            noteSpan = document.createElement("span");
            noteSpan.className = "todo-note";
            noteSpan.textContent = val;
            meta.insertBefore(noteSpan, noteField);
          }
        } else if (noteSpan) noteSpan.remove();
        noteField.style.display = "none";
        var noteBtn = item.querySelector(".note-btn");
        if (noteBtn) noteBtn.classList.remove("active");
      });
    });

    board.querySelectorAll(".note-field textarea").forEach(function (ta) {
      ta.addEventListener("blur", function () {
        const item = ta.closest(".roadmap-step");
        const id = item.getAttribute("data-id");
        const val = ta.value.trim();
        persistNote(id, val);
        const meta = item.querySelector(".todo-meta");
        let noteSpan = meta.querySelector(".todo-note");
        if (val) {
          if (noteSpan) noteSpan.textContent = val;
          else {
            noteSpan = document.createElement("span");
            noteSpan.className = "todo-note";
            noteSpan.textContent = val;
            meta.insertBefore(noteSpan, meta.querySelector(".note-field"));
          }
        } else if (noteSpan) noteSpan.remove();
        var noteField = ta.parentElement;
        var noteBtn = item ? item.querySelector(".note-btn") : null;
        setTimeout(function () {
          noteField.style.display = "none";
          if (noteBtn) noteBtn.classList.remove("active");
        }, 150);
      });
    });

  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function initAuth() {
    var authWrap = document.getElementById("authWrap");
    var authBtn = document.getElementById("authBtn");
    var authUser = document.getElementById("authUser");
    var authLogout = document.getElementById("authLogout");
    var loginScreen = document.getElementById("loginScreen");
    var appContent = document.getElementById("appContent");
    var loginForm = document.getElementById("loginScreenForm");
    var loginEmail = document.getElementById("loginScreenEmail");
    var loginPassword = document.getElementById("loginScreenPassword");
    var loginError = document.getElementById("loginScreenError");
    var loginSubmit = document.getElementById("loginScreenSubmit");
    if (!supabase) return;

    function setScreen(loggedIn) {
      if (loginScreen) loginScreen.style.display = loggedIn ? "none" : "flex";
      if (appContent) appContent.style.display = loggedIn ? "" : "none";
    }
    setScreen(false);
    if (authWrap) authWrap.style.display = "";

    function setAuthUI(user) {
      if (authWrap) {
        if (user) {
          if (authBtn) authBtn.style.display = "none";
          if (authUser) { authUser.style.display = ""; authUser.textContent = user.email || "Hesap"; }
          if (authLogout) authLogout.style.display = "";
        } else {
          if (authBtn) authBtn.style.display = "";
          if (authUser) authUser.style.display = "none";
          if (authLogout) authLogout.style.display = "none";
        }
      }
    }

    function showLoginError(msg) {
      if (loginError) { loginError.textContent = msg || ""; loginError.style.display = msg ? "block" : "none"; }
    }

    function fetchAndReplaceState(userId) {
      supabase.from("takip_data").select("data").eq("user_id", userId).maybeSingle().then(function (res) {
        if (res.data && res.data.data) replaceState(res.data.data);
      });
    }

    supabase.auth.onAuthStateChange(function (event, session) {
      var user = session ? session.user : null;
      setAuthUI(user);
      setScreen(!!user);
      if (user) fetchAndReplaceState(user.id);
    });

    supabase.auth.getSession().then(function (r) {
      if (r.data && r.data.session) {
        setAuthUI(r.data.session.user);
        setScreen(true);
        fetchAndReplaceState(r.data.session.user.id);
      } else {
        setAuthUI(null);
        setScreen(false);
      }
    });

    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = (loginEmail && loginEmail.value ? loginEmail.value : "").trim();
        var password = loginPassword ? loginPassword.value : "";
        showLoginError("");
        supabase.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
          if (r.error) showLoginError(r.error.message || "Giriş başarısız.");
        });
      });
    }

    if (authLogout) authLogout.addEventListener("click", function () { supabase.auth.signOut(); });
  }

  renderBoard();
  renderProgress();

  if (supabase) {
    initAuth();
  } else {
    var appContent = document.getElementById("appContent");
    if (appContent) appContent.style.display = "";
  }
})();
