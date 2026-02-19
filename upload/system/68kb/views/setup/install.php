<?php echo form_open('setup/install'); ?>

			<table width="90%" align="center" cellpadding="5" cellspacing="0" class="modules">
				<tr>
					<th colspan="2">CHMOD Settings:</th>
				</tr>
				<tr>
					<td class="left"><?php echo APPPATH; ?>cache/</td>
					<td class="right">
						<?php echo $cache; ?>
					</td>
				</tr>
				<tr>
					<td class="left"><?php echo APPPATH.'config/config.php'; ?></td>
					<td class="right">
						<?php echo $config_path; ?>
					</td>
				</tr>
				<tr>
					<td class="left"><?php echo APPPATH.'config/database.php'; ?></td>
					<td class="right">
						<?php echo $db_config_writable; ?>
					</td>
				</tr>
			</table>

			<br />

			<table width="90%" align="center" cellpadding="5" cellspacing="0" class="modules">
				<tr>
					<th colspan="2">Database Settings:</th>
				</tr>
				<?php if(validation_errors()) {
					echo '<tr><td colspan="2"><div class="fail">'.validation_errors().'</div></td></tr>';
				}
				?>
				<tr>
					<td width="50%" class="row1">SQLite Database Path</td>
					<td width="50%" class="row1">
						<?php echo form_input('db_path', set_value('db_path', $db_path)); ?>
					</td>
				</tr>
				<tr>
					<td width="50%" class="row1">Database Prefix</td>
					<td width="50%" class="row1">
						<?php echo form_input('db_prefix', set_value('db_prefix', 'kb_')); ?>
					</td>
				</tr>
			</table>

			<p align="right">
				<?php
					if (isset($error) && $error==TRUE) {
						echo "<p style='text-align: center;'><strong>Please fix the above errors and refresh this page.</strong></p>";
					} else {
				?>
				<input type="submit" name="submit" class="button" value="Next Step" />
				<?php } ?>
			</p>
		</form>
</div>
