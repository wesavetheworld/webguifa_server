/*
Copyright 2007 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/**
 * Javascript code specific to the game page.
 *
 * The game page is fairly complex, with a number of different, asynchronously
 * updating elements, controlled by a few different state variables.
 *
 * The Board:
 *
 * The board is basically an array of piece data. When we get a refresh from the
 * server, we calculate the new board state by starting with a fresh board and
 * applying the list of moves.
 *
 * The board is rendered as a series of divs, which are given class names to
 * cause them to render themselves appropriately based on the associated piece.
 * Every square on the board has its own DIV, and we intercept clicks on these
 * DIVs to process move input from the user. Input is ignored unless
 * canMove=true, which is set based on the game state (whose turn is it, has
 * the user already made his move, is the game over already?)
 *
 * Chat:
 *
 * The chat pane is only visible if the user is a participant in the game. It
 * has its own timer which fires off every 5 seconds.
 *
 * Game updates:
 *
 * We periodically poll the server for game status updates when it is not the
 * user's turn. For an untimed game, we update every 60 seconds, as a timely
 * update is not as important. For a timed game, we update every 3 seconds.
 *
 * Additionally, for timed games, we send an update to the server every 3
 * seconds when it is the user's turn, so the other player's display can be
 * updated with the current elapsed time.
 *
 * Endgame
 *
 * The game ends in checkmate, if a user resigns, or if one side runs out of
 * time. When one of these states are reached, we notify the server. For
 * the fast user feedback, we track things like elapsed time, resignation and
 * checkmate on the client, but in a production system we would want to
 * double-check these on the server to avoid cheating (for example, a client
 * failing to report running out of time, or incorrectly declaring checkmate)
 */

/*
$(document).ready(function() {
    initPage();
    // Start refreshing the page as soon as we are loaded
    game.refreshBoard();

    // Corner-ify items
    //$('.timeDisplay').corner({autoPad:true, validTags:["div"]});
    $('.waitingForOpponent').corner({autoPad:true, validTags:["div"]});
    $('.yourTurn').corner({autoPad:true, validTags:["div"]});

    // TODO: Set onbeforeunload() handler to catch when user navigates away
    // so we can warn the user first if he has a game in progress
});
*/

$(document).ready(function() {
  startCheckFlash();
});

function launchGame() {
  //initPage();
  // Start refreshing the page as soon as we are loaded
  game.refreshBoard();

  // Corner-ify items
  //$('.timeDisplay').corner({autoPad:true, validTags:["div"]});
  $('.waitingForOpponent').corner({autoPad:true, validTags:["div"]});
  $('.yourTurn').corner({autoPad:true, validTags:["div"]});
  $('#obaddress').text("http://guifachess.appspot.com/ob/" + game.gameKey);
}

var game = {
  // The constants that match each piece color
  GREEN: 0,
  YELLOW: 1,
  BLUE: 2,
  BROWN: 3,

  // Player's name
  greenName: "",
  yellowName: "",
  blueName: "",
  brownName: "",

  // If did init
  initialized: false,

  // The constants that match the game states (active/complete)
  ACTIVE: 3,
  COMPLETE: 4,

  // The index of the last chat item we have displayed - this is updated
  // as chats are sent from the server.
  chatId: 0,

  // Set to true once we've initialized the chat area
  chatInitialized: false,

  // The list of moves that were sent from the server
  moveList: [],
  oldListLength: 0,

  // The total time limit for this game (5 = 5 mins, 10 = 10 mins,
  // null = untimed)
  timeLimit: null,

  // How much time is left for each player
  player1_time: null,
  player2_time: null,
  player3_time: null,
  player4_time: null,

  // How often we redraw the timers, in milliseconds
  TIMER_UPDATE_INTERVAL: 200,

  // Whose turn it is (BLUE = 0, BROWN = 1) or null if the game is over
  whoseTurn: null,

  // The color of the currently logged in user (BLUE=0, BROWN=1, or null if
  // the user is a spectator (not a participant)
  color: null,

  // The status of the game (active or complete)
  status: null,

  // The victor (if status == COMPLETE, then 0=draw, 1 = creator won, 2 =
  // opponent won)
  victor: null,

  // If true, the user can make a move (it's his turn, and he hasn't made his
  // move yet)
  canMove: false,

  // The timestamp of when the user started his move, otherwise null (if it's
  // not his move or he isn't a participant)
  moveStart: null,

  // The timer we use to trigger an update from the server for the game state
  refreshGameTimer: null,

  // The timer we use to trigger an update of the chat window
  refreshChatTimer: null,

  // This is a hack - when the user does a pawn promotion, we need to save
  // off the pending move to give him a chance to select what piece he wants
  // before sending it to the server, so we put it here.
  pendingMove: null,

  getPlayerNameByColor: function(color) {
    switch (color) {
      case game.GREEN:
        return game.greenName;
      case game.YELLOW:
        return game.yellowName;
      case game.BLUE:
        return game.blueName;
      case game.BROWN:
        return game.brownName;
      default:
        return "";
    }
  },

  refreshBoard: function() {
    // hit the ajax handler to load our game data
    var options = {
      url: "/game_ajax/move/" + game.gameKey + "/" + game.moveList.length,
      dataType: "json",
      // Avoid caching of HTTP GETs by appending a random param
      data: {z: new Date().getTime()},
      error: blitz.retryOnFail,
      success: game.updateGameDisplay
    };
    $.ajax(options);
  },

  // Handle a game update from the server - update our game state, then
  // update the ui.
  updateGameDisplay: function(data) {
    $(".busy").hide();
    game.oldListLength = game.moveList.length;
    game.moveList = game.moveList.concat(data.game_data);
    game.status = data.status;
    game.victor = data.victor;
    game.creator_color = data.creator_color;
    game.game_type = data.game_type;

    // Figure out what color the player is, based on the "is_creator" flag
    // and the creator_color value.
    if (data.is_participant) {
      game.color = data.user_color;
      //参与者正在对局时不可以浏览棋步历史
      if (game.status == game.ACTIVE) {
        setAllowBrowseHistory(false);
      }
    }

    if (game.status == game.ACTIVE) {
      game.whoseTurn = data.whose_turn;
    } else {
      delete game.whoseTurn;
    }

    if (!game.initialized) {
      //setStartFrom(game.whoseTurn);
      game.initialized = true;
    }

    // Update our time variables
    game.player1_time = data.player1_time;
    game.player2_time = data.player2_time;
    game.player3_time = data.player3_time;
    game.player4_time = data.player4_time;
    game.timeLimit = data.time_limit;

    // Get the player names
    var playerNameArray = new Array(4);
    playerNameArray[0] = data.creator;
    playerNameArray[1] = data.opponent1;
    playerNameArray[2] = data.ally;
    playerNameArray[3] = data.opponent2;
    game.greenName  = playerNameArray[(4-data.creator_color)%4];
    game.yellowName = playerNameArray[(5-data.creator_color)%4];
    game.blueName   = playerNameArray[(6-data.creator_color)%4];
    game.brownName  = playerNameArray[(7-data.creator_color)%4];

    // Only participants get to see the chat
    if (data.is_participant) {
      game.initChat();
    }

    // Update the board with the latest moves
    game.updateBoard();

    // Update the header with time elapsed, etc - also refreshes our internal
    // variables
    game.updateHeader();

    // If it's still not our turn, kick off the refresh timer to check for
    // updates from the server
    if (game.status == game.ACTIVE) {
      if (game.canMove) {
        // It's the user's turn - if there's a time limit, we should set a
        // timer to update the server periodically with the updated time.
        if (game.timeLimit) {
          game.refreshGameTimer =
            window.setTimeout(game.sendTimeToServer, 5*1000);
        }
      } else {
        // If the user is playing blitz, then check every 3 secs to keep the
        // game moving along quickly. Otherwise, check at a leisurely
        // once-per-minute pace.
        var refreshInterval = 3*1000;  //game.timeLimit ? 3*1000 : 60 * 1000;
        game.refreshGameTimer =
            window.setTimeout(game.refreshBoard, refreshInterval);
      }
    }

    var our_turn = false;
    if (game.game_type == 1) {
      if (game.color != null && (game.whoseTurn == game.color || (game.whoseTurn + 2) % 4 == game.color)) {
        our_turn = true;
      }
    } else {
      if (game.color != null && game.whoseTurn == game.color) {
        our_turn = true;
      }
    }
    if (our_turn) {

      if (game.getLastMove() == 'offerDraw') {
        // The opponent is offering us a draw
        blitz.initAndDisplayDialog("#acceptDrawDialog");
      } else if (game.getLastMove() == 'reject') {
        blitz.initAndDisplayDialog("#drawRefusedDialog");
      }
    }
  },



  // returns the last move that was sent
  getLastMove: function() {
    if (game.moveList.length == 0) {
      return "";
    } else {
      return game.moveList[game.moveList.length-1];
    }
  },

  // Renders the board based on the latest move list
  updateBoard: function() {
    // Figure out our current board situation (caps = white)
    // (first char is lower left corner of board)
    //game.chess = new Chess();
    game.applyMoveList(game.moveList);
    game.renderBoard();

  },

  // Applies a set of moves to the board
  applyMoveList: function(moveList) {
    // Walk the list, ignoring entries that are things like offered draws.
    var moveStr = "";
    var start = 0;
    var needmove = false;
    jQuery.each(moveList, function(index, move) {
      if (index < game.oldListLength) {
        start += move.length;
        moveStr += move;
      } else if (index >= game.oldListLength && move.charAt(0) >= '0' && move.charAt(0) <= '3') {
        moveStr += move;
        needmove = true;
      }
    });
    //if (moveStr.length > 0) {
    if (needmove) {
      clientMove(0, moveStr);
    }
  },

  renderBoard: function() {
  },

  // Tell the server about our latest move
  sendMoveToServer: function(move) {
    // We're sending a move to the server, so our turn is over
    game.canMove = false;
    var data = {};
    if (move) {
      data.move = move;
    }

    // Send up a time update
    if (game.timeLimit && game.moveStart) {
      if (game.color == game.BLUE) {
        game.player1_time -= game.elapsedTime();
        data.time = game.player1_time;
      } else if (game.color == game.BROWN) {
        game.player2_time -= game.elapsedTime();
        data.time = game.player2_time;
      } else if (game.color == game.GREEN) {
        game.player3_time -= game.elapsedTime();
        data.time = game.player3_time;
      } else {
        game.player4_time -= game.elapsedTime();
        data.time = game.player4_time;
      }
      data.time = Math.max(data.time, 0);
      // Blow away the elapsed time
      delete game.moveStart;
    }

    // We're sending our move to the server - stop updating the board. When
    // this comes back, we'll refresh the board which will kick off a new
    // timer.
    window.clearTimeout(game.refreshGameTimer);
    delete game.refreshGameTimer;
    $(".busy").show();
    options = {
      url: "/game_ajax/" + game.gameKey + (move ? "/move" : "/time"),
      data: data,
      type: "POST",
      error: game.sendError,
      success: game.refreshBoard
      //success: game.sendSuccess
    };
    $.ajax(options);
  },

  //暂时没有使用这个函数
  sendSuccess: function() {
    if (game.pendingMove == null) {
      alert("怪事，发送成功，但是客户端什么地方出错了。刷新一下试试？");
    }
    game.moveList = game.moveList.concat(game.pendingMove);
    game.pendingMove = null;
    game.refreshBoard();
  },

  sendError: function() {
    alert("嗯？发送出错了！刷新一下页面再试试吧");
  },

  // Update our timestamp on the server - this is called by a timer periodically
  sendTimeToServer: function() {
    if (game.color == game.BLUE) {
      var time = Math.max(0, game.player1_time - game.elapsedTime());
    } else {
      var time = Math.max(0, game.player2_time - game.elapsedTime());
    }

    options = {
      url: "/game_ajax/" + game.gameKey + "/time",
      data: {time: time},
      type: "POST"
      // Ignore errors and success - this is just a non-critical attempt to
      // keep the server in-sync
    };
    $.ajax(options);

    // Fire off the next timer
    game.refreshGameTimer = window.setTimeout(game.sendTimeToServer, 5*1000);
  },

  updateHeader: function() {
    // Updates the header display when changes happen (game ends, etc)
    game.updateStatusDisplay();

    // Figure out if we can move
    if (game.color != null && game.status == game.ACTIVE) {
      var our_turn = false;
      if (game.game_type == 1) {
        if (game.whoseTurn == game.color || (game.whoseTurn + 2) % 4 == game.color) {
          our_turn = true;
        }
      } else {
        if (game.whoseTurn == game.color) {
          our_turn = true;
        }
      }
      if (our_turn) {
        // This is this user's turn - tell them
        if (!game.canMove) {
          // It's now our turn (it wasn't before) so start the timer
          game.canMove = true;
          if (game.whoseTurn == 0) {
            setControllable(true, false, false, false);
          } else if (game.whoseTurn == 1) {
            setControllable(false, true, false, false);
          } else if (game.whoseTurn == 2) {
            setControllable(false, false, true, false);
          } else if (game.whoseTurn == 3) {
            setControllable(false, false, false, true);
          }
          // Mark what time our move started
          game.moveStart = new Date().getTime();
        }
      } else {
        setControllable(false, false, false, false);
        // Not our turn - stop tracking our start time (checked below in
        // updateTime())
        delete game.moveStart;
      }
    } else {
      game.canMove = false;
    }

    // Wait for who
    $('#otherPlayer').text(game.getPlayerNameByColor(game.whoseTurn));
    $('#Player1').text(game.greenName);
    $('#Player2').text(game.yellowName);
    $('#Player3').text(game.blueName);
    $('#Player4').text(game.brownName);

    $('.title').hide();
    $('.statusTop').show();
    $('.statusBottom').show();

    if (game.timeLimit) {
      game.updateTime();
    }
  },

  updateStatusDisplay: function() {
    // Update the various turn indicators
    if (game.status != game.ACTIVE) {
        // Game is over, hide everything, show end game display
      $('.yourTurn').hide();
      $('.waitingForOpponent').hide();

      // Figure out why the game ended - either through resignation, a draw,
      // a timeout, or checkmate
      if (game.victor == 0) {
        var result = "平局结束";
      } else {
        if (game.victor == 1) {
          var winningColor = game.creator_color;
        } else {
          var winningColor = (game.creator_color + 1) % 4;
        }

        if (game.color != null) {
          // Participant is viewing
          var result = (winningColor == game.color || winningColor == (game.color + 2) % 4 ) ?
            "胜利" : "失败"
        } else {
          // Spectator is viewing
          var result = (winningColor == game.BLUE || winningColor == game.GREEN) ?
              "第一队胜利！" : "第二队胜利！";
        }

        if (game.getLastMove() == "resign") {
          result += " (" +
            ((winningColor == game.BLUE || winningColor == game.GREEN) ? "第二队" : "第一队") +
            " 认输)";
        } else if (game.timeLimit &&
                   (game.player1_time == 0 || game.player2_time == 0 || game.player3_time == 0 || game.player4_time == 0)) {
          result += " (超时)";
        }
      }
      $('.gameOver').text(result);
      $('.gameOver').corner({autoPad:true, validTags:["div"]});
      $('.gameOver').show();

    } else {
      if (game.color != null) {
        var our_turn = false;
        if (game.game_type == 1) {
          if (game.whoseTurn == game.color || (game.whoseTurn + 2) % 4 == game.color) {
            our_turn = true;
          }
        } else {
          if (game.whoseTurn == game.color) {
            our_turn = true;
          }
        }
        if (our_turn) {
          $('.waitingForOpponent').hide();
          $('.yourTurn').show();
          window.focus();
          //alert("Your trun");
        } else {
          $('.waitingForOpponent').show();
          $('.yourTurn').hide();
        }
      }
    }
  },

  elapsedTime: function() {
    // Returns the elapsed time from the start of the player's move
    return new Date().getTime() - game.moveStart;
  },

  updateTime: function() {
    // Updates the time display - calculate the time, and if it's the user's
    // turn to move then also incorporate the time delta
    var player1_time = game.player1_time;
    var player2_time = game.player2_time;
    if (game.moveStart) {
      if (game.color == game.BLUE) {
        player1_time -= game.elapsedTime();
      } else if (game.color == game.BROWN) {
        player2_time -= game.elapsedTime();
      }

      if (player1_time < 0 || player2_time < 0) {
        game.outOfTime();
      }
    }
    //game.setTime('#player1_time', Math.max(player1_time, 0));
    //game.setTime('#player2_time', Math.max(player2_time, 0));

    if (game.moveStart) {
      // Only need to update the time again if the user has a move timer
      timeDisplayTimer = window.setTimeout(game.updateTime,
                                           game.TIMER_UPDATE_INTERVAL);
    }
  },

  outOfTime: function() {
    // Called when the user runs out of time
    // Disable any moves, and send the time update to the server
    game.sendMoveToServer();

    // Just wait for the response to come back - this will automatically cause
    // the end game to be reflected on the screen
  },

  resign: function() {
    game.sendMoveToServer("resign");
  },

  setTime: function(element, timeRemaining) {
    // Format the time remaining in MM:SS format (or, conversely, in SS.T)
    // format where T = tenths of seconds)
    if (timeRemaining >= 60*1000) {
      // > 1 minute
      var minutes = Math.floor(timeRemaining/60000);
      var seconds = Math.floor(timeRemaining/1000) % 60;
      var timeStr = "" + minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    } else {
      var tenths = Math.floor(timeRemaining/100);
      var timeStr = "" + Math.floor(tenths/10) + "." + (tenths % 10);
    }
    $(element).text(timeStr);
    $(".timeDisplay").show();
    if (timeRemaining < 30000) {
      // Highlight the time if there's < 30 secs
      $(element).addClass("critical")
    }
  },

  resignGame: function() {
    if (game.canMove) {
      if (confirm("你真的要认输吗？")) {
        // Make sure the user can still move - events may have been processed
        // while we were blocked on the dialog
        if (game.canMove) {
          game.sendMoveToServer("resign");
        }
      }
    }
  },

  offerDraw: function() {
    if (game.canMove) {
      if (confirm("你真的要请求和棋吗？")) {
        // Make sure the user can still move - events may have been processed
        // while we were blocked on the dialog
        if (game.canMove) {
          game.sendMoveToServer('offerDraw');
        }
      }
    }
  },

  acceptDraw: function() {
    if (game.canMove) {
      game.sendMoveToServer('draw')
    }
    $.modal.close();
  },

  rejectDraw: function() {
    if (game.canMove) {
      game.sendMoveToServer('reject')
    }
    $.modal.close();
  },

  //----------------------------------------
  // Chat handling code
  initChat: function() {
    if (!game.chatInitialized) {
      game.chatInitialized = true;

      // Make sure chat is visible
      $('.chatGroup').show();

      // Initialize the chat text input to send contents when enter pressed
      $("#chatInput").keypress(function(e) {
          if (e.keyCode == 13) {
            game.sendChat();
          }
        });

      // Kick off the chat timer/refresh
      game.refreshChat();
    }
  },

  forceRefreshChat: function() {
    if (game.refreshChatTimer) {
      // If a timer exists, then force a refresh (if a timer exists, it means
      // that there isn't a refresh in process)
      game.refreshChat();
    }
  },

  refreshChat: function() {
    // Stop any existing timer (so if we're called from forceRefreshChat() we
    // won't get dual timers running
    if (game.refreshChatTimer) {
      window.clearTimeout(game.refreshChatTimer);
      delete game.refreshChatTimer;
    }

    var options = {
      url: "/game_ajax/chat/" + game.gameKey + "/" + game.chatId,
      dataType: "json",
      // Avoid caching of HTTP GETs
      data: {z: new Date().getTime()},
      error: blitz.retryOnFail,
      success: game.handleChatResponse
    };
    $.ajax(options);
  },

  sendChat: function() {
    // Grab the string the user entered and send it to the server
    var data = $("#chatInput").val();
    data = jQuery.trim(data);
    if (data.length > 0) {
      $("#chatInput").val("");
      var options = {
        url: "/game_ajax/" + game.gameKey + "/chat",
        data: {chat: data},
        type: "POST",
        error: blitz.retryOnFail,
        success: game.forceRefreshChat
      };
      $.ajax(options);
    }
  },

  handleChatResponse: function(data) {
    // Got a response from the server - update our chat and fire off another
    // refresh in 5 secs.
    game.chatId = data.msg_id;
    chat.updateChat(data.data);
    game.refreshChatTimer = window.setTimeout(game.refreshChat, 5*1000);
  }

};

