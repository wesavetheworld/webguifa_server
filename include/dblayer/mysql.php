<?php
// reference: http://wiki.hashphp.org/PDO_Tutorial_for_MySQL_Developers

class DBLayer
{
    public $prefix;
    private $db;
    private $statement;

    private $saved_queries = array();
    private $num_queries = 0;

    private $error_no = false;
    private $error_msg = 'Unknown';

    var $datatype_transformations = array(
        '%^SERIAL$%' => 'INT(10) UNSIGNED AUTO_INCREMENT'
    );

    public function DBLayer($db_host, $db_username, $db_password, $db_name, $db_prefix, $p_connect)
    {
        $this->prefix = $db_prefix;

        try {
            $this->db = new PDO('mysql:dbname=' . $db_name . ';host=' . $db_host, $db_username, $db_password, array(
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8",
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true
            ));
        } catch (PDOException $e) {
            error('An error occurred!');
        }
    }

    function pdo_query($sql, $params, $fetch_style = PDO::FETCH_ASSOC)
    {
        if (defined('PUN_SHOW_QUERIES')) {
            $q_start = get_microtime();
        }

        $sql = trim($sql);

        try {
            $this->statement = $this->db->prepare($sql);
            $this->statement->execute($params);
            if (defined('PUN_SHOW_QUERIES')) {
                $this->saved_queries[] = array($sql, sprintf('%.5f', get_microtime() - $q_start));
            }
            ++$this->num_queries;
        } catch (PDOException $e) {
            if (defined('PUN_SHOW_QUERIES')) {
                $this->saved_queries[] = array($sql, 0);
            }
            $this->error_no = $e->getCode();
            $this->error_msg = $e->getMessage();
            return false;
        }

        $rawStatement = explode(" ", $sql);
        $statement = strtolower($rawStatement[0]);
        if ($statement === 'select' || $statement === 'show') {
            return $this->statement->fetchAll($fetch_style);
        } elseif ($statement === 'insert' || $statement === 'update' || $statement === 'delete') {
            return $this->statement->rowCount();
        } else {
            return false;
        }
    }


    // Compatibility

    function start_transaction()
    {
        return;
    }

    function end_transaction()
    {
        return;
    }

    function query($sql, $unbuffered = false)
    {
        if (defined('PUN_SHOW_QUERIES')) {
            $q_start = get_microtime();
        }

        try {
            $this->statement = $this->db->query($sql);

            if ($this->statement) {
                if (defined('PUN_SHOW_QUERIES')) {
                    $this->saved_queries[] = array($sql, sprintf('%.5f', get_microtime() - $q_start));
                }

                ++$this->num_queries;

                return $this->statement;
            } else {
                if (defined('PUN_SHOW_QUERIES')) {
                    $this->saved_queries[] = array($sql, 0);
                }
                return false;
            }
        } catch (PDOException $e) {
            if (defined('PUN_SHOW_QUERIES')) {
                $this->saved_queries[] = array($sql, 0);
            }
            $this->error_no = $e->getCode();
            $this->error_msg = $e->getMessage();
            return false;
        }
    }

    function result($statement = 0, $row = 0, $col = 0)
    {
        if ($statement) {
            $cur_row = $statement->fetch(PDO::FETCH_NUM, PDO::FETCH_ORI_NEXT, $row);

            if ($cur_row === false) {
                return false;
            }
            return $cur_row[$col];
        } else {
            return false;
        }
    }

    function fetch_assoc($statement = 0)
    {
        return ($statement) ? $statement->fetch(PDO::FETCH_ASSOC) : false;
    }

    function fetch_row($statement = 0)
    {
        return ($statement) ? $statement->fetch(PDO::FETCH_NUM) : false;
    }

    function num_rows($statement = 0)
    {
        return ($statement) ? $statement->rowCount() : false;
    }

    function affected_rows()
    {
        return ($this->statement) ? $this->statement->rowCount() : false;
    }

    function insert_id()
    {
        return $this->db->lastInsertId();
    }

    function get_num_queries()
    {
        return $this->num_queries;
    }

    function get_saved_queries()
    {
        return $this->saved_queries;
    }

    function free_result($statement = false)
    {
        return ($statement) ? $statement->closeCursor() : false;
    }

    function escape($str)
    {
        return is_array($str) ? '' : trim($this->db->quote($str), "'");
    }

    function error()
    {
        $result['error_sql'] = @current(@end($this->saved_queries));
        $result['error_no'] = $this->error_no;
        $result['error_msg'] = $this->error_msg;

        return $result;
    }

    function close()
    {
        if ($this->db) {
            if ($this->statement) {
                $this->statement->closeCursor();
                $this->statement = null;
            }

            $this->db = null;
        }
    }

    function get_names()
    {
        $result = $this->query('SHOW VARIABLES LIKE \'character_set_connection\'');
        return $this->result($result, 0, 1);
    }


    function set_names($names)
    {
        return $this->query('SET NAMES \''.$this->escape($names).'\'');
    }


    function get_version()
    {
        $result = $this->query('SELECT VERSION()');

        return array(
            'name'		=> 'MySQL PDO',
            'version'	=> preg_replace('%^([^-]+).*$%', '\\1', $this->result($result))
        );
    }


    function table_exists($table_name, $no_prefix = false)
    {
        $result = $this->query('SHOW TABLES LIKE \''.($no_prefix ? '' : $this->prefix).$this->escape($table_name).'\'');
        return $this->num_rows($result) > 0;
    }


    function field_exists($table_name, $field_name, $no_prefix = false)
    {
        $result = $this->query('SHOW COLUMNS FROM '.($no_prefix ? '' : $this->prefix).$table_name.' LIKE \''.$this->escape($field_name).'\'');
        return $this->num_rows($result) > 0;
    }


    function index_exists($table_name, $index_name, $no_prefix = false)
    {
        $exists = false;

        $result = $this->query('SHOW INDEX FROM '.($no_prefix ? '' : $this->prefix).$table_name);
        while ($cur_index = $this->fetch_assoc($result))
        {
            if (strtolower($cur_index['Key_name']) == strtolower(($no_prefix ? '' : $this->prefix).$table_name.'_'.$index_name))
            {
                $exists = true;
                break;
            }
        }

        return $exists;
    }


    function create_table($table_name, $schema, $no_prefix = false)
    {
        if ($this->table_exists($table_name, $no_prefix))
            return true;

        $query = 'CREATE TABLE '.($no_prefix ? '' : $this->prefix).$table_name." (\n";

        // Go through every schema element and add it to the query
        foreach ($schema['FIELDS'] as $field_name => $field_data)
        {
            $field_data['datatype'] = preg_replace(array_keys($this->datatype_transformations), array_values($this->datatype_transformations), $field_data['datatype']);

            $query .= $field_name.' '.$field_data['datatype'];

            if (isset($field_data['collation']))
                $query .= 'CHARACTER SET utf8 COLLATE utf8_'.$field_data['collation'];

            if (!$field_data['allow_null'])
                $query .= ' NOT NULL';

            if (isset($field_data['default']))
                $query .= ' DEFAULT '.$field_data['default'];

            $query .= ",\n";
        }

        // If we have a primary key, add it
        if (isset($schema['PRIMARY KEY']))
            $query .= 'PRIMARY KEY ('.implode(',', $schema['PRIMARY KEY']).'),'."\n";

        // Add unique keys
        if (isset($schema['UNIQUE KEYS']))
        {
            foreach ($schema['UNIQUE KEYS'] as $key_name => $key_fields)
                $query .= 'UNIQUE KEY '.($no_prefix ? '' : $this->prefix).$table_name.'_'.$key_name.'('.implode(',', $key_fields).'),'."\n";
        }

        // Add indexes
        if (isset($schema['INDEXES']))
        {
            foreach ($schema['INDEXES'] as $index_name => $index_fields)
                $query .= 'KEY '.($no_prefix ? '' : $this->prefix).$table_name.'_'.$index_name.'('.implode(',', $index_fields).'),'."\n";
        }

        // We remove the last two characters (a newline and a comma) and add on the ending
        $query = substr($query, 0, strlen($query) - 2)."\n".') ENGINE = '.(isset($schema['ENGINE']) ? $schema['ENGINE'] : 'MyISAM').' CHARACTER SET utf8';

        return $this->query($query) ? true : false;
    }


    function drop_table($table_name, $no_prefix = false)
    {
        if (!$this->table_exists($table_name, $no_prefix))
            return true;

        return $this->query('DROP TABLE '.($no_prefix ? '' : $this->prefix).$table_name) ? true : false;
    }


    function rename_table($old_table, $new_table, $no_prefix = false)
    {
        // If the new table exists and the old one doesn't, then we're happy
        if ($this->table_exists($new_table, $no_prefix) && !$this->table_exists($old_table, $no_prefix))
            return true;

        return $this->query('ALTER TABLE '.($no_prefix ? '' : $this->prefix).$old_table.' RENAME TO '.($no_prefix ? '' : $this->prefix).$new_table) ? true : false;
    }


    function add_field($table_name, $field_name, $field_type, $allow_null, $default_value = null, $after_field = null, $no_prefix = false)
    {
        if ($this->field_exists($table_name, $field_name, $no_prefix))
            return true;

        $field_type = preg_replace(array_keys($this->datatype_transformations), array_values($this->datatype_transformations), $field_type);

        if (!is_null($default_value) && !is_int($default_value) && !is_float($default_value))
            $default_value = '\''.$this->escape($default_value).'\'';

        return $this->query('ALTER TABLE '.($no_prefix ? '' : $this->prefix).$table_name.' ADD '.$field_name.' '.$field_type.($allow_null ? '' : ' NOT NULL').(!is_null($default_value) ? ' DEFAULT '.$default_value : '').(!is_null($after_field) ? ' AFTER '.$after_field : '')) ? true : false;
    }


    function alter_field($table_name, $field_name, $field_type, $allow_null, $default_value = null, $after_field = null, $no_prefix = false)
    {
        if (!$this->field_exists($table_name, $field_name, $no_prefix))
            return true;

        $field_type = preg_replace(array_keys($this->datatype_transformations), array_values($this->datatype_transformations), $field_type);

        if (!is_null($default_value) && !is_int($default_value) && !is_float($default_value))
            $default_value = '\''.$this->escape($default_value).'\'';

        return $this->query('ALTER TABLE '.($no_prefix ? '' : $this->prefix).$table_name.' MODIFY '.$field_name.' '.$field_type.($allow_null ? '' : ' NOT NULL').(!is_null($default_value) ? ' DEFAULT '.$default_value : '').(!is_null($after_field) ? ' AFTER '.$after_field : '')) ? true : false;
    }


    function drop_field($table_name, $field_name, $no_prefix = false)
    {
        if (!$this->field_exists($table_name, $field_name, $no_prefix))
            return true;

        return $this->query('ALTER TABLE '.($no_prefix ? '' : $this->prefix).$table_name.' DROP '.$field_name) ? true : false;
    }


    function add_index($table_name, $index_name, $index_fields, $unique = false, $no_prefix = false)
    {
        if ($this->index_exists($table_name, $index_name, $no_prefix))
            return true;

        return $this->query('ALTER TABLE '.($no_prefix ? '' : $this->prefix).$table_name.' ADD '.($unique ? 'UNIQUE ' : '').'INDEX '.($no_prefix ? '' : $this->prefix).$table_name.'_'.$index_name.' ('.implode(',', $index_fields).')') ? true : false;
    }


    function drop_index($table_name, $index_name, $no_prefix = false)
    {
        if (!$this->index_exists($table_name, $index_name, $no_prefix))
            return true;

        return $this->query('ALTER TABLE '.($no_prefix ? '' : $this->prefix).$table_name.' DROP INDEX '.($no_prefix ? '' : $this->prefix).$table_name.'_'.$index_name) ? true : false;
    }

    function truncate_table($table_name, $no_prefix = false)
    {
        return $this->query('TRUNCATE TABLE '.($no_prefix ? '' : $this->prefix).$table_name) ? true : false;
    }
}
