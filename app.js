(function () {
  const STORAGE_KEY = "eihracat-destekleri-takip";
  const CIRCLE_LENGTH = 339.292;

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

  function renderProgress() {
    let total = 0;
    let completed = 0;
    Object.values(window.EIHRACAT_TODO_DATA).forEach(function (items) {
      items.forEach(function (item) {
        total++;
        if (state.done[item.id]) completed++;
      });
    });
    const pct = total ? Math.round((completed / total) * 100) : 0;
    const el = document.getElementById("progressText");
    const circle = document.getElementById("progressCircle");
    if (el) el.textContent = pct + "%";
    if (circle) {
      const offset = CIRCLE_LENGTH - (pct / 100) * CIRCLE_LENGTH;
      circle.style.strokeDashoffset = String(offset);
    }
  }

  function renderList(groupId) {
    const list = document.querySelector('.todo-list[data-group="' + groupId + '"]');
    if (!list) return;
    const items = window.EIHRACAT_TODO_DATA[groupId];
    if (!items) return;

    list.innerHTML = items
      .map(function (item) {
        const done = state.done[item.id];
        const note = state.notes[item.id] || "";
        const date = state.dates[item.id] || "";
        return (
          '<li class="todo-item' + (done ? " done" : "") + '" data-id="' + item.id + '">' +
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
          "</li>"
        );
      })
      .join("");

    list.querySelectorAll(".todo-check").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.closest(".todo-item");
        const id = item.getAttribute("data-id");
        const next = !state.done[id];
        state.done[id] = next;
        persistDone(id, next);
        item.classList.toggle("done", next);
        btn.innerHTML = next ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>' : "";
        renderProgress();
      });
    });

    list.querySelectorAll(".note-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const item = btn.closest(".todo-item");
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
        const item = btn.closest(".todo-item");
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
        const item = ta.closest(".todo-item");
        const id = item.getAttribute("data-id");
        const val = ta.value.trim();
        persistNote(id, val);
        const meta = item.querySelector(".todo-meta");
        const noteSpan = meta.querySelector(".todo-note");
        if (noteSpan) noteSpan.textContent = val;
        ta.parentElement.style.display = "none";
        item.querySelector(".note-btn").classList.remove("active");
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      const t = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab").forEach(function (x) {
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
