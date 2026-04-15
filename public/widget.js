(function () {

  const widget = document.createElement("div")

  widget.innerHTML = `
    <div class="chat-widget">
      <div class="chat-header">StoicCode Assistant</div>
      <div id="messages" class="chat-messages"></div>
      <div class="chat-input">
        <input id="input" placeholder="Ask about life, discipline, or Stoic wisdom..." />
        <button id="sendBtn">Send</button>
      </div>
    </div>
  `

  document.body.appendChild(widget)

  const style = document.createElement("style")

style.innerHTML = `
.chat-widget{
  position:fixed;
  bottom:20px;
  right:20px;
  width:320px;
  background:white;
  border-radius:10px;
  box-shadow:0 10px 30px rgba(0,0,0,.2);
  font-family:Arial;
  overflow:hidden;
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

async function send(){

const text = input.value
if(!text) return

messages.innerHTML += `<div class="user">${text}</div>`

input.value=""

const client = "stoiccode" // change to restaurant, law, etc.

console.log("CLIENT VALUE:", client)
console.log("FINAL URL:", `https://stoiccode-ai.onrender.com/chat?client=${client}`)

const res = await fetch(`https://stoiccode-ai.onrender.com/chat?client=${client}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-client-key": "stoiccode_main_key"
  },
  body: JSON.stringify({ message: text })
})

const data = await res.json()

messages.innerHTML += `<div class="bot">${data.reply}</div>`

messages.scrollTop = messages.scrollHeight

}

})()