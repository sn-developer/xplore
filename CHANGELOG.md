# Xplore: Developer Toolkit
A toolkit for every ServiceNow developer.

### Version 5.02 - February 12, 2025
* Removed use of CDN's; dependencies are all local.
* Added toolbar to script editor for common actions including find and replace.
* Automatic script linting and code folding is now supported.
* Added support for syntax macros.
* Added support for code completion.
* Added support for Script Debugger.
* Scoped script execution access warning has been hidden.
* Added example (inactive) Scheduled Script Action for cleaning up Xplore user script includes.
* Disabled user script include versions and update set history.
* Fixed a bug where a new user script include would be created when impersonating.
* Made the breadcrumb clearer for undefined and null values.
* Minor UX upgrades.

### Version 5.01 - November 19, 2024
* Fixed "Open List in Xplore" list action. 

### Version 5.00 - November 18, 2024
* Redesigned the exploration experience with dynamic execution and nested property caching.
* Improved explored object descriptions.
* Fixed scoped execution for Xanadu.
* Fixed issue preventing "Add Existing File" from working in Studio.
* Improved glasses icon placement when resizing the browser in Polaris experience.
* Xplore will automatically switch to the user's application scope by default.
* Support for latest ECMAScript modes. (Requires application JavaScript mode to be set.)
* Several other minor updates and fixes.

### Version 4.13
* Fixed snd_xplore_glasses script so it doesn't break in Studio or other applications.
* Glasses icon has been replaced with the code-edit icon for San Diego versions.
* Deprecated glasses support for UI15.
* Fixed an issue where the notification area in lower right corner prevents "Show" links from working on smaller screens.

### Version 4.12.1
* Fixed JS Validation issue in pre-Tokyo versions caused by fix for Tokyo.

### Version 4.12
* Tested on Tokyo. Fixed issue preventing scripts from running.
* The Xplore Glasses icon is now available in Polaris environments.
* Added bracket matching in the code editor.
* Swapped bootstrap CDN to better support IP restricted environments.
* Added support for automatic code formatting.

### Version 4.11
* Tested on Rome and San Diego.
* Added a new setting to control the default editor width.
* Fixed a bug with scoped script execution not being aware of all config options.
* Added a new debug mode option for Xplore to help with tricky Java APIs. This is primarily for Xplore development, but will likely be useful to others.
* Added UI support for internal gs.debug, gs.warn, and gs.error logs.
* Added better support for displaying exceptions by preventing Java getMessage errors.
* Fixed a bug where duplicating tabs in Chrome would incorrectly turn all settings on.
* Added a hoisting notice that is displayed whenever hoisting is active (related to Chrome duplicate tab bug).

### Version 4.10 (Skipped)
* Turns out ServiceNow Share truncates 4.10 to 4.1

### Version 4.9
* Added two new options to history items to open them in a new tab or share them via encoded URL.
Large links can be pasted directly into the script editor where they will be loaded automatically.
* Added a "Copy to Clipboard" link on the Output pane for easy copying of the result table.
* Added padding to log message milliseconds so they line up nicely.
* Added option to disable "Ctrl + S" shortcut.
* Fixed a bug where object property names would be not be shown in the results.
* Fixed a bug where JSON user data would show up as "[object Object]" when loading from history.
* Fixed a bug caused by User Data Format being set but no user data being given.
* Fixed a bug where result properties names containing HTML/JavaScript were being executed when added to the result table.
* Fixed the contrast on keyword elements.
* General theming improvements.

### Version 4.8
* (beta) Added support for themes! The themes have been adapted from CodeMirror
  themes to with Xplore so some work better than others.
* Added script execution history. Each time you open Xplore, a new session is
  started and your script is saved when you run it. By default, 50 sessions
  are stored, but you can change this number using a system property. This is
  user specific.
* Settings from within Xplore are now able to be saved so they are loaded the next
  time Xplore is opened. This is user specific.
* Added automatic link recognition to Xplore output. Reference fields, links, and
  table.sys_id values are automatically converted to clickable links.
* Added support for function hoisting in the Editor. Note this is disabled by default but
  can be enabled from Xplore settings.
* Reorganised the main information window and about section and included release notes.
* Overhauled the Logs menu to include many more contextual links for logs generated
  during the last script execution, as well as shortcut links to logs just generated today.
* Added Select2 to Target and Scope selectors to make them easier to use.
* Improved the gs log behaviour to work as close to native as possible. gs.debug(), gs.info(),
  gs.warn() and gs.error() can now take 6 arguments while gs.log() will take 2 and gs.print() just 1.
* Fixed a bug where opening a list with an encoded query containing single quotes would
  not work because it was not properly escaped.
* Minor improvements to Xplore processor.
* Changed blacklist to ignorelist and redlist to warnlist.
* Updated JSON implementation.
* Fixed a bug with the Table Heirarchy generating an undefined exception.
* Fixed a bug where user data would not format properly when formatted within a scope.
* Fixed a bug with RegExp not showing unmatched alternative groups.
* Fixed a UI issue with the header on narrower screens.
* Fixed a bug where results might not be shown during scoped script execution.
* Fixed a bug that prevented Ctrl+D (select next occurrence) from working in the editor.

### Version 4.7
* Prevent Ctrl+Enter inserting new line in code.
* Add support for Ctrl+S to execute the script.
* Detect objects passed to gs.log/gs.info/gs.error/gs.debug and jslog methods and display them as JSON. (Server processing only applies when Fix Logs option is enabled.)

### Version 4.6
* Madrid support.
* Upgraded CodeMirror to v4 with support for Sublime keymap (https://github.com/thewhitespace/Xplore/pull/17)
* Added JSON formatting for properties which are native objects or arrays.
* Added form context menu item to open any record in Xplore.
* Fixed issue with breadcrumbs containing dots not being supported (https://github.com/thewhitespace/Xplore/pull/19)
* Fixed issue with error values when viewing Scoped GlideRecords.
* Fixed issue with using log method replacements not finding snd_Xplore in scopes.

### Version 4.5
* Fix inverted booleans.
* Fix support for jslog() in client mode.
* Added GlideRecord shortcut menu items to the List and Row system context menus (right click from list header or row).
* Added workaround for server logging methods gs.print, gs.log, gs.info, gs.debug, gs.warn and gs.error in Istanbul+.
* Added Refresh button to Script Includes list.
* Added Xplore system properties category and application module.
* Added property to prevent script execution in Production instances.
* Fixed issue with instantiated JavaScript classes throwing 'Method "toString" called on incompatible object.'

### Version 4.4
* Prevented 'getLine' exception from causing fatal error.
* Increased timer scope to include hours.
* Added ServiceNow build tag to the Xplore icon title.
* Fixed possibility of table hierarchy from failing because of matcher error.
* Updated application icon.

### Version 4.3
* Tested in Jakarta early-access.
* Fix issue using GlideScopedEvaluator in Helsinki patch 9a and Istanbul patch 4.
* Fix impersonation issue in Istanbul.
* Fix table search by label.
* Improve table search functionality and display.
* Dirty form alert! Reduces likelihood of accidental data loss.
* Added JSON prettify to User Data.
* User data can be automatically pre-processed so you don't need to convert from JSON/XML.
* Added new 'Quotes' setting to prevent strings from being wrapped with quotes. Means that prettify will work properly.
* Removed panels from info page and added contents links.
* Fixed illegal access to thread name (used for automatic node log parameter population) (H,I,J).
* Fixed illegal access to impersonating user name (H,I,J).

### Version 4.2
* Fix prototype error when looking at Java functions.
* Automatically blacklist illegal fields.
* Add prototype property to function explanations.
* Fix cross-origin target frame access issue.
* Add support for property driven default blacklist and redlist.
* Update info page.
* Prevent strings containing XML from being quoted so it formats better.
* Move timer to the header for better visibility and reference.
* Add code example to regular expression tester.
* Added format button to user_data for formatting XML.
* Fix submit button spinner.
* Add support for function prototypes.
* Added node log support.

### Version 4.1
* Released under version 4.2

### Version 4.0
* Fixed issue with running scoped code in Helsinki.
* Full refactor for script include and processor.
* snd_Xplore is now a script include class which works both server and client
  side. The browser and the server both use this script.
* Pretty print improvement - with intelligent value capture for GlideRecord and
  GlideElement types.
* Minor UI modifications.
* Added icon.

### Version 3.6 (G5.0.1)
* Feature: Output wrapping controlled by setting. Defaulted to wrap.
* Feature: New side pane: Script Include importer.
* UI: Improved Settings pane.
* UI: Made setting panes overlay script editor instead of shrink it.
* UI: Updated Share link so it doesn't point to an old version.
* UI: Added additional Table Hierarchy link.
* Fix: Set default wrapping for long text to match the checkbox setting.
* Fix: user_data object now works in scoped scripts on the source instance.
* Tested in Helsinki. Scoped exploration does not work.


### Version 3.5 (G3.0.3)
* Feature: Prettify code in output pane.
* Feature: Timer to show how long the transaction has been running.
* Feature: Default output pane message.
* Change: Show logs and output messages when a transaction is cancelled.
* Fix: Typos


### Version 3.4 (G3.0.2)
* Feature: Add cancel button to cancel long running transactions.
* Feature: Setting to allow output messages to escape HTML.
* Feature: Xplore will run while impersonating.
* Interface modifications.


### Version 3.3 (G3.0.1)
* Feature: Add User Data pane for working with large text strings e.g. XML
* Feature: Improve table hierarchy search with expression support, label support
  and a search button (just hit <ENTER> instead of waiting).
* Feature: Made the info page permanent, merged with side bar info, added new content.
* Feature: Added a settings side bar menu for supporting new show\_props and
  show\_strings options.
* Change: Log frame tab click reload now only occurs on double click.
* Fix: Fixed tab overlay issue when showing the side bar on smaller screens
  which caused the tabs to stack.
* Fix: Made the glasses injection script more robust.
* Removed: Original informational side bar.


### Version 3.2 (G1.0.2)
* Fix: Mac Ctrl + Enter keyboard command

### Version 3.1 (G1.0.1)
* Feature: Editor gets immediate focus on load.
* Feature: Use Ctrl + Enter to run.
* Feature: Improved string value display.
* Feature: UI Script to inject the Xplore glasses icon.
* Fix (Geneva): CodeMirror not displaying correctly in Geneva.
* Fix (Geneva): Scope selector not working correctly.
* Fix: Give editor focus when clicking demo link.
* Workaround (Geneva): Don't run valueOf on objects - restricted in Geneva.
* Improved welcome content.


### Version 3.0 (F7.3.3)
* Feature: Support for running scripts in application scopes.
* Feature: Support for tabs.
* Feature: Dynamic regular expression tester (tab).
* Feature: Dynamic table hierarchy viewer (tab).
* Feature: System log viewer (tab).
* Fix: better script running capability with enhanced error catching.
* Fix: UI improvements across the board.
* Feature: Welcome page with built in explainers and some script demos.
* Feature: Script editor toggle for full screen output mode.
* Fix (Geneva): Deactivated Fuji application module and replaced with Geneva
  friendly version (standard URL). Fuji users still have the choice and can
  just reactivate the old version if required.


### Version 2.1
* Fix: Script runner improvements
* Feature: Addition of application module
* Fix: JSON issues for versions before Fuji patch 7

### Version 2.0
* Feature: Convert to global application


### Version 1.1
* Script runner
* Help panel
* Output explorer
