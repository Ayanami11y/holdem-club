(function (root) {
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getRemainingPlayersCount(players) {
    return Math.max(0, 2 - players.length);
  }

  function renderJoinStatus(players) {
    var remaining = getRemainingPlayersCount(players);
    if (remaining > 0) {
      return '还差 ' + remaining + ' 人就能开局';
    }
    return '已满足开局人数';
  }

  function isNewJoin(player, previousPlayers) {
    return Array.isArray(previousPlayers) && previousPlayers.indexOf(player) === -1;
  }

  function mergeLobbyRoomState(previous, next) {
    var prev = previous && typeof previous === 'object' ? previous : {};
    var incoming = next && typeof next === 'object' ? next : {};
    var merged = {};

    Object.keys(prev).forEach(function (key) {
      merged[key] = prev[key];
    });
    Object.keys(incoming).forEach(function (key) {
      merged[key] = incoming[key];
    });

    if (prev.settings || incoming.settings) {
      merged.settings = {};
      var prevSettings = prev.settings && typeof prev.settings === 'object' ? prev.settings : {};
      var incomingSettings = incoming.settings && typeof incoming.settings === 'object' ? incoming.settings : {};
      Object.keys(prevSettings).forEach(function (key) {
        merged.settings[key] = prevSettings[key];
      });
      Object.keys(incomingSettings).forEach(function (key) {
        merged.settings[key] = incomingSettings[key];
      });

      if (prevSettings.buyIn || incomingSettings.buyIn) {
        merged.settings.buyIn = {};
        var prevBuyIn = prevSettings.buyIn && typeof prevSettings.buyIn === 'object' ? prevSettings.buyIn : {};
        var incomingBuyIn = incomingSettings.buyIn && typeof incomingSettings.buyIn === 'object' ? incomingSettings.buyIn : {};
        Object.keys(prevBuyIn).forEach(function (key) {
          merged.settings.buyIn[key] = prevBuyIn[key];
        });
        Object.keys(incomingBuyIn).forEach(function (key) {
          merged.settings.buyIn[key] = incomingBuyIn[key];
        });
      }

      if (prevSettings.blinds || incomingSettings.blinds) {
        merged.settings.blinds = {};
        var prevBlinds = prevSettings.blinds && typeof prevSettings.blinds === 'object' ? prevSettings.blinds : {};
        var incomingBlinds = incomingSettings.blinds && typeof incomingSettings.blinds === 'object' ? incomingSettings.blinds : {};
        Object.keys(prevBlinds).forEach(function (key) {
          merged.settings.blinds[key] = prevBlinds[key];
        });
        Object.keys(incomingBlinds).forEach(function (key) {
          merged.settings.blinds[key] = incomingBlinds[key];
        });
      }
    }

    return merged;
  }

  function renderLobbyRoomPanel(data, options) {
    if (!data) return '';

    var previousPlayers = options && Array.isArray(options.previousPlayers)
      ? options.previousPlayers
      : null;
    var players = Array.isArray(data.players) ? data.players : [];
    var code = escapeHtml(data.code);
    var host = escapeHtml(data.host);
    var playerCount = players.length;
    var playerLabel = playerCount === 1 ? '当前已加入 1 人' : '当前已加入 ' + playerCount + ' 人';
    var playerMarkup = players.length
      ? '<div class="lobby-room-player-list">' +
        players
          .map(function (player, index) {
            var classes = ['lobby-room-pill'];
            if (index === 0) classes.push('is-host');
            if (isNewJoin(player, previousPlayers)) classes.push('is-new');
            return '<span class="' + classes.join(' ') + '">' + escapeHtml(player) + '</span>';
          })
          .join('') +
        '</div>'
      : '<p class="lobby-room-empty">还没有玩家加入。</p>';

    return (
      '<div class="lobby-room-panel">' +
      '<div class="lobby-room-panel-head">' +
      '<span class="table-badge subtle">房间 ' + code + '</span>' +
      '<span class="lobby-room-count">' + playerLabel + '</span>' +
      '</div>' +
      '<p class="lobby-room-host">房主：' + host + '</p>' +
      '<p class="lobby-room-status">' + renderJoinStatus(players) + '</p>' +
      playerMarkup +
      '</div>'
    );
  }

  root.mergeLobbyRoomState = mergeLobbyRoomState;
  root.renderLobbyRoomPanel = renderLobbyRoomPanel;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderLobbyRoomPanel: renderLobbyRoomPanel, mergeLobbyRoomState: mergeLobbyRoomState };
  }
})(typeof window !== 'undefined' ? window : globalThis);
