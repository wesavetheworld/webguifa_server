<?php

define('PUN_ROOT', dirname(__FILE__).'/');
require PUN_ROOT.'include/common.php';
require PUN_ROOT.'include/guifa_functions.php';

function next_turn($cur_game)
{
    $player_defeated_map = array(
            $cur_game['player1_color']=>$cur_game['player1_defeated'],
            $cur_game['player2_color']=>$cur_game['player2_defeated'],
            $cur_game['player3_color']=>$cur_game['player3_defeated'],
            $cur_game['player4_color']=>$cur_game['player4_defeated'],
            );
    $count = 0;
    $next = ($cur_game['current_turn'] + 1) % 4;
    while ( $player_defeated_map[$next] == 1 )
    {
        $next = ($next + 1) % 4;
        $count ++;
        if ($count > 4)
        {
            guifa_error('error game data');
        }
    }
    return $next;
}

function is_our_turn($id, $cur_game)
{
    $color_player_map = array(
            $cur_game['player1_color']=>$cur_game['player1'],
            $cur_game['player2_color']=>$cur_game['player2'],
            $cur_game['player3_color']=>$cur_game['player3'],
            $cur_game['player4_color']=>$cur_game['player4'],
            );
    if ($color_player_map[$cur_game['current_turn']] == $id)
    {
        return true;
    }
    return false;
}

//$data = json_decode(file_get_contents("php://input"), true);
$data = $_GET;

$action = isset($data['action']) ? $data['action'] : '';

$guid = isset($data['guid']) ? $data['guid'] : '';

// Params
$param = isset($data['params']) ? $data['params']: array();

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
else if ($action == 'get')
{
    $movelength = isset($data['movelength']) ? intval($data['movelength']) : 0;

	$result = $db->query('SELECT * FROM '.$db->prefix.'games WHERE status IN (3,4) AND guid=\''.$guid.'\'') or guifa_error('Unable to fetch games info', __FILE__, __LINE__, $db->error());
    if ($db->num_rows($result))
    {
		$cur_game = $db->fetch_assoc($result);

        $is_participant = 0;
        if ($cur_game['player1'] == $pun_user['id'] || $cur_game['player2'] == $pun_user['id'] || $cur_game['player3'] == $pun_user['id'] || $cur_game['player4'] == $pun_user['id'])
        {
            $is_participant = 1;
        }
        $user_color = -1;
        if ($cur_game['player1'] == $pun_user['id'])
        {
            $user_color = $cur_game['player1_color'];
        }
        else if ($cur_game['player2'] == $pun_user['id'])
        {
            $user_color = $cur_game['player2_color'];
        }
        else if ($cur_game['player3'] == $pun_user['id'])
        {
            $user_color = $cur_game['player3_color'];
        }
        else if ($cur_game['player4'] == $pun_user['id'])
        {
            $user_color = $cur_game['player4_color'];
        }
        $game_data = explode(",", $cur_game['game_data']);
        if ($movelength > count($game_data))
        {
            guifa_error("movelength > game_data length");
        }
        $data = array('guid'=>$cur_game['guid'],
                'player1_name'=>$cur_game['player1_name'],
                'player2_name'=>$cur_game['player2_name'],
                'player3_name'=>$cur_game['player3_name'],
                'player4_name'=>$cur_game['player4_name'],
                'player1_time'=>$cur_game['player1_time'],
                'player2_time'=>$cur_game['player2_time'],
                'player3_time'=>$cur_game['player3_time'],
                'player4_time'=>$cur_game['player4_time'],
                'creator_color'=>intval($cur_game['player1_color']),
                'user_color'=>intval($user_color),
                'game_type'=>intval($cur_game['game_type']),
                'is_participant'=>intval($is_participant),
                'status'=>intval($cur_game['status']),
                'victor'=>intval($cur_game['victor']),
                'whose_turn'=>intval($cur_game['current_turn']),
                'game_data'=>array_splice($game_data, $movelength),
                );
        $value['data'] = $data;
        $value['ret'] = 'ok';
    }
}
else if ($action == 'move')
{
    $move = isset($_POST['move']) ? $_POST['move'] : null;
    if ($move == null)
    {
        guifa_error('no move data');
    }

    $now = time();

	$result = $db->query('SELECT * FROM '.$db->prefix.'games WHERE status=3 AND guid=\''.$db->escape($guid).'\'') or guifa_error('Unable to fetch games info', __FILE__, __LINE__, $db->error());
    if ($db->num_rows($result))
    {
		$cur_game = $db->fetch_assoc($result);

        $is_participant = 0;
        if ($cur_game['player1'] == $pun_user['id'] || $cur_game['player2'] == $pun_user['id'] || $cur_game['player3'] == $pun_user['id'] || $cur_game['player4'] == $pun_user['id'])
        {
            $is_participant = 1;
        }

        if ($is_participant == 1 && is_our_turn($pun_user['id'], $cur_game))
        {
            $defeated_map = array(
                    $cur_game['player1_color']=>"player1_defeated",
                    $cur_game['player2_color']=>"player2_defeated",
                    $cur_game['player3_color']=>"player3_defeated",
                    $cur_game['player4_color']=>"player4_defeated",
                    );
            $additional_sql = '';
            if ($move == 'resign')
            {
                //$cur_game[$defeated_map[$cur_game['current_turn']]] = 1;
                if ($cur_game['current_turn'] == $cur_game['player1_color'] || $cur_game['current_turn'] == $cur_game['player3_color'] )
                {
                    $cur_game['player1_defeated'] = 1;
                    $cur_game['player3_defeated'] = 1;
                }
                else
                {
                    $cur_game['player2_defeated'] = 1;
                    $cur_game['player4_defeated'] = 1;
                }
            }
            $move_array = str_split($move);
            if ($move_array[count($move_array)-2] == '!')
            {
                $dataarray = explode("!", $move);
                $move = $dataarray[0];
                if ($dataarray[1] == '')
                {
                    if ($dataarray[2] == $cur_game['player1_color'] || $dataarray[2] == $cur_game['player3_color'] )
                    {
                        $cur_game['player2_defeated'] = 1;
                        $cur_game['player4_defeated'] = 1;
                    }
                    else
                    {
                        $cur_game['player1_defeated'] = 1;
                        $cur_game['player3_defeated'] = 1;
                    }
                }
                else
                {
                    $cur_game[$defeated_map[$dataarray[1]]] = 1;
                }
            }
            if ($cur_game['player1_defeated'] == 1 && $cur_game['player3_defeated'] == 1)
            {
                $cur_game['victor'] = 2;
                $cur_game['status'] = 4;
            }
            else if ($cur_game['player2_defeated'] == 1 && $cur_game['player4_defeated'] == 1)
            {
                $cur_game['victor'] = 1;
                $cur_game['status'] = 4;
            }
            $game_data = explode(",", $cur_game['game_data']);

            if (count($game_data) > 0)
            {
                $time_map = array(
                        $cur_game['player1_color']=>"player1_time",
                        $cur_game['player2_color']=>"player2_time",
                        $cur_game['player3_color']=>"player3_time",
                        $cur_game['player4_color']=>"player4_time",
                        );
                $cur_game[$time_map[$cur_game['current_turn']]] = $cur_game[$time_map[$cur_game['current_turn']]] + $now - $cur_game['last_modified'];
                $cur_game['last_modified'] = $now;
            }
            $game_data[] = $move;
            $cur_game['game_data'] = implode(",", $game_data);
            $cur_game['current_turn'] = next_turn($cur_game);
            $db->query('UPDATE '.$db->prefix.'games SET game_data=\''.$db->escape($cur_game['game_data']).'\', current_turn='.$cur_game['current_turn'].', status='.$cur_game['status'].', player1_defeated='.$cur_game['player1_defeated'].', player2_defeated='.$cur_game['player2_defeated'].', player3_defeated='.$cur_game['player3_defeated'].', player4_defeated='.$cur_game['player4_defeated'].', player1_time='.$cur_game['player1_time'].', player2_time='.$cur_game['player2_time'].', player3_time='.$cur_game['player3_time'].', player4_time='.$cur_game['player4_time'].', last_modified='.$cur_game['last_modified'].', victor='.$cur_game['victor'].' WHERE guid=\''.$db->escape($data['guid']).'\'') or guifa_error('Unable to update game', __FILE__, __LINE__, $db->error());
            $value['ret'] = 'ok';
        }
    }
}

if ($value['ret'] == 'error')
{
    header('HTTP/1.1 403 Forbidden');
}

echo json_encode($value);

$db->end_transaction();
$db->close();

