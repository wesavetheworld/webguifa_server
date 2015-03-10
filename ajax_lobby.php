<?php

define('PUN_ROOT', dirname(__FILE__).'/');
require PUN_ROOT.'include/common.php';
require PUN_ROOT.'include/guifa_functions.php';

//$data = json_decode(file_get_contents("php://input"), true);
$data = $_GET;

$action = isset($data['action']) ? $data['action'] : '';

// Send no-cache headers
header('Expires: Thu, 21 Jul 1977 07:30:00 GMT'); // When yours truly first set eyes on this world! :)
header('Last-Modified: '.gmdate('D, d M Y H:i:s').' GMT');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache'); // For HTTP/1.0 compatibility

// Send the Content-type header in case the web server is setup to send something else
header('Content-type: application/json; charset=utf-8');

$value = array();

$result = null;

$value['ret'] = 'error';
if ($pun_user['is_guest'])
{
    $value['ret'] = 'notlogin';
}
else if ($action == 'list')
{
	$result = $db->query('SELECT * FROM '.$db->prefix.'games WHERE status IN (0,2,3,4) ORDER BY created DESC LIMIT 50') or guifa_error('Unable to fetch games info', __FILE__, __LINE__, $db->error());
    if ($db->num_rows($result))
    {
        $games = array();
		while ($cur_game = $db->fetch_assoc($result))
        {
            $is_creator = $cur_game['player1'] == $pun_user['id'] ? 1 : 0;
            $is_participant = 0;
            if ($cur_game['player1'] == $pun_user['id'] || $cur_game['player2'] == $pun_user['id'] || $cur_game['player3'] == $pun_user['id'] || $cur_game['player4'] == $pun_user['id'])
            {
                $is_participant = 1;
            }
            $can_delete = 0;
            if ($is_creator == 1 && strlen($cur_game['game_data']) == 0)
            {
                $can_delete = 1;
            }
            $games[] = array('guid'=>$cur_game['guid'],
                    'player1_name'=>$cur_game['player1_name'],
                    'player2_name'=>$cur_game['player2_name'],
                    'player3_name'=>$cur_game['player3_name'],
                    'player4_name'=>$cur_game['player4_name'],
                    'game_type'=>intval($cur_game['game_type']),
                    'is_creator'=>intval($is_creator),
                    'is_participant'=>intval($is_participant),
                    'created'=>format_time($cur_game['created']),
                    'status'=>intval($cur_game['status']),
                    'can_delete'=>intval($can_delete),
                    );
        }
		$value['game_list'] = $games;
    }

    $value['ret'] = 'ok';
}
else if ($action == 'create')
{
    $game_type = isset($data['game_type']) ? intval($data['game_type']) : 1;
    $player1 = $pun_user['id'];
    $player1_name = $pun_user['username'];
    $player3 = 0;
    $player3_name = '';
    if ($game_type == 1)
    {
        $player3 = $pun_user['id'];
        $player3_name = $pun_user['username'];
    }

    $player1_color = isset($data['player1_color']) ? intval($data['player1_color']) : 0;
    $player2_color = ($player1_color + 1) % 4;
    $player3_color = ($player1_color + 2) % 4;
    $player4_color = ($player1_color + 3) % 4;

	$now = time();

    $db->query('INSERT INTO '.$db->prefix.'games (guid, player1, player2, player3, player4, player1_color, player2_color, player3_color, player4_color, player1_name, player2_name, player3_name, player4_name, status, game_type, game_data, created, last_modified) VALUES(\''.uniqid().'\', '.$player1.', 0, '.$player3.', 0, '.$player1_color.', '.$player2_color.', '.$player3_color.', '.$player4_color.', \''.$db->escape($player1_name).'\', \'\', \''.$db->escape($player3_name).'\', \'\', 0, '.$game_type.', \'\', '.$now.', '.$now.')') or guifa_error('Unable to create game', __FILE__, __LINE__, $db->error());
    $value['ret'] = 'ok';
}
else if ($action == 'delete')
{
    $db->query('DELETE FROM '.$db->prefix.'games WHERE guid=\''.$db->escape($data['guid']).'\' AND player1='.$pun_user['id']) or guifa_error('Unable to delete game', __FILE__, __LINE__, $db->error());
    $value['ret'] = 'ok';
}
else if ($action == 'join')
{
    $seat = isset($data['seat']) ? intval($data['seat']) : 0;
    if ($seat >= 2 && $seat <= 4)
    {
        $result = $db->query('SELECT * FROM '.$db->prefix.'games WHERE guid=\''.$db->escape($data['guid']).'\' AND status=0') or guifa_error('Unable to fetch games info', __FILE__, __LINE__, $db->error());
        if ($db->num_rows($result))
        {
            if ($cur_game = $db->fetch_assoc($result))
            {
                if ($cur_game['player1'] != $pun_user['id'])
                {
                    if ($cur_game['game_type'] == 1)
                    {
                        $player_sql = 'player2='.$pun_user['id'].', player2_name=\''.$db->escape($pun_user['username']).'\', player4='.$pun_user['id'].', player4_name=\''.$db->escape($pun_user['username']).'\', status=2';
                    }
                    else
                    {
                        $player_sql = 'player'.$seat.'='.$pun_user['id'].', player'.$seat.'_name=\''.$db->escape($pun_user['username']).'\'';

                        $flag = 0;
                        $i = 2;
                        while ($i <= 4)
                        {
                            if ($cur_game['player'.$i] != 0)
                                $flag += $i * $i;
                            $i++;
                        }
                        $flag += $seat * $seat;
                        if ($flag == (4+9+16))
                            $player_sql = $player_sql.', status=2';
                    }
                    $db->query('UPDATE '.$db->prefix.'games SET '.$player_sql.' WHERE guid=\''.$db->escape($data['guid']).'\'') or guifa_error('Unable to update game', __FILE__, __LINE__, $db->error());
                    $value['ret'] = 'ok';
                }
            }
        }
    }
}
else if ($action == 'start')
{
    $result = $db->query('SELECT * FROM '.$db->prefix.'games WHERE guid=\''.$db->escape($data['guid']).'\' AND status=2') or guifa_error('Unable to fetch games info', __FILE__, __LINE__, $db->error());
    if ($db->num_rows($result))
    {
        if ($cur_game = $db->fetch_assoc($result))
        {
            if ($cur_game['player1'] == $pun_user['id'])
            {
                $db->query('UPDATE '.$db->prefix.'games SET status=3 WHERE guid=\''.$db->escape($data['guid']).'\'') or guifa_error('Unable to update game', __FILE__, __LINE__, $db->error());
                $value['ret'] = 'ok';
            }
        }
    }
}
else
{
}

if ($value['ret'] == 'error')
{
    header('HTTP/1.1 403 Forbidden');
}

echo json_encode($value);

$db->end_transaction();
$db->close();

