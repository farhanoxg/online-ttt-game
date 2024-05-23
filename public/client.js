function setupGame(socket, isPlayerX, startingPlayer) {
    let currentPlayer = startingPlayer || 'X';
    const mySymbol = isPlayerX ? 'X' : 'O';
    const board = document.getElementById('board');
    const cells = document.querySelectorAll('.cell');
    const turnIndicator = document.getElementById('turn-indicator');

    const playerXCounter = document.getElementById('playerXCounter');
    const playerOCounter = document.getElementById('playerOCounter');

    function updateBoard() {
        cells.forEach(cell => {
            if (cell.textContent) {
                cell.classList.add('disabled');
            } else {
                cell.classList.remove('disabled');
                if (currentPlayer !== mySymbol) {
                    cell.classList.add('disabled');
                }
            }
        });
    }

    function disableBoard() {
        cells.forEach(cell => {
            cell.classList.add('disabled');
        });
    }

    function displayTurn() {
        turnIndicator.textContent = `${currentPlayer}'s turn`;
    }

    board.addEventListener('click', (e) => {
        if (currentPlayer === mySymbol && e.target.classList.contains('cell') && !e.target.textContent) {
            const index = e.target.getAttribute('data-index');
            socket.emit('move', { index, value: mySymbol });
        }
    });

    socket.on('move', (data) => {
        cells[data.index].textContent = data.value;
        updateBoard();
    });

    socket.on('updateTurn', (data) => {
        currentPlayer = data.currentPlayer;
        displayTurn();
        updateBoard();
    });

    socket.on('gameEnd', ({ winner, playerXName, playerOName, playerXWins, playerOWins }) => {
        if (winner === 'Draw') {
            turnIndicator.textContent = 'Draw!';
        } else {
            turnIndicator.textContent = `${winner} wins! ✌️`;
        }
        playerXCounter.textContent = `${playerXName} playing as X: ${playerXWins} wins`;
        playerOCounter.textContent = `${playerOName} playing as O: ${playerOWins} wins`;

        disableBoard();
    });

    socket.on('reset', () => {
        cells.forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('disabled');
        });
        currentPlayer = startingPlayer || 'X';
        displayTurn();
        updateBoard();
    });

    displayTurn();
    updateBoard();
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name');
    const room = urlParams.get('room');

    const socket = io();

    socket.emit('joinRoom', { name, room });

    socket.on('roomFull', () => {
        alert('Room is full');
        window.location.href = '/';
    });

    socket.on('waitingForOpponent', () => {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('board').style.display = 'none';
        document.getElementById('reset-game').style.display = 'none';
    });

    socket.on('startGame', ({ players, startingPlayer }) => {
        const playerX = players.find(player => player.symbol === 'X');
        const playerO = players.find(player => player.symbol === 'O');

        const isPlayerX = playerX.id === socket.id;
        document.getElementById('loading').style.display = 'none';
        document.getElementById('board').style.display = 'grid';
        document.getElementById('reset-game').style.display = 'block';

        document.getElementById('playerXCounter').textContent = `${playerX.name} playing as X: 0 wins`;
        document.getElementById('playerOCounter').textContent = `${playerO.name} playing as O: 0 wins`;
        document.getElementById('counters').style.display = 'flex';
        document.getElementById('counters').style.gap = '70px';

        setupGame(socket, isPlayerX, startingPlayer);
    });

    socket.on('userLeft', (userName) => {
        alert(`${userName} has left the room.`);
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    });

    document.getElementById('leave-room').addEventListener('click', () => {
        socket.emit('leaveRoom', { name, room });
        window.location.href = '/';
    });

    document.getElementById('reset-game').addEventListener('click', () => {
        socket.emit('reset');
    });

    socket.on('message', (message) => {
        // console.log(message);
    });
});
