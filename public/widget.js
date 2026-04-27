(function () {

  const widget = document.createElement("div")

  const HOST_TO_CLIENT = {
  "stoiccode.org": "stoiccode",
  "cyberitleads.org": "cyberitleads",
  "localhost": "default"
};

function getCleanDomain() {
  let host = window.location.hostname.toLowerCase();

  if (host.startsWith("www.")) {
    host = host.replace("www.", "");
  }

  return host;
}

const SITE_CONFIG = {
  stoiccode: {
    title: "StoicCode Assistant",
    placeholder: "Ask about life, discipline, or Stoic wisdom..."
  },
  cyberitleads: {
    title: "CyberITLeads Assistant",
    placeholder: "Ask about leads, AI widgets, or growing your business..."
  },
  default: {
    title: "AI Assistant",
    placeholder: "Ask a question..."
  }
};

const domain = getCleanDomain();
const client = HOST_TO_CLIENT[domain] || "default";

const ui = SITE_CONFIG[client] || SITE_CONFIG.default;

  widget.innerHTML = `
    <div class="chat-widget">
      <div class="chat-header">${ui.title}</div>
      <div id="messages" class="chat-messages"></div>
      <div class="chat-input">
        <input id="input" placeholder="${ui.placeholder}" />
        <button id="sendBtn">Send</button>
      </div>
    </div>
  `;

  document.body.appendChild(widget)
  // Create toggle button
  const toggle = document.createElement("div")
  toggle.id = "chat-toggle"
  toggle.innerHTML = "💬"

  document.body.appendChild(toggle)

  // Toggle logic
  toggle.onclick = () => {
    widget.classList.toggle("open");
  };


  const style = document.createElement("style")

style.innerHTML = `
.chat-widget {
  position: fixed;
  bottom: 20px;
  right: 16px;

  width: 90%;
  max-width: 350px;

  height: 60vh;
  max-height: 500px;

  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);

  display: none;
  flex-direction: column;
  overflow: hidden;

  z-index: 9999;
}

.chat-widget.open {
  display: flex;
}

.chat-header{
  background:#222;
  color:white;
  padding:12px;
  font-weight:bold;
}

.chat-messages{
  height:280px;
  overflow:auto;
  padding:10px;
}

.chat-input{
  display:flex;
  border-top:1px solid #eee;
}

.chat-input input{
  flex:1;
  padding:10px;
  border:none;
}

.chat-input button{
  padding:10px;
  background:#0066ff;
  color:white;
  border:none;
  cursor:pointer;
}

.user{
  text-align:right;
  color:#0066ff;
  margin-bottom:8px;
}
.user {
  text-align: right;
  color: #0066ff;
  margin-bottom: 8px;
}

.bot {
  text-align: left;
  margin-bottom: 8px;
  color: #333;
}

.product {
  background: #f5f5f5;
  padding: 10px;
  margin-top: 10px;
  border-radius: 8px;
}

.buy-btn:hover {
background: #333;
}

@media (max-width: 768px) {
  .chat-widget {
    width: 92%;
    max-width: 320px;

    height: 55vh;

    bottom: 12px;
    right: 8px;
  }
}

  .chat-messages {
    height: calc(70vh - 100px);
  }
}

.product {
  transition: 0.2s ease;
}

.product:hover {
  transform: scale(1.02);
}

.product-card {
  background: #111;
  border: 1px solid #333;
  padding: 14px;
  margin-top: 12px;
  border-radius: 10px;
}

.product-title {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 6px;
}

.product-reason {
  font-size: 13px;
  color: #ccc;
  margin-bottom: 10px;
}

.buy-btn {
  background: #fff;
  color: #000;
  border: none;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
`

document.head.appendChild(style)

const input = document.getElementById("input")
const button = document.getElementById("sendBtn")
const messages = document.getElementById("messages")

button.onclick = send
input.addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    send()
  }
})

async function sendMessage(message, clientId) {
  const res = await fetch("https://ai-customer-support-jbrt.onrender.com/stoic-chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      clientId
    })
  })

  const data = await res.json()
  return data
}

async function send(){
  const text = input.value
  if(!text) return;

  messages.innerHTML += `<div class="user">${text}</div>`
  input.value = "";


  console.log("CLIENT VALUE:", client)

  const data = await sendMessage(text, client)
  messages.innerHTML += `<div class="bot">${data.message}</div>`


  if (client === "stoiccode") {

    // 🔵 STOIC BOOKS UI
    data.products.forEach(p => {
      messages.innerHTML += `
        <div class="product-card">
          <div class="product-title">${p.name}</div>
          <div class="product-reason">${p.reason}</div>
          <div class="product-action">
            <a href="${p.link}" target="_blank">
              <button class="buy-btn">Start Reading</button>
            </a>
          </div>
        </div>
      `;
    })

  } else if (client === "cyberitleads") {

    // 🟢 YOUR EXISTING LEAD BUTTON (KEEP THIS)
    if (!document.getElementById("leadBtn")) {
      messages.innerHTML += `
        <div style="margin-top:10px;">
          <button id="leadBtn">Get a free setup</button>
        </div>
      `

      document.getElementById("leadBtn").onclick = async () => {
        const email = prompt("Enter your email")
        if (!email) return

        await fetch("https://ai-customer-support-jbrt.onrender.com/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            message: "User clicked Get a free setup",
            client: "cyberitleads"
          })
        })

        alert("Thanks, we got your email.")
      }
    }

  } else {

    // 🟡 DEFAULT (fallback)
    if (data.products) {
      data.products.forEach(p => {
        messages.innerHTML += `
          <div class="product">
            <a href="${p.link}" target="_blank">${p.name}</a>
          </div>
        `
      })
    }

  }

  if (client === "cyberitleads" && !document.getElementById("leadBtn")) {
    messages.innerHTML += `<div style="margin-top:8px;"><button id="leadBtn">Get a free setup</button></div>`

    document.getElementById("leadBtn").onclick = async () => {
      const email = prompt("Enter your email")
      console.log("Sending lead:", email)

      if (!email) return;

      await fetch("https://ai-customer-support-jbrt.onrender.com/lead", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          message: "User clicked Get a free setup",
          client: "cyberitleads"
        })
      })

      alert("Thanks. We got your email.")
    }
  }

  messages.scrollTop = messages.scrollHeight

  }

})()