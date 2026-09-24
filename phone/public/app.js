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
  const MAX_SELECTED_ATTACHMENTS = 4;
  const MAX_SOURCE_IMAGE_BYTES = 24 * 1024 * 1024;
  const MAX_COMPRESSED_IMAGE_BYTES = 1_100_000;
  const MAX_TEXT_FILE_BYTES = 180_000;
  const MAX_TEXT_FILE_CHARS = 60_000;
  const MAX_TOTAL_TEXT_FILE_CHARS = 120_000;
  const TEXT_FILE_EXTENSIONS = new Set(["txt", "md", "csv", "json", "log", "xml", "html", "htm", "yaml", "yml", "js", "ts", "py", "css", "sql"]);
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
  const cameraButton = $("cameraButton");
  const filesButton = $("filesButton");
  const cameraInput = $("cameraInput");
  const filesInput = $("filesInput");
  const attachmentTray = $("attachmentTray");
  const imageViewer = $("imageViewer");
  const imageViewerImage = $("imageViewerImage");
  const imageViewerCaption = $("imageViewerCaption");
  const closeImageViewerButton = $("closeImageViewer");
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
  let selectedAttachments = [];
  let processingAttachments = false;
  let attachmentGeneration = 0;

  function loadHistory() {
    try {
      const data = JSON.parse(localStorage.getItem(KEYS.history) || "[]");
      if (!Array.isArray(data)) return [];
      return data
        .filter((item) => item && ["user", "model"].includes(item.role) && typeof item.text === "string")
        .slice(-MAX_HISTORY)
        .map((item) => ({
          role: item.role,
          text: item.text.slice(0, 6_000),
          attachmentNames: Array.isArray(item.attachmentNames)
            ? item.attachmentNames.slice(0, MAX_SELECTED_ATTACHMENTS).map((attachment) => ({
              name: String(attachment?.name || "Attachment").slice(0, 120),
              type: attachment?.type === "image" ? "image" : "text",
            }))
            : [],
        }));
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
    clearSelectedAttachments();
    closeImageViewer();
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
      showToast("You are offline. Saved chats are available; connect to the internet to talk to Legendboy.");
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
      unlockButton.querySelector("span:first-child").textContent = "OPEN LEGEND BOY";
    }
  });

  $("showPassword").addEventListener("click", () => {
    const show = appPassword.type === "password";
    appPassword.type = show ? "text" : "password";
    $("showPassword").textContent = show ? "Hide" : "Show";
    $("showPassword").setAttribute("aria-label", show ? "Hide password" : "Show password");
  });

  function makeFileBadge(name, kind) {
    const badge = document.createElement("div");
    badge.className = "message-file-badge";
    const kindLabel = document.createElement("span");
    kindLabel.className = "file-kind";
    kindLabel.textContent = kind;
    const fileName = document.createElement("span");
    fileName.className = "file-name";
    fileName.textContent = name;
    badge.append(kindLabel, fileName);
    return badge;
  }

  function makeMessage(message, { temporary = false } = {}) {
    const isAssistant = message.role === "model";
    const article = document.createElement("article");
    article.className = `message ${isAssistant ? "message-assistant" : "message-user"}${message.error ? " message-error" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = isAssistant ? "L" : "YOU";

    const content = document.createElement("div");
    content.className = "message-content";
    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = message.error ? "NOTICE" : isAssistant ? "Legendboy" : "YOU";
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.setAttribute("dir", "auto");
    bubble.textContent = message.text;
    content.append(label, bubble);

    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const savedNames = Array.isArray(message.attachmentNames) ? message.attachmentNames : [];
    if (attachments.length || savedNames.length) {
      const attachmentRow = document.createElement("div");
      attachmentRow.className = "message-attachments";
      if (attachments.length) {
        for (const attachment of attachments) {
          if (attachment.type === "image") {
            const preview = document.createElement("button");
            preview.className = "message-image-preview";
            preview.type = "button";
            preview.setAttribute("aria-label", `Open photo ${attachment.name}`);
            const image = document.createElement("img");
            image.src = attachment.previewUrl || attachment.dataUrl;
            image.alt = attachment.name;
            preview.append(image);
            preview.addEventListener("click", () => openImageViewer(attachment.previewUrl || attachment.dataUrl, attachment.name));
            attachmentRow.append(preview);
          } else {
            attachmentRow.append(makeFileBadge(attachment.name, "TEXT"));
          }
        }
      } else {
        for (const attachment of savedNames) {
          attachmentRow.append(makeFileBadge(attachment.name, attachment.type === "image" ? "PHOTO" : "FILE"));
        }
      }
      content.append(attachmentRow);
    }

    if (isAssistant && !message.error) {
      const tools = document.createElement("div");
      tools.className = "message-tools";
      const speakButton = document.createElement("button");
      speakButton.className = "speak-message";
      speakButton.type = "button";
      speakButton.textContent = "◖  Read aloud";
      speakButton.setAttribute("aria-label", "Read this Legendboy reply aloud");
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

  function formatFileSize(bytes) {
    if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }

  function renderAttachmentTray() {
    attachmentTray.replaceChildren();
    attachmentTray.hidden = selectedAttachments.length === 0;
    selectedAttachments.forEach((attachment, index) => {
      const card = document.createElement("div");
      card.className = "attachment-card";
      if (attachment.type === "image") {
        const preview = document.createElement("img");
        preview.className = "attachment-card-image";
        preview.src = attachment.previewUrl;
        preview.alt = attachment.name;
        card.append(preview);
      } else {
        const documentIcon = document.createElement("span");
        documentIcon.className = "attachment-card-file-icon";
        documentIcon.textContent = "TXT";
        card.append(documentIcon);
      }
      const details = document.createElement("span");
      details.className = "attachment-card-details";
      const name = document.createElement("span");
      name.className = "attachment-card-name";
      name.textContent = attachment.name;
      const size = document.createElement("span");
      size.className = "attachment-card-size";
      size.textContent = formatFileSize(attachment.size || 0);
      details.append(name, size);
      const remove = document.createElement("button");
      remove.className = "remove-attachment";
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${attachment.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        selectedAttachments.splice(index, 1);
        renderAttachmentTray();
      });
      card.append(details, remove);
      attachmentTray.append(card);
    });
  }

  function clearSelectedAttachments() {
    attachmentGeneration += 1;
    selectedAttachments = [];
    processingAttachments = false;
    cameraInput.value = "";
    filesInput.value = "";
    if (attachmentTray) renderAttachmentTray();
    if (cameraButton && filesButton) updateAttachmentControls();
  }

  function updateAttachmentControls() {
    const disabled = sending || processingAttachments;
    cameraButton.disabled = disabled;
    filesButton.disabled = disabled;
    micButton.disabled = disabled;
    sendButton.disabled = disabled;
  }

  function openImageViewer(src, name) {
    if (!src) return;
    imageViewerImage.src = src;
    imageViewerImage.alt = name || "Attached photo";
    imageViewerCaption.textContent = name || "Attached photo";
    imageViewer.hidden = false;
    closeImageViewerButton.focus({ preventScroll: true });
  }

  function closeImageViewer() {
    if (!imageViewer || imageViewer.hidden) return;
    imageViewer.hidden = true;
    imageViewerImage.removeAttribute("src");
    imageViewerImage.alt = "";
    imageViewerCaption.textContent = "";
  }

  closeImageViewerButton.addEventListener("click", closeImageViewer);
  imageViewer.addEventListener("click", (event) => {
    if (event.target === imageViewer) closeImageViewer();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeImageViewer();
  });

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read that photo."));
      reader.readAsDataURL(blob);
    });
  }

  async function decodeImageFile(file) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(file);
      } catch {
        // Fall back to the browser's image decoder for formats it supports.
      }
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("This photo format could not be opened on this phone."));
        image.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function canvasToJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare that photo.")), "image/jpeg", quality);
    });
  }

  async function prepareImage(file) {
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error("Choose a photo smaller than 24 MB.");
    const source = await decodeImageFile(file);
    const sourceWidth = source.width || source.naturalWidth;
    const sourceHeight = source.height || source.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("This photo could not be decoded.");

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Photo processing is not available in this browser.");
    let scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
    let quality = 0.84;
    let blob = null;
    try {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        blob = await canvasToJpeg(canvas, quality);
        if (blob.size <= MAX_COMPRESSED_IMAGE_BYTES) break;
        if (quality > 0.62) quality -= 0.08;
        else scale *= 0.82;
      }
    } finally {
      if (typeof source.close === "function") source.close();
      canvas.width = 1;
      canvas.height = 1;
    }
    if (!blob || blob.size > MAX_COMPRESSED_IMAGE_BYTES) throw new Error("Photo is too detailed to upload. Choose a smaller image.");
    const dataUrl = await blobToDataUrl(blob);
    return { type: "image", name: file.name, mimeType: "image/jpeg", dataUrl, previewUrl: dataUrl, size: blob.size };
  }

  function isSupportedTextFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    return TEXT_FILE_EXTENSIONS.has(extension) || file.type.startsWith("text/") || file.type === "application/json";
  }

  async function prepareTextFile(file) {
    if (!isSupportedTextFile(file)) throw new Error("Use a photo or a text file such as TXT, MD, CSV, JSON, or source code.");
    if (file.size > MAX_TEXT_FILE_BYTES) throw new Error("Text files must be smaller than 180 KB.");
    const text = await file.text();
    if (!text.trim() || text.includes("\u0000")) throw new Error("That file has no readable text.");
    if (text.length > MAX_TEXT_FILE_CHARS) throw new Error("Text files are limited to 60,000 characters.");
    return { type: "text", name: file.name, text, size: file.size };
  }

  async function handleSelectedFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (!token || assistantScreen.hidden) {
      cameraInput.value = "";
      filesInput.value = "";
      return;
    }
    const generation = attachmentGeneration;
    const available = MAX_SELECTED_ATTACHMENTS - selectedAttachments.length;
    if (available <= 0) {
      showToast("You can attach up to 4 photos or files per message.");
      cameraInput.value = "";
      filesInput.value = "";
      return;
    }
    if (files.length > available) showToast("Only the first available files were added; the limit is 4.");
    processingAttachments = true;
    updateAttachmentControls();
    try {
      for (const file of files.slice(0, available)) {
        if (generation !== attachmentGeneration) break;
        try {
          const attachment = file.type.startsWith("image/")
            ? await prepareImage(file)
            : await prepareTextFile(file);
          if (generation !== attachmentGeneration) break;
          if (attachment.type === "text") {
            const currentFileChars = selectedAttachments
              .filter((item) => item.type === "text")
              .reduce((total, item) => total + item.text.length, 0);
            if (currentFileChars + attachment.text.length > MAX_TOTAL_TEXT_FILE_CHARS) {
              throw new Error("Text attachments are limited to 120,000 characters per message.");
            }
          }
          selectedAttachments.push(attachment);
          renderAttachmentTray();
        } catch (error) {
          if (generation === attachmentGeneration) showToast(`${file.name}: ${error.message || "This file could not be added."}`);
        }
      }
    } finally {
      if (generation === attachmentGeneration) {
        processingAttachments = false;
        updateAttachmentControls();
        cameraInput.value = "";
        filesInput.value = "";
      }
    }
  }

  cameraButton.addEventListener("click", () => {
    if (!sending && !processingAttachments) cameraInput.click();
  });
  filesButton.addEventListener("click", () => {
    if (!sending && !processingAttachments) filesInput.click();
  });
  cameraInput.addEventListener("change", () => handleSelectedFiles(cameraInput.files));
  filesInput.addEventListener("change", () => handleSelectedFiles(filesInput.files));

  function setSending(value) {
    sending = value;
    messageInput.disabled = value;
    typingIndicator.hidden = !value;
    updateAttachmentControls();
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

  function promptForAttachments(attachments) {
    const hasImages = attachments.some((attachment) => attachment.type === "image");
    const hasFiles = attachments.some((attachment) => attachment.type === "text");
    if (hasImages && hasFiles) return "Please analyze the attached photo(s) and read the attached file(s).";
    if (hasImages) return "Please analyze the attached photo(s). Describe what you see and read any visible text.";
    return "Please read and analyze the attached file(s).";
  }

  async function sendMessage(rawText) {
    const attachments = selectedAttachments.map((attachment) => ({ ...attachment }));
    const text = rawText.trim() || (attachments.length ? promptForAttachments(attachments) : "");
    if (!text || sending || processingAttachments || !token) return;
    if (text.length > 6_000) {
      showToast("Keep each message under 6,000 characters.");
      return;
    }

    const attachmentNames = attachments.map(({ name, type }) => ({ name, type }));
    history.push({ role: "user", text, attachmentNames });
    saveHistory();
    makeMessage({ role: "user", text, attachments, attachmentNames });
    messageInput.value = "";
    messageInput.style.height = "auto";
    updateCharacterCount();
    selectedAttachments = [];
    renderAttachmentTray();
    setSending(true);

    try {
      const messages = makeApiContext();
      if (attachments.length && messages.length) {
        messages[messages.length - 1].attachments = attachments.map((attachment) => attachment.type === "image"
          ? { type: "image", name: attachment.name, mimeType: attachment.mimeType, dataUrl: attachment.dataUrl }
          : { type: "text", name: attachment.name, text: attachment.text });
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
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
    if (speakReplies) showToast("Legendboy will read new replies aloud.");
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
