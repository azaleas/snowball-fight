import { network } from "./network.js";
import { initLobby, showLobby } from "./lobby.js";
import { initGame, cleanup } from "./game.js";
import { trackStateEvent } from "./perf-overlay.js";

const screens = {
  lobby: document.getElementById("lobby-screen"),
  game: document.getElementById("game-screen"),
  results: document.getElementById("results-screen"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// Results screen elements
const winnerTitle = document.getElementById("winner-title");
const resultsStats = document.getElementById("results-stats");
const playAgainBtn = document.getElementById("play-again-btn");
const resultsWaiting = document.getElementById("results-waiting");

// Beforeunload warning during active game
let inGame = false;
window.addEventListener("beforeunload", (e) => {
  if (inGame) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// Init lobby
initLobby((data) => {
  inGame = true;
  showScreen("game");
  initGame(data, showResults);
});

// Kicked by host
network.on("kicked", () => {
  if (inGame) cleanup();
  inGame = false;
  showScreen("lobby");
  showLobby();
  alert("You were kicked by the host.");
});

// Host left during game — return everyone to lobby and auto-rejoin
network.on("host-left", () => {
  if (inGame) cleanup();
  inGame = false;
  showScreen("lobby");
  showLobby(true);
});

// Safety net: if we receive lobby-update while not in lobby, return to lobby
network.on("lobby-update", ({ phase }) => {
  if (phase !== "lobby") return;
  const onLobby = screens.lobby.classList.contains("active");
  if (onLobby) return;

  if (inGame) cleanup();
  inGame = false;
  showScreen("lobby");
  showLobby(true);
});

// Late join — player joined while game in progress, spectate until next round
let isLateJoiner = false;
network.on("late-join", (data) => {
  isLateJoiner = true;
  inGame = true;
  showScreen("game");
  initGame({ ...data, players: [], lateJoin: true }, (result) => {
    // Late joiners skip results and go straight to lobby for next game
    isLateJoiner = false;
    inGame = false;
    cleanup();
    showScreen("lobby");
    showLobby(true);
  });
});

function showResults(result) {
  inGame = false;
  showScreen("results");

  const iWon = myTeam === result.winningTeam;
  winnerTitle.textContent = iWon
    ? `Victory! ${result.winningTeamName} Wins!`
    : `Defeat! ${result.winningTeamName} Wins`;
  winnerTitle.style.color = iWon ? "#16a34a" : "#dc2626";

  function statLine(id, text) {
    const isMe = id === network.id;
    return `<div class="stat-line${isMe ? " stat-me" : ""}">${text}${isMe ? " (you)" : ""}</div>`;
  }

  let statsHTML = "";

  if (result.stats.firstBlood) {
    statsHTML += `<h3>First Blood</h3>`;
    statsHTML += statLine(result.stats.firstBlood, getPlayerName(result.stats.firstBlood));
  }

  statsHTML += "<h3>Eliminations</h3>";
  const elims = Object.entries(result.stats.eliminations || {})
    .sort((a, b) => b[1] - a[1]);
  if (elims.length) {
    for (const [id, count] of elims) {
      statsHTML += statLine(id, `${getPlayerName(id)}: ${count} elimination${count !== 1 ? "s" : ""}`);
    }
  } else {
    statsHTML += `<div class="stat-line">No eliminations recorded</div>`;
  }

  statsHTML += "<h3>Hits</h3>";
  const hits = Object.entries(result.stats.hits || {})
    .sort((a, b) => b[1] - a[1]);
  if (hits.length) {
    for (const [id, count] of hits) {
      statsHTML += statLine(id, `${getPlayerName(id)}: ${count} hit${count !== 1 ? "s" : ""}`);
    }
  }

  resultsStats.innerHTML = statsHTML;

  // Show play again based on host status
  network.on("lobby-update", handleLobbyFromResults);
  playAgainBtn.classList.add("hidden");
  resultsWaiting.classList.add("hidden");

  // Check if we're the host
  setTimeout(() => {
    playAgainBtn.onclick = () => {
      network.emit("play-again");
    };
    // We'll know from lobby-update if we're host, but for now show both
    playAgainBtn.classList.remove("hidden");
    resultsWaiting.classList.remove("hidden");
  }, 500);
}

function handleLobbyFromResults({ players, hostId, phase }) {
  if (phase === "lobby") {
    network.socket.off("lobby-update", handleLobbyFromResults);
    showScreen("lobby");
    showLobby(true);
    return;
  }
  const isHost = network.id === hostId;
  playAgainBtn.classList.toggle("hidden", !isHost);
  resultsWaiting.classList.toggle("hidden", isHost);
}

// Track player names and team from game state for results
let playerNames = {};
let myTeam = null;
network.on("state", (state) => {
  trackStateEvent();
  for (const p of state.players) {
    playerNames[p.id] = p.name;
  }
});
network.on("game-start", (data) => {
  for (const p of data.players) {
    playerNames[p.id] = p.name;
    if (p.id === network.id) myTeam = p.team;
  }
});

function getPlayerName(id) {
  return playerNames[id] || "Unknown";
}
