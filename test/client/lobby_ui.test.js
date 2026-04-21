const { renderLobbyRoomPanel, mergeLobbyRoomState } = require('../../src/client/lobby_ui');

describe('renderLobbyRoomPanel', () => {
  test('labels host and players and shows remaining seats to start', () => {
    const html = renderLobbyRoomPanel({
      code: '1234',
      host: 'Alice',
      players: ['Alice'],
      settings: {
        blinds: { small: 1, big: 2 },
        buyIn: { startingStack: 100, autoRebuy: true, autoRebuyStack: 100 },
      },
    });

    expect(html).toContain('房主');
    expect(html).toContain('Alice');
    expect(html).toContain('还差 1 人就能开局');
  });

  test('highlights the newest player join', () => {
    const html = renderLobbyRoomPanel(
      {
        code: '1234',
        host: 'Alice',
        players: ['Alice', 'Bob'],
        settings: {
          blinds: { small: 1, big: 2 },
          buyIn: { startingStack: 100, autoRebuy: true, autoRebuyStack: 100 },
        },
      },
      { previousPlayers: ['Alice'] }
    );

    expect(html).toContain('lobby-room-pill is-new');
    expect(html).toContain('房主');
    expect(html).toContain('当前已加入 2 人');
  });

  test('merges partial room updates without dropping existing room metadata', () => {
    const previous = {
      code: '1234',
      host: 'Alice',
      players: ['Alice'],
      settings: {
        blinds: { small: 1, big: 2 },
        buyIn: { startingStack: 100, autoRebuy: true, autoRebuyStack: 100 },
      },
    };

    const merged = mergeLobbyRoomState(previous, { players: ['Alice', 'Bob'] });

    expect(merged.code).toBe('1234');
    expect(merged.host).toBe('Alice');
    expect(merged.players).toEqual(['Alice', 'Bob']);
    expect(merged.settings.blinds.big).toBe(2);
    expect(merged.settings.buyIn.startingStack).toBe(100);
  });
});
