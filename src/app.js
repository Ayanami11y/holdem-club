// server-side socket.io backend event handling
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const Game = require('./classes/game.js');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const PORT = process.env.PORT || 3000;

app.use('/', express.static(__dirname + '/client'));

let rooms = [];

const findGameBySocketId = (socketId) =>
  rooms.find((r) => r.findPlayer(socketId).socket.id === socketId);

const sanitizeRoomSettings = (settings) => {
  const incoming = settings || {};
  const smallBlindRaw = Number(incoming.smallBlind);
  const bigBlindRaw = Number(incoming.bigBlind);
  const startingStackRaw = Number(incoming.startingStack);
  const autoRebuyStackRaw = Number(incoming.autoRebuyStack);
  const smallBlind = Number.isFinite(smallBlindRaw)
    ? Math.max(1, Math.min(1000, Math.floor(smallBlindRaw)))
    : 1;
  const bigBlind = Number.isFinite(bigBlindRaw)
    ? Math.max(smallBlind + 1, Math.min(2000, Math.floor(bigBlindRaw)))
    : Math.max(2, smallBlind * 2);
  const minStack = bigBlind * 10;
  const startingStack = Number.isFinite(startingStackRaw)
    ? Math.max(minStack, Math.min(50000, Math.floor(startingStackRaw)))
    : 100;
  const autoRebuy =
    typeof incoming.autoRebuy === 'boolean' ? incoming.autoRebuy : true;
  const autoRebuyStack = Number.isFinite(autoRebuyStackRaw)
    ? Math.max(minStack, Math.min(50000, Math.floor(autoRebuyStackRaw)))
    : startingStack;

  return {
    blinds: { small: smallBlind, big: bigBlind },
    buyIn: {
      startingStack: startingStack,
      autoRebuy: autoRebuy,
      autoRebuyStack: autoRebuy ? autoRebuyStack : startingStack,
    },
  };
};

io.on('connection', (socket) => {
  console.log('new connection ', socket.id);
  socket.on('host', (data) => {
    if (data.username == '' || data.username.length > 12) {
      socket.emit('hostRoom', undefined);
    } else {
      let code;
      do {
        code =
          '' +
          Math.floor(Math.random() * 10) +
          Math.floor(Math.random() * 10) +
          Math.floor(Math.random() * 10) +
          Math.floor(Math.random() * 10);
      } while (rooms.length != 0 && rooms.some((r) => r.getCode() === code));
      const game = new Game(code, data.username);
      game.configureSettings(sanitizeRoomSettings(data.settings));
      rooms.push(game);
      game.addPlayer(data.username, socket);
      game.emitPlayers('hostRoom', game.getRoomState());
    }
  });

  socket.on('join', (data) => {
    const game = rooms.find((r) => r.getCode() === data.code);
    if (
      game == undefined ||
      game.getPlayersArray().some((p) => p == data.username) ||
      data.username == undefined ||
      data.username.length > 12
    ) {
      socket.emit('joinRoom', undefined);
    } else {
      game.addPlayer(data.username, socket);
      rooms = rooms.map((r) => (r.getCode() === data.code ? game : r));
      game.emitPlayers('joinRoom', game.getRoomState());
      game.emitPlayers('hostRoom', game.getRoomState());
    }
  });

  socket.on('startGame', (data) => {
    const game = rooms.find((r) => r.getCode() == data.code);
    if (game == undefined || !game.isHostSocket(socket.id) || !game.canStartGame()) {
      socket.emit('gameBegin', undefined);
    } else {
      game.emitPlayers('gameBegin', { code: data.code });
      game.startGame();
    }
  });

  socket.on('evaluatePossibleMoves', () => {
    const game = rooms.find(
      (r) => r.findPlayer(socket.id).socket.id === socket.id
    );
    if (!game) return;
    if (game.roundInProgress) {
      const possibleMoves = game.getPossibleMoves(socket);
      socket.emit('displayPossibleMoves', possibleMoves);
    }
  });

  socket.on('raiseModalData', () => {
    const game = findGameBySocketId(socket.id);
    if (game != undefined) {
      socket.emit('updateRaiseModal', {
        topBet: game.getCurrentTopBet(),
        usernameMoney:
          game.getPlayerBetInStage(game.findPlayer(socket.id)) +
          game.findPlayer(socket.id).getMoney(),
      });
    }
  });

  socket.on('startNextRound', () => {
    const game = findGameBySocketId(socket.id);
    if (game != undefined) {
      if (game.roundInProgress === false) {
        game.startNewRound();
      }
    }
  });

  // precondition: user must be able to make the move in the first place.
  socket.on('moveMade', (data) => {
    // worst case complexity O(num_rooms * num_players_in_room)
    const game = findGameBySocketId(socket.id);

    if (game != undefined) {
      if (data.move == 'fold') {
        game.fold(socket);
      } else if (data.move == 'check') {
        game.check(socket);
      } else if (data.move == 'bet') {
        game.bet(socket, data.bet);
      } else if (data.move == 'call') {
        game.call(socket);
      } else if (data.move == 'raise') {
        game.raise(socket, data.bet);
      }
    } else {
      console.log("ERROR: can't find game!!!");
    }
  });

  socket.on('disconnect', () => {
    const game = findGameBySocketId(socket.id);
    if (game != undefined) {
      const player = game.findPlayer(socket.id);
      game.disconnectPlayer(player);
      if (game.players.length == 0) {
        if (this.rooms != undefined && this.rooms.length !== 0) {
          this.rooms = this.rooms.filter((a) => a != game);
        }
      }
    }
  });
});

server.listen(PORT, () => console.log(`hosting on port ${PORT}`));
