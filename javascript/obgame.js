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


  refreshBoard: function() {
    // hit the ajax handler to load our game data
    var options = {
      url: "/ob_ajax/move/" + game.gameKey + "/" + game.moveList.length,
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
    }

    // Update the board with the latest moves
    game.updateBoard();

    game.updateStatusDisplay();
    // Wait for who
    $('#Player1').text(game.greenName);
    $('#Player2').text(game.yellowName);
    $('#Player3').text(game.blueName);
    $('#Player4').text(game.brownName);

    $('.title').hide();
    $('.statusTop').show();
    $('.statusBottom').show();

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

    }
  },

  elapsedTime: function() {
    // Returns the elapsed time from the start of the player's move
    return new Date().getTime() - game.moveStart;
  }

};

