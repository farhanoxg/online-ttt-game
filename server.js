const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

app.get('/', (req, res) => {
    const error = req.query.error;
    res.render('index', { error });
});

app.get('/game', (req, res) => {
    const { name, room } = req.query;

    if (rooms[room] && rooms[room].players.length >= 2) {
        return res.redirect(`/?error=Room+${room}+is+full`);
    }

    if (!rooms[room]) {
        rooms[room] = {
            players: [],
            board: Array(9).fill(null),
            currentPlayer: 'X',
            lastWinner: null,
            playerXWins: 0,
            playerOWins: 0
        };
    }

    res.render('game', { name, room });
});

function checkWinner(board) {
    const winConditions = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const [a, b, c] of winConditions) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function handleUserLeave(socket, room) {
    return () => {
        const roomState = rooms[room];
        if (roomState) {
            const leavingPlayer = roomState.players.find(player => player.id === socket.id);
            roomState.players = roomState.players.filter(player => player.id !== socket.id);
            socket.leave(room);

            if (leavingPlayer) {
                io.to(room).emit('userLeft', leavingPlayer.name);
            }

            if (roomState.players.length === 0) {
                delete rooms[room];
            }
        }
    };
}

io.on('connection', (socket) => {
    // console.log('New user connected');

    socket.on('joinRoom', ({ name, room }) => {
        if (rooms[room] && rooms[room].players.length >= 2) {
            socket.emit('roomFull');
            return;
        }

        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = {
                players: [],
                board: Array(9).fill(null),
                currentPlayer: 'X',
                lastWinner: null,
                playerXWins: 0,
                playerOWins: 0
            };
        }

        const playerSymbol = rooms[room].players.length === 0 ? 'X' : 'O';
        rooms[room].players.push({ name, id: socket.id, symbol: playerSymbol });
        // console.log(`${name} has joined room ${room}`);

        if (rooms[room].players.length === 1) {
            socket.emit('waitingForOpponent');
        } else if (rooms[room].players.length === 2) {
            const startingPlayer = rooms[room].lastWinner || 'X';
            io.to(room).emit('startGame', { players: rooms[room].players, startingPlayer });
        }

        socket.to(room).emit('message', `${name} has joined the room`);

        socket.on('move', ({ index, value }) => {
            const roomState = rooms[room];
            if (roomState.board[index] === null && roomState.players.length === 2 && roomState.currentPlayer === value) {
                roomState.board[index] = value;
                const winner = checkWinner(roomState.board);
                if (winner) {
                    if (winner === 'X') {
                        roomState.playerXWins += 1;
                    } else {
                        roomState.playerOWins += 1;
                    }
                    io.to(room).emit('move', { index, value }); 
                    io.to(room).emit('gameEnd', {
                        winner,
                        playerXName: roomState.players.find(player => player.symbol === 'X').name,
                        playerOName: roomState.players.find(player => player.symbol === 'O').name ,
                        playerXWins: roomState.playerXWins,
                        playerOWins: roomState.playerOWins
                    });
                    roomState.lastWinner = winner;
                    roomState.board = Array(9).fill(null); 
                } else if (!roomState.board.includes(null)) {
                    io.to(room).emit('move', { index, value }); 
                    io.to(room).emit('gameEnd', {
                        winner: 'Draw',
                        playerXName: roomState.players.find(player => player.symbol === 'X').name,
                        playerOName: roomState.players.find(player => player.symbol === 'O').name,
                        playerXWins: roomState.playerXWins,
                        playerOWins: roomState.playerOWins
                    });
                    roomState.board = Array(9).fill(null); 
                } else {
                    roomState.currentPlayer = roomState.currentPlayer === 'X' ? 'O' : 'X';
                    io.to(room).emit('move', { index, value });
                    io.to(room).emit('updateTurn', { currentPlayer: roomState.currentPlayer });
                }
            }
        });

        socket.on('reset', () => {
            const roomState = rooms[room];
            if (roomState) {
                roomState.board = Array(9).fill(null);
                const startingPlayer = roomState.lastWinner || 'X';
                roomState.currentPlayer = startingPlayer;
                io.to(room).emit('reset');
                io.to(room).emit('updateTurn', { currentPlayer: startingPlayer });
            }
        });

        socket.on('leaveRoom', ({ name, room }) => {
            // console.log(`${name} has left room ${room}`);
            handleUserLeave(socket, room)();
        });

        socket.on('disconnect', handleUserLeave(socket, room));
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
