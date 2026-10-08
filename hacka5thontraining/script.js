const chatMessages = document.querySelector("#chat-messages");
const gradeForm = document.querySelector("#grade-form");
const gradeRows = document.querySelector("#grade-rows");
const gradeChartCanvas = document.querySelector("#grade-chart-canvas");
const chartEmpty = document.querySelector("#chart-empty");
let gradeChart;
let nextGradeRowId = 3;

function updateGradeRowControls() {
  const rows = [...gradeRows.querySelectorAll(".grade-row")];
  rows.forEach((row, index) => {
    const removeButton = row.querySelector(".remove-grade");
    removeButton.disabled = rows.length <= 2;
    removeButton.setAttribute("aria-label", `Remove topic ${index + 1}`);
  });
}

function createGradeRow(rowId) {
  const row = document.createElement("div");
  row.className = "grade-row";

  const topicLabel = document.createElement("label");
  topicLabel.className = "visually-hidden";
  topicLabel.htmlFor = `topic-${rowId}`;
  topicLabel.textContent = `Topic ${rowId}`;

  const topicInput = document.createElement("input");
  topicInput.id = `topic-${rowId}`;
  topicInput.name = "topic";
  topicInput.type = "text";
  topicInput.maxLength = 50;
  topicInput.placeholder = "e.g. Chemistry";
  topicInput.required = true;

  const gradeLabel = document.createElement("label");
  gradeLabel.className = "visually-hidden";
  gradeLabel.htmlFor = `grade-${rowId}`;
  gradeLabel.textContent = `Grade for topic ${rowId}`;

  const gradeInput = document.createElement("input");
  gradeInput.id = `grade-${rowId}`;
  gradeInput.name = "grade";
  gradeInput.type = "number";
  gradeInput.min = "0";
  gradeInput.max = "100";
  gradeInput.step = "1";
  gradeInput.placeholder = "0–100";
  gradeInput.required = true;

  const removeButton = document.createElement("button");
  removeButton.className = "remove-grade";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", `Remove topic ${rowId}`);
  removeButton.textContent = "×";
  removeButton.addEventListener("click", () => {
    row.remove();
    updateGradeRowControls();
  });

  row.append(topicLabel, topicInput, gradeLabel, gradeInput, removeButton);
  return row;
}

document.querySelectorAll(".grade-row .remove-grade").forEach((button) => {
  button.addEventListener("click", () => {
    button.closest(".grade-row").remove();
    updateGradeRowControls();
  });
});

document.querySelector("#add-grade").addEventListener("click", () => {
  const newRow = createGradeRow(nextGradeRowId++);
  gradeRows.append(newRow);
  updateGradeRowControls();
  newRow.querySelector("input[name='topic']").focus();
});

function addStudyFocusMessage(weakestTopics) {
  chatMessages.querySelectorAll(".chat-focus-message").forEach((message) => message.remove());
  const message = document.createElement("div");
  const text = document.createElement("p");
  const quizButton = document.createElement("button");
  const status = document.createElement("span");
  const topicSummary = weakestTopics
    .map((topic) => `${topic.name} (${topic.grade}%)`)
    .join(" and ");

  message.className = "message assistant-message chat-focus-message";
  text.textContent = `Your two lowest grades are ${topicSummary}. Give these topics some extra study time.`;
  quizButton.className = "quiz-focus-button";
  quizButton.type = "button";
  quizButton.textContent = "Copy quiz prompt";
  status.className = "copy-prompt-status";
  status.setAttribute("role", "status");
  quizButton.addEventListener("click", async () => {
    const prompt = `Please quiz me on ${weakestTopics.map((topic) => topic.name).join(" and ")}. Start with the core ideas, then explain any answers I get wrong.`;
    try {
      await navigator.clipboard.writeText(prompt);
      status.textContent = "Copied. Paste it into your preferred AI chat.";
    } catch {
      status.textContent = prompt;
    }
  });

  message.append(text, quizButton, status);
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  document.querySelector("#chat").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

gradeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const rows = [...gradeRows.querySelectorAll(".grade-row")];
  const grades = rows.map((row) => ({
    name: row.querySelector("input[name='topic']").value.trim(),
    grade: Number(row.querySelector("input[name='grade']").value),
  }));

  if (grades.length < 2 || grades.some((item) => !item.name || !Number.isFinite(item.grade))) return;

  const chartName = gradeForm.elements.chartName.value.trim();
  const chartTitle = gradeForm.elements.chartTitle.value.trim();
  const axisLabelTitle = gradeForm.elements.axisLabelTitle.value.trim();
  const axisGradeTitle = gradeForm.elements.axisGradeTitle.value.trim();
  const sortedGrades = [...grades].sort((first, second) => first.grade - second.grade);
  const weakestTopics = sortedGrades.slice(0, 2);
  const weakestIndexes = new Set(
    grades
      .map((item, index) => ({ index, grade: item.grade }))
      .sort((first, second) => first.grade - second.grade)
      .slice(0, 2)
      .map((item) => item.index),
  );

  document.querySelector("#chart-name-output").textContent = chartName;
  document.querySelector("#chart-title-output").textContent = chartTitle;
  document.querySelector("#chart-count").textContent = `${grades.length} ${grades.length === 1 ? "topic" : "topics"}`;
  document.querySelector("#chart-axis-summary").textContent = `${axisLabelTitle} · ${axisGradeTitle}`;
  gradeChartCanvas.setAttribute(
    "aria-label",
    `${chartTitle}. ${grades.map((item) => `${item.name}: ${item.grade} percent`).join("; ")}`,
  );

  if (typeof Chart === "undefined") {
    chartEmpty.textContent = "The chart library did not load. Check your internet connection and try again.";
    chartEmpty.hidden = false;
    return;
  }

  chartEmpty.hidden = true;
  if (gradeChart) gradeChart.destroy();
  gradeChart = new Chart(gradeChartCanvas, {
    type: "bar",
    data: {
      labels: grades.map((item) => item.name),
      datasets: [{
        label: axisGradeTitle,
        data: grades.map((item) => item.grade),
        backgroundColor: grades.map((item, index) => weakestIndexes.has(index)
          ? "#c99a70"
          : "#8eb99b"),
        borderColor: grades.map((item, index) => weakestIndexes.has(index)
          ? "#dfb28a"
          : "#a8c5af"),
        borderWidth: 1,
        borderRadius: 5,
        maxBarThickness: 56,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y}%`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: axisLabelTitle, color: "#c1d2c5", font: { family: "DM Sans" } },
          ticks: { color: "#dce8df", font: { family: "DM Sans" } },
          grid: { display: false },
          border: { color: "#597361" },
        },
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: axisGradeTitle, color: "#c1d2c5", font: { family: "DM Sans" } },
          ticks: { color: "#c1d2c5", stepSize: 20, callback: (value) => `${value}%` },
          grid: { color: "rgba(174, 197, 180, 0.16)" },
          border: { color: "#597361" },
        },
      },
    },
  });

  addStudyFocusMessage(weakestTopics);
});
