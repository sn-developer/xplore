/*
  Controls the SND Xplore UI
*/

$.ajaxSetup({
  dataType: 'json',
  headers: {
    'X-Usertoken': window.NOW_SESSION_TOKEN
  }
});

// Delay a function, overriding any previous calls for the same id
var delay = (function () {
  var timers = {};
  return function (id, callback, ms) {
    clearTimeout(timers[id]);
    timers[id] = setTimeout(callback, ms);
  };
})();

// get the minutes, seconds and decisecond since a given time, e.g. 01:32.1
function getMinutesSince(startTime) {
  var t = new Date().getTime() - startTime;
  var ds = Math.floor((t/100) % 10);
  var seconds = Math.floor((t/1000) % 60);
  var minutes = Math.floor((t/1000/60) % 60);
  var hours   = Math.floor(t/1000/60/60);
  if (minutes < 10) minutes = '0' + minutes;
  if (seconds < 10) seconds = '0' + seconds;
  if (hours   < 10) hours   = '0' + hours;
  return hours + ':' + minutes + ':' + seconds + '.' + ds;
}

// main UI object
var snd_xplore_ui = {};
snd_xplore_ui.isDirty = function isDirty() {
  // check is editor has been executed/saved
  return snd_xplore_util.isDirty() || snd_xplore_regex_util.isDirty();
};

/*************************************
            XPLORE
**************************************/

var snd_xplore_util = {
  start_time: null,
  end_time: null,
  countup_interval: null,
  node_log_url: '',
  is_dirty: false,
  session_id: null, // for loaded scripts
  isDirty: function () {
    return snd_xplore_util.is_dirty;
  },
  loading: function () {
    $timer = $('#timer');
    $('#xplore_btn')
        .prop('disabled', true)
        .html('Loading... <i class="glyphicon glyphicon-refresh spin"></i>');

    $('#format_btn').hide();
    $('#cancel_btn').prop('disabled', false).text('Cancel').show();
    $('#output_loader').addClass('active');

    snd_xplore_util.start_time = null;
    snd_xplore_util.end_time = null;

    $timer.text('');
    var start = new Date().getTime();
    snd_xplore_util.countup_interval = setInterval(function () {
      $timer.text(getMinutesSince(start));
    }, 100);
  },
  loadingComplete: function (result) {
    if (result) {
      snd_xplore_util.start_time = result.start_time;
      snd_xplore_util.end_time = result.end_time;
      snd_xplore_util.is_dirty = false;
    }
    $('#xplore_btn')
        .html('Run')
        .prop('disabled', false);

    $('#format_btn').show();
    $('#cancel_btn').hide();
    $('#output_loader').removeClass('active');
    // make sure we are on the output tab
    $('#script_output_tab').tab('show');
    // scroll to the top of the output div
    $('#output_tabs_pane').animate({ scrollTop: 0 }, "fast");

    clearInterval(snd_xplore_util.countup_interval);
    snd_xplore_util.countup_interval = null;

    // Google Code-Prettify
    window.PR.prettyPrint();
  },
  getCode: function () {
    var code = '';
    if (typeof snd_xplore_editor === 'object') {
      code = snd_xplore_editor.getValue();
    } else {
      code = document.getElementById('snd_xplore').value;
    }
    return code;
  },
  setPreference: function setPreference(name, value) {
    $.ajax({
      type: 'POST',
      url: '/snd_xplore.do?action=setPreference&name=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(value),
      dataType: 'json'
    }).
    done(function (data) {
        snd_log('Saved preference.');
    }).
    fail(function () {
      snd_log('Error: setPreference failed.');
    });
  },
  execute: function (options) {
    snd_xplore_util.cancelFullScreen();
    if (snd_xplore_util.countup_interval) return;

    // summary:
    //   Gather the data from the client and run Xplore
    var params = {
      debug_mode: $('#debug_mode').is(':checked'),
      target: $('#target').val(),
      scope: $('#scope').val(),
      code: snd_xplore_util.getCode(),
      user_data: $('#user_data_input').val(),
      user_data_type: $('#user_data_type_select').val(),
      breadcrumb: snd_xplore_reporter.getBreadcrumb(),
      reporter: snd_xplore_reporter,
      no_quotes: true, //!$('#setting_quotes').is(':checked'), // disabled to support copy to object
      show_props: $('#show_props').is(':checked'),
      max_depth: parseInt($('#max_depth').val(), 10),
      show_strings: $('#show_strings').is(':checked'),
      html_messages: $('#show_html_messages').is(':checked'),
      fix_gslog: $('#fix_gslog').is(':checked'),
      support_hoisting: $('#support_hoisting').is(':checked'),
      use_es_latest: $('#use_es_latest').is(':checked'),
      id: window.snd_xplore_session_id, // supplied in snd_xplore_main UI Macro
      loaded_id: snd_xplore_util.session_id // the loaded script
    };

    if (options) $.extend(params, options);

    // allow the user to paste in a URL encoded history block
    if (params.code.indexOf('/snd_xplore.do?item=') === 0) {
      if (snd_script_history_util.parseUrlSearch(params.code)) return;
    }

    snd_xplore(params);
  },
  executeNew: function () {
    snd_xplore_reporter.reset();
    this.execute();
  },
  demo: function (code, user_data) {
    var $user_data_input;

    snd_xplore_util.toggleEditor(true, function () {

      var confirmed = false;

      if (snd_xplore_editor.getValue()) {
        confirmed = confirm('Do you want to replace the current script?');
        if (!confirmed) return;
      }

      $user_data_input = $('#user_data_input');
      if ($user_data_input.val()) {
        confirmed = confirmed || confirm('Do you want to replace the current user data?');
        if (!confirmed) return;
      }

      $user_data_input.val(user_data);
      if (user_data) {
        $('#user_data_tab').tab('show');
      }

      $('#target').val('server');
      $('#scope').val('global');
      snd_xplore_editor.setValue(code);
      snd_xplore_editor.focus();
    });
  },
  formatString: function () {
    var $user_data_input = $('#user_data_input'),
        $user_data_type = $('#user_data_type_select');
    $.ajax({
      type: "POST",
      url: "/snd_xplore.do?action=formatString&type=" + $user_data_type.val(),
      data: {
        string: $user_data_input.val()
      }
    }).
    done(function (data) {
      $user_data_input.val(data.result);
    }).
    fail(function () {
      snd_log('Error: could not format string.');
    });
  },
  beautify: function () {
    var code = snd_xplore_editor.somethingSelected() ? snd_xplore_editor.getSelection()
                                                    : snd_xplore_editor.getValue().replace(/^\s+/, '');
    var options = {
      indent_size: snd_xplore_editor.getOption('indentUnit')
    };
    if (code) {
      snd_xplore_editor.setValue(js_beautify(code, options));
    }
  },
  toggleEditor: (function () {
    var output_left = 300;
    var state = 1;
    return function (force, callback) {
      var $this = $('#editor_toggle');
      var $editor = $('#editor');
      var $output = $('#output');
      if ((force === true && state === 1) || (force === false && state === 0)) {
        if (typeof callback === 'function') callback();
        return;
      }
      if ($editor.is(":hidden") || force === true) {
        $output.animate({left: $editor.outerWidth()}, 400, function () {
          $editor.fadeIn(400);
          $this.addClass('active');
          state = 1;
          if (typeof callback === 'function') callback();
        });
      } else {
        $editor.fadeOut(400, function () {
          $output.animate({left: 0}, 400, function () {
            output_left = $output.css('left');
            $this.removeClass('active');
            state = 0;
            if (typeof callback === 'function') callback();
          });
        });
      }
    };
  })(),
  toggleFullScreen: function () {
	$('#editor').toggleClass('fullScreen');
  },
  cancelFullScreen: function () {
	$('#editor').removeClass('fullScreen');
  },
  cancel: function () {
    // add status=true to get the current status
    $.ajax('/cancel_my_transaction.do?sysparm_output=xml', {
      dataType: 'xml'
    });
    $('#cancel_btn').prop('disabled', true).text('Cancelling...');
  },
  // courtesy of https://stackoverflow.com/questions/2044616/select-a-complete-table-with-javascript-to-be-copied-to-clipboard
  copyElementToClipboard: function copyElementToClipboard(el) {
    var body = document.body, range, sel;
    if (document.createRange && window.getSelection) {
      range = document.createRange();
      sel = window.getSelection();
      sel.removeAllRanges();
      try {
        range.selectNodeContents(el);
        sel.addRange(range);
      } catch (e) {
        range.selectNode(el);
        sel.addRange(range);
      }
      document.execCommand("copy");
      sel.removeAllRanges();
    } else if (body.createTextRange) {
      range = body.createTextRange();
      range.moveToElementText(el);
      range.select();
      range.execCommand("Copy");
    }
  },
  copyTextToClipboard: function copyTextToClipboard(text) {
    function fallbackCopyTextToClipboard(text) {
      var textArea = document.createElement("textarea");
      textArea.value = text;

      // Avoid scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        var successful = document.execCommand('copy');
        var msg = successful ? '' : ' failed';
        snd_xplore_util.simpleNotification('Copied to clipboard' + msg);
      } catch (err) {
        snd_xplore_util.simpleNotification('Copy to clipboard failed');
      }

      document.body.removeChild(textArea);
    }

    if (!navigator.clipboard) {
      fallbackCopyTextToClipboard(text);
      return;
    }
    navigator.clipboard.writeText(text).then(function() {
      snd_xplore_util.simpleNotification('Copied to clipboard');
    }, function(err) {
      snd_xplore_util.simpleNotification('Copy to clipboard failed');
    });
  },
  simpleNotification: (function () {
    var simpleNotificationTimeout;
    return function simpleNotification(message) {
      var el = $('#notification');
      $('#notification').text(message);
      el.addClass('in'); // element has 'fade' class
      clearTimeout(simpleNotificationTimeout);
      simpleNotificationTimeout = setTimeout(function () {
        el.removeClass('in');
      }, 3000);
    };
  })()
};

$('.xplore_demo').on('click', 'a', function (e) {
  e.preventDefault();
  $this = $(this);
  var code = [],
      user_data;
  switch ($this.attr('data-demo')) {
    case 'GlideRecord':
      code.push('var gr = new GlideRecord("incident");');
      code.push('//gr.addQuery("");');
      code.push('gr.setLimit(1);');
      code.push('gr.query();');
      code.push('gr.next();');
      code.push('gr');
      break;
    case 'GlideRecord.get':
      code.push('var gr = new GlideRecord("incident");');
      code.push('gr.get("sys_id", "foo");');
      code.push('gr');
      break;
    case 'Array':
      code.push("var a = [];");
      code.push("a.push(['a', 'b', 'c']);");
      code.push("a.push(['x', 'y', 'z']);");
      code.push("a");
      break;
    case 'GlideUser':
      code.push("gs.getUser();");
      break;
    case 'Logging':
      code.push('gs.log("Hello world from gs.log")');
      code.push('gs.print("Hello world from gs.print (not compatible with scopes)")');
      code.push('gs.info("Hello world from gs.info")');
      code.push('gs.warn("Hello world from gs.warn")');
      code.push('gs.error("Hello world from gs.error")');
      code.push('gs.addInfoMessage("Hello world from.gs.addInfoMessage")');
      code.push('gs.addErrorMessage("Hello world from gs.addErrorMessage")');
      break;
    case 'scope':
      code.push("this");
      break;
    case 'user_data':
      code.push('var doc = new XMLDocument(user_data);');
      code.push('doc.toIndentedString();');
      user_data = '<?xml version="1.0" encoding="UTF-8" ?><xml><incident><active>true</active></incident></xml>';
      break;
  }
  if (code) {
    snd_xplore_util.demo(code.join('\n'), user_data);
  }
});


/*************************************
            REGEX
**************************************/

var snd_xplore_regex_util = (function () {

  $intro_panel   = $('#regex_intro_panel');
  $match_panel   = $('#regex_match_panel');
  $group_panel   = $('#regex_group_panel');
  $error_panel   = $('#regex_error_panel');
  $result        = $('#regex_match');
  $result_groups = $('#regex_group');

  function showIntro() {
    $match_panel.hide();
    $group_panel.hide();
    $error_panel.hide();
    $intro_panel.fadeIn();
  }
  function showError(text) {
    $('#regex_error').empty().append(text);
    $intro_panel.hide();
    $match_panel.hide();
    $group_panel.hide();
    $error_panel.fadeIn();
  }
  function showResult(matches, groups) {
    $intro_panel.hide();
    $error_panel.hide();
    $result.empty().append(matches);
    $match_panel.fadeIn();
    if (groups) {
      $result_groups.empty().append(groups);
      $group_panel.fadeIn();
    } else {
      $group_panel.hide();
    }
  }

  function isDirty() {
    return $('#regex').val() || $('#regex_input').val();
  }

  snd_xplore.regex.addEvent('start', function () {
    $('#regex_loading').fadeIn();
  });

  var escapeHtml = (function () {
    var map = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;'
    };
    var replace = function (c) {
      return map[c];
    };
    return function (text) {
      return text.replace(/<|>|&/g, replace);
    };
  })();

  snd_xplore.regex.addEvent('done', function(result) {
    var matchHtml, groupHtml;
    if (result) {
      if (result.error) {
        showError(result.error);
      } else if (result.matches){
        matchHtml = '';
        $.each(result.matches, function (i, item) {
          item.text = escapeHtml(item.text);
          if (item.type == 'match') {
            matchHtml += '<span class="bg-success text-success">' + item.text + '</span>';
          } else {
            matchHtml += item.text;
          }
        });
        groupHtml = '';
        if (result.groups) {
          if (result.groups.join('').length) {
            $.each(result.groups, function (i, item) {
              groupHtml += '<h5 class="text-danger">Match ' + (i + 1) + '</h5>';
              groupHtml += '<ol>';
              $.each(item, function (i, group) {
                groupHtml += '<li>' + escapeHtml(group) + '</li>';
              });
              groupHtml += '</ol>';
            });
          }
        }
        showResult(matchHtml, groupHtml);
      } else {
        showError('No result was given.');
      }
    } else {
      showIntro();
    }
    $('#regex_loading').hide();
  });

  // setup the handler to run the regex when the user edits something
  var run = (function () {
    var cache = '';
    return function () {
      var expression = $('#regex').val();
      var input = $('#regex_input').val();
      var options = $('#regex_options').val();
      var $code = $('#regex_code');

      if (!expression || !input) {
        $code.hide();
        showIntro();
        return;
      }

      if (cache === input + expression + options) {
        return;
      }
      cache = input + expression + options;

      $code.text('/' + expression + '/' + options).show();

      snd_xplore.regex({
        expression: expression,
        input:      input,
        options:    options,
        target:     $('#target').val()
      });
    };
  })();

  return {
    run: run,
    isDirty: isDirty
  };
})();


/*************************************
            TABLES
**************************************/

var snd_xplore_table_util = (function () {

  var api = {
    tables: {},
    current: ''
  };

  function loadTables() {
    $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getTables',
      dataType: 'json'
    }).
    done(function (data) {
      api.tables = data.result;
    }).
    fail(function () {
      snd_log('Error: loadTables failed.');
    });
  }
  api.loadTables = loadTables;

  function getTableHierarchy(table, search_labels) {
    loading(true);
    api.current = table;
    api.term = ((table.indexOf('>') === 0 || table.indexOf('=') === 0) ? table.substr(1) : table).toLowerCase();

    $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getTableHierarchy' +
            '&table=' + table +
            '&search_labels=' + (search_labels ? '1' : '0'),
      dataType: 'json'
    }).
    done(function (data) {
      var result = data.result;
      var $target = $('#table_hierarchy_result').empty();

      if (data.$success === false) {
        $target.append('<div class="alert alert-danger"><strong>' + data.$error + '</strong></div>');
        loading(false);
        return;
      }

      function isMatch(text) {
        return text ? text.toLowerCase().indexOf(api.term) > -1 : false;
      }

      function sortByLabel(dbo) {
        dbo.sort(function (a, b) {
          if (a.label > b.label) return 1;
          if (b.label > a.label) return -1;
          return 0;
        });
      }

      function generateHtml(dbo) {
        var match_label = isMatch(dbo.label),
            match_name  = isMatch(dbo.name),
            text_class = match_label || match_name ? 'primary' : 'muted',
            anchor,
            html;

        if (api.term != '*') {
          html = '<li class="text-' + text_class + '">';
          if (match_label) {
            html += dbo.label.replace(new RegExp('(' + api.term + ')', 'i'), '<span class="bg-success">$1</span>');
          } else {
            html += dbo.label;
          }
        } else {
          html = '<li>' + dbo.label;
        }

        if (match_name) {
          anchor = dbo.name.replace(api.term, '<span class="bg-success">' + api.term + '</span>');
        } else {
          anchor = dbo.name;
        }
        html += ' [<a href="#show" data-show="=' + dbo.name + '" class="text-' + text_class + '">' + anchor + '</a>]';

        html += ' <a href="' + dbo.name + '_list.do" target="_blank" title="Open list"><i class="glyphicon glyphicon-list-alt"></i></a>';
        html += ' <a href="' + dbo.name + '.do" target="_blank" title="Open form"><i class="glyphicon glyphicon-open-file"></i></a>';
        html += ' <a href="sys_db_object.do?sys_id=' + dbo.sys_id + '" target="_blank" title="Open table definition"><i class="glyphicon glyphicon-cog"></i></a>';
        if (dbo.children.length) {
          html += '<ul>';
          sortByLabel(dbo.children);
          $.each(dbo.children, function (i, childDbo) {
            html += generateHtml(childDbo);
          });
          html += '</ul>';
        }
        html += '</li>';
        return html;
      }

      if (result.length) {
        sortByLabel(result);
        $.each(result, function (i, dbo) {
          $target.append('<ul>' + generateHtml(dbo) + '</ul>');
        });
      } else {
        $target.append('<div class="alert alert-danger"><strong>No table information found.</strong></div>');
      }
      loading(false);
    }).
    fail(function () {
      loading(false);
      snd_log('Error: getTableHierarchy failed.');
    });
  }

  function loading(b) {
    if (b) {
      $('#table_hierarchy_loading').show();
      $('#table_hierarchy_result_container').fadeOut();
    } else {
      $('#table_hierarchy_result_container').fadeIn();
      $('#table_hierarchy_loading').hide();
    }
  }
  api.getTableHierarchy = getTableHierarchy;

  return api;

})();


/*************************************
         SCRIPT SEARCH
**************************************/

var snd_script_search_util = (function () {

  var api = {};
  var $list = $('#script_pane_list');
  var $script_pane_404 = $('#script_pane_404');

  function search(value) {
    var elements,
        match,
        nomatch;

    if(value) {

      value = value.toUpperCase();
      elements = $list.find('span.script-name');

      match = elements.filter(function (i, el) {
        return (el.textContent || el.innerText || "").toUpperCase().indexOf(value)>=0;
      });
      match.parent().show();

      nomatch = elements.filter(function (i, el) {
        return (el.textContent || el.innerText || "").toUpperCase().indexOf(value)==-1;
      });
      nomatch.parent().hide();

      if (!match.length) {
        $script_pane_404.show();
      }

    } else {
      $list.find("li").show();
    }
  }

  function loading(b) {
    $('#script_pane_loading').toggle(b);
  }

  api.search = (function () {
    var requested = false;
    var filter;
    return function (value) {
      filter = value;
      if (requested) return;
      loading(true);
      $script_pane_404.hide();
      if (!api.records) {
        requested = true;
        api.loadAll().done(function () {
          requested = false;
          search(filter);
          loading(false);
        });
      } else {
        search(filter);
        loading(false);
      }
    };
  })();

  api.addScript = function (sys_id, replace) {
    loading(true);
    $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getScript&sys_id=' + sys_id,
      dataType: 'json'
    }).
    done(function (data) {
      var result = data.result;
      var old = snd_xplore_editor.getValue();

      if (old) {
        if (replace != '1') {
          if (old.length > 0) old += '\n\n';
        } else if(!confirm('Warning! This will replace your code.')) {
          return;
        } else {
          old = '';
        }
      }

      snd_xplore_editor.setValue(
        old +
        '/*************************************' + '\n' +
        '  ' + result.api_name + '\n' +
        ' *************************************/' + '\n' +
        result.script);
      loading(false);

      // close the pane
      snd_xplore_ui.side_panes.closeAll();
    }).
    fail(function () {
      snd_log('Error: snd_script_search_util.addScript failed.');
      loading(false);
    });
  };

  api.loadAll = function () {
    loading(true);
    return $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getScripts',
      dataType: 'json'
    }).
    done(function (data) {
      api.records = data.result;
      $list.empty();
      $.each(api.records, function (i, item) {
        var scope = item.$sys_scope == 'Global' ? '' : ' (' + item.$sys_scope + ')';
        $list.append($('<li>' +
          '<span class="script-link script-name" data-sys-id="' + item.sys_id + '">' +
          item.name + scope + '</span> ' +
          '<span class="script-link script-replace pull-right" data-sys-id="' + item.sys_id + '" ' +
          'data-replace="1">' +
          'replace</span>' +
          '</li>'));
      });
      loading(false);
    }).
    fail(function () {
      snd_log('Error: snd_script_search_util.loadAll failed.');
      loading(false);
    });
  };

  // handle script search
  $('#script_pane_search')
  .change(function () {
    snd_script_search_util.search($(this).val());
    return false;
  })
  .keyup(function () {
    $(this).change();
  });

  $('#script_pane_list').on('click', 'span.script-link', function (e) {
    var $anchor = $(this);
    if (!$anchor.attr('data-sys-id')) {
      snd_log('Error: script link does not have sys_id attribute');
    } else {
      snd_script_search_util.addScript($anchor.attr('data-sys-id'), $anchor.attr('data-replace'));
    }
  });

  $('#side_controls a[data-pane="script_pane"]').one('click', function () {
    api.loadAll();
  });

  $('#scripts_refresh').click(function () {
    $list.empty();
    api.loadAll().done(function () {
      var search = $('#script_pane_search').val();
      if (search) {
        snd_script_search_util.search(search);
      }
    });
  });

  return api;
})();


/*************************************
         SCRIPT HISTORY
**************************************/

var snd_script_history_util = (function () {
  var api = {};
  var $list = $('#script_history');

  function loading(b) {
    $('#script_history_loading').toggle(b);
  }

  function maxLines(str, max_lines) {
    var result = '';
    var lines = str.split('\n');
    max_lines = max_lines < lines.length ? max_lines : lines.length;
    for (var i = 0; i < max_lines; i++) {
      if (i) result += '\n';
      if (lines[i].length > 80) {
        lines[i] = lines[i].substr(0, 80) + '...';
      }
      result += lines[i];
    }
    if (i < lines.length) result += '\n...';
    return result;
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

  api.loadScript = function loadScript(options) {
    snd_xplore_util.demo(options.code || '', options.user_data || '');
    if (options.hasOwnProperty('id')) snd_xplore_util.session_id = options.id;
    if (options.hasOwnProperty('user_data_type')) $('#user_data_type_select').val(options.user_data_type);
    if (options.hasOwnProperty('target')) $('#target').val(options.target).trigger('change');
    if (options.hasOwnProperty('scope')) $('#scope').val(options.scope).trigger('change');
    if (options.hasOwnProperty('no_quotes')) $('#setting_quotes').bootstrapToggle(options.no_quotes ? 'off' : 'on');
    if (options.hasOwnProperty('show_props')) $('#show_props').bootstrapToggle(options.show_props ? 'on' : 'off');
    if (options.hasOwnProperty('show_strings')) $('#show_strings').bootstrapToggle(options.show_strings ? 'on' : 'off');
    if (options.hasOwnProperty('show_html_messages')) $('#show_html_messages').bootstrapToggle(options.show_html_messages ? 'on' : 'off');
    if (options.hasOwnProperty('wrap_output_pre')) $('#wrap_output_pre').bootstrapToggle(options.wrap_output_pre ? 'on' : 'off');
    if (options.hasOwnProperty('fix_gslog')) $('#fix_gslog').bootstrapToggle(options.fix_gslog ? 'on' : 'off');
    if (options.hasOwnProperty('support_hoisting')) $('#support_hoisting').bootstrapToggle(options.support_hoisting ? 'on' : 'off');
    if (options.hasOwnProperty('debug_mode')) $('#debug_mode').bootstrapToggle(options.debug_mode ? 'on' : 'off');
    if (options.hasOwnProperty('use_es_latest')) $('#use_es_latest').bootstrapToggle(options.use_es_latest ? 'on' : 'off');
    if (options.hasOwnProperty('max_depth')) $('#max_depth').val(options.max_depth);
  };

  api.loadAll = function () {
    loading(true);
    return $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getScriptHistory',
      dataType: 'json'
    }).
    done(function (data) {
      api.history = data.result;
      api.history_map = {};
      $list.empty();
      $.each(api.history, function (i, item) {
        api.history_map[item.id] = item;
        $list.append(
          $('<div class="list-group-item interactive" data-id="' + item.id + '" data-replace="1">' +
              '<button type="button" class="close" aria-label="Close"><span aria-hidden="true">×</span></button>' +
              '<h5 class="list-group-item-heading">' + item.name + ' (' + item.scope + ')' + '\n' +
                '<a class="small" href="?historic=' + item.id + '" target="_blank">New Tab</a> | ' +
                '<a href="javascript:void(0)" class="small copy-history-link">Copy Link</a>' +
              '</h5> ' +
              '<p class="list-group-item-text"><pre class="prettyprint linenums">' + escapeHtml(maxLines(item.code, 3)) + '</pre>' +
            '</div>'));
      });

      // Google Code-Prettify
      window.PR.prettyPrint();

      loading(false);

    }).
    fail(function () {
      snd_log('Error: snd_script_history_util.loadAll failed.');
      loading(false);
    });
  };

  api.deleteScript = function deleteScript(id) {
    loading(true);
    return $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=deleteScriptHistoryItem&id=' + id,
      dataType: 'json'
    }).
    done(function (data) {
      api.loadAll();
    }).
    fail(function () {
      snd_log('Error: snd_script_history_util.deleteScript failed.');
      loading(false);
    });
  };

  api.fetchScript = function fetchScript(id) {
    loading(true);
    return $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=fetchScriptHistoryItem&id=' + id,
      dataType: 'json'
    }).
    done(function (data) {
      if (data.result) {
        api.loadScript(data.result);
      } else if (data.$error) {
        snd_log(data.$error);
      }
      loading(false);
    }).
    fail(function () {
      snd_log('Error: snd_script_history_util.fetchScript failed.');
      loading(false);
    });
  };

  api.parseUrlSearch = function parseUrlSearch(search) {
    var match, item;

    match = search.match(/historic=([^&]+)/);
    if (match) {
      api.fetchScript(match[1]);
      return true;
    }

    match = search.match(/item=([^&]+)/);
    if (match) {
      try {
        item = JSON.parse(decodeURIComponent(match[1]));
      } catch (e) {
        snd_log('Error: Unable to load script from URL - bad JSON');
      }
      if (item) {
        api.loadScript(item);
      } else {
        snd_xplore_util.simpleNotification('Error: Unable to load script from URL');
      }
      return true;
    }

    return false;
  };

  api.loadFromUrl = function loadFromUrl() {
    api.parseUrlSearch(window.location.search);
  };

  $list.on('click', 'div.list-group-item', function (e) {

    // prevent nested buttons from opening the script
    if ($(e.target).closest('button').length || $(e.target).closest('a').length) return;

    var $this = $(this);
    var item;
    if (!$this.attr('data-id')) {
      snd_log('Error: script link does not have an id attribute');
    } else {
      item = api.history_map[$this.attr('data-id')];
      if (item) {
        api.loadScript(item);
      } else {
        throw new Error('Unable to load empty history item.');
      }
    }
  });

  $list.on('click', 'button.close', function (e) {
    var $anchor = $(this).parent();
    var item;
    if (!confirm('Delete this script?')) return;

    if (!$anchor.attr('data-id')) {
      snd_log('Error: script link does not have an id attribute');
    } else {
      item = api.history_map[$anchor.attr('data-id')];
      if (item) {
        api.deleteScript(item.id);
      } else {
        throw new Error('Unable to delete history item.');
      }
    }
  });

  $list.on('click', 'a.copy-history-link', function (e) {
    var $anchor = $(this).parent().parent();
    var item, str;

    if (!$anchor.attr('data-id')) {
      snd_log('Error: script link does not have an id attribute');
    } else {
      item = api.history_map[$anchor.attr('data-id')];
      if (item) {
        str = JSON.stringify(item, 'target,scope,code,user_data,user_data_type,support_hoisting');
        snd_xplore_util.copyTextToClipboard('/snd_xplore.do?item=' + encodeURIComponent(str));
      } else {
        throw new Error('No item to copy.');
      }
    }
  });

  return api;
})();


/*************************************
          SIDE PANES
**************************************/

(function () {

  window.snd_xplore_ui.side_panes = {
    closeAll: function () {
      $('.side_pane').fadeOut(400);
      $('#side_controls li a[data-pane]').removeClass('active');
    }
  };

  // setup the side pane controls
  $('#side_controls li').on('click', 'a', function () {
    var $target = $(this);
    if (!$target.attr('data-pane')) return;

    $('#side_controls li a').each(function () {
      var $this = $(this);
      var pane = $this.attr('data-pane');
      if (!pane) return;
      var $pane = $('#' + pane);

      if (this === $target.get(0)) {
        var workbenchLeft = $('#side_controls').outerWidth();
        if (!$pane.is(':visible')) {
          //workbenchLeft += $pane.outerWidth();
          //$('#workbench').animate({left: workbenchLeft}, 400, function () {
            $pane.fadeIn(400);
            //resizeUtil.resizeOutputContent();
          //});
        } else {
          $pane.fadeOut(400);//, function () {
            //$('#workbench').animate({left: workbenchLeft}, 400, function () {
              //$('#workbench').css('left', '');
              //resizeUti.resizeOutputContent()
            //});
          //});
        }
        $this.toggleClass('active');
      } else {
        $this.removeClass('active');
        $pane.hide();
      }
    });
  });

  // auto close the data panes when clicked outside
  $(document).click(function(event) {
    if(!$(event.target).closest('.side_pane').length &&
        !$(event.target).closest('#side_controls').length &&
        !$(event.target).hasClass('.side_pane')) {
      snd_xplore_ui.side_panes.closeAll();
    }
  });

})();


snd_xplore_setting_util = (function () {
  var util = {};

  util.PREFERENCE = 'xplore.settings';

  util.getSettings = function getSettings() {
    var settings = {};
    $('.xplore-setting').each(function (i, setting) {
      setting = $(setting);
      settings[setting.attr('id')] = setting.is(':checkbox') ? $(setting).is(':checked') : setting.val();
    });
    return settings;
  };

  util.save = function () {
    var settings = util.getSettings();
    snd_xplore_util.setPreference(util.PREFERENCE, JSON.stringify(settings));
  };

  util.reset = function () {
    snd_xplore_util.setPreference(util.PREFERENCE, '{}');

    $('.xplore-setting').each(function (i, setting) {
      var default_value = snd_xplore_default_settings[setting.id];
      setting = $(setting);
      if (setting.is(':checkbox')) {
        //setting.attr('checked', default_value);
        setting.bootstrapToggle(default_value ? 'on' : 'off');
      } else {
        setting.val(default_value).change();
      }
    });
  };

  return util;
})();


/*************************************
            INIT
**************************************/

$(function () {

  // update the selector for the frames
  (function () {
    var frames,
        target,
        name,
        i;
    if (window.opener) {
      frames = window.opener.frames;
      target = $('#target');
      target.append('<option value="opener">Opener</option>');
      for (i = 0; frames.length > i; i++) {
        try {
          name = frames[i].name;
        } catch (e) {} // ignore cross-origin frame SecurityErrors
        if (!name) continue;
        target.append('<option value="frame_' + i + '">Opener: ' + name + '</option>');
      }
    }
  })();

  // Populate the scope selector
  $(function () {
    var $scope = $('#scope');
    $scope.empty();
    $scope.append($('<option class="text-italic text-muted">Loading</option>'));

    $.ajax({
      type: 'GET',
      url: '/snd_xplore.do?action=getScopes',
      dataType: 'json'
    }).
    done(function (data) {
        $scope.empty();
        $.each(data.result, function (i, item) {
          var selected = item.scope === window.snd_xplore_initial_scope ? ' selected' : '';
          $scope.append($('<option value="' + item.scope + '"' + selected + '>' + item.name + '</option>'));
        });
        $scope.trigger('change'); // tell Select2 to update
    }).
    fail(function () {
      snd_log('Error: populateScopes failed.');
    });
  });


  var is_mac = CodeMirror.keyMap.default == CodeMirror.keyMap.macDefault;
  var c_key = is_mac ? 'Cmd' : 'Ctrl';
  var def_shortcuts = {};
  var shortcuts = {};
  $.each(CodeMirror.keyMap.default, function (k, v) { def_shortcuts[v] = k; shortcuts[v] = k; });
  $.each(CodeMirror.keyMap.sublime, function (k, v) { shortcuts[v] = k; });

  function setupHelpModal() {
    function keyHelp(shortcut, description) {
      shortcut = shortcut.split(' or ').map(function (s) {
        s = s.trim().replace(/</g, '&lt;');
        return '<kbd>' + s + '</kbd>';
      }).join(' or ');
      help.append(
        $('<tr>').append([
          $('<td>').text(description),
          $('<td>').append($(shortcut))
        ])
      );
    }

    function describeMacro(keyword, comments) {
      macro.append(
        $('<tr>').append([
          $('<td>').append($('<code>').text(keyword)),
          $('<td>').text(comments)
        ])
      );
    }

    function getShortcut(name) {
      var a = def_shortcuts[name];
      var b = shortcuts[name];
      return a && b && a != b ? a + ' or ' + b : a || b;
    }

    var help = $('#modal_editor_help_table');
    keyHelp(c_key + '-M', 'Toggle full screen');
    keyHelp('Shift-Alt-F', 'Format code');
    keyHelp(getShortcut('toggleCommentIndented'), 'Toggle comment');
    keyHelp(getShortcut('find'), 'Find');
    keyHelp(getShortcut('findNext'), 'Find next');
    keyHelp(getShortcut('findPrev'), 'Find previous');
    keyHelp(getShortcut('replace'), 'Replace');
    keyHelp(getShortcut('replaceAll'), 'Replace all');
    keyHelp(getShortcut('selectNextOccurrence'), 'Select next occurrence');
    keyHelp(getShortcut('swapLineUp'), 'Swap line up');
    keyHelp(getShortcut('swapLineDown'), 'Swap line down');
    keyHelp(getShortcut('selectLine'), 'Select line');
    keyHelp(getShortcut('duplicateLine'), 'Duplicate line/selection');

    var macro = $('#modal_editor_macro_table');
    $('.syntax_macro').map(function (i, el) {
      el = $(el);
      describeMacro(el.prop('name'), el.attr('comments'));
    });
  }

  function setupScriptEditorShortcuts() {

    $('#editor_commentSelection').click(function () {
      window.snd_xplore_editor.toggleComment();
    }).prop('title', 'Toggle Comment (' + shortcuts.toggleCommentIndented + ')');
    $('#editor_formatCode').click(function () {
      snd_xplore_util.beautify();
    }).prop('title', 'Format Code (Shift-Alt-F)');
    $('#editor_replace').click(function () {
      CodeMirror.commands.replace(snd_xplore_editor);
    }).prop('title', 'Replace (' + shortcuts.replace + ')');
    $('#editor_replaceAll').click(function () {
      CodeMirror.commands.replaceAll(snd_xplore_editor);
    }).prop('title', 'Replace All (' + shortcuts.replaceAll + ')');
    $('#editor_find').click(function () {
      CodeMirror.commands.find(snd_xplore_editor);
    }).prop('title', 'Find (' + c_key + '-F)');
    $('#editor_findNext').click(function () {
      CodeMirror.commands.findNext(snd_xplore_editor);
    }).prop('title', 'Find Next (' + shortcuts.findNext + ')');
    $('#editor_findPrevious').click(function () {
      CodeMirror.commands.findPrev(snd_xplore_editor);
    }).prop('title', 'Find Previous (' + shortcuts.findPrev + ')');
    $('#editor_fullScreen').click(function () {
	  snd_xplore_util.toggleFullScreen();
    }).prop('title', 'Fullscreen (' + c_key + '-M)');
    $('#editor_scriptDebugger').click(function () {
      var sys_id = $(this).attr('data-script');
      if (sys_id) {
        // set the debug to line 1 for now
        $.post({
          contentType: 'application/json; charset=utf-8',
          url: '/api/now/js/debugger/breakpoint/sys_script_include/' + sys_id + '/script/1',
          data: JSON.stringify({evaluationString: ''})
        });
      }
      // this launches SN code from /scripts/scriptDebugger/launchScriptDebugger.js
      window.top.launchScriptDebugger();
    });
  }

  function getExtraKeys() {
    var extra_keys = {};
    extra_keys['Enter'] = function (cm) {
      // Enter will try to execute a macro but fallback to newline
      if (!replaceWordWithMacro(cm)) {
        CodeMirror.commands.newlineAndIndent(cm);
      }
    };
    extra_keys['Ctrl-Enter'] = function (cm) {
      snd_xplore_util.executeNew();
    };
    if (is_mac) extra_keys['Cmd-Enter'] = extra_keys['Ctrl-Enter']; // support ctrl and cmd
    extra_keys[c_key + '-S'] = function (cm) {
      if ($('#setting_save_shortcut').is(':checked')) {
        snd_xplore_util.executeNew();
      }
    };
    extra_keys['Shift-Alt-F'] = function (cm) {
      snd_xplore_util.beautify();
    },
    extra_keys[c_key + '-M'] = function (cm) {
	  snd_xplore_util.toggleFullScreen();
    };
    extra_keys["Esc"] = function(cm) {
      CodeMirror.commands.singleSelection(snd_xplore_editor);
      CodeMirror.commands.clearSearch(snd_xplore_editor);
	  snd_xplore_util.cancelFullScreen();
    };
    return extra_keys;
  }

  function setupScriptEditor() {
    var cm;

    setupScriptEditorShortcuts();

    cm = CodeMirror.fromTextArea(document.getElementById("snd_xplore"), {
      mode: 'javascript',
      lineNumbers: true,
      lineWrapping: true,
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-lint-markers", "CodeMirror-foldgutter"],
      lint: {
        asi: true,
        smarttabs: true,
        options: {},
        getAnnotations: function (text, errors, cm) {
          var line_count = text.trim().split('\n').length;
          var errors = CodeMirror.lint.javascript(text);
          return errors.filter(function (e) {
            if (e.from.line + 1 < line_count) return true;
            if (e.message.match(/Expected an assignment/i)) return false;
            return true;
          });
        }
      },
      indentUnit: parseInt($('#setting_editor_tab_size').val(), 10),
      tabSize: parseInt($('#setting_editor_tab_size').val(), 10),
      matchBrackets: true,
      autoCloseBrackets: true,
      smartIndent: true,
      theme: 'snc',
      keyMap: 'sublime',
      extraKeys: getExtraKeys()
    });
  
    cm.on('change', function () {
      snd_xplore_util.is_dirty = true;
    });
  
    var server;
    cm.on("keyup", function (cm, event) {
      var keyCode = ('which' in event) ? event.which : event.keyCode;
      var ternTooltip = document.getElementsByClassName('CodeMirror-Tern-tooltip')[0];
      if (keyCode == 190)
        if (event.shiftKey)
          return;
        else if (server) {
          server.complete(cm, server);
        }
      if (keyCode == 57 && window.event.shiftKey && ternTooltip)
        $(ternTooltip).show();
      if (keyCode == 27 && ternTooltip)
        $(ternTooltip).hide();
    });
    cm.on("startCompletion", function (cm) {
      var completion = cm.state.completionActive;
      completion.options.completeSingle = false;
      var pick = completion.pick;
      completion.pick = function (data, i) {
        var completion = data.list[i];
        CodeMirror.signal(cm, "codemirror_hint_pick", {
          data: completion,
          editor: cm
        });
        pick.apply(this, arguments);
      };
    });
    cm.on("codemirror_hint_pick", function (i) {
      var data = i.data.data;
      var editor = i.editor;
      var cur = editor.getCursor();
      var token = data.type;
      if (token && token.indexOf('fn(') != -1) {
        if (editor.getTokenAt({
          ch: cur.ch + 1,
          line: cur.line
        }).string != '(') {
          editor.replaceRange('()', {
            line: cur.line,
            ch: cur.ch
          }, {
            line: cur.line,
            ch: cur.ch
          });
          if (token && token.substr(0, 4) !== 'fn()' && $('div.CodeMirror-Tern-tooltip')[0]) {
          editor.execCommand('goCharLeft');
          setTimeout(function() {
            var ternTooltip = document.getElementsByClassName('CodeMirror-Tern-tooltip')[0];
            if (ternTooltip) {
              $(ternTooltip).show();
            }
          }, 100);
        }
      } else if (token && token.substr(0, 4) !== 'fn()')
        editor.execCommand('goCharRight');
      }
    });
  
    $.get("/api/now/sp/editor/autocomplete/table/sys_script_include/field/script").then(function(t) {
      setupTernServer(t.result);
    });

    return cm;
  }

  // Implement support for syntax editor macros
  function replaceWordWithMacro(cm) {
    var cursor = cm.getCursor();
    var wordPos = cm.findWordAt(cursor);
    var word = cm.getRange(wordPos.anchor, wordPos.head);
    if (!word || !word.match(/^[a-z0-9-_]+$/)) return false;
    var macro = $('.syntax_macro[name="' + word + '"]').first().text();
    if (!macro) return false;
    cm.setSelection(wordPos.anchor, wordPos.head);
    cm.replaceSelection(macro);

    // try to put the cursor at the first variable position
    var charPos = findFirstPosition('$0', macro);
    if (charPos.line > -1) {
      charPos.line += wordPos.anchor.line;
      cm.setSelection(charPos, {line: charPos.line, ch: charPos.ch + 2});
      snd_xplore_editor.replaceSelection('');
    }

    return true;
  }

  // find the line and character position of a string 
  function findFirstPosition(what, text) {
    var result = {line: -1, ch: -1};
    var lines = text.split('\n');
    for (var i = 0, p; i < lines.length; i++) {
      p = lines[i].indexOf(what);
      if (p > -1) {
        result.line = i;
        result.ch = p;
        break;
      }
    }
    return result;
  }

  function setupTernServer(data) {
    var plugins = {};
    server = new CodeMirror.TernServer({
      defs: [data, defaultJSAutocomplete()],
      plugins: plugins
    });

    window.snd_xplore_editor.addKeyMap({
      "Ctrl-Space": function(cm) {
        server.complete(cm);
      },
      "Ctrl-I": function(cm) {
        server.showType(cm);
      },
      "Ctrl-O": function(cm) {
        server.showDocs(cm);
      },
      "Alt-.": function(cm) {
        server.jumpToDef(cm);
      },
      "Alt-,": function(cm) {
        server.jumpBack(cm);
      },
      "Ctrl-Q": function(cm) {
        server.rename(cm);
      },
      "Ctrl-.": function(cm) {
        server.selectName(cm);
      }
    });
    window.snd_xplore_editor.on("cursorActivity", function(cm) {
      server.updateArgHints(cm);
    });
  }

  $('#user_data_input').on('keyup', function () {
    snd_xplore_util.is_dirty = true;
  });

  function setupReporter() {
    var sxr = snd_xplore_reporter;
    sxr.initialize();
    sxr.addEvent('start', function () {
      snd_xplore_util.loading();
      disableFilteredLogMenu();
    });
    sxr.addEvent('done', function (result) {
      snd_xplore_util.loadingComplete(result);
      if (snd_xplore_util.start_time && snd_xplore_util.end_time) {
        enableFilteredLogMenu();
      }
    });
    sxr.addEvent('click.interactive-result', snd_xplore_util.execute);
    sxr.addEvent('click.breadcrumb', snd_xplore_util.execute);
  }

  setupHelpModal();
  window.snd_xplore_editor = setupScriptEditor();
  setupReporter();

  $(document).ready(function () {
    $('#target').select2({width: '150px'});

    // The width appears to be set by option values which means it's too narrow
    // so we need to override width to our "max width" here instead.
    $('#scope').select2({width: '350px'});

  });

  // handle the run button clicking
  $('#xplore_btn').click(function () {
    snd_xplore_util.executeNew();
  }).prop('title', 'Run Script (' + (CodeMirror.keyMap.default == CodeMirror.keyMap.macDefault ? 'Cmd+Enter' : 'Ctrl+Enter') + ')');

  // handle the cancel button clicking
  $('#cancel_btn').click(function () {
    snd_xplore_util.cancel();
  });

  // reload the script history when a user clicks the info tab
  $('#info_pane_tab').click(function () {
    snd_script_history_util.loadAll();
  });

  // Setup property toggles
  var current_theme = $('#setting_theme').val();
  function updateTheme(theme, preview) {
    theme = theme || $('#setting_theme').val();
    $('body').removeClass('xplore-s-' + current_theme).addClass('xplore-s-' + theme);
    snd_xplore_editor.setOption('theme', theme);
    current_theme = theme;
  }
  snd_xplore_editor.setOption('theme', current_theme);

  // Setup theme management in settings modal
  // select2 only works when visible so we run it when the modal opens
  $('#modal_settings').on('shown.bs.modal', function () {
    $('#setting_theme').select2({
      dropdownParent: $('#modal_settings')
    })
    .on('select2:close', function (e) {
      updateTheme(null, true); // reset the theme from preview
    })
    .on('change', function (e) {
      updateTheme(); // save the theme preference
    })
    .on('select2:open', function () {
      // preview the theme as the user presses up/down
      // register the event once select2 has created the dropdown
      $('.select2-drop').keyup(function (e) {
        var key = e.keyCode || e.which;
        if (key == 38 || key == 40) { // up or down key
          updateTheme($('.select2-result.select2-highlighted').text(), true);
        }
      });
    });
    $('#max_depth').select2({
      dropdownParent: $('#modal_settings')
    });
  });

  // Setup settings
  $('#setting_save_shortcut,#setting_quotes,#show_props,#show_strings,#fix_gslog,#use_es_latest,#load_user_scope').
    bootstrapToggle({
      on: 'On',
      off: 'Off',
      onstyle: 'success',
      offstyle: 'default',
      size: 'mini',
      width: 75
    });
  $('#show_html_messages').
    bootstrapToggle({
      on: 'HTML',
      off: 'Text',
      onstyle: 'success',
      offstyle: 'warning',
      size: 'mini',
      width: 75
    });
  $('#wrap_output_pre').
    bootstrapToggle({
      on: 'Wrap',
      off: 'Scroll',
      onstyle: 'success',
      offstyle: 'warning',
      size: 'mini',
      width: 75
    }).change(function () {
      if (this.checked) {
        $('#script_output').addClass('wrap-pre');
      } else {
        $('#script_output').removeClass('wrap-pre');
      }
    });
  $('#support_hoisting').
    bootstrapToggle({
      on: 'On',
      off: 'Off',
      onstyle: 'warning',
      offstyle: 'default',
      size: 'mini',
      width: 75
    });
  $('#debug_mode').
    bootstrapToggle({
      on: 'On',
      off: 'Off',
      onstyle: 'danger',
      offstyle: 'default',
      size: 'mini',
      width: 75
    });

  // Preview editor width setting change
  $('#setting_editor_width').change(function () {
    var el = $('#setting_editor_width');
    var width = parseInt(el.val() || 40);
    if (width < 10) width = 10;
    if (width > 90) width = 90;
    el.val(width + '%');
    resizeUtil.setEditorWidthFromSettings();
    resizeUtil.resize();
  });

  $('#setting_editor_tab_size').change(function () {
    var el = $('#setting_editor_tab_size');
    var size = parseInt(el.val() || 40);
    snd_xplore_editor.setOption('tabSize', size);
    snd_xplore_editor.setOption('indentUnit', size);
  });

  $('#save_settings').click(function () {
    snd_xplore_setting_util.save();
  });

  $('#reset_settings').click(function () {
    snd_xplore_setting_util.reset();
  });

  // set default to wrapped
  if ($('#wrap_output_pre:checked')) {
    $('#script_output').addClass('wrap-pre');
  }

  // regex input trigger
  $('#regex,#regex_options,#regex_input').on('keyup', function () {
    delay('testRegex', snd_xplore_regex_util.run, 700);
  });

  // table input trigger
  $('#table_hierarchy_form').on('submit', function (e) {
    e.preventDefault();

    var table = $('#table_hierarchy_table').blur().val();
    var search_labels = $('#table_hierarchy_table_do_label').is(':checked');
    //if (!table) return;
    //delay('tableHierarchy', function () {
      snd_xplore_table_util.getTableHierarchy(table, search_labels);
    //}, 700);
  });

  // table hierarchy link trigger
  $('#table_hierarchy_result').on('click', 'a', function (e) {
    var $this = $(this);
    var table;
    table = $this.attr('data-show');
    if (table) {
      e.preventDefault();
      $('#table_hierarchy_table').val(table);
      snd_xplore_table_util.getTableHierarchy(table);
    }
  });

  // setup the editor toggle button
  $('#editor_toggle').on('click', function () {
    snd_xplore_util.toggleEditor();
  });

  $('#clearBreadcrumb').on('click', function () {
    snd_xplore_reporter.clearBreadcrumb();
  });

  // Dirty form detection
  $(window).bind('beforeunload', function() {
    if (snd_xplore_ui.isDirty()) {
      return 'There are unsaved changes on this page. Do you want to leave?';
    }
  });

  var resizeUtil = {
    setEditorWidthFromSettings: function () {
      var width = parseInt($('#setting_editor_width').val() || 40); // default is 40% width
      if (width > 90) width = 90;
      if (width < 10) width = 10;
      $('#editor').css('width', width + '%');
      $('#output').css('left', width + '%');
    },

    calcEditorRatio: function (store) {
      var ratio = $('#editor').width() / $('#workbench').width();
      if (store) {
        resizeUtil.editorRatio = ratio;
      }
      return ratio;
    },
    editorRatio: 0,

    calcWorkbenchWidth: function (store) {
      var width = $('#workbench').width();
      if (store) {
        resizeUtil.workbenchWidth = width;
      }
      return width;
    },
    workbenchWidth: 0,

    resize: function () {
      // need to see if we are changing the window size or just the editor width
      // we do this by checking if the workbench width has changed
      if (resizeUtil.workbenchWidth != resizeUtil.calcWorkbenchWidth(true)) {
        var newWidth = $('#workbench').width() * resizeUtil.editorRatio;
        var $editor = $('#editor');
        $editor.css('width', newWidth);
        if ($editor.is(':visible')) {
          $('#output').css('left', newWidth);
        }
      }

      resizeUtil.resizeLogPane();
      resizeUtil.resizeOutputContent();
      resizeUtil.resizeUserData();
      resizeUtil.resizeWrapper();
    },

    // facilitate system log frame resizing
    resizeLogPane: function resizeLogPane() {
      var $output_content = $('#output_content');
      var $output_tabs = $('#output_tabs');
      var h = $output_content.height() - $output_tabs.height() - 10;
      $('#log_frame,#node_log_frame').css('height', h);
    },

    // update the output pane so the tabs can stack and be seen
    resizeOutputContent: function resizeOutputContent() {
      $output_tabs_pane.css('top', $('#output_tabs').outerHeight() + 'px');
    },

    resizeUserData: function resizeUserData() {
      var min_height = 150;
      var input = $('#user_data_input');
      var available_height = $('#wrapper').height();
      var input_top = input.offset().top;
      var height = available_height - input_top;
      input.height((height < min_height ? min_height : height) + 'px');
    },

    // Adjust the "top" attribute of the "wrapper" div accordingly to the header
    resizeWrapper: function resizeWrapper() {
      document.getElementById("wrapper").style.top = document.getElementById("navbar").parentElement.offsetHeight + "px";
    }
  };

  resizeUtil.setEditorWidthFromSettings();
  resizeUtil.calcEditorRatio(true);
  resizeUtil.calcWorkbenchWidth(true);

  // make the code mirror editor resizable
  $('#editor').resizable({
    containment: 'parent',
    handles: {'e': '.ui-resizable-e'},
    minWidth: 100,
    resize: function (e, ui) {
      $('#output').css('left', ui.size.width + 'px');
      resizeUtil.calcEditorRatio(true);
    }
  });

  // set the width of the editor and output so they are pixels instead of percents
  // this is so the editor looks right when the side-pane is shown/hidden
  (function () {
    var $output = $('#output');
    var $editor = $('#editor');
    var editorWidth = $editor.outerWidth();
    $output.css('left', editorWidth);
    $editor.css('width', editorWidth);
  })();

  // Setup the onChange handler for hiding scope select
  // when the target is not the client.
  $('#target').on('change', function () {
    // use parent to capture Select2
    if (this.value == 'server') {
      $('#scope').parent().fadeIn();
    } else {
      $('#scope').parent().fadeOut();
    }
  });

  // make tabs clickable
  $('#output_tabs a').click(function (e) {
    e.preventDefault();
    $(this).tab('show');
  });

  $('#user_data_format_btn').click(function () {
    snd_xplore_util.formatString();
  });

  var $output_tabs_pane = $('#output_tabs_pane');
  var active_log_frame = '';
  var default_node_log_url = '/ui_page_process.do?name=log_file_browser&max_rows=2000';

  function getQueryDate(date, time) {
    if (time) {
      date = date + '\',\'' + time;
    } else {
      date = date.split(' ').join('\',\'');
    }
    return 'javascript:gs.dateGenerate(\'' + date + '\')';
  }

  function getCreatedQuery(element) {
    if (element.id.indexOf('filtered') === 0 && snd_xplore_util.start_time && snd_xplore_util.end_time) {
      return encodeURIComponent('sys_created_on>=' + getQueryDate(snd_xplore_util.start_time) + '^sys_created_on<=' + getQueryDate(snd_xplore_util.end_time));
    }
    return 'sys_created_onONToday%40javascript%3Ags.daysAgoStart(0)%40javascript%3Ags.daysAgoEnd(0)';
  }

  function enableFilteredLogMenu() {
    $('#filtered_log_menu_header, #filtered_log_menu_divider, #log_menu a[id^="filtered"]').show();
  }

  function disableFilteredLogMenu() {
    $('#filtered_log_menu_header, #filtered_log_menu_divider, #log_menu a[id^="filtered"]').hide();
  }
  disableFilteredLogMenu(); // prevent links when the page loads

  function updateLogFrame(src) {
    $('#log_frame').attr('src', src);
    active_log_frame = 'system';
  }

  $('#system_log_tab,#filtered_system_log_tab').click(function () {
    updateLogFrame('/syslog_list.do?sysparm_view=&sysparm_query=' + getCreatedQuery(this));
  });
  $('#app_log_tab,#filtered_app_log_tab').click(function () {
    updateLogFrame('/syslog_app_scope_list.do?sysparm_view=&sysparm_query=' + getCreatedQuery(this));
  });
  $('#email_log_tab,#filtered_email_log_tab').click(function () {
    updateLogFrame('/sys_email_list.do?sysparm_view=&sysparm_query=' + getCreatedQuery(this));
  });
  $('#event_log_tab,#filtered_event_log_tab').click(function () {
    updateLogFrame('/sysevent_list.do?sysparm_view=&sysparm_query=' + getCreatedQuery(this));
  });
  $('#request_log_tab,#filtered_request_log_tab').click(function () {
    updateLogFrame('/sys_outbound_http_log_list.do?sysparm_view=&sysparm_query=' + getCreatedQuery(this));
  });
  $('#node_log_tab,#filtered_node_log_tab').click(function () {
    var new_url;

    active_log_frame = 'node';
    if (this.id.indexOf('filtered') === 0) {
      new_url = $('#node_log_url').val();
    }

    // we don't want to refresh the iframe if it's the same URL
    if (node_log_url !== new_url) {
      node_log_url = new_url || default_node_log_url;
      $('#node_log_frame').attr('src', node_log_url);
    }
  });
  $('#log_reset').click(function () {
    var $frame = $('#' + active_log_frame + '_log_frame');
    if ($frame.length) {
      $frame.attr('src', $frame.attr('src'));
    }
    $('#' + active_log_frame + '_log_tab').click(); // select the tab
  });

  $('#copy_results').click(function () {
    var show_more_links = $('button.show-more');
    var hidden_rows = $('.data-more');
    show_more_links.hide();
    hidden_rows.attr('data-hidden', function (el) {
      return $(el).hasClass('hidden') ? 'true' : 'false';
    });
    hidden_rows.removeClass('hidden');
    snd_xplore_util.copyElementToClipboard($('#results_table').get(0));
    show_more_links.show();
    hidden_rows.each(function (i, el) {
      el = $(el);
      if (el.attr('data-hidden') == 'true') {
        el.addClass('hidden');
      }
    });
    snd_xplore_util.simpleNotification('Results copied to clipboard');
  });

  $('#copy_user_data').click(function () {
    var val = $('#user_data_input').val();
    snd_xplore_util.copyTextToClipboard(val);
  });

  resizeUtil.resizeLogPane();
  resizeUtil.resizeOutputContent();
  // resizeUtil.resizeUserData();
  resizeUtil.resizeWrapper();

  $('#user_data_tab').on('shown.bs.tab', resizeUtil.resizeUserData);

  // resize the view when the window resizes
  $(window).resize(function () {
    resizeUtil.resize();
  });

  // Checkboxes will only be reset with a delay after duplicating a tab in Chrome
  setTimeout(function () {

    // Address Chrome duplicate tab bug which makes checkboxes selected even when they weren't
    $.each(snd_xplore_default_settings, function (name, value) {
      if (typeof value === 'boolean') {
        var el = $('#' + name);
        el.bootstrapToggle(el.is(':checked') ? 'on' : 'off');
      }
    });

    snd_script_history_util.loadAll();

    snd_xplore_editor.focus();
    $('#window_loader').removeClass('active');

    snd_script_history_util.loadFromUrl();
  }, 10);

});

// Prevent "Blocked aria-hidden on an element because its descendant retained focus." errors
// with Bootstrap UI modal. This happens when the modal is closed (hidden) but content in
// the modal retains focus.
document.addEventListener("DOMContentLoaded", function () {
  document.addEventListener('hide.bs.modal', function (event) {
    if (document.activeElement) {
      document.activeElement.blur();
    }
  });
});

function defaultJSAutocomplete() {
  "use strict";
  return {
    "!name": "ecma5",
    "!define": {
      "Error.prototype": "Error.prototype"
    },
    Infinity: {
      "!type": "number",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Infinity",
      "!doc": "A numeric value representing infinity."
    },
    undefined: {
      "!type": "?",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/undefined",
      "!doc": "The value undefined."
    },
    NaN: {
      "!type": "number",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/NaN",
      "!doc": "A value representing Not-A-Number."
    },
    Object: {
      "!type": "fn()",
      getPrototypeOf: {
        "!type": "fn(obj: ?) -> ?",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/getPrototypeOf",
        "!doc": "Returns the prototype (i.e. the internal prototype) of the specified object."
      },
      create: {
        "!type": "fn(proto: ?) -> !custom:Object_create",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/create",
        "!doc": "Creates a new object with the specified prototype object and properties."
      },
      defineProperty: {
        "!type": "fn(obj: ?, prop: string, desc: ?) -> !custom:Object_defineProperty",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/defineProperty",
        "!doc": "Defines a new property directly on an object, or modifies an existing property on an object, and returns the object. If you want to see how to use the Object.defineProperty method with a binary-flags-like syntax, see this article."
      },
      defineProperties: {
        "!type": "fn(obj: ?, props: ?) -> !custom:Object_defineProperties",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/defineProperty",
        "!doc": "Defines a new property directly on an object, or modifies an existing property on an object, and returns the object. If you want to see how to use the Object.defineProperty method with a binary-flags-like syntax, see this article."
      },
      getOwnPropertyDescriptor: {
        "!type": "fn(obj: ?, prop: string) -> ?",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor",
        "!doc": "Returns a property descriptor for an own property (that is, one directly present on an object, not present by dint of being along an object's prototype chain) of a given object."
      },
      keys: {
        "!type": "fn(obj: ?) -> [string]",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/keys",
        "!doc": "Returns an array of a given object's own enumerable properties, in the same order as that provided by a for-in loop (the difference being that a for-in loop enumerates properties in the prototype chain as well)."
      },
      getOwnPropertyNames: {
        "!type": "fn(obj: ?) -> [string]",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames",
        "!doc": "Returns an array of all properties (enumerable or not) found directly upon a given object."
      },
      seal: {
        "!type": "fn(obj: ?)",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/seal",
        "!doc": "Seals an object, preventing new properties from being added to it and marking all existing properties as non-configurable. Values of present properties can still be changed as long as they are writable."
      },
      isSealed: {
        "!type": "fn(obj: ?) -> bool",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/isSealed",
        "!doc": "Determine if an object is sealed."
      },
      freeze: {
        "!type": "fn(obj: ?) -> !0",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/freeze",
        "!doc": "Freezes an object: that is, prevents new properties from being added to it; prevents existing properties from being removed; and prevents existing properties, or their enumerability, configurability, or writability, from being changed. In essence the object is made effectively immutable. The method returns the object being frozen."
      },
      isFrozen: {
        "!type": "fn(obj: ?) -> bool",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/isFrozen",
        "!doc": "Determine if an object is frozen."
      },
      preventExtensions: {
        "!type": "fn(obj: ?)",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/preventExtensions",
        "!doc": "Prevents new properties from ever being added to an object."
      },
      isExtensible: {
        "!type": "fn(obj: ?) -> bool",
        "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isExtensible",
        "!doc": "The Object.isExtensible() method determines if an object is extensible (whether it can have new properties added to it)."
      },
      prototype: {
        "!stdProto": "Object",
        toString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/toString",
          "!doc": "Returns a string representing the object."
        },
        toLocaleString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/toLocaleString",
          "!doc": "Returns a string representing the object. This method is meant to be overriden by derived objects for locale-specific purposes."
        },
        valueOf: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/valueOf",
          "!doc": "Returns the primitive value of the specified object"
        },
        hasOwnProperty: {
          "!type": "fn(prop: string) -> bool",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/hasOwnProperty",
          "!doc": "Returns a boolean indicating whether the object has the specified property."
        },
        propertyIsEnumerable: {
          "!type": "fn(prop: string) -> bool",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object/propertyIsEnumerable",
          "!doc": "Returns a Boolean indicating whether the specified property is enumerable."
        },
        isPrototypeOf: {
          "!type": "fn(obj: ?) -> bool",
          "!url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isPrototypeOf",
          "!doc": "Tests for an object in another object's prototype chain."
        }
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Object",
      "!doc": "Creates an object wrapper."
    },
    Function: {
      "!type": "fn(body: string) -> fn()",
      prototype: {
        "!stdProto": "Function",
        apply: {
          "!type": "fn(this: ?, args: [?])",
          "!effects": ["call and return !this this=!0 !1.<i> !1.<i> !1.<i>"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/apply",
          "!doc": "Calls a function with a given this value and arguments provided as an array (or an array like object)."
        },
        call: {
          "!type": "fn(this: ?, args?: ?) -> !this.!ret",
          "!effects": ["call and return !this this=!0 !1 !2 !3 !4"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/call",
          "!doc": "Calls a function with a given this value and arguments provided individually."
        },
        bind: {
          "!type": "fn(this: ?, args?: ?) -> !custom:Function_bind",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind",
          "!doc": "Creates a new function that, when called, has its this keyword set to the provided value, with a given sequence of arguments preceding any provided when the new function was called."
        },
        prototype: "?"
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function",
      "!doc": "Every function in JavaScript is actually a Function object."
    },
    Array: {
      "!type": "fn(size: number) -> !custom:Array_ctor",
      isArray: {
        "!type": "fn(value: ?) -> bool",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/isArray",
        "!doc": "Returns true if an object is an array, false if it is not."
      },
      prototype: {
        "!stdProto": "Array",
        length: {
          "!type": "number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/length",
          "!doc": "An unsigned, 32-bit integer that specifies the number of elements in an array."
        },
        concat: {
          "!type": "fn(other: [?]) -> !this",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/concat",
          "!doc": "Returns a new array comprised of this array joined with other array(s) and/or value(s)."
        },
        join: {
          "!type": "fn(separator?: string) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/join",
          "!doc": "Joins all elements of an array into a string."
        },
        splice: {
          "!type": "fn(pos: number, amount: number, newelt?: ?) -> [?]",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/splice",
          "!doc": "Changes the content of an array, adding new elements while removing old elements."
        },
        pop: {
          "!type": "fn() -> !this.<i>",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/pop",
          "!doc": "Removes the last element from an array and returns that element."
        },
        push: {
          "!type": "fn(newelt: ?) -> number",
          "!effects": ["propagate !0 !this.<i>"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/push",
          "!doc": "Mutates an array by appending the given elements and returning the new length of the array."
        },
        shift: {
          "!type": "fn() -> !this.<i>",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/shift",
          "!doc": "Removes the first element from an array and returns that element. This method changes the length of the array."
        },
        unshift: {
          "!type": "fn(newelt: ?) -> number",
          "!effects": ["propagate !0 !this.<i>"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/unshift",
          "!doc": "Adds one or more elements to the beginning of an array and returns the new length of the array."
        },
        slice: {
          "!type": "fn(from?: number, to?: number) -> !this",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/slice",
          "!doc": "Returns a shallow copy of a portion of an array."
        },
        reverse: {
          "!type": "fn()",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/reverse",
          "!doc": "Reverses an array in place.  The first array element becomes the last and the last becomes the first."
        },
        sort: {
          "!type": "fn(compare?: fn(a: ?, b: ?) -> number)",
          "!effects": ["call !0 !this.<i> !this.<i>"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/sort",
          "!doc": "Sorts the elements of an array in place and returns the array."
        },
        indexOf: {
          "!type": "fn(elt: ?, from?: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/indexOf",
          "!doc": "Returns the first index at which a given element can be found in the array, or -1 if it is not present."
        },
        lastIndexOf: {
          "!type": "fn(elt: ?, from?: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/lastIndexOf",
          "!doc": "Returns the last index at which a given element can be found in the array, or -1 if it is not present. The array is searched backwards, starting at fromIndex."
        },
        every: {
          "!type": "fn(test: fn(elt: ?, i: number, array: +Array) -> bool, context?: ?) -> bool",
          "!effects": ["call !0 this=!1 !this.<i> number !this"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/every",
          "!doc": "Tests whether all elements in the array pass the test implemented by the provided function."
        },
        some: {
          "!type": "fn(test: fn(elt: ?, i: number, array: +Array) -> bool, context?: ?) -> bool",
          "!effects": ["call !0 this=!1 !this.<i> number !this"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/some",
          "!doc": "Tests whether some element in the array passes the test implemented by the provided function."
        },
        filter: {
          "!type": "fn(test: fn(elt: ?, i: number, array: +Array) -> bool, context?: ?) -> !this",
          "!effects": ["call !0 this=!1 !this.<i> number !this"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/filter",
          "!doc": "Creates a new array with all elements that pass the test implemented by the provided function."
        },
        forEach: {
          "!type": "fn(f: fn(elt: ?, i: number, array: +Array), context?: ?)",
          "!effects": ["call !0 this=!1 !this.<i> number !this"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/forEach",
          "!doc": "Executes a provided function once per array element."
        },
        map: {
          "!type": "fn(f: fn(elt: ?, i: number, array: +Array) -> ?, context?: ?) -> [!0.!ret]",
          "!effects": ["call !0 this=!1 !this.<i> number !this"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/map",
          "!doc": "Creates a new array with the results of calling a provided function on every element in this array."
        },
        reduce: {
          "!type": "fn(combine: fn(sum: ?, elt: ?, i: number, array: +Array) -> ?, init?: ?) -> !0.!ret",
          "!effects": ["call !0 !1 !this.<i> number !this"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/Reduce",
          "!doc": "Apply a function against an accumulator and each value of the array (from left-to-right) as to reduce it to a single value."
        },
        reduceRight: {
          "!type": "fn(combine: fn(sum: ?, elt: ?, i: number, array: +Array) -> ?, init?: ?) -> !0.!ret",
          "!effects": ["call !0 !1 !this.<i> number !this"],
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/ReduceRight",
          "!doc": "Apply a function simultaneously against two values of the array (from right-to-left) as to reduce it to a single value."
        }
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array",
      "!doc": "The JavaScript Array global object is a constructor for arrays, which are high-level, list-like objects."
    },
    String: {
      "!type": "fn(value: ?) -> string",
      fromCharCode: {
        "!type": "fn(code: number) -> string",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/fromCharCode",
        "!doc": "Returns a string created by using the specified sequence of Unicode values."
      },
      prototype: {
        "!stdProto": "String",
        length: {
          "!type": "number",
          "!url": "https://developer.mozilla.org/en/docs/JavaScript/Reference/Global_Objects/String/length",
          "!doc": "Represents the length of a string."
        },
        "<i>": "string",
        charAt: {
          "!type": "fn(i: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/charAt",
          "!doc": "Returns the specified character from a string."
        },
        charCodeAt: {
          "!type": "fn(i: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/charCodeAt",
          "!doc": "Returns the numeric Unicode value of the character at the given index (except for unicode codepoints > 0x10000)."
        },
        indexOf: {
          "!type": "fn(char: string, from?: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/indexOf",
          "!doc": "Returns the index within the calling String object of the first occurrence of the specified value, starting the search at fromIndex,\nreturns -1 if the value is not found."
        },
        lastIndexOf: {
          "!type": "fn(char: string, from?: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/lastIndexOf",
          "!doc": "Returns the index within the calling String object of the last occurrence of the specified value, or -1 if not found. The calling string is searched backward, starting at fromIndex."
        },
        substring: {
          "!type": "fn(from: number, to?: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/substring",
          "!doc": "Returns a subset of a string between one index and another, or through the end of the string."
        },
        substr: {
          "!type": "fn(from: number, length?: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/substr",
          "!doc": "Returns the characters in a string beginning at the specified location through the specified number of characters."
        },
        slice: {
          "!type": "fn(from: number, to?: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/slice",
          "!doc": "Extracts a section of a string and returns a new string."
        },
        trim: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/Trim",
          "!doc": "Removes whitespace from both ends of the string."
        },
        toUpperCase: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toUpperCase",
          "!doc": "Returns the calling string value converted to uppercase."
        },
        toLowerCase: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toLowerCase",
          "!doc": "Returns the calling string value converted to lowercase."
        },
        toLocaleUpperCase: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toLocaleUpperCase",
          "!doc": "Returns the calling string value converted to upper case, according to any locale-specific case mappings."
        },
        toLocaleLowerCase: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase",
          "!doc": "Returns the calling string value converted to lower case, according to any locale-specific case mappings."
        },
        split: {
          "!type": "fn(pattern?: string|+RegExp, limit?: number) -> [string]",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/split",
          "!doc": "Splits a String object into an array of strings by separating the string into substrings."
        },
        concat: {
          "!type": "fn(other: string) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/concat",
          "!doc": "Combines the text of two or more strings and returns a new string."
        },
        localeCompare: {
          "!type": "fn(other: string) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/localeCompare",
          "!doc": "Returns a number indicating whether a reference string comes before or after or is the same as the given string in sort order."
        },
        match: {
          "!type": "fn(pattern: +RegExp) -> [string]",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/match",
          "!doc": "Used to retrieve the matches when matching a string against a regular expression."
        },
        replace: {
          "!type": "fn(pattern: string|+RegExp, replacement: string) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/replace",
          "!doc": "Returns a new string with some or all matches of a pattern replaced by a replacement.  The pattern can be a string or a RegExp, and the replacement can be a string or a function to be called for each match."
        },
        search: {
          "!type": "fn(pattern: +RegExp) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String/search",
          "!doc": "Executes the search for a match between a regular expression and this String object."
        }
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/String",
      "!doc": "The String global object is a constructor for strings, or a sequence of characters."
    },
    Number: {
      "!type": "fn(value: ?) -> number",
      MAX_VALUE: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/MAX_VALUE",
        "!doc": "The maximum numeric value representable in JavaScript."
      },
      MIN_VALUE: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/MIN_VALUE",
        "!doc": "The smallest positive numeric value representable in JavaScript."
      },
      POSITIVE_INFINITY: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/POSITIVE_INFINITY",
        "!doc": "A value representing the positive Infinity value."
      },
      NEGATIVE_INFINITY: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/NEGATIVE_INFINITY",
        "!doc": "A value representing the negative Infinity value."
      },
      prototype: {
        "!stdProto": "Number",
        toString: {
          "!type": "fn(radix?: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toString",
          "!doc": "Returns a string representing the specified Number object"
        },
        toFixed: {
          "!type": "fn(digits: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toFixed",
          "!doc": "Formats a number using fixed-point notation"
        },
        toExponential: {
          "!type": "fn(digits: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toExponential",
          "!doc": "Returns a string representing the Number object in exponential notation"
        },
        toPrecision: {
          "!type": "fn(digits: number) -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number/toPrecision",
          "!doc": "The toPrecision() method returns a string representing the number to the specified precision."
        }
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Number",
      "!doc": "The Number JavaScript object is a wrapper object allowing you to work with numerical values. A Number object is created using the Number() constructor."
    },
    Boolean: {
      "!type": "fn(value: ?) -> bool",
      prototype: {
        "!stdProto": "Boolean"
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Boolean",
      "!doc": "The Boolean object is an object wrapper for a boolean value."
    },
    RegExp: {
      "!type": "fn(source: string, flags?: string)",
      prototype: {
        "!stdProto": "RegExp",
        exec: {
          "!type": "fn(input: string) -> [string]",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/exec",
          "!doc": "Executes a search for a match in a specified string. Returns a result array, or null."
        },
        test: {
          "!type": "fn(input: string) -> bool",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/test",
          "!doc": "Executes the search for a match between a regular expression and a specified string. Returns true or false."
        },
        global: {
          "!type": "bool",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp",
          "!doc": "Creates a regular expression object for matching text with a pattern."
        },
        ignoreCase: {
          "!type": "bool",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp",
          "!doc": "Creates a regular expression object for matching text with a pattern."
        },
        multiline: {
          "!type": "bool",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/multiline",
          "!doc": "Reflects whether or not to search in strings across multiple lines.\n"
        },
        source: {
          "!type": "string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/source",
          "!doc": "A read-only property that contains the text of the pattern, excluding the forward slashes.\n"
        },
        lastIndex: {
          "!type": "number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp/lastIndex",
          "!doc": "A read/write integer property that specifies the index at which to start the next match."
        }
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RegExp",
      "!doc": "Creates a regular expression object for matching text with a pattern."
    },
    Date: {
      "!type": "fn(ms: number)",
      parse: {
        "!type": "fn(source: string) -> +Date",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/parse",
        "!doc": "Parses a string representation of a date, and returns the number of milliseconds since January 1, 1970, 00:00:00 UTC."
      },
      UTC: {
        "!type": "fn(year: number, month: number, date: number, hour?: number, min?: number, sec?: number, ms?: number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/UTC",
        "!doc": "Accepts the same parameters as the longest form of the constructor, and returns the number of milliseconds in a Date object since January 1, 1970, 00:00:00, universal time."
      },
      now: {
        "!type": "fn() -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/now",
        "!doc": "Returns the number of milliseconds elapsed since 1 January 1970 00:00:00 UTC."
      },
      prototype: {
        toUTCString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toUTCString",
          "!doc": "Converts a date to a string, using the universal time convention."
        },
        toISOString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toISOString",
          "!doc": "JavaScript provides a direct way to convert a date object into a string in ISO format, the ISO 8601 Extended Format."
        },
        toDateString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toDateString",
          "!doc": "Returns the date portion of a Date object in human readable form in American English."
        },
        toTimeString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toTimeString",
          "!doc": "Returns the time portion of a Date object in human readable form in American English."
        },
        toLocaleDateString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toLocaleDateString",
          "!doc": "Converts a date to a string, returning the \"date\" portion using the operating system's locale's conventions.\n"
        },
        toLocaleTimeString: {
          "!type": "fn() -> string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/toLocaleTimeString",
          "!doc": 'Converts a date to a string, returning the "time" portion using the current locale\'s conventions.'
        },
        getTime: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getTime",
          "!doc": "Returns the numeric value corresponding to the time for the specified date according to universal time."
        },
        getFullYear: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getFullYear",
          "!doc": "Returns the year of the specified date according to local time."
        },
        getYear: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getYear",
          "!doc": "Returns the year in the specified date according to local time."
        },
        getMonth: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getMonth",
          "!doc": "Returns the month in the specified date according to local time."
        },
        getUTCMonth: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCMonth",
          "!doc": "Returns the month of the specified date according to universal time.\n"
        },
        getDate: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getDate",
          "!doc": "Returns the day of the month for the specified date according to local time."
        },
        getUTCDate: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCDate",
          "!doc": "Returns the day (date) of the month in the specified date according to universal time.\n"
        },
        getDay: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getDay",
          "!doc": "Returns the day of the week for the specified date according to local time."
        },
        getUTCDay: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCDay",
          "!doc": "Returns the day of the week in the specified date according to universal time.\n"
        },
        getHours: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getHours",
          "!doc": "Returns the hour for the specified date according to local time."
        },
        getUTCHours: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCHours",
          "!doc": "Returns the hours in the specified date according to universal time.\n"
        },
        getMinutes: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getMinutes",
          "!doc": "Returns the minutes in the specified date according to local time."
        },
        getUTCMinutes: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date",
          "!doc": "Creates JavaScript Date instances which let you work with dates and times."
        },
        getSeconds: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getSeconds",
          "!doc": "Returns the seconds in the specified date according to local time."
        },
        getUTCSeconds: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCSeconds",
          "!doc": "Returns the seconds in the specified date according to universal time.\n"
        },
        getMilliseconds: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getMilliseconds",
          "!doc": "Returns the milliseconds in the specified date according to local time."
        },
        getUTCMilliseconds: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getUTCMilliseconds",
          "!doc": "Returns the milliseconds in the specified date according to universal time.\n"
        },
        getTimezoneOffset: {
          "!type": "fn() -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset",
          "!doc": "Returns the time-zone offset from UTC, in minutes, for the current locale."
        },
        setTime: {
          "!type": "fn(date: +Date) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setTime",
          "!doc": "Sets the Date object to the time represented by a number of milliseconds since January 1, 1970, 00:00:00 UTC.\n"
        },
        setFullYear: {
          "!type": "fn(year: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setFullYear",
          "!doc": "Sets the full year for a specified date according to local time.\n"
        },
        setUTCFullYear: {
          "!type": "fn(year: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCFullYear",
          "!doc": "Sets the full year for a specified date according to universal time.\n"
        },
        setMonth: {
          "!type": "fn(month: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setMonth",
          "!doc": "Set the month for a specified date according to local time."
        },
        setUTCMonth: {
          "!type": "fn(month: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCMonth",
          "!doc": "Sets the month for a specified date according to universal time.\n"
        },
        setDate: {
          "!type": "fn(day: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setDate",
          "!doc": "Sets the day of the month for a specified date according to local time."
        },
        setUTCDate: {
          "!type": "fn(day: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCDate",
          "!doc": "Sets the day of the month for a specified date according to universal time.\n"
        },
        setHours: {
          "!type": "fn(hour: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setHours",
          "!doc": "Sets the hours for a specified date according to local time, and returns the number of milliseconds since 1 January 1970 00:00:00 UTC until the time represented by the updated Date instance."
        },
        setUTCHours: {
          "!type": "fn(hour: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCHours",
          "!doc": "Sets the hour for a specified date according to universal time.\n"
        },
        setMinutes: {
          "!type": "fn(min: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setMinutes",
          "!doc": "Sets the minutes for a specified date according to local time."
        },
        setUTCMinutes: {
          "!type": "fn(min: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCMinutes",
          "!doc": "Sets the minutes for a specified date according to universal time.\n"
        },
        setSeconds: {
          "!type": "fn(sec: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setSeconds",
          "!doc": "Sets the seconds for a specified date according to local time."
        },
        setUTCSeconds: {
          "!type": "fn(sec: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCSeconds",
          "!doc": "Sets the seconds for a specified date according to universal time.\n"
        },
        setMilliseconds: {
          "!type": "fn(ms: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setMilliseconds",
          "!doc": "Sets the milliseconds for a specified date according to local time.\n"
        },
        setUTCMilliseconds: {
          "!type": "fn(ms: number) -> number",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date/setUTCMilliseconds",
          "!doc": "Sets the milliseconds for a specified date according to universal time.\n"
        }
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Date",
      "!doc": "Creates JavaScript Date instances which let you work with dates and times."
    },
    Error: {
      "!type": "fn(message: string)",
      prototype: {
        name: {
          "!type": "string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Error/name",
          "!doc": "A name for the type of error."
        },
        message: {
          "!type": "string",
          "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Error/message",
          "!doc": "A human-readable description of the error."
        }
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Error",
      "!doc": "Creates an error object."
    },
    SyntaxError: {
      "!type": "fn(message: string)",
      prototype: "Error.prototype",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/SyntaxError",
      "!doc": "Represents an error when trying to interpret syntactically invalid code."
    },
    ReferenceError: {
      "!type": "fn(message: string)",
      prototype: "Error.prototype",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/ReferenceError",
      "!doc": "Represents an error when a non-existent variable is referenced."
    },
    URIError: {
      "!type": "fn(message: string)",
      prototype: "Error.prototype",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/URIError",
      "!doc": "Represents an error when a malformed URI is encountered."
    },
    EvalError: {
      "!type": "fn(message: string)",
      prototype: "Error.prototype",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/EvalError",
      "!doc": "Represents an error regarding the eval function."
    },
    RangeError: {
      "!type": "fn(message: string)",
      prototype: "Error.prototype",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/RangeError",
      "!doc": "Represents an error when a number is not within the correct range allowed."
    },
    TypeError: {
      "!type": "fn(message: string)",
      prototype: "Error.prototype",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/TypeError",
      "!doc": "Represents an error an error when a value is not of the expected type."
    },
    parseInt: {
      "!type": "fn(string: string, radix?: number) -> number",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/parseInt",
      "!doc": "Parses a string argument and returns an integer of the specified radix or base."
    },
    parseFloat: {
      "!type": "fn(string: string) -> number",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/parseFloat",
      "!doc": "Parses a string argument and returns a floating point number."
    },
    isNaN: {
      "!type": "fn(value: number) -> bool",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/isNaN",
      "!doc": "Determines whether a value is NaN or not. Be careful, this function is broken. You may be interested in ECMAScript 6 Number.isNaN."
    },
    isFinite: {
      "!type": "fn(value: number) -> bool",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/isFinite",
      "!doc": "Determines whether the passed value is a finite number."
    },
    eval: {
      "!type": "fn(code: string) -> ?",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/eval",
      "!doc": "Evaluates JavaScript code represented as a string."
    },
    encodeURI: {
      "!type": "fn(uri: string) -> string",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/encodeURI",
      "!doc": 'Encodes a Uniform Resource Identifier (URI) by replacing each instance of certain characters by one, two, three, or four escape sequences representing the UTF-8 encoding of the character (will only be four escape sequences for characters composed of two "surrogate" characters).'
    },
    encodeURIComponent: {
      "!type": "fn(uri: string) -> string",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/encodeURIComponent",
      "!doc": 'Encodes a Uniform Resource Identifier (URI) component by replacing each instance of certain characters by one, two, three, or four escape sequences representing the UTF-8 encoding of the character (will only be four escape sequences for characters composed of two "surrogate" characters).'
    },
    decodeURI: {
      "!type": "fn(uri: string) -> string",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/decodeURI",
      "!doc": "Decodes a Uniform Resource Identifier (URI) previously created by encodeURI or by a similar routine."
    },
    decodeURIComponent: {
      "!type": "fn(uri: string) -> string",
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/decodeURIComponent",
      "!doc": "Decodes a Uniform Resource Identifier (URI) component previously created by encodeURIComponent or by a similar routine."
    },
    Math: {
      E: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/E",
        "!doc": "The base of natural logarithms, e, approximately 2.718."
      },
      LN2: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LN2",
        "!doc": "The natural logarithm of 2, approximately 0.693."
      },
      LN10: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LN10",
        "!doc": "The natural logarithm of 10, approximately 2.302."
      },
      LOG2E: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LOG2E",
        "!doc": "The base 2 logarithm of E (approximately 1.442)."
      },
      LOG10E: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/LOG10E",
        "!doc": "The base 10 logarithm of E (approximately 0.434)."
      },
      SQRT1_2: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/SQRT1_2",
        "!doc": "The square root of 1/2; equivalently, 1 over the square root of 2, approximately 0.707."
      },
      SQRT2: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/SQRT2",
        "!doc": "The square root of 2, approximately 1.414."
      },
      PI: {
        "!type": "number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/PI",
        "!doc": "The ratio of the circumference of a circle to its diameter, approximately 3.14159."
      },
      abs: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/abs",
        "!doc": "Returns the absolute value of a number."
      },
      cos: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/cos",
        "!doc": "Returns the cosine of a number."
      },
      sin: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/sin",
        "!doc": "Returns the sine of a number."
      },
      tan: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/tan",
        "!doc": "Returns the tangent of a number."
      },
      acos: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/acos",
        "!doc": "Returns the arccosine (in radians) of a number."
      },
      asin: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/asin",
        "!doc": "Returns the arcsine (in radians) of a number."
      },
      atan: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/atan",
        "!doc": "Returns the arctangent (in radians) of a number."
      },
      atan2: {
        "!type": "fn(y: number, x: number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/atan2",
        "!doc": "Returns the arctangent of the quotient of its arguments."
      },
      ceil: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/ceil",
        "!doc": "Returns the smallest integer greater than or equal to a number."
      },
      floor: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/floor",
        "!doc": "Returns the largest integer less than or equal to a number."
      },
      round: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/round",
        "!doc": "Returns the value of a number rounded to the nearest integer."
      },
      exp: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/exp",
        "!doc": "Returns Ex, where x is the argument, and E is Euler's constant, the base of the natural logarithms."
      },
      log: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/log",
        "!doc": "Returns the natural logarithm (base E) of a number."
      },
      sqrt: {
        "!type": "fn(number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/sqrt",
        "!doc": "Returns the square root of a number."
      },
      pow: {
        "!type": "fn(number, number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/pow",
        "!doc": "Returns base to the exponent power, that is, baseexponent."
      },
      max: {
        "!type": "fn(number, number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/max",
        "!doc": "Returns the largest of zero or more numbers."
      },
      min: {
        "!type": "fn(number, number) -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/min",
        "!doc": "Returns the smallest of zero or more numbers."
      },
      random: {
        "!type": "fn() -> number",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math/random",
        "!doc": "Returns a floating-point, pseudo-random number in the range [0, 1) that is, from 0 (inclusive) up to but not including 1 (exclusive), which you can then scale to your desired range."
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Math",
      "!doc": "A built-in object that has properties and methods for mathematical constants and functions."
    },
    JSON: {
      parse: {
        "!type": "fn(json: string, reviver?: fn(key: string, value: ?) -> ?) -> ?",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/JSON/parse",
        "!doc": "Parse a string as JSON, optionally transforming the value produced by parsing."
      },
      stringify: {
        "!type": "fn(value: ?, replacer?: fn(key: string, value: ?) -> ?, space?: string|number) -> string",
        "!url": "https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/JSON/stringify",
        "!doc": "Convert a value to JSON, optionally replacing values if a replacer function is specified, or optionally including only the specified properties if a replacer array is specified."
      },
      "!url": "https://developer.mozilla.org/en-US/docs/JSON",
      "!doc": "JSON (JavaScript Object Notation) is a data-interchange format.  It closely resembles a subset of JavaScript syntax, although it is not a strict subset. (See JSON in the JavaScript Reference for full details.)  It is useful when writing any kind of JavaScript-based application, including websites and browser extensions.  For example, you might store user information in JSON format in a cookie, or you might store extension preferences in JSON in a string-valued browser preference."
    }
  };
}