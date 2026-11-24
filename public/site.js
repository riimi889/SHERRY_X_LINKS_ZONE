fetch("/api/config").then(r => r.json()).then(config => {
  const button = document.getElementById("channelButton");
  if (button && config.channelUrl) button.href = config.channelUrl;
}).catch(() => {});
const form = document.getElementById("submitForm");
const statusBox = document.getElementById("status");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusBox.className = "status";
  statusBox.textContent = "Submitting…";
  statusBox.style.display = "block";
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/submit", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    statusBox.textContent = data.message || data.error || "Something went wrong.";
    statusBox.className = "status " + (response.ok ? "ok" : "bad");
    if (response.ok) form.reset();
  } catch {
    statusBox.textContent = "Network error. Please try again.";
    statusBox.className = "status bad";
  }
});
