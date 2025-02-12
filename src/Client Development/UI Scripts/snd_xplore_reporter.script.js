var snd_xplore_reporter = (function () {

  var cached_result = null;

  var copy_btn = '<button class="btn btn-xs btn-link interactive copy-value pull-right"' +
    ' title="Copy value"><i class="glyphicon glyphicon-copy"></i> Copy value</button>';

  function setDescription(table, result) {
    var type = result.type ? result.type : '*UNKNOWN*';
    if (type.toLowerCase() === 'function') {
      type += ' <a href class="interactive">()</a>';
    }

    table.empty();

    if (result.start_time && result.hasOwnProperty('results')) {
      $('#result_timestamp').text(
        (result.regenerated ? 'Regenerated' : 'Generated') +
        (typeof result.time === 'number' ? ' in ' + (result.time / 1000).toFixed(2) + 's' : '')
        + ' on ' + result.start_time);
      $('#result_timestamp_container,#regenerate').removeClass('hidden');
    } else {
      $('#result_timestamp_container');
    }

    if (result.warning) {
      table.append('<tr class="bg-warning"><th class="col-md-1">Warning</th><td class="col-md-11">' + result.warning +
        '</td></tr>');
    }

    if (result.name) {
      table.append('<tr><th class="col-md-1">Name</th><td class="col-md-11">' + result.name + '</td></tr>');
    }
    table.append('<tr><th class="col-md-1">Type</th><td class="col-md-11">' + type + '</td></tr>');

    if (!result.string) result.string = "";
    if (result.string.length < 100 && result.string.indexOf('\n') == '-1') {
      table.append('<tr><th class="col-md-1">Value</th><td class="col-md-11">' +
          copy_btn +
          lineBreaks(prettyPrint(insertLinks(escapeHtml(result.string)))) + '</td></tr>');
    } else {
      table.append('<tr class="data-more"><td colspan="2">' +
          '<div class="clearfix">' +
            copy_btn +
            '<strong>Value</strong><br>' +
          '</div>' +
          '<pre class="prettyprint linenums"><code>' + insertLinks(escapeHtml(formatForPre(result.string))) +
          '</code></pre></td></tr>');
    }
  }

  function findResult(breadcrumbs, result) {
    var item;
    if (!cached_result || !Array.isArray(cached_result.results)) return;
    item = breadcrumbs.reduce(function (result, name) {
      if (result && Array.isArray(result.results)) {
        for (var i = 0; i < result.results.length; i++) {
          if (result.results[i].name == name) {
            var item = result.results[i];
            item.start_time = item.start_time || result.start_time;
            return item;
          }
        }
      }
    }, result || cached_result);
    return item;
  }

  function setResults(table, result) {
    table.prepend('<tr>' +
        '<th class="col-md-3">Name</th>' +
        '<th class="col-md-3">Type</th>' +
        '<th class="col-md-6">Value</th></tr>');
    $.each(result, function (i, item) {
      if (!item || typeof item !== 'object') return;
      var type = item.type.toLowerCase();
      var val = (type == 'string' ? '"' + (item.string || '') + '"' : item.string) || "";
      var name = escapeHtml(item.name);

      var prop = '<a href class="interactive">' + name + '</a>';
      if (type.toLowerCase() === 'function') {
        prop += ' <a href class="interactive"><span class="hidden">' +
            name + '</span>()</a>';
      }

      if (val.length && (val.length >= 100 || type.toLowerCase() == 'function' || val.substr(0,8) == 'function')) {
        table.append('<tr class="data-row">' +
          '<td class="col-md-3 prop">' + prop + '</td>' +
          '<td class="col-md-3 type">' + item.type + '</td>' +
          '<td class="col-md-6">' +
            '<a href class="show-more" data-show-more="false">' +
              '<span class="glyphicon glyphicon-expand"></span> Show' +
            '</a>' +
          '</td>' +
        '</tr>');
        table.append('<tr class="data-more hidden">' +
          '<td colspan="3" class="val"><pre class="prettyprint linenums"><code>' +
          escapeHtml(formatForPre(val)) + '</code></pre></td>' +
        '</tr>');
      } else {
        table.append('<tr class="data-row">' +
          '<td class="col-md-3 prop">' + prop + '</td>' +
          '<td class="col-md-3 type">' + item.type + '</td>' +
          '<td class="col-md-6 val">' + prettyPrint(insertLinks(escapeHtml(val))) + '</td>' +
        '</tr>');
      }
    });
  }

  function displayOutputMessages(messages, asHtml) {
    var target = $('#message_table'),
        classMap = {
          'info': 'info',
          'error': 'danger',
          'access': 'warning',
          'log': 'log',
          '-1': 'log',
          '0': 'info',
          '1': 'warning',
          '2': 'danger'
        },
        script_update = false,
        temp;

    target.empty();
    if (!messages || !messages.length) {
      $('#message_container');
      return;
    }
    for (var i = 0, m; i < messages.length; i++) {
      m = messages[i];
      temp = m.message;

      if (m.is_json) {
        target.append('<tr><td class="' + classMap[m.type] + '" style="white-space: pre">' +
            escapeHtml(temp) + '</td></tr>');
      } else {
        if (!asHtml) {
          temp = escapeHtml(temp);
        }
        target.append('<tr><td class="' + classMap[m.type] + '">' +
            temp.replace(/\n/g, '<br>') + '</td></tr>');
      }
    }

    if (script_update) {
      target.append('<tr><td class="info">Illegal property has been ignore-listed. ' +
                    'Please try again.</td></tr>');
    }

    $('#message_container').toggleClass('hidden', !i);
  }

  function htmlPre(text) {
    return text.replace(/\n(\s*)/g, function (a, b) {
      return '<br />' + new Array(b.length + 1).join('&nbsp;');
    });
  }

  function formatForPre(text) {
    var has_new_line = text.match(/\n"$/);
    // manage XML/HTML output slightly differently
    if (text.match(/^"</) && text.match(/>\n?"$/)) {
      text = text.replace(/^"/, '').replace(/"$/, '');
      if (has_new_line) text += '\n';
    }
    return text;
  }

  function displayLogs(logs) {
    var table = $('#log_table');
    var classMap = {
      'Warning': 'warning',
      'Error': 'danger'
    };
    table.empty();
    if (!logs) {
      return;
    }

    table.prepend('<tr>' +
      '<th class="col-md-2">Level</th>' +
      '<th class="col-md-2">Date</th>' +
      '<th class="col-md-6">Value</th>' +
      '<th class="col-md-2">User</th></tr>');

    $.each(logs, function (i, log) {
      var className = classMap[log.level];
      table.append('<tr class="data-row text' + className + '">' +
          '<td class="col-md-2 ' + className + '">' + log.level + '</td>' +
          '<td class="col-md-2 ' + className + '">' + log.created + '</td>' +
          '<td class="col-md-6 ' + className + '">' + htmlPre(escapeHtml(log.message)) + '</td>' +
          '<td class="col-md-2 ' + className + '">' + log.source + '</td>' +
        '</tr>');
    });
    $('#log_container').toggleClass('hidden', !logs.length);
  }

  function showTypes() {
    var target = $('#type_control');
    var show_types = {};
    var show_all = false;

    target.empty();

    // find which checkboxes to display
    $('#results_table tr')
        .find('td.type')
        .each(function () {
          var type = $(this).text();
          if (typeof display_types[type] === 'undefined') {
            display_types[type] = true; // default to being checked
          }
          show_types[type] = display_types[type];
          show_all = true;
        });

    if (show_all) {
      target.append('<label class="checkbox-inline no_indent">' +
        '<input type="checkbox" id="show_all" value="all" checked="checked" />' +
        'All</label>');
    }

    var keys = Object.keys(show_types);
    keys.sort();
    $.each(keys, function (i, type) {
      id = ('' + type).replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      target.append('<label class="checkbox-inline no_indent">' +
        '<input type="checkbox" id="show_' + id + '" value="' + type + '" />' +
        type + '</label>');
      $('#show_' + id).prop('checked', display_types[type]);
    });

    updateResultTypes();
    updateResults();
  }

  function updateResultTypes(setAll) {
    var isShowAllChecked = true;
    var checkboxes = $('#type_control input[type=checkbox]');

    if (typeof setAll === 'undefined') {
      checkboxes.each(function (i) {
        if (!i) return; // ignore show_all at 0
        display_types[this.value] = this.checked;
        isShowAllChecked = isShowAllChecked && this.checked;
      });
      $('#show_all').prop('checked', isShowAllChecked);
    } else {
      checkboxes.each(function () {
        $(this).prop('checked', setAll);
        display_types[this.value] = setAll;
      });
    }

    checkboxes.each(function (i) {
      if (!i) return;
      $(this).parent().
        toggleClass('bg-success text-success', display_types[this.value]).
        toggleClass('bg-danger text-danger', !display_types[this.value]);
    });

  }

  function updateResults() {
    var isShowingProps = false;
    $('#results_table tr.data-row').each(function () {

      $this = $(this);
      var value = $this.find('td.type').text();
      $this.toggleClass('hidden', !display_types[value]);

      // show/hide the more info row
      var next = $this.next();
      if (next.hasClass('data-more')) {
        var state = $this.find('a.show-more').attr('data-show-more');
        next.toggleClass('hidden', !(display_types[value] && state != 'false'));
      }

      isShowingProps = isShowingProps || display_types[value];
    });
    $('#no_props').toggleClass('hidden', isShowingProps);
  }

  // use the same class names as Google Code-Prettify
  var pretty_str_match = /^&#39;.+&#39;$|^&quot;.+&quot;$/g;
  var pretty_str_match2 = /&#39;.+?&#39;|&quot;.+?&quot;/g;
  function prettyPrint(str) {
    // handle strings and string with additional info
    if (str.match(pretty_str_match)) {
      return str.replace(pretty_str_match, function (m) {
        return '<span class="str">' + m + '</span>';
      });
    }
    if (str.match(pretty_str_match2)) {
      return str.replace(pretty_str_match2, function (m) {
        return '<span class="str">' + m + '</span>';
      });
    }
    if (str.match(/^[0-9.]+$/)) {
      return '<span class="lit">' + str + '</span>';
    }
    if ('null,undefined,true,false'.indexOf(str) > -1) {
      return '<span class="kwd">' + str + '</span>';
    }
    return str;
  }

  var escapeHtml = (function () {
    var entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': '&quot;',
      "'": '&#39;',
      "/": '&#x2F;'
    };
    return function (string) {
      return String(string).replace(/[&<>"'/]/g, function (s) {
        return entityMap[s];
      });
    };
  })();

  function lineBreaks(text) {
    return text.toString().trim().replace(/\n/g, '<br />');
  }

  function link(href, title) {
    return '<a href="' + href + '" target="_blank">' + (title || 'Open') + '</a>';
  }

  function insertLinks(text) {
    text = text.replace(/^((?:"|&quot;)([a-f0-9]{32})(?:"|&quot;) )(\[(\w+) .*\])$/, function (m, start, sys_id, label, table) { // GlideElementReference
      return start + link(table + '.do?sys_id=' + sys_id, label);
    });
    text = text.replace(/link: (.+)/, function (m, href) { // GlideRecord
      return 'link: ' + link(href, href);
    });
    text = text.replace(/([a-z_]+)[.:]([0-9a-f]{32})(?:[:.](\w*))?/g, function (m, table, sys_id, display) { // table.sys_id links
      return '<a href="/' + table + '.do?sys_id=' + sys_id + '" target="_blank">' + m + '</a>';
    });
    return text;
  }

  function addBreadcrumb(text) {
    var $breadcrumb = $('ul#breadcrumb');
    var pos = breadcrumbs.length - 1;

    // make the last breadcrumb active
    if (breadcrumbs.length) {
      $breadcrumb.children().remove(':last');
      $breadcrumb.append('<li><a href id="breadcrumb_' +
          pos + '">' + escapeHtml(breadcrumbs[pos]) + '</a></li>');
    }

    // add the new last breadcrumb
    $breadcrumb
        .append('<li>' + escapeHtml(text) + '</li>')
        .removeClass('hidden');

    breadcrumbs.push(text);
  }

  var breadcrumbs = [];
  var display_types = {};
  var events = {};

  function SndXploreReporter() {

    this.addEvent = function (name, fn) {
      if (typeof events[name] !== 'object') {
        events[name] = [];
      }
      events[name].push(fn);
    };

    this.fireEvent = function (name, scope, args) {
      var eventArr = typeof events[name] === 'object' ? events[name] : null;
      if (!eventArr) return;
      for (var i = 0; i < eventArr.length; i++) {
        if (typeof eventArr[i] === 'function') {
          eventArr[i].apply(scope || this, args);
        }
      }
    };

    this.initialize = function () {

      var sxr = this;

      $('#results_table,#description_table').on('click', '.show-more', function (event) {
        // summary:
        //   Handle the 'Show...' button click for a result

        event.preventDefault();

        var $this = $(this);
        var target = $this.parents('tr').next();
        var doHide = $this.attr('data-show-more') != 'false';

        var show = '<span class="glyphicon glyphicon-expand"></span> Show';
        var hide = '<span class="glyphicon glyphicon-collapse-up"></span> Hide';

        target.toggleClass('hidden', doHide);
        $this.html(doHide ? show : hide);
        $this.toggleClass('active', !doHide);
        $this.attr('data-show-more', doHide ? 'false' : 'true');

      });

      $('#result_container').on('click', '.interactive', function (event) {
        // summary:
        //   Make property names interactive so we can dive into an object

        event.preventDefault();

        var $this = $(this);
        var text = $this.text();

        if ($this.hasClass('explore-child')) {
          sxr.fireEvent('click.interactive-result', this, [{dotwalk_first: true}]);
          return;
        }

        if ($this.hasClass('copy-value')) {
          sxr.copyValue();
          return;
        }

        if (text.length > 2 && text.substring(text.length - 2) == '()') {
          text = text.substring(0, text.length - 2);
          addBreadcrumb(text);
          addBreadcrumb('()');
        } else {
          addBreadcrumb(text);
        }

        var item = findResult(breadcrumbs);
        if (item) {
          sxr.displayResults(item, sxr.options);
        } else {
          sxr.fireEvent('click.interactive-result', this, [{dotwalk_first: true}]);
        }
      });

      $('ul#breadcrumb').on('click', 'a', function (event) {
        // summary:
        //   add the event handler for clicking on a breadcrumb to remove it
        
        event.preventDefault();

        var $breadcrumb = $('ul#breadcrumb');

        // remove unnecessary breadcrumb elements
        var pos = parseInt(this.id.split('_')[1], 10);
        var removeCount = breadcrumbs.length - 1 - pos;
        if (removeCount) {

          // remove all the nodes, including this one
          $breadcrumb
            .find('li:nth-last-child(-n+' + (removeCount + 1) + '):not(.permanent)')
            .remove();

          // update the breadcrumb array
          breadcrumbs = breadcrumbs.
              slice(0, $breadcrumb.children(':not(.permanent)').size() + 1);

          // re-add this node as a non-anchored breadcrumb
          if (breadcrumbs.length) {
            $breadcrumb.append('<li>' + breadcrumbs[breadcrumbs.length - 1] + '</li>');
          }

          var item = findResult(breadcrumbs);
          if (item) {
            sxr.displayResults(item, sxr.options);
          } else {
            sxr.fireEvent('click.breadcrumb', this, {dotwalk_first: true});
          }
        }
      });

      $('#regenerate').click(function () {
        sxr.fireEvent('click.interactive-result', this, [{dotwalk_first: true}]);
      });

      $('#type_control').on('change', 'input[type=checkbox]', function () {
        // summary:
        //   restrict the results based on the type checkboxes that are checked

        if (this.id == 'show_all') {
          updateResultTypes(this.checked);
        } else {
          updateResultTypes();
        }

        updateResults();
      });
    };

    this.copyValue = function copyValue() {
      var item = this.current_result;
      if (!item) return;
      var value = this.parseValueFromResult(item);
      if (item.type != 'Function') value = JSON.stringify(value, null, 2);
      snd_xplore_util.copyTextToClipboard(value);
    };

    this.parseValueFromResult = function parseValueFromResult(item) {
      var result;
      switch (item.type) {
        case 'null': return null;
        case 'undefined': return undefined;
        case 'Boolean': return item.string == 'true' ? true : false;
        case 'Number': return +item.string;
        case 'String': return item.string;
        case 'Function': return item.string;
        case 'Array': 
          result = [];
          break;
        default:
          if (!item.results) return item.string;
          result = {};
      }
      for (var i = 0, tmp; i < item.results.length; i++) {
        tmp = item.results[i];
        if (tmp.type === 'Function') continue;
        result[tmp.name] = this.parseValueFromResult(tmp);
      }
      return result;
    };

    this.debugLog = function debugLog() {
      if (this.options && this.options.debug_mode && typeof console === 'object') {
        console.log.apply(console, arguments);
      }
    };

    this.start = function (params) {
      if (this.options && (this.options.scope != params.scope || this.options.target != params.target)) {
        params.regenerate = true;
        params.dotwalk_first = false;
      }

      this.options = params;
      this.start_time = new Date().getTime();

      this.debugLog('Params: ', params);

      this.fireEvent('start', null, [params]);
    };

    this.done = function (result) {
      var updating_child = this.options.dotwalk_first;
      var error;
      var item;

      if (!result) {
        this.debugLog('No result!');
        this.reset();
        return;
      }

      if (result.type == 'Error') {
        // Convert error result into error message
        error = findResult(['rhinoException'], result);
        error = (error && error.string ? error.string : result.string).replace(/(^"|"$)/g, '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        error = error || 'Something went wrong with the request.';
        result.messages.push({
          date: result.end_time,
          message: error,
          source: null,
          type: 2
        });
      } else if (this.options.regenerate || !updating_child) {
        // resetting the entire result stack or not updating a child
        cached_result = result;
      }

      // find and update an item using the xplore result
      item = findResult(breadcrumbs);
      if (updating_child) {
        if (item) {
          // updating existing item
          item.regenerated = Array.isArray(item.results);
          if (result.type == 'Error') {
            if (item.$has_error) item.messages.splice(item.messages.length - 1);
            item.results = [];
            item.messages = (item.messages || []).concat(result.messages);
            item.warning = result.warning;
            item.$has_error = true;
          } else {
            for (var p in result) {
              if (p == 'name') continue;
              item[p] = result[p];
            }
          }
        } else if (breadcrumbs[breadcrumbs.length - 1] == '()') {
          // adding newly explored function result to parent
          item = findResult(breadcrumbs.slice(0, breadcrumbs.length - 1));
          if (item) {
            result.name = '()';
            item.results = item.results || [];
            item.results.push(result);
            item = result;
          }
        }
      }
      
      if (!item) {
        // if we haven't found an item then something must have changed
        error = 'Evaluated object has changed. Path to property ' + breadcrumbs.join('.') + ' is no longer valid.';
        if (result.type == 'Error') {
          item = $.extend({}, result);
          if (!cached_result) cached_result = item;
        } else {
          item = {
            type: 'Error',
            string: error,
            results: []
          };
        }
        if (breadcrumbs.length) {
          item.messages = item.messages ? item.messages.slice(0) : [];
          item.messages.push({
            date: new Date().getTime(),
            message: error,
            source: null,
            type: 2
          });
        }
      }

      this.displayResults(item, this.options);
    };

    this.getBreadcrumb = function () {
      return breadcrumbs.reduce(function (r, c) {
        if (r.length > 0) {
          r += ".";
        }
        r += c.replace(/\./g,'&#46;');
        return r;
      }, "");
    };

    this.reset = function () {
      cached_result = null;
      this.clearBreadcrumb();
    };

    this.clearBreadcrumb = function () {
      breadcrumbs.length = 0;
      $('ul#breadcrumb').find('li:not(.permanent)').remove();
      if (cached_result && this.options) {
        this.displayResults(cached_result, this.options);
      }
    };

    this.displayResults = function displayResults(result, options) {

      this.current_result = result;

      displayOutputMessages(result.messages, options.html_messages);
      displayLogs(result.logs);
      setDescription($('#description_table'), result);

      var no_props = 'No properties to display.';
      $('#copy_results').toggleClass('hidden', !result.results);
      if (!result.hasOwnProperty('results')) {
        no_props = '<button class="btn btn-xs btn-primary interactive explore-child">Explore!</button>';
      }

      var resultTable = $('#results_table');
      resultTable.empty().append('<tr id="no_props" class="hidden"><td colspan="3">' + no_props + '</td></tr>');

      $('#clearBreadcrumb').text((cached_result && cached_result.name) || 'Result');
      $('ul#breadcrumb').removeClass('hidden');
      $('#results').empty();
      $('#node_log_url').val(result.node_log_url);

      var results;
      if (result.results && result.results.length) {
        results = result.results.filter(function (item) {
          return item.name.slice(-2) != '()'; // don't show cached function results
        });
        results.sort(function (a, b) {
          var ai = parseInt(a.name, 10);
          var bi = parseInt(b.name, 10);
          if (ai > bi) return 1;
          if (bi > ai) return -1;
          if (a.name > b.name) return 1;
          if (b.name > a.name) return -1;
          return 0;
        });
        
        setResults(resultTable, results);
      } else {
        $('#no_props').removeClass('hidden');
      }
  
      showTypes();
  
      $('#result_container').toggleClass('hidden', !result.type && result.type != 'Error' && !results);
      $('#breadcrumb').toggleClass('hidden', !cached_result || (!results && !breadcrumbs.length));
  
      this.fireEvent('done', null, [result]);
    };

  }

  return new SndXploreReporter();
}());
