import { network } from "./network.js";

const joinForm = document.getElementById("join-form");
const nameInput = document.getElementById("name-input");
const joinBtn = document.getElementById("join-btn");
const lobbyInfo = document.getElementById("lobby-info");
const playerList = document.getElementById("player-list");
const playerCount = document.getElementById("player-count");
const startBtn = document.getElementById("start-btn");
const waitingMsg = document.getElementById("waiting-msg");
const errorMsg = document.getElementById("error-msg");

let joined = false;
const STORAGE_KEY = "snowball-fight-name";

export function initLobby(onGameStart) {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) nameInput.value = saved;

  joinBtn.addEventListener("click", () => doJoin());
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doJoin();
  });

  startBtn.addEventListener("click", () => {
    network.emit("start-game");
  });

  network.on("lobby-update", ({ players, hostId, phase }) => {
    if (phase !== "lobby") return;

    playerList.innerHTML = "";
    players.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p.name;
      if (p.id === hostId) li.classList.add("host");
      playerList.appendChild(li);
    });

    playerCount.textContent = `${players.length} player${players.length !== 1 ? "s" : ""} in lobby`;

    const isHost = network.id === hostId;
    startBtn.classList.toggle("hidden", !isHost);
    waitingMsg.classList.toggle("hidden", isHost);
    startBtn.disabled = players.length < 2;
  });

  network.on("game-start", (data) => {
    onGameStart(data);
  });

  network.on("error-msg", ({ message }) => {
    errorMsg.textContent = message;
    errorMsg.classList.remove("hidden");
    setTimeout(() => errorMsg.classList.add("hidden"), 3000);
  });

  nameInput.focus();
}

function doJoin() {
  if (joined) return;
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  joined = true;
  localStorage.setItem(STORAGE_KEY, name);
  network.emit("join", { name });
  joinForm.classList.add("hidden");
  lobbyInfo.classList.remove("hidden");
}

export function showLobby() {
  joined = false;
  errorMsg.classList.add("hidden");
  joinForm.classList.remove("hidden");
  lobbyInfo.classList.add("hidden");
  const saved = localStorage.getItem(STORAGE_KEY);
  nameInput.value = saved || "";
  nameInput.focus();
}
