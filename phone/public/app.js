(() => {
  "use strict";

  const KEYS = {
    rememberedToken: "jarvis_phone_token",
    sessionToken: "jarvis_phone_session",
    history: "jarvis_phone_history",
    speak: "jarvis_phone_speak",
    language: "jarvis_phone_language",
  };
  const MAX_HISTORY = 80;
  const MAX_CONTEXT_MESSAGES = 24;
  const $ = (id) => document.getElementById(id);

  const unlockScreen = $("unlockScreen");
  const assistantScreen = $("assistantScreen");
  const unlockForm = $("unlockForm");
  const appPassword = $("appPassword");
  const unlockButton = $("unlockButton");
  const unlockMessage = $("unlockMessage");
  const rememberDevice = $("rememberDevice");
  const conversation = $("conversation");
  const welcomeCard = $("welcomeCard");
  const messageList = $("messageList");
  const typingIndicator = $("typingIndicator");
  const composerForm = $("composerForm");
  const messageInput = $("messageInput");
  const sendButton = $("sendButton");
  const micButton = $("micButton");
  const speechLanguage = $("speechLanguage");
  const speakToggle = $("speakToggle");
  const speakState = $("speakState");
  const settingsButton = $("settingsButton");
  const settingsPanel = $("settingsPanel");
  const connectionStatus = $("connectionStatus");
  const connectionLabel = $("connectionLabel");
  const toast = $("toast");
  const characterCount = $("characterCount");

  let token = localStorage.getItem(KEYS.rememberedToken) || sessionStorage.getItem(KEYS.sessionToken) || "";
  let history = loadHistory();
  let sending = false;
  let toastTimer = 0;
  let recognition = null;
  let isListening = false;
  let speakReplies = localStorage.getItem(KEYS.speak) === "yes";

  function loadHistory() {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
      if (!Array.isArray(data)) return [];
      return data
        .filter((item) => item && ["user", "model"].includes(item.role) && typeof item.text === "string")
        .slice(-MAX_HISTORY)
        .map((item) => ({ role: item.role, text: item.text.slice(0, 6_000) }));
    } catch {
      return [];
    }
  }

  function saveHistory() {
    history = history.slice(-MAX_HISTORY);
    try {
      localStorage.setItem(KEYS.history, JSON.stringify(history));
    } catch {
      showToast("Phone storage is full. Clear some chat history.");
    }
  }

  function setConnected(connected) {
    connectionStatus.classList.toggle("offline", !connected);
    connectionLabel.textContent = connected ? "CLOUD READY" : "OFFLINE";
  }

  function showUnlock(message = "") {
    if (recognition && isListening) recognition.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    assistantScreen.hidden = true;
    unlockScreen.hidden = false;
    unlockMessage.textContent = message;
    appPassword.value = "";
    token = "";
    localStorage.removeItem(KEYS.rememberedToken);
    sessionStorage.removeItem(KEYS.sessionToken);
  }

  function showAssistant() {
    unlockScreen.hidden = true;
    assistantScreen.hidden = false;
    unlockMessage.textContent = "";
    renderHistory();
    updateSpeakButton();
    updateNetworkStatus();
    scrollToBottom(false);
  }

  function updateNetworkStatus() {
    setConnected(navigator.onLine);
  }

  async function checkSavedSession() {
    if (!token) {
      showUnlock();
      return;
    }
    try {
      const response = await fetch("/api/session", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (response.ok) {
        showAssistant();
      } else {
        showUnlock("Your saved sign-in expired. Enter your app password again.");
      }
    } catch {
      showAssistant();
      showToast("You are offline. Saved chats are available; connect to the internet to talk to JARVIS.");
    }
  }

  unlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = appPassword.value;
    if (!password) return;
    unlockButton.disabled = true;
    unlockButton.querySelector("span:first-child").textContent = "CONNECTING…";
    unlockMessage.textContent = "";
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not sign in. Check your connection and try again.");

      token = data.token;
      localStorage.removeItem(KEYS.rememberedToken);
      sessionStorage.removeItem(KEYS.sessionToken);
      if (rememberDevice.checked) localStorage.setItem(KEYS.rememberedToken, token);
      else sessionStorage.setItem(KEYS.sessionToken, token);
      appPassword.value = "";
      showAssistant();
    } catch (error) {
      unlockMessage.textContent = error.message || "Could not sign in. Please try again.";
    } finally {
      unlockButton.disabled = false;
      unlockButton.querySelector("span:first-child").textContent = "OPEN JARVIS";
    }
  });

  $("showPassword").addEventListener("click", () => {
    const show = appPassword.type === "password";
    appPassword.type = show ? "text" : "password";
    $("showPassword").textContent = show ? "Hide" : "Show";
    $("showPassword").setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  function makeMessage(message, { temporary = false } = {}) {
    const isAssistant = message.role === "model";
    const article = document.createElement("article");
    article.className = `message ${isAssistant ? "message-assistant" : "message-user"}${message.error ? " message-error" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = isAssistant ? "J" : "YOU";

    const content = document.createElement("div");
    content.className = "message-content";
    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = message.error ? "NOTICE" : isAssistant ? "JARVIS" : "YOU";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.setAttribute("dir", "auto");
    bubble.textContent = message.text;
    content.append(label, bubble);

    if (isAssistant && !message.error) {
      const tools = document.createElement("div");
      tools.className = "message-tools";
      const speakButton = document.createElement("button");
      speakButton.className = "speak-message";
      speakButton.type = "button";
      speakButton.textContent = "◖  Read aloud";
      speakButton.setAttribute("aria-label", "Read this JARVIS reply aloud");
      speakButton.addEventListener("click", () => speakText(message.text));
      tools.append(speakButton);
      content.append(tools);
    }

    article.append(avatar, content);
    messageList.append(article);
    if (!temporary) welcomeCard.hidden = true;
    return article;
  }

  function renderHistory() {
    messageList.replaceChildren();
    welcomeCard.hidden = history.length > 0;
    for (const message of history) makeMessage(message);
  }

  function scrollToBottom(smooth = true) {
    requestAnimationFrame(() => conversation.scrollTo({
      top: conversation.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    }));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3_400);
  }

  function setSending(value) {
    sending = value;
    sendButton.disabled = value;
    messageInput.disabled = value;
    typingIndicator.hidden = !value;
    if (value) scrollToBottom();
  }

  function makeApiContext() {
    const candidates = history.slice(-MAX_CONTEXT_MESSAGES);
    const recent = [];
    let totalChars = 0;
    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const message = candidates[index];
      if (totalChars + message.text.length > 24_000) break;
      recent.unshift({ role: message.role, text: message.text });
      totalChars += message.text.length;
    }
    while (recent.length && recent[0].role !== "user") recent.shift();
    return recent;
  }

  async function sendMessage(rawText) {
    const text = rawText.trim();
    if (!text || sending || !token) return;
    if (text.length > 6_000) {
      showToast("Keep each message under 6,000 characters.");
      return;
    }

    history.push({ role: "user", text });
    saveHistory();
    makeMessage({ role: "user", text });
    messageInput.value = "";
    updateCharacterCount();
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: makeApiContext() }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setSending(false);
        showUnlock("Your sign-in expired. Enter your app password again.");
        return;
      }
      if (!response.ok) throw new Error(data.error || "The assistant could not answer just now.");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("The assistant returned an empty reply.");

      const reply = data.reply.trim();
      history.push({ role: "model", text: reply });
      saveHistory();
      makeMessage({ role: "model", text: reply });
      if (speakReplies) speakText(reply);
    } catch (error) {
      makeMessage({ role: "model", text: error.message || "Something went wrong. Please try again.", error: true }, { temporary: true });
    } finally {
      setSending(false);
      messageInput.focus({ preventScroll: true });
      scrollToBottom();
    }
  }

  composerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(messageInput.value);
  });

  messageInput.addEventListener("input", () => {
    updateCharacterCount();
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
  });

  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      composerForm.requestSubmit();
    }
  });

  function updateCharacterCount() {
    characterCount.textContent = `${messageInput.value.length} / 6000`;
  }

  for (const chip of document.querySelectorAll(".prompt-chip")) {
    chip.addEventListener("click", () => {
      messageInput.value = chip.dataset.prompt || "";
      updateCharacterCount();
      composerForm.requestSubmit();
    });
  }

  settingsButton.addEventListener("click", () => {
    const opening = settingsPanel.hidden;
    settingsPanel.hidden = !opening;
    settingsButton.setAttribute("aria-expanded", String(opening));
  });

  document.addEventListener("click", (event) => {
    if (!settingsPanel.hidden && !settingsPanel.contains(event.target) && !settingsButton.contains(event.target)) {
      settingsPanel.hidden = true;
      settingsButton.setAttribute("aria-expanded", "false");
    }
  });

  $("clearChatButton").addEventListener("click", () => {
    if (!history.length) {
      showToast("There is no chat history to clear.");
      return;
    }
    if (!window.confirm("Clear the saved conversation from this phone?")) return;
    history = [];
    saveHistory();
    renderHistory();
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
    showToast("Chat history cleared from this phone.");
  });

  $("logoutButton").addEventListener("click", () => {
    settingsPanel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
    showUnlock("You have signed out of this phone.");
  });

  function updateSpeakButton() {
    const supported = "speechSynthesis" in window;
    speakToggle.disabled = !supported;
    speakToggle.setAttribute("aria-pressed", String(speakReplies));
    speakState.textContent = !supported ? "UNAVAILABLE" : speakReplies ? "ON" : "OFF";
    speakState.classList.toggle("active", speakReplies && supported);
    if (!supported) speakToggle.title = "Speech output is not supported by this browser.";
  }

  speakToggle.addEventListener("click", () => {
    speakReplies = !speakReplies;
    localStorage.setItem(KEYS.speak, speakReplies ? "yes" : "no");
    updateSpeakButton();
    if (speakReplies) showToast("JARVIS will read new replies aloud.");
    else {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      showToast("Read-aloud is off.");
    }
  });

  speechLanguage.value = localStorage.getItem(KEYS.language) || "en-US";
  speechLanguage.addEventListener("change", () => {
    localStorage.setItem(KEYS.language, speechLanguage.value);
    if (recognition && isListening) recognition.stop();
  });

  function speakText(text) {
    if (!("speechSynthesis" in window)) {
      showToast("This browser does not support spoken replies.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage.value;
    const voices = window.speechSynthesis.getVoices();
    const languagePrefix = speechLanguage.value.toLowerCase().split("-")[0];
    const voice = voices.find((candidate) => candidate.lang.toLowerCase() === speechLanguage.value.toLowerCase())
      || voices.find((candidate) => candidate.lang.toLowerCase().startsWith(`${languagePrefix}-`));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function setListening(value) {
    isListening = value;
    micButton.classList.toggle("listening", value);
    micButton.setAttribute("aria-label", value ? "Stop dictation" : "Dictate a message");
    micButton.title = value ? "Listening — tap to stop" : "Dictate a message";
  }

  micButton.addEventListener("click", () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Voice typing is not available in this browser. You can still type your message.");
      return;
    }
    if (isListening && recognition) {
      recognition.stop();
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = speechLanguage.value;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    const originalText = messageInput.value.trim();
    let transcript = "";

    recognition.onstart = () => {
      setListening(true);
      showToast("Listening… tap the microphone to stop.");
    };
    recognition.onresult = (event) => {
      transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      messageInput.value = [originalText, transcript].filter(Boolean).join(" ").slice(0, 6_000);
      updateCharacterCount();
      messageInput.dispatchEvent(new Event("input", { bubbles: true }));
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showToast("Allow microphone access in your phone browser settings, then try again.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        showToast("Voice typing stopped. You can type your message instead.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      if (transcript) messageInput.focus({ preventScroll: true });
    };
    try {
      recognition.start();
    } catch {
      setListening(false);
      showToast("Voice typing could not start. Please try again.");
    }
  });

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  checkSavedSession();
})();
