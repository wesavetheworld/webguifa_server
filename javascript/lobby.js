$(document).ready(function() {
    // Setup click handlers on all of our menu items
    $("a.btn").click(function(args) {
        // Map from the ID of the button to a function - look in blitz, lobby
        // and game
        var func = lobby[this.id];
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


    // Start refreshing the page as soon as we're loaded
    lobby.refresh();
});

var lobby = {
  GAME_STATUS_READY:2,
  GAME_STATUS_ACTIVE:3,
  GAME_STATUS_COMPLETE:4,
  ignoreMap: {},

  forceRefresh: function() {
    // If there's not already a refresh in process, refresh immediately.
    if (lobby.refreshTimer) {
      // There's a timer, which means there's no refresh in process, so
      // fire off the refresh - this will stop the existing timer so we don't
      // get a double update.
      lobby.refresh();
    }
  },

  // Calls the server to refresh the player list, chat window, and open games
  refresh: function() {
    // Stop any existing timer
    if (lobby.refreshTimer) {
      window.clearTimeout(lobby.refreshTimer);
      delete lobby.refreshTimer;
    }
    // Turn on to display busy cursor during ajax calls for debugging
    // $(".busy").show();
    var options = {
      url: "ajax_lobby.php",
      // Add random param to URL to avoid browser caching of HTTP GETs
      data: {z: new Date().getTime(), action: 'list'},
      dataType: "json",
      error: common.retryOnFail,
      success: lobby.handleAjaxListResponse
    };
    $.ajax(options);
  },

  handleAjaxListResponse: function(data) {
    // We got our response - make sure the busy cursor is off
    $(".busy").hide();
    if (data.ret != "ok") {
      if (data.ret == "notlogin") {
        alert("You are not logged in.");
      }
      return;
    }

    lobby.updateGameList(data.game_list);

    // Refresh the data every 5 secs
    lobby.refreshTimer = window.setTimeout(lobby.refresh, 10*1000);
  },

  handleAjaxCreateResponse: function(data) {
    // We got our response - make sure the busy cursor is off
    $(".busy").hide();
    if (data.ret != "ok") {
      if (data.ret == "notlogin") {
        alert("You are not logged in.");
      } else {
        alert("Failed");
      }
      return;
    }

    lobby.forceRefresh();
  },

  updateGameList: function(gameList) {
    // Generate content of game table based on what was sent to us
    content = "";
    jQuery.each(gameList, function(index, game) {
      content += "<tr><td>" + game.created + "</td><td>" + game.player1_name + "</td><td>"
      actionjoin = [];

      var genjoin = function (guid, seat) {
        return '<a class="btn" href="#" id="joinGame" guid="' + guid + '" seat="' + seat + '">加入</a>';
      };
      if (game.is_participant == 0) {
        if (game.game_type == 1) {
          content += "关闭</td><td>" + (game.player2_name == "" ? genjoin(game.guid, 2) : game.player2_name) + "</td><td>" + "关闭</td><td>";
        } else {
          content += (game.player3_name == "" ? genjoin(game.guid, 3) : game.player3_name) + "</td><td>";
          content += (game.player2_name == "" ? genjoin(game.guid, 2) : game.player2_name) + "</td><td>";
          content += (game.player4_name == "" ? genjoin(game.guid, 4) : game.player4_name) + "</td><td>";
        }
      } else {
        if (game.game_type == 1) {
          content += "关闭</td><td>" + (game.player2_name == "" ? "打开" : game.player2_name) + "</td><td>" + "关闭</td><td>";
        } else {
          content += (game.player3_name == "" ? "打开" : game.player3_name) + "</td><td>";
          content += (game.player2_name == "" ? "打开" : game.player2_name) + "</td><td>";
          content += (game.player4_name == "" ? "打开" : game.player4_name) + "</td><td>";
        }
      }

      action = [];
      if (game.is_participant == 1) {
        if (game.is_creator) {
          if (game.status == lobby.GAME_STATUS_READY) {
            action.push({id: "startGame", label: "开始"});
          } else if (game.status == lobby.GAME_STATUS_ACTIVE) {
            action.push({id: "goGame", label: "进入"});
          }
          if (game.can_delete == 1) {
            action.push({id: "deleteGame", label: "撤销"});
          }
        } else {
          if (game.status == lobby.GAME_STATUS_ACTIVE)
          {
            action.push({id: "goGame", label: "进入"});
          }
          // If the user is a participant in an active blitz game, warn
          // them and let them enter.
          if (!lobby.ignoreMap[game.guid] && game.status == lobby.GAME_STATUS_ACTIVE) {
            // Don't prompt about this game again.
            lobby.ignoreMap[game.guid] = true;
            lobby.displayEnterDialog(game.player1_name, game.guid);
          }
        }
      } else if (game.status == lobby.GAME_STATUS_ACTIVE) {
        action.push({id: "goGame", label: "旁观"});
      }
      if (game.status == lobby.GAME_STATUS_COMPLETE) {
        action.push({id: "goGame", label: "回顾"});
      }
      if (action.length == 0) {
        content += "&nbsp;";
      } else {
        jQuery.each(action, function(index, item) {
          if (index > 0) {
            content += "&nbsp;";
          }
          content += '<a class="btn" href="#" guid="' + game.guid+ '" id="' + item.id + '">' + item.label + "</a>";
        });
      }
      content += "</td></tr>";
    });
    // Remove the old games, replace with new content
    $(".gameTable tr").remove();
    if (content.length) {
      $(".gameTable").append(content);
    }

    // Setup click handlers for the newly added buttons.
    $(".gameTable a").click(function(args) {
        var key = this.getAttribute('guid');
        var seat = this.getAttribute('seat');
        var func = lobby[this.id];
        func(key, seat);
    });

  },

  sendGameOffer: function() {
    var offer = $("#offerForm").serialize();
    var options = {
      url: "ajax_lobby.php",
      // Add random param to URL to avoid browser caching of HTTP GETs
      //data: {action: 'create', game_type: 1, player1_color: 1},
      data: offer,
      dataType: "json",
      success: lobby.handleAjaxCreateResponse,
      error: function() {
        alert("失败了");
      }
    };
    $.ajax(options);
    $.modal.close();
  },

  deleteGame: function(guid) {
    $(".busy").show();
    var options = {
      url: "ajax_lobby.php",
      data: {action: 'delete', guid: guid},
      success: lobby.forceRefresh,
      error: function() {
        alert("失败了");
      }
    };
    $.ajax(options);
  },

  startGame: function(guid) {
    var options = {
      url: "ajax_lobby.php",
      data: {action: 'start', guid: guid},
      success: function() {
        top.location.href = "game.php?guid=" + guid;
      },
      error: function() {
        alert("失败了");
      }
    }
    $.ajax(options);
  },

  goGame: function(guid) {
    top.location.href = "game.php?guid=" + guid;
  },

  joinGame: function(guid, seat) {
    var options = {
      url: "ajax_lobby.php",
      data: {action: 'join', guid: guid, seat: seat},
      success: lobby.forceRefresh,
      error: function() {
        alert("无法加入对局");
        lobby.forceRefresh();
      }
    };
    $.ajax(options);
  },

  closeModal: function() {
    $.modal.close();
  },

  offerNewGame: function() {
    common.initAndDisplayDialog("#offerBlitzGameDialog");
  },

  displayEnterDialog: function(opponent, key) {
    $('#blitzCreator').text(opponent);
    $('#goGame').attr({key: key});
    common.initAndDisplayDialog("#enterDialog");
    $('#goGame').attr({ref: key});
  }
};

