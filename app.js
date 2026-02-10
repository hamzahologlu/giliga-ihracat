(function () {
  const STORAGE_KEY = "eihracat-destekleri-takip";

  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { done: {}, notes: {}, dates: {} };
    } catch (_) {
      return { done: {}, notes: {}, dates: {} };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
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

  function getCounts() {
    const counts = {};
    Object.keys(window.EIHRACAT_TODO_DATA || {}).forEach(function (groupId) {
      const items = window.EIHRACAT_TODO_DATA[groupId];
      let done = 0;
      items.forEach(function (item) {
        if (state.done[item.id]) done++;
      });
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
    Object.keys(counts || {}).forEach(function (groupId) {
      const c = counts[groupId];
      const span = document.querySelector('.sidebar-item-count[data-count="' + groupId + '"]');
      if (span) span.textContent = c.done + "/" + c.total;
    });
  }

  function renderList(groupId) {
    const list = document.querySelector('.todo-list[data-group="' + groupId + '"]');
    if (!list) return;
    const items = window.EIHRACAT_TODO_DATA[groupId];
    if (!items) return;

    list.innerHTML = items
      .map(function (item, index) {
        const stepNum = index + 1;
        const done = state.done[item.id];
        const note = state.notes[item.id] || "";
        const date = state.dates[item.id] || "";
        return (
          '<li class="roadmap-step' + (done ? " done" : "") + '" data-id="' + item.id + '">' +
          '<div class="roadmap-step-marker">' +
          '<span class="roadmap-step-num">' + stepNum + '</span>' +
          '</div>' +
          '<div class="roadmap-step-content">' +
          '<div class="todo-item">' +
          '<span class="todo-check" role="button" tabindex="0" aria-label="Tamamla">' +
          (done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>' : "") +
          "</span>" +
          '<div class="todo-body">' +
          '<p class="todo-title">' + escapeHtml(item.title) + "</p>" +
          (item.detail ? '<p class="todo-detail">' + escapeHtml(item.detail) + "</p>" : "") +
          '<div class="todo-meta">' +
          (date ? '<span class="todo-date">' + escapeHtml(date) + "</span>" : "") +
          (note ? '<span class="todo-note">' + escapeHtml(note) + "</span>" : "") +
          '<div class="note-field" style="display:none"><textarea placeholder="Not ekle..." rows="2"></textarea></div>' +
          '</div>' +
          '<div class="todo-actions">' +
          '<button type="button" class="note-btn" aria-label="Not">Not</button>' +
          '<button type="button" class="date-btn" aria-label="Tarih">Tarih</button>' +
          "</div>" +
          "</div>" +
          "</div></div></li>"
        );
      })
      .join("");

    list.querySelectorAll(".todo-check").forEach(function (btn) {
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

    list.querySelectorAll(".note-btn").forEach(function (btn) {
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

    list.querySelectorAll(".date-btn").forEach(function (btn) {
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

    list.querySelectorAll(".note-field textarea").forEach(function (ta) {
      ta.addEventListener("blur", function () {
        const item = ta.closest(".roadmap-step");
        const id = item.getAttribute("data-id");
        const val = ta.value.trim();
        persistNote(id, val);
        const meta = item.querySelector(".todo-meta");
        const noteSpan = meta.querySelector(".todo-note");
        if (noteSpan) noteSpan.textContent = val;
        ta.parentElement.style.display = "none";
        if (item) item.querySelector(".note-btn").classList.remove("active");
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  document.querySelectorAll(".sidebar-item").forEach(function (item) {
    item.addEventListener("click", function () {
      const t = item.getAttribute("data-tab");
      document.querySelectorAll(".sidebar-item").forEach(function (x) {
        x.classList.toggle("active", x.getAttribute("data-tab") === t);
      });
      document.querySelectorAll(".panel").forEach(function (p) {
        p.classList.toggle("active", p.id === t);
      });
      renderList(t);
    });
  });

  ["on-sartlar", "kapsama", "destekler", "yillik"].forEach(renderList);
  renderProgress();
})();
