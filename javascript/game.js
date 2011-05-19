
$(document).ready(function() {
  startCheckFlash();
});

function launchGame() {
    // Setup click handlers on all of our menu items
    $("a.btn").click(function(args) {
        // Map from the ID of the button to a function - look in blitz, lobby
        // and game
        var func = game[this.id];
        var ref = this.getAttribute('ref');
        var guid = this.getAttribute('guid');
        if (func) {
          func(ref ? ref : guid);
        } else {
          alert("No handler for " + this.id);
        }
    });

    // IE wants an href on every <a> tag, or it won't give you hover styles
    $("a.btn").each(function(index) {
        $(this).attr({'href' : '#'});
    });


  // Start refreshing the page as soon as we are loaded
  game.refreshBoard();

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

  // The list of moves that were sent from the server
  moveList: [],
  oldListLength: 0,

  // How often we redraw the timers, in milliseconds
  TIMER_UPDATE_INTERVAL: 5000,

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
        return "error";
    }
  },

  refreshBoard: function() {
    // hit the ajax handler to load our game data
    var options = {
      url: "ajax_game.php",
      dataType: "json",
      // Avoid caching of HTTP GETs by appending a random param
      data: {z: new Date().getTime(), action: "get", guid: game.guid, movelength: game.moveList.length},
      error: common.retryOnFail,
      success: game.updateGameDisplay
    };
    $.ajax(options);
  },

  // Handle a game update from the server - update our game state, then
  // update the ui.
  updateGameDisplay: function(response) {
    $(".busy").hide();
    if (response.ret == "notlogin") {
      alert("You are not logged in.");
      return;
    }
    var data = response.data;
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

    // Get the player names
    var playerNameArray = new Array(4);
    playerNameArray[0] = data.player1_name;
    playerNameArray[1] = data.player2_name;
    playerNameArray[2] = data.player3_name;
    playerNameArray[3] = data.player4_name;
    game.greenName  = playerNameArray[(4-data.creator_color)%4];
    game.yellowName = playerNameArray[(5-data.creator_color)%4];
    game.blueName   = playerNameArray[(6-data.creator_color)%4];
    game.brownName  = playerNameArray[(7-data.creator_color)%4];

    // Update the board with the latest moves
    game.updateBoard();

    // Update the header with time elapsed, etc - also refreshes our internal
    // variables
    game.updateHeader();

    // If it's still not our turn, kick off the refresh timer to check for
    // updates from the server
    if (game.status == game.ACTIVE) {
      if (game.canMove) {

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
        common.initAndDisplayDialog("#acceptDrawDialog");
      } else if (game.getLastMove() == 'reject') {
        common.initAndDisplayDialog("#drawRefusedDialog");
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
    if (needmove) {
      clientMove(0, moveStr);
    }
  },

  // Tell the server about our latest move
  sendMoveToServer: function(move) {
    // We're sending a move to the server, so our turn is over
    game.canMove = false;
    var data = {};
    if (move) {
      data.move = move;
    }

    // We're sending our move to the server - stop updating the board. When
    // this comes back, we'll refresh the board which will kick off a new
    // timer.
    window.clearTimeout(game.refreshGameTimer);
    delete game.refreshGameTimer;
    $(".busy").show();
    options = {
      url: "ajax_game.php?action=move&guid="+game.guid, //"/game_ajax/" + game.gameKey + (move ? "/move" : "/time"),
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
        }
      }
      $('.gameOver').text(result);
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

  resign: function() {
    game.sendMoveToServer("resign");
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
};

