(function () {
  const STORAGE_KEY = "eihracat-destekleri-takip";
  var supabase = null;
  var saveToCloudTimer = null;

  var LABEL_OPTIONS = [
    { id: "green", name: "Yeşil", class: "label-green" },
    { id: "yellow", name: "Sarı", class: "label-yellow" },
    { id: "red", name: "Kırmızı", class: "label-red" },
    { id: "blue", name: "Mavi", class: "label-blue" },
    { id: "purple", name: "Mor", class: "label-purple" },
    { id: "orange", name: "Turuncu", class: "label-orange" }
  ];
  var PRIORITY_OPTIONS = [
    { id: "high", name: "Yüksek", class: "priority-high" },
    { id: "medium", name: "Orta", class: "priority-medium" },
    { id: "low", name: "Düşük", class: "priority-low" }
  ];

  var EMPTY_STATE = { done: {}, notes: {}, dates: {}, assignees: {}, deadlines: {}, labels: {}, checklists: {}, priority: {} };

  function getState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return mergeState(EMPTY_STATE, {});
      return mergeState(EMPTY_STATE, JSON.parse(raw));
    } catch (_) {
      return mergeState(EMPTY_STATE, {});
    }
  }

  function mergeState(empty, parsed) {
    return {
      done: parsed.done || empty.done,
      notes: parsed.notes || empty.notes,
      dates: parsed.dates || empty.dates,
      assignees: parsed.assignees || empty.assignees,
      deadlines: parsed.deadlines || empty.deadlines,
      labels: parsed.labels || empty.labels,
      checklists: parsed.checklists || empty.checklists,
      priority: parsed.priority || empty.priority
    };
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
          deadlines: state.deadlines,
          labels: state.labels,
          checklists: state.checklists,
          priority: state.priority
        },
        updated_at: new Date().toISOString()
      };
      supabase.from("takip_data").upsert(payload, { onConflict: "user_id" }).then(function () {}, function () {});
    });
  }

  function replaceState(data) {
    var next = mergeState(EMPTY_STATE, data || {});
    Object.keys(EMPTY_STATE).forEach(function (k) { state[k] = next[k]; });
    saveState(state);
    fullRefresh();
  }

  var GROUP_IDS = ["on-sartlar", "kapsama", "destekler", "yillik"];

  function fullRefresh() {
    GROUP_IDS.forEach(renderList);
    renderProgress();
  }

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

  function persistLabel(id, labelId) {
    if (labelId) state.labels[id] = labelId; else delete state.labels[id];
    saveState(state);
  }

  function persistChecklist(id, items) {
    if (items && items.length) state.checklists[id] = items; else delete state.checklists[id];
    saveState(state);
  }

  function persistPriority(id, priorityId) {
    if (priorityId) state.priority[id] = priorityId; else delete state.priority[id];
    saveState(state);
  }

  function addChecklistItem(taskId, groupId, text) {
    if (!text) return;
    var items = (state.checklists[taskId] || []).slice();
    items.push({ id: "cl-" + Date.now() + "-" + Math.random().toString(36).slice(2), text: text, done: false });
    persistChecklist(taskId, items);
    renderList(groupId);
    var list = document.querySelector('.todo-list[data-group="' + groupId + '"]');
    var newStep = list && list.querySelector('.roadmap-step[data-id="' + taskId + '"]');
    var block = newStep && newStep.querySelector(".task-checklist-block");
    if (block) block.style.display = "block";
  }

  function getCounts() {
    var counts = {};
    var data = window.EIHRACAT_TODO_DATA || {};
    GROUP_IDS.forEach(function (groupId) {
      var items = data[groupId] || [];
      var done = 0;
      items.forEach(function (item) { if (state.done[item.id]) done++; });
      counts[groupId] = { done: done, total: items.length };
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
    (counts && Object.keys(counts)).forEach(function (groupId) {
      var c = counts[groupId];
      var span = document.querySelector('.sidebar-item-count[data-count="' + groupId + '"]');
      if (span) span.textContent = (c.done || 0) + "/" + (c.total || 0);
    });
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderList(groupId) {
    var list = document.querySelector('.todo-list[data-group="' + groupId + '"]');
    if (!list) return;
    var items = (window.EIHRACAT_TODO_DATA || {})[groupId];
    if (!items) return;
    list.innerHTML = items.map(function (item, index) {
      var stepNum = index + 1;
      var done = state.done[item.id];
      var note = state.notes[item.id] || "";
      var date = state.dates[item.id] || "";
      var assignee = state.assignees[item.id] || "";
      var deadline = state.deadlines[item.id] || "";
      var labelId = state.labels[item.id] || "";
      var priorityId = state.priority[item.id] || "";
      var checklistItems = state.checklists[item.id] || [];
      var labelOpt = LABEL_OPTIONS.find(function (o) { return o.id === labelId; });
      var priorityOpt = PRIORITY_OPTIONS.find(function (o) { return o.id === priorityId; });
      var clDone = checklistItems.filter(function (c) { return c.done; }).length;
      var clTotal = checklistItems.length;
      var badgesHtml = "";
      if (labelOpt) badgesHtml += '<span class="task-label ' + labelOpt.class + '" data-label-id="' + labelOpt.id + '" title="' + escapeHtml(labelOpt.name) + '"></span>';
      if (priorityOpt) badgesHtml += '<span class="task-priority ' + priorityOpt.class + '">' + escapeHtml(priorityOpt.name) + '</span>';
      var checklistHtml = '<div class="task-checklist-block" style="display:none">';
      if (checklistItems.length) {
        checklistHtml += '<div class="task-checklist-wrap">' +
          '<div class="task-checklist-summary"><span class="checklist-progress">' + clDone + '/' + clTotal + '</span> alt görev</div>' +
          '<ul class="checklist-items">' +
          checklistItems.map(function (c) {
            return '<li class="checklist-item' + (c.done ? " done" : "") + '" data-check-id="' + escapeHtml(c.id) + '">' +
              '<span class="checklist-check" role="button" tabindex="0" aria-label="İşaretle"></span>' +
              '<span class="checklist-text">' + escapeHtml(c.text) + '</span>' +
              '<button type="button" class="checklist-remove" aria-label="Kaldır">&times;</button></li>';
          }).join("") +
          '</ul></div>';
      }
      checklistHtml += '<div class="checklist-add">' +
        '<input type="text" class="checklist-input" placeholder="Alt görev ekle..." />' +
        '<button type="button" class="checklist-add-btn">Ekle</button></div>' +
        '</div>' +
        '<button type="button" class="checklist-toggle-btn">' + (checklistItems.length ? "Alt görevler (" + clDone + "/" + clTotal + ")" : "Alt görevler") + '</button>';

      return '<li class="roadmap-step' + (done ? " done" : "") + '" data-id="' + item.id + '">' +
        '<div class="roadmap-step-marker"><span class="roadmap-step-num">' + stepNum + '</span></div>' +
        '<div class="roadmap-step-content">' +
        '<div class="todo-item">' +
        '<span class="todo-check" role="button" tabindex="0" aria-label="Tamamla">' +
        (done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>' : '') +
        '</span>' +
        '<div class="todo-body">' +
        (badgesHtml ? '<div class="task-badges">' + badgesHtml + '</div>' : '') +
        '<p class="todo-title">' + escapeHtml(item.title) + '</p>' +
        (item.detail ? '<p class="todo-detail">' + escapeHtml(item.detail) + '</p>' : '') +
        '<div class="todo-meta">' +
        (assignee ? '<span class="todo-assignee">Sorumlu: ' + escapeHtml(assignee) + '</span>' : '') +
        (deadline ? '<span class="todo-deadline">Termin: ' + escapeHtml(deadline) + '</span>' : '') +
        (date ? '<span class="todo-date">' + escapeHtml(date) + '</span>' : '') +
        (note ? '<span class="todo-note">' + escapeHtml(note) + '</span>' : '') +
        '<div class="note-field" style="display:none"><textarea placeholder="Not ekle..." rows="2"></textarea><button type="button" class="note-save-btn">Kaydet</button></div>' +
        '</div>' +
        checklistHtml +
        '<div class="todo-actions">' +
        '<button type="button" class="assignee-btn" aria-label="Sorumlu">Sorumlu</button>' +
        '<button type="button" class="deadline-btn" aria-label="Termin">Termin</button>' +
        '<button type="button" class="note-btn" aria-label="Not">Not</button>' +
        '<button type="button" class="date-btn" aria-label="Tarih">Tarih</button>' +
        '<button type="button" class="label-btn" aria-label="Etiket">Etiket</button>' +
        '<button type="button" class="priority-btn" aria-label="Öncelik">Öncelik</button>' +
        '</div></div></div></li>';
    }).join('');
    attachListEvents(list);
  }

  function attachListEvents(list) {
    if (!list) return;
    list.querySelectorAll(".todo-check").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var step = btn.closest(".roadmap-step");
        var id = step.getAttribute("data-id");
        var next = !state.done[id];
        state.done[id] = next;
        persistDone(id, next);
        step.classList.toggle("done", next);
        btn.innerHTML = next ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>' : "";
        renderProgress();
      });
    });
    list.querySelectorAll(".note-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var meta = item.querySelector(".todo-meta");
        var noteField = meta.querySelector(".note-field");
        var textarea = noteField.querySelector("textarea");
        var isOpen = noteField.style.display !== "none";
        if (isOpen) {
          var val = textarea.value.trim();
          persistNote(id, val);
          var noteSpan = meta.querySelector(".todo-note");
          if (noteSpan) noteSpan.textContent = val;
          else if (val) {
            var span = document.createElement("span");
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
    list.querySelectorAll(".date-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.dates[id] || "";
        var newDate = window.prompt("Tamamlanma veya hedef tarih (örn: 15.02.2025):", current);
        if (newDate === null) return;
        var trimmed = newDate.trim();
        persistDate(id, trimmed);
        var meta = item.querySelector(".todo-meta");
        var dateEl = meta.querySelector(".todo-date");
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
    list.querySelectorAll(".assignee-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.assignees[id] || "";
        var name = window.prompt("Sorumlu kişi adı:", current);
        if (name === null) return;
        var trimmed = name.trim();
        persistAssignee(id, trimmed);
        var meta = item.querySelector(".todo-meta");
        var assigneeEl = meta.querySelector(".todo-assignee");
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
    list.querySelectorAll(".deadline-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.deadlines[id] || "";
        var newDeadline = window.prompt("Termin tarihi (örn: 15.03.2025):", current);
        if (newDeadline === null) return;
        var trimmed = newDeadline.trim();
        persistDeadline(id, trimmed);
        var meta = item.querySelector(".todo-meta");
        var deadlineEl = meta.querySelector(".todo-deadline");
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
    list.querySelectorAll(".note-save-btn").forEach(function (btn) {
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
    list.querySelectorAll(".note-field textarea").forEach(function (ta) {
      ta.addEventListener("blur", function () {
        var item = ta.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var val = ta.value.trim();
        persistNote(id, val);
        var meta = item.querySelector(".todo-meta");
        var noteSpan = meta.querySelector(".todo-note");
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

    list.querySelectorAll(".label-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.labels[id] || "";
        var names = LABEL_OPTIONS.map(function (o) { return o.id + "=" + o.name; }).join(", ");
        var raw = window.prompt("Etiket: " + names + " (veya boş bırak)", current);
        if (raw === null) return;
        var chosen = raw.trim().toLowerCase();
        var opt = LABEL_OPTIONS.find(function (o) { return o.id === chosen || o.name.toLowerCase() === chosen; });
        persistLabel(id, opt ? opt.id : "");
        var groupId = list.getAttribute("data-group");
        renderList(groupId);
      });
    });

    list.querySelectorAll(".priority-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.priority[id] || "";
        var names = PRIORITY_OPTIONS.map(function (o) { return o.id + "=" + o.name; }).join(", ");
        var raw = window.prompt("Öncelik: " + names + " (veya boş bırak)", current);
        if (raw === null) return;
        var chosen = raw.trim().toLowerCase();
        var opt = PRIORITY_OPTIONS.find(function (o) { return o.id === chosen || o.name.toLowerCase() === chosen; });
        persistPriority(id, opt ? opt.id : "");
        var groupId = list.getAttribute("data-group");
        renderList(groupId);
      });
    });

    list.querySelectorAll(".checklist-toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var step = btn.closest(".roadmap-step");
        var block = step.querySelector(".task-checklist-block");
        if (block) block.style.display = block.style.display === "none" ? "block" : "none";
      });
    });

    list.querySelectorAll(".checklist-add-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var step = btn.closest(".roadmap-step");
        var id = step.getAttribute("data-id");
        var input = step.querySelector(".checklist-input");
        var text = (input && input.value) ? input.value.trim() : "";
        addChecklistItem(id, list.getAttribute("data-group"), text);
        if (input) input.value = "";
      });
    });
    list.querySelectorAll(".checklist-input").forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var step = input.closest(".roadmap-step");
          var id = step.getAttribute("data-id");
          var text = input.value.trim();
          addChecklistItem(id, list.getAttribute("data-group"), text);
          input.value = "";
        }
      });
    });

    list.querySelectorAll(".checklist-check").forEach(function (span) {
      span.addEventListener("click", function () {
        var li = span.closest(".checklist-item");
        var step = li.closest(".roadmap-step");
        var id = step.getAttribute("data-id");
        var checkId = li.getAttribute("data-check-id");
        var items = (state.checklists[id] || []).map(function (c) {
          if (c.id === checkId) return { id: c.id, text: c.text, done: !c.done };
          return c;
        });
        persistChecklist(id, items);
        li.classList.toggle("done", !li.classList.contains("done"));
        var doneCount = items.filter(function (c) { return c.done; }).length;
        var toggleBtn = step.querySelector(".checklist-toggle-btn");
        if (toggleBtn) toggleBtn.textContent = "Alt görevler (" + doneCount + "/" + items.length + ")";
        var summary = step.querySelector(".checklist-progress");
        if (summary) summary.textContent = doneCount + "/" + items.length;
      });
    });

    list.querySelectorAll(".checklist-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var li = btn.closest(".checklist-item");
        var step = li.closest(".roadmap-step");
        var id = step.getAttribute("data-id");
        var checkId = li.getAttribute("data-check-id");
        var items = (state.checklists[id] || []).filter(function (c) { return c.id !== checkId; });
        persistChecklist(id, items);
        var groupId = list.getAttribute("data-group");
        renderList(groupId);
      });
    });
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

  document.querySelectorAll(".sidebar-item").forEach(function (item) {
    item.addEventListener("click", function () {
      var t = item.getAttribute("data-tab");
      document.querySelectorAll(".sidebar-item").forEach(function (x) {
        x.classList.toggle("active", x.getAttribute("data-tab") === t);
      });
      document.querySelectorAll(".panel").forEach(function (p) {
        p.classList.toggle("active", p.id === t);
      });
    });
  });

  GROUP_IDS.forEach(renderList);
  renderProgress();

  if (supabase) {
    initAuth();
  } else {
    var appContent = document.getElementById("appContent");
    if (appContent) appContent.style.display = "";
  }
})();
