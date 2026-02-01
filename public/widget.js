(function () {
  function createWidget(opts) {
    const { botId, apiHost, primaryColor = "#111827", position = "bottom-right" } = opts || {};
    if (!botId || !apiHost) {
      console.error("NextGenVirtuAI widget: botId and apiHost are required");
      return;
    }

    const root = document.createElement("div");
    root.id = "ngva-widget-root";
    document.body.appendChild(root);

    const style = document.createElement("style");
    style.innerHTML = `
      #ngva-widget-root{position:fixed;z-index:999999;font-family:ui-sans-serif,system-ui,Arial;}
      #ngva-btn{width:56px;height:56px;border-radius:999px;border:0;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2);background:${primaryColor};color:#fff;font-size:22px}
      #ngva-panel{width:340px;height:460px;background:#fff;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.22);overflow:hidden;display:none;flex-direction:column}
      #ngva-head{padding:12px 14px;background:${primaryColor};color:#fff;font-weight:700;display:flex;justify-content:space-between;align-items:center}
      #ngva-close{background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer}
      #ngva-msgs{flex:1;padding:12px;overflow:auto;background:#f8fafc}
      .ngva-row{margin:10px 0;display:flex}
      .ngva-user{justify-content:flex-end}
      .ngva-bot{justify-content:flex-start}
      .ngva-bub{max-width:78%;padding:10px 12px;border-radius:14px;white-space:pre-wrap;font-size:14px;line-height:1.35}
      .ngva-user .ngva-bub{background:${primaryColor};color:#fff;border-bottom-right-radius:6px}
      .ngva-bot .ngva-bub{background:#fff;border:1px solid #e5e7eb;color:#111827;border-bottom-left-radius:6px}
      #ngva-foot{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}
      #ngva-in{flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:10px;outline:none}
      #ngva-send{padding:10px 12px;border:0;border-radius:10px;background:${primaryColor};color:#fff;cursor:pointer}
      #ngva-note{padding:8px 12px;font-size:12px;color:#6b7280;background:#fff;border-top:1px solid #f3f4f6}
    `;
    document.head.appendChild(style);

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "10px";

    const posMap = {
      "bottom-right": { right: "18px", bottom: "18px" },
      "bottom-left": { left: "18px", bottom: "18px" },
      "top-right": { right: "18px", top: "18px" },
      "top-left": { left: "18px", top: "18px" },
    };
    Object.assign(root.style, posMap[position] || posMap["bottom-right"]);

    const btn = document.createElement("button");
    btn.id = "ngva-btn";
    btn.innerHTML = "💬";

    const panel = document.createElement("div");
    panel.id = "ngva-panel";

    panel.innerHTML = `
      <div id="ngva-head">
        <div>Chat</div>
        <button id="ngva-close" aria-label="Close">✕</button>
      </div>
      <div id="ngva-msgs"></div>
      <div id="ngva-foot">
        <input id="ngva-in" placeholder="Type a message..." />
        <button id="ngva-send">Send</button>
      </div>
      <div id="ngva-note">Powered by NextGenVirtuAI</div>
    `;

    wrap.appendChild(panel);
    wrap.appendChild(btn);
    root.appendChild(wrap);

    const msgs = panel.querySelector("#ngva-msgs");
    const input = panel.querySelector("#ngva-in");
    const sendBtn = panel.querySelector("#ngva-send");
    const closeBtn = panel.querySelector("#ngva-close");

    const sessionId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());

    function add(role, text) {
      const row = document.createElement("div");
      row.className = "ngva-row " + (role === "user" ? "ngva-user" : "ngva-bot");
      const bub = document.createElement("div");
      bub.className = "ngva-bub";
      bub.textContent = text;
      row.appendChild(bub);
      msgs.appendChild(row);
      msgs.scrollTop = msgs.scrollHeight;
    }

    async function send() {
      const text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      add("user", text);

      try {
        // PUBLIC widget endpoint (we will build next)
        const res = await fetch(`${apiHost}/api/widget/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botId, message: text, sessionId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Chat failed");
        add("assistant", json.reply || "");
      } catch (e) {
        add("assistant", "Sorry — something went wrong. Please try again.");
      }
    }

    btn.onclick = () => {
      panel.style.display = "flex";
      btn.style.display = "none";
    };
    closeBtn.onclick = () => {
      panel.style.display = "none";
      btn.style.display = "inline-flex";
    };
    sendBtn.onclick = send;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });

    add("assistant", "Hi! How can I help you today?");
  }

  window.NextGenVirtuAIWidget = { init: createWidget };
})();
