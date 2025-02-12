/*!
  Processor for generating the user interface and handling AJAX calls.
*/

//==============================================================================
// Action List
//==============================================================================

function ActionList() {}

/**
  summary:
    Gets a list of all the script history for this user.
 **/
ActionList.prototype.getScriptHistory = function () {
  return new snd_Xplore.ScriptHistory().retrieve();
};

/**
  summary:
    Removes a specific user script from the history.
 **/
ActionList.prototype.deleteScriptHistoryItem = function (params) {
  if (params.id) {
    return new snd_Xplore.ScriptHistory().remove(params.id);
  } else {
    throw 'Missing id.';
  }
};

/**
  summary:
    Stores a script execution for history.
 **/
ActionList.prototype.storeScriptHistory = function (params) {
  var sh = new snd_Xplore.ScriptHistory();
  sh.store(params);
};

/**
  summary:
    Gets a specific user script from the history.
 **/
ActionList.prototype.fetchScriptHistoryItem = function (params) {
  if (params.id) {
    return new snd_Xplore.ScriptHistory().get(params.id);
  } else {
    throw 'Missing id.';
  }
}

/**
  summary:
    Sets a user preference using name and value.
 **/
ActionList.prototype.setPreference = function (params) {
  if (params.name && params.hasOwnProperty('value')) {
    gs.getUser().setPreference(params.name, params.value);
  } else {
    throw 'Missing preference parameters.';
  }
  return true;
};

/**
  summary:
    Format a string e.g. XML
  returns: String
**/
ActionList.prototype.formatString = function (params) {
  var type = params.type,
      str = params.string,
      isXML = str.trim().substr(0,1) == '<',
      tmp;
  try {
    if (type.indexOf('XMLDocument') > -1 || isXML) {
      tmp = new XMLDocument(str);
      return tmp.toIndentedString().trim();
    } else {
      tmp = JSON.parse(str);
      return JSON.stringify(tmp, null, 4);
    }
  } catch (e) {}
  return str;
};

/**
  summary:
    Get the available scopes
  returns: Array
    Array of ordered scopes, except for global which is the first entry.
**/
ActionList.prototype.getScopes = function getScopes() {
  var gr = new GlideAggregate('sys_scope');
  gr.addQuery('scope', '!=', 'global');
  gr.orderBy('name'); // so we can see name
  gr.orderBy('private');
  gr.groupBy('scope');
  gr.query();
  var scopes = [];
  while (gr.next()) {
    if (gr.scope.toString().indexOf('sn_') === 0) {
      if (gr.getValue('private') != 'false') {
        continue; // easiest way to ignore ServiceNow scopes, Geneva has private flag
      }
    }
    scopes.push({
      name: gr.getValue('name') + ' [' + gr.getValue('scope') + ']',
      scope: gr.getValue('scope')
    });
  }
  scopes.sort(function (a, b) {
    if (a.name > b.name) return 1;
    if (b.name > a.name) return -1;
    return 0;
  });
  scopes.unshift({
    name: 'Global [global]',
    scope: 'global'
  });
  return scopes;
};

/**
  summary:
    Evaluate a regular expression against a string
  input: String
    The string to test with the regex.
  expression: String
    The regular expression as a string
  options: String (Optional)
    The regular exression options, e.g. 'g'
  returns: Object
**/
ActionList.prototype._evalRegex = function _evalRegex(input, expression, options) {
  var regex,
      matches = [],
      groups = [],
      m, a, i,
      loop = options ? options.toString().indexOf('g') >= 0: false;

  if (input && expression) {
    try {
      regex = new RegExp(expression, options);
    } catch (e) {
      return {
        error: ('' + e).split(':').pop()
      };
    }
    while ((m = regex.exec(input))) {
      matches.push({
        index: m.index,
        length: m[0].length
      });
      // because groups.concat(m) will add the Array as an object instead of its values
      for (i = 1, a = []; i < m.length; i++) {
          a.push(m[i] || ''); // prevent null when an alternative group is not matched
      }
      groups.push(a);
      if (!loop) break;
    }
  }
  return {
    matches: matches,
    groups: groups,
    input: input
  };
};

/**
  summary:
    Get basic details of all the tables in the system
  returns: Object
**/
ActionList.prototype.getTables = function getTables() {
  var tables = {};
  var gr = new GlideRecord('sys_db_object');
  gr.query();
  while (gr.next()) {
    tables[gr.getValue('name')] = {
      super_class:  gr.getValue('super_class'),
      label:        gr.getValue('label'),
      scope:        gr.getValue('sys_scope'),
      sys_id:       gr.getUniqueValue(),
      name:         gr.getValue('name')
    };
  }
  return tables;
};

/**
  summary:
    Get records from a table.
  param: table [String]
    The table to search.
  param: fields [Array]
    An array of field names to return.
  param: query [String] Optional
    An encoded query to use to restrict the records.
  param: limit [Integer] Optional
    Limit the number of records returned.
  returns: Array
    An array of record objects containing the requested fields.
**/
ActionList.prototype._getRecordValues = function _getRecordValues(table, fields, query, limit) {
  var records = [],
      gr;

  function mapFields(gr) {
    var o = {};
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.indexOf('$') == '0') {
        o[f] = gr[f.substr(1)].getDisplayValue();
      } else {
        o[f] = gr.getValue(f);
      }
    }
    return o;
  }

  gr = new GlideRecord(table);
  if (gr.isValid()) {
    gr.addEncodedQuery(query);
    if (limit) {
      gr.setLimit(limit);
    }
    gr._query();
    while (gr._next()) {
      records.push(mapFields(gr));
    }
  }
  return records;
};

ActionList.prototype.logs = function logs() {
  var result = new snd_Xplore.ObjectReporter().getReport();
  result.messages = snd_Xplore.getOutputMessages();
  result.logs = snd_Xplore.getLogs();
  return result;
};

ActionList.prototype.regex = function regex(params) {
  var data = params.data;
  return this._evalRegex(data.input, data.expression, data.options);
};

ActionList.prototype.run = function run(params) {
  var report, runner;
  if (!params.data) {
    gs.addErrorMessage('Invalid HTTP data object.');
    report = new snd_Xplore.ObjectReporter().getReport();
    report.messages = snd_Xplore.getOutputMessages();
  } else {
    runner = new XploreRunner();
    report = runner.run(params.data);
  }
  return report;
};

ActionList.prototype.getTableHierarchy = function getTableHierarchy(params) {
  var options = {};
  options.search_labels = params.search_labels == '1' || params.search_labels == 'true';
  return XploreTableHierarchy(params.table, options);
};

ActionList.prototype.getScripts = function getScripts(params) {
  return this._getRecordValues('sys_script_include',
      ['sys_id', 'name', 'api_name', '$sys_scope'], 'ORDERBYname^EQ');
};

ActionList.prototype.getScript = function (params) {
  var sys_id = params.sys_id;
  if (sys_id && sys_id.length == 32) {
    var records = this._getRecordValues(
        'sys_script_include', ['name', 'api_name', 'script'], 'sys_id=' + sys_id, 1);
    if (records.length) {
      return records[0];
    } else {
      throw 'Not found.';
    }
  } else {
    throw 'Expected sys_id not valid.';
  }
};

//==============================================================================
// Xplore Runner
//==============================================================================

/**
  summary:
    Container class for running an exploratory programming request.
**/
function XploreRunner() {
  // #private: the current transaction
  this.transaction = null;

  this.default_reporter = new snd_Xplore.ObjectReporter();

  this.reporter_name = 'snd_Xplore.ObjectReporter';
}

XploreRunner.USER_SCRIPT = (function () {
  var name = String(gs.getImpersonatingUserName() || gs.getUserName());
  return 'snd_Xplore_code_' + name.replace(/[^a-zA-Z0-9_]+/g, '_');
})();

/**
  summary:
    Process a request.
  options: Object
    An object that contains the things we need to process the request.
      code: String
        The code to execute.
      breadcrumb: String
        List of dot separated property names to evaluate on the result.
  returns: Object
    The snd_XploreReporter response object.
**/
XploreRunner.prototype.run = function run(options) {
  var script = options ? options.code : '';
  var report;
  var self = this;

  function end(report) {
    report = report || self.default_reporter.getReport();
    report.messages = snd_Xplore.getOutputMessages();
    report.options = options;
    delete report.options.code;
    self.stop();
    return report;
  }

  if (!this.productionCheck()) {
    gs.addErrorMessage('Script execution has been disabled ("snd_xplore.production_access" == false)');
    gs.addErrorMessage('Production environment detected ("glide.installation.production" == true)');
    return end();
  }

  if (!options) {
    gs.addErrorMessage('Xplore processor did not receive a request.');
    return end();
  }

  this.start();

  if (!script) {
    gs.addErrorMessage("Expression required.");
    return end();
  }

  try {

    // Try to validate the script first and automatically switch to hoisting if
    // we have an invalid return.
    try {
      options.scope = options.scope || 'global';
      this.validateScript(script, options.scope, options);
    } catch (e) {
      if (e.toString().indexOf('invalid return') === 0) {
        try {
          this.validateScript('(function () {' + script + '}).call(this)', options.scope, options);
          options.support_hoisting = true;
        } catch (e2) {
          throw e; // throw the original error
        }
      } else {
        throw e;
      }
    }

    // This is an option from the user or can be set above for dynamic return value
    if (options.support_hoisting) {
      snd_Xplore.notice('Automatic hoisting enabled.');
      script = '(function () {' + script + '}).call(this)';
    }

    this.logRequest(script, options.scope);

    if (options.fix_gslog) {
      script = this.fixLogs(script);
    }

    options.dotwalk = options.breadcrumb;

    // store script history before updating user_data to prevent it being an object
    // when we retrieve it later in the UI
    new ActionList().storeScriptHistory(options);

    options.user_data = this.formatUserData(options.user_data, options.user_data_type);

    // init logtail here so we don't capture the logRequest() above
    //snd_Xplore.Logtail.start();

    // if (options.scope && options.scope != 'global') {
      report = this.runScopedScript(script, options);
    // } else {
    //   report = this.runGlobalScript(script, options);
    // }

    if (snd_Xplore.$caught) {
      snd_Xplore.notice('script result was thrown.');
    }

  } catch (e) {
    var x = new snd_Xplore();
    x.xplore(e, this.reporter_name);
    report = x.reporter.getReport();
  }

  return end(report);
};

/**
 * Check if we are running in Production and the user has access to run scripts.
 *
 * @return {Boolean}
 */
XploreRunner.prototype.productionCheck = function () {
  var is_production = gs.getProperty('glide.installation.production') == 'true';
  var is_production_enabled = gs.getProperty('snd_xplore.production_access') == 'true';
  if (is_production) return is_production_enabled;
  return true;
};

/**
 * Replace calls to gs.print etc so that we can capture the logs.
 *
 * @param  {String} code
 * @return {String}
 */
XploreRunner.prototype.fixLogs = function (code) {
  return code.replace(/gs\.(print|log|debug|info|warn|error)/g, "global.snd_Xplore.gs$1");
};

/**
 * Format the user data payload as the object it should be.
 *
 */
XploreRunner.prototype.formatUserData = function (str, type) {
  var err = 'Unable to parse User Data as ',
      tmp;
  if (!str) return str;
  if (type.indexOf('XMLDocument2') > -1) {
    tmp = new XMLDocument2();
    if (tmp.parseXML(str)) {
      return tmp;
    }
    throw new Error(err + 'XMLDocument2');
  } else if (type.indexOf('XMLDocument') > -1) {
    try {
      tmp = new XMLDocument(str);
      return tmp.toIndentedString().trim();
    } catch (e) {
      throw new Error(err + 'XMLDocument. ' + e);
    }
  } else if (type.indexOf('JSON') > -1) {
    try {
      return JSON.parse(str);
    } catch (e) {
      throw new Error(err + 'JSON. ' + e);
    }
  }
  return str;
};

/**
  summary:
    capture calls to gs.print and enable debug for this session
**/
XploreRunner.prototype.start = function start() {
  this.transaction = GlideTransaction.get();
  GlideSessionDebug.enable(this.transaction);
};

/**
  summary:
    stop the debug session for this transaction
**/
XploreRunner.prototype.stop = function stop() {
  if (this.transaction) {
    GlideSessionDebug.disable(this.transaction);
  }
};

/**
  summary:
    Log the code in syslog if necessary (like background script does)
**/
XploreRunner.prototype.logRequest = function logRequest(code, scope) {
  if (gs.getProperty('snd_xplore.log_request', 'true') == 'true') {
    gs.log('Xplore Request [' + (scope || 'global') + ']:\n' + code, 'SND Xplore');
  }
};

/**
  summary:
    Validate the script to run for any syntax errors.
  returns: true
  throws: string
**/
XploreRunner.prototype.validateScript = function validateScript(script, scope, options) {
  var validator = new JSValidator();
  validator.getParameter = function getParameter(name) {
    if (name == 'sysparm_js_expression') {
      return script;
    }
    if (name == 'sysparm_js_scope') { // introduced in Tokyo, no longer used in Xanadu
      return scope;
    }
	if (name == 'sysparm_scope') { // introduced in Xanadu
      if (scope == 'global') return scope;
      var gr = new GlideRecord('sys_scope');
      if (gr.get('scope', scope)) {
		return gr.sys_id + '';
      }
      gs.addErrorMessage('Unable to validate JS with scope ' + scope + '; sys_scope record not found.');
      return 'global';
	}
    if (name == 'sysparm_use_es_latest') {
      return options.use_es_latest;
    }
  };

  var error = validator.validate();
  if (error) {
    var e = new SyntaxError(error);
    var m = error.match(/(.+) at line \((\d+)\) column \((\d+)\) problem = (.+)/);
    if (m) {
      e.name = m[4];
      e.lineNumber = m[2];
      e.column = m[3];
    }
    throw e;
  }
  return true;
};

/**
  summary:
    Run Xplore on a script in the global environment
  script: String
    The script to evaluate
  options: Object
    An object of options
**/
XploreRunner.prototype.runGlobalScript = function runGlobalScript(script, options) {
  var obj,
      x;

  // try to catch exceptions here - this won't catch all exceptions
  // newlines will affect the exception lineNumber
  script = 'try { ' + script + ';\n} catch (e) { global.snd_Xplore.$caught = true; e; }';
  global.user_data = options.user_data; // not ideal doing this
  obj = GlideEvaluator.evaluateString(script);
  x = new snd_Xplore();
  x.xplore(obj, 'snd_Xplore.ObjectReporter', options);
  return x.reporter.getReport();
};

/**
  summary:
    Get a script include GlideRecord that we can run scripts in and use with Script Debugger
  options: Object
    An object of options
 */
XploreRunner.prototype.getUserScriptInclude = function getUserScriptInclude(options) {

  if (!options) options = {scope: 'global'};

  // We have to insert a real script include to avoid dynamic script prevention (only explained in node logs)
  // Example error:
  // *** WARNING *** Security restricted: GlideScopedEvaluator: Prohibited dynamic script against scope 'x_snd_eb' from scope 'rhino.global'
  var run_scope = this.getRunScope(options.scope);
  var gr = new GlideRecord("sys_script_include");
  gr.get("name", XploreRunner.USER_SCRIPT);

  gr.setWorkflow(false); // prevent adding to update set
  gr.setUseEngines(false); // prevent version control

  if (!gr.isValidRecord()) {
    gr.newRecord();
    gr.name = XploreRunner.USER_SCRIPT;
    gr.api_name = 'global.' + gr.name;
	gr.sys_scope = gr.sys_package = "global";
	gr.description = 'This script is used to run scoped code in Xplore for ' +
		gs.getUserDisplayName() + ' [' + gs.getUserName() + '].';

	// this must always be public otherwise we risk not being able to edit/remove the record
    gr.access = 'public';
	
    gr.insert();
  }

  gr.name = XploreRunner.USER_SCRIPT;
  gr.api_name = options.scope + '.' + gr.name;
  gr.sys_scope = run_scope;

  return gr;
};

XploreRunner.prototype.getRunScope = function getRunScope(scope_name) { 
  if (scope_name == 'global') return scope_name;
  var gr = new GlideRecord('sys_scope');
  gr.addQuery('scope', '=', scope_name);
  gr.setLimit(1);
  gr.query();
  if (gr.next()) {
    return gr.getUniqueValue();
  }
  throw 'Unknown scope [' + scope_name + ']';
};

/**
  summary:
    Run Xplore on a script in a scoped environment
  script: String
    The script to evaluate
  options: Object
    An object of options
**/
XploreRunner.prototype.runScopedScript = function runScopedScript(script, options) {
  var gr = this.getUserScriptInclude(options);
  var result;
  try {
    gr.script = 'try {' + script + '\n} catch (e) { global.snd_Xplore.$caught = true; e; }';

	/**
	 * Trying to change the application scope programatically generates a warning:
	 * "The Application field cannot be changed for application My First App"
	 * Although the gr.update() fails to update, this is required for the
	 * script to be executed.
	 */
	if (gr.sys_scope != 'global' && !gr.update()) {
		// snd_Xplore.gserror('Failed to save record to scope ' + gr.sys_scope);
		gs.flushAccessMessages(); // prevent this access error from showing as an Xplore warning
	}

    var gse = new GlideScopedEvaluator();
    gse.putVariable("user_data", options.user_data);
    result = gse.evaluateScript(gr, "script");
  } catch (e) {
    result = e;
  } finally {
	// gr.script = '';
	gr.sys_scope = gr.sys_package = "global";
	gr.api_name = "global." + gr.name;
	if (!gr.update()) {
		snd_Xplore.gserror('Failed to reset scope.');
	}
  }

  var x = new global.snd_Xplore();
  x.xplore(result, "snd_Xplore.ObjectReporter", options);

  var report = x.reporter.getReport();
  return report; 
};

/**
  summary:
    Handle an exception to see if there is a line number we can use.
  e: mixed
    The error object
  code: String
    The code that generated the exception.
  returns: Boolean
    True if the error was explainable, false if not.
    This just means that we can forward the error to xplore if we like.
**/
XploreRunner.prototype.handleException = function handleException(e, code) {
  var errorStr = 'Exception thrown. ' + e;
  var lines, isUnknown = true;
  if (typeof e.lineNumber === 'string') {
    lines = this.getLines(code, parseInt(e.lineNumber, 10), 2);
    if (lines.length) {
      errorStr += '<br />' + lines.join('<br />').replace(' ', '&nbsp;');
      isUnknown = false;
    }
  }
  gs.addErrorMessage(errorStr);
  return isUnknown;
};

/**
  summary:
    Gets the lines of some text, e.g. code. Useful for showing errors.
  text: String
    The text to pull the lines from.
  at: Number
    The line number to highlight.
  span: Number
    The number of lines to add either side of the target line.
  **/
XploreRunner.prototype.getLines = function getLines(text, at, span) {
  var lines = text.split('\n');
  var result = [], i;

  function pre(i) {
    return i + 1 + ': ';
  }

  if (lines.length >= at) {
    at--; // account for base 0;
    for (i = (at - span); i < at; i++ ) {
      result.push(pre(i) + lines[i]);
    }
    result.push('=> ' + pre(at) + lines[at]);
    for (i = (at + 1); i <= (at + span) && i < lines.length; i++) {
      result.push(pre(i) + lines[i]);
    }
  }

  return result;
};

//==============================================================================
// Xplore Table Hierarchy
//==============================================================================

/**
  summary:
    Xplore table helper
**/
function XploreTableHierarchy(table, options) {

  // The maximum number of table extensions we will handle
  var MAX_DEPTH = 25;

  var SEARCH_LABELS =  options ? !!options.search_labels : false;

  /**
    summary:
      Get the hierarchy of a given table or all the tables.
    description:
      Builds an multi-dimensional array of objects, where each
      object represents a base table. Each object can have children
      and the children can also have children.
      The object also contains details of the table.
    table: String (Optional)
      The table to get the Hierarchy for. Providing no table
      will result in the entire table hierarchy being processed.
    returns: Array
  **/
  function getHierarchy(table) {
    var info,
      hierarchy,
      data = {};

    if (!table) throw new Error('Invalid table.');

    info = getTableInfo(table, SEARCH_LABELS);
    hierarchy = [];
    hierarchyLookup = {};
    data.names = getSortedKeys(info);

    // loop until we have no more tables to check
    eachArr(Array(MAX_DEPTH), function () {
      var nextNames = []; // process these names on the next iteration
      eachArr(data.names, function (i, name) {
        var dbo = info[name];
        /*dbo.toString = function () {
          return this.super_class + '.' + this.name;
        };*/
        if (!dbo.super_class) {
          // this is a base class
          dbo.children = []; // add a place for the children to go
          hierarchy.push(dbo); // add to our hierarchy
          hierarchyLookup[dbo.sys_id] = dbo;
        } else if (hierarchyLookup[dbo.super_class] !== undefined) {
          // this is an extension and it's parent has already been processed
          dbo.children = []; // children can have children
          hierarchyLookup[dbo.sys_id] = dbo;
          hierarchyLookup[dbo.super_class].children.push(dbo);
        } else {
          // process on next iteration
          nextNames.push(name);
        }
      });
      if (!nextNames.length) return false;
      data.names = nextNames;
    });

    return hierarchy;
  }

  /**
    summary:
      Get table details hierarchy information from sys_db_object.
    table: String (Optional)
      Look for details of all tables in this table's heirarchy.
      Not providing this parameter will return details of all tables.
    returns: Object
      An 2D object where each key is the name of the table and the
      value is an object containing a copy of the sys_db_object data.
  **/
  function getTableInfo(table, searchLabels) {
    var required, matchTable, matcher;

    // Is the user looking for all tables?
    if (table == '*') table = '';

    // Looking for all tables or a specific one
    if (!table || table.substr(0,1) === '=') {

      // remove the prefixed equal sign
      if (table) table = table.substr(1);

      if (table && searchLabels) {
        // Get the table object from its label
        required = getDbObjectByLabel(table);
      } else {
        // Get the table object from its name, or ALL table objects if table = ''
        required = getDbObject(table);
      }

    } else {

      matchTable = (function (t) {
        var c = t.substr(0,1);
        if (c === '>') {
          t = '^' + t.substr(1); // starts with
        } else if (c === '=') {
          t = '^' + t.substr(1) + '$'; // equals
        } else if (c === '*') {
          t = '';
        }
        // default is 'contains'
        return t;
      })(table);
      matcher = new RegExp(matchTable, 'i');

      // match on table is required, so get all tables and match
      required = {};
      eachObj(getDbObject(), function (name, obj) {
        var match = obj.name ? obj.name.match(matcher) : null;
        if (!match && searchLabels) {
          match = obj.label ? obj.label.match(matcher) : null;
        }
        if (match) {
          eachObj(getDbObject(name), function (name, obj) {
            required[name] = required[name] || obj;
          });
        }
      });

    }

    return required;
  }

  /**
    summary:
      Get an object of objects containing sys_db_object info
    param: label [String]
    returns: Object
  **/
  var getDbObjectByLabel = function (label) {
    var result = {};
    var gr = new GlideRecord('sys_db_object');
    gr.addQuery('label', '=', label);
    gr.setLimit(1);
    gr.query();
    if (gr.next()) {
      return getDbObject(gr.name);
    } else {
      throw 'Invalid table label: ' + label;
    }
  };

  /**
    summary:
      Get an object of objects containing sys_db_object info
    param: table [String]
    returns: Object
  **/
  var getDbObject = (function () {
    var dbo = GlideDBObjectManager.get();
    return function (table) {
      var result = {};
      var gr = new GlideRecord('sys_db_object');
      if (table) {
        gr.addQuery('name', 'IN', dbo.getHierarchy(table).toArray().join(','));
      }
      gr.query();
      if (!gr.hasNext()) {
        throw 'Invalid table name: ' + table;
      }
      while (gr.next()) {
        result[gr.getValue('name')] = info(gr);
      }
      return result;
    };
  })();

  function info(gr) {
    return {
      super_class: gr.getValue('super_class'),
      label: gr.getValue('label'),
      scope: gr.getValue('sys_scope'),
      sys_id: gr.getUniqueValue(),
      name: gr.getValue('name')
    };
  }

  /**
    summary:
      Helper function: loop through arrays
    arr: Array
      The array to loop through.
    fn: Function
      Callback function being given two parameters: index
      and current array item.
      Returning false will cancel the iteration.
  **/
  function eachArr(arr, fn) {
    var len = arr.length;
    for (var i = 0; i < len; i++) {
      if (fn(i, arr[i]) === false) {
        break;
      }
    }
  }

  /**
    summary:
      Helper function: loop through objects
    param: o [Object]
    param: fn [Function]
      Callback function being given two parameters: key and current object property.
      Returning false will cancel the iteration.
  **/
  function eachObj(o, fn) {
    for (var k in o) {
      if (fn(k, o[k]) === false) {
        break;
      }
    }
  }

  /**
    summary:
      Helper function: get an array of an objects' sorted property names
    obj: Object
    returns: Array
  **/
  function getSortedKeys(obj) {
    var keys = [];
    for (var key in obj) {
      keys.push(key);
    }
    keys.sort();
    return keys;
  }

  return getHierarchy(table);
}

//==============================================================================
// Xplore Process Script
//==============================================================================

(function () {

  snd_console = typeof snd_console === 'object' ? snd_console : {toString: function(){return 'not installed';}};

  // the initial UI file to serve
  var UI_MAIN = 'snd_xplore_main';

  // The name of the macro to render when access is denied.
  var UI_403 = '403.html';

  // Variables to inject into UI Macros
  var MACRO_VARS = {

    // The doctype to prepend to the UI file
    'DOCTYPE': '<!doctype html>',

    // required for attachments to work with glide.security.use_csrf_token on
    'SYSPARM_CK': gs.getSessionToken(),

    // The maximum attachment size that a user can upload
    'MAX_ATTACH_SIZE': (function () {
      var max = gs.getProperty('com.glide.attachment.max_size');
      if (!max) max = 1000;
      else max = parseInt(max, 10);
      if (isNaN(max)) { max = 20; }
      return max + 'MB';
    })(),

    'AMP': '&',

    'BUILD_DATE': gs.getProperty('glide.builddate')
  };

  // prevent the CSRF token from being required for these actions
  var NO_CSRF_CHECK = [];

  // the actions that can be run
  var actions = {};

  // Makes the parameters passed to the request easily available
  var params = (function () {
    var names = g_request.getParameterNames(),
        params = {},
        name,
        i;

    while (names.hasMoreElements()) {
      name = names.nextElement();
      params[name] = '' + g_request.getParameter(name);
    }
    if (params.data) {
      params.data = JSON.parse(params.data);
    }
    return params;
  })();

  function hasAccess() {
    if (gs.getImpersonatingUserName()) {
      var gr = new GlideRecord('sys_user_has_role');
      gr.addQuery('user.user_name', gs.getImpersonatingUserName());
      gr.addQuery('role.name', 'admin');
      gr.setLimit(1);
      gr.query();
      return gr.hasNext();
    } else {
      return gs.hasRole('admin');
    }
  }

  function isValidRequest(action) {
    return true; // override for time being
    // prevent CSRF
    /*var i;
    if (params.sysparm_ck) {
      return params.sysparm_ck == MACRO_VARS.SYSPARM_CK;
    }
    for (i = 0; i < NO_CSRF_CHECK.length; i++) {
      if (NO_CSRF_CHECK[i] == action) return true;
    }
    return false;*/
  }

  /**
    summary:
      A simple request handler that takes an action and data object.
    param: action [String]
      A keyword that can be used to determine the request.
    param: data [mixed]
      Arbitrary data object for use with processing.
  **/
  function processAction(params) {
    var start_time = new Date().getTime(),
        action_list = new ActionList(),
        action_name = params.action,
        ret = {$success: true},
        errors;

    try {
      if (action_name in action_list) {
          ret.result = action_list[action_name](params);
          if (ret.result === undefined) {
            ret.$success = false;
            ret.$error = 'Action returned undefined.';
          }
      } else {
        ret.$success = false;
        ret.$error = 'Invalid action name: \'' + action_name + '\'';
      }

      errors = snd_console.get ? snd_console.get({type: 'error'}) : [];
      if (errors.length) {
        ret.$success = false;
        ret.$error = errors.pop();
      }

    } catch (ex) {
      ret.$success = false;
      if (typeof ex === 'string' || !ex.name) {
        ret.$error = '' + ex;
      } else {
        ret.$error = 'Exception occured. ' + ex.name + ': ' + ex.message;
        if (ex.lineNumber) ret.$error += ' on line ' + ex.lineNumber;
      }
    }

    ret.$time = (new Date().getTime()) - start_time;

    if ('debug_mode' in params && snd_console.getStrings) {
      ret.$snd_console = snd_console.getStrings();
    }

    return ret;
  }

  /**
    summary:
      Process a template from a UI Macro and return the output.
    param: name [String]
      The name of the UI Macro to use.
    param: vars [Object] Optional
      An object of variables to pass to replace in the macro.
      Variables should be in the format `${variable_name}`
    returns: String
  **/
  function processTemplate(name, vars) {

    /**
      summary:
        Simple wrapper to get a single GlideRecord object
      param: table [String]
      param: query [String]
      returns: GlideRecord
    **/
    function getRecord(table, query) {
      var gr = new GlideRecord(table);
      gr.addEncodedQuery(query);
      gr.setLimit(1);
      gr.query();
      return gr.next() ? gr : false;
    }

    /**
      summary:
        Run a Jelly script.
      description:
        Takes an XML Jelly script and runs it with
        variables.
      jelly: String
        A jelly script to run.
      vars: Object (Optional)
        An object of name-value pairs to use in the
        Jelly script. The jelly script will need to
        prefix the names with 'jvar_'.
      returns: String
        The processed Jelly script.
    **/
    function runJellyScript(jelly, vars) {
      var runner = new GlideJellyRunner();
      if (typeof vars === 'object') {
        for (var name in vars) {
          runner.setVariable('jvar_' + name, vars[name]);
        }
      }
      return runner.run(jelly);
    }

    /**
      summary:
        Replaces ${variable} formatted variables in a string with the variable
        value.
      param: str [String]
      param: vars [Object] Optional
      returns: String
    **/
    function replaceVars(str, vars) {
      if (typeof vars == 'object') {
        str = str.replace(/\$\{\s*(\w+)\s*\}/g, function (m, word) {
          return vars.hasOwnProperty(word) ? vars[word] || '' : m;
        });
      }
      return str;
    }

    /**
      summary:
        Automagically set the versions on database Style Sheets and UI Scripts
      description:
        Searchs for links matching the cssdbx or jsdbx format.
        Stylesheets can be referenced by their name (normally sys_id).
        Replaces links with cache aware versions.
      param: html [String]
        The HTML template to work with.
      returns: String
        The modified HTML.
    **/
    function setScriptVersions(html) {

      function substrReplace(str, i, what, len) {
        return str.substr(0, i) + what + str.substr(i + (len || what.length));
      }

      function appendTime(html, match, map) {
        var gr, updated;

        gr = getRecord(map.table, map.key + '=' + match[1]);
        if (gr) {
          updated = new GlideDateTime(gr.sys_updated_on).getNumericValue();
          html = substrReplace(
              html,
              match.index,
              gr[map.val] + '.' + match[2] + '?v=' + updated,
              match[0].length);
        }

        return html;
      }

      var regexp = /([a-zA-Z0-9_.-]*)\.(cssdbx|jsdbx)/g,
          key_map = {
            'jsdbx':  {table: 'sys_ui_script', key: 'name', val: 'name'},
            'cssdbx': {table: 'content_css',   key: 'name', val: 'sys_id'}
          },
          map,
          match;

      while ((m = regexp.exec(html))) {
        if (key_map.hasOwnProperty(m[2])) {
          html = appendTime(html, m, key_map[m[2]]);
        }
      }

      return html;
    }

    var field = 'name',
        macro = getRecord('sys_ui_macro', field + '=' + name),
        output = '';
    if (macro) {
      output = runJellyScript(macro.xml, vars);
      //output = replaceVars(macro.xml.toString(), vars);
      output = setScriptVersions(output);
    } else {
      output = 'Macro ' + name + ' does not exist.';
    }
    return '<!doctype html>' + output;
  }

  var response;

  // check the user has the role to access
  if (!hasAccess()) {
    g_response.setStatus(403); // forbidden
    //response = processTemplate(UI_403, MACRO_VARS);
    if (response) {
      g_processor.writeOutput('text/html', response);
    } else {
      g_processor.writeOutput('text/plain', 'Error: access restricted.');
    }
  }

  else if ('ui_script' in params) {
    var gr = new GlideRecord('sys_script_include');
    gr.addQuery('api_name', '=', 'global.snd_Xplore');
    gr.setLimit(1);
    gr.query();
    gr.next();
    g_processor.writeOutput('text/plain', gr.script);
  }

  // prevent CSRF - all requests have valid sysparm_ck
  else if (params.action && !isValidRequest(params.action)) {
    g_response.setStatus(401);
    g_processor.writeOutput('text/plain', 'Authentication is not valid.');
  }

  // process the action that has been requested by the browser
  else if (params.action) {
    response = processAction(params);
    g_processor.writeOutput('application/json', JSON.stringify(response));
  }

  // send the requested template or the main interface
  else {

    // ensure script include
    MACRO_VARS.USER_SCRIPT = '' + (new XploreRunner().getUserScriptInclude().sys_id);

    response = processTemplate(params.template || UI_MAIN, MACRO_VARS);
    g_processor.writeOutput('text/html', response);
  }

})();