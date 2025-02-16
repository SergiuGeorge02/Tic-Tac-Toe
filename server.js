const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const PORT = 3000;

let players = [];
let games = {};

function generateGameCode() {
    return Math.floor(10000 + Math.random() * 90000).toString();
}

function checkWinner(board) {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8], 
        [0, 4, 8], [2, 4, 6]          
    ];

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; 
        }
    }

    return board.includes(null) ? null : "draw"; 
}

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("set_username", (username) => {
        players.push({ id: socket.id, username });
    });

    socket.on("create_game", () => {
        let gameId = generateGameCode();
        games[gameId] = {
            player1: { id: socket.id, username: players.find(p => p.id === socket.id)?.username },
            player2: null,
            board: Array(9).fill(null),
            turn: socket.id,
            rematchRequests: 0
        };

        socket.join(gameId);
        socket.emit("game_created", { gameId });
    });

    socket.on("join_game", (gameId) => {
        if (games[gameId] && !games[gameId].player2) {
            let player2 = { id: socket.id, username: players.find(p => p.id === socket.id)?.username };
            games[gameId].player2 = player2;
            socket.join(gameId);
            io.to(gameId).emit("game_joined", { gameId });

            io.to(games[gameId].player1.id).emit("game_start", { gameId, opponent: player2.username, symbol: "X" });
            io.to(player2.id).emit("game_start", { gameId, opponent: games[gameId].player1.username, symbol: "O" });
        } else {
            socket.emit("invalid_game");
        }
    });

    socket.on("make_move", ({ gameId, index }) => {
        let game = games[gameId];

        if (game && game.turn === socket.id && game.board[index] === null) {
            let symbol = game.turn === game.player1.id ? "X" : "O";
            game.board[index] = symbol; 
            game.turn = game.turn === game.player1.id ? game.player2.id : game.player1.id; 

            let result = checkWinner(game.board);
            if (result) {
                io.to(gameId).emit("game_over", { winner: result, board: game.board });
                game.rematchRequests = 0;
            } else {
                io.to(gameId).emit("update_board", game.board); 
            }
        }
    });

    socket.on("lobby_chat_message", ({ username, message }) => {
        io.emit("receive_lobby_chat_message", { username, message }); 
    });

    socket.on("game_chat_message", ({ gameId, username, message }) => {
        if (games[gameId]) {
            io.to(gameId).emit("receive_game_chat_message", { username, message }); 
        }
    });

    socket.on("return_to_lobby", (gameId) => {
        if (games[gameId]) {
            console.log(`Player ${socket.id} returned to the lobby from game ${gameId}`);
        }
    });

    socket.on("rematch_request", (gameId) => {
        let game = games[gameId];

        if (game) {
            game.rematchRequests++;

            if (game.rematchRequests === 2) { 
                game.board = Array(9).fill(null);
                game.turn = game.player1.id; 
                game.rematchRequests = 0;
                io.to(gameId).emit("rematch_start");
            }
        }
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);

        players = players.filter(p => p.id !== socket.id);

        Object.keys(games).forEach(gameId => {
            let game = games[gameId];
            if (game && (game.player1.id === socket.id || (game.player2 && game.player2.id === socket.id))) {
                let remainingPlayer = game.player1.id === socket.id ? game.player2?.id : game.player1.id;
                if (remainingPlayer) {
                    io.to(remainingPlayer).emit("opponent_exited"); 
                }
                delete games[gameId]; 
            }
        });
    });

    socket.on("exit_game", (gameId) => {
        let game = games[gameId];
        if (game) {
            let remainingPlayer = game.player1.id === socket.id ? game.player2?.id : game.player1.id;
            if (remainingPlayer) {
                io.to(remainingPlayer).emit("opponent_exited");
            }
            delete games[gameId]; y
        }
    });

    socket.on("exit_lobby", () => {
        players = players.filter(p => p.id !== socket.id);
        socket.disconnect();
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
