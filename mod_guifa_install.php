
<?php
define('PUN_ROOT', './');
require 'config.php';
require PUN_ROOT.'include/dblayer/common_db.php';
require PUN_ROOT.'include/functions.php';
require PUN_ROOT.'include/utf8/utf8.php';

if (true)
{
	// Start a transaction
	$db->start_transaction();


	$schema = array(
		'FIELDS'		=> array(
			'id'			=> array(
				'datatype'		=> 'SERIAL',
				'allow_null'	=> false
			),
            'guid'          => array(
                'datatype'      => 'VARCHAR(255)',
                'allow_null'    => false
            ),
            'player1'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player2'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player3'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player4'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player1_color'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player2_color'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player3_color'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player4_color'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false
            ),
            'player1_name'          => array(
                'datatype'      => 'VARCHAR(255)',
                'allow_null'    => true
            ),
            'player2_name'          => array(
                'datatype'      => 'VARCHAR(255)',
                'allow_null'    => true
            ),
            'player3_name'          => array(
                'datatype'      => 'VARCHAR(255)',
                'allow_null'    => true
            ),
            'player4_name'          => array(
                'datatype'      => 'VARCHAR(255)',
                'allow_null'    => true
            ),
            'player1_time'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'player2_time'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'player3_time'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'player4_time'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'player1_defeated'       => array(
                'datatype'      => 'INT(1) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'player2_defeated'       => array(
                'datatype'      => 'INT(1) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'player3_defeated'       => array(
                'datatype'      => 'INT(1) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'player4_defeated'       => array(
                'datatype'      => 'INT(1) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            //color
            'current_turn'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            // open=0, ready=2, active=3, complete=4
            'status'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'victor'        => array(
                'datatype'      => 'INT(10)',
                'allow_null'    => false,
                'default'       => -1
            ),
            'game_time_limit'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'game_type'       => array(
                'datatype'      => 'INT(1) UNSIGNED',
                'allow_null'    => false,
                'default'       => 1
            ),
			'game_data'         => array(
				'datatype'		=> 'TEXT',
				'allow_null'	=> false
			),
            'created'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
            'last_modified'       => array(
                'datatype'      => 'INT(10) UNSIGNED',
                'allow_null'    => false,
                'default'       => 0
            ),
		),
		'PRIMARY KEY'	=> array('id')
	);

	$db->create_table('games', $schema) or error('Unable to create games table', __FILE__, __LINE__, $db->error());


	$db->end_transaction();
}

