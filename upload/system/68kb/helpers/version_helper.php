<?php  if ( ! defined('BASEPATH')) exit('No direct script access allowed');
/**
 * 68kb
 *
 * An open source knowledge base script
 *
 * @package		68kb
 * @author		Eric Barnes (http://ericlbarnes.com)
 * @copyright	Copyright (c) 2010, 68kb
 * @license		http://68kb.com/user_guide/license.html
 * @link		http://68kb.com
 * @since		Version 2.0
 */

// ------------------------------------------------------------------------

/**
 * Version Helpers
 *
 * @subpackage	Helpers
 * @link		http://68kb.com/user_guide/
 */

// ------------------------------------------------------------------------

/**
 * Checks for the latest release
 *
 * @return 	string
 */
function version_check()
{
	// External version check disabled - 68kb.com domain no longer available
	// Return current version to prevent false "upgrade available" notices
	$CI =& get_instance();
	return $CI->settings->get_setting('script_version');
}
/* End of file version_helper.php */
/* Location: ./upload/includes/68kb/helpers/version_helper.php */ 