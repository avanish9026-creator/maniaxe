/* ==========================================================================
   MANIAXE TYPING — PROFILE / PROGRESS
   ========================================================================== */

document.addEventListener("DOMContentLoaded", function () {
  if (typeof protectPage !== "function") return;

  protectPage(function (user) {
    document.getElementById("profileGreeting").textContent =
      (user.displayName ? user.displayName.split(" ")[0] + "'s" : "Your") + " progress";

    const history = getUserHistory(user.uid);

    if (!history.length) {
      document.getElementById("profileEmpty").style.display = "block";
      return;
    }

    document.getElementById("profileContent").style.display = "block";

    const wpmValues = history.map((h) => h.wpm);
    const accValues = history.map((h) => h.accuracy);
    const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    document.getElementById("statTests").textContent = history.length;
    document.getElementById("statAvgWpm").textContent = avg(wpmValues);
    document.getElementById("statBestWpm").textContent = Math.max(...wpmValues);
    document.getElementById("statAvgAcc").textContent = avg(accValues) + "%";

    const tbody = document.getElementById("historyBody");
    history.slice().reverse().slice(0, 40).forEach((h) => {
      const tr = document.createElement("tr");
      const date = new Date(h.timestamp);
      const mode = h.language || h.drill || (h.mode === "words" ? h.wordCount + " words" : (h.duration ? h.duration + "s" : "infinite"));
      tr.innerHTML = `
        <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
        <td>${h.wpm}</td>
        <td>${h.accuracy}%</td>
        <td>${h.time}s</td>
        <td>${mode}</td>
      `;
      tbody.appendChild(tr);
    });

    if (typeof Chart !== "undefined") {
      const ctx = document.getElementById("wpmChart").getContext("2d");
      const recent = history.slice(-30);
      new Chart(ctx, {
        type: "line",
        data: {
          labels: recent.map((_, i) => i + 1),
          datasets: [{
            label: "WPM",
            data: recent.map((h) => h.wpm),
            borderColor: "#2b3ff2",
            backgroundColor: "rgba(43,63,242,.14)",
            tension: 0.3,
            fill: true,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: { grid: { color: "rgba(255,255,255,.06)" }, ticks: { color: "#9a9296" } }
          }
        }
      });
    }
  });
});
