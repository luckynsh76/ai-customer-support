(function(){

const chat = document.createElement("div")

chat.innerHTML = `
<div id="ai-widget">
<div id="ai-header">StoicCode AI Assistant</div>
<div id="ai-messages"></div>

<div id="ai-input">
<input id="ai-text" placeholder="Ask about menu or hours..." />
<button id="ai-send">Send</button>
</div>
</div>
`

document.body.appendChild(chat)

const style = document.createElement("style")

style.innerHTML = `
#ai-widget{
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

#ai-header{
background:#222;
color:white;
padding:12px;
font-weight:bold;
}

#ai-messages{
height:280px;
overflow:auto;
padding:10px;
}

#ai-input{
display:flex;
border-top:1px solid #eee;
}

#ai-input input{
flex:1;
padding:10px;
border:none;
}

#ai-input button{
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

.bot{
text-align:left;
margin-bottom:8px;
}
`

document.head.appendChild(style)

const input = document.getElementById("ai-text")
const button = document.getElementById("ai-send")
const messages = document.getElementById("ai-messages")

button.onclick = send

async function send(){

const text = input.value
if(!text) return

messages.innerHTML += `<div class="user">${text}</div>`

input.value=""

const res = await fetch("https://ai-customer-support-jbrt.onrender.com/chat", {
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