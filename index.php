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

$page_title = array(pun_htmlspecialchars($pun_config['o_board_title']));
define('PUN_ALLOW_INDEX', 1);
define('PUN_ACTIVE_PAGE', 'index');
require PUN_ROOT.'header.php';

?>
<script type="text/javascript" src="javascript/jquery-1.2.3.js"></script>
<script type="text/javascript" src="javascript/jquery.simplemodal.js"></script>
<script type="text/javascript" src="javascript/common.js"></script>
<script type="text/javascript" src="javascript/lobby.js"></script>
<div class="linkst">
    <div class="inbox crumbsplus">
        <div class="pagepost">
            <p class="postlink conr">
                <a class="btn" id="offerNewGame">建立对局</a>
            </p>
        </div>
        <div class="clearer"></div>
    </div>
</div>
<div id="lobby" class="blocktable">
	<div class="box">
		<div class="inbox">
            <img class="busy" src="/images/spin32.gif"/>

			<table cellspacing="0">
                <thead>
                    <tr>
                        <th></th>
                        <th colspan="2">队伍1</th>
                        <th colspan="2">队伍2</th>
                        <th></th>
                    </tr>
                    <tr>
                        <th>创建时间</th>
                        <th>棋手1</th>
                        <th>棋手3</th>
                        <th>棋手2</th>
                        <th>棋手4</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody class="gameTable">
                    <tr>
                        <td colspan="4">
                              等待服务器响应...
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<div id="offerBlitzGameDialog" class="dialogContent" style="display:none">
	<div class="dialogTitle">建立公共对局</div>
	<div class="dialogBody">
		这项操作将建立新的公共对局，任何人都可以加入<br/><br/>
		<form id="offerForm">
			<div class="radioGroup">
				<input type="hidden" name="action" value="create"/>
				棋手数量：<br/>
				<input type="radio" checked="checked" name="game_type" value="1"/>双人对局<br/>
				<input type="radio" name="game_type" value="2"/>四人对局<br/>
				选一个颜色：<br/>
				<input type="radio" checked="checked" name="player1_color" value="0"/>绿色<br/>
				<input type="radio" name="player1_color" value="1"/>黄色<br/>
				<input type="radio" name="player1_color" value="2"/>蓝色<br/>
				<input type="radio" name="player1_color" value="3"/>褐色<br/>
			</div>
		</form>
		<div	class="buttonBar">
			<span>
				<a class="btn" id="sendGameOffer" >建立对局</a>
				&nbsp;
				<a class="btn" id="closeModal">取消</a>
			</span>
		</div>
	</div>
</div>

<div id="enterDialog" class="dialogContent" style="display:none">
	<div class="dialogTitle">进入对局</div>
	<div class="dialogBody">
		你正在参与一个已经开始的对局。建立者是： <span id="blitzCreator">creator</span>.
	</div>
	<div class="buttonBar">
		<a class="btn" id="goGame">进入对局</a>
		&nbsp;
		<a class="btn" id="closeModal">回到大厅</a>
	</div>
</div>

<?php
require PUN_ROOT.'footer.php';
