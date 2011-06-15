<?php

/**
 * Copyright (C) 2008-2011 FluxBB
 * based on code by Rickard Andersson copyright (C) 2002-2008 PunBB
 * License: http://www.gnu.org/licenses/gpl.html GPL version 2 or higher
 */

define('PUN_ROOT', dirname(__FILE__).'/');
require PUN_ROOT.'include/common.php';

if ($pun_user['is_guest'])
{
    redirect('login.php', $lang_common['No permission']);
}

$guid = isset($_GET['guid']) ? $_GET['guid'] : null;
if ($guid == null)
	message($lang_common['Bad request']);

$page_title = array(pun_htmlspecialchars($pun_config['o_board_title']));
define('PUN_ALLOW_INDEX', 1);
define('PUN_ACTIVE_PAGE', 'index');
require PUN_ROOT.'header.php';

?>
<div class="title">接收数据中……（如果30秒还没响应，请刷新重试）</div>
<img class="busy" src="/images/spin32.gif"/>
<div class="waitingForOpponent" style="display:none">
        等待其他棋手:<span id="otherPlayer">&nbsp;</span>
</div>
<div class="yourTurn" style="display:none">
    轮到你走
    &nbsp;<a class="btn" id="resignGame">认输</a>
</div>
<div class="gameOver" style="display:none">
    &nbsp;
</div>
<div>
    &nbsp;
</div>
<div class="statusTop" style="display:none">
    <span id="Player1" style="color:green">&nbsp;</span>
    <span id="Player2" style="color:orange">&nbsp;</span>
    <span id="Player3" style="color:blue">&nbsp;</span>
    <span id="Player4" style="color:brown">&nbsp;</span>
</div>
<script type="text/javascript" src="javascript/jquery-1.2.3.js"></script>
<script type="text/javascript" src="javascript/jquery.simplemodal.js"></script>
<script type="text/javascript" src="javascript/common.js"></script>
<script type="text/javascript" src="javascript/game.js"></script>

<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" codebase="http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=9,0,0,0" width="800" height="600" id="guifa" align="middle"> <param name="allowScriptAccess" value="sameDomain" /> <param name="allowFullScreen" value="false" /> <param name="movie" value="swf/game.swf" /> <param name="quality" value="high" /> <param name="bgcolor" value="#8a562e" /> <embed src="swf/game.swf" quality="high" bgcolor="#8a562e" width="800" height="600" name="guifa" align="middle" allowScriptAccess="sameDomain" allowFullScreen="false" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer" /> </object>

<script language="javascript">AC_FL_RunContent = 0;</script>
<script type="text/javascript" src="swf/AC_RunActiveContent.js"></script>
<script language="JavaScript">
    game.guid = "<?php echo $guid ?>";
    var jsReady = false;
    var theGame = null;
    var checkFlashTimer = null;
    function isReady() {
        return jsReady;
    }
    function setInteract(value) {
        document.forms["frmConsole"].interact.value = value;
    }
    function getInteract() {
        return document.forms["frmConsole"].interact.value
    }
    function initPage() {
        if (!jsReady) {
            jsReady = true;
            theGame = isIE ? window["guifa"] : document["guifa"];
        }
    }
    function sendStep(descr) {
        // Only game when is active and only participant can move
        if (game.status == game.ACTIVE && game.color != null) {
            //记下棋步，发送成功后添加到历史记录中。
            //暂时没有使用，因为没有必要，而且reject等命令也需要记入pendingMove
            //game.pendingMove = descr;
            game.sendMoveToServer(descr.slice(24));
            //为什么不在发送时同时将棋步添加到历史记录中：
            //因为发送有可能因网络原因失败，因此一定需要根据
            //服务器的反馈更新。
            //
            //game.moveList = game.moveList.concat(descr);
        }
    }
    function clientMove(index, move) {
        theGame.performStepString(index, move);
    }
    function setControllable(s1, s2, s3, s4) {
        theGame.canMove(s1, s2, s3, s4);
    }
    function setStartFrom(start) {
        theGame.startFrom(start);
    }
    function setAllowBrowseHistory(allow) {
        theGame.setAllowBrowseHistory(allow);
    }
</script>
<script type="text/javascript">
    function checkFlashReady() {
        if (theGame && theGame.performStepString) {
            window.clearTimeout(checkFlashTimer);
            launchGame();
        } else {
            checkFlashTimer = window.setTimeout(checkFlashReady, 1000);
        }
    }
    function startCheckFlash() {
        initPage();
        checkFlashTimer = window.setTimeout(checkFlashReady, 1000);
    }
    //window.onload=startCheckFlash();
</script>




<?php
require PUN_ROOT.'footer.php';
