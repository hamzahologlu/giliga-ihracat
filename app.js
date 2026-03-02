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

  var EMPTY_STATE = { done: {}, notes: {}, assignees: {}, deadlines: {}, labels: {},  priority: {}, files: {} };
  var FILE_MAX_SIZE = 500 * 1024;
  var FILE_MAX_COUNT = 3;
  var currentFileTaskId = null;

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
      assignees: parsed.assignees || empty.assignees,
      deadlines: parsed.deadlines || empty.deadlines,
      labels: parsed.labels || empty.labels,
      priority: parsed.priority || empty.priority,
      files: parsed.files || empty.files
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
          assignees: state.assignees,
          deadlines: state.deadlines,
          labels: state.labels,
          priority: state.priority,
          files: state.files
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

  var GROUP_IDS = ["on-sartlar", "kapsama", "pazaryeri-hesaplari", "destekler", "yillik"];

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

  function persistPriority(id, priorityId) {
    if (priorityId) state.priority[id] = priorityId; else delete state.priority[id];
    saveState(state);
  }

  function persistFiles(id, list) {
    if (list && list.length) state.files[id] = list; else delete state.files[id];
    saveState(state);
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

  function dateToInputFormat(str) {
    if (!str || !str.trim()) return "";
    var s = str.trim();
    var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return "";
  }

  function dateToDisplayFormat(str) {
    if (!str || !str.trim()) return "";
    var s = str.trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return m[3] + "." + m[2] + "." + m[1];
    if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s)) return s;
    return s;
  }

  var pickerOverlay = null;
  var pickerContent = null;
  var pickerActions = null;
  var pickerTitleEl = null;
  var pickerOkBtn = null;
  var pickerCancelBtn = null;
  var pickerCloseBtn = null;
  var pickerResolve = null;

  function initPicker() {
    pickerOverlay = document.getElementById("pickerOverlay");
    pickerContent = document.getElementById("pickerContent");
    pickerActions = document.getElementById("pickerActions");
    pickerTitleEl = document.getElementById("pickerTitle");
    pickerOkBtn = document.getElementById("pickerOk");
    pickerCancelBtn = document.getElementById("pickerCancel");
    pickerCloseBtn = document.getElementById("pickerClose");
    if (!pickerOverlay) return;
    function closePicker(value) {
      if (pickerOverlay) pickerOverlay.style.display = "none";
      if (pickerResolve) { pickerResolve(value); pickerResolve = null; }
    }
    pickerOverlay.addEventListener("click", function (e) {
      if (e.target === pickerOverlay) closePicker(null);
    });
    if (pickerCloseBtn) pickerCloseBtn.addEventListener("click", function () { closePicker(null); });
    if (pickerCancelBtn) pickerCancelBtn.addEventListener("click", function () { closePicker(null); });
    if (pickerOkBtn) pickerOkBtn.addEventListener("click", function () {
      var input = pickerContent.querySelector("input");
      if (input) {
        if (input.type === "date") closePicker(input.value ? dateToDisplayFormat(input.value) : "");
        else closePicker(input.value ? input.value.trim() : "");
      }
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyPickerViewportHeight);
      window.visualViewport.addEventListener("scroll", applyPickerViewportHeight);
    }
  }

  function positionPopover(anchor) {
    var popover = document.getElementById("pickerPopover");
    if (!popover) return;
    var pad = 8;
    var isMobile = window.innerWidth <= 768;
    if (isMobile) {
      popover.classList.add("picker-popover-mobile");
      popover.style.top = "max(" + pad + "px, env(safe-area-inset-top, 12px))";
      popover.style.left = "50%";
      popover.style.right = "auto";
      popover.style.transform = "translateX(-50%)";
      applyPickerViewportHeight();
      return;
    }
    popover.classList.remove("picker-popover-mobile");
    popover.style.maxHeight = "";
    var overlay = document.getElementById("pickerOverlay");
    if (overlay) overlay.style.height = "";
    if (!anchor) return;
    var rect = anchor.getBoundingClientRect();
    var below = rect.bottom + pad;
    var spaceBelow = window.innerHeight - rect.bottom;
    var popoverH = 200;
    if (spaceBelow < popoverH && rect.top > spaceBelow) {
      popover.classList.add("picker-popover-above");
      popover.style.top = (rect.top - popoverH - pad) + "px";
    } else {
      popover.classList.remove("picker-popover-above");
      popover.style.top = below + "px";
    }
    popover.style.left = Math.max(pad, Math.min(rect.left, window.innerWidth - 320)) + "px";
    popover.style.transform = "";
  }

  function applyPickerViewportHeight() {
    var overlay = document.getElementById("pickerOverlay");
    if (!overlay || overlay.style.display !== "flex") return;
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    overlay.style.height = vh + "px";
    overlay.style.alignItems = "flex-start";
    var popover = document.getElementById("pickerPopover");
    if (popover && popover.classList.contains("picker-popover-mobile")) {
      var safeTop = 12;
      var safeBottom = 12;
      popover.style.maxHeight = (vh - safeTop - safeBottom - 20) + "px";
    }
  }

  function showDatePicker(anchor, currentValue, title, onPick) {
    if (!pickerOverlay || !pickerContent) { initPicker(); if (!pickerOverlay) return; }
    pickerTitleEl.textContent = title || "Tarih seçin";
    pickerContent.innerHTML = '<label class="picker-label"><input type="date" class="picker-date-input" value="' + escapeHtml(dateToInputFormat(currentValue)) + '" /></label>';
    pickerActions.style.display = "flex";
    pickerOkBtn.textContent = "Tamam";
    pickerCancelBtn.style.display = "";
    pickerResolve = function (val) { if (onPick) onPick(val); };
    pickerOverlay.style.display = "flex";
    positionPopover(anchor);
    var input = pickerContent.querySelector("input");
    if (input) { input.focus(); input.addEventListener("keydown", function (e) { if (e.key === "Enter") pickerOkBtn.click(); }); }
  }

  function showAssigneePicker(anchor, currentValue, onPick) {
    if (!pickerOverlay || !pickerContent) { initPicker(); if (!pickerOverlay) return; }
    pickerTitleEl.textContent = "Sorumlu kişi";
    pickerContent.innerHTML = '<label class="picker-label"><input type="text" class="picker-text-input" placeholder="Ad soyad" value="' + escapeHtml(currentValue) + '" autocomplete="off" /></label>';
    pickerActions.style.display = "flex";
    pickerOkBtn.textContent = "Tamam";
    pickerCancelBtn.style.display = "";
    pickerResolve = function (val) { if (onPick) onPick(val); };
    pickerOverlay.style.display = "flex";
    positionPopover(anchor);
    var input = pickerContent.querySelector("input");
    if (input) { input.focus(); input.addEventListener("keydown", function (e) { if (e.key === "Enter") pickerOkBtn.click(); }); }
  }

  function showLabelPicker(anchor, currentId, onPick) {
    if (!pickerOverlay || !pickerContent) { initPicker(); if (!pickerOverlay) return; }
    pickerTitleEl.textContent = "Etiket rengi";
    var html = '<div class="picker-colors">';
    LABEL_OPTIONS.forEach(function (o) {
      html += '<button type="button" class="picker-color-btn ' + o.class + (o.id === currentId ? " is-selected" : "") + '" data-id="' + escapeHtml(o.id) + '" title="' + escapeHtml(o.name) + '"></button>';
    });
    html += '</div><button type="button" class="picker-clear-btn">Etiketi kaldır</button>';
    pickerContent.innerHTML = html;
    pickerActions.style.display = "none";
    pickerResolve = function (val) { if (onPick) onPick(val); };
    pickerOverlay.style.display = "flex";
    positionPopover(anchor);
    pickerContent.querySelectorAll(".picker-color-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        pickerResolve(btn.getAttribute("data-id"));
        pickerResolve = null;
        pickerOverlay.style.display = "none";
      });
    });
    pickerContent.querySelector(".picker-clear-btn").addEventListener("click", function () {
      pickerResolve("");
      pickerResolve = null;
      pickerOverlay.style.display = "none";
    });
  }

  function showPriorityPicker(anchor, currentId, onPick) {
    if (!pickerOverlay || !pickerContent) { initPicker(); if (!pickerOverlay) return; }
    pickerTitleEl.textContent = "Öncelik";
    var html = '<div class="picker-priorities">';
    PRIORITY_OPTIONS.forEach(function (o) {
      html += '<button type="button" class="picker-priority-btn ' + o.class + (o.id === currentId ? " is-selected" : "") + '" data-id="' + escapeHtml(o.id) + '">' + escapeHtml(o.name) + '</button>';
    });
    html += '</div><button type="button" class="picker-clear-btn">Önceliği kaldır</button>';
    pickerContent.innerHTML = html;
    pickerActions.style.display = "none";
    pickerResolve = function (val) { if (onPick) onPick(val); };
    pickerOverlay.style.display = "flex";
    positionPopover(anchor);
    pickerContent.querySelectorAll(".picker-priority-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        pickerResolve(btn.getAttribute("data-id"));
        pickerResolve = null;
        pickerOverlay.style.display = "none";
      });
    });
    pickerContent.querySelector(".picker-clear-btn").addEventListener("click", function () {
      pickerResolve("");
      pickerResolve = null;
      pickerOverlay.style.display = "none";
    });
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
      var assignee = state.assignees[item.id] || "";
      var deadline = state.deadlines[item.id] || "";
      var labelId = state.labels[item.id] || "";
      var priorityId = state.priority[item.id] || "";
      var taskFiles = state.files[item.id] || [];
      var labelOpt = LABEL_OPTIONS.find(function (o) { return o.id === labelId; });
      var priorityOpt = PRIORITY_OPTIONS.find(function (o) { return o.id === priorityId; });
      var badgesHtml = "";
      if (labelOpt) badgesHtml += '<span class="task-label ' + labelOpt.class + '" data-label-id="' + labelOpt.id + '" title="' + escapeHtml(labelOpt.name) + '"></span>';
      if (priorityOpt) badgesHtml += '<span class="task-priority ' + priorityOpt.class + '">' + escapeHtml(priorityOpt.name) + '</span>';

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
        (note ? '<span class="todo-note">' + escapeHtml(note) + '</span>' : '') +
        (taskFiles.length ? '<div class="todo-files">' + taskFiles.map(function (f) {
          return '<span class="todo-file"><a href="' + escapeHtml(f.dataUrl) + '" target="_blank" rel="noopener" class="todo-file-link">' + escapeHtml(f.name) + '</a> <button type="button" class="file-remove-btn" data-file-id="' + escapeHtml(f.id) + '" aria-label="Kaldır">&times;</button></span>';
        }).join("") + '</div>' : '') +
        '<div class="note-field" style="display:none"><textarea placeholder="Not ekle..." rows="2"></textarea><button type="button" class="note-save-btn">Kaydet</button></div>' +
        '</div>' +
        '<div class="todo-actions-bar">' +
        '<span class="todo-actions-label">Özellikler</span>' +
        '<div class="todo-actions">' +
        '<button type="button" class="action-btn assignee-btn" aria-label="Sorumlu"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span class="action-text">Sorumlu</span></button>' +
        '<button type="button" class="action-btn deadline-btn" aria-label="Termin"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span><span class="action-text">Termin</span></button>' +
        '<button type="button" class="action-btn note-btn" aria-label="Not"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg></span><span class="action-text">Not</span></button>' +
        '<button type="button" class="action-btn label-btn" aria-label="Etiket"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17-7.17a2 2 0 0 0-2.83 0L2 12v10a2 2 0 0 0 2 2h10a2 2 0 0 0 1.41-.59l7.18-7.18a2 2 0 0 0 0-2.82z"/></svg></span><span class="action-text">Etiket</span></button>' +
        '<button type="button" class="action-btn priority-btn" aria-label="Öncelik"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg></span><span class="action-text">Öncelik</span></button>' +
        '<button type="button" class="action-btn file-btn" aria-label="Dosya"><span class="action-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span><span class="action-text">Dosya</span></button>' +
        '</div></div></div></div></li>';
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
    list.querySelectorAll(".assignee-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.assignees[id] || "";
        showAssigneePicker(btn, current, function (val) {
          if (val === null) return;
          persistAssignee(id, val);
          var meta = item.querySelector(".todo-meta");
          var assigneeEl = meta.querySelector(".todo-assignee");
          if (val) {
            if (!assigneeEl) {
              assigneeEl = document.createElement("span");
              assigneeEl.className = "todo-assignee";
              meta.insertBefore(assigneeEl, meta.firstChild);
            }
            assigneeEl.textContent = "Sorumlu: " + val;
          } else if (assigneeEl) assigneeEl.remove();
        });
      });
    });
    list.querySelectorAll(".deadline-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.deadlines[id] || "";
        showDatePicker(btn, current, "Termin tarihi", function (val) {
          if (val === null) return;
          persistDeadline(id, val);
          var meta = item.querySelector(".todo-meta");
          var deadlineEl = meta.querySelector(".todo-deadline");
          if (val) {
            if (!deadlineEl) {
              deadlineEl = document.createElement("span");
              deadlineEl.className = "todo-deadline";
              meta.insertBefore(deadlineEl, meta.firstChild);
            }
            deadlineEl.textContent = "Termin: " + val;
          } else if (deadlineEl) deadlineEl.remove();
        });
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
        showLabelPicker(btn, current, function (val) {
          if (val === null) return;
          persistLabel(id, val);
          var groupId = list.getAttribute("data-group");
          renderList(groupId);
        });
      });
    });

    list.querySelectorAll(".priority-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".roadmap-step");
        var id = item.getAttribute("data-id");
        var current = state.priority[id] || "";
        showPriorityPicker(btn, current, function (val) {
          if (val === null) return;
          persistPriority(id, val);
          var groupId = list.getAttribute("data-group");
          renderList(groupId);
        });
      });
    });

    list.querySelectorAll(".file-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var step = btn.closest(".roadmap-step");
        var id = step.getAttribute("data-id");
        var existing = (state.files[id] || []).length;
        if (existing >= FILE_MAX_COUNT) {
          window.alert("En fazla " + FILE_MAX_COUNT + " dosya ekleyebilirsiniz.");
          return;
        }
        currentFileTaskId = id;
        var input = document.getElementById("taskFileInput");
        if (input) input.click();
      });
    });

    list.querySelectorAll(".file-remove-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var step = btn.closest(".roadmap-step");
        var id = step.getAttribute("data-id");
        var fileId = btn.getAttribute("data-file-id");
        var items = (state.files[id] || []).filter(function (f) { return f.id !== fileId; });
        persistFiles(id, items);
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

  (function () {
    var input = document.getElementById("taskFileInput");
    if (!input) return;
    input.addEventListener("change", function () {
      var taskId = currentFileTaskId;
      currentFileTaskId = null;
      input.value = "";
      if (!taskId) return;
      var list = (state.files[taskId] || []).slice();
      var files = input.files;
      if (!files || !files.length) return;
      var groupId = (document.querySelector(".panel.active") && document.querySelector(".panel.active").id) || GROUP_IDS[0];
      function addOne(index) {
        if (index >= files.length) {
          persistFiles(taskId, list);
          renderList(groupId);
          return;
        }
        if (list.length >= FILE_MAX_COUNT) {
          persistFiles(taskId, list);
          renderList(groupId);
          return;
        }
        var file = files[index];
        if (file.size > FILE_MAX_SIZE) {
          window.alert(file.name + " çok büyük (maks. " + Math.round(FILE_MAX_SIZE / 1024) + " KB).");
          addOne(index + 1);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          list.push({
            id: "file-" + Date.now() + "-" + index + "-" + Math.random().toString(36).slice(2),
            name: file.name,
            size: file.size,
            dataUrl: reader.result
          });
          addOne(index + 1);
        };
        reader.onerror = function () { addOne(index + 1); };
        reader.readAsDataURL(file);
      }
      addOne(0);
    });
  })();

  GROUP_IDS.forEach(renderList);
  renderProgress();

  if (supabase) {
    initAuth();
  } else {
    var appContent = document.getElementById("appContent");
    if (appContent) appContent.style.display = "";
  }
})();
