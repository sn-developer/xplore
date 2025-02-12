/* -----------------------------------------------------
                        XPLORE
------------------------------------------------------*/
var snd_xplore = (function () {

  // load the snd_Xplore script include in the browser - it works in both
  $.getScript('?ui_script');

  function run(params) {
    // summary:
    //   Run some code and send the results to the reporter
    // params: Object
    //   An instruction object

    params.reporter == params.reporter || defaultReporter();

    params.reporter.start(params);

    if (!params.code) {
      var result = psuedoResult();
      message(result, 'error', 'Expression required.');
      params.reporter.done(result);
      return;
    }

    if (params.target == "server") {
      runServerCode(params);
    } else {
      runClientCode(params);
    }
  }

  function runClientCode(params) {
    // summary:
    //   Run the script in the client and get the results
    // params: Object
    //   An instruction object

    function formatUserData(str, type) {
      var err = 'Unable to parse User Data as ',
          tmp;
      if (type.indexOf('XMLDocument') > -1) {
        try {
          return jQuery.parseXML(str);
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
    }

    function findTarget(target) {
      // summary:
      //   Get the client target window for the code
      // target: string
      //   The target window: 'opener' or 'frame_{n}'
      //   Leave empty or set false for the standard window
      // return the target window

      var target_window;
      if (typeof target === 'string' && (target == 'opener' || target.indexOf('frame_') === 0)) {
        if (!window.opener) {
          message(result, 'error', 'Cannot evaluate in parent; no opener found.');
        } else if (target == 'opener') {
          target_window = window.opener;
        } else {
          var i = parseInt(target.split('_')[1], 10);
          target_window = window.opener.frames.length >= i ? window.opener.frames[i] : false;
          if (!target_window) {
            message(result, 'error', 'Invalid frame index. Frame ' + i + ' not found.');
          }
        }
      } else {
        target_window = window;
      }
      return target_window;
    }

    var report = psuedoResult();
    var target = findTarget(params.target);

    if (!target) {
      params.reporter.done(report);
      return;
    }

    try {

      // spoof ServiceNow's jslog function
      var _jslog = target.jslog;
      target.jslog = function(msg, src) {
        var d = new Date();
        var timestamp =
          ('0' + d.getHours()).substr(-2) + ':' +
          ('0' + d.getMinutes()).substr(-2) + ':' +
          ('0' + d.getSeconds()).substr(-2) + '.' +
          ('00' + d.getMilliseconds()).substr(-3);
        var is_json;
        if (typeof msg === 'string') {
          is_json = snd_Xplore.isJson(msg);
          if (is_json) msg = '\n' + msg;
        } else {
          is_json = true;
          msg = '\n' + JSON.stringify(msg, null, 2);
        }
        if (src) {
          msg = timestamp + ': [' + src + '] ' + msg;
        } else {
          msg = timestamp + ': ' + msg;
        }
        message(report, 'log', msg, is_json);
      };

      target.user_data = formatUserData(params.user_data, params.user_data_type);
      params.dotwalk = params.breadcrumb;
      var eResult = target.eval(params.code);

      target.jslog = _jslog;

      var x = new snd_Xplore();
      x.xplore(eResult, 'snd_Xplore.ObjectReporter', params);
      var messages = report.messages;
      report = x.reporter.getReport();
      report.messages = messages;
    } catch (e) {
      if (typeof console !== 'undefined') (console.error || console.log)(e);
      var msg = e.toString();
      if (e.stack) {
        var match = (Array.isArray(e.stack) ? e.stack.join(' ') : e.stack).match(/^[\s\S]+?\s(?:at|in)\s[a-zA-Z0-9.]+/);
        if (match) msg = match[0].replace(/[\n\s]+/g, ' ');
      }
      message(report, 'error', msg, true);
    }

    params.reporter.done(report);
  }

  function runServerCode(params) {
    // summary:
    //   Perform an ajax call to our processor to run the script and get results
    // code: string
    // breadcrumb: array

    function enrichWithLogs(xhr, result) {
      $.ajax({
        type: 'GET',
        url: '/snd_xplore.do?action=logs',
        dataType: 'json'
      })
      .done(function (data) {
        data.result.messages = result.messages.concat(data.result.messages);
        result = data.result;
        if (xhr.responseText) {
          message(result, '1', xhr.responseText); // 1 = warning
        } else {
          message(result, 'error', 'Request failed.');
        }
        params.reporter.done(result);
      })
      .fail(function () {
        var result = result || psuedoResult();
        message(result, 'error', 'Automatic log retrieval failed.');
        if (xhr.responseText) message(result, '1', xhr.responseText); // 1 = warning
        params.reporter.done(result);
      });
    }

    $.ajax({
      type: "POST",
      url: "/snd_xplore.do?action=run",
      data: {
        data: JSON.stringify(params, function (key, val) {
          if (!key) return val; // this is the params object itself
          if (typeof val != 'object') { // now handle each property
            return val;
          }
        })
      },
      dataType: "json"
    })
    .done(function (data) {
      var result;
      // data.error is from SN, data.$error is from Xplore processor
      if (!data || (!data.result && !data.$error && !data.error)) {
        result = psuedoResult();
        message(result, 'error', 'The server did not return anything. This is likely because' +
            ' of an uncatchable error. Please check the node logs for the possibility' +
            ' of further information if you are unsure of the cause.');
        enrichWithLogs({}, result);
        return;
      }

      result = data.result || psuedoResult();
      if (data.$error || data.error) {
        message(result, 'error', data.$error || data.error);
      } else if (!data.result) {
        message(result, 'error', 'Request processing failed without an error. Please check the logs.');
        enrichWithLogs({}, result);
      }

      params.reporter.done(result);
    })
    .fail(enrichWithLogs);
  }

  function psuedoResult() {
    // summary:
    //   Replicate the result object returned by the server

    return {
      type: '',
      string: '',
      results: [],
      messages: []
    };
  }

  function message(result, type, value, is_json) {
    // summary:
    //   Write a message to the result object
    // type: string
    // value: string
    result.messages.push({
      type: '' + type,
      message: '' + value,
      is_json: is_json
    });
  }

  function defaultReporter() {
    return {
      start: function () {
        // summary:
        //   called when the code evaluation begins

        snd_log('Begin Xplore default reporter.');
      },
      done: function (result) {
        // summary:
        //   called when the code evaluation is complete

        snd_log('Xplore complete.', result);
      }
    };
  }

  return run;

})();

/* -----------------------------------------------------
                        LOG
------------------------------------------------------*/

/**
  summary:
    Ensure that the snd_log function is created. Used to ensures that scripts
    do not break when console isn't available.
  arguments: mixed
    All arguments are printed to the log (when console is available)
**/
if (typeof window.snd_log !== 'function') {
  window.snd_log = (function () {
    if (typeof console == 'object' && typeof console.log == 'function') {
      return function () {
        for (var i = 0; i < arguments.length; i++) console.log(arguments[i]);
      };
    }
    return function () {};
  })();
}

if (typeof window.jslog !== 'function') {
  window.jslog = window.snd_log;
}

/* -----------------------------------------------------
                        REGEX
------------------------------------------------------*/
snd_xplore.regex = (function () {

  /**
    summary:
      The main function for evaluating the regex call.
    returns: type
  **/
  function testRegex(config) {
    testRegex.fireEvent('start');

    var expression = config.expression;
    var options = config.options;
    var input = config.input;

    if (config.target == 'server') {
      testServerRegex(input, expression, options);
    } else {
      testClientRegex(input, expression, options);
    }
  }

  /**
    summary:
      Display the results on screen
    result: Object
      See resultGenerator()
  **/
  function displayRegexResult(result) {
    var data = {};
    if (result) {
      if (result.error) {
        data.error = result.error;
      } else if (!result.error && !result.matches.length) {
        data.error = 'No match.';
      } else {
          data = processResult(result);
      }
    } else {
      data.error = 'ParseError: No regex result to process.';
    }
    testRegex.fireEvent('done', this, [data]);
  }

  /**
    summary:
      Process a regex result and display it on screen
    result: Object
      An object containing:
      matches: Array [Object]
        Collection of match objects each with an index and length
      groups: Array [String]
        Collection of groups that were matched
      input:
        The original input
  **/
  function processResult(result) {
    var input = result.input,
        ret = {
          matches: [],
          groups: result.groups || []
        };

    function addMatch(text, type) {
      ret.matches.push({
        text: text,
        type: type || ''
      });
    }

    if (result.matches.length) {
      var lastEnd = 0;
      $.each(result.matches, function (i, item) {
        addMatch(input.substr(lastEnd, item.index - lastEnd));
        addMatch(input.substr(item.index, item.length), 'match');
        lastEnd = item.index + item.length;
      });
      addMatch(input.substr(lastEnd));
    }

    return ret;
  }

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
  function evalRegex(input, expression, options) {
    var regex,
        matches = [],
        groups = [],
        m,
        loop = options ? options.toString().indexOf('g') >= 0: false;

    if (input && expression) {
      options += '';
      try {
        regex = new RegExp(expression, options);
      } catch (e) {
        return {
          error: '' + e
        };
      }
      while ((m = regex.exec(input))) {
        matches.push({
          index: m.index,
          length: m[0].length
        });
        groups.push(m.slice(1));
        if (!loop) break;
      }
    }
    return {
      matches: matches,
      groups: groups,
      input: input
    };
  }

  function testClientRegex(input, expression, options) {
    try {
      var result = evalRegex(input, expression, options);
      displayRegexResult(result);
    } catch (e) {
      var estr = '' + e;
      var index = estr.indexOf(input);
      if (index >= 0) {
        estr = estr.substr(index + input.length + 4);
      }
      error(estr);
    }
  }

  function error(text) {
    testRegex.fireEvent('done', this, [{error: text}]);
  }

  var testServerRegex = (function () {
    var xhr;
    return function testServerRegex(input, expression, options) {
      if (xhr && xhr.readyState != 4) {
        xhr.abort();
      }
      xhr = $.ajax({
        type: "POST",
        url: "/snd_xplore.do?action=regex",
        data: {
          data: JSON.stringify({
            input: input,
            expression: expression,
            options: options
          })
        },
        dataType: "json"
      }).
      done(function (data) {
        displayRegexResult(data.result);
      }).
      fail(function (xhr, status) {
        if (status != 'abort') {
          snd_log('Server regex call failed.');
        }
      });
    };
  })();

  var events = {};

  testRegex.addEvent = function (name, fn) {
    if (typeof events[name] !== 'object') {
      events[name] = [];
    }
    events[name].push(fn);
  };

  testRegex.fireEvent = function (name, scope, args) {
    var eventArr = typeof events[name] === 'object' ? events[name] : null;
    if (!eventArr) return;
    for (var i = 0; i < eventArr.length; i++) {
      if (typeof eventArr[i] === 'function') {
        eventArr[i].apply(scope || this, args);
      }
    }
  };

  return testRegex;
})();
