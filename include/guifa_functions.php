<?php
function guifa_error($message, $file = null, $line = null, $db_error = false)
{
    header('HTTP/1.1 403 Forbidden');

	// If a database connection was established (before this error) we close it
	if ($db_error)
		$GLOBALS['db']->close();

	exit;
}
