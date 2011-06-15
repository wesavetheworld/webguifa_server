var common = {
  initAndDisplayDialog: function(dialog) {
    // Clear out any errors and text fields
    $(dialog).find(".error").hide();
    $(dialog).find(":text").val("");
    $(dialog).modal();
  },

  // Error handler for ajax requests
  retryOnFail: function (xhr, textStatus, errorThrown) {
    if (xhr.status == 410) {
      // Whatever entity we are trying to access has been deleted
      alert("Sorry, this game has been deleted.");
      blitz.clickHandlers.enterLobby();
      return;
    }
    // Just try sending the request again - if the server is down, this can
    // lead to an infinite loop, so we put in a delay and try it every few
    // seconds.
    var ajaxOptions = this;
    window.setTimeout(function() { $.ajax(ajaxOptions);}, 2*1000);
  },

  dialogActive: function() {
    // Returns true if there's currently a dialog up - useful if we want to
    // avoid displaying multiple dialogs at once
    return ($.modal.impl && $.modal.impl.dialog && $.modal.impl.dialog.data);
  }


};
