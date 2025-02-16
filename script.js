const socket = io("http://localhost:3000");

let username = "";
let gameId = "";
let symbol = "";
let isMyTurn = false;

function setUsername() {
    username = document.getElementById("username-input").value.trim();
    if (username !== "") {
        document.getElementById("username-container").style.display = "none";
        document.getElementById("lobby-container").style.display = "block";
        document.getElementById("lobby-username").innerText = username;
        socket.emit("set_username", username);
    }
}

function createGame() {
    socket.emit("create_game");
}

socket.on("game_created", (data) => {
    gameId = data.gameId;
    enterGame();
    document.getElementById("game-code-display").innerText = gameId;
});

function joinGame() {
    const enteredCode = document.getElementById("game-code-input").value.trim();
    if (enteredCode !== "") {
        socket.emit("join_game", enteredCode);
    }
}

socket.on("game_joined", (data) => {
    gameId = data.gameId;
    enterGame();
    document.getElementById("game-code-display").innerText = gameId;
});

socket.on("invalid_game", () => {
    alert("Invalid game code! Please try again.");
});

function enterGame() {
    document.getElementById("lobby-container").style.display = "none";
    document.getElementById("game-container").style.display = "block";
}

function exitLobby() {
    document.getElementById("lobby-container").style.display = "none";
    document.getElementById("username-container").style.display = "block";
    socket.emit("exit_lobby");
}

function returnToLobby() {
    document.getElementById("game-container").style.display = "none";
    document.getElementById("lobby-container").style.display = "block";
    socket.emit("return_to_lobby", gameId);
}

socket.on("game_start", (data) => {
    gameId = data.gameId;
    symbol = data.symbol;
    isMyTurn = symbol === "X";

    document.getElementById("game-status").innerText = `Playing against ${data.opponent}`;
    document.getElementById("rematch-btn").style.display = "none";

    updateTurnInfo();
    clearBoard();
});

function makeMove(index) {
    if (isMyTurn) {
        const cells = document.querySelectorAll(".cell");
        if (!cells[index].innerText) {
            socket.emit("make_move", { gameId, index });
        }
    }
}


socket.on("update_board", (board) => {
    const cells = document.querySelectorAll(".cell");
    board.forEach((val, i) => {
        cells[i].innerText = val || "";
    });

    isMyTurn = !isMyTurn;
    updateTurnInfo();
});

socket.on("game_over", ({ winner, board }) => {
    board.forEach((val, i) => {
        document.querySelectorAll(".cell")[i].innerText = val || "";
    });

    document.getElementById("game-status").innerText = winner === "draw" ? "It's a draw!" : `${winner} wins!`;
    isMyTurn = false; // Stop moves
    document.getElementById("rematch-btn").style.display = "block";
});

function sendMessage() {
    let message = document.getElementById("chat-input").value.trim();
    if (message !== "") {
        socket.emit("lobby_chat_message", { username, message });
        document.getElementById("chat-input").value = "";
    }
}

function sendGameMessage() {
    let message = document.getElementById("game-chat-input").value.trim();
    if (message !== "") {
        socket.emit("game_chat_message", { gameId, username, message });
        document.getElementById("game-chat-input").value = "";
    }
}

document.getElementById("chat-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") sendMessage();
});

document.getElementById("game-chat-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") sendGameMessage();
});

socket.on("receive_lobby_chat_message", ({ username, message }) => {
    let chatBox = document.getElementById("chat-box");
    let msgElement = document.createElement("p");
    msgElement.innerText = `${username}: ${message}`;
    chatBox.appendChild(msgElement);
    msgElement.scrollIntoView({ behavior: "smooth" });
});

socket.on("receive_game_chat_message", ({ username, message }) => {
    let chatBox = document.getElementById("game-chat-box");
    let msgElement = document.createElement("p");
    msgElement.innerText = `${username}: ${message}`;
    chatBox.appendChild(msgElement);
    msgElement.scrollIntoView({ behavior: "smooth" });
});

function requestRematch() {
    socket.emit("rematch_request", gameId);
    document.getElementById("rematch-btn").innerText = "Waiting for opponent...";
    document.getElementById("rematch-btn").disabled = true;
}

socket.on("rematch_start", () => {
    document.getElementById("rematch-btn").style.display = "none";
    document.getElementById("rematch-btn").innerText = "Rematch";
    document.getElementById("rematch-btn").disabled = false;

    document.getElementById("game-status").innerText = "New Game Started!";
    clearBoard();

    isMyTurn = symbol === "X";
    updateTurnInfo();
});

function exitGame() {
    socket.emit("exit_game", gameId);
    resetToUsernameScreen();
}

socket.on("opponent_exited", () => {
    document.getElementById("game-status").innerText = "Your opponent left. You win!";
    document.getElementById("rematch-btn").style.display = "none";
});

function resetToUsernameScreen() {
    document.getElementById("game-container").style.display = "none";
    document.getElementById("lobby-container").style.display = "none";
    document.getElementById("username-container").style.display = "block";
}

function updateTurnInfo() {
    document.getElementById("turn-info").innerText = isMyTurn
        ? "Your turn!"
        : "Waiting for opponent...";
}

function clearBoard() {
    document.querySelectorAll(".cell").forEach(cell => cell.innerText = "");
}
