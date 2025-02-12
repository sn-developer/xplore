var snd_Xplore = function () {
  this.prettyPrinter = new snd_Xplore.PrettyPrinter();
  this.default_reporter = 'snd_Xplore.PrintReporter';

  /**
   * {RegExp}
   * Ignore list to prevent looking over inaccessible Java stuff.
   * The majority of these are fully capitalised properties found on Java Packages
   * which would otherwise throw an exception.
   * There is no point even adding these to the results list.
   * E.g. DB, Y, _XML, M2MMAINTAINORDER
   */
  this.ignorelist_regexp = /^[A-Z0-9_$]+$/;
  this.debug = false;
};
snd_Xplore._lists = null;

snd_Xplore.MAX_DEPTH = 10;
snd_Xplore.DEFAULT_MAX_DEPTH = 2;

snd_Xplore.prototype.toString = function () {
  return '[object ' + this.type + ']';
};
snd_Xplore.prototype.type = 'snd_Xplore';

snd_Xplore.prototype.setReporter = function (name) {
  var o = snd_Xplore.dotwalk(typeof window === 'undefined' ? global : window, name);
  if (typeof o !== 'function') throw new Error(name + ' is not a valid reporter class.');
  this.reporter = new o();
  return this.reporter;
};

/**
 * Check if Xplore is being run in a scoped application.
 *
 * @return {Boolean}
 */
snd_Xplore.prototype.isInScope = function () {
  if (typeof window !== 'undefined') return false;
  return !('print' in gs);
};

/**
 * Gets the name of the current scope. e.g. 'global' or 'x_abc_test'
 *
 * @return {string}
 */
snd_Xplore.prototype.getScopeName = function (scope) {
  return scope === global ? 'global' : Object.prototype.toString.call().slice(8, -1);
};

snd_Xplore.prototype.debugMsg = function (msg) {
  if (this.debug) {
    if (typeof window === 'undefined') {
      snd_Xplore.gsdebug(msg);
    } else {
      jslog(msg);
    }
  }
};

/**
 * summary:
 *
 *
 * description:
 *   The snd_xplore function here allows exploratory programming to take place
 *   in ServiceNow. Simply call new snd_Xplore().xplore(my_obj) in a background
 *   script and watch all the objects get printed out on screen.
 * @summary: Iterate over any object to retrieve its contents.
 *
 * param: obj [Any]
 *   The object you want to explore!
 * param: reporter [String] Optional
 *   The name of the custom reporter object so you can customise where the output gets sent.
 * param: options [Object] Optional
 *   Customise what happens using this options object.
 *   -show_props: [Boolean]
 *     Set false to disable attempting to parse through the objects' properties.
 *     Defaults to true.
 *   -no_quotes: [Boolean]
 *     Set true to prevent quotes from being added to strings.
 *     Defaults to false.
 *   see: lookAt
 */
snd_Xplore.prototype.xplore = function (obj, reporter, options) {
  var use_json,
      warning,
      result,
      stack,
      time;

  stack = this.stack = [];

  this.debug = !!options.debug_mode;
  this.debugMsg('Running xplore in debug mode...');

  options = options || {};
  use_json = options.use_json;
  if (typeof options.use_json === 'undefined') options.use_json = false;

  this.prettyPrinter.noQuotes(options.no_quotes);

  // register the reporter on this object so it works in a scope
  if (reporter || !this.reporter) {
    this.reporter = this.setReporter(reporter || this.default_reporter);
  }
  reporter = this.reporter;

  if (options.dotwalk && (options.show_props === false || options.dotwalk_first)) {
    obj = snd_Xplore.dotwalk(obj, options.dotwalk, function (o, p, t) {
      var stack_index = stack.indexOf(o);
      if (stack_index > -1) {
        warning = 'This object has already been seen at ' + 
          p.slice(0, stack_index).join('.') + '.';
      }
      stack.push(o);
      time = t; // capture function call timing
    });
  }

  result = this.lookAt(obj, null, options);
  if (time != undefined) result.time = time;
  if (warning != undefined) result.warning = warning;
  
  reporter.begin(result);

  if (options.show_props !== false && obj !== null && obj !== undefined) {
    this.debugMsg('Exploring object ' + result.name);
    options.use_json = use_json;
    this.xploreProps(obj, reporter, options);
  }

  reporter.complete();
  this.debugMsg('Xplore complete.');

  return reporter;
};

snd_Xplore.prototype.xploreProps = function (obj, reporter, options) {
  var lists = snd_Xplore.getLists();
  var stack = this.stack;

  options.max_depth = options.hasOwnProperty('max_depth') ? options.max_depth : snd_Xplore.DEFAULT_MAX_DEPTH;
  options.max_depth = options.max_depth < 1
    ? 1 : options.max_depth > snd_Xplore.MAX_DEPTH
    ? snd_Xplore.MAX_DEPTH : options.max_depth;

  
  var _xploreProps = function _xploreProps(obj, path, parent) {
    var properties;
    var result;
    var time;
    var type;

    // if (path && path.length >= options.max_depth) {
    //   this.debugMsg('- Maximum object depth!');
    //   // result.warning = 'Xplore has reached maximum object depth' +
    //   //   ' for ' + path.join('.') + '.' + name + '; please manually' +
    //   //   ' navigate to this path in your script to view its properties.';
    //   return;
    // }

    properties = snd_Xplore.getPropertyNames(obj, path);
    if (!properties.length) {
      this.debugMsg('- No properties found at ' + path.join('.'));
      reporter.result(null, path);
      return;
    }

    type = snd_Xplore.getType(obj);
    for (var i = 0, name; i < properties.length; i++) {
      time = Date.now();
      name = properties[i];
  
      if (type.string == '[object String]' && name.match(/^[0-9.]+$/)) {
        // this is a letter in a string
        continue;
      }
  
      this.debugMsg('Looking at ' + name + ' in ' + (path.join('.') || type.name));
  
      if (lists.ignorelist.indexOf(',' + name + ',') > -1) {
        this.debugMsg(' - ignore listed');
        continue;
      }
      
      try {
        result = this.lookAt(obj[name], name, options);
        this.debugMsg(' - ' + result.type);
        reporter.result(result, path);
        if (options.max_depth > 1 && options.max_depth > path.length + 1) {
          if (name == 'sys_meta' && obj[name] == global.sys_meta) {
            result.warning = 'This is global.sys_meta. Exploring this could take a couple of minutes.';
          } else {
            _xploreChildren(obj[name], name, path, result);
          }
        }
      } catch (ex) {
        this.debugMsg(' - Exception: ' + ex);
        result = {
          name: name,
          type: '[Restricted]'
        };
        result.string = this.formatException(ex);
        reporter.result(result, path);
      }
      if (result) result.time = Date.now() - time;
    }
  }.bind(this);

  var _xploreChildren = function _xploreChildren(obj, name, path, result) {
    var stack_index = stack.indexOf(obj);
    if (stack_index > -1) {
      this.debugMsg('- Recursive exploration prevented!');
      if (options.dotwalk_first) {
        path = [].concat(options.dotwalk.split('.'), path);
      } else {
        stack_index++;
      }
      result.warning = 'This object has already been seen at ' + 
        path.slice(0, stack_index).join('.') + '.';
      return;
    }
    
    if (obj === (typeof window !== 'undefined' ? window : global)) {
      this.debugMsg('- Global scope found!');
      result.warning = 'This is the global scope. Please explore this separately.';
      return;
    }

    stack.push(obj);
    _xploreProps(obj, path.concat(name), result);
    stack.pop();
  }.bind(this);

  this.debugMsg('Exploring properties...');

  reporter = reporter || {};
  reporter.result = reporter.result || function () {};

  var _this = this;
  var dotwalk = options.dotwalk_first ? [] : options.dotwalk;
  snd_Xplore.dotwalk(obj, dotwalk, function (obj, path, time) {
    var name = path[path.length - 1];
    var result;
    if (!path.length || name === '()') {
      if (name == '()') {
        result = _this.lookAt(obj, name, options);
        if (typeof time === 'number') result.time = time;
        reporter.result(result, path.slice(0, path.length - 1));
      }
      _xploreProps(obj, path);
    }
  });

  this.debugMsg('Done exploring properties.');
};

snd_Xplore.prototype.formatException = function formatException(ex) {
  try {
    if (ex.message && ex.message.indexOf('Illegal access') > -1) {
      return '[Restricted]';
    }
  } catch (e) {
    // prevent getMessage errors
  }
  return '[Property access error: ' + ex + ']';
};

/**
  summary:
    The magic method that works out what any object is and even attempts to
    find it's contents.

  description:
    Takes any object and an optional name of that object and returns
    a simple result object containing the details of what was found.

  param: obj [Object]
    Any object that needs to be looked at.
  param: name [String] Optional
    The name of the object to populate the result with.
    Will attempt to find a default from type or name if not provided.
  param: options [Object] Optional
    An options object.

  returns: Object
    An object containing the following properties:
      -name [String]
        The name of the object if it was provided, otherwise an empty string.
      -type [String]
        The class name of the object.
**/
snd_Xplore.prototype.lookAt = function (obj, name, options) {
  var lists = snd_Xplore.getLists();
  var result = {};
  var type;

  this.prettyPrinter.noQuotes(options.no_quotes);

  result.name = name || undefined;
  result.type = '';
  result.string = null;

  // this covers an independent call to this function - handled by xploreProps
  if (lists.ignorelist.indexOf(',' + name + ',') > -1) {
    result.type = '*IGNORE LISTED*';
    return result;
  }

  // The try/catch is required for things like new GlideDateTime().tableName
  // which can throw a NullPointerException on access.
  try {

    if (obj === null || obj === undefined) {
      result.type = '' + obj;
      result.string = result.type;
    //   result.name = result.name || result.type;
      return result;
    }

    type = snd_Xplore.getType(obj);
    result.type = type.name;
    if (!name) {
      if (type.name == 'Function') result.name = obj.name || obj.prototype.type;
      else if (type.is_java || (type.of == 'object' && type.name != 'Object')) result.name = type.name;
      else if (type.name == 'Object') {
        result.name = (obj.constructor && obj.constructor.name) || obj.type;
        // for prototype having type and ignoring constructor name == 'Object'
        if (result.name == 'Object') result.name = obj.type;
      }
    }
    result.name = result.name || type.name;
  } catch (ex) {
    try {
      result.type = typeof obj;
    } catch (ex2) {
      result.type = '__unknown__';
      result.string = '[Property access error: ' + ex2 + ']';
      return result;
    }
  }

  if (lists.warnlist.indexOf(',' + result.type + ',') > -1) {
    result.string = '*WARN LISTED*';
    return result;
  }

  if (options.show_strings === false) {
    result.string = '*IGNORED*';
  } else {
    try {
      result.string = this.prettyPrinter.format(obj, type, options.use_json);
    } catch (e) {
      if (name != 'prototype') { // known issues trying to show string format for prototype objects
        snd_Xplore.gswarn('Warning: unable to show pretty format for "' + name + '" due to ' + e +
          ' Showing string format instead.');
      }
      try {
        result.string = this.prettyPrinter.String(obj);
      } catch (e) {
        result.string = '*FAILED* ' + e;
      }
    }
  }

  return result;
};

snd_Xplore._getPropertyArray = function (name) {
  var result;
  if (typeof window !== 'undefined') {
    result = [];
  } else {
    result = gs.getProperty(name, '').toString();
    result = result ? result.split(',') : [];
  }
  return result;
};

/**
 * Add elements for the Ignore List not captured by RegExp.
 * These property names will be completely ignored.
 *
 * @param {String} item The name of a property name to completely ignore.
 * @arguments Add further item names.
 */
snd_Xplore._ignorelist = snd_Xplore._getPropertyArray('snd_xplore.ignorelist');
snd_Xplore.ignorelist = function (item) {
  if (arguments.length) {
    snd_Xplore._ignorelist = snd_Xplore._ignorelist.concat(Array.prototype.slice.apply(arguments));
    snd_Xplore._lists = null;
  }
  return snd_Xplore._ignorelist;
};

/**
 * Add elements for the warn List which must not use toString as they will throw
 * an exception. These property names will still show up in the results.
 *
 * @param {String} item The name of a property name to completely ignore.
 * @arguments Add further item names.
 */
snd_Xplore._warnlist = snd_Xplore._getPropertyArray('snd_xplore.warnlist');
snd_Xplore.warnlist = function (item) {
  if (arguments.length) {
    snd_Xplore._warnlist = snd_Xplore._warnlist.concat(Array.prototype.slice.apply(arguments));
    snd_Xplore._lists = null;
  }
  return snd_Xplore._warnlist;
};

/**
 * Compile the ignore and warn lists into an object.
 *
 * @return {Object}
 *     ignorelist {String}
 *     warnlist {String}
 */
snd_Xplore.getLists = function () {
  if (snd_Xplore._lists === null) {
    // prefix/suffix with comma so exact search can be made ',foo,'
    snd_Xplore._lists = {
      ignorelist: ',' + snd_Xplore._ignorelist.join(',') + ',',
      warnlist: ',' + snd_Xplore._warnlist.join(',') + ','
    };
  }
  return snd_Xplore._lists;
};

/**
 * Navigate down the property chain of a given object.
 *
 * @param {Object} obj The object to navigate.
 * @param {String} path The path to follow, e.g. "child.name". If any property
 *     has a double parentheses, it will be called as a function.
 * @param {Function} callback A function that is passed object {String}, path {String[]}, and time
 * @return {Object} The property at the end of the chain.
 * @throws {Error}
 */
snd_Xplore.dotwalk = function (obj, path, callback) {
  // summary:
  //   Dotwalk a path on an object
  var pathArr = !path.length ? [] : (Array.isArray(path) ? path : path.split("."));
  var o = obj;
  var property;
  var time;

  pathArr = pathArr.reduce(function (r, c) {
    r.push(c.replace(/&#46;/g, "."));
    return r;
  }, []);

  callback = typeof callback === 'function' ? callback : function () {};
  callback(o, []);

  for (var i = 0; i < pathArr.length; i++) {
    property = pathArr[i];
    time = 0;

    if (o === undefined && pathArr[i + 1]) {
      throw new TypeError('Cannot read properties of undefined `' + property + '` (reading ' + pathArr[i + 1] + ')');
    }

    // convert paths with foo.bar() to foo.bar.()
    if (property != '()' && property.substring(property.length - 2) == '()') {
      property = property.substring(0, property.length - 2);
      pathArr.splice(i, 1, property, '()');
    }
    
    // evaluate property with function calls or default to standard dotwalking 
    if (pathArr[i + 1] == '()' && snd_Xplore.getType(o[property]).name.toLowerCase() == 'function') {
      i++;
      callback(o[property], pathArr.slice(0, i));
      time = Date.now();
      o = o[property](); // calling like this is important to maintain context
      time = Date.now() - time;
    } else if (property == '()' && snd_Xplore.getType(o).name.toLowerCase() == 'function') {
      time = Date.now();
      o = o();
      time = Date.now() - time;
    } else {
      try {
        o = o[property];
      } catch (ex) {
        throw new Error('Cannot access property ' + property +
          (pathArr.length && i ? ' at ' + pathArr.slice(0, i).join('.') : '') + '. ' + ex);
      }
    }

    callback(o, pathArr.slice(0, i + 1), time);
  }
  return o;
};

snd_Xplore.getPropertyNames = function getPropertyNames(obj, path) {
  var type = snd_Xplore.getType(obj);
  var result;
  
  // attempt to use getOwnPropertyNames in the first instance
  if (!type.is_java && (obj instanceof Object || typeof obj === 'function')) {
    try {
      result = Object.getOwnPropertyNames(obj);
    } catch (e) {
      path = path ? ' at ' + path.join('.') : '';
      snd_Xplore.gswarn('Error reading property names from object ' + path + ': ' + e);
      // do nothing - prevent 'not an object' errors with Java based objects
    }
  }

  // make sure we have an array
  if (!result) {
    result = [];
  }

  // get everything else
  for (var x in obj) {
    if (result.indexOf(x) === -1) result.push(x);
  }

  result.sort();
  return result;
};

snd_Xplore.getType = function getType(obj) {
  var type = {};

  type.string = Object.prototype.toString.call(obj);
  type.is_java = type.string.indexOf('Java') > -1;
  type.name = type.string.slice(8, -1);

  return snd_Xplore._getType(obj, type);
};

// This is in a separate function to prevent ClassCastException.
// For some reason, the presence of a try/catch in getType is throwing CCE. 
snd_Xplore._getType = function _getType(obj, type) {
  try {
    type.of = typeof obj;
  } catch (e) {
    if (e.message && e.message.indexOf('Invalid JavaScript value of type') > -1) {
      type.of = 'object';
      match = e.message.match(/(?:of type) (\S+)/);
      type.namespace = match ? match[1] : 'unknown';
    } else {
      snd_Xplore.gswarn('Error finding type in getType: ' + e);
    }
  }
  return type;
};

//==============================================================================
// Pretty Printer
//==============================================================================

snd_Xplore.PrettyPrinter = function () {
  this.is_browser = typeof window !== 'undefined';
  this.global = this.is_browser ? window : global;
  this.scope =  (function () { return this; })();
  this.not_str_regex = /^\[[a-zA-Z0-9_$. ]+\]$|^[a-zA-Z0-9.$]+@[a-z0-9]+$/;
};
snd_Xplore.PrettyPrinter.prototype = {

  type: 'PrettyPrinter',

  noQuotes: function (b) {
    this.no_quotes = !!b;
  },

  'String': function (obj) {
    try {
      obj = obj + '';
    } catch (e) {
      obj = Object.prototype.toString.call(obj);
    }

    // handle object types and memory references
    if (this.no_quotes || obj.match(this.not_str_regex)) {
      return obj;
    }

    return '"' + obj + '"';
  },

  'Boolean': function (obj) {
    return obj ? 'true' : 'false';
  },

  'Function': function (obj) {
    return Function.prototype.toString.call(obj);
  },

  'Number': function (obj) {
    return '' + obj;
  },

  'Array': function (obj) {
    // var str = [];
    // for (var i = 0; i < obj.length; i++) {
    //   str.push(this.format(obj[i]));
    // }
    // return '[' + str.join(', ') + ']';
    try {
      return JSON.stringify(obj, '', 2);
    } catch (e) {
      snd_Xplore.gswarn('Warning: unable to show JSON format due to ' + e +
        ' Showing string format instead.');
      return obj.toString();
    }
  },

  'SNRegExp': function (obj) {
    return obj.toString();
  },

  'GlideRecord': function (obj) {
    return [
      'table: ' + obj.getLabel() + ' [' + obj.getTableName() + ']',
      'sys_id: ' + obj.getUniqueValue(),
      'display: ' + obj.getDisplayValue(),
      'query: ' + obj.getEncodedQuery(),
      'link: ' + obj.getLink(true)
    ].join('\n');
  },

  'GlideElement': function (obj, type) {
    var internal_type = 'string',
        ed;

    if (type.indexOf('GlideElementHierarchicalVariables') > -1) {
      return ''; // prevent TypeError: Cannot find default value for object.
    }

    try {
      ed = obj.getED();
      internal_type = ed.getInternalType();
    } catch (e) {}

    if (internal_type == 'boolean') {
      return obj ? 'true' : 'false';
    }
    if (internal_type == 'reference') {
      return this.GlideElementReference(obj);
    }
    if (ed.isChoiceTable()) {
      return obj.getDisplayValue() + ' [' + obj + ']';
    }

    try {
      if (type.indexOf('Scoped') > -1) {
        obj = '' + obj;
      } else {
        obj = obj.getValue ? obj.getValue() : '' + obj;
      }
      return this.format(obj);
    } catch (e2) {
      return e2.toString();
    }
  },

  'GlideElementReference': function (obj) {
    var result = '"' + obj + '"';
    if (!obj.nil()) {
      result += ' [';
      if (obj.getReferenceTable) {
        result += obj.getReferenceTable() + ' ';
      }
      result += this.String(obj.getDisplayValue()) + ']';
    }
    return result;
  },

  format: function (obj, type, use_json) {
    var root_type = type.name.replace('GlideScoped', 'Glide');

    if (this.is_browser) {
      return type.name in this ? this[type.name](obj) : '' + obj;
    }

    if (obj === this.global || type.name == 'global') {
      return '[global scope]';
    }

    if (obj === this.scope) {
      return '[' + type + ' scope]';
    }

    if (root_type.indexOf('GlideRecord') > -1) return this.GlideRecord(obj);
    if (root_type.indexOf('GlideElement') > -1) return this.GlideElement(obj, type.name);

    // handle native JavaScript objects which would be useful to see as JSON
    if (use_json && (obj instanceof Object || Array.isArray(obj))) {
      return JSON.stringify(obj, '', 2);
    }

    // handle native JavaScript objects which we know have a toString
    if (obj instanceof Function ||
        obj instanceof Object ||
        obj instanceof Array ||
        type.name == 'Number' ||
        type.name == 'Boolean' ||
        type.name == 'String' ||
        obj instanceof RegExp) {
      try {
        return type.name in this ? this[type.name](obj) : this.String(obj);
      } catch (e) {
        return this.String(obj);
      }
    }

    var java_type;
    try {
      java_type = type.of == 'function' || type.name === 'Function' || type.name === 'Object';
    } catch (e) {}

    // Java objects can have the same type but break when calling toString
    // We would only get here if their instanceof did not match.
    if (java_type) {
      try{
        return '' + obj;
      } catch (e) {
        if (e.message && (
          e.message == 'Cannot find default value for object.' 
          || e.message.indexOf('cannot be cast') > -1
          || String(e.type).indexOf('ClassCastException') > -1
        )) {
          return '';
        } else {
          snd_Xplore.gswarn('Error converting to string: ' + e);
        }
      }

      return '';
    }

    // catch all
    try {
      return this.String(obj);
    } catch (e) {
      return type.string;
    }
  },

  toString: function () {
    return '[object ' + this.type + ']';
  }

};

//==============================================================================
// Default Print Reporter
//==============================================================================

/**
 * Follow this object format in order to build a custom reporter that
 * can be passed into snd_xplore for custom reporting requirements.
 */
snd_Xplore.PrintReporter = function () {
  this._fn = '';
  if (typeof window !== 'undefined') {
    this._fn = typeof console !== undefined && console.log ? 'console' : 'jslog';
  } else {
    this._fn = 'print' in gs ? 'debug' : 'print';
  }
};
snd_Xplore.PrintReporter.prototype.type = 'PrintReporter';
snd_Xplore.PrintReporter.prototype.toString = function () {
  return '[object ' + this.type + ']';
};

snd_Xplore.PrintReporter.prototype.print = function (str) {
  if (this._fn == 'console') console.log(str);
  else if (this._fn == 'jslog') jslog(str);
  else if (this._fn) gs[this._fn](str);
};

/**
 * Called when the main object is evaluated.
 * @param {Object} obj A result object
 */
snd_Xplore.PrintReporter.prototype.begin = function (result) {
  this.print('Xplore: ' + result.name + ' [' + result.type + '] : ' + result.string);
};

/**
 * Called each time a property of the object is evaluated.
 * @param {Object} result A result object
 */
snd_Xplore.PrintReporter.prototype.result = function (result, path) {
  path = path.length ? path.join('.') + '.' : '';
  this.print('[' + result.type + '] ' + path + result.name + ' = ' + result.string);
};

/**
 * Called when snd_xplore has finished running.
 */
snd_Xplore.PrintReporter.prototype.complete = function () {
  this.print('Complete.');
};

//==============================================================================
// Object Reporter
//==============================================================================

/**
 * Pushes an array of objects containing two properties describing the message
 * into the response.messages array.
 *
 * Must be run in global scope.
 *
 * @summary Get all the output messages generated in this session, then flush them.
 * @return {Array} An array of objects where each object in the array contains:
 *     type {String} The property type: log, info, error, access
 *     message {String} The message.
 *
**/
snd_Xplore.getOutputMessages = function () {

  function add(type, message) {
    var o = {};
    //o.date = Date.now();
    o.type = type;
    o.message = message;
    o.is_json = snd_Xplore.isJson(message);
    ret.push(o);
  }

  var ret = [],
      tmp,
      i;

  if (typeof window !== 'undefined') return ret;

  // access
  tmp = gs.getAccessMessages().toArray();
  for (i = 0; i < tmp.length; i++) {
    add('access', tmp[i]);
  }

  // errors
  tmp = gs.getErrorMessages().toArray();
  for (i = 0; i < tmp.length; i++) {
    add('error', tmp[i]);
  }

  // info
  tmp = gs.getInfoMessages().toArray();
  for (i = 0; i < tmp.length; i++) {
    add('info', tmp[i]);
  }

  var logs;
  if (snd_Xplore._logtail) {
    logs = [].concat(this._gslogs, snd_Xplore._logtail.getMessages());
    logs.sort(function (a, b) {
      if (a.date > b.date) return 1;
      if (b.date > a.date) return -1;
      return 0;
    });
    ret = ret.concat(logs);
  } else {

    // merge gslog workaround for Istanbul onwards
    ret = ret.concat(snd_Xplore._gslogs); 
  }


  // gs.print
//   tmp = GlideSessionDebug.getOutputMessages().toArray();
//   try {
//     for (i = 0; i < tmp.length; i++) {
//       add('log', ('' + tmp[i].line).replace(' : ', ' ')); // remove unnecessary colon
//     }
//   } catch (e) {
//     if (tmp.length) {
//       ret.unshift({type: 'access', message: '<p>Hey!<p>' +
//         '<p>It looks like you\'re using <code>gs.print</code>, <code>gs.info</code>, ' +
//         '<code>gs.warn</code> or <code>gs.error</code> in your script.</p>' +
//         '<p>Unfortunately ServiceNow have locked down the API and we no longer have access to read ' +
//         'those messages. You can see them by going to Logs > Node Logs; the time and thread name ' +
//         'should be pre-populated for this thread. Alternatively you can replace those methods with ' +
//         '<code>gs.addInfoMessage</code> although I appreciate this doesn\'t work for Script Includes, etc.</p>' +
//         '<p>If you have any insight or can help fix this, please get in touch!</p>' +
//         '<p>Thanks! James</p>' +
//         '<p><small>Original exception: ' + e.toString() + '</small></p>'});
//     }
//   } finally {
//     // remove all the messages we just retrieved
//     GlideSessionDebug.clearOutputMessages();
//   }

  gs.flushAccessMessages();
  gs.flushMessages();

  for (var i = 0, msg; i < ret.length; i++) {
    msg = ret[i];
    msg.message = snd_Xplore.formatDate(msg.date) + (msg.is_json ? '\n' : ' ') + msg.message;
  }

  return ret;
};


/**
 * Server side method for getting any errors or warning that occured for the
 * user in the last minute or so. Logs are pushed to the main result object.
 *
 * @return {Array} An array of objects containing the properties:
 *     created {Number]
 *     level {String}
 *     message {String}
 *     source {String}
**/
snd_Xplore.getLogs = function () {
  var ret = [],
      level_map,
      gr;

  if (typeof window !== 'undefined') return ret;

  level_map = {
    '-1': 'Debug',
    '0': 'Info',
    '1': 'Warning',
    '2': 'Error'
  };

  gr = new GlideRecord('syslog');
  gr.addQuery('sys_created_on', 'ON', 'Current minute@javascript:gs.minutesAgoStart(0)@javascript:gs.minutesAgoEnd(0)');
  gr.addQuery('sys_created_by', '=', gs.getUserName())
      .addOrCondition('sys_created_by', '=', 'system');
  gr.addQuery('level', 'IN', '1,2');
  gr.orderBy('sys_created_on');
  gr.query();

  while (gr.next()) {
    ret.push({
      created: gr.sys_created_on.getDisplayValue(),
      level: level_map[gr.getValue('level')],
      message: gr.getValue('message'),
      source: gr.getValue('source')
    });
  }

  return ret;
};

/**
 * A reporter to pass to snd_xplore for capturing results so they can be shown
 * in the UI.
 */
snd_Xplore.ObjectReporter = function () {
  this.is_browser = typeof window !== 'undefined';
  this.start_time = snd_Xplore.formatDate();
  this.report = {
    // The type of object that is being evaluated
    type: '',
    // the valueOf value of the object being evaluated
    value: '',
    // the string value of the object being evaluated
    string: '',
    // the list of property objects
    results: [],
    // the list of captured messages
    messages: [],
    // a list of logs that occured very recently
    logs: [],
    // self explanatory really!
    status: '',
    // the url to access the node logs
    node_log_url: ''
  };
};
snd_Xplore.ObjectReporter.prototype.type = 'ObjectReporter';
snd_Xplore.ObjectReporter.prototype.toString = function () {
  return '[object ' + this.type + ']';
};

snd_Xplore.ObjectReporter.prototype.getReport = function () {
  return this.report;
};

snd_Xplore.ObjectReporter.prototype.begin = function (obj) {
  this.report.status = 'started';
  this.report.type = obj.type;
  this.report.name = obj.name;
  this.report.value = obj.value;
  this.report.string = obj.string;
  this.report.time = obj.time;
  this.time_start = Date.now();
  if (obj.warning) this.report.warning = obj.warning;
};

snd_Xplore.ObjectReporter.prototype.result = function (obj, path) {
  var item = (!path || !this.current_item || this.current_path != path.join('.')) ? this.findResult(path) : this.current_item;
  if (!item) {
    if (path[path.length - 1] == '()') {
      item = this.findResult(path.slice(0, path.length - 1));
    }
    if (!item) {
      snd_Xplore.gserror('snd_Xplore.ObjectReporter failed to find report result' + (path ? ' at ' + path.join('.') : ''));
      return;
    }
  }
  if (item !== this.current_item) {
    this.current_item = item;
    this.current_path = path ? path.join('.') : '';
  }
  if (!item.results) item.results = [];

  // we might report a result of nothing, i.e. there are no properties
  // we track this by just having an empty results array
  if (obj) item.results.push(obj); 
};

snd_Xplore.ObjectReporter.prototype.complete = function () {
  this.report.status = 'finished';
  this.report.start_time = this.start_time;
  this.report.end_time = snd_Xplore.formatDate();
  this.report.node_log_url = this.generateNodeLogUrl();
  this.report.time = (this.report.time || 0) + (Date.now() - this.time_start);
};

snd_Xplore.ObjectReporter.prototype.findResult = function (path, result) {
  result = result || this.report;
  if (!path || !path.length) return result;
  for (var i = 0; i < result.results.length; i++) {
    if (result.results[i].name == path[0]) {
      return this.findResult(path.slice(1), result.results[i]);
    }
  }
};

snd_Xplore.ObjectReporter.prototype.generateNodeLogUrl = function () {
  // create the URL for the ui_page to display the log data
  var maxRows = 2000;
  var url = "ui_page_process.do?name=log_file_browser";

  if (this.is_browser) return '';

  url += "&end_time=" + (new GlideDateTime().getDisplayValue());
  url += "&start_time=" + this.start_time;
  url += "&max_rows=" + maxRows;
  url += '&filter_thread=' + this.getThreadName();
  return url;
};
snd_Xplore.ObjectReporter.prototype.getThreadName = function () {
  // this works around the exceptions thrown by calling getName() or using .name
  // Those are totally broken in Jakarta.
  var value = '' + Object.prototype.valueOf.call(GlideWorkerThread.currentThread());
  var m = value.match(/(?:\[)([^,]+)/);
  if (!m) {
    snd_Xplore.gswarn('Cannot get current thread name.', 'snd_Xplore');
    return '';
  }
  return m[1];
};

snd_Xplore.getVersion = function () {
  if (typeof window === 'undefined') 
  var gr = new GlideRecord('sys_app');
  gr.addQuery('sys_id', '=', '0f6ab99a0f36060094f3c09ce1050ee8');
  gr.setLimit(1);
  gr.query();
  return gr.next() ? gr.getValue('version') : 'Unknown';
};

///////////////////////////////////////////////////////
// Workaround for log statements in Istanbul onwards //
///////////////////////////////////////////////////////

snd_Xplore._gslogs = [];
snd_Xplore._gslogMessage = function (level, msg, source, params) {
  //var time = new Date().toISOString().replace('T', ' ').replace(/\.(\d+)Z/, ' ($1)');
  var tmp = {};
  tmp.date = Date.now();
  tmp.type = level;
  tmp.source = source;
  if (typeof msg === 'string') {
  if (Array.isArray(params)) {
    msg = snd_Xplore.substitute(msg, params);
  } else {
    tmp.is_json = snd_Xplore.isJson(msg);
  }
  } else {
    tmp.is_json = true;
    msg = JSON.stringify(msg, null, 2);
  }
  //tmp.message = time + ': ' + (tmp.is_json ? '\n' : '') + msg;
  tmp.message = msg;
  snd_Xplore._gslogs.push(tmp);
};
snd_Xplore.gsprint = function (msg) {
  snd_Xplore._gslogMessage('-1', msg);
};
snd_Xplore.gslog = function (msg, source) {
  snd_Xplore._gslogMessage('-1', msg, source);
};
snd_Xplore.gsdebug = function (msg, p1, p2, p3, p4, p5) {
  snd_Xplore._gslogMessage('-1', msg, null, [p1, p2, p3, p4, p5]);
};
snd_Xplore.gsinfo = function (msg, p1, p2, p3, p4, p5) {
  snd_Xplore._gslogMessage('0', msg, null, [p1, p2, p3, p4, p5]);
};
snd_Xplore.gswarn = function (msg, p1, p2, p3, p4, p5) {
  snd_Xplore._gslogMessage('1', msg, null, [p1, p2, p3, p4, p5]);
};
snd_Xplore.gserror = function (msg, p1, p2, p3, p4, p5) {
  var params;
  if (p1 && p1 instanceof Error) {
    msg += ': ' + p1;
  } else {
    params = [p1, p2, p3, p4, p5];
  }
  snd_Xplore._gslogMessage('2', msg, null, params);
};
snd_Xplore.notice = function (msg) {
  var tmp = {};
  tmp.type = '1'; // warn
  tmp.message = 'Notice: ' + msg;
  snd_Xplore._gslogs.push(tmp);
};
snd_Xplore.substitute = function substitute(msg, params) {
  return msg.replace(/{(\d)}/g, function (m, index) {
    return params.length > index ? params[index] : m;
  });
};

snd_Xplore.isJson = function isJson(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

snd_Xplore.formatDate = function formatDate(date) {
  // server side
  if (typeof window === 'undefined') {
    var gdt = new GlideDateTime();
    if (date && typeof date === 'number') {
      gdt.setNumericValue(date);
    } else if (date) {
      gdt.setValue(date);
    }
    return gdt.getDisplayValue();
  }

  // client side
  if (!date) {
    date = new Date();
  } else if (!(date instanceof Date)) {
    date = new Date(parseInt(String(date), 10));
  }
  if (String(date).indexOf('Invalid')) return String(date);
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate() + 
    ' ' + String(date.getHours()).padStart(2, '0') + 
    ':' + String(date.getMinutes()).padStart(2, '0') + 
    ':' + String(date.getSeconds()).padStart(2, '0') +
    ' (' + date.getMilliseconds() + ')';
};

//==============================================================================
// Xplore Logtail
//==============================================================================

/**
 * Class for capturing logs. Does not capture scoped logs, only global.
 *
 */
snd_Xplore.Logtail = function Logtail() {
  this.channel_name = 'logtail';
  this.cm = GlideChannelManager.get();
  if (!this.cm.exists(this.channel_name)) {
     throw 'Channel does not exist: ' + this.channel_name;
  }
  this.channel = this.cm.getChannel(this.channel_name);

  // Copy ChannelAjax
  GlideThreadAttributes.createThreadAttribute("streaming_channel", this.channel_name);

  this.start_sequence = this.channel.getLastSequence();

  // we need this here (after getting the last channel sequence) so we can determine the transaction ID later
  gs.debug('Starting ' + this.type);

  this.messages = [];

  this.filter_messages = true;

};

snd_Xplore.Logtail.prototype.type = 'snd_Xplore.Logtail';

/**
 * Call this before executing any code to capture logs.
 *
 */
snd_Xplore.Logtail.start = function start() {
  // give to main object for getOutputMessages()
  snd_Xplore._logtail = new snd_Xplore.Logtail();
  return snd_Xplore._logtail;
};

snd_Xplore.Logtail.getMessages = function getMessages() {
  if (snd_Xplore._logtail) {
    return snd_Xplore._logtail.getMessages();
  }
};

snd_Xplore.Logtail.prototype._messageFactory = function _messageFactory(date, message) {
  var type = 'log';
  if (message.indexOf('no thrown error') > -1) type = 'error'; // find call to gs.error
  var o = {};
  o.type = type;
  o.message = message;
  o.date = date;
  o.is_json = snd_Xplore.isJson(message);
  return o;
};

snd_Xplore.Logtail.prototype._getTransactionId = function _getTransactionId(message) {
  return message.substr(0, 32);
};

snd_Xplore.Logtail.prototype.validateMessage = function validateMessage(channel_message) {
  var message = channel_message.getMessage();
  var ignore = false;

  if (!this.transaction_id) {
    if (message.indexOf(this.type) === -1) {
      if (this.filter_messages) return false;
    } else {
      this.transaction_id = this._getTransactionId(message);
      // this.messages.push(this._messageFactory('Transaction ID: ' + this.transaction_id));
      if (this.filter_messages) return false; // the user doesn't need to see this message really
    }
  } else {
    if (this.filter_messages && this.transaction_id != this._getTransactionId(message)) {
      return false;
    }
  }

  if (this.filter_messages) {
    message = message.substr(33); // remove Transaction ID
    if (message.indexOf('*** Script: ') === 0) {
      message = message.substr(12);
    }
  }

  return this._messageFactory(channel_message.getDate(), message);
};

snd_Xplore.Logtail.prototype.getMessages = function getMessages() {
  var channel_messages = this.channel.getMessages();
  var size = channel_messages.size();
  var transaction;
  this.messages = [];
  for (var i = 0; i < size; i++) {
    var message = channel_messages.get(i);
    if (message.getSequence() > this.start_sequence) {
      message = this.validateMessage(message);
      if (message) {
        this.messages.push(message);
      }
    }
  }
  return this.messages;
};

snd_Xplore.ScriptHistory = (function () {

  if (typeof window === 'object') return;

  function ScriptHistory() {}

  ScriptHistory.prototype.type = 'snd_Xplore.ScriptHistory';

  ScriptHistory.SCRIPT_PREFIX = 'xplore.script.';

  ScriptHistory.HISTORY_PREFIX = 'xplore.history.';

  ScriptHistory.prototype.store = function store(options) {
    var result;

    if (!options || typeof options != 'object') {
      throw new Error('Invalid options object.');
    }

    options = Object.extend({}, options);

    // If we are running a script again that was loaded, then let's just update it
    // to match the current settings.
    // If the script has changed (or was not loaded) then we'll create a new entry.
    if (options.loaded_id) {
      this._preventDuplicate(options);
    }

    options.id = options.id || (ScriptHistory.HISTORY_PREFIX + Date.now());
    options.name = options.name || new GlideDateTime().getDisplayValue() + ' Script';

    if (!options.id.startsWith(ScriptHistory.HISTORY_PREFIX)) {
      options.id = ScriptHistory.HISTORY_PREFIX + options.id;
    }

    result = this.setPreference(options.id, JSON.stringify(options), options.name);

    this.enforceHistoryLimit(gs.getProperty('snd_xplore.history.limit'));

    return result;
  };

  ScriptHistory.prototype._preventDuplicate = function (options) {
    var script = this.get(options.loaded_id);
    var diff = false;
    if (!script) return;

    'target,scope,code,user_data,user_data_type,support_hoisting'.split(',').forEach(function (name) {
      diff = diff || (options[name] != script[name]);
    });

    if (diff) return;

    // Use the historic script ID to prevent the same script being inserted numerous times
    options.id = options.loaded_id;
  };

  ScriptHistory.prototype.get = function get(id) {
    var preference = this.getPreference(id);
    if (!preference) return;
    try {
      return JSON.parse(preference.getValue('value'));
    } catch (e) {
      return {
        id: preference.getValue('name'),
        name: '[Invalid script]'
      };
    }
  };

  ScriptHistory.prototype.retrieve = function retrieve() {
    var result = [];
    var obj,
        gr;

    gr = new GlideRecord('sys_user_preference');
    gr.addQuery('user', '=', gs.getUserID());
    gr.addQuery('name', 'STARTSWITH', ScriptHistory.SCRIPT_PREFIX)
      .addOrCondition('name', 'STARTSWITH', ScriptHistory.HISTORY_PREFIX);
    gr.orderByDesc('sys_updated_on');
    gr.query();

    while (gr.next()) {
      try {
        result.push(JSON.parse(gr.getValue('value')));
      } catch (e) {
        result.push({
          id: gr.getValue('name'),
          name: '[Invalid script]'
        });
      }
    }

    return result;
  };

  ScriptHistory.prototype.renameScript = function renameScript(id, name) {
    var gr = this.getPreference(id);
    var obj;
    if (gr) {
      try {
        obj = JSON.parse(gr.getValue('value'));
      } catch (e) {
        throw new Error('Unable to rename script because of corrupt database value.');
      }
      obj.name = name;
      gr.setValue('description', name);
      gr.setValue('value', JSON.stringify(obj));
      return gr.update();
    }
    return false;
  };

  ScriptHistory.prototype.remove = function remove(id) {
    var gr = this.getPreference(id);
    if (gr) {
      return gr.deleteRecord();
    }
    return false;
  };

  ScriptHistory.prototype.enforceHistoryLimit = function enforceHistoryLimit(max_count, delete_limit) {
    max_count = max_count || 50;

    // we should only need to delete one - one in, one out, but this covers it somewhat if the settings are changed
    delete_limit = delete_limit || 50;
    var count;
    var gr = new GlideRecord('sys_user_preference');
    gr.addQuery('user', '=', gs.getUserID());
    gr.addQuery('name', 'STARTSWITH', ScriptHistory.HISTORY_PREFIX);
    gr.orderByDesc('sys_updated_on');
    gr.chooseWindow(max_count, delete_limit);
    gr.query();

    count = gr.getRowCount();
    if (count > (max_count + delete_limit)) {
      snd_Xplore.gsError('Aborting snd_Xplore.ScriptHistory.enforceHistoryLimit() to prevent ' +
        'unexpected data loss. Found ' + count + ' which breached the safety limit of ' +
        (max_count + delete_limit) + '. Query used: ' + gr.getEncodedQuery());
      return;
    }

    while (gr.next()) {
      gr.deleteRecord();
    }
  };

  ScriptHistory.prototype.setPreference = function setPreference(name, value, description) {
    var gr = this.getPreference(name);

    if (!gr) {
      gr = new GlideRecord('sys_user_preference');
      gr.user = gs.getUserID();
      gr.name = name;
    }

    gr.value = value;
    gr.description = description;
    return gr.update();
  };

  ScriptHistory.prototype.getPreference = function getPreference(name) {
    var gr = new GlideRecord('sys_user_preference');
    gr.addQuery('name', '=', name);
    gr.setLimit(1);
    gr.query();
    return gr.next() ? gr : null;
  };

  return ScriptHistory;
})();
