const chatMessages = document.querySelector("#chat-messages");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatSendBtn = document.querySelector("#chat-send");
const quizWeakBtn = document.querySelector("#quiz-weak-btn");
const studyPlanBtn = document.querySelector("#study-plan-btn");
const explainBtn = document.querySelector("#explain-btn");
const clearChatBtn = document.querySelector("#clear-chat-btn");
const sampleDataBtn = document.querySelector("#sample-data-btn");
const clearFormBtn = document.querySelector("#clear-form-btn");

const statsOverview = document.querySelector("#stats-overview");
const statAverage = document.querySelector("#stat-average");
const statCount = document.querySelector("#stat-count");
const statWeakest = document.querySelector("#stat-weakest");

const gradeForm = document.querySelector("#grade-form");
const gradeRows = document.querySelector("#grade-rows");
const gradeChartCanvas = document.querySelector("#grade-chart-canvas");
const chartEmpty = document.querySelector("#chart-empty");
let gradeChart;
let nextGradeRowId = 3;

let currentWeakestTopics = [];
let currentAllGrades = [];
const chatHistory = [];
let isGenerating = false;

function updateGradeRowControls() {
  const rows = [...gradeRows.querySelectorAll(".grade-row")];
  rows.forEach((row, index) => {
    const removeButton = row.querySelector(".remove-grade");
    removeButton.disabled = rows.length <= 2;
    removeButton.setAttribute("aria-label", `Remove topic ${index + 1}`);
  });
}

function createGradeRow(rowId, topicVal = "", gradeVal = "") {
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
  topicInput.value = topicVal;
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
  gradeInput.value = gradeVal;
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

if (sampleDataBtn) {
  sampleDataBtn.addEventListener("click", () => {
    gradeRows.innerHTML = "";
    nextGradeRowId = 1;
    const samples = [
      { name: "Algebra", grade: 54 },
      { name: "Organic Chemistry", grade: 46 },
      { name: "World History", grade: 82 },
      { name: "English Literature", grade: 89 },
    ];
    samples.forEach((s) => {
      gradeRows.append(createGradeRow(nextGradeRowId++, s.name, s.grade));
    });
    updateGradeRowControls();
    gradeForm.requestSubmit();
  });
}

if (clearFormBtn) {
  clearFormBtn.addEventListener("click", () => {
    gradeRows.innerHTML = "";
    nextGradeRowId = 1;
    gradeRows.append(createGradeRow(nextGradeRowId++, "", ""));
    gradeRows.append(createGradeRow(nextGradeRowId++, "", ""));
    updateGradeRowControls();
    if (gradeChart) {
      gradeChart.destroy();
      gradeChart = null;
    }
    chartEmpty.hidden = false;
    document.querySelector("#chart-count").textContent = "0 topics";
    if (statsOverview) statsOverview.hidden = true;
    currentWeakestTopics = [];
    currentAllGrades = [];
    if (quizWeakBtn) quizWeakBtn.disabled = true;
    if (studyPlanBtn) studyPlanBtn.disabled = true;
  });
}

if (clearChatBtn) {
  clearChatBtn.addEventListener("click", () => {
    chatMessages.innerHTML = `
      <div class="message assistant-message">
        <p>Chat cleared. Ask me any question, request a quiz on your subjects, or generate your study plan!</p>
      </div>
    `;
    chatHistory.length = 0;
  });
}

function formatMarkdown(text) {
  const escaped = document.createElement("div");
  escaped.textContent = text;
  let formatted = escaped.innerHTML;

  // Bold
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Bullet lists
  formatted = formatted.replace(/(?:^|\n)[*-] (.*?)(?=\n|$)/g, '<br>&bull; $1');
  // Numbered lists
  formatted = formatted.replace(/(?:^|\n)(\d+)\. (.*?)(?=\n|$)/g, '<br><strong>$1.</strong> $2');
  // Headings
  formatted = formatted.replace(/(?:^|\n)### (.*?)(?=\n|$)/g, '<br><strong>$1</strong>');
  // Paragraphs / linebreaks
  formatted = formatted.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

  const span = document.createElement("span");
  span.innerHTML = formatted;
  return span;
}

function appendMessage(role, contentNodeOrText, rawText = "") {
  const msg = document.createElement("div");
  msg.className = `message ${role}-message`;

  if (typeof contentNodeOrText === "string") {
    const p = document.createElement("p");
    p.appendChild(formatMarkdown(contentNodeOrText));
    msg.appendChild(p);
  } else {
    msg.appendChild(contentNodeOrText);
  }

  // Add copy button for assistant text responses
  if (role === "assistant" && rawText) {
    const copyBtn = document.createElement("button");
    copyBtn.className = "msg-copy-btn";
    copyBtn.type = "button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(rawText);
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
      } catch {
        copyBtn.textContent = "Failed";
      }
    });
    msg.appendChild(copyBtn);
  }

  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

let chatApiUrl = "/api/chat";

async function sendChatToGemini(userText) {
  if (isGenerating || !userText.trim()) return;

  const trimmedText = userText.trim();
  appendMessage("user", trimmedText);
  chatHistory.push({ role: "user", text: trimmedText });

  isGenerating = true;
  if (chatInput) chatInput.value = "";
  if (chatSendBtn) chatSendBtn.disabled = true;

  const typingIndicator = document.createElement("div");
  typingIndicator.className = "message assistant-message typing-indicator";
  typingIndicator.textContent = "Thinking...";
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const payload = {
    message: trimmedText,
    history: chatHistory,
    context: {
      weakestTopics: currentWeakestTopics,
      allGrades: currentAllGrades,
    },
  };

  try {
    let res = await fetch(chatApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // If 404 (e.g. on Netlify without redirects applied), automatically retry Netlify functions endpoint
    if (res.status === 404 && chatApiUrl === "/api/chat") {
      const netlifyRes = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (netlifyRes.status !== 404) {
        chatApiUrl = "/.netlify/functions/chat";
        res = netlifyRes;
      }
    }

    typingIndicator.remove();

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorText = errorData.error || `Server error: ${res.status}`;
      appendMessage("error", errorText);
      return;
    }

    const data = await res.json();
    const reply = data.response || "No response received.";
    appendMessage("assistant", reply, reply);
    chatHistory.push({ role: "model", text: reply });
  } catch (err) {
    typingIndicator.remove();
    appendMessage("error", `Could not connect to study assistant: ${err.message}`);
  } finally {
    isGenerating = false;
    if (chatSendBtn) chatSendBtn.disabled = false;
    if (chatInput) chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

if (chatForm) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (chatInput && chatInput.value) {
      sendChatToGemini(chatInput.value);
    }
  });
}

if (quizWeakBtn) {
  quizWeakBtn.addEventListener("click", () => {
    if (currentWeakestTopics.length > 0) {
      const topicNames = currentWeakestTopics.map((t) => t.name).join(" and ");
      sendChatToGemini(`Please start a practice quiz on my weakest topics (${topicNames}). Give me 2 targeted questions to test my understanding.`);
    }
  });
}

if (studyPlanBtn) {
  studyPlanBtn.addEventListener("click", () => {
    if (currentWeakestTopics.length > 0) {
      const topicNames = currentWeakestTopics.map((t) => `${t.name} (${t.grade}%)`).join(", ");
      sendChatToGemini(`Create a structured 7-day study schedule and revision strategy to help me improve my grades in: ${topicNames}.`);
    }
  });
}

if (explainBtn) {
  explainBtn.addEventListener("click", () => {
    sendChatToGemini("What are the most effective evidence-based study techniques (such as active recall, Feynman technique, and spaced repetition), and how can I apply them?");
  });
}

function addStudyFocusMessage(weakestTopics) {
  chatMessages.querySelectorAll(".chat-focus-message").forEach((message) => message.remove());
  const message = document.createElement("div");
  const text = document.createElement("p");
  const buttonsWrap = document.createElement("div");
  const startQuizBtn = document.createElement("button");
  const copyQuizBtn = document.createElement("button");
  const status = document.createElement("span");
  const topicSummary = weakestTopics
    .map((topic) => `${topic.name} (${topic.grade}%)`)
    .join(" and ");

  message.className = "message assistant-message chat-focus-message";
  text.innerHTML = `Your two lowest grades are <strong>${topicSummary}</strong>. Giving these topics a little extra attention will make a noticeable difference.`;

  buttonsWrap.className = "chat-focus-buttons";

  startQuizBtn.className = "primary-button";
  startQuizBtn.type = "button";
  startQuizBtn.textContent = "Practice quiz on these topics";
  startQuizBtn.addEventListener("click", () => {
    const prompt = `Please quiz me on ${weakestTopics.map((t) => t.name).join(" and ")}. Start with 2 core concept questions.`;
    sendChatToGemini(prompt);
  });

  copyQuizBtn.className = "quiz-focus-button secondary-button";
  copyQuizBtn.type = "button";
  copyQuizBtn.textContent = "Copy prompt";
  status.className = "copy-prompt-status";
  status.setAttribute("role", "status");
  copyQuizBtn.addEventListener("click", async () => {
    const prompt = `Please quiz me on ${weakestTopics.map((topic) => topic.name).join(" and ")}. Start with the core ideas, then explain any answers I get wrong.`;
    try {
      await navigator.clipboard.writeText(prompt);
      status.textContent = "Copied to clipboard!";
      setTimeout(() => { status.textContent = ""; }, 2500);
    } catch {
      status.textContent = prompt;
    }
  });

  buttonsWrap.append(startQuizBtn, copyQuizBtn);
  message.append(text, buttonsWrap, status);
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Unlock quick actions
  if (quizWeakBtn) {
    quizWeakBtn.disabled = false;
    quizWeakBtn.title = "Quiz your weakest topics";
  }
  if (studyPlanBtn) {
    studyPlanBtn.disabled = false;
    studyPlanBtn.title = "Generate study schedule";
  }

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

  currentAllGrades = grades;
  const chartName = gradeForm.elements.chartName.value.trim();
  const chartTitle = gradeForm.elements.chartTitle.value.trim();
  const axisLabelTitle = gradeForm.elements.axisLabelTitle.value.trim();
  const axisGradeTitle = gradeForm.elements.axisGradeTitle.value.trim();
  const sortedGrades = [...grades].sort((first, second) => first.grade - second.grade);
  const weakestTopics = sortedGrades.slice(0, 2);
  currentWeakestTopics = weakestTopics;

  const totalScore = grades.reduce((acc, curr) => acc + curr.grade, 0);
  const avgScore = Math.round(totalScore / grades.length);

  // Update Overview Stats Card
  if (statsOverview) {
    statsOverview.hidden = false;
    if (statAverage) statAverage.textContent = `${avgScore}%`;
    if (statCount) statCount.textContent = `${grades.length}`;
    if (statWeakest) statWeakest.textContent = weakestTopics[0]?.name || "--";
  }

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
  document.querySelector("#chart-axis-summary").textContent = `${axisLabelTitle} · ${axisGradeTitle} (Avg: ${avgScore}%)`;
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
