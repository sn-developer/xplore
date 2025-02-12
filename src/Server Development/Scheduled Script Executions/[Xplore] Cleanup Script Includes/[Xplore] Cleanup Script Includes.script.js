(function() {

	/**
	 * **** WARNING: USE AT YOUR OWN RISK ****
	 * 
	 * THIS SCRIPT COMES WITH ABSOLUTELY ZERO WARRANTY OR SUPPORT.
	 * 
	 * SCRIPT INCLUDES WILL BE DELETED.
	 * 
	 * The purpose is to allow easy cleanup of temporary Xplore
	 * related Script Includes. However, any modification to the query
	 * will risk you deleting much more than you bargained for.
	 * 
	 * Deleted script includes will end up in the sys_metadata_delete table.
	 * 
	 * A maximum of 10 records will be removed.
	 */

    // Set the maximum age of script includes to delete in days.
    var max_age = 0;

	// The name of this job for logging purposes.
    var job_name = 'Scheduled Script "[Xplore] Cleanup Script Includes"';

    var grd = new GlideRecord('sys_script_include');
    grd.addEncodedQuery('nameSTARTSWITHsnd_Xplore_code_');

    if (max_age > 0) {
        var date = new GlideDateTime();
        date.addDaysUTC(-max_age);
        grd.addQuery('sys_created_on', '<', date);
    }

    grd.query();

	// Yes, we are using getRowCount(). No, it's not a performance killer in this scenario.
	if (grd.getRowCount() > 10) {
		gs.info(job_name + ' exited early; too many Script Includes returned. Please remove manually.');
		return;
	}

    var count = 0;
	grd.setWorkflow(false); // prevent capturing in update set
    while (grd.next()) {
        if (grd.deleteRecord()) {
            count++;
        } else {
            gs.warn(job_name + ' was not able to remove Script Include ' + grd.api_name + '.');
        }
    }

    gs.info(job_name + ' removed ' + count + ' temporary Script Includes.');

})();