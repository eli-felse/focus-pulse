(function () {
  "use strict";

  var STORAGE_KEY = "focusPulseSessions";

  var form = document.getElementById("session-form");
  var minutesInput = document.getElementById("minutes");
  var moodInput = document.getElementById("mood");
  var moodValueLabel = document.getElementById("mood-value");
  var notesInput = document.getElementById("notes");

  var sessionList = document.getElementById("session-list");
  var sessionEmpty = document.getElementById("session-empty");

  var statSessions = document.getElementById("stat-sessions");
  var statMinutes = document.getElementById("stat-minutes");
  var statAvgMinutes = document.getElementById("stat-avg-minutes");
  var statAvgMood = document.getElementById("stat-avg-mood");

  var exportBtn = document.getElementById("export-btn");
  var resetBtn = document.getElementById("reset-btn");

  var chartCanvas = document.getElementById("mood-chart");
  var chartEmpty = document.getElementById("chart-empty");

  function loadSessions() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (err) {
      return [];
    }
  }

  function saveSessions(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isSameDay(aIso, bDate) {
    var a = new Date(aIso);
    return (
      a.getFullYear() === bDate.getFullYear() &&
      a.getMonth() === bDate.getMonth() &&
      a.getDate() === bDate.getDate()
    );
  }

  function dayKey(date) {
    return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
  }

  function formatTime(iso) {
    var d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function moodClass(mood) {
    if (mood > 0) return "mood-pos";
    if (mood < 0) return "mood-neg";
    return "mood-zero";
  }

  function moodLabel(mood) {
    var sign = mood > 0 ? "+" : "";
    return sign + mood;
  }

  // ---- rendering ----

  function renderMoodValue() {
    moodValueLabel.textContent = moodLabel(parseInt(moodInput.value, 10));
  }

  function renderSessionList(sessions) {
    sessionList.innerHTML = "";

    if (sessions.length === 0) {
      sessionEmpty.hidden = false;
      return;
    }
    sessionEmpty.hidden = true;

    var sorted = sessions.slice().sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    sorted.slice(0, 50).forEach(function (session) {
      var li = document.createElement("li");
      li.className = "session-item";

      var main = document.createElement("div");
      main.className = "session-main";

      var topLine = document.createElement("div");
      topLine.className = "session-top-line";

      var minutesSpan = document.createElement("span");
      minutesSpan.className = "session-minutes";
      minutesSpan.textContent = session.minutes + " min";

      var moodSpan = document.createElement("span");
      moodSpan.className = "session-mood " + moodClass(session.mood);
      moodSpan.textContent = "mood " + moodLabel(session.mood);

      var timeSpan = document.createElement("span");
      timeSpan.className = "session-time";
      timeSpan.textContent = formatTime(session.timestamp);

      topLine.appendChild(minutesSpan);
      topLine.appendChild(moodSpan);
      topLine.appendChild(timeSpan);
      main.appendChild(topLine);

      if (session.notes) {
        var notesP = document.createElement("p");
        notesP.className = "session-notes";
        notesP.textContent = session.notes;
        main.appendChild(notesP);
      }

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.setAttribute("aria-label", "Delete this session");
      deleteBtn.addEventListener("click", function () {
        deleteSession(session.id);
      });

      li.appendChild(main);
      li.appendChild(deleteBtn);
      sessionList.appendChild(li);
    });
  }

  function renderStats(sessions) {
    var today = new Date();
    var todays = sessions.filter(function (s) {
      return isSameDay(s.timestamp, today);
    });

    var totalMinutes = todays.reduce(function (sum, s) {
      return sum + s.minutes;
    }, 0);

    var avgMinutes = todays.length ? Math.round(totalMinutes / todays.length) : 0;

    var avgMood = todays.length
      ? (todays.reduce(function (sum, s) { return sum + s.mood; }, 0) / todays.length)
      : 0;

    statSessions.textContent = todays.length;
    statMinutes.textContent = totalMinutes;
    statAvgMinutes.textContent = avgMinutes;
    statAvgMood.textContent = (avgMood > 0 ? "+" : "") + avgMood.toFixed(1);
  }

  function getLastNDays(n) {
    var days = [];
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }
    return days;
  }

  function renderChart(sessions) {
    var ctx = chartCanvas.getContext("2d");
    var days = getLastNDays(7);

    var dayAverages = days.map(function (day) {
      var matches = sessions.filter(function (s) {
        return isSameDay(s.timestamp, day);
      });
      if (matches.length === 0) return null;
      var sum = matches.reduce(function (acc, s) { return acc + s.mood; }, 0);
      return sum / matches.length;
    });

    var hasData = dayAverages.some(function (v) { return v !== null; });

    var width = chartCanvas.width;
    var height = chartCanvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!hasData) {
      chartEmpty.hidden = false;
      return;
    }
    chartEmpty.hidden = true;

    var padding = { top: 20, right: 20, bottom: 30, left: 36 };
    var plotW = width - padding.left - padding.right;
    var plotH = height - padding.top - padding.bottom;

    var minVal = -3;
    var maxVal = 3;

    function xForIndex(i) {
      return padding.left + (plotW * i) / (days.length - 1);
    }
    function yForValue(v) {
      var t = (v - minVal) / (maxVal - minVal);
      return padding.top + plotH * (1 - t);
    }

    // gridlines + axis labels
    ctx.strokeStyle = "#30343a";
    ctx.fillStyle = "#9aa0a8";
    ctx.font = "11px sans-serif";
    ctx.lineWidth = 1;

    [-3, 0, 3].forEach(function (v) {
      var y = yForValue(v);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(String(v), 6, y + 4);
    });

    // day labels
    ctx.textAlign = "center";
    days.forEach(function (day, i) {
      var label = day.toLocaleDateString(undefined, { weekday: "short" });
      ctx.fillText(label, xForIndex(i), height - 10);
    });
    ctx.textAlign = "start";

    // line through known points, skipping gaps
    ctx.strokeStyle = "#6fb3ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    var started = false;
    dayAverages.forEach(function (v, i) {
      if (v === null) {
        started = false;
        return;
      }
      var x = xForIndex(i);
      var y = yForValue(v);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // points
    ctx.fillStyle = "#6fb3ff";
    dayAverages.forEach(function (v, i) {
      if (v === null) return;
      var x = xForIndex(i);
      var y = yForValue(v);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function renderAll() {
    var sessions = loadSessions();
    renderSessionList(sessions);
    renderStats(sessions);
    renderChart(sessions);
  }

  // ---- mutations ----

  function addSession(minutes, mood, notes) {
    var sessions = loadSessions();
    sessions.push({
      id: makeId(),
      timestamp: new Date().toISOString(),
      minutes: minutes,
      mood: mood,
      notes: notes
    });
    saveSessions(sessions);
    renderAll();
  }

  function deleteSession(id) {
    var sessions = loadSessions().filter(function (s) {
      return s.id !== id;
    });
    saveSessions(sessions);
    renderAll();
  }

  function exportData() {
    var sessions = loadSessions();
    var blob = new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "focus-pulse-export-" + dayKey(new Date()) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function resetData() {
    var confirmed = window.confirm(
      "This will permanently delete all logged sessions on this device. Continue?"
    );
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
  }

  // ---- events ----

  moodInput.addEventListener("input", renderMoodValue);

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var minutes = parseInt(minutesInput.value, 10);
    var mood = parseInt(moodInput.value, 10);
    var notes = notesInput.value.trim().slice(0, 200);

    if (!minutes || minutes <= 0) {
      minutesInput.focus();
      return;
    }

    addSession(minutes, mood, notes);

    form.reset();
    moodInput.value = "0";
    renderMoodValue();
    minutesInput.focus();
  });

  exportBtn.addEventListener("click", exportData);
  resetBtn.addEventListener("click", resetData);

  // ---- init ----

  renderMoodValue();
  renderAll();
})();
