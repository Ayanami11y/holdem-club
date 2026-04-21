var modalScrollTop = 0;

function setModalScrollLock(locked) {
  var $body = $('body');
  if (locked) {
    modalScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    $body.addClass('modal-open');
    $body.css({ top: -modalScrollTop + 'px' });
  } else {
    $body.removeClass('modal-open');
    $body.css({ top: '' });
    window.scrollTo(0, modalScrollTop);
  }
}

function closeModalAndUnlock(selector) {
  var $modal = $(selector);
  if ($modal.length) {
    if (typeof $modal.closeModal === 'function') {
      $modal.closeModal();
    } else {
      $modal.hide();
    }
  }
  window.setTimeout(function () {
    setModalScrollLock(false);
  }, 350);
}

$(document).ready(function () {
  $('#gameDiv').hide();
  $('.modal-trigger').leanModal({
    ready: function () {
      setModalScrollLock(true);
    },
    complete: function () {
      setModalScrollLock(false);
    }
  });
  $('.tooltipped').tooltip({ delay: 50 });
});

var socket = io();
var gameInfo = null;
var roomSettings = {
  blinds: { small: 1, big: 2 },
  buyIn: { startingStack: 100, autoRebuy: true, autoRebuyStack: 100 },
};
var lastCommunityMarkup = '';
var lastOpponentMarkup = '';
var lastSelfTurnState = null;
var lastPossibleMoves = null;
var lastLobbyPlayers = null;
var lastLobbyRoomState = null;

function getHostSettingsFormValues() {
  return {
    smallBlind: parseInt($('#smallBlind-field').val(), 10) || 1,
    bigBlind: parseInt($('#bigBlind-field').val(), 10) || 2,
    startingStack: parseInt($('#startingStack-field').val(), 10) || 100,
    autoRebuy: $('#autoRebuy-field').is(':checked'),
    autoRebuyStack: parseInt($('#autoRebuyStack-field').val(), 10) || 100,
  };
}

function applyRoomSettings(settings) {
  if (!settings) return;
  roomSettings = settings;
}

function syncLobbyRoomPanel(data) {
  if (!data) return;
  if (typeof mergeLobbyRoomState === 'function') {
    lastLobbyRoomState = mergeLobbyRoomState(lastLobbyRoomState, data);
  } else {
    lastLobbyRoomState = Object.assign({}, lastLobbyRoomState || {}, data);
  }
  if (typeof renderLobbyRoomPanel !== 'function') return;
  var $panel = $('#lobbyRoomPanel');
  if ($panel.length) {
    $panel.html(renderLobbyRoomPanel(lastLobbyRoomState, { previousPlayers: lastLobbyPlayers }));
  }
  lastLobbyPlayers = Array.isArray(lastLobbyRoomState && lastLobbyRoomState.players)
    ? lastLobbyRoomState.players.slice()
    : null;
}

function renderRoomSettings(settings) {
  if (!settings) return '';
  return (
    '<div class="room-settings-summary">' +
    '<p><b>盲注：</b>$' + settings.blinds.small + ' / $' + settings.blinds.big + '</p>' +
    '<p><b>起始筹码：</b>$' + settings.buyIn.startingStack + '</p>' +
    '<p><b>自动补码：</b>' + (settings.buyIn.autoRebuy ? '开启' : '关闭') + '</p>' +
    (settings.buyIn.autoRebuy
      ? '<p><b>补码目标：</b>$' + settings.buyIn.autoRebuyStack + '</p>'
      : '') +
    '</div>'
  );
}

function translateStatus(status) {
  var map = {
    'Their Turn': '等待操作',
    'Fold': '已弃牌',
    'Check': '过牌',
    'Call': '跟注',
    'Buy-in': '补码'
  };
  return map[status] || status;
}

function translateBlind(blind) {
  var map = {
    'Big Blind': '大盲',
    'Small Blind': '小盲'
  };
  return map[blind] || blind;
}

function translateStage(stage) {
  var map = {
    'Pre-Flop': '翻牌前',
    'Flop': '翻牌',
    'Turn': '转牌',
    'River': '河牌'
  };
  return map[stage] || stage;
}

function formatBuyIns(count) {
  if (!count || count <= 0) return '';
  return count + ' 次补码';
}

function formatOpponentAction(text, isChecked, bet) {
  if (text == 'Fold') return '已弃牌';
  if (isChecked) return '过牌';
  if (bet && bet !== 'Fold' && bet !== 'Call' && bet !== 'Check' && bet !== 'Buy-in') {
    return '下注：$' + bet;
  }
  return translateStatus(text);
}

function formatSelfCardTitle(username, myBet) {
  if (myBet == 0) return username + '｜手牌';
  return username + '｜当前下注：$' + myBet;
}

function formatBuyInSummary(count) {
  if (!count || count <= 0) return '';
  return '（' + formatBuyIns(count) + '）';
}

function renderPlayersList(players) {
  return players
    .map(function (p) {
      return '<span>' + p + '</span><br />';
    })
    .join('');
}

function renderStartButton(code, label) {
  return (
    '<br /><button onclick="startGame(\'' +
    code +
    '\')" type="submit" class="waves-effect waves-light btn-flat modal-action-btn">' +
    label +
    '</button>'
  );
}

socket.on('playerDisconnected', function (data) {
  Materialize.toast(data.player + ' 离开了牌桌。', 4000);
});

socket.on('hostRoom', function (data) {
  if (data != undefined) {
    applyRoomSettings(data.settings);
    syncLobbyRoomPanel(data);
    var settingsMarkup = renderRoomSettings(data.settings);
    if (data.players.length >= 11) {
      $('#hostModalContent').html(
        '<h5>房码</h5><code>' +
          data.code +
          '</code><br /><h5>牌桌已满，最多支持 11 人。</h5><h5>房间玩家</h5>' +
          settingsMarkup
      );
      $('#playersNames').html(renderPlayersList(data.players));
    } else if (data.players.length > 1) {
      $('#hostModalContent').html(
        '<h5>房码</h5><code>' +
          data.code +
          '</code><br /><h5>房间玩家</h5><p>人到齐了，准备好就可以开始牌局。</p>' +
          settingsMarkup
      );
      $('#playersNames').html(renderPlayersList(data.players));
      $('#startGameArea').html(renderStartButton(data.code, '开始牌局'));
    } else {
      $('#hostModalContent').html(
        '<h5>房码</h5><code>' +
          data.code +
          '</code><br /><h5>房间玩家</h5><p>把这个房码发给朋友。至少还需要 1 名玩家才能开始。</p>' +
          settingsMarkup
      );
      $('#playersNames').html(renderPlayersList(data.players));
    }
  } else {
    Materialize.toast(
      '请输入有效昵称，最多 12 个字符。',
      4000
    );
    $('#joinButton').removeClass('disabled');
  }
});

socket.on('hostRoomUpdate', function (data) {
  syncLobbyRoomPanel(data);
  $('#playersNames').html(renderPlayersList(data.players));
  if (data.players.length == 1) {
    $('#startGameArea').empty();
  }
});

socket.on('joinRoomUpdate', function (data) {
  applyRoomSettings(data.settings);
  syncLobbyRoomPanel(data);
  $('#startGameAreaDisconnectSituation').html(
    renderStartButton(data.code, '开始牌局')
  );
  $('#joinModalContent').html(
    '<h5>' +
      data.host +
      ' 的牌桌</h5><hr /><h5>房间玩家</h5><p>你现在是这张牌桌的房主。</p>' +
      renderRoomSettings(data.settings)
  );

  $('#playersNamesJoined').html(renderPlayersList(data.players));
});

socket.on('joinRoom', function (data) {
  if (data == undefined) {
    closeModalAndUnlock('#joinModal');
    Materialize.toast(
      '请输入有效昵称和房码。昵称需在当前牌桌内唯一，且不超过 12 个字符。',
      4000
    );
    $('#hostButton').removeClass('disabled');
  } else {
    applyRoomSettings(data.settings);
    syncLobbyRoomPanel(data);
    $('#joinModalContent').html(
      '<h5>' +
        data.host +
        ' 的牌桌</h5><hr /><h5>房间玩家</h5><p>请等待房主开始牌局。离开、刷新或返回页面都会让你断开连接。</p>' +
        renderRoomSettings(data.settings)
    );
    $('#playersNamesJoined').html(renderPlayersList(data.players));
  }
});

socket.on('dealt', function (data) {
  $('#mycards').html(
    data.cards.map(function (c) {
      return renderCard(c);
    })
  );
  $('#usernamesCards').text(formatSelfCardTitle(data.username, 0));
  $('#mainContent').remove();
});

// --- Render scheduling (mobile perf): coalesce rapid server rerenders into one frame ---
var rerenderScheduled = false;
var pendingRerenderData = null;

function buildBetByPlayerMap(bets) {
  var lastStage = bets && bets.length ? bets[bets.length - 1] : [];
  var map = Object.create(null);
  for (var i = 0; i < lastStage.length; i++) {
    map[lastStage[i].player] = lastStage[i].bet;
  }
  return map;
}

function formatMoneyChip(value) {
  return '$' + (value == undefined ? 0 : value);
}

function renderPossibleMovesSummary(data) {
  var pills = [];
  if (!data) {
    $('#moveSummary').empty();
    return;
  }

  if (data.fold == 'yes') pills.push('<span class="move-pill is-muted">弃牌</span>');
  if (data.check == 'yes') pills.push('<span class="move-pill is-muted">过牌</span>');
  if (data.bet == 'yes') pills.push('<span class="move-pill is-prominent">下注</span>');
  if (data.call != 'no') {
    pills.push(
      '<span class="move-pill is-prominent">' +
        (data.call == 'all-in' ? '跟注全下' : '跟注 $' + data.call) +
        '</span>'
    );
  }
  if (data.raise == 'yes') pills.push('<span class="move-pill is-prominent">加注</span>');

  $('#moveSummary').html(
    pills.length ? '<b>可选动作：</b>' + pills.join('') : '<span class="move-pill is-muted">暂时没有可用动作</span>'
  );
}

function updateTableMetrics(data) {
  $('#stageStatus').text(translateStage(data.stage || '')); 
  $('#potStatus').text(formatMoneyChip(data.pot));
  $('#topBetStatus').text(formatMoneyChip(data.topBet));
}

function doRerender(data) {
  if (!data) return;

  if (data.myBet == 0) {
    $('#usernamesCards').text(formatSelfCardTitle(data.username, 0));
  } else {
    $('#usernamesCards').text(formatSelfCardTitle(data.username, data.myBet));
  }

  var communityMarkup = data.community != undefined
    ? data.community.map(function (c) {
        return renderCard(c);
      }).join('')
    : '<p></p>';
  if (communityMarkup !== lastCommunityMarkup) {
    $('#communityCards').html(communityMarkup);
    lastCommunityMarkup = communityMarkup;
  }

  if (data.currBet == undefined) data.currBet = 0;
  var currentTurnText = data.currentTurn ? '｜当前玩家：' + data.currentTurn : '';
  $('#table-title').text(
    '第 ' +
      data.round +
      ' 手牌｜' +
      translateStage(data.stage) +
      '｜当前顶注：$' +
      data.topBet +
      '｜底池：$' +
      data.pot +
      currentTurnText
  );
  updateTableMetrics(data);
  $('#turnHint').text(data.currentTurn ? '当前玩家：' + data.currentTurn : '');

  var betByPlayer = buildBetByPlayerMap(data.bets);
  var opponentMarkup = data.players.map(function (p) {
    return renderOpponent(p.username, {
      text: p.status,
      money: p.money,
      blind: p.blind,
      bet: betByPlayer[p.username] || 0,
      buyIns: p.buyIns,
      isChecked: p.isChecked,
    });
  }).join('');
  if (opponentMarkup !== lastOpponentMarkup) {
    $('#opponentCards').html(opponentMarkup);
    lastOpponentMarkup = opponentMarkup;
  }

  renderSelf({
    money: data.myMoney,
    text: data.myStatus,
    blind: data.myBlind,
    bets: data.bets,
    buyIns: data.buyIns,
    currentTurn: data.currentTurn,
  });

  if (!data.roundInProgress) {
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  }
}

socket.on('rerender', function (data) {
  pendingRerenderData = data;
  if (rerenderScheduled) return;
  rerenderScheduled = true;

  var raf = window.requestAnimationFrame || function (cb) { return window.setTimeout(cb, 16); };
  raf(function () {
    rerenderScheduled = false;
    var next = pendingRerenderData;
    pendingRerenderData = null;
    doRerender(next);
  });
});

socket.on('gameBegin', function (data) {
  $('#siteHeader').hide();
  closeModalAndUnlock('#joinModal');
  closeModalAndUnlock('#hostModal');
  if (data == undefined) {
    alert('错误：无效的房间。');
  } else {
    $('#gameDiv').show();
  }
});

function playNext() {
  socket.emit('startNextRound', {});
}

socket.on('reveal', function (data) {
  $('#usernameFold').hide();
  $('#usernameCheck').hide();
  $('#usernameBet').hide();
  $('#usernameCall').hide();
  $('#usernameRaise').hide();

  for (var i = 0; i < data.winners.length; i++) {
    if (data.winners[i] == data.username) {
      Materialize.toast('你赢下了这一手。', 4000);
      break;
    }
  }
  $('#table-title').text('本手赢家：' + data.winners);
  $('#turnHint').text('');
  $('#playNext').html(
    '<button onClick=playNext() id="playNextButton" class="btn white black-text menuButtons">开始下一手</button>'
  );
  $('#blindStatus').text(translateStatus(data.hand));
  $('#usernamesMoney').text('$' + data.money);
  $('#opponentCards').html(
    data.cards.map(function (p) {
      return renderOpponentCards(p.username, {
        cards: p.cards,
        folded: p.folded,
        money: p.money,
        endHand: p.hand,
        buyIns: p.buyIns,
      });
    })
  );
});

socket.on('endHand', function (data) {
  $('#usernameFold').hide();
  $('#usernameCheck').hide();
  $('#usernameBet').hide();
  $('#usernameCall').hide();
  $('#usernameRaise').hide();
  $('#table-title').text(data.winner + ' 赢得底池 $' + data.pot);
  $('#turnHint').text('');
  $('#playNext').html(
    '<button onClick=playNext() id="playNextButton" class="btn white black-text menuButtons">开始下一手</button>'
  );
  $('#blindStatus').text('');
  if (data.folded == 'Fold') {
    $('#status').text('你已弃牌');
    $('#playerInformationCard').removeClass('theirTurn');
    $('#playerInformationCard').removeClass('green');
    $('#playerInformationCard').addClass('grey');
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
  }
  $('#usernamesMoney').text('$' + data.money);
  $('#opponentCards').html(
    data.cards.map(function (p) {
      return renderOpponent(p.username, {
        text: p.text,
        money: p.money,
        blind: '',
        bets: data.bets,
      });
    })
  );
});

var beginHost = function () {
  if ($('#hostName-field').val() == '') {
    $('.toast').hide();
    closeModalAndUnlock('#hostModal');
    Materialize.toast(
      '请输入有效昵称，最多 12 个字符。',
      4000
    );
    $('#joinButton').removeClass('disabled');
  } else {
    socket.emit('host', {
      username: $('#hostName-field').val(),
      settings: getHostSettingsFormValues(),
    });
    $('#joinButton').addClass('disabled');
    $('#joinButton').off('click');
  }
};

var joinRoom = function () {
  // yes, i know this is client-side.
  if (
    $('#joinName-field').val() == '' ||
    $('#code-field').val() == '' ||
    $('#joinName-field').val().length > 12
  ) {
    $('.toast').hide();
    Materialize.toast(
      '请输入有效昵称和房码，昵称最长 12 个字符。',
      4000
    );
    closeModalAndUnlock('#joinModal');
    $('#hostButton').removeClass('disabled');
    $('#hostButton').on('click');
  } else {
    socket.emit('join', {
      code: $('#code-field').val(),
      username: $('#joinName-field').val(),
    });
    $('#hostButton').addClass('disabled');
    $('#hostButton').off('click');
  }
};

var startGame = function (gameCode) {
  socket.emit('startGame', { code: gameCode });
};

var fold = function () {
  socket.emit('moveMade', { move: 'fold', bet: 'Fold' });
};

var bet = function () {
  if (parseInt($('#betRangeSlider').val()) == 0) {
    Materialize.toast('下注金额必须大于 $0，请重试。', 4000);
  } else if (parseInt($('#betRangeSlider').val()) < roomSettings.blinds.big) {
    Materialize.toast('最小开局下注为 $' + roomSettings.blinds.big + '。', 4000);
  } else {
    socket.emit('moveMade', {
      move: 'bet',
      bet: parseInt($('#betRangeSlider').val()),
    });
  }
};

function call() {
  socket.emit('moveMade', { move: 'call', bet: 'Call' });
}

var check = function () {
  socket.emit('moveMade', { move: 'check', bet: 'Check' });
};

var raise = function () {
  if (
    parseInt($('#raiseRangeSlider').val()) == $('#raiseRangeSlider').prop('min')
  ) {
    Materialize.toast(
      '加注金额必须高于当前顶注，请重试。',
      4000
    );
  } else {
    socket.emit('moveMade', {
      move: 'raise',
      bet: parseInt($('#raiseRangeSlider').val()),
    });
  }
};

function renderCard(card) {
  if (card.suit == '♠' || card.suit == '♣')
    return (
      '<div class="playingCard_black" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
  else
    return (
      '<div class="playingCard_red" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
}

function renderOpponent(name, data) {
  // Perf: accept precomputed bet (avoid scanning bets array for every player)
  var bet = typeof data.bet !== 'undefined' ? data.bet : 0;
  if (typeof data.bet === 'undefined' && data.bets != undefined) {
    var arr = data.bets[data.bets.length - 1];
    for (var pn = 0; pn < arr.length; pn++) {
      if (arr[pn].player == name) bet = arr[pn].bet;
    }
  }
  if (data.buyIns > 0) {
    if (data.text == 'Fold') {
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey"><div class="card-content white-text"><span class="card-title">' +
        name +
        '（已弃牌）</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        translateBlind(data.blind) +
        '<br />' +
        formatOpponentAction(data.text, data.isChecked, bet) +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
        data.money +
        ' ' +
        formatBuyInSummary(data.buyIns) +
        '</div></div></div>'
      );
    } else {
      if (data.text == 'Their Turn') {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title">' +
            name +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">$' +
            data.money +
            ' ' +
            formatBuyInSummary(data.buyIns) +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title">' +
            name +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">$' +
            data.money +
            ' ' +
            formatBuyInSummary(data.buyIns) +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title">' +
            name +
            '<br />下注：$' +
            bet +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br /><br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">$' +
            data.money +
            ' ' +
            formatBuyInSummary(data.buyIns) +
            '</div></div></div>'
          );
        }
      } else {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            name +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
            data.money +
            ' ' +
            formatBuyInSummary(data.buyIns) +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            name +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
            data.money +
            ' ' +
            formatBuyInSummary(data.buyIns) +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            name +
            '<br />下注：$' +
            bet +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
            data.money +
            ' ' +
            formatBuyInSummary(data.buyIns) +
            '</div></div></div>'
          );
        }
      }
    }
  }
  // buy-ins rendering
  else {
    if (data.text == 'Fold') {
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey"><div class="card-content white-text"><span class="card-title">' +
        name +
        '（已弃牌）</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
        translateBlind(data.blind) +
        '<br />' +
        formatOpponentAction(data.text, data.isChecked, bet) +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
        data.money +
        '</div></div></div>'
      );
    } else {
      if (data.text == 'Their Turn') {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            name +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">$' +
            data.money +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            name +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">$' +
            data.money +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card yellow darken-3"><div class="card-content black-text"><span class="card-title black-text">' +
            name +
            '<br />下注：$' +
            bet +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br /><br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action yellow lighten-1 black-text center-align" style="font-size: 20px;">$' +
            data.money +
            '</div></div></div>'
          );
        }
      } else {
        if (data.isChecked)
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            name +
            '<br />过牌</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
            data.money +
            '</div></div></div>'
          );
        else if (bet == 0) {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            name +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
            data.money +
            '</div></div></div>'
          );
        } else {
          return (
            '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
            name +
            '<br />下注：$' +
            bet +
            '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br />' +
            translateBlind(data.blind) +
            '<br />' +
            formatOpponentAction(data.text, data.isChecked, bet) +
            '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
            data.money +
            '</div></div></div>'
          );
        }
      }
    }
  }
}

function renderOpponentCards(name, data) {
  var bet = 0;
  if (data.bets != undefined) {
    var arr = data.bets[data.bets.length - 1].reverse();
    for (var pn = 0; pn < arr.length; pn++) {
      if (arr[pn].player == name) bet = arr[pn].bet;
    }
  }
  if (data.buyIns > 0) {
    if (data.folded)
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey" ><div class="card-content white-text"><span class="card-title">' +
        name +
        '｜下注：$' +
        bet +
        '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br /><br /></p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
        data.money +
        ' ' +
        formatBuyInSummary(data.buyIns) +
        '</div></div></div>'
      );
    else
      return (
        '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
        name +
        '｜下注：$' +
        bet +
        '</span><p><div class="center-align"> ' +
        renderOpponentCard(data.cards[0]) +
        renderOpponentCard(data.cards[1]) +
        ' </div><br /><br /><br /><br /><br />' +
        data.endHand +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
        data.money +
        ' ' +
        formatBuyInSummary(data.buyIns) +
        '</div></div></div>'
      );
  } else {
    if (data.folded)
      return (
        '<div class="col s12 m2 opponentCard"><div class="card grey" ><div class="card-content white-text"><span class="card-title">' +
        name +
        '｜下注：$' +
        bet +
        '</span><p><div class="center-align"><div class="blankCard" id="opponent-card" /><div class="blankCard" id="opponent-card" /></div><br /><br /><br /><br /><br /><br /></p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
        data.money +
        '</div></div></div>'
      );
    else
      return (
        '<div class="col s12 m2 opponentCard"><div class="card green darken-2" ><div class="card-content white-text"><span class="card-title">' +
        name +
        '｜下注：$' +
        bet +
        '</span><p><div class="center-align"> ' +
        renderOpponentCard(data.cards[0]) +
        renderOpponentCard(data.cards[1]) +
        ' </div><br /><br /><br /><br /><br />' +
        data.endHand +
        '</p></div><div class="card-action green darken-3 white-text center-align" style="font-size: 20px;">$' +
        data.money +
        '</div></div></div>'
      );
  }
}

function renderOpponentCard(card) {
  if (card.suit == '♠' || card.suit == '♣')
    return (
      '<div class="playingCard_black_opponent" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
  else
    return (
      '<div class="playingCard_red_opponent" id="card"' +
      card.value +
      card.suit +
      '" data-value="' +
      card.value +
      ' ' +
      card.suit +
      '">' +
      card.value +
      ' ' +
      card.suit +
      '</div>'
    );
}

function updateBetDisplay() {
  var currentMoney = parseInt($('#usernamesMoney').text().replace('$', ''), 10);
  if (parseInt($('#betRangeSlider').val(), 10) === currentMoney) {
    $('#betDisplay').html(
      '<h3 class="center-align">全下 $' +
        $('#betRangeSlider').val() +
        '</h3>'
    );
  } else {
    $('#betDisplay').html(
      '<h3 class="center-align">$' + $('#betRangeSlider').val() + '</h3>'
    );
  }
}

function updateBetModal() {
  $('#betDisplay').html('<h3 class="center-align">$0</h3>');
  document.getElementById('betRangeSlider').value = 0;
  var usernamesMoneyStr = $('#usernamesMoney').text().replace('$', '');
  var usernamesMoneyNum = parseInt(usernamesMoneyStr);
  $('#betRangeSlider').attr({
    max: usernamesMoneyNum,
    min: 0,
  });
}

function updateRaiseDisplay() {
  $('#raiseDisplay').html(
    '<h3 class="center-align">把顶注加到 $' +
      $('#raiseRangeSlider').val() +
      '</h3>'
  );
}

socket.on('updateRaiseModal', function (data) {
  var baseTopBet = parseInt(data.topBet, 10) || 0;
  var blindStep = Math.max(parseInt(roomSettings.blinds.big, 10) || 0, 1);
  var minRaise = baseTopBet + blindStep;
  var maxRaise = parseInt(data.usernameMoney, 10) || 0;
  if (maxRaise < minRaise) minRaise = maxRaise;
  $('#raiseRangeSlider').attr({
    max: maxRaise,
    min: minRaise,
  });
  $('#raiseRangeSlider').val(minRaise);
  updateRaiseDisplay();
  $('#raiseHelpText').text(
    maxRaise <= minRaise
      ? '你只能全下或跟注，当前筹码不足以构成标准加注。'
      : '最小加注会按大盲注起跳，更接近真实牌桌。'
  );
});

function updateRaiseModal() {
  document.getElementById('raiseRangeSlider').value = 0;
  $('#raiseHelpText').text('正在计算可加注范围…');
  socket.emit('raiseModalData', {});
}

socket.on('displayPossibleMoves', function (data) {
  lastPossibleMoves = data;
  renderPossibleMovesSummary(data);
  if (data.fold == 'yes') $('#usernameFold').show();
  else $('#usernameFold').hide();
  if (data.check == 'yes') $('#usernameCheck').show();
  else $('#usernameCheck').hide();
  if (data.bet == 'yes') $('#usernameBet').show();
  else $('#usernameBet').hide();
  if (data.call != 'no' || data.call == 'all-in') {
    $('#usernameCall').show();
    if (data.call == 'all-in') $('#usernameCall').text('跟注全下');
    else $('#usernameCall').text('跟注 $' + data.call);
  } else $('#usernameCall').hide();
  if (data.raise == 'yes') $('#usernameRaise').show();
  else $('#usernameRaise').hide();
});

function shouldRequestPossibleMoves(currentText) {
  if (currentText === 'Their Turn') {
    const shouldEmit = lastSelfTurnState !== 'Their Turn';
    lastSelfTurnState = 'Their Turn';
    return shouldEmit;
  }
  lastSelfTurnState = currentText;
  return false;
}

function renderSelf(data) {
  $('#playNext').empty();
  $('#usernamesMoney').text('$' + data.money);
  if (data.text == 'Their Turn') {
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').addClass('yellow');
    $('#playerInformationCard').addClass('darken-2');
    $('#playerInformationCard').addClass('theirTurn');
    $('#commandCard').addClass('theirTurn');
    $('#usernamesCards').removeClass('white-text');
    $('#usernamesCards').addClass('black-text');
    $('#status').text('轮到你操作');
    $('#turnHint').text(
      data.currentTurn ? '当前玩家：' + data.currentTurn + ' · 轮到你操作' : '轮到你操作'
    );
    if (shouldRequestPossibleMoves(data.text)) {
      Materialize.toast('轮到你操作了。', 4000);
      socket.emit('evaluatePossibleMoves', {});
    }
  } else if (data.text == 'Fold') {
    lastSelfTurnState = 'Fold';
    $('#status').text('你已弃牌');
    $('#playerInformationCard').removeClass('green');
    $('#playerInformationCard').removeClass('yellow');
    $('#playerInformationCard').removeClass('darken-2');
    $('#playerInformationCard').removeClass('theirTurn');
    $('#commandCard').removeClass('theirTurn');
    $('#playerInformationCard').addClass('grey');
    $('#usernamesCards').removeClass('black-text');
    $('#usernamesCards').addClass('white-text');
    Materialize.toast('你已弃牌。', 3000);
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
    renderPossibleMovesSummary(null);
  } else {
    lastSelfTurnState = data.text;
    $('#status').text('');
    $('#turnHint').text('');
    $('#usernamesCards').removeClass('black-text');
    $('#usernamesCards').addClass('white-text');
    $('#playerInformationCard').removeClass('grey');
    $('#playerInformationCard').removeClass('yellow');
    $('#playerInformationCard').removeClass('darken-2');
    $('#playerInformationCard').addClass('green');
    $('#playerInformationCard').removeClass('theirTurn');
    $('#commandCard').removeClass('theirTurn');
    $('#usernameFold').hide();
    $('#usernameCheck').hide();
    $('#usernameBet').hide();
    $('#usernameCall').hide();
    $('#usernameRaise').hide();
    renderPossibleMovesSummary(null);
  }
  $('#blindStatus').text(translateBlind(data.blind));
}
