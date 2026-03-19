const roomId = window.location.pathname.split("/").pop()
document.getElementById("room").textContent = roomId

const clientId = Math.random().toString(36).substring(2)
document.getElementById("client").textContent = clientId

const roomName = ROOM_ID

const protocol = window.location.protocol === "https:" ? "wss" : "ws"
const ws = new WebSocket(`${protocol}://${window.location.host}/ws/room/${roomName}/`)

// ✅ безопасная отправка
function safeSend(data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  } else {
    console.warn("WS not ready:", data.type)
  }
}

let pc
let isInitiator = false
let localStream = null
let pendingCandidates = []
let inCall = false

const chatBox = document.getElementById("chat-box")
const startBtn = document.getElementById("start-btn")

function resetPeerConnection() {
  pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  })

  pc.onconnectionstatechange = () => {
    document.getElementById("pc-state").textContent = pc.connectionState
  }

  pc.oniceconnectionstatechange = () => {
    document.getElementById("ice-state").textContent = pc.iceConnectionState
  }

  pc.ontrack = (event) => {
    document.getElementById("remote-audio").srcObject = event.streams[0]
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      safeSend({
        type: "ice",
        sender: clientId,
        payload: event.candidate
      })
    }
  }
}

resetPeerConnection()

function addMessage(text) {
  const div = document.createElement("div")
  div.style.marginBottom = "5px"
  div.textContent = text
  chatBox.appendChild(div)
  chatBox.scrollTop = chatBox.scrollHeight
}

function showIncomingCallUI() {
  document.getElementById("incoming-call").style.display = "block"
}

function acceptCall() {
  document.getElementById("incoming-call").style.display = "none"

  inCall = true
  startBtn.textContent = "❌ End call"

  safeSend({
    type: "call_accept",
    sender: clientId
  })
}

function declineCall() {
  document.getElementById("incoming-call").style.display = "none"

  safeSend({
    type: "call_decline",
    sender: clientId
  })
}

function endCall() {
  inCall = false
  isInitiator = false

  startBtn.textContent = "📞 Start call"

  pc.close()
  resetPeerConnection()

  safeSend({
    type: "call_cancel",
    sender: clientId
  })
}

async function ensureAudio() {
  if (localStream) return

  const constraints = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 48000
    },
    video: false
  }

  localStream = await navigator.mediaDevices.getUserMedia(constraints)

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream)
  })
}

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data)

  if (data.sender === clientId) return

  if (data.type === "chat") {
    addMessage("👤 " + data.payload.message)
  }

  if (data.type === "call_request") {
    showIncomingCallUI()
  }

  if (data.type === "call_accept") {
    inCall = true
    startBtn.textContent = "❌ End call"
    start()
  }

  if (data.type === "call_decline") {
    addMessage("❌ Пользователь отклонил звонок")
    inCall = false
    startBtn.textContent = "📞 Start call"
  }

  if (data.type === "call_cancel") {
    document.getElementById("incoming-call").style.display = "none"
    addMessage("📴 Вызов отменён")

    inCall = false
    startBtn.textContent = "📞 Start call"

    pc.close()
    resetPeerConnection()
  }

  if (data.type === "offer") {
    if (isInitiator) return
    if (pc.signalingState !== "stable") return

    await ensureAudio()
    await pc.setRemoteDescription(data.payload)

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    safeSend({
      type: "answer",
      sender: clientId,
      payload: answer
    })

    pendingCandidates.forEach(c => pc.addIceCandidate(c))
    pendingCandidates = []
  }

  if (data.type === "answer") {
    if (!isInitiator) return
    if (pc.signalingState !== "have-local-offer") return

    await pc.setRemoteDescription(data.payload)

    pendingCandidates.forEach(c => pc.addIceCandidate(c))
    pendingCandidates = []
  }

  if (data.type === "ice") {
    if (pc.remoteDescription) {
      await pc.addIceCandidate(data.payload)
    } else {
      pendingCandidates.push(data.payload)
    }
  }
}

async function start() {
  isInitiator = true

  await ensureAudio()

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  safeSend({
    type: "offer",
    sender: clientId,
    payload: offer
  })
}

startBtn.onclick = () => {
  if (!inCall) {
    inCall = true
    startBtn.textContent = "❌ Cancel"

    safeSend({
      type: "call_request",
      sender: clientId
    })
  } else {
    endCall()
  }
}

document.getElementById("send-btn").onclick = () => {
  const input = document.getElementById("chat-input")
  const message = input.value.trim()

  if (!message) return

  safeSend({
    type: "chat",
    sender: clientId,
    payload: { message }
  })

  addMessage("🧠 " + message)
  input.value = ""
}

document.getElementById("chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault()
    document.getElementById("send-btn").click()
  }
})

document.getElementById("copy-link").onclick = () => {
  navigator.clipboard.writeText(window.location.href)
  alert("Ссылка скопирована, иди социализируйся")
}
