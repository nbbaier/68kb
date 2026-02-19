<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');
/**
 * CodeIgniter
 *
 * An open source application development framework for PHP 4.3.2 or newer
 *
 * @package		CodeIgniter
 * @author		ExpressionEngine Dev Team
 * @copyright	Copyright (c) 2008 - 2010, EllisLab, Inc.
 * @license		http://codeigniter.com/user_guide/license.html
 * @link		http://codeigniter.com
 * @since		Version 1.0
 * @filesource
 */

// ------------------------------------------------------------------------

/**
 * PDO SQLite Forge Class
 *
 * @category	Database
 * @author		ExpressionEngine Dev Team
 * @link		http://codeigniter.com/user_guide/database/
 */
class CI_DB_pdo_sqlite_forge extends CI_DB_forge {

	/**
	 * Create database
	 *
	 * @access	public
	 * @param	string	the database name
	 * @return	bool
	 */
	function _create_database($name)
	{
		// In SQLite, database creation is handled by the DSN
		return TRUE;
	}

	// --------------------------------------------------------------------

	/**
	 * Drop database
	 *
	 * @access	public
	 * @param	string	the database name
	 * @return	bool
	 */
	function _drop_database($name)
	{
		// In SQLite, database deletion would be file deletion
		if ( ! @unlink($name))
		{
			if ($this->db->db_debug)
			{
				return $this->db->display_error('db_unable_to_drop');
			}
			return FALSE;
		}
		return TRUE;
	}
	
	// --------------------------------------------------------------------

	/**
	 * Create Table
	 *
	 * @access	public
	 * @param	string	the table name
	 * @param	array	the fields
	 * @param	mixed	primary key(s)
	 * @param	mixed	key(s)
	 * @param	boolean	should 'IF NOT EXISTS' be added to the SQL
	 * @return	bool
	 */
	function _create_table($table, $fields, $primary_keys, $keys, $if_not_exists)
	{
		$sql = 'CREATE TABLE ';

		if ($if_not_exists === TRUE)
		{
			$sql .= 'IF NOT EXISTS ';
		}

		$sql .= $this->db->_protect_identifiers($table);
		$sql .= " (";
		
		// Add field definitions
		$columns = array();
		$has_auto_increment = FALSE;
		foreach ($fields as $field => $attributes)
		{
			// Fields added as raw SQL strings (e.g. add_field("col_name INT NOT NULL"))
			// are stored with numeric keys; use the string value directly.
			if (is_string($attributes))
			{
				$columns[] = $this->_sanitize_raw_field($attributes);
			}
			else
			{
				if (isset($attributes['auto_increment']) && $attributes['auto_increment'] === TRUE)
				{
					$has_auto_increment = TRUE;
				}
				$columns[] = $this->_process_field($field, $attributes);
			}
		}

		// Add primary key constraint only when no field already carries an inline
		// PRIMARY KEY AUTOINCREMENT — SQLite forbids more than one primary key.
		if ( ! $has_auto_increment && count($primary_keys) > 0)
		{
			$columns[] = "PRIMARY KEY (" . implode(', ', $this->db->_protect_identifiers($primary_keys)) . ")";
		}

		$sql .= implode(', ', $columns);
		$sql .= ")";

		return $sql;
	}

	// --------------------------------------------------------------------

	/**
	 * Process Fields
	 *
	 * @access	private
	 * @param	string	the field name
	 * @param	array	the field definition
	 * @return	string
	 */
	function _process_field($field, $attributes)
	{
		$field_name = $this->db->_protect_identifiers($field);
		
		// Get the data type
		$type = isset($attributes['type']) ? strtolower($attributes['type']) : 'TEXT';
		
		// SQLite supported types
		$sqlite_types = array(
			'char' => 'TEXT',
			'varchar' => 'TEXT',
			'tinytext' => 'TEXT',
			'text' => 'TEXT',
			'longtext' => 'TEXT',
			'mediumtext' => 'TEXT',
			'int' => 'INTEGER',
			'integer' => 'INTEGER',
			'tinyint' => 'INTEGER',
			'smallint' => 'INTEGER',
			'mediumint' => 'INTEGER',
			'bigint' => 'INTEGER',
			'double' => 'REAL',
			'float' => 'REAL',
			'decimal' => 'REAL',
			'numeric' => 'REAL',
			'date' => 'TEXT',
			'datetime' => 'TEXT',
			'time' => 'TEXT',
			'timestamp' => 'TEXT',
			'year' => 'INTEGER',
			'enum' => 'TEXT',
			'set' => 'TEXT',
			'binary' => 'BLOB',
			'varbinary' => 'BLOB',
			'blob' => 'BLOB',
			'tinyblob' => 'BLOB',
			'mediumblob' => 'BLOB',
			'longblob' => 'BLOB',
		);
		
		if (isset($sqlite_types[$type]))
		{
			$type = $sqlite_types[$type];
		}
		
		$sql = $field_name . ' ' . strtoupper($type);
		
		// Handle auto_increment
		if (isset($attributes['auto_increment']) && $attributes['auto_increment'] === TRUE)
		{
			$sql .= ' PRIMARY KEY AUTOINCREMENT';
		}
		
		// Handle null/not null
		if (isset($attributes['null']))
		{
			if ($attributes['null'] === FALSE)
			{
				$sql .= ' NOT NULL';
			}
			else
			{
				$sql .= ' NULL';
			}
		}
		
		// Handle default
		if (isset($attributes['default']))
		{
			$sql .= " DEFAULT '" . $attributes['default'] . "'";
		}
		
		return $sql;
	}

	// --------------------------------------------------------------------

	/**
	 * Drop Table
	 *
	 * @access	public
	 * @param	string	the table name
	 * @return	bool
	 */
	function _drop_table($table)
	{
		return "DROP TABLE IF EXISTS " . $this->db->_protect_identifiers($table);
	}

	// --------------------------------------------------------------------

	/**
	 * Rename Table
	 *
	 * @access	public
	 * @param	string	the old table name
	 * @param	string	the new table name
	 * @return	bool
	 */
	function _rename_table($table_name, $new_table_name)
	{
		return "ALTER TABLE " . $this->db->_protect_identifiers($table_name) . " RENAME TO " . $this->db->_protect_identifiers($new_table_name);
	}

	// --------------------------------------------------------------------

	/**
	 * Column Add
	 *
	 * @access	public
	 * @param	string	the table name
	 * @param	string	the column name
	 * @param	array	the column definition
	 * @return	bool
	 */
	function _alter_table($alter_type, $table, $column_name, $column_definition = '', $default_value = '', $null = '', $after_field = '')
	{
		$table_sql = "ALTER TABLE " . $this->db->_protect_identifiers($table);

		if ($alter_type == 'ADD')
		{
			// add_column() passes $this->fields (an array) as $column_name.
			if (is_array($column_name))
			{
				foreach ($column_name as $field => $attributes)
				{
					$col_sql = is_string($attributes)
						? $this->_sanitize_raw_field($attributes)
						: $this->_process_field($field, $attributes);

					return $table_sql . " ADD COLUMN " . $col_sql;
				}
			}

			// Legacy string-based call
			return $table_sql . " ADD COLUMN "
				. $this->db->_protect_identifiers($column_name) . ' ' . $column_definition;
		}

		if ($alter_type == 'CHANGE')
		{
			// modify_column() passes $this->fields as $column_name.
			// SQLite 3.25.0+ supports RENAME COLUMN for name-only changes.
			if (is_array($column_name))
			{
				foreach ($column_name as $old_name => $attrs)
				{
					if (is_array($attrs) && isset($attrs['name']) && $attrs['name'] !== $old_name)
					{
						return $table_sql
							. " RENAME COLUMN " . $old_name . " TO " . $attrs['name'];
					}
				}
			}

			// Type/constraint-only changes require table recreation in SQLite — skip.
			return FALSE;
		}

		// DROP is not supported in SQLite without recreating the table.
		return FALSE;
	}

	// --------------------------------------------------------------------

	/**
	 * Sanitize Raw Field SQL
	 *
	 * Converts MySQL-specific type syntax in raw add_field() strings to
	 * SQLite-compatible equivalents before they are embedded in CREATE TABLE.
	 *
	 * @access	private
	 * @param	string	raw column definition SQL
	 * @return	string
	 */
	function _sanitize_raw_field($field_sql)
	{
		// enum(...) and set(...) are not valid in SQLite — map to TEXT
		$field_sql = preg_replace('/\b(?:enum|set)\s*\([^)]+\)/i', 'TEXT', $field_sql);
		return $field_sql;
	}

}


/* End of file pdo_sqlite_forge.php */
/* Location: ./system/database/drivers/pdo_sqlite/pdo_sqlite_forge.php */
