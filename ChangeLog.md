# Blue
Copyright (c) 2001-2023 Steven Yi - All Rights Reserved

Email: stevenyi@gmail.com
Web: https://blue.kunstmusik.com

This program comes with ABSOLUTELY NO WARRANTY is licensed under the GNU Public
License. This is a free program and you are welcome to redistribute it under
certain conditions.  Please see the accompanying license.txt file for more
information.

# CHANGE LOG

## [2.9.0] - 2023-07-26

### NEW

* macOS and Windows builds now include embedded Java JDK

* MIDI Input Panel: Added AmpDBFS mode where amplitude is scaled to 0-1 range. 

### UPDATED 

* Removed JavaFX: BlueSynthBuilder and Effects remimplemented to Swing GUI 
  toolkit.

* Redesigned SoundObjectLibrary window: supports drag and drop reorganization, 
  additional popup menu options for editing and organization
   
* Issue #639: Added JMask to Pattern Layers

* JavaScript objects: Replaced Rhino processor with graal.js 

* Issue #625: Implemented resizing multiple selected objects and undo 
  functionality

* Issue #615: Implemented Looping option for AudioClips and allow resizing from
  sides beyond duration of audio clip when looping is enabled. 

* Issue #665: Implemented guidelines for start/end boundary of selected objects
  for easier visual alignment of objects when moving/resizing

* Issue #696: Added "Reset Line" popup menu option to BSB LineObject editors 

* Issue #697: Added Test Button to slide in right panel for previewing score 
  generation from object.

* PatternObject:

  * now defaults to time behavior Repeat.

  * Updated UI style
  
  * Fixed to save pattern when modifying number of beats. (Still clears if 
    number of subdivisions changes as there isn't a clear mapping.)

* Issue #703: Add ability to edit font for BSBGroup panel title label

* Issue #672: Reimplemented keyboard arrow movement of selected BSB Objects

* Issue #502: Implemented different velocities on Virtual Keyboard keys by 
  hitting different parts of the key (softer towards top, louder towards bottom)

* Issue #721: Double click marker to edit marker name


## [2.8.1] - 2020-12-29

### NEW

* Added "Open Example Project" menu option to File menu to make opening the
  examples easier

* Added new Time Behavior "Repeat" implementation and renamed older algorithm as
  "Repeat (Classic)" for backwards compatibility. New implementation will repeat 
  notes up to repeat point and truncate any notes that overlap boundary.  

* "Media Folder" property added to Project Properties: used for certain 
  operations to copy files into the media folder which should be a child of the 
  project root folder (or the root if the property is left empty).

* BSB File Widget: Added "Copy to Media Folder" shortcut in popup menu that will
  copy the selected file to the media folder and update the value to use the 
  version found in the media folder. 

* Implemented Copy audio files to media folder on import option in Project 
  Properties which will be performed when importing audio into Audio Layers 
  (via drag and drop), drag and drop onto soundObject layers, or changing audio
  file in AudioFile soundObject editor

* The Blue Manual is now managed as a separate github project and published 
  online at https://kunstmusik.github.io/blue-manual. Documentation help menu
  now opens the online site.

* Issue #497: Implemented comment fields for BSB widgets that appear as tooltips
  when in usage mode. Added "Show Widget Comments" menu option to View menu to  
  turn on and off showing of the comments in tooltips.

* PianoRoll:
  
  * implemented rendering of notes in object view on timeline

  * New user-defined fields for PianoRoll and and field editor for notes; fields
  allow adding additional pfield values for notes that are graphically edited 
  (similarly to how Velocity is handled in many MIDI-based DAW PianoRolls). 
  User can customize how many fields and kinds of fields to use for PianoRoll.

  * Introduced dark area in background to show repeat point or scaled time area
  for notes

  * added keyboard shortcuts for undo (ctrl-z), redo (ctrl-shift-z), toggle snap
  (alt-s), and select all notes (ctrl-a)

* Issue #520: Render waveform for Frozen SoundObject freeze file

* Issue #480: Option added for Score to follow current playback time when 
  rendering project

### UPDATED

* Issue #396: Updated how selected score objects are rendered; rather than all
  white, now uses white border, lighter derived background colors, and shows a 
  bar at top behind object label

* Issue #514: redid comments component for instrument editor and SSO to use 
  Netbeans editor component to enable code repository option

* Issue #392: made copy buffer shared between all BSB interface editors

* PianoRoll: note templates for notes are now set to use the PianoRoll's note 
  template by default but permit overriding on a note-by-note basis; backwards 
  compatible with prior note template system but more convenient given the new
  Field system. 

* Restored using Rhino JS interpreter as Nashorn was removed from Java 15

* Issue #532: Made zoom in/out buttons use a timer to repeatedly zoom when 
  button is down and stop zooming when mouse is up (Score Timeline, PianoRoll) 

* Issue #524: Implemented checkbox editor for NoteProcessor properties that are 
  true/false

* PianoRoll and Tracker: Time Behavior set to Repeat by default

* Tracker: "Steps per beat" property added to control start/duration generation;
  useful in conjunction with repeat behavior

* Issue #539: UX improvement to select newly added instrument in Orchestra 
  Manager

* Default SoundObject duration changed to 4 beats from 2

* Jython interpreter updated to 2.7.2

### FIX

* BSB: PresetManager dialog had bugs when dragging and dropping nodes around

* Clojure: Dependency resolution for clojars-hosted libraries was broken due to 
  using older http url; fixed by updating to https://repo.clojars.org

* Audio Layers: Audio Clips were not generating use project-relative paths when 
  audio files were children of project root folder

* Issue #523: Comments tab for instruments did not scroll correctly

* Issue #527: Fixed performance issue with drawing of PianoRoll canvas on Linux
  due to GradientPaint

* Issue #545: Hide global tempo editor when editing PolyObject timeline


## [2.8.0] - 2020-06-03

### NEW

* Score Timeline Shortcuts Added (active when timeline has focus)

  * SPACE - start/stop rendering of project
  * G - move to render start time (green line) (Issue #471)
  * Y - move to render end time (yellow line)  (issue #471)
  * Alt-S - toggle snap (Issue #492)
  * [ - navigate to previous marker (or start of project)
  * ] - navigate to next marker (or end of project)

### UPDATED

* Blue updated for Java 11. Built and tested against OpenJDK 11.  Users must
upgrade to Java 11 for 2.8.0.

* Clojure version updated to 1.10.1.

* Issue #449: New implementation Parameter Automation system to allow for better 
  translation and scaling of automation lines in both Single and Multi-line modes

* Implemented undoability for all edits in Single-line and Multi-line mode

* Issue #495: Commit name change for layers when focus lost

* Comment SoundObject bar renderer now respects Color value set in properties

* Issue #402: Added configuration option under General settings for maximum 
  number of temp files per directory (i.e., temp CSD files); minimum of 1, 
  default to 3

* Issue #399: Redid zooming on scrollwheel to zoom around mouse location

* Issue #281: Implemented importing of tempos (t-statements) from CSDs

* Issue #388: Automation: added alt-click to insert point at time position of 
  mouse but start y-value on current line. Moving is relative to the point's 
  initial y-value. Works in conjunction with ctrl-dragging to restrict value 
  change along one axis.

* Issue #507: Navigation to previous/next marker now scrolls score view to 
  location marker. Keyboard shortcut for [ and ] added. Will navigate to end 
  or beginning of score once past all markers.

### FIX

* Score: Selection marquee in single-line mode did not calculate y-position 
  correctly when multiple Score Layers were present

* Fixed automation panels losing their lines when window configuration changed 
  (e.g., opening/closing ScoreObject Properties)

* Fixed exception thrown when using AudioLayerGroups with ScoreNavigatorDialog

* Updated ScoreNavigatorDialog to fix issues with repainting, now updates as 
  score changes

* Fixed issue with multiple mixer strips being added to mixer for project that 
  is open on first load

* Fixed issue with multiple parameter options shown in popup menu in Single-Line
  mode for project that is open on first load

* Issue #427: BSB/Effects: Slider banks did not copy properties when cloned

* Issue #444: Fixed Sound SoundObjects not sounding when auditioning


## [2.7.4] - 2019-07-19

### UPDATED

* Issue #398: Updated Line Editors within program to use thicker lines and 
  circles for points

* Issue #397: Using control to shift points within selection in Single-Line mode
  should only shift points for currently selected line

* Automation: Single-line mode: Ctrl-drag to move selected points up/down was
  rewritten to add points at boundaries if necessary, also updated to only 
  operate on the currently selected line

* Issue #406: JMask: throw error when user attempts to use Constant p2 field 
  with value < 0.0 (prevents infinite loop)

* Issue #417: Use Csound ORC highlighting for "Generate CSD to Screen" and 
  "Generate Realtime CSD to Screen"

* Issue #431: implemented shortcut 1, 2, and 3 to switch between Score, 
  Single Line, and Multi-Line modes on the Score timeline

* Multiline Mode: Selection will default to only line data. Hold shift when 
  releasing mouse button during selection to include ScoreObjects for movment.

* Updated to Netbeans 11 Rich Client Platform

* Issue #441: For automation lines, clean up dead time points (those with same 
  time values as points surrounding them) for different line operations (e.g.,
  dragging points, pasting, dragging)

* Issue #501: BSB Sliders: Expose value field in property editor in edit mode

### FIX

* BlueSynthBuilder 
  * Horizontal and Vertical Slider Banks did not properly reconnect properties 
    from child sliders and slider bank when loading Blue projects from disk 
	* SliderBanks did not properly listen to individual slider value changes to 
	  update automation parameters and channel values
  * BSBDropdown
    * Issue #383 - Fix problems due to empty string being reloaded from file as
      null (compilation, editing item)
    * Fix JavaFX thread exception thrown when item editor dialog was closed 
      using [x] close button that is part of the window frame

* Fixed install-desktop-starter.sh: 
  * Generated .desktop file now uses "AudioVideo;Audio" category and script
  * Script now uses desktop-file-install program to install the .desktop file
    instead of copying blue.desktop to ~/Desktop location (which did not work
    on non-English systems)

* Issue #386 - NullPointerException thrown from SubChannelDropdownList 

* Fix ctrl/cmd-wheel-scroll shortcut for adjust layer heights

* Fix "All File" filter to show files that do not have extensions

* Issue #390 - Removed optimization in mixer code generation that removed signal
  paths that were considered dead when channel had -96 dB and no automations 

* Fix resizing of marquee when zooming (single-line and multi-line score modes)

* AudioLayers: Fixed generation of notes on Windows to use / instead of \

* Issue #406: Fixed movement of timeline when dragging selected objects

* Fix resizing of timeline on movement or resizing of Score Objects, whether by
  mouse or by ScoreObject Properties window

* Issue #401: Fix setting of default/last directory/file path for open/save
  file dialogs

* Issue #395: Fix initial showing of popup menu when number of items triggers 
  scroller buttons to show

* Issue #411: Fixed issue with having Single-Line mode selected and changing 
  projects causing bad state where score mouse handling no longer functioned 
  correctly

* Issue #412: Update marquee and selected ScoreObjects around newly pasted data
  in each Score Mode

* Issue #419: Fixed URL to use HTTPS to match server changes for BlueShare

* Issue #423: Fixed automation for Single Line mode with Audio Layers

* Score: Fix dragging of line points in single-line mode when snap is enabled to
  prevent snapping beyond previous and next points

* Mixer: Sends were not changing values at runtime nor generating correct signal
  multiplier amounts

* Issue #439: When pasting a BSB instrument as a Sound SoundObject, fixed 
  transfer of comments to Sound as well as inadvertent resetting of widget 
  values 

* Issue #443: Fix location of popup for UDO manager when selected item is 
  scrolled off screen

* Issue #416: Fixed incorrect insertion/sorting of Channel Strips into Mixer 
  panel when new instrument was added to the Orchestra arrangement. Also fixed
  incorrect listener updates when enabling/disabling automation parameters for a 
  layer or when automation source is removed (i.e., effect removed from mixer).

* Issue #445: Fixed issue where vertical dragging of points in Single-Line mode
  was selecting/inserting the wrong points when points existed at selection 
  boundaries


## [2.7.3] - 2017-12-15

### NEW

* BlueLive 
  
  * added new "Live Code" tab for live coding (ctrl-e evaluates selected code)

  * added definition of BLUE_LIVE orchestra and score macros that user can check
    with #ifdef to conditionally use code when rendering with Blue Live 


### UPDATED

* CSD Import: import CSDs that do not have CsInstruments or CsScore sections

* Issue #375 - Made Auditioning work with AudioClips on AudioLayers

### FIX

* Auditioning Frozen SoundObjects incorrectly calculated start/end times when
  considering object for rendering, resulting in object not playing 

* BlueSynthBuilder: 

  * On OSX, opening dropdown item editor was causing app freeze

  * Improved Interface loading times to prevent hanging when switching items 
    quickly

* UDO - After importing UDOs, table of UDOs did not get refreshed with new ones 

* Issue #376 - Fixed Automation Line switcher not showing for AudioLayers


## [2.7.2] - 2017-10-16

### NEW

* BlueSynthBuilder:

  * Knob - added Label, Label Font, and Label Enabled property. Label text is
  centered above knob in UI. Default is label to be shown, but older projects
  will load without label shown for backwards compatibility.

  * Ctrl-v keyboard shortcut will now paste copies of the last copied widgets 
  at an offset from the originals. 

* Issue #372 - Added note to documentation about Debian/Ubuntu Linux install
  instructions for JavaFX

* ObjectBuilder - Added JavaScript and Clojure language options; modified editor
  to use Combo Box to choose language(replaces "External" checkbox)

### UPDATED

* BlueSynthBuilder: Program now always rescales values when updating min/max 
  properties for UI elements (e.g., Knob, Slider). (Removes need for popup 
  dialog for every time user modifies min/max.)


### FIX

* Issue #368 - When double-clicking PolyObject in project SoundObject Library,
  Score editor now shows timeline of PolyObject and updates navigation bar

* Mixer: Right-clicking on subchannels to remove made easier by allowing 
  clicking on labels

* Code Editor: fixed errors and exceptions when choosing an auto-completion for
  opcode or BSBWidget name 

* Orchestra Manager - right-click popup menu for Project did not work unless one 
  instrument was added (would not allow right-clicking to paste instrument)


### INTERNAL

* Support for Csound 5 API removed


## [2.7.1] - 2017-09-24

### FIX

* BlueSynthBuilder - UI Editor would hang on OSX when setting Min/Max values on
  widgets due to JavaFX/Swing UI threads interactions; replaced Swing code to 
  with JFX code in affected areas


## [2.7.0] - 2017-09-22

### NEW

* BlueSynthBuilder:
  * GUI editor (shared by ObjectBuilder and Sound SoundObject) rewritten using
    JavaFX UI toolkit
  * Issue #344 - Ability to hide/show value display added to Knob, Sliders, and 
    SliderBanks
  * Issue #312 - Added Group widget that allows grouping of widgets into a
	panel that has a titled border around it for better organization of UI
  * Issue #360 - Visual resizing of widgets implemented with UI Editor using
    resize handles

* RhinoInstrument and RhinoObject were renamed as JavaScriptInstrument and
  JavaScriptObject

* JavaScriptObject now supports "Process on Load" option

* Issue #348 - Implemented Automation tab for Sound soundObject (allows 
  automating any widget within SoundObject interface; automation is edited 
  within Sound's editor window and scales to the duration of the Sound); also
  added Comments fields for Sound and ObjectBuilder objects

* Issue #342 - Program-wide User SoundObject Library
  * Implemented new Program-wide User SoundObject Library. Library is available
    as part of the SoundObjectLibrary window. User can use popup menu to copy
    and paste SoundObjects into folders and add/remove folders.

* Issue #343 - User-defined Opcodes: 
  * Export: User can now select single UDO from project UDO list and choose 
    export to either Blue UDO file (an XML representation of the UDO with 
    .blueUDO extension) or Csound UDO file (standard Csound UDO code in a file 
    with .udo extension)

  * Import: Removed older network-based Import system and added file-based UDO
    import from either Blue UDO (.blueUDO) files or Csound files (.udo, .csd, 
    .orc).  For Csound files, Blue will import all found UDOs within the file.

* Issue #354 - Added "Refresh Folder" popup menu option to refresh Blue File
  Manager folder node

* Issue #355 - Added default layer heights to Program Options->Project Defaults;
  added default layer height as property for AudioLayerGroups

* Issue #357 - Added maintenance of dialog size/location when Generating CSD to
  Screen

* examples/techniques/pvoc2.blue added that shows similar concept as pvoc.blue 
  but uses Sound soundObject and its new automation tab

* Issue #358 - SoundObjects can now be shared on BlueShare

### UPDATED

* Mixer:
  * Issue #256 - Pushing up or down effects should keep the same effect selected

  * Issue #257 - Select effect when right-clicking pre or post effects so that 
    popup menu reflects operation on where clicked 

* Renamed RhinoObject and RhinoInstrument to JavaScriptObject and
  JavaScriptInstrument to better reflect their purpose

* JavaScriptObject: for errors/exceptions, now shows error in dialog when 
  rendering project

* BSB widgets and Automation parameters that used resolution argument (i.e., 
  sliders) now use BigDecimal for more precise value generation and faster 
  calculation when automated

* Issue #349 - Revisited score text parsing to speed up; affects parsing of 
  things like GenericScore text, output from Externals (e.g., CMask scripts,
  AthenaCL code)

* Issue #350 - Added value display enabled property to BSBXYController

### FIX

* BlueSynthBuilder/ObjectBuilder/Effects - Fixed code completion for BSBWidgets 

* Mixer - using "Edit Effect" to edit the definition of an effect within the 
  mixer would cause an exception after closing the editor

* Reworked visual rendering and setting of BSB widget values when resolution
  property used

* BlueLive - fixed problem where BlueLive would send n copies of each note where
  n = number of times BlueLive was started/stopped (problem due to not clearing
  bindings between runs) 

* JMask - Probability: Beta editor was not showing when Beta generator selected

* Issue #352 - MIDI import was not updated correctly newer ScoreLayer system,
  also, velocity was not processed correctly yielding only zeros

* Issue #337 - Fixed Mixer generation when no instruments found in Orchestra; 
  condition appears when using only Sound SoundObjects in project

* Unfreezing Frozen SoundObjects caused stack overflow due to typo in code, 
  resulting in effect of disappearing SoundObject 

* "Custom" popup menu option that shows code repository options did not function
  correctly 

* Fixed Code Repository Dialog to ensure it is in sync with repository changes.
  Also fixed drag/drop when editing repository within dialog.

* Issue #345 - Parsing output from nGen revealed issue with parsing score 
  statements that were not i- or comments (notes would repeat)

* Automation menu for selecting which parameter to automated did not always size 
  width correctly

### INTERNAL

* Replaced use of Cloneable and Serializable with copy constructors and new 
  DeepCopyable interface for all project data models

* Replaced all uses of float with double


## [2.6.1] - 2016-08-30

### NEW

* Issue #292: added open file handling for Windows and Linux. (Was unable to get 
  it working with OSX unfortunately.) On Windows and Linux, users can 
  right-click on a .blue document and configure Blue to open the file.  Once the
  association is made, users can double-click .blue files to open them in Blue.

* Issue #55: Resize Soundobjects from left-side to adjust start and duration.
  (This was implemented in 2.6.0 as part of Score internal redesign work but the
  issue was not seen until after release.) 

* ProjectPlugins - new plugin system for Project-level editors that can save 
  data with Blue project and can participate in the project lifecycle.  

* Clojure Project Plugin - project-level plugin that adds a new Clojure tab to
  the Project Properties editor and allows setting Clojure library dependencies. 
  Uses Chas Emerick's Pomegranate plugin to download direct and transitive 
  dependencies from Clojars or Maven Central. Useful for using libraries within
  Blue projects. Libraries are set using coordinates and version strings, much 
  as one would with Leiningen-based projects. For example, one may use: 

  kunstmusik/score 0.3.0

  to use my Score library for generating and processing note lists.  

* Issue #148 - Clojure REPL - new Clojure REPL window tied into the synthesized
  namespace created for each project.  User can test and diagnose code that has
  been entered into the namespace (e.g., if a function is defined in a 
  ClojureObject, one can test it from the REPL)

* Issue #309: Added 'alsaseq' driver to list of options in Blue's Realtime 
  Render Settings and added input/output discovery code. 

* Added Steven Yi's "Transit" to the examples/pieces/stevenYi folder

* Issue #331 - Added Cut and Copy actions to popup for PianoRoll when 
  right-clicking selected notes; added Paste menu when right-clicking on 
  canvas and notes exist in the copy buffer

* Issue #272 - Added a confirmation dialog when deleting UserInstrumentLibrary 
  folder

### UPDATED

* Updated included Clojure version to 1.8.0

* Issue #149 - implemented cut/copy/paste for PianoRoll for multiple notes, as
  well as shared copy buffer to allow pasting copy/pasting between PianoRolls

* Issue #322 - pressing ctrl when moving mouse points will limit point 
  modification only to the initial direction for line edit panels (i.e, 
  automations, tempo, etc.).

* Automation Parameters - Single-Line Mode Editing Updates
  * When the selection marquee is shown, holding down ctrl when press/dragging 
    will allow modifying just the horizontal locations of the points 
  * When marquee is selected, left-clicking outside the marquee will disable the
    marquee as before, but will not also add an additional point
  * fixed issue when right-clicking a point to delete it that the popup menu
    would also appear

### FIX

* Adding new AudioLayerGroups did not properly handle change listening, 
  resulting in NullPointerExceptions when trying to automate parameters on new 
  AudioLayers added to a project.  (This problem only occurred when the 
  AudioLayerGroup and AudioLayer was first added and did not present when 
  loading an existing project or switching to another project and back again.)  

* Issue #332 - "All" file filter did not properly allow all files

* Issue #324 - (Potentially) fixed intermittent look and feel issue where 
  sometimes tabs were not styled correctly

* Issue #248 - partial fix to respect Automations when auditioning SoundObjects.
  Auditioning is guaranteed only to work correctly with top-level SoundObjects.
  (Issue #333 filed to continue looking into this once Blue 3.0 internal changes
  are in place.)


## [2.6.0] - 2016-07-29

### NEW

* AudioLayers: Initial release. New LayerGroup type for working with AudioFiles 
  strictly by GUI. Each Audio Layer is bound to a mixer channel. Use is modeled
  after common DAW idioms for working with audio clips.  

* Added link to Csound FLOSS Manual from Help Menu

* Added seed value and useSeed to RandomAddProcessor and RandomMultiplyProcessor
  [issue #302]

* Issue #313 - added Test button to PianoRoll

* Issue #279 - added "Render to Disk and Open" action; will use command 
  configured in program options for disk render to open the rendered file after
  rendering (e.g., render and open with Audacity)

* BlueSynthBuilder: added new BSBValue object that has a default value and may
  be automated; the widget only appears during edit mode and is hidden during
  performance mode

### UPDATED

* Sound - modified to use BlueSynthBuilder object as backing instrument. Extends 
  single-use instrument idea of previous Sound object to work with an interface 
  modifiable in realtime, similar to Kyma-style objects.

* Added "Paste BSB as Sound" action to score timeline popup menu to paste a BSB
  Object from the copy buffer into the Score as a Sound soundObject

* BlueSynthBuilder - Replaced Knob with new style implemented with JavaFX

* Moved to using Java 8. NOTE: Java 8 JDK or JRE is now required for running 
  Blue.

* restored loading of all URLs to external browser now that Netbeans 7.4 IDE 
  cluster removed dependency on debugger module

* Made using trackpad or scroll wheel on layer panels (left-hand side) scroll  
  both the layer panels and the main content areas (implemented in main Score
  editor, PatternsObject editor) 

* Modified URL that is opened for "Report a Bug" and "Request a Feature" links
  from the Help menu to go to the issue tracker at GitHub 
  (http://www.github.com/kunstmusik/blue/issues)

* Mixer: 

  * Reworked layout of channel panels to be more compact

  * Double-click to edit ChannelList names as well as Channel names (for those
  channels and lists that support it)

  * Updated mixer generation code to use "+=" and "\*=" for easier to read 
  output and better performance when running Csound multicore

* Changed "Tools->.csoundrc Editor" to "Tools->.csound6rc Editor", to edit 
  .csound6rc instead of older .csoundrc

* Added /usr/local/lib and /usr/lib to java.library.path for Linux [issue #304]

* Issue #287 - added name of effect in generated CSD as part of generated UDO
  for effect

* Added MenuScroller for Automation menus (MenuScroller by Daryll Burke:
  https://tips4java.wordpress.com/2009/02/01/menu-scroller/)

### FIX

* Redid font/theme handling so that --fontsize flag is respected (can be given
  at commandline or put into blue/etc/blue.conf)

* Fixed issue where after adding a new layer to a LayerGroup, if multiple empty
  layers existed, the new layer would not function properly to show score object
  changes 

* Prevent resizing of Score Objects from left-hand side to have 0 duration when
  snap is enabled

* Issue #250 - setting minimum and maximum for BSB Knobs did not update the knob
  view location when using truncate option

* Audited score timeline actions for undoability

* Issue #258 - fixed "Follow the Leader" ScoreObject action

* Issue #280 - Print out command line used to Output window when rendering to 
  disk 

* Rendering to disk with commandline runner would freeze up until process 
  completed when render job canceled, instead of stopping render job

* Issue #249 - Fixed editing of last automation and tempo point in popup "Edit
  Points" dialog

* Issue #259 - Fixed forwarding of key events from Effects dialogs to main 
  window, so users can now us shortcuts for rendering and other menu shortcuts
  while editing effects

* Issue #270 - User Instrument Library and Arrangement Panel should share the 
  same copy buffer for copying/pasting instruments between the two panels

* Issue #285 - Generating Realtime CSD to Screen did not correctly set if API
  version of CSD should be generated or not  

* Issue #273 - Dragging instrument from library to project should copy, not move

* Issue #306 - Fixed BSB interface not updating after setting values from preset

* Automations - adjusted menu to show "More..." sub-menus when there are more 
  automations available than can fit on the screen

* When generating instruments that use <INSTR_ID> or <INSTR_NAME>, fixed that 
  generated always-on instruments use the ID/name of the original instrument 
  rather than the generated one 

* Redid BlueLive trigger mechanism to use sample-accurate, synchronous 
  processing of time for repeats to remove jitter

* Windows: Fixed trackpad scrolling 

* Fixed BSB parameter var name generation when project has >= 1000 params

* Issue #267 - reset BSB Object property sheet when setting automation enabled
  is cancelled

* Issue #255 - fixed Automatable BSB objects that did not update parameters 
  correctly when objectName was changed

* Issue #251 - fixed issue where copy/pasted BSBFileSelector would not update
  correctly within Csound even though UI was updating

### INTERNAL

* Changed Blue plugin registration to use Annotations (@SoundObjectPlugin, 
  @InstrumentPlugin, @NoteProcessorPlugin)

* Refactored all ScoreTimeline actions into separate Action classes; shortcut 
  registration now done declaratively 


## [2.5.14] - 2014-05-13

### FIX

* Note parsing failed when a comment was the last item in a score block

* Time pointer was not showing when using Commandline runner


## [2.5.13] - 2014-04-21

### FIX

* Generating a CSD or rendering to disk was not using the correct CSD
generator, causing automations not to be rendered.


## [2.5.12] 2014-04-11

### FIX

* Freezing SoundObjects was using the wrong settings (realtime settings);
fixed to use disk render settings


## [2.5.11] - 2014-04-10

### UPDATED/FIX

* Rewrote score parser for much better speed and greatly reduced memory 
  requirements

* Replaced score expression evaluator with exp4j for better performance

### FIX

* When using the Csound API, set --env:SFDIR=/path/to/csd so that things like
fout will write output relative to the directory where the .blue/.csd is used


## [2.5.10] - 2014-02-11

### NEW

* Added BlueLive sub-menu to the Project menu to have menu options in addition
  to the Toolbar 

### FIX

* Bug #87/94: Automations were not getting cleared correctly from the timeline 
  when disabled in a BSB Widget due to bad index code


## [2.5.9] - 2014-01-21

### FIX

* Fixed score generation error due to GridStyle not being marked as Serializable


## [2.5.8] - 2014-01-16

### NEW

* RFE #127: Added sub-menu to text editor popups for orc editing for "Blue 
  Opcodes" that has entries for "blueMixerOut", "blueMixerOut (SubChannel)", and
  "blueMixerIn"

* RFE #88: BlueSynthBuilder: added new grid settings to set grid width, height,
  style (None, Dot, Line), and snap enabled. For projects before 2.5.8, older
  behavior is preserved and will default to style None and snap disabled.

* Examples: 
 
  * soundsObjects/external_ngen1a.blue, soundsObjects/external_ngen1b.blue: 
	  Example of using nGen from Blue (contributed by Menno Knevel)

  * Updated AthenaCL examples in soundObjects folder 
    (contributed by Menno Knevel)

### UPDATED

* BlueSynthBuilder: small optimization: if last object that was being edited is 
  the same as the one being requested to edit, don't bother clearing the 
  interface

* BlueSynthBuilder: Added use of Backspace to delete items in addition the 
  previous delete key option

### FIX

* Bug #92: Fixed setting of note pitch value to before setting of start time 
  when updating note values on mouse release

* BlueSynthBuilder: On Mac OSX, made paste shortcut use cmd-click instead of 
  ctrl-click, as ctrl-click is used by the OS as an alias for right-clicking

### DOCUMENTATION

* BlueSynthBuilder: Added information about Grid Settings, always-on instrument
  code, updated images

* JMask: updated screenshots, added information about editing field names

* Added some basic information about the Code Editor to new "Code Editor" 
  section under "Tools"


## [2.5.7] - 2014-01-09

### UPDATED

* RFE #150: Jmask: Updated UI, moved bar from left hand side to top top for 
  parameters, added ability to set the name for the parameter by double clicking 
  the bar, added default values for p1, p2, and p3 as "Instrument ID", "Start", 
  and "Duration"

* Updated opcode definitions with latest from Csound Manual (includes things
  like pvstanal, array opcode section, etc.)

### FIX

* Bug #89: Commandline Runner when rendering to disk was adding "-L stdin", 
  causing the Blue render to hang on Windows; now removed for all platforms as
  input is unnecessary when rendering to disk 

* Bug #91: Modified Locale default for formatting of numbers to use English 
  formatting (i.e. always use decimal instead of comma).  This affects things 
  like Spinner components, and the change should make number formatting uniform
  across Blue, matching Csound's number format


## [2.5.6] - 2013-12-18

### FIX

* Bug #90: code for Freezing SoundObjects did not properly create commandline
  arguments to run

 
## [2.5.5] - 2013-12-05

### FIX

* Bug #88: fixed Csound Crash when rendering to disk with Csound 6 API


## [2.5.4] - 2013-11-28

### UPDATED

* Updated to Netbeans RCP 7.4

### FIX

* issue with BlueLive toolbar not showing if hidden when Blue closed in previous
  run 

* Show error message balloon if unable to run Commandline Runner for better 
  information for the user


## [2.5.3] - 2013-09-21

### NEW

* Under Project menu, added option to "Generate Realtime CSD to Screen" that 
  shows what the CSD contains for realtime rendering; user can modify shortcuts
  under program options to add a keyboard shortcut  

### FIX

* Pasting PolyObjects that contain Instance SoundObjects where the source object
  was removed from the SoundObject Library would cause orphan Instance objects
  to be pasted in; redid paste logic so that SoundObjects pointed to from 
  pasted Instances, including those within PolyObjects, are re-added to the 
  SoundObject Library 


## [2.5.2] - 2013-08-22

### FIXES

* Fixed issue when opening HTML documents that they were using an internal web
browser instead of the default system browser
 

## [2.5.1] - 2013-08-19

### FIXES

* Updated Audio I/O and Midi I/O Device detection in Realtime Render Settings
Panel to work with both Csound 5 and Csound 6


## [2.5.0] - 2013-08-12

### NEW

* Java 7 now required for Blue (Netbeans RCP library that Blue uses has 
  updated to it)

* Render service system reimplemented:
  
  * Added support for Csound6 API.  If Csound6 is found, user gets option for
    CS6 or Commandline.  If CS6 is not found, Blue will check if CS5 is 
    available. If it is, user will get that option, or only have option for 
    Commandline runner. Additionally, user can add -J-DDISABLE_CSOUND6=true in
    blue/etc/blue.conf to disable CS6 API usage and allow CS5 option.

  * Service selection is now done in Program Options under Realtime and Disk
    Render settings.  

  * The "Use API" button has been removed from the application menu and General
    Settings. 

  * Bug #82 (issue with auditioning causing crashes) should now be fixed

  * Manual entries updated for Installation and Program Options
 
* Added Steven Yi's "TimeSphere" to the examples/pieces/stevenYi folder

### FIX

* SoundObject Library: When removing a library item, dialog now asks users to 
  confirm action.  If confirmed, all Instances of the SoundObject will be 
  removed from the Score and SoundObjectLibrary.

* On Mac, fixed default csound command for Utility and DiskRender settings to be
  "/usr/local/bin/csound" instead of "csound"

* UDO Import Dialog for importing from UDO Repository on Csounds.com was 
  throwing a NullPointerException when opened from a Dialog (i.e. Effects
  Library Dialog)

* Bug #84 - Fixed Zak LineObject to allow using 0 for channel

 
## [2.4.3] - 2013-04-05

### FIX

* Ignore orphan Instance objects that are found in the SoundObjectLibrary when
  loading projects; Blue should have prevented this situation from occurring in
  the first place, but this fix is here in case older Blue versions saved 
  projects incorrectly


## [2.4.2] - 2013-03-22

### FIX

* Clojure Piano Phase Example: Switched to using note format of %g instead of 
  %f, as %f will use Locale-specific float formatting (i.e. in French, 1.00 
  would be 1,00), while %g uses "computerized scientific notation or decimal 
  format, depending on the precision and the value after rounding" (from 
  documentation for java.util.Formatter)

* Default background color for output window was white instead of black

* Program Settings were not saving/loading correctly and could overwrite each
  other (i.e. sr, ksmps, etc. could get overwritten between disk and realtime
  settings)


## [2.4.1] - 2013-03-20

### NEW

* Added external_AthenaCL4.blue example to blue/examples/soundObjects folder; 
  contributed by Menno Knevel

* Added Dave Seidel's piece "Triune" to blue/examples/pieces/daveSeidel folder

* ClojureObject: can now load clj scripts from $HOME/.blue/script/clojure and 
  $PROJECT_DIR/script/clojure

### UPDATED

* Updated Clojure library to 1.5.1

### FIX

* RFE #139: Cleanup dummyXXX.csd and temp.wav that was generated by Blue after
  startup (CsoundAPIWarmupTask)

* BUG #77: Modified JACK Input/Output detection in Program Options for Realtime
  Render settings; better settings when using Csound to detect, also added a 
  fallback mechanism to use jack_lsp to list ports and parse from there


## [2.4.0] - 2013-02-05

### NEW

* ClojureObject - SoundObject that uses Clojure (http://www.clojure.org) code
  for generating notes
     
  * Clojure 1.4.0 is embedded with blue so that user does not have to install 
    Clojure themselves, as well as guarantees code to run on every platform

  * Editor has Syntax Highlighting and Parentheses/brace matching

  * Script menu option added to Reinitialize Clojure engine

  * clojureSoundObject.blue added to blue/examples/soundObject

  * clojure-piano-phase.blue added to blue/examples/general; this is a 
    translation of reich.cm from Common Music 2.10.0 by Heinrich Taube that 
    demonstrates phase technique

* RFE #137 - added temp file check when opening projects that searches for 
  leftover tempCsd\*.csd files from previous blue sessions (usually only happens
  if blue/csound has crashed).  Offers to delete the temp files after opening,
  also checks if another project in the same folder is currently open and skips
  temp file check

* Added three examples of using AthenaCL with Blue to blue/examples/soundObjects
  folder (external_AthenaCL1.blue, etc.); contributed by Menno Knevel

### NEW/FIX

* Bug #80/81: Optimized ScoreNavigatorView: introduced new paintNavigatorView
  to LayerGroupPanels so that they could paint a simplified view for the 
  Score Navigator; fixes broken painting and improves issues with time pointer
  rendering triggering frequent paints in the navigator view

### FIX

* code completion for BSB Widgets would replace all code after cursor location 
  or up until ")" if found, fixed to behave as Csound ORC completion does


## [2.3.3] - 2012-12-19

### UPDATED

* Code Completion: for documentation window, implemented link handling and open 
  documentation in browser button

* Updated code generation when using API: use chnexport instead of chnget as it
  is more efficient

* Made all scrollpanes respond to horizontal scrolling on trackpads (includes
  documentation popup window in code completion)

### FIX

* Bug #74 - fixed issues with layer edit panels losing ability to function

* Bug #75 - restored ctrl-; and ctrl-shift-; shortcuts for Csound Score text 
  editors


## [2.3.2] - 2012-12-16

### FIX

* Editors would lose ability to use code completion after leaving and coming 
  back to Editor

* Code completion items did not parser opcodes.xml correctly, resulting in
  incomplete signature completions and missing entries

* modified code in Brian Wong's "Falltan" and "Tritium Tea", as well as Dave
  Seidel's "Palimpsest" to work with Csound new parser


## [2.3.1] - 2012-12-12

### NEW/UPDATED

* Replaced existing code editor with one based on Netbeans Editor Library

  * Editor provides much nicer code completion and opcode documentation shows
  in the application (Csound Manual now included with blue)

  * Fonts and Colors for code editor are configurable, as well as many other 
    settings (i.e. tab size, spaces to insert for soft tabs), settings available 
    in ProgramOptions

  * Text can be zoomed in using alt+mouse scrolling

  * Csound Orc Code
     
    * All Code Completion is now done through ctrl-space (cmd-space on Mac); 
    this includes opcode completion, variable name matches, and BSB Widget names

    * Code Editors that have been replaced: GenericScore, BlueSynthBuilder, 
    Effects Editor, User-Defined Opcode Editor, Global Orchestra (incl. tabs 
    within instrument editors)

  * Csound Score Code
    
    * Code Editors that have been replaced: Global Score (incl. tabs within 
    instrument editors), GenericScore

  * Python Code

    * Code Editors that have been replaced: PythonObject, Python Instrument

  * Javascript Code

    * Code Editors that have been replaced: RhinoObject, Rhino Instrument

### UPDATED

* Now packaging Csound Manual together with blue, for use with new editor's 
  code completion to show opcode information while coding

* Removed Csound Manual Documentation Root option in Program Options

* Removed old text color settings panel

* Removed Help button on main toolbar as it was redundant to Csound Manual 
  options in Help Menu

### FIX

* Render time pointer was being rendered when switching projects for the 
  projects that were not the currently rendering project

* When rendering with API, automation values were always starting from time 0;
  adjusted current time calculation

* Bug 3591867 - Fixed issue with JMask Segment modifying its points after each
  render

* Fixed intermittent issue with layer operations on Score; moved execution of 
  Process on Load SoundObjects to separate thread when loading to prevent 
  long-running operation on Swing dispatch thread


## [2.3.0] - 2012-11-14

### NEW

* Modular Timeline: 
  
  * Layer Groups are now modular (plug-ins)

  * New LayerGroups: SoundObject (based on previous Score system), Pattern

  * (Please read manual entry for Score, sub-section Layer Groups for more 
  information)

  * patternsLayerGroupExample.blue added to examples/general

* Added "Search Csound Manual" option in Help menu to allow searching online
  Csound Manual using search terms (i.e. "guard point"); uses Google search

* New Python Console window, allows console-interaction with current python code
  for inspection and experimentation

* Added Steven Yi's "The Living Ocean" to the examples/pieces/stevenYi folder

* Python: for Orchestra Library, added possibility to pass in either noteList or
  function that will generate a noteList(partials work too) to PerformerGroup's
  perform method.  If a noteList is passed in, that same list will get 
  distributed to each Performer to perform. If a function or partial is passed
  in, it will be called to generate a new noteList for each Performer to 
  perform.  Note: the function or partial should be a no-arg method, so use of
  partials (from functools) is useful here to fix args before passing in a 
  function.

* Python: PMask, added FuncGen and CombiGen Generators (in pmask/generator.py),
  useful for mixing in functional-style work with Generators.  From 
  py doc for the classes:

  * FuncGen: Generator that acceptors one generator and one single-arg function. 
    Evaluation will call the passed-in generator, then apply the function to the 
    generator. Useful with lambdas and partials for the passed in function.
  
  * CombiGen: Generator that acceptors two generators and one two-arg function. 
    Evaluation will call valueAt on the two generators, then pass the results to 
    the two-arg function for further processing. Useful with lambdas and 
    partials for the passed in function.

* VirtualKeyboard: added keyboard shortcuts when keyboard is in focus:

    * up/down: increment or decrement octave
    * shift-up/shift-down: increment or decrement channel
  
* Debian/Ubuntu: blue starter script in blue/bin is now pre-setup to use the API 
  when Csound is installed through apt-get

### UPDATED

* Updated to Jython 2.5.3

* Modified UserDefinedOpcode List tables:
  
  * allow selection of multiple UDO's for copying and pasting

  * can now copy UDO Categories from the UDO Library manager and paste into list
  tables; all UDO's from that category and subcategory will be pasted into the 
  target table (useful for keeping a group of UDO's together to paste into new
  instruments)

* can now drag and drop UDO Category from the UDO Library to a UDO Table

* SoundObjectProperties Window: 
  
  * When editing SoundObject name, now updates as you type

  * When SoundObjectProperties windows becomes focused (selecting the window, 
  pressing F3, using window menu), name textfield requests focus; makes it 
  easier to edit SoundObjectName or tab down to other fields

* Manual: 

  * closed the online Wiki and migrated back to using Docbook

  * release once again includes HTML and PDF versions of the manual 
  (located in blue/manual folder or blue.app/manual)

  * Blue Manual link from Help menu points to HTML version of manual

### FIX

* Auditioning SoundObjects would cause a crash of program due to unnecessary 
  deleting of Csound Object

* Command-line compiling option for compiling .blue to CSD files was always 
  reporting exit code 1 and error, even when compile was done correctly

* Using "Paste" and "Paste as PolyObject" were incorrectly pasting soundObjects
  using the x-coordinate as the time value, i.e. instead of pasting at time 4 
  it might paste at time 80 if it was 20 pixels per second

* CommandlineRunner - modified how commandline runner stops Csound to prevent
  hanging csound processes on Linux

* UDO - When dragging from the library to a UDO list table, was allowing move
  option, when it should only allow copying

* when creating new UDO's, name now defaults to "newOpcode" rather than 
  "New Opcode", as the latter is not a valid UDO name

* BSB - When API is not enabled, BSBDropdown should still generate with index
  value instead of dropdown item's value if automation is set to enabled

* when opening projects that had temp files, do not add the temp file to the 
  recent projects list

* TrackerObject

  * made shortcut for ctrl-space and ctrl-shift-space also use control instead 
  of command key on OSX to avoid issue with spotlight shortcut

  * fixed track editor sizing

  * fixed issue with OFF notes being editable, causing issues with not allowing
  moving past those notes with arrow keys. OFF notes can now only be cleared
  with ctrl-shift-space or a new note entered by using keyboard shortcut keys

  * changed backspace shortcut to shift-backspace, due to interfering when 
  editing values

### INTERNAL

* replaced passing of SoundObjectLibrary when saving/loading, now uses 
  Map\<String, Object\> on load and Map\<Object,String\> on save, where object is
  a SoundObject and String is a uniqueId; make saving/loading generic and 
  removes dependency on SoundObjectLibrary


## [2.2.2] - 2012-04-03

### NEW

* BSBFileSelector: 

  * Accepts dragging and dropping a file from filesystem onto the
    textfield porting of the FileSelector

  * Added property "stringChannelEnabled" that replaces the object name with a
    gS_blue_strX variable instead of static text replacement; when enabled,
    blue generates the string variable as well as uses a string channel to allow
    live modification of the string when the API is enabled; useful for things 
    like switching what sample to use in sample player instrument; by default,
    the property is enabled, but legacy projects will correctly read in as 
    disabled

* blueLive: 

  * added ctrl-c/ctrl-v (cmd-c/cmd-v on OSX) for copying/pasting SoundObjects in
    the SoundObject bins

  * added LiveObject Sets List: 
        * save sets of enabled LiveObjects by using + button
        * Rename Set by using popup menu
        * Use - button to remove a set
        * Use ^/V buttons to push up and push down
        * Rollover a set to see what items are Enabled for that set (highlights
          in LiveObject table)

### UPDATED

* blueLive: leave repeat on even if blueLive turns off or recompiles; useful if
  recompiling often

### FIX

* Snap on PianoRoll did not work correctly note resizing

* Recoded mouse handling on ScoreTimeline to consistently use time values 
  internally, fixes issues when snap enabled

* Nudging SoundObjects with arrow keys did not nudge enclosed automations


## [2.2.1] - 2012-03-07

### UPDATED

* blueLive:
  
  * when a SoundObject is selected and also enabled, made color render as 
    brighter orange color to differentiate from non-selected enabled objects

  * fixed saving/loading of repeat and tempo settings

  * update name of SoundObject in bins when updated from SoundObject Properties
    Window

* SoundObject Property Window: setting repeat point with enter key shows value
  reformatted as float

* Added blueIcon.png to bin folder in zip release, for use on Linux

### FIX

* Auditioning of SoundObjects was not working due to serialization bug

* Score: Fixed Snap (rendering in timeline, time bar, dragging soundObjects, 
  resizing soundObjects)

* PianoRoll: Fixed Snap (rendering in timeline, time bar, dragging of notes,
  resizing of notes)


## [2.2.0] - 2012-03-03

### UPDATED

* Modified UDO Editor to have In Types, Out Types, and Test button on single 
  line 

* blueLive: 

  * moved from List of SoundObjects to table with bins (columns and rows added
    from popup menu, accesible by right-click)

  * double-clicking SoundObject toggles enabled state (orange color)

  * trigger button sends score events from enabled SoundObjects

  * tempo will be applied before score events sent to Csound, for example, using
    tempo 120, score "i1 0 2" will be sent as "i1 0 1" 

  * repeat button will repeat trigger every n-number of beats, as specified by
    user

  * careful attention should be made while editing SoundObjects in case a repeat
    trigger fires and the score is not quite valid; can cause unpredictable and
    very loud results due to typos!

  * Ctrl-T (on Mac, Cmd-T): Triggers currently selected SoundObject (whether 
    enabled or not)
  
  * Ctrl-Shift-T(on Mac, Cmd-Shift-T): Triggers currently enabled SoundObjects,
    same as using the trigger button

* csLADSPA removed from Project Properties

### FIX

* Upgrade code for 2.1.10 caused incorrect loading of projects that have data 
  in Global Orchestra (newlines were getting removed)

* Bug 3495199 - Added scrollpanes to panels within Project Properties to 
  facilitate resizing


## [2.1.10] - 2012-02-27

### NEW

* New 0dbfs field in project properties for Disk and Realtime render settings;
  Checkbox enables if 0dbfs will be used. If older projects are found that have
  0dbfs set in their Global Orchestra, it will be parsed and the field set in 
  the project, and the old line removed from Global Orchestra.  Program settings
  added to set defaults for projects (if using 0dbfs and what default value). 

* Added Brian Wong's "Syzygyr" piece to the examples/pieces/brianWong folder

* Added Dave Seidel's "Drift Study III" and "Ansible Cathedral" pieces to the 
  examples/pieces/daveSeidel folder

* Added Csound API Warmup Task to prevent first time load pause when rendering

* Added Full Screen support on Mac OSX Lion 

* Added "Disable Displays" option to Realtime and Disk render program options,
  defaults to true; adds "-d" to commandline used when rendering project

* Reinstated printing of commandline used when rendering, now outputs to Output
  Window of render

### UPDATED

* Worked on updating look and feel

* RFE 3473214: Made Text fields that show values in BSB HSlider and VSlider
  clickable and editable, as found previous in BSBKnob.  Applies to HSliderBank
  and VSliderBank as well.

### INTERNAL

* modified to use CsoundMYFLTArray instead of Csound.SetChannel() to optimize
  setting channel values (avoid cost of ptr lookup by name on each change)

* removed use of Rhino Javascript interpreter and instead use Java 6's scripting
  engine and built-in Javascript interpreter (removes a dependency and saves 
  size)


## [2.1.9] - 2011-11-28

### FIX

* Render Time Pointer code changes were not properly account for tempo and 
  t-statements


## [2.1.8] - 2011-11-19

### UPDATED

* Render Time Pointer Animation code redesigned for smoother playback, made 
  default Playback Setting option for Frames Per Second default to 24 fps

* OSX - Removed use of -D32 flag when running blue, now will default to whatever
  version of Java the user has set by default (64-bit, 32-bit) 

* BSB - Made Checkboxes Automatable [RFE 3419780]


### FIX

* OSX - Opening sub-popup menus would cause an exception to be thrown, caused by
  changes in 2.1.7 to get the System Menu Bar working in blue 


## [2.1.7] - 2011-11-05

### NEW

* Added Help menu link for "blue/Csound IRC Chat" that will open up the Freenode
  webchat webpage to chat in #bluecsound and #csound channels for help

* Added ability to double click split pane dividers within windows to minimize
  the divider to the far left or right (or up/down), depending on which side it
  is closest to; i.e. double-click to minimize the project instrument list and
  instrument library to maximize the space for the Instrument Editor interface

* OSX: Made Look and Feel work with System Menu Bar

* Added Dave Seidel's "Cloud Study" pieces to the examples/pieces/daveSeidel 
  folder

### UPDATED

* Updated opcodes.xml to use latest from 5.14 manual

### FIX

* Extra render time from mixer was being added twice to the total duration when
  creating note for Mixer instrument

* Instantiating BSB instruments that previously did not have Always-On Text 
  could cause exceptions when rendering

* BSB Interface editor would nudge selected objects after edit enabled turned 
  off (Bug #3424474)

* BlueLive: Recompile button would get a hung dialog if the code that changed 
  caused a compilation error by Csound


## [2.1.6] - 2011-09-29

### NEW

* Added ctrl-shift-w (cmd-shift-w) shortcut to close the current project

* Added .csoundrc Editor to the tools menu, will open file pointed to by 
  CSOUNDRC environment variable, or if not defined will use $HOME/.csoundrc

### FIXES

* If no parameters are used, no longer generate a parameter instrument; fixes
  scenario when user is using just global orc/sco to not generate an instr with
  an overlapping instr number

* blueLive MIDI generated notes using bare note number instead of padded number,
  i.e. "i1.1" instead of "i1.001".  Not padding caused a possible clash if 
  fractional value collided, i.e. "i1.1", "i1.10", and "i1.100" would clash with
  each other


## [2.1.5] - 2011-09-22

### NEW

* Add setting of font size in Text Settings section of program options, renamed 
  "Text Colors" to    "Text Settings" in options RFE 3371772

* Added Brian Wong's "Falltan" to examples/pieces/brianWong

* Double-clicking SoundObject on timeline (except polyObject) now opens and 
  focuses SoundObject editor (useful if editor is docked andset to sliding to 
  pop open the editor)

* Implemented blueLive Recompile button   

### UPDATED

* Modified scroll wheel/trackpad handling on score timeline to work better with 
  trackpads; horizontal/vertial trackpad motion will do scrolling, holding down 
  alt- will increase/decrease horizontal zoom, holding down ctrl- (or cmd- on 
  Mac) will increase/decrease vertical zoom

* Made PortAudio blocking interface (pa\_bl) the default audio driver on OSX as 
  "PortAudio" and "pa\_cb" uses the callback interface which has caused crashes

* Changed blue Manual link to point to blue wiki

### FIX

* Restored use of ctrl-z/ctrl-shift-z to undo/redo operations on the score 
  timeline

* BSB - fixed rounding error when setting value in Sliders

* Stabilized blue and Csound API usage by clearing MessageCallback and HostData 
  before calling Reset

* Made backspace as well as delete work for deleting notes in PianoRoll


## [2.1.4] - 2011-07-11

### NEW

* Virtual Midi Keyboard - visual piano keyboard with keyboard shortcuts for 
  input; generates MIDI note on/off's that route through blue's MIDI system

### UPDATED

* BlueSynthBuilder - moved "Manage Presets" button from top level to being a 
  menu option in the "Presets" menu

### FIX

* Correctly render parameters when they had automation turned off

* Issue with German Keyboards where ALT key is used to access characters fixed 
  (keys using ALT were blocked)

* Made "/usr/local/bin/csound" the default for OSX for Realtime and Disk Render 
  settings for new blue installations


## [2.1.3] - 2011-04-06

### UPDATED

* Reorganized Project Properties editor to have Realtime and Disk render settings 
  first, then have Project Information

### FIX

* BlueSynthBuilder - code for instrument would not correctly generate during a 
  session if new object was added that used an objectName that would change the 
  sorting order of widgets (project would generate correctly if reopened in a 
  new session)

* BlueSynthBuilder - allow generation of code to succeed for dropdown lists when 
  no items are entered (will simply not replace any values in the generated code)


## [2.1.2] - 2011-04-03

### UPDATED/FIX

* On Mac, replaced ctrl- based shortcuts with command- based shortcuts for most 
  components

### FIX
* BlueMixerIn (used by always-on instrument code) did not properly generate when 
  more than one input arg was used

* Fixed ftable converter tool to work when there is a space between the 'f' and 
  the table num


## [2.1.1] - 2011-03-22

### NEW

* Added Dave Seidel's "Herald of Water, Herald of Air" and "Gyre" to the 
  examples/pieces/daveSeidel folder

* Added Brian Wong's "Pythongorean Wanderers" and "FMBot-00" to examples/
  pieces/brianWong

* Added ability for BlueSynthBuilder instruments to have Always-On instrument 
  code

* OSX - made blue.conf default to have -J-d32 in the default_args to force using 
  32-bit mode Java on OSX; this enables working with Csound API when using the 
  Csound 5.13 OSX Installer

### UPDATED

* Modified shortcuts for opcode completion and BSB Object name completion to 
  always use ctrl- shortcut, even on OSX (due to cmd-space being used as system 
  shortcut for Spotlight)

* Jython library for Python objects updated to version 2.5.2

### FIX

* Audition SoundObjects caused a null pointer due to MIDI class introduced in 
  2.1.0

* Shutdown blueLive on application exit to prevent Csound crash if instance is 
  running

* Updated pmask to work with newer jython/python by replacing whrandom with 
  random.WeichmannHill()
  
* Fixed issue with Realtime and Disk render settings not saving correctly

* Fixed bug where when API was enabled, rendering to disk would not work if 
  "csound" was not in the system path; instead, always use command given in disk 
  render settings panel

* Made Send always generate if enabled (bug was that it would get optimized out 
  if level set to 0, even if automated)

* MIDI Driver settings were not being loaded correctly


## [2.1.0] - 2010-06-09

### NEW

* Added Steven Yi's "Reminiscences" and Brian Wong's "Tritium Tea" to examples/
  pieces folder

### UPDATED

* Moved blueLive buttons for starting/stopping and all notes off to and 
  application toolbar

* Moved blueLive MIDI input to Input Settings Top Component

* BSBDropdown is now automatable; when set to automatable, will use the index of 
  the selected item rather than the value set for that item, and will also generate 
  a k-rate signal

* Scale selectin panels now have a popup menu (triggered by right mouse button) 
  that has a "Reset (12TET)" option to reset the scale to the default 12TET tuning

* When using "Save as" or doing a save when closing a file, if the save is 
  designated over an existing file, blue will ask for confirmation from the user

* BSB Knob - when editing value in textfield, now starts off with text selected 
  for easier editing (RFE 3006108)

* Added text color setting in options for pfields (RFE 2970509)

## FIX

* Closing project did not ask user to save file

* BlueLive: when using API, no longer tries to update render time

* Blue Application Log was using black on black text, changed to use white text

* Default creation of codeRepository was broken, resulting in opcode popup not 
  properly creating itself if existing codeRepository not found

* Opening the blue manual did not work when blue was installed into a directory 
  where there were spaces in the path name (Bug 2982079)

* Opening the blue manual did not work for the OSX release

* Opening the csound manual and opcode help did not prepend "file://" if opening 
  from the local file system, also would have errors if spaces were in the path 
  (Bug 2981573)

* Score expression parser was calculating values using integers instead of floats 
  i.e. [1/3] was returning 0 instead of 0.33333 (Bug 3006243)


# 2.0.x

## [2.0.9] - 2010-03-21

### NEW

* Added "Save Copy" button to Frozen SoundObject's editor to allow saving a copy 
  of the the frozen soundfile (RFE 2970189)

* Readded "Script" menu with option to reinitialize Jython interpreter to address 
  issue in Bug 2789770

* Made TrackerObject work with fractional instruments (RFE 2826952)

* Added links to blue manual and csound manual from help menu (RFE 2936569)

### FIX

* Fixed issue with BSB Dropdown Lists when item list changes (items added/removed) 
  and preset is selected.  Preset value is now stored by uniqueId of dropdown 
  item to prevent issues with storing by item index.  Older presets that stored 
  by index still work. New presets saved will save by uniqueId.  One can update 
  an older preset to use the new uniqueId system by selecting the preset and 
  immediately choosing update for the preset. (Bug 2017191)

* Python NoteProcessor caused exception when showing it's code editor


## [2.0.8] - 2010-03-14

### NEW

* Added Backspace key as alternate way to delete soundObjects to Delete key

### FIX

* OSX: Fixed paste and duplicate actions with mouse to use Command Key 
  (Command-Click to paste, Command-Click-Drag to duplicate soundObjects) and 
  also fixed to use command key in PianoRoll

* Project defaults were not being set correctly (Author, Realtime and Disk render 
  settings)

* Fixed issues with Adding/Editing Effects and Sends on the Mixer when the 
  Mixer is undocked

* Fixed audio device parsing for Coreaudio

* Modified library saving code to write to a temporary file first before renaming 
  to the final to prevent clearing the library if there is a problem during the 
  save (Bug 2961116)


## [2.0.7] - 2010-02-22

### FIX

* Using Clear All for Automations on a SoundLayer did not work


## [2.0.6] - 2010-02-22

### UPDATED

* Modified CSD generation to note remove empty lines in instruments

### FIX

* Removed pre-initialization of python interpreter when application started as 
  it was causing issues

* Setting of mixer enabled by default according to user-defined setting in 
  program options was not working

* "Process on load" for pythonObjects was not working

* JMask - NoteProcessors were being saved to disk but not loading correctly


## [2.0.5] - 2010-02-11

### NEW

* Python: for Orchestra Library, added new bluePch related functions in 
  ScoreUtilities.py:

  getBluePchBaseTen(pch, numScaleDegrees)
  getBluePch(baseTen, numScaleDegrees)
  bluePchAdd(pch, addValue, numScaleDegrees)
  bluePchDiff(pch1, pch2)
  makeBluePchSet(startPch, intervalList, numScaleDegrees)

  please see source python files for more information

### UPDATED

* BlueLive: updated to no longer use its own SoundObjectEditPanel but instead 
  to reuse the common SoundObjectEdit Window.  Now able to use NoteProcessors 
  with soundObjects in blueLive

* Made SoundObject Editor Window no longer use green border but instead modify 
  window title when editing SoundObjects from library or blueLive

* Python: Orchestra Tuning class modified to reuse blue's internal Scale class

* PianoRoll: modified mouse handling so that if clicking a note for resizing, 
  it will immediately start drag mode (previously required first click to 
  select, then second click to resize)

### FIX

* BlueLive: right-click popup menu was not working for cut/copy/paste to/from 
  Score timeline

* Modified APIRunner code to prevent crash when blueLive was running and 
  Score render was initiated when using Csound API

* Modified Audition runner code to prevent crash when auditioning soundObjects 
  and an already running audition is going

* Adding a SoundObject to the SoundObject library created and Instance object 
  but did not actually add the item to the library

* Adding and Instrument to the project orchestra did not create associated 
  Mixer Channels correctly if Mixer window was not previously opened during 
  session


## [2.0.4] - 2010-02-02

### NEW

* Implemented score carry as Csound does, such that if the previous note has 
  the same base instr number, pfields not specified at end of note will carry 
  over, i.e.

  i1 0 2 3 4 5
  i1.1 0 .
  i1 0 .

  will become:

  i1 0 2 3 4 5
  i1.1 0 2 3 4 5
  i1 0 2 3 4 5

* When pasting BSB objects with existing names, will now use the existing 
  name plus an incremented number, i.e. pasting an object with name "freq" 
  will be named "freq1", and another copy would be "freq2" (RFE 2847420)

### NEW/FIX

* Updated blue's plugin mechanism to address issue with blueLive where an 
  exception was thrown when trying to add objects

### FIX

* JMask: Added support for negative p3 (tied notes)


## [2.0.3] - 2010-01-19

### UPDATED

* Updated opcodes.xml definitions with latest from Csound Manual 

### FIX

* Mixer: If mixer window was undocked into its own dialog when first time 
  choosing "Edit Effect" it would cause an Exception to occur

* Mixer: Extra Time Field was not correctly anchored


## [2.0.2] - 2010-01-13

### NEW

* Presets: Added ability to see most recent preset selected and update it 
  with the values in the UI

### FIX

* Mixer: master chanel strip was not being set as master in code and was 
  thus showing an output dropdown (was not being used by blue and was just 
  a cosmetic issue)

* BlueSynthBuilder: Projects using SubChannelDropdowns did not correctly 
  create the instrument's UI due to a bug in the view factory code for 
  creating views

* Import MIDI File did not work as it did not set the imported PolyObject 
  as root correctly, causing all score work from there to generate with a 
  2 second duration (bug existed prior to blue 2.0)


## [2.0.1] - 2010-01-10

### NEW

* Added Shift-Escape shortcut for Maximize Window action

* Options/blue/General: added button to select directory for Csound
  Documentation Root

### UPDATED

* Options/blue/General: made work directory an editable text field

### FIX

* Options/blue/Utility: button for selecting Csound Executable did not work

* Options/blue/Disk Render: the file browser button for the Csound 
  Executable field did not work 


## [2.0.0] - 2010-01-07

### NEW

* Converted application to use Netbeans Rich Client Platform to take advantage 
  of new Window Manager and many libraries

* Added PulseAudio as driver option for Realtime Render settings on Linux

* Added pieces by Brian Wong to examples\pieces\brianWong folder

### FIX

* Bug 2864419 - fixed importing multiline i- and f-statements when importing 
  CSD or ORC/SCO; added multiline i-statment in score parser


# OLDER RELEASES

## [0.125.0] - 2008-12-01

### NEW

* Added "Process On Load" to PythonObject; allows running of that PythonObject 
  instance's script when a project is loaded or switched to; for usage where 
  user has code at the beginning of a project, allows for that code to load on 
  start so one can just start rendering from later in the project with code that 
  depends on those earlier PythonObjects

* Added ability to scale a SoundObject by moving its start time (dragging from 
  left side)

* Added scaling of automation data when scaling a single soundObject in Score Mode

* Added moving of automation data when moving soundObjects in Score Mode

* Added 20 pixel buffer when moving start time pointer to more easily see when 
  dragging as well as when jumping from marker to marker

* Added check of location of dialogs when opening modal dialogs (i.e. soundObject 
  properties, mixer, etc.) and adjust to place on screen

* Added "Reset Time Log" option to Help menu to reset start time for time log

* Add Marker action: when not rendering project, marker action now stays enabled 
  and will add marker at where the Render Start time is current set

* Added "Use Csound API" option on Project menu to allow easier toggling between 
  enabling/disabling use of the Csound API

* BlueLive: Added "All Notes Off" button which will turn off all notes for 
  instruments found in the project Orchestra (will not turn off mixer or any other 
  specially generated instruments)

### UPDATED

* Added more buffer size when scrolling score time canvas so block increment is 
  not as big and drastic when using touchpad for scrolling

### FIX

* Add Marker action: when rendering project, marker was being added relative to 
  time 0 instead of render start time;


## [0.124.3] - 2008-10-28

### NEW

* Added piece "Unstill Light" by Dave Seidel to examples/pieces/daveSeidel folder

* Documentation

    * Added section on breaks in backwards compatibility (Appendix B)

### UPDATE

* Added caching of values when rendering live using API so as to only set the value 
  in Csound if the value changed in the project (performance optimization)

* BSB Widgets now always emit k-rate signals if they are set as automatable 
  ("Automation Allowed") whether using API or not; previously widgets would try to 
  optimize by generating as constant when automatable but not automated, but this 
  caused an issue with Csound coding; an object that is set to be automatable makes 
  sense that code that depends on it should assume it could be k-rate

  NOTE: This is a break in backwards compatibility! The known workaround is to set 
  the widget as not automatable or to update Csound code to use a k-rate signal

* Documentation

    * Updated information to more clearly explain value will be gk-rate signal when 
      a BSB widget is set to allow automation, even if it is not automated at the time

### FIX

* Commandline use of blue to convert .blue project to CSD was broken

* "Generate CSD to File" was broken

* Changed settings on ScoreTimeCanvas so that ghost drawing of render time pointer 
  would not occur while rendering (multiple orange lines)


## [0.124.2] - 2008-09-29

### FIX

* Csound API detection was causing blue to crash at start and become unsuable if 
  csnd.jar was not found


## [0.124.1] - 2008-09-28

### UPDATE

* By default, have "Save Peak Information in Header" option on Disk Render Settings 
  default to true; will only affect new installations of blue where no previous 
  user settings found in $HOME/.blue directory

* Documentation

    * Added information to csoundAPI section of Installing Csound about 
      java.lang.UnsatisfiedLinkError and how to update starter scripts with 
      -Djava.library.path=xxx

    * Added information to BlueSynthBuilder and Parameter Automation documentation 
      to clarify the requirement that when using the Csound API, the area in the 
      Csound code where the widget value is replaced must accept a k-rate signal 
      for widgets which are set to automatable

    * Added note that blueLive works on Windows when using the Csound API

### FIX

* Fixed instability issues on Linux when using Csound API by initializing Csound 
  library to not install signal handlers

* When loading older projects before BSB Widgets had automatable option, now 
  default to false only if widget was not already automated (fixes problems with 
  opening legacy projects and running project with API enabled)

* Open, ran, and fixed blue/examples projects to run with API

* When using API, always use "csound" for csound executable command when building 
  command line for Csound API; fixes problem when executable had a full path with 
  space in it, i.e. "C:\Program Files\Csound\bin\csound.exe" as API mode does not 
  really use that first argument, but having space would cause the value to be split 
  into two args and would then cause render to fail; allows keeping above value with 
  space when rendering without API and switching to API then will not cause a problem


## [0.124.0] - 2008-09-10

### NEW

* implemented working with Csound API (double-precision build), enabling modifying 
  of automations and widget values in real time during render; to enable, please 
  view new documentation added on setting up blue with the API

* Added piece "Second Sleep" by Dave Seidel to examples/pieces/daveSeidel folder

### UPDATED

* Made blueX7 envelope editor draw with black background and gray border to make it 
  easier to see; will continue to update in future release

### FIX

* When loading older projects before BSB Widgets had automatable option, now default 
  to false


## [0.123.1] - 2008-06-10

### FIX

* JMask

    * Duration was not being set for Mask, Accumulator, and Quantizer; if a table was 
      used for any values in those modifiers, the duration of those tables were being 
      calculated as if they were 1 beat long, so any values generated after 1 beat 
      would pretty much use the value set at the end of the table; duration is now set 
      correctly

    * Dropdowns in UI's did not initialize to the value that the edited object currently 
      held when first populating interface


## [0.123.0] - 2008.06.06

### NEW

* JMask

    * New SoundObject based on Andre Bartetzki's CMask; currently supports same exact 
      features as are available in CMask though using a graphical user interface to 
      create and configure parameters, masks, quantizers, accumultators, etc.

* Documentation

    * Added initial basic documentation for JMask in the Reference section for 
      SoundObjects

### NEW/UPDATED

* Implemented completed single-line and multi-line modes: able to select time area, then 
  drag selection area to move automation points for currently edited line in single-line 
  mode, all lines and soundObjects under selection area in multi-line mode; more 
  information in documentation

* Documentation

    * Updated "Parameter Automation" in the Concepts section of the manual with 
      information on the updated Single-Line and Multi-Line modes

### UPDATED

* When rendering, now checks if instruments are muted and if so, optimize CSD generation 
  and mixer to not generate code for those channels associated with muted instruments

* Documentation

    * Reviewed all reference documentation for NoteProcessors, adding better examples 
      showing before and after processing

### FIX

* Processing of command blocks (i.e. ;[pre]{) trimmed the empty spaces around lines of 
  text; now leaves formatting in tact
    
* Problem with Tempo caused "Audition SoundObjects" to break 

* Reenabled cut/copy/paste on NoteProcessorChain editors, fixed to make buffered 
  noteProcessor be global and can copy/paste in all noteProcessor editors (i.e. 
  SoundObject, SoundLayer, polyObject), fixed to make NoteProcessorChain table be max 
  height always of scrollPane so that right mouse button can always open up popup


## [0.122.0] - 2008-03-11

### NEW

* Tempo Editor - allows graphical editing of tempo on timeline for root polyObject; 
  clicking "Use Tempo" checkbox will enable use of tempo line and clicking of down arrow 
  will show the tempo for editing or collapse it to reduce screen space usage; if enabled, 
  will generate a Csound t-statement to control global tempo; older project which manually 
  added t-statements in global orc will run correctly as tempo editor is not enabled by 
  default; right-clicking on tempo line area when in edit mode will allow option to edit 
  point values by table or to set the min/max bpm for the tempo line with option to 
  truncate or rescale line point values for new min/max

* Added ability to set Code Text Area background color in Program Options dialog

* Snap

    * Setting render start time and render end time now snap if snap is enabled; one can 
      modify without snap if snap is enabled by clicking, then holding down shift, move 
      around (holding shift when clicking creates a marker, so one should press shift 
      after mouse down)

    * Setting automation points now snap x value if snap is enabled; holding down shift 
      while editing will allow free setting of x value

* Added \<RENDER\_START\_ABSOLUTE\> blue variable, equal RENDER\_START value but timewarped 
  if t-statement used

* Documentation

    * Added section on Tempo Editor to Score Timeline section

### UPDATED

* Tuning NoteProcessor: formerly only held the name of the Scala file from the .blue/scl 
  directory to use and this file would get parsed everytime it was used; changed to use 
  same Scale class that the PianoRoll uses and now loads in content of files and saves it 
  with the project, making the project more portable.  

  For older projects, when loading project will be auto-upgraded and contents of scale will 
  get loaded in. If scale is not found, results are not predictable and project will likely 
  fail to open.

### FIX

* Tempo Mapper 

    * Fixed timePointer location if tempo used and renderStart > 0

    * Fixed timePointer location if two tempo points had same beat time value (i.e. hard 
      jump in tempo)

    * Fixed timePointer location if tempo used and two consecutive tempo points had same 
      tempo

* Fixed "Convert to BSB" option on Orchestra to copy over UDO's, also fixed 
  NullPointerException bug in adding parameters after conversion 

* BSB FileSelector was always saving and using absolute file path instead of using 
  relative  path if within directory of project or in a subdirectory thereof; switched to 
  use relative when possible to make projects more portable 

* Automation values may not reach end value if ksmps did not equal 1; added extra parameter 
  note to ensure setting of end values

* BSB/ObjectBuilder/Effects - Randomization of sliders using resolution never achieved 
  maximum value 


## [0.121.1] - 2008-02-16

### NEW

* Added "Always Render Entire Project" option to Project Properties for disk renders; if 
  checked, will render to disk as if the render end wasn't set and as if rendering from 
  time 0 regardless of what values are used in render start/end which still affects realtime 
  playback

* Added optional color theming: if blueTheme.properties is found in the user's .blue 
  directory, values will be used to set blue's colors for theme; colors normally used are:

        primary1=198,226,255
        primary2=153,153,204
        primary3=204,204,255
        secondary1=102,177,253
        secondary2=63,102,150
        secondary3=38,51,76
        black=240,240,255
        white=0,0,0

  all eight of the above properties must be defined in the blueTheme.properties if the theme 
  file is to be used; color values are equivalent to RGB with range 0-255 for each color

### FIX

* Mixer was not correctly setting slider positions when loading or switching to a project


## [0.121.0] - released 2008-02-12

### NEW

* Added support for manage csLADSPA settings: csLADSPA tab and editor added to Project 
  Properties; if enabled, will add <csLADSPA> block to generated CSD.  Support was also 
  added to "Import from CSD" feature to read in csLADSPA blocks found in CSD's.              

* SoundFont Viewer - Added right-click popup menu to file tree with option to "Copy Path", 
  copying the full path of the selected file in the file tree to the system clipboard

* For InfoDialog (used to show text such as when Generating Code to Screen), added a 
  CaretPositionDisplay to bottom right that shows the line number and caret position in 
  that line

* LineObject, ZakLineObject, BSB LineObject - Added option for "Link First/Last" points 
  to properties for Line, allowing to make first and last line points linked so that 
  modifications to one will apply to the other; useful when using line objects for ftables 
  for oscilators

* Documentation

    * Added information about csLADSPA settings to the section for Project Properties

* Added "clear" functionality to the BSB file selector widget via popup menu

  (Contributed by Michael Bechard)

* Made channel level label an editable text field after double-clicking

  (Contributed by Michael Bechard)

### UPDATED

* Updated conf/opcodes.xml to latest opcodes from 5.08; also checked in a copy of the 
  quickrefBlue.py file based on quickref.py in the csound manual src tree, used to generate 
  the opcodes.xml file; also added ant create-opcodes-file target

* Made Orchestra manager's Instr ID column adjustable

  (Contributed by Michael Bechard)

### FIX

* LineObjectCanvas - prevent adding points outside the canvas area as well as fixed 
  off-by-one error exception when inserting new points

* Automatic ftable numbering used by objects like the LineObject now take into account 
  any ftgen statements found in the global orc

* BlueX7 p3-resetting code restored (change was in 0.116.0) as original Pinkston code made 
  DX7 emulation monophonic due to use of ihold opcode and current version of Csound does 
  not seem to suffer from problems of resetting p3
            

## [0.120.0] - 2008-01-16

### NEW

* Modified Instrument edit area to show same kind of label of "Editing Library Instrument" 
  as was implemented for SoundObject editing in 0.119.0

* Added shift-F2 shortcut to BlueEditorPane so if over an opcode, will try to open up the 
  example CSD from the manaul for that opcode and display the example

* Added 01\_funky.blue example to blue/examples/general folder

### NEW/UPDATED

* BlueShare - when selecting an instrument or Effect to export, will now pre-populate 
  description text field for import from instrument/effect's comments text field; user is 
  still able to modify the description text field to summarize or truncate the information 
  before submitting

* Replaced using BlueTextArea with JTextArea for Comment text in Instruments and UDO's; 
  the text is no longer highlighting for Csound code (which didn't make sense really) as 
  well as has line wrapping enabled for long lines

### UPDATED

* Rearranged Orchestra manager editor so that the User Instrument Library and project 
  orchestra is now held on the left while the instrument editor area now takes up the entire 
  right hand side of the split pane, giving more room to the instrument editor.

* Updated /blue/examples/scripting/feldman.blue to newer version using new instruments 
  (b64 SID emulation and triangle wave instrument), also updated comments and layout to more 
  modern blue usage (for example, used Mixer system instead of hand done routing)

### FIX

* Parameters for Effects were not being cleared when copies were pasted

* When reopening projects with soundObjects or instruments that had an empty name, would 
  cause a null pointer exception  

* When reopening projects with GenericScore soundObjects that had an empty score, would 
  cause a null pointer exception on score rendering  

* When opening files using commandline args to blue, absolute version of file was not used 
  and soundObject freezing would not work

* When working with named instruments, programmatic adding of instruments was problematic 
  due to poor checking of instrument ID's

* Opcode Completion and search for opcode manual entry or example did not filter out "(" 
  parenthesis when looking for word where text caret was, therefore did not lookup functions 
  correctly (i.e. ampdb)

* Loading of pre-0.94.0 projects was broken, fixes made and plans for frozen upgrading tool 
  for pre-0.94.0 in the works for later release

* CSD import for 'Import Score and Split into SoundObjects by Instrument Number' method was 
  broken


## [0.119.0] - 2007-11-10

### NEW

* implemented partial SoundObject rendering, allowing SoundObjects to be able to take in 
  relative renderStart and renderEnd and to use that information when generating notes; 
  AudioFile, Frozen SoundObject, and both LineObject classes can now generate notes if 
  renderStart happens in the middle of their duration (previously, a soundObject would 
  generate a note for the entire duration, then notes would get translated to the renderStart 
  time and then filtered if notes do not start at time 0.0 or great; this process still 
  happens, but for the above SoundObjects, partial notes will now be generated that are 
  adjusted to the render start and those objects will contribute notes that won't get 
  filtered out and will start playback in the middle of their content)
  (Thanks to Michael Bechard for suggesting this!)

* When clicking an Instance soundObject, will no longer use the Instance editor but 
  instead edit the SoundObject from the SoundObject Library that the instance points to, 
  using the new green border/label to show that you are editing a Library object

### NEW/UPDATED

* When editing Library SoundObjects, now shows a text label that says "Editing Library 
  SoundObject" to help further show that one is editing a SoundObject that might be 
  pointed at by multiple instances

### UPDATED

* Manual

    * Updated top section of SoundObjects reference to discuss partial object rendering

### FIX

* When auditioning soundObjects, was using disk render settings and not realtime render 
  settings

* When using blueLive, triggering ObjectBuilder objects would not generate score correctly
  (Thanks to Andrzej K for reporting this!)


## [0.118.1] - 2007-10-29

### FIX

* Comments for User-Defined Opcodes were not being saved or loaded

* Score parsing was stripping comments incorrectly and stripped where it found "/" instead 
  of "//"


## [0.118.0] - 2007-10-23

### NEW

* AudioFile SoundObject

    * Added Waveform display on timeline (renders waveform of audio file object; Thanks to 
      Peiman Khosravi, Greg Thompson, John Lato, Oeyvind Brandtsegg, and others on the Csound 
      list for their help on this!

    * Updated editor: added scrollpane for audiofile properties to make it more useful when 
      SoundObject Editor area is small; fixed so that when editing a SoundObject that does 
      not have a sound file set or an invalid one, to clear out the info area (was just 
      leaving on values last set which was misleading)

* Added "Time Log" option to Help menu; selecting this from menu will report time when blue 
  started as well as elapsed time since blue started in HH:MM:SS:MS format (useful to keep 
  track of how much time you worked in blue, for those who like to keep track how much work
  we're doing!)

* Added "Show Time Log on Exit" option to Program Options; if enabled, will show the Time 
  Log when program exits

* Added piece "Aurora" by Dave Seidel to examples/pieces/daveSeidel folder

* Added "Synchronize Presets" to presets dropdown menu; calling this will remove values 
  within presets which are for widgets which no longer exist, as well as will add values to 
  presets from widgets which now exist in the interface which did not when the preset was 
  saved

* Added cpspch to orchestral composition library in ScoreUtilities.py,works like csound's 
  cps2pch taking in a pch value for first arg and number for equal temperament for second 
  arg (optional, defaults to 12 et)

* Added Program Option for Java 2D acceleration, whether to use the default or use Open GL

### UPDATED

* Big improvement in speed of rendering of CSD

    * Reduced unnecesary creation of Strings by using ensureCapacity with StrBuilder class

    * combined two regular expressions into one for single line comment stripping method 
      which reduced time almost 45%

     (These changes may not be noticable unless your project contains large amounts of SCO 
      text, i.e. when doing granular scores with CMask, generating large amounts of notes 
      with Orchestral composition library, etc.)

* Changed look of polyObject bar to use smaller buttons with no borders decorated with right 
  arrow icon to look more like a bread crumb bar

* Updated Jython to 2.2.1

### FIX

* ScriptingUtils.py restored to lib/pythonLib (was accidentally deleted when upgrading to 
  Jython 2.2)


## [0.117.0] - 2007-08-27

### NEW

* Add ability to randomize BlueSynthBuilder, ObjectBuilder, and Effects; to randomize, set 
  randomizable on any of the following widgets(this is set to randomizable by default):

    * Horizontal Slider
    * Horizontal Slider Bank
    * Knob
    * Vertical Slider
    * Vertical Slider Bank
    * XY Controller

    then in UI editor, when set to non-edit mode, right click to show popup menu and choose 
    "Randomize"

* Added -u commandline option to pass in a directory to use to store blue's configuration 
  settings; by default blue used USER\_HOME/.blue but this option was added so users can 
  explicitly choose where to store settings (i.e. if you're going to run blue from a USB 
  flash drive you can set your configuration dir to somewhere on the usb drive)

### UPDATED

* Upgraded to Jython 2.2

* Removed -p commandline option as it wasn't very useful anymore (historically it was used 
  to show which .blueConfig.xml to use, but this was before configuration settings were 
  change to use a directory to store settings

* Tracker - Shortcuts modified to be more like other trackers:

    * Insert key now adds a blank note and pushes down other notes

    * Entering a note with keyboard mode will now automatically select the next row after 
      entering a note

    * BackSpace key will delete the current note and move all following notes up one row

    * Delete key will delete the current note and select the next row

* Manual

    * Updated keyboard shortcuts for Tracker

    * Added documentation about widget randomization to BlueSynthBuilder entry, as well as 
      link to info from mixer section on working with effects

### UPDATED/FIX

* When blue loads, if any of the libraries are not loadable (Instruments, UDO, Script, 
  Effects libraries), blue will now give an error message to fix or remove the corrupt file 
  and exit out; this is done so that no overwriting of existing libraries or backup files

  (Thanks to Mark Van Peteghem for the bug report)

* Changed behavior when selecting SoundLayers, when focus is lost then selection will be 
  deselected (prior behavior was that once a soundLayer was selected, the last one would 
  always be selected unless one was removed or project files changed, which would just leave 
  the selection always there which was distracting)

### FIX

* Fixed mixer generation problem when Send signals were not being assessed correctly and 
  branches of code were incorrectly optimized out

* Fixed problem when viewing in Score Navigator where complete text was being drawn even 
  when past length of bar; fix was to set clip rect when drawing bars in preview mode

* SoundLayer top row buttons should now look same size

* Memory Leak - Some BSB Widget UI items did not remove themselves as propertyChangeListeners 
  to BSB data classes

* when opening dialog for render to disk when no filename given in project properties, 
  set default to $HOME/output.wav for first time use (was defaulting to whatever last file 
  was opened in any dialog)

* Parsing of Scala SCL files was broken for scales generated without comments

  (Contributed by Dave Seidel)


## [0.116.1] - 2007-07-02

### FIX

* MathUtils.remainder function was broken causing problems with setting of values in BSB 
  objects that used resolution


## [0.116.0] - 2007-06-30

### NEW

* Added "Clear All" option to SoundLayer's Automation menu to remove all parameter 
  automations for that SoundLayer

* Added Program Options Settings in General Tab for using custom browser command and what 
  command to use; if enabled, the custom browser command will be used instead of blue's 
  default system for opening URL's; browser command will have URL appended to it when opening 
  URL's so if the browser is not on the path the user may have to designate an absolute path 
  to the browser executable

### UPDATED

* Small optimization on drawing of parameter automation lines

### UPDATED/FIX

* External and ObjectBuilder - redid generation of notes to fix problem reported on mailing 
  list when on Linux

* BlueX7 - removed the p3 modification in generated Csound code as it was unnecessary and 
  reverted to original Pinkston duration code (was causing bugs when running in recent Csound 
  and seems better performing now)

* Freezing - When unfreezing soundObjects, now checks project if there are any other 
  references to the generated frozen audio file and only delete when there are no references 
  left (so if you freeze an object, make a copy of the frozen object, then unfreeze one of 
  the objects, the freeze audio file won't be deleted as there is still one reference to the 
  audio file)

### FIX

* Freezing and Auditioning of SoundObjects did not correctly generate CSD when Automation was 
  used; did not adjust values of automation data and would result in all automation data from 
  time zero until end of piece to be generated, causing incorrect results

  (Thanks Jan Jacob, Michael, and others for reporting this issue!)

* Expansion of SCO carry (".") now done first before expanding any other SCO symbols ("+", 
  ">", "<")

  (Thanks Phil for reporting this issue!)

* When changing color on Automation line, repaint was not happening correctly

* Program Options were not loading the Utility Csound command correctly


## [0.115.0] - 2007-04-20

### NEW

* BSB/Effects/ObjectBuilder - Added new TextField widget, value in textfield will be used as 
  replacement value for object

* BSB/Effects - Now able to set if automation is allowed for widgets which are automatable.  
  Automatable widgets are enabled for automation by default to preserve older project 
  behavior. Disabling automationAllowed will not only disable but will also remove any 
  automation data for that parameter. (Requested by Peiman Khosravi)

* Added piece "Owllight" by Dave Seidel to examples/pieces/daveSeidel folder

* Added piece "Phenomena" to examples/pieces/stevenYi folder

* Added techniques folder to examples, with following examples:

    * pvoc.blue - using automation to control resynthesis of pvx files

    * tapePiece.blue - using sample to do tape like manipulations

    * twelveTone.blue - demonstrates using SoundObject Library and NoteProcessors to achieve 
      serial compositional operations

    * surfaces.blue - uses ObjectBuilder with python script to create surfaces as in 
      Xenakis's Metastasis (uses Orchestral Composition Library)

### NEW/UPDATED

* Table editing behavior changed: on all tables, when editing a cell, if using tab or by 
  other means to make the current edited cell lose focus, current value in editor will be 
  committed; previously, the value in the editor would not be committed if tab used; this 
  should allow for faster editing of values

  (Thanks to Jan Jacob Hofmann for the request!)

### UPDATED

* Tracker example (blue/examples/soundObjects/tracker.blue) updated with different music and 
  use of effects

* BlueSynthBuilder, Effects, and ObjectBuilder now default to edit enabled for code and GUI 
  editing when initially created (Suggested by Bruce Petherick)

* All tabbed panes will now switch to the tab that is dragged over when dragging an item 
  (useful for when dragging a UDO from the library to an instrument and vice versa)

### UPDATED/FIX

* Main frame shortcuts added to dialogs for individual Effects and Sends, so shortcuts like 
  F9 and Ctrl-S will now work even when working on those effects and sends

* OSX - shortcuts for all textfields and other actions that were using CTRL should now use 
  Apple Command key (i.e. copying and pasting in text fields is now CMD-C and CMD-V)

  (Thanks to Jan Jacob Hofmann for the request!)

### FIX

* "Edit Points" options for BSBLineObjects would not work when editor was in a dialog (i.e. 
  when editing Effects in the Effects Library) (Reported by Peiman Khosravi)

* When using BSB Knobs and double-clicking the display to edit the value by hand, value shown 
  after double-clicking was incorrect

* Python NoteProcessor was not throwing exception correctly, user would not get feedback 
  dialog but instead would have to look at console (now fixed)

* When adding Effects from library to Mixer, would not reset to enabled before inserting

* When editing values for NoteProcessors, if value was cell was being edited and user moved 
  away, table would not commit value and have editor up still for next SoundObject if it had 
  the same number of NoteProcessors; misleading, behavior changed to commit any previous 
  edits when a SoundObject is selected


## [0.114.1] - 2007-03-06

### NEW

* Added "Render to Disk and Play" command in program options under Disk Render Settings. If 
  enabled, blue will use the given command to play a file after "Render to Disk and Play" is 
  used instead of the built-in SoundFile player.  Command given will have $outfile replaced 
  with path of the rendered file.

* Added piece "Distant Stars" to examples/pieces/stevenYi folder

### UPDATED

* Script "Show Info Dialog" now made as a toggle to show and hide the info dialog; 
  ctrl-shift-I shortcut added; dialog now allows all main frame shortcuts to work when dialog 
  is open

* Made ProgramOptions default to "dac" and "adc" so that first time blue users will have a 
  sensible default when they first run the program

* Disabled "Jobs" and "Utils" panels in SoundFileManager as they are not currently being used

### FIX

* BlueSynthBuilders were not correctly generating instrument code for automation; bug 
  introduced in 0.113.0

* Nudging SoundObjects up or down using arrow keys would lose selection

* SoundObject editor would load editor for every selected object, making a group selection 
  slow; now only shows if selecting a single object, otherwise hide the editor

### Documentation

* Started filling in information in section "Create Encapsulated Instruments"


## [0.114.0] - 2007.02.26

### NEW

* Mixer now allows adding Sends anywhere in pre and post fader effects bins.  Sends must 
  follow current mixer contract of no feedback so can only send forward down the chain. 
  (Dropdown to select outchannel for mixer and send is auto-updated to prevent feedback). 
  Send amount is automatable on main timeline.

* BlueSynthBuilder - Added SubChannel dropdown widget that will allow selecting a named 
  subchannel to use as a replacement value in the BSB ORC code.  This is meant to be used 
  with the subchannel form of blueMixerOut, i.e. if the dropdown has an object name of 
  REVERB, the ORC code to use would be:

  blueMixerOut "<REVERB>", aleft * <REVERB_AMOUNT>, aright * <REVERB_AMOUNT>

  This allows an alternate way to do sends from the instrument rather than from the Mixer 
  itself, and is useful if setting the send value by score parameter instead of setting 
  within the mixer.

  It is recommended when using the subChannel form of blueMixerOut within instruments to use 
  this widget instead of hardcoding the subchannel name as this will be portable across 
  projects

* Added "Show Info Tabs Dialog" to Script Menu to make visible the info tabs dialog that 
  scripts use in case it is closed

* Added <INSTR_NAME> blue variable that is the same as INSTR_ID but for named instruments 
  does not generate quotes around value

* Script Library now supports drag and drop to manage scripts and script categories

### UPDATED

* Mixer generation code strategy reworked to better handle sends. Further mixer generation 
  optimizations to not generate signal paths that won't be used. (i.e. if fader is set to 0 
  and not automated, remove rest of signal after fader from graph); documentation for mixer 
  updated to describe optimization strategy

* Presets - Presets for BSB/ObjectBuilder now save their held values in alphabetic order of 
  value name; this was done so that when using with Source Control Management (i.e. 
  Mercurial, SVN, etc.) there wouldn't be false positives on detecting changes (previously 
  the values were coming out in whatever order the keys were mapped by HashMap which might 
  change between loads of the project or library)

* When importing instruments from blueShare, they will now go into an "Imported Instruments" 
  folder instead of adding to the root of the user instrument library (matches behavior of 
  what happens when importing effects)

### FIX

* BSB/ObjectBuilder XY object's view label showing x and y values was incorrectly displaying 
  value (value held by object and generated by object was correct for ranges however)

* Disallow subChannel to be named "Master" as it is reserved for master channel out

* BlueShare dialog would report a warning message to console when opened each time after the 
  first time as dialog was recreated each time; now cached

### Internal

* BSBObjectRegistry split into BSBObjectRegistry, EffectsObjectRegistry, and 
  ObjectBuilderRegistry as new components are planned which will apply to some contexts 
  by not others

### Documentation

* Updated Mixer documentation for Sends as well as details on the rules used for 
  optimizing Csound mixer code generation


## [0.113.0] - 2007.02.17

### NEW

* Scripts - User editable python scripts allowing for automating tasks within blue; 
  familiarity with blue's object model recommended; ScriptingUtils.py added for aiding in 
  writing scripts; see documentation for more information

* Instruments and Effects now have the ability to embed User-Defined Opcodes; user can safely 
  reuse opcodes with same names and blue will check for duplicates and reuse when generating 
  CSD's, as well as detect name clashes between UDO's and also replace names in code

* Import from File/Export to File added to:

    * Score Timeline for SoundObjects
    * UserInstrumentLibrary and Orchestra for Instruments
    * ScriptLibraryDialog for Scripts
    * Mixer for Effects
    * EffectsLibrary for Effects

* New BlueShare Server! Location available at:

  http://blue.kunstmusik.com

  RSS feeds are now available to track newly submitted Effects and Instruments

  Configuration file for blueShare servers now set to use new blueShare site's xmlrpc 
  (http://blue.kunstmusik.com/blue_share/api)

* Edit Enabled state now maintained for BlueSynthBuilder and ObjectBuilder for code areas

* SoundObject names may now be multiline by using \n in name (care should be used when using 
  this that SoundLayeer height be tall enough to show full name of SoundObject)

* Added ProgramOption to disable Csound Error Warning messages when Csound returns an error 
  code at end of run; also able to turn off from the dialog that pops up itself, and can 
  reenable from ProgramOptions

* ScoreTimeLine Shortcuts

    * Ctrl-D - Duplicate Selected SoundObjects and place copy directly after original

    * Ctrl-R - Repeat Selected SoundObjects for n number of times after original (user inputs 
      number of times to repeat)

    * Ctrl-Drag - If control is down when drag is initiated, copies of originals will be 
      added in place and drag will move originals

* BSB/ObjectBuilder/Effects

    * Value display for Knobs, VSliders, HSliders now have tooltip text that popup when mouse 
      is over the value display; shows full value of item in case it is cut off in the normal 
      display

    * FileSelector widget will now open file chooser to location of the currently set file 
      value

* When generating Effects as UDO's, now does check to see if equivalent UDO already exists 
  and if so to reuse that

* Added \<RENDER\_START\> blue variable, usable in Global SCO area (also in Global SCO area of 
  instruments), replaced with render start time that blue uses (does not currently account 
  for timewarped score)

### NEW/UPDATED

* Drag and Drop

    * Added Drag and Drop to EffectsLibrary tree for moving effects and folders into other 
      folders

    * Removed ">" Add from library on Orchestra and UDO panel, now drag and drop from library 
      to panels

    * Now able to reorder items in libraries by dragging and moving

    * For dragging UDO from library to instrument UDO edit panel, start drag in UDO library, 
      mouse over tabs to switch, then drop on UDO edit panel for instrument

* UDOLibrary and All UDO EditPanels share same buffer for copy/paste operations; if UDO is 
  copied on one edit panel, it will be pastable into any other or in the library; if a UDO 
  Category isNcut/copied from the library, it is only pastable in the Library

### UPDATED

* When SoundLayer has no automations, now does not show automation selector in layer edit 
  panel (on left of timeline)

* InfoDialog made editable when showing messages to allow for cutting/copying of text

* When generating UDO's from Instruments and Effects, if an equivalent opcode is found (same 
  inTypes, outTypes, and codeBody), the existing UDO will be reused and references to the new 
  UDO will be text swapped with the name of the existing UDO at compilation time; if an 
  equivalent UDO does not exist but the new UDO's name is already in use, a unique name will 
  be assigned and references to the new UDO's original name will be text swapped with the 
  unique name at compilation time

### FIX

* Dialog windows now allow for keyboard events to pass through to parent window (i.e. when 
  using the soundObjectPropertyDialog, all menubar shortcuts in the main window will work so 
  you can open the other dialogs using their shortcuts, press ctrl-s to save your document, 
  etc.)

* UDO's were not draggable in library and so could not be rearranged in folders

* UDO's were not cloned when dragging from project to library, causing problems when dragging 
  the same UDO multiple times to the library

* BSB Dropown Widget was not checking selected index was within boundaries when updating 
  contents of dropdoglobawn

* DropDown editor for BSBDropdown widget now commits current edit when dialog closes

* BSB File Selector would have null pointer errors after loading if object was saved with no 
  selected files

### FIXME

### Documentation

* added section on "Program Scripts"

* added note to section on Audition SoundObjects regarding ctrl-shift-a shortcut

### Internal

* MotionBuffer and SoundObjectBuffer made into Singleton classes

* upgraded Javascript Interpreter (Rhino) to 1.6r5

* upgraded Python Interpreter (Jython) to 2.2b1

* added showInformationDialogTabs to InfoDialog utility class

### Thanks!

* Jim Credland and Pia Kraft for their suggestions!


## [0.112.0] - 2007-02-06

### NEW

* Render Time Pointer now shows when using "Audition Sound Objects"

* BlueMixerOut now able to take subchannel as first argument, must use quoted string for 
  name, for example:

  blueMixerOut "audio1", aoutL, aoutR

  will send the audio out of this code to the Mixer SubChannel "audio1"; this allows users to 
  route the output from Sound SoundObjects and AudioFile SoundObjects to subchannels created 
  by the user in the Mixer

  (Thanks to Jim Credland for suggestion!)

* Added Apple OSX Application Handlers for Quit, Preferences, and About options from Program  
  menu; hitting command-Q will now use blue's exit routine instead of directly shutting down 
  the Java Virtual Machine

  (Thanks to Jim Credland for suggestion!)

* "Save Libraries" menu option added to File Menu; calling this will force a save of the User 
  Instrument Library and User-Defined Opcodes Library (normally saves only on closing of blue)

  (Thanks to Jim Credland for suggestion!)

* BSB, ObjectBuilder, Effects - The Edit Enabled checkbox is now persistent so that if you 
  are in the middle of editing the graphic interface for any of the above, then go away and 
  come back, it will return to the last state of edit mode or usage mode

  (Thanks to Jim Credland for suggestion!)

* PianoRoll - added "Set Selected Notes" option in Properties tab to set the noteTemplate for 
  selected notes in the Notes section

  (Thanks to Pia Kraft for suggestion!)

* Tracker - added two new options to popup menu shown from track header:

  Duplicate - duplicates the selected track
  Clear - clears all note data for track

  (Thanks to Pia Kraft for suggestion!)

### NEW/FIX

* Tracker - When changing name of column in track editor, value is now updated on Track 
  Header in TrackList

  Thanks to Pia Kraft for suggestion!)

### UPDATED

* Improved ScoreNavigator to show thumbnail background of scoretimeline; currently only 
  renders SoundObjects and not grid lines or automations; slightly buggy and inefficient, but 
  still more usable to show big picture view of timeline
            
* Internal

    * Redid ScoreTimeCanvas to use event notification to add/remove SoundObjects to timeline 
      (in preparation for user scripts)

* Documentation

    * Added note to OSX platform information on using F1-F12 keyboard shortcuts on recent 
      version of OSX

      (Thanks to Jim Credland for suggestion!)

### FIX

* BSB/ObjectBuilder/Effects - When loading HSlider and VSlider's, there was a problem to load 
  the value correctly

* SoundObjectLibrary - when loading, if a PolyObject was in the library that held and 
  Instance of another SoundObject that was in the library but was to be loaded after the 
  PolyObject, an exception occurred; changed to two-pass loading strategy (bug #1639186)

* Examples - Etude did not have string-128 file in project directory


## [0.111.0] - 2007-01-17

### NEW

* Import MIDI File - Allows user to start a new blue project by importing from a MIDI file; 
  MIDI note data is converted to SCO using note templates set by user (has reasonable 
  defaults)

  (Thanks to Brent Boylan for the request!)

* Added new SoundLayerHeight options, available from popup menu activated from "V" arrow 
  button above sound layers:

    * Set All Layer Heights - sets all layers to selected height index

    * Set Default Layer Height - sets the default layer height to use for new SoundLayers

* Documentation

    * Added "Importing MIDI Files" Section

### UPDATED

* Documentation

    * Updated information on shortcuts for Score Timeline section of manual as well as Score 
      Timeline section of shortcuts page

    * Redid Preface (was very outdated)

### FIX

* Parameter Automation

    * When editing lines, was not correctly calculating max snapped value for parameters with 
      resolution set

    * When setting resolution on widgets with resolution > 0, values in lines are now are 
      remapped to closest point on resolution grid (rounding)

    * When setting value on widgets with resolution > 0, values are remapped to closest point 
      on resolution grid (rounding)

    * Sliders (HSlider, VSlider, HSliderBank, VSliderBank) now allow negative resolutions;
      negative resolutions will default to using 0.01 for the Slider's GUI, but will allow 
      any value when automated

    * HSliderBank, VSliderBank - was not adding parameters for automation correctly when 
      initially increasing number of sliders

    * Changed adding and editing of effects from mixer to use two different dialogs; adding 
      works as before an allows a cancel option, while edit no longer has a cancel option;

    NOTE: Because of the new edit dialog having no cancel option, changes to the effect are 
    made live and not when effect editor dialog is closed; previously the behavior was to 
    allow cancel of edits, but this caused a bug with parameter automation and losing 
    connection between the edited effect's widgets and its parameters

* When deleting more than one SoundLayer, SoundObject views were not correctly removed

* FindReplace Dialog would sometimes appear with text fields not laid out properly; redid 
  dialog using Matisse

* When dragging Instrument from project to library, was not making a copy

* ScoreTimeCanvas: "Select Layer", "Select All Before", and "Select All After" were broken in 
  0.110.0 from the updated change to how SoundObject Views are handled

* BlueLive

    * Conversion of MIDI note to CPS was buggy due to integer division instead of float

    * Conversion of MIDI note to PCH was incorrect and did not pad scale degree with zero if 
    < 10


## [0.110.0] - 2006-12-25

### NEW

* Parameter Automation - Editable automation of parameters (knobs, sliders, xy-controller 
  from BSB and Effects, mixer volume) on timeline (see documentation for more information, 
  also examples/features/automation1.blue for an example)

* BSB/ObjectBuilder

    * PresetManager now able to cut/copy/paste items in PresetsManager Dialog, as well as 
      able to add groups in dialog and import/export item or folder to file

    * reworked to require all object names to have unique names for their replacement values 
      and don't clash with any other object within that BSB or ObjectBuilder

### NEW/UPDATED

* Piano Roll

    * Added labels for all notes in MIDI mode (Request 1604019 by Paolo)

    * Added new green hilighter in row header for selected notes, follows selected notes when 
      moved up and down to easier show what note is currently being edited

* Redid blueLive interface, started work on MIDI SCO Pad to record MIDI data as SCO using 
  note templates (not yet finished)

### UPDATED

* Redid SoundLayer User Interface; no longer uses JTable, instead using custom panels

* Changed number of different height sizes for layers from 5 to 9

* When setting min and max values for lines and BSB Objects that have these values, better 
  checking is done and user is alerted if new boundary value crosses the other boundary, and 
  option is shown to user to either rescale the values to the new min and max, or to keep 
  values and truncate any that are outside of the boundaries to the boundary value

* Render to Disk dialog stays open after finishing

* Changed drawing strategy for TimeBar in main timeline and PianoRoll editor for speedup

* Internal

    * Reworked Note parsing and toString() methods; speed increase by about 3x (the Note 
      class is a fundamental class and this speedup should improve CSD generation time)

    * Libraries and starter scripts updated

        * ommons-lang library to 2.2
        * swing-layout to 1.0.1

    * LinePoint's y-values converted to be absolute instead of 0-1.0 relative

    * BSBWidget values converted to be absolute isntead of 0-1.0 relative


### FIX

* When using "Render to Disk" or "Render to Disk and Play", now puts quotes around output 
  file name

* ProgramOptions Setting Dialog was setting values for RealTimeRender and DiskRender settings 
  on global ProgramOptions even when window was closed or cancelled; now only saves values 
  when OK button is selected

* ProgramOptions Setting Dialog was not using saved window size correctly as it was 
  incorrectly being reinstantiated every time it was opened

* When editing line points using table from popup, setting y value was not respecting min and 
  max values

* BSB/ObjectBuilder - CheckBox item was not loading correctly from presets

* Made parsing of nchnls more robust by trimming spaces before parsing

* nchnls from realtime settings were always being used when rendering mixer code even when 
  doing disk renders


## [0.109.0] - 2006-10-07

### NEW

* Tracker SoundObject - uses Tracker paradigm of vertical tracks and note list editing; fit 
  to work with Csound SCO; see documentation for more information and usage details (example 
  added as blue/examples/soundObjects/tracker.blue)

* BlueSynthBuilder/ObjectBuilder - Added new Horizontal and Vertical Slider Bank objects, 
  allows to quickly create x number of sliders

    * added documentation to BlueSynthBuilder entry

* Python Orchestra - Added timeWarp function (takes in noteList and string with beat/tempo 
  pairs); modified Performer and PerformerGroup's performAleatorically methods to take in 
  optional timeString

### NEW/UPDATED

* For Blue's text editor, changed behavior when typing tab: instead of overwriting selected 
  text with a tab, indent lines that have selected text by prepending tabs to the lines; also 
  added shift-tab to remove leading tabs from selected lines or line where caret is currently 
  positioned if no text is selected

* CSD/ORC import

    * Now parses UDO's and add's to project's UDO list
    * Optimized code to run more efficiently

### UPDATED

* When editing library instruments, border for instrument editor turns green to help identify 
  editing object from library

* Internal

    * if External SoundObject has no commandline and no script text, return null NoteList 
      instead of throwing Exception

    * Redid SoundObject and Instrument edit panels to lazily load editors; decrease startup 
      time by not having to load until necessary

### UPDATED/FIX

* Mixer Dialog now saves location of splitpane on exit

### FIX

* CSD/ORC import: if imported file has kr set but not ksmps, will deduce ksmps as sr/kr 
  (previously ignored kr altogether)


## [0.108.0] - 2006-08-26

### NEW

* Added current play time display; when rendering in realtime, shows time in 
  hours:minutes:seconds:milliseconds format

* "Add Marker" option added to Project Menu; while rendering a project in Realtime, user can 
  add a new Marker to where the current render time is by using menu option or shortcut 
  ctrl-m (apple-m on OSX) if the currently shown project is the one being rendered

  Thanks to Menno for the request!

* Added "Audition Selected SoundObjects" to Project menu with shortcut ctrl-shift-A; if 
  SoundObjects are selected, can audition to render just the selected SoundObjects; acts 
  identically to using "Audition SoundObjects" from SoundObject popup menu, but now can use 
  keyboard shortcut

* Now able to enable or disable effects via popup menu in Mixer Dialog; disabled effects will 
  render text gray in Mixer's Effects list

### NEW/FIX

* When rendering with Csound, if Csound returns an error value blue will now show a message 
  dialog informing the user that there was an error and view the Csound Output Dialog for 
  more information; if project is set to Loop mode, upon error from Csound blue will not 
  repeatedly try to render but will show message and stop the loop render

* When using "Replace with SoundObject in Buffer" option from SoundObject popup, now will 
  replace each selected soundObject with a copy of what is in the buffer (makes for easier 
  replacement of multiple soundObjects)

### FIX

* NoteProcessorDialog's for editing NoteProcessor's on PolyObjects and on SoundLayers did not 
  have the project's NoteProcessorChainMap set, so was unable to add, insert, or remove 
  NoteProcessorChains when editing in those contexts

* PatternObject - If using "Repeat" Time Behavior without a repeat point, note generation was 
  incorrectly scaling notes to duration of last note instead of duration of pattern; note 
  durations were off and any silence at the end of the pattern would be lost (Fix was in 
  ScoreUtilities class)

* Render Time Manager, only show if file currently being rendered is the for the project 
  shown in editor

* BlueEditorPane

    * When right-clicking to show popup, should not process as if mouse clicked in the text 
      area; this would lose selection so "Add to Code Repository" was not working

    * When text is selected and using Opcode Popup to select opcode text or custom code, 
      should replace text that was selected

* When opening blue projects from version < 0.94.0, fail more gracefully if unable to restore 
  properties for properties on objects no longer there (message printed to console instead of 
  Exception thrown and load failure)


## [0.107.0] - 2006-07-17

### NEW

* User-Defined Opcode Library - Program-Wide library of User-Defined Opcodes, works like User 
  Instrument Library; Drag UDO's from project to folder node in UDOLibrary to add to library, 
  select in library and use > button to add to project

* Added "Make a Donation" link to Help Menu

* For ProgramOptions -> RealtimeRender Settings, implemented [...] buttons for discovering 
  audio in/out devices and midi in/out devices; when button is pressed, blue will try to 
  discover the available devices for the selected driver and if blue was able to find them, 
  the user will be shown a selection box from which to select the device

### UPDATED

* Updated RealtimeRender Settings Panel to only show audio and MIDI drivers that would be 
  available on users system (i.e. Windows users don't see CoreAudio as an option, Linux users 
  don't see WinMME, etc.)

* In UDO Manager, editing name of Opcode in project moved from the editor for UDO's to the 
  UDO list

* When editing library UDO, border for UDO editor turns green to help identify editing object 
  from library

* ProgramOptions - redid UtilitySettings as a separate Panel class, added ability to select 
  Csound Executable with a file selector to match how it is done in disk and realtime render 
  settings

* Documentation

    * ProgramOptions information for RealtimeRenderSettings has been updated to discuss 
      auto-detect features for audio/MIDI devices; a note has been added to make aware to the 
      user to make sure the driver is not only selected but also enabled (this note was added 
      due to user feedback on bluemusic-user mailing list; thanks!!!)

### FIX

* When selecting a group node (folder) in the User Instrument library, clear selection in 
  Orchestra and clear Instrument editor


## [0.106.0] - 2006-07-07

### NEW

* Added Dave Seidel's "Timewave Canon" and my "etude" to examples directory; reorganized 
  examples directory to organize examples by author

* Documentation

    * Added reference documentation for the Python NoteProcessor

    * Started work on documentation for building blue (developers section) with info on both 
      from src.zip and from CVS

### UPDATED

* ProgramOptions - settings for -b and -B default to OS defaults used by Csound (Linux: 
  256:1024, OSX: 1024:4096, Windows: 4096:16384) if first time using new ProgramOptions

* Updated all example files to use new render system

* Documentation

    * ProgramOptions documentation updated including information on new render settings

    * Project Properties section updated to reflect new render system

    * Rendering section updated to reflect use of new render system


## [0.106.0 beta3] - 2006-06-23

### FIX

* ProgramOptions were not saving/loading correctly causing crash due to non-existence of 
  program wide Realtime and Disk render settings


## [0.106.0 beta2] - 2006-06-14

### NEW

* New Render System

    * Many Render Settings are configurable by GUI; Program Options mostly set default 
      settings for new Projects except for realtime render settings, which are to be used on 
      a proram wide level; Projects have the option for complete override to set commandline 
      to match older workflow

* Reorganized Program Options Dialog with new settings for Rendering, added ability to turn 
  message colors on and off (off by default, which should always be set to off when using 
  with blue and the Csound Output Dialog)

* Added buttons next to Advanced Settings to open up CommandFlags documentation; requires 
  Csound Documentation Root to be set in ProgramOptions (feature requested by Andres Cabrera)

* Add SoundFile Preview to FileChooser Dialogs (Feature requested by Will Light)

* Python NoteProcessor - Use python code to process noteList generated by SoundObject; blue 
  NoteList class is introduced to python interpreter before processing as variable "noteList" 
  and that holds blue Note classes; methods for NoteList and Note are the same as in the Java 
  classes; please see Java code for NoteList and Note for more information, or also see 
  Python NoteProcessor documentation

    * example added in examples/noteProcessors/pythonProcessor.blue

 * Added shortcut (Ctrl-l) and Project menu option to toggle loop rendering for project 
   (requested by Menno)

### NEW/UPDATED

* TextArea's that use BlueEditorPane now paste for when clicking with middle mouse button 
  (requested by Andres Cabrera)

### NEW/FIX

* When opening a project using either "Open" or Recent Files menu that is already open, now 
  switches to the open project

### FIX

* For older projects, always set mixer to disabled regardless of if ProgramOptions is set to 
  enable mixer by default or not

* For projects which have no instruments in their orchestra (i.e. if a project is only using 
  Sound SoundObjects), if mixer is enabled, do not generate any mixer code as it won't be used


## [0.105.1] - 2006-04-22

### NEW

* ProgramOption added for setting Mixer enabled by default for new projects; value set to 
  default to false

### UPDATED

* blueX7 now defaults to using blueMixerOut

### FIX

* Popups for Remove/Cut/Copy on BlueSynthBuilder, ObjectBuilder, and EffectsEditor were not 
  functioning correctly; also modified popup to only show when right-click is on a selected 
  object

* On OSX, shortcuts in blue's code editor were adding an additional key type when processing, 
  i.e. typing command-x would cut the text but then insert an x, command-a would select all 
  but then insert an a and overwrite the inserted text


## [0.105.00] - 2006-04-19

### NEW

* For PolyObjects in the PolyObject bar, now can right-click and choose "Edit NoteProcessors" 
  to open up a dialog to edit the noteProcessors for that PolyObject, including the root 
  PolyObject (thus allowing applying NoteProcessors globally to a project); PolyObjects with 
  NoteProcessors will now show up as having an asterisk before their name in the PolyObject 
  bar

* For all SoundLayers in a PolyObject, now able to apply NoteProcessors to apply to all notes 
  generated by SoundObjects on that SoundLayer; new column added to SoundLayer table found on 
  left side of Score GUI marked as "NP"; info in that column shows number of NoteProcessors 
  applied to that SoundLayer; double-click column to open up NoteProcessorChain editor for 
  that SoundLayer

* For all LineObjects (LineObject, ZakLineObject, BSBLineObject), now able to edit point 
  values using table editor; when right-clicking on the LineCanvas and not on a point, popup 
  menu gives option to "Edit Points" which will then pop open a line point editor dialog for 
  the currently selected line

* Documentation

    * Added NoteProcessors section to "Concepts" part of manual

### UPDATED

* SoundObject Editor removed from SoundObject Library Dialog; to edit soundObjects, 
  double-click and soundObject editor in main frame will be used to edit (hilighted with 
  green border). SoundObjectProperty Dialog will also show properties for item, allowing one 
  to edit time properties and NoteProcessors for that library object (was not previously 
  possible)

* Mixer - if channel fader value is 0.0db, then don't apply mixer multiplication by 1.0f to 
  save one multiplication in processing

* SoundObject Library

    * When making an Instance of a SoundObject from the SoundObject library, Instance object 
      now copies background color of SoundObject

    * Library shows short name for type of SoundObject (i.e. "GenericScore" instead of "blue.
      soundObject.GenericScore")

* For OSX, switched from using hard reference to CTRL key to using Toolkit.
  getMenuShortcutKeyMask(); shortcuts should now use Command key instead of CTRL on OSX (may 
  still need further work)

* Removed Print option from File Menu

* Documentation

    * Further explained SoundObjects in SoundObjects section of "Concepts" part of manual

### UPDATED/FIX

* TempoMapper now used when reading time from Csound and updating blue's time pointer; 
  supports t-statements if found in global sco section of globals editor

  (Thanks to Istvan Varga and Victor Lazzarini for their help!)

### FIX

* Some places where float values were very close to zero were outputting values as scientific 
  notation, consistent with Java but inconsistent with Csound; areas fixed included the Note 
  Class for duration (p3), LineObject and ZakLineObject, and BSB Objects in both compilation 
  phase and also in their UI's (Knob, HSlider, VSlider, XYController, Line)

* Mixer channel fader values were saved but not loaded correctly, also values were properly 
  set for faders but the label was not being updated

  (Thanks to Will Light for reporting this bug!)


## [0.104.3] - 2006-03-19

### NEW

* New options added to EffectsPopup for Mixer:

    * Add New Effect - Adds a new effect directly to project, using Effect Editor Dialog to 
      edit

    * Open Interface for Effect - opens the GUI for the effect (same operation as 
      double-clicking effect)

    * Edit Effect - Edits the selected effect using Efect Editor Dialog

  (Thanks to Kevin Welsh for the requests!)

* If SoundObject has Time Behavior of Repeat and Repeat Point is used, SoundObject Renderer 
  now renders triangles to show where the SoundObject repeats

### NEW/UPDATED

* Settings for Windows and Dialogs (x, y, width, height, splitter locations, etc.) are now 
  saved (used to be only x, y, width and height of main frame)

### UPDATED

* When using blueShare to import effects, effects are now imported into "Imported Effects" 
  Group

### FIX

* Changed horizontal scrollbars for Mixer channel effects bin to use smaller size (like their 
  vertical scroll bars)

* Use of MessageFormat for outputting Mixer fader values defaulted to user's locale, which 
  for some locales resulted in number formats where "," is used for decimal point instead of 
  "." which Csound expects

* When importing Effects from project into library, Library dialog would not show imported 
  effects if it was previously opened until next restart of blue

* When removing effects or effect groups in Effects Library, now clears out Effect Editor so 
  that no editing for an effect that's been removed will be there


## [0.104.2] - 2006-03-17

## FIX

* Mixer was not generating correct Csound code; blueMixerOut was not mixing signals but doing 
  simple equals, resulting in only allowing one note instances signal out into the mixer 
  chain; fixed to mix and also clear signals at end of chain

* ZakLineObject was not generating correct line generating instruments for different zak 
  channels so that signals would all go out the same zak channel

  (Big thanks to Will Light for reporting the above bugs!)


## [0.104.1] - 2006-03-16

### FIX

* Code and Comments were not being saved when editing Effects


## [0.104.00] - 2006-03-14

### NEW

* Effects System added to Mixer; create graphical UI's and code with Csound to create Effects 
  which can be added pre-/post-fader to mixer Channels, SubChannels, and Master channel; 
  Effects are created and managed in the Effects Library, and one can trade Effects through 
  blueShare (please view updated documentation on the Mixer for more information)

* Mixer option for Extra Render Time added; user can set to add extra time end of score here 
  so that effects with time delay (such as reverbs) will have enough time to finish out 
  processing

* Added limited undoability on add/remove of instruments in orchestra; will not work if 
  instrument id changes, good for undoing an immediate mistake

### UPDATED/NEW

* Documentation

    * Mixer documentation expanded to explain Effects system and Extra Render Time

### UPDATED/FIX

* When rendering CSD to disk or file, use disk render settings which also prevents blue 
  timepointer instrument from being generated

### UPDATED

* examples/features/mixerText.blue renamed to mixer.blue; example now uses Effect on Master 
  channel as well as demonstrates using extra render time

* Documentation

    * Pch generation options for PianoRoll were further expanded upon to include information 
      on the MIDI option

### FIX

* Score Navigator was causing errant adjustments when resizing the navigator dialog

* BSB Vertical Slider was not correctly loading saved height value
  (Thanks to Kevin Welsh for the bug report!)

* Mixer was outputing scientific notation for multipliers when fader values were <= -60db 
  (Thanks Menno for the bug report!)

* Pasting of soundObjects from copy buffer after changing timeline zoom caused incorrect 
  start times for pasted soundObjects

* Using Shift soundObject option sometimes resulted in NullPointerError if right after a 
  selection made


## [0.103.00] - 2006-02-23

### NEW

* "Set Color" menu option added to SoundObject Popup on Score Timeline; allows to set color 
  of all selected soundObjects

* SoundFont Viewer Dialog completely reworked to use tables to show instruments and presets 
  in SoundFont

* PianoRoll

    * Added MIDI pitch generation option; disregards scale and uses MIDI values (0-127; 60 = 
      C5 = Middle-C); outputs midi note number for <FREQ>

* FTable Converter - available from the Tools menu, this utility converts ftable statements 
  (f-statements) into ftgen statements; based on the author's web page utility at:

  http://www.csounds.com/stevenyi/ftable.html

* Documentation

    * SoundFont Viewer documentation added to Tools section

    * FTable Converter documentation added to Tools section

### UPDATED

* Internal

    * Processing order of Instrument methods has changed to accomodate new CSD render order; 
      new order documented in Instrument.java

### UPDATED/FIX

* SoundFont Viewer code was only grabbing from stdout pipe; csound5 changed to use stderr for 
  printing messages; code changed to grab from both stdout and stderr to work with csound5 as 
  well as csound versions based on csound4; code for grabbing redone to prevent lockups on 
  Windows

### FIX

* Mixer was not respecting nchnls set in project

* BSBFileWidget was not saving textFieldWidth property correctly

* Tooltips for ScoreTimeCanvas were showing incorrect information for duration and end time

* CSD Rendering order reordered so that global duration (duration of generated score 
  (equivalent to <TOTAL_DUR>) and also duration of sco in global sco) is calculated 
  correctly; timepointer now scrolls for duration of complete score time


## [0.102.00] - 2006-02-19

### NEW

* Render Time shows when rendering in realtime (moving orange line); settings for animation 
  rate and adjustment for latency added to ProgramOptions (see documentation for more details)

* "Audition Selected SoundObjects" option added; when right clicking on a selected 
  SoundObject, new Audition option available to render selected SoundObjects using Real-Time 
  settings; quickly listen to individual SoundObjects or sets of SoundObjects.  To stop 
  auditioning, click anywhere on the ScoreTimeline or use the stop button.

* Added Program Options for Disk Render defaults, reorganized panel to separate out Real-Time 
  Render Defaults, General Defaults

* Added Program Options for Utility; Csound Excecutable is used by blue for what to call when 
  doing utility methods such as freezing or for the SoundFont Utility; Freeze Flags used for 
  when freezing, so user can set to choose settings (i.e. use Float 32-bit instead of default)

  (Freeze Flags suggested by Bill Beck)

* Support for Csound Score Expressions (see http://csounds.com/manual/html/ScoreEval.html)

    * NOTE: @ and @@ are not yet supported

* "Reverse" option added to SoundObject Popup; reverses in time the selected SoundObjects

* Documentation

    * new "Auditioning SoundObjects" section added to "Other Features"

    * Mixer documentation added

### UPDATED

* ToolTip for ScoreTimeCanvas now shows name of SoundObject

* Documentation

    * ProgramOptions documentation updated for all of the latest options and with new 
      screenshots


## [0.101.00] - 2006-01-08

### NEW

* AudioFile dependency check done when opening files; for all AudioFile soundObjects that 
  have references to files which can not be found, a dialog now shows where users can set 
  replacement files for the missing files by double clicking the row and choosing the file 
  from a file chooser dialog

* "Import from ORC/SCO" option added from File menu

### NEW/FIX

* Bracket matching in text editor was not showing due to it defaulting to the color black 
  (same as background); now set to match user's setting for default text color

* On Score Timeline, when a group of soundObjects are selected, it is now possible to 
  deselect a selected soundObject by shift-clicking it

### UPDATED/FIX

* Text hilight color for selected text was too bright in BlueEditorPane

### FIX

* BlueEditorPane was not correctly calculating length of lines; was not considering number of 
  characters each tab expands to

* CSD Import - ksmps was not being parsed from CSD's

* Set minimumSize on BlueEditPane to 0,0 so that split panes that held objects using 
  BlueEditPane could resize down to zero

* Sound soundObject did not use Csound syntax hilighting in editor


## [0.100.00] - 2005-12-11

### NEW

* New examples added:

    * examples/soundObjects/external\_commonMusic3.blue

    New example for using CommonMusic with blue via the External object contributed by 
    Stephane Boussage

    * examples/features/soundObjectLibrary\_twelveTone.blue

    Example showing usage of SoundObjectLibrary, also some python script

    * examples/scripting/feldman.blue

    Demonstrates usage of python script to emulate Morton Feldman's early composition graphic 
    score technique

    * examples/soundObjects/lineObject2.blue

    Another lineObject example that shows using lineObjects to control frequency cutoff of 
    filters

* Add "Select All Before" and "Select All After" menu options to SoundLayer popup to be able 
  to select soundObjects before or after where point clicked

* Removed Emacs shortcuts in BlueEditorPane, removed from Program Options as well

### NEW/UPDATED

* BSBLineObject

    * Removed isCommaSeparated and replaced with Dropdown option to choose separator type; 
      options include None, Comma, and Single Quote; the new Single Quote option allows for 
      using the generated text in Csound Macro calls

    * Added Lock Points option; when points are locked, new points can not be added and old 
      ones can not be removed, but existing points can still be modified

    (Thanks to Bill Beck for the suggesting the above!)

### UPDATED

* Added "Select Layer" menu option to SoundLayer popup (still able to use double-click on 
  soundLayer to select all soundObjects on that layer)

* Replaced text editor with one based on JEditTextArea

    * now supports syntax highlighting in other syntaxes

    * PythonObject and PythonInstrument syntax highlight for Python

    * RhinoObject and RhinoInstrument syntax highlight for JavaScript

    * External SoundObject allows choosing syntax type from popup menu (defaults to Python)

    * ObjectBuilder SoundObject highlights in Python when not set to External; when set to 
      External, allows syntax type options from popup menu (defaults to Python)

    * Fixed bugs with semi-colon text area commenting

    * Faster hilighting

* Changed save behavior; if file has not yet been saved, using ctrl-s and the menu option was 
  previous disabled; now it is usable, but if not yet saved, will perform the same operation 
  as the "Save As" menu option

* Removed blueSoundFileManager starter scripts

* Allow opening multiple .blue files

### FIX

* FrozenSoundObject was generating an instrument that used either "out" or "outs" opcode; 
  this did not work for projects with more than 2 channels, so for any frozen sound object 
  that uses more than one channel, use "outc" opcode instead

  (Thanks to Bill Beck for finding the bug and letting me know what the appropriate fix is!)

* Freezing feature badly assumed that the only files in the directory where a project was 
  that were named starting with "freeze" were those generated by blue; would cause 
  NumberFormatException and not freeze a soundObject

* When selecting item in User Instrument Library, if item was selected in Project Orchestra 
  table, it would properly deselect it, but it would also do another call to clear the 
  selection in the User Instrument Library

* BlueEditorPane - Inserting text that replaced current word was doing so by one character 
  too early (would chomp newline of previous line)

* ZakLineObject and LineObject - AbstractLineObject base class had incorrect caching system 
  for caching instruments and tables, resulting in wrong control signals being generated if 
  lines had same table values but different line variable names

* UDORepositoryBrowser was not able to run on Java 1.4 as code was using Java 5 code for 
  setting layout and adding to content pane

* Prevent IndexOutOfRange error when selecting layers


## [0.99.9] - 2005-11-13

### NEW

* Examples for using CommonMusic with blue via the External object donated by Ben McAllister 
  and Stephane Boussage added to examples/soundObjects

* BlueEditorPane - "Add to Code Repository" option added to popup menu so that user can 
  select some text, select option, enter code snippet name and choose category from popup 
  dialog, and have code snippet added to code repository straight from editor

* BSBLineObject - Usable within BSB and ObjectBuilder, allows line editing and values to be 
  generated; configurable for different contexts; example and documentation added

### NEW/UPDATED

* Documentation

    * Added basic documentation for BSB XYController, Dropdown List, and LineObject
    
### UPDATED

* Sped up loading of BSB Instruments and ObjectBuilder soundObjects by removing unnecessary 
  revalidate() and repaint() calls when building interface

* Documentation

    * updated pictures, added more information for User-Defined Opcode Manager

* Internal

    * Updated MySwing library to November 9th, 2005 release

### UPDATE/FIX

* Upper Right Hand Corner buttons in Score ScrollPane, PianoRoll Editor ScrollPane, and 
  PatternObject ScrollPane were not rendering "<" text arrow; replaced with togglebutton 
  using arrow icons

### FIX

* Spaces in directory path's were causing problems for soundObject freezing and AudioFile 
  soundObject

* Presets were not working for BSB or ObjectBuilder

* Added konqueror to list of web browsers tried when open URL's withN blue (documentation, 
  opcode help, etc.)

* Label for "Request a Feature" option in Help menu was labeled as "Help"


## [0.99.8] - 2005-09-30

### NEW

* ObjectBuilder SoundObject - uses BlueSynthBuilder widgets for a UI and either python 
  code or external code to allow users to build their own soundObjects; python code 
  works as in pythonObject and "score = myScore" required; external code works as in 
  External Object; can convert existing PythonObject and External SoundObjects to 
  ObjectBuilder via soundObject popup menu

    * Example added in examples/soundObjects folder

    * Documentation added to User Manual

* Added initial examplePlugin "Plugin SDK" to all release files

### UPDATED

* Drawing code for timebar redone to not draw time labels ifNzoomed out enough to cause 
  labels to overlap (for Score Timeline and PianoRoll timeline)

* ExternalObject - Added undo, redo, and shorcut for testing soundObject, respectively 
  accessed by ctrl-z, ctrl-shift-z, and ctrl-t

* Internal

    * Changed adding of instrument to orchestra to defer instantiation until when adding a new instrument

### FIX

* Align soundObjects option was not working unless soundObjects on timeline were moved and motionbuffered; now works immediately after selection

* Internal

    * Continuing to fix up jar plugin code

* Fixed bug in PluginLoader where it would read only part of the jar's data into the 
  byte buffer before defineClass.

  (Contributed by Michael Bechard)

* Fixed plugin classes not being found by default classLoader via the forClass method; a 
  reference to the PluginLoader is necessary.

  (Contributed by Michael Bechard)


## [0.99.7] - 2005-09-05

### NEW

* Added Toaster project classes to pop up message in lower right; used currently when 
  "Rendering to disk" (needs work, seems to show on Windows but not on Linux)

* LineObject - tables generated for lines in LineObject are cached so that if a 
  generated table matches exactly another one already generated, the first one is reused 
  (i.e. ten instances of a LineObject in the library on the timeline will only generate 
  those tables once when compiling a CSD)

* Added pushing up and down of UDO's in UDO Table

* BlueSynthBuilder - XY Controller - emits two values, one for x and one for y value; 
  replacement value in instrument code is the XY Controller's ObjectName + "X" and "Y" 
  for x,y values respectively

### NEW/UPDATED

* Internal

    * Reorganized CVS structure to work with Maven build tool, website now built with 
      Maven

### UPDATED

* BlueSynthBuilder - BSBObjects may emit more than one replacement value, so when using 
  ctrl-shift-space in the code editors, now shows what replacement values are available, 
  not just objectName's (though, for most cases besides the XY Controller, the BSBObject 
  does only use the objectName)

* Internal

    * Continuing with refactoring of code to Actions

### FIX

* SoundObjects were not getting sorted in their SoundLayers before rendering out to CSD, 
  breaking assumption that soundObjects would generate in time order

* SoundObjects in SoundObject Library did not have all generate methods called, only 
  generateNotes, breaking compilation for soundObjects that relied on other generate 
  functions being called first to do internal precompilation (i.e. LineObject)

* Soundfiles in SFDIR were not being found correctly; redid search for Environment 
  Variables using code from http://www.rgagnon.com/javadetails/java-0150.html

* Internal

    * Jar Plugin Class Loader fixed


## [0.99.6] - 2005-08-11

### NEW

* Added Markers and MarkersList; can add markers to timeline by shift-clicking on 
  timebar, change marker time by clicking and dragging.  Can set properties of marker by 
  using Markers List, available from Windows menu or Shift-F4.  Can set start time to 
  marker time as well as delete marker by using right-click on table to open popup. 
  Names of markers show up current as a tooltip when rolling over the marker on the 
  timeline. Can move to next and previous marker on ScoreTimeline by using <| and |> 
  buttons.

* Added Score Navigator; navigate score timeline using mini-window (shortcut of Shift-F3 to open/close the window)

* Added incremental search from MySwing to BlueEditorPane

    * ctrl-i = Case-Sensitive Search
    * ctrl-shift-i = Case-Insensitive Search

* Internal

    * Added myswing project jar

### UPDATED

* Added undoability to BlueSynthBuilder text editors

* Improved performance of ScrollableOutputTextArea, used by console output windows when 
  rendering

* When setting RenderStartTime, RenderEndTime, or dragging Markers, now will scroll the 
  time line

* Internal

    * BlueEditorPane reworked to use Actions

    * Beginning to redo code base using Actions

### FIX

* Shortcuts for tabs (ctrl 1-7) were not correct and did not have shortcut for UDO Tab

* Render to Disk and Play - File was not being found in SFDIR correctly

* Fixed minimum value of sliders being ignored if set to something other than zero.
  (Author: Michael Bechard)

* Made BSB knobs and sliders not able to set their minimum values greater than their 
  maximum values and vice versa.
  (Author: Michael Bechard)


## [0.99.5] - 2005-08-04

### NEW

* Documentation

    * Glossary added for blue terminology

### UPDATED

* Added undoability to BlueSynthBuilder text editors

* Added undoability to UDO editor

### FIX

* Was not able to drag soundObjects between layers

* Default Ksmps was not being set for new projects

* Render End Times were not being respected

* Freezing soundObjects would push their startTime to zero


## [0.99.4] - 2005-07-29

### NEW

* "Render to Disk and Play" option added; renders to disk and then plays using blue's 
  own SoundFileManager

* Shortcuts added:

    * Shift-F9 - Render to Disk and Play
    * Ctrl-Shift-F9 - Render to Disk

* Added current time/duration display to AudioFileManager's player

* Added variable completion to code completion feature in BlueEditorPane; if using 
  ctrl-space with a word that starts with i-, k-, a-, gi-, gk-, or ga-, will look for 
  variables within instrument that are defined before hand and added to completion match 
  list

* Added cut/copy/paste/remove menu options to popup menu for Orchestra table (accessible 
  by right-click)

* Python Orchestra Library

    * Added optional randStartOffset to PerformerGroup::performAleatorically to 
      randomize in given range each performer's start time of performing the given line. 
      Value initialized to zero.

    * Added optional startOffset parameter to Performer::performAleatorically so that 
      performer can be told to start at a later time (parameter works with 
      PerformerGroup::performAleatorically).  Value initialized to zero.

* Added same shortcut keys for timeline zooming on score time canvas to PianoRoll (see 
  timeline zoom for shortcuts, both sets are available)

* Documentation

    * Added section on rendering blue projects

### UPDATED

* Extra set of zoom shortcuts were added for those with conflicts of shortcuts with 
  their window manager

    * ctrl-equals - increase horizontal zoom
    * ctrl-minus - decrease horizontal zoom
    * ctrl-shift-equals - increase vertical zoom
    * ctrl-shift-minus - decrease vertical zoom

* Documentation

    * Added shortcuts for selecting soundObjects on layer, rendering, and Zoom

### FIX

* BlueShare - on Import, was not showing display due to bad key lookup of 
  internationalized text

* RenderStartTime and RenderEndTime were not updating visually when zooming the timeline

* ScratchPadDialog - Word wrap was not being properly set when project opened

* Fixed Java SDK v1.4.2 incompatabilities
  (Author: Michael Bechard)

* "common.error" language resource missing, used by BlueShare when login fails
  (Author: Michael Bechard)
  
* When using any LineObject, two points vertical to each other could be computed with a 
  negative duration
  (Author: Michael Bechard)


## [0.99.3] - 2005-07-21

### NEW

* ZakLineObject - LineObject for generating values that work with Zak

  (Contributed by Michael Bechard)

* Added Disk Render Options to Project Properties to allow for different options when 
  rendering project to sound file on disk than when rendering in realtime(i.e. use 
  64-bit csound, different sr, ksmps = 1, etc.)

* Render to Disk option added to File menu; uses Disk Render Options from Project 
  Properties to generate CSD and call user-given command line, with the assumption that 
  the user-given commandline is one that renders to disk

* Double-clicking soundLayer in scoreTimeline will clear soundObject selections and 
  select all soundObjects on that layer

* Documentation

    * Added documentation on command blocks for global orchestra code in instruments

    * Added documentation for SoundObject Library

### UPDATED

* CsoundOutputDialog - no longer shows on begining of render; user able to hide/show the 
  dialog by using the "Windows-\>Csound Output Dialog" menu option or using the F7 
  shortcut

* Upgraded Jython library to 2.2alpha1 (fixed random bugs with PythonObject and Java 5)

* Removed CsOptions from Project Properties, no longer generated to CSD

* Documentation

    * PatternObject - added more notes on when using time behavior of Repeat or Scale

### FIX

* LineObjects that did not have color values were throwing NullExceptionErrors

  (Contributed by Michael Bechard)

* Added commons-lang-2.0.jar to starter scripts; without it, bugs were showing up in 
  BlueSynthBuilder instruments, possibly elsewhere

* CsoundOutput was getting cut off prematurely when process exited

* Made message dialogs opened from BlueMainFrame properly modal

* Multi-line comments /\* \*/ in scores was not being parsed correctly when generating NoteLists

* BlueSynthBuilder - exception was thrown when dragging mouse but not initiating with 
  left click (i.e. if you right-clicked to open the window but dragged before releasing)

* Documentation

    * Fixed python example in scripting tutorial 
      (bug reported by Andres Cabrera)


## [0.99.2] - 2005-07-15

### NEW

* CsoundOutputDialog - shows output from Csound when rendering instead of to console.  
  Option able to be set from ProgramOptions.

  (Contributed by Michael Bechard)

* Now able to change color of SoundObjects on timeline (editable on soundObject property 
  dialog)

* Python Orchestra Library - added TwelveTET subclass of Tuning class for convenience

* Internal

    * ColorCellEditor added

### NEW/UPDATED

* Internal

    * SoundObjectEvent and Listener classes introduced for event notification of 
      property changes on soundObject; redid many classes to use new event notification 
      system

### UPDATED

* Shortcuts for zooming the timeline modified to be international friendly:

    * ctrl-right - increase horizontal zoom
    * ctrl-left - decrease horizontal zoom
    * ctrl-down - increase vertical zoom
    * ctrl-up - decrease vertical zoom

* LineObject

    * Now creates unique line number name when adding lines
    * Disallow giving multiple lines the same name in the same LineObject
    * Adds init statements when generating for CSD, initializes to zero
    * User can now edit line colors

* Documentation

    * Andres Cabrera's First Project Tutorial updated

    * Added shortcuts for nudging, zooming timeline, and changing managers

    * New screenshot and information for selecting color for reference entry on 
      LineObject

* Internal

    * All SoundObjects now extend from AbstractSoundObject instead of directly 
      implementing SoundObject

    * Note no longer implements SoundObject

### FIX

* Render start and loop times now update when timeline zoomed

  (bug submitted by Kevin Welsh)

* Properly update SoundObjectPropertyDialog when nudging objects or moving and resizing 
  with mouse

* Nudge with left arrow key of SoundObjects would not allow for nudging all the way to 
  zero

* When ColorSelectionPanel opens ColorChooser, dialog is now properly modal


## [0.99.1] - 2005-07-10

### NEW

* Now displays render loop time in main tool bar
  (suggested by Kevin Welsh)

* Shortcuts for zooming the timeline (timeline or soundobjects must have focus for these 
  to work):

    * ctrl-equals - increase horizontal zoom
    * ctrl-minus - decrease horizontal zoom
    * ctrl-shift-equals - increase vertical zoom
    * ctrl-shift-minus - decrease vertical zoom

    (suggested by Kevin Welsh)

* Shorcuts added to switch managers (tabs)

    * alt-left - previous manager
    * alt-right - next manager

    (suggested by Kevin Welsh)

### FIX

* Orchestra Manager - If instruments shared an Instrument ID, if the user wanted to 
  change the ID of an instrument that was not the first one with that ID, when going to 
  change it would incorrectly change the ID of the first instrument with that ID


## [0.99.0] - 2005-07-09

* Now able to Paste SoundObjects as SoundObjects in addition to being able to paste as 
  PolyObjects; ctrl-click now shortcut for paste soundObjects and shift-click is now for 
  pasting as PolyObject

* PatternObject SoundObject - a pattern-oriented score editor, based on the author's 
  previous project "Patterns".

* AutoBackup - temp backups of open projects are now genereated every minute.  If blue 
  quits unexpectedly, those files will remain, otherwise on normal closing of the file 
  they are deleted.  If on opening a file a backup if found with a date newer than the 
  original file, the option to open from the backup or the original is given.

    * If the backup is chosen, it is required to use "Save As" to save over the original 
      file or to a new file.  At that point the backup is deleted.

    * If the original file is chosen, then the backup file will be overwritten the next 
      time the autobackup thread runs.

      (Feature suggested by Bill Beck)

* Menu option and shortcut added for switching projects

    * Ctrl-Shift-Page Up - Previous Project
    * Ctrl-Shift-Page Down - Next Project

    (On OSX, use Command instead of Ctrl)

* Documentation

    * PatternObject SoundObject reference documentation added

    * "AutoBackup and Recovery" section added to "Other Features" section

### UPDATED

* Documentation

    * Shortcuts for new and old paste operation

### FIX

* "Convert to GenericScore" option did not create instruments or generate score correctly

* If render start time and end time was set, score may not have been generated correctly 
  when rendering CSD (notes with negative start times would be generated if render start 
  time was within a soundObject; did not affect if render start time was 0 or not within 
  a soundObject)


## [0.98.4] - 2005-06-26

### NEW

* GenericInstruments in Orchestra can now be converted to Blue Synth Builder Instruments 
  by right-clicking and choosing "Convert to BlueSynthBuilder"

### UPDATED

* Internal

    * Removed JScrollerBar and replaced with Santhosh Kumar's MyScrollPaneLayout

### FIX

* When removing instrument from Orchestra, now clears out editor

* ScannedSynthesisMatrixEditor did not properly open due to bad key when looking for 
  resource label

* Generating CSD with .blue file that had spaces in name or spaces in directory name 
  would cause error (rewrote Runtime.exec call)

* TuningProcessor was unable to open Scale Selector due to bad key lookup in language 
  files

* Orchestra Panel - when rolling over blank area, toolTip would throw IndexOutOfBounds 
  exception


## [0.98.3] - 2005-05-03

### NEW

* UDO Manager - Import from UDO Repository - using "I" button will open up a UDO browser 
  that will connect to the repository on csounds.com; user is then able to browse the 
  collection, and if finding a UDO they like, they are able to import directly to the 
  current blue project

* Changed default memory for JavaVM in starter scripts to 32meg initial and 256meg max

### UPDATED

* jython.jar replaced

### FIX

* All dialog popups now properly modal (i.e. generating CSD to screen, 
  soundObjectExceptions

* Render loop time correctly draws itself when opening a document


## [0.98.2] - 2005-05-25

### FIX

* UDO Manager

    * Made it capable of right clicking anywhere in table's area, not just on row items

    * When opening up projects prior to 0.98.1, if project had no UDO's, was causing a 
      Null pointer exception and preventing opening of project

* Orchestra Manager - When removing instrument from orchestra, table would not update 
  correctly


## [0.98.1] - 2005-05-21

### NEW

* UDO Manager - User-Defined Opcodes now managed with a list and editor; can cut/copy/
  paste items via popup menu using right-click

  When opening older projects, blue will parse existing UDO text, stripping comments not 
  found within UDO code bodies

* BlueEditorPane - add/remove line comments (";") to a line or selected lines by using 
  ctrl-; or ctrl-shift-;

### UPDATED

* Manual

    * updated shortcuts reference for text editor: added shift-F1 for opcode help 
      lookup, ctrl-; for commenting lines, and ctrl-shift-; for uncommenting lines

    * Updated UDOManager documentation

### FIX

* SoundObjectProperty Dialog and SoundObjectLibrary Dialog were not staying on top


## [0.98.0] - 2005-05-16

### NEW

* Loop Render and Render Stop Time - using right mouse button instead of left in setting 
  the time on a root polyobject will set a yellow line for when to stop rendering (green 
  line is render start time); setting to loop mode before rendering will re-render the 
  project immediately after a render stops.  This allows one to render in a loop and 
  while listening, make a small change, and hear the change in the next loop (file is 
  always recompiled to CSD between renders)

* Rewind button - sets renderStartTime to 0.0 and clears renderEndTime

* Internal

    * Only call generateNotes, generateFTables, generateInstruments, and generateGlobals 
      for SoundObjects which could possibly contribute notes to the final CSD (if 
      soundObject's startTime < renderEndTime && soundObject's endTime > renderStartTime)
      ; speeds up renders of project when using renderStartTime and renderEndTime by not 
      calling those methods unnecessarily

### UPDATED

* When generating CSD to file (ctrl-g), use same renderStartTime and renderEndTime as is 
  currently set in the project


## [0.97.1.2] - 2005-05-13

### NEW

* Internal

    * Unit tests added for Instruments

    * testLoadSave added to unit tests for SoundObjects and NoteProcessors

### FIX

* PythonInstrument and RhinoInstrument was not returning an instance of PythonInstrument 
  on loadFromXML

* RandomAddProcessor was returning instance of RandomMultiply on loadFromXML

* RandomAddProcessor and RandomMultiplyProcessor were saving max as min in XML and not 
  saving max field


[0.97.1.1] - 2005-05-12

### FIX

* reverted to using older starter scripts as problems affected jython


## [0.97.1] - 2005-05-12

### NEW

* blueX7 - now able to take in either pch or frequency for p4; able to be used with 
  PianoRoll (set to frequency output)

* Added Transposition property to PianoRoll Properties editor to transpose by x number 
  of scale degrees

* Internal

    * Added testXML target to Ant build file to check documentation xml with xmllint

### UPDATED

* FindReplaceDialog - implemented search direction, case sensitivity

* Drag and drop of sound file onto ScoreTimeLine will use relative path if within 
  project directory

### FIX

* When doing "Save As", update current project directory to where file is saved to


## [0.97.0] - 2005-05-09

### NEW

* Added Start Time, Duration, and End Time to SoundObject tooltips

* Added SplashScreen

* Find/Replace Dialog added to BlueEditPane; open with ctrl-f

* Python SoundObject - Now catching PyExceptions (exceptions from running python code, i.
  e. undefined variables, bad syntax, etc.) and displaying to user via 
  SoundObjectException display dialog

### UPDATED

* AudioFile editor now sets selected file as relative to project directory if it is 
  contained in the project dir or in subdirectory below

* Updated colors of icon to match theme

* Removed "Open as Instrument Library" as it is no longer useful

* When selecting an instrument in the User's InstrumentLibrary or Orchestra, deselect 
  any items from the other (makes knowing what the currently edited instrument is easier 
  to see)

* Internal

    * Removed BlueMainFrame as argument to ScoreGUI; using SwingUtilities instead to 
      find reference

    * Made BlueMainFrame lazily initialize dialogs

* Manual

    * Reorganized document and folder structure, sections broken out into subdirectories 
      with top.xml files

    * Added --nonet to call to xsltproc

    * Changed to use Docbook42 dtd's now included with blue to make document processing 
      self-contained; together with --nonet, allows document building to not require a 
      net connection

### FIX

* Blue was not setting if save allowed correctly (Save menu option)

* Import from CSD was not updated to use new user instrument library setup; caused null 
  pointer exception and did not work


## [0.96.1] - 2005-04-29

### NEW

* blueShare - added meta category to show latest ten instruments

* Added "Use Default" button to ProgramOptions commandline area that will set the 
  Command Line to the value set by the user in the Program Options

### FIX

* LineObject - fixed bad allocation of array size that broke object's compilation to CSD

* Modified PolyObject editor to call all necessary methods of SoundObject to get 
  testSoundObject method to work properly


## [0.96.0] - 2005-04-26

### NEW

* ToolTips added

    * In Orchestra Table, shows type of Instrument
    * In User InstrumentLibrary, shows type of Instrument
    * In ScoreTime Canvas, shows type of SoundObject

* SoundObjectExceptions - wraps NoteProcessorExceptions and other errors and display to 
  users if any SoundObject has an error that prevents valid CSD construction

* NoteProcessorExceptions - NoteProcessors now throw exceptions when there is an error 
  in their usage, with message dialog explaining the error (Michael Bechard)

* Python Orchestra Library

    * CreateNoteList function added to python orchestra library, convenience function to 
      parse csound score-like text, able to handle + and . syntax

    * Fixed to work with tied notes (negative p3's)

* When tables and tree are used in editing, made sure to cancel edits when swapping 
  models, to ensure what's viewed is accurately reflecting data

* BSB File Selector Widget - replace backslashes ("\") with forward slashes ("/") when 
  generating value (fix for Windows users)

### Internal

* Removed ArrangementTableModel, made Arrangement implement TableModel


## [0.95.0] - 2005-04-04

### NEW

* User InstrumentLibrary - per-project instrument libraries were removed and a User 
  InstrumentLibrary was created.  The User InstrumentLibrary is available across 
  projects and is stored in user's .blue directory.  (See Documentation for more 
  information)

* Use of kr removed from blue; ksmps now used, should calculate ksmps for older projects 
  where kr is defined

* BlueSynthBuilder - Presets functionality added; able to save snapshots of UI settings 
  as presets as well as organize into folders

* ProgramOptions - Text Colors for BlueEditorPane are now user settable (may need to 
  alter text in BlueEditorPane's to see change in color)

### UPDATED

* blueShare now only imports/exports to User's InstrumentLibrary

* Removed bluePatterns startup scripts

### FIX

* When using Orchestra table, if an instrument is selected, moving up and down the table 
  using up and down keys will show the editor for the instrument hilighted

* When editing of Instrument names in library, now properly resizes display to show full 
  name if name was longer than previously named

* When converting groups of SoundObjects to a PolyObject, layer index and order now 
  preserved (was assigning one soundLayer per SoundObject)

* ScoreUtilities - getBaseTen was not handling case where scores with trailing and 
  leading periods (Michael Bechard)


## [0.94.0 beta 15] - 2005-03-17

### NEW

* UndoableEdits added for GenericEditor for Instruments and SoundObjects; Undo manager 
  is available for object while editing and in focus; if you go from one object, then 
  leave, then come back, can not undo (only while editing current object); temporary 
  solution but helpful for accidental deletes, etc.

* SoundObject - RepeatPoint - SoundObjects now have an optional time value for setting 
  at what point to start repeating when using time behavior of "Repeat"; for more 
  information, consult user's manual (Feature suggested and originally implemented by 
  Michael Bechard, modified by Steven Yi)

### UPDATED

* CeciliaModule disabled (can reenable by editing blue/conf/registry.xml)

* ScoreTimeCanvas - Only show soundObject menu when rt-clicking on a soundObject which 
  has already been selected

* PianoRoll - Rt-click on selected notes brings up popup menu to remove notes

* PianoRoll - added zooming of noteHeight and pixels per time value

* Italian language files submitted by Gabriel Maldonado

* Japanese language files submitted by Takashi Fukui

* French language files submitted by Stephane Boussuge and Jean Argenty

### FIX

* Undos - reenabled capturing of style changes in undoable edits, was causing 
  intermittent errors when trying to undo/redo; implemented new UndoManager to do all 
  style changes associated with an edit so that undo/redo works as one would expect

* CSD Import - blue was not able to import scores using "." and "+" when importing using 
  "Import Score and Split into SoundObjects by Instrument Number"


## [0.94.0 beta 14c] - 2005-02-17

### UPDATED

* Spanish language files updated by Roberto J. Osorio-Goenaga

* PianoRoll - Note entry changed to shift-click (was rt-click)

* Moved HTML documentation to documentation/html; helps to make PDF manual easier to find

* All strings externalized for internationalization

### FIX

* CeciliaModule - time behavior now applied correctly before scoreStartTime

### Internal

* Removed blue.undo.blueUndoGroup, replaced with HashMap (more versatile)


## [0.94.0 beta 14b] - 2005-02-15

### UPDATED

* BSB - Knob - made label editable by double-clicking; for easier setting of exact values

* Marquee Selection - draws marquees without alpha background by default; can set to 
  draw with alpha from ProgramOptions (drawing without alpha speeds up selection 
  performance greatly)

### FIX

* PianoRoll - prevented insertion of note where notes exist

* LineObject - start times of notes were not being set to start of soundObject

* ScoreTimeCanvas - convert to generic score did not import generated isntruments into 
  instrument library correctly

* ScoreTimeCanvas - now sizes correctly on startup and when viewport resized


## [0.94.0 beta 14a] - 2005-02-05

### FIX

* LineObject - allow float values for max and min


## [0.94.0 beta 14] - 2005-02-04

### NEW

* Dave Seidel's piece "The Gemini Nebula" added to examples/pieces

* When outputting CSD file, author, title, and notes from project properties are now 
  added to exported file (Dave Seidel)

* Add "Show/Hide Sound Object Properties" on popup menu for soundObjects (suggested by 
  Dave Seidel)

* PianoRoll - scale degrees are labelled on the left-had row header

### UPDATED

* LineObject - instrument generation changed to use new features of compilation 
  variables; only generates single instrument for variable name no matter how many times 
  signal name is used in piece

* PianoRoll - Notes are drawn with beveled border now

* PianoRoll - Canvas now implements scrollable, scroll values set to scroll more than 
  default was; easier to navigate window now especially with scroll mouse

* CeciliaModule - Filename now expected to end with .bcm (blue Cecilia Module), to 
  distinguish what is converted for use with blue and what is not

* CeciliaModule - fixed graph names on button labels to be multi-line

* SoundObject BarRenderers modified for slight 3D look; renderers changed for many 
  soundObjects to have a letter to help identify what kind of soundObject it is

* ProgramOption added for "Draw Flat SoundObject Borders"; if enabled, will use older 
  flat borders when drawing soundObjects

### FIX

* LineObject - table column names were incorrect, unable to edit table data

* PianoRoll - when copying and pasting, PianoNotes in PianoRoll would lose their 
  listeners and throw an exception; redid PianoNote class to check for if null

### Internal

* Changed compilation time code in Tables and Arrangement to be more flexible (get/
  setCompilationVariables)

* Removed all Antlr related code and libraries; fixed starter scripts to no longer 
  include Antlr


## [0.94.0 beta 13] - 2005-01-13

### NEW

* PianoRoll SoundObject - piano roll that allows editing in any Scala scale; adapts to 
  show as many scale degrees per octave as are in the Scala scale.

  See example file blue/examples/soundObject/pianoRoll.blue for demonstration and manual 
  entry for more information

* LineObject - SoundObject that generates k-rate signals, allows for adding/removing of 
  lines, change name of k-rate signal, changing range of line, and drawing/editing of 
  line visually.

* See example file blue/examples/soundObject/lineObject.blue for demonstration and 
  manual entry for more information

* BlueSynthBuilder - new File Selector object allows for selecting files from the 
  filesystem

* PDF Version of manual now included in blue/documentation folder

* Instruments and InstrumentCategories now can be moved around by dragging and dropping

* Add blueLibDir, blueProjectDir, and userConfigDir variables to pythonObject and 
  pythonInstrument; values are set to blue's lib directory, the current project's 
  directory, and user's .blue directory; useful for grabbing data from files that are 
  located in those sections (example: using the Tuning object and setting baseLibDir to 
  "userConfigDir + 'scl'")

### UPDATED

* Python Orchestra Library - added createNote and parseNotes convenience functions (both 
  take in white-space delimited strings, similar to csound notes)

### FIX

* ScoreTimeline - size does not become smaller than viewable width (will always draw 
  lines all the way across scrollpane's viewport)

* Python Orchestra Library - fixed error in calculating pitch in Tuning.py; affected 
  scales with non-2:1 "octave" (i.e. bohlen-pierce)

* Documentation - SoundObject docs was missing entries in last build

### Internal

* Removed FileFilter classes and replaced with blue.utility.GenericFileFilter


## [0.94.0 beta 12] - 2004-12-05

### NEW

* "Your First Project" Tutorial by Andres Cabrera added to documentation as first 
  tutorial in tutorials section

* Drag and drop of audiofiles from operating system onto ScoreTimeline now supported; 
  automatically creates AudioFile soundObject and adds to timeline where dropped.  
  Supports WAV, AIF, and AIFF file. Only supports one file to drop at a time.

* Added Tuning class to python orchestra library for using Scala files with Orchestra 
  class, able to set Tuning for a Performer

* CodeRepository - now able to drag and drop nodes between folders

* blueShare - if fetching instruments in InstrumentManagement pane, if no instruments in 
  the blueShare by user, now shows message

* Added documentaiton for Scanned Synthesis Matrix Editor

* Added "Emacs Shortcuts Enabled" to programOptions; if set, adds Emacs shortcuts to 
  blueEditorPane's.  Set to false by default, requires restarting blue to work when 
  changing settings.

### UPDATED

* Removed [about] button in blueX7 (wasn't doing anything)

* Integrated documentation for blueX7 from Andres Cabrera

* blueShare window made modal (must close to return to using blue)

### UPDATED/FIX

* blueShare updated for 0.94.0 XML

### FIX

* BlueEditorPane's yank/kill lines now behaves more like Emacs, uses separate buffer 
  from from System clipboard, buffer accessible from any BlueEditorPane

### Internal

    [internal] - reorganized packages, removed unused classes


## [0.94.0 beta 11] - 2004-11-21

### NEW

* Added my piece 'On the Sensations of Tone' to examples folder

* Added Emacs style shortcuts for BlueEditorPane

    * ctrl-a          move caret to beginning of line
    * ctrl-e          move caret to end of line
    * ctrl-k          kill line
    * ctrl-y          yank line
    * ctrl-up         move caret to beginning of paragraph
    * ctrl-down       move caret to end of paragraph

* ProgramOptions - "New User Defaults Enabled" affects if default text is used. This 
  currently affects:

    * CodeRepository - when adding new Code Snippet

* Added BSB Code Complete (ctrl-shift-space) on globalOrc and globalSco ares in BSB 
  editor

### UPDATED

* Documentation, including contributions by Andres Cabrera

* InstrumentLibrary code redone to implement TreeModel and also use event notification; 
  useful for cleaning up code in BlueShare and in InstrumentGUI

### FIX

* Shortcuts on InstrumentLibrary tree were incorrectly set to same key combination


## [0.94.0 beta 10] - 2004-11-08

### NEW

* Added Nudging of soundObjects via arrow keys:

    * left/right - move by one pixel horizontally up/down - move by one soundLayer up/
      down shift-left/shift-right - move by ten pixels horizontally

* Added my Orchestral Composition python library to lib/pythonLib

* In BlueEditorPane, when the cursor is in or on a complete opcode word, pressing 
  shift-F1 will try to open the documentation for the opcode from the Csound 
  Documentation Root

### NEW/UPDATED

* Use of "<INSTR_ID>" blue variable now permitted in instrument text and instrument's 
  global orc (previously only usable in global sco of instruments)

* Documentation has been reformatted using DocBook

### UPDATED

* For NoteProcessors with PField property, moved methods around so that pfield would 
  come up first in property editor

* Changed "Edit SoundObject" option on SoundObject popup to be "Edit PolyObject" and now 
  only appears when on a PolyObject

* Redid ScoreTimeline code to use SelectionEvents, which cleaned up a lot of code

* helpCommand removed from Program Options; Csound Documenation Root added to Program 
  Options; help button ( [?] ) in main tool bar now opens documentation from Csound 
  Documentation Root in user's browser; C.D.R. can be local (i.e. "file:///somewhere/") 
  or web-based (i.e. "http://somewhere.com/"); help button will append "index.html" to C.
  D.R. when opening

### UPDATED/FIX

* Changed to using InputMap/ActionMap in code instead of KeyListeners; property dialogs 
  now properly close if focused and using shortcut (i.e. F3 closes SoundObject 
  Properties dialog if that dialog is focused)

### FIX

* TuningProcessor - when finished selecting scale, notifies table that editing has 
  finished

* TuningProcess - if canceling scale selection, does not overwrite previously selected 
  scale with null


## [0.94.0 beta 9a] - 2004-10-25

### UPDATED

* Removed JavaHelp version of Documentation; moved documentation to blue/documentation 
  folder; blue now opens this documentation up with user's web browser when open help 
  from help menu (F1)

* Changed BlueX7 default patch to be an audible sound (default was set to have 
  everything set to 0)

* Setting of time properties for polyObject (snap, time/number) now in collapsable side 
  panel as workaround for OSX bug in popup

### FIX

* Projects including blueX7 instruments did not load correctly due to typo in code 
  (LFOData looking for "PMC" instead of "PMD")

### Internal

* PolyObject - event notification added to PolyObject properties, ScoreGUI and other 
  components redesigned to use events


## [0.94.0 beta 9] - 2004-10-18

### NEW

* SoundObjectLibrary - Added Copy button to make copy of soundObject and set as buffered 
  object; differs from "Copy Instance" in that the copy is not an Instance object but 
  deep copy of object

### NEW/UPADTED

* RenderStartTime - changed to not allow entering by text but rather by clicking and 
  dragging on TimeDisplayBar.  Render Start times are now saved with the project.

### FIX

* When selecting soundObjects on timeline, marquee was not correctly being moved 
  offscreen, interfering with drag operations and using rt-click to bring up popup menus 
  (if you clicked anywhere the marquee was before it disappeared blue would think that 
  you were selecting a non-soundObject)

* Fixed marquee selection in BlueSynthBuilder as well

* Listing of scales in TuningProcessor now are alphabetical


## [0.94.0 beta 8b] - 2004-10-05

### FIX

* TuningProcessor - Did not save/load pfield field

* ArrangmentTableModel - changed code to statically return class type for getColumnClass()


## [0.94.0 beta 8a] - 2004-10-03

### FIX

* TuningProcessor - Made Serializable (was causing bugs on render and copying of 
  soundObjects)


## [0.94.0 beta 8] - 2004-10-02

### NEW

* TuningProcessor - NoteProcessor converts values in a pfield according to settings from 
  a Scala tuning file; able to set base frequency from noteProcessor; values to convert 
  from are in pch-like notation:

  oct.scaleDegree

  where oct is octave (8 == baseFrequency, which defaults to Middle-C below A440), and 
  scaleDegree is degree of scale to use (which interval in Scala file).  Scala file is 
  chosen from files found in user's .blue directory under the scl directory (i.e. /home/
  steven/.blue/scl).  Documentation added to manual.

* FreezeDialog - When freezing or unfreezing soundObjects, FreezeDialog will pop open to 
  show progress

* User-Defined Opcodes - added UDO text area for putting User-Defined Opcodes; deals 
  with csound issue where User-Defined Opcodes must be placed after any ftgen statements 
  in instr 0 space

* Arrangement - added enabled/disabled checkbox to instruments within the Arrangment; if 
  checked, instrument will be generated to CSD along with all of it's ftables and global 
  orc/sco; instruments default to being enabled

* BlueSynthBuilder - new DropdownList object, able to have items with name and value

### NEW/UPDATED

* Instance soundObjects no longer append "Instance: " to soundObject they are an 
  instance of; now using different renderer on timeline to differentiate them from other 
  soundObjects (top left corner cut out)

### UPDATED

* When replacing instruments into Arrangment, selected row stays hilighted to make 
  further replacements easier to do

* CeciliaModule - if no Magic Instrument is required, do not generate an instrument or 
  note

### FIX

* CeciliaModule - fixed replacement scheme for ftable nums

* Sound soundObject - when loading pre 0.94.0 files, may have failed to open due to 
  instrumentNumber field being changed to transient; changed back to non-transient

* Making copies of PolyObjects that contained Instance objects of SoundObjects in the 
  SoundObject library would have instances pointing to copies of soundObjects in 
  library, resulting in blue unable to load the saved file


## [0.94.0 beta 7] - 2004-09-10

### UPDATED

* If snap enabled, when pasting or inserting new soundObjects, soundObjects will be 
  inserted at the closest snap point that is before where the mouse is clicked

* BlueSynthBuilder - implemented align and distribution of horizontal and vertical 
  centers

* BlueSynthBuilder - when using ctrl-shift-space to open list of BSB Object Names, only 
  show list for objects that have names, and don't show list if no named objects are 
  found

* Changed marquee selection code in ScoreTimeCanvas and ScoreMouseProcessor to use 
  AlphaMarquee class

* When adding to SoundObjectLibrary, now replaces current object with instance of object 
  (formerly added copy of object to sObjLib without replacing current one with instance)

* Look and Feel changes
  
### UPDATED/FIX

* BlueSynthBuilder - reworked edit panel to use input and action maps; fixed to request 
  focus on click so that shortcuts will work as expected

### FIX

* If pasting instance of soundObject into project that does not have it 
  SoundObjectLibrary, now adds copy of soundObject into library

* BlueSynthBuilder - Interface was not recalculating size when opening up a BSB 
  instrument, thus interface may not have been scrollable until and object was moved 
  around or inserted/removed; call to recalculateSize was added to fix

* Opcode Completion Popup - there was a case where using ctrl-space to do opcode 
  completion could result in a index error when no text was found before the caret


## [0.94.0 beta 6] - 2004-08-26

### NEW

* Added BlueVariables to opcodePopup so that when editing text in most textfields, user 
  is able to quickly access "<TOTAL_DUR>", "<PROCESSING_START>", and "<INSTR_ID>".  
  Future blueVariables will be added to this menu.

* Added initial documentation on blueVariables to user manual

* NoteProcessorChains - From SoundObjectPropertyDialog, when editing NoteProcessors for 
  soundObject, now able to save the current chain with name, insert a copy of a chain 
  that has been previously been saved, and remove chains that have been previous saved;

  Note ProcessorChains are saved with the project and are accessible globally within 
  project

* BlueSynthBuilder - added tabs for editing instrument global orc and globl sco code

* BlueSynthBuilder - now able to select multiple objects and move around together (added 
  generic classes to reuse elsewhere as well to handle these types of operations)

* BlueSynthBuilder - added "Cut", "Copy", "Paste", and "Remove" options, able to do 
  operations on group of objects; keyboard shortcuts were added to speed up using these 
  operations:

    * cut        - ctrl-x
    * copy       - ctrl-c
    * paste      - ctrl-click (paste will occur at mouse location)
    * remove     - delete key

* BlueSynthBuilder - added Align panel to align selected objects by side or by centers, 
  also distribute by either sides or centers

* BlueSynthBuilder - Label object now uses JLabel to render text; this causes the label 
  to be bold my default, but also allows for the label to be richly formatted by using 
  HTML (please see:

  http://java.sun.com/docs/books/tutorial/uiswing/components/html.html

  for more information)

* BlueSynthBuilder - added keyboard nudging of selected objects using keyboard arrows; 
  if shift is down, moves by 10 pixels, other wise moves by 1 pixel

* BlueSynthBuilder - added selection of objects by marquee


* RotateProcessor - noteProcessor that rotates order of notes of soundObject; able to 
  use positive or negative indexes to indicate new start note; documentation added to 
  help under "User's Manual" -> "Reference" -> "NoteProcessors"

### UPDATED

* Removed "ix" BlueVariable and replaced with "<INSTR_ID>" to make consistent with how 
  other variables are named and used

* SoundObject library resets soundObjects startTime to 0.0 when added to library, so 
  that when previewing generated score with instances, the score value will more closely 
  resemble the output (does not affect anything else about library soundObject usage)

### FIX

* When generating globalSco from instruments, incorrect method was used for replacing 
  "ix" with correct instrument id which could cause exception in the case when globalSco 
  was given but "ix" feature not used; also, instruments with named-instrument id did 
  not correctly replace with i "name" but replaced with iname (no quotes)


## [0.94.0 beta 5] - 2004-08-20

### NEW

* Added CheckBox object to blueSynthBuilder instrument; outputs either 1 or 0 value 
  depending if selected or not

* Added links on help menu to "Report a Bug" and "Request a Feature"

* Added timeDisplay and timeUnit properties to PolyObject; editable from popupMenu where 
  Snap is edited, it allows to change how time is displayed at top time bar, whether to 
  show units as time or simply numbers, and at what increment (integer value); by 
  setting timeDisplay to "Number", and unit to 4, one's time view can be more like bars 
  rather than time

* BlueSynthBuilder - while editing code, pressing ctrl-shift-space will pop open a list 
  of objectNames, taken from the UI objects in the interface editor; selecting 
  objectName from popup will insert object name already formatted (i.e. selecting 
  "amplitude" objectName will insert "<amplitude>")

### UPDATED

* Knob value display for blueSynthBuilder now limited to display 7 characters (no ...'s)

* When rendering, status bar shows messages of "Generating CSD...", "Rendering CSD...", 
  and "Finished Rendering CSD"

### FIX

* Typo in PMask file score.py, sent in by Francisco Vila

* Blue did not parse tied notes correctly; blue tried to look for negative values on p2 
  instead of p3


## [0.94.0 beta 4] - 2004-08-11

### NEW

* When creating new project, if "default.blue" file is in user's .blue directory, new 
  project will use that as a default template instead of empty project file

* CeciliaModule - implemented GrapherMenuBar

* Double-clicking PolyObjects in SoundObjectLibraryDialog now edits the PolyObject in 
  the main score timeline editing area

* MainToolBar - replaced render/stop buttons with Play and Stop buttons that indicate 
  mode rendering is in

* Internal

    * Refactored out MainToolBar class from BlueMainFrame

    * Created StatusBar class to be used statically for setting the status message on 
      the main frame

### UPDATED

* Logging messages removed from pythonObject SoundObject when generating score

### FIX

* Cloned Instance soundObjects (copies) did not point to the same soundObject as the 
  original Instance; caused file loading problems; fixed cloning to have new copies 
  point to the same soundObject from the soundObjectLibrary

* When clearing soundObject property dialog, notelists should clear too

* GenericInstrument- values were allowed to be set as 'null' which would produce text 
  'null' when generating instrument

* Opcode popup and code completion should not be available on text areas that are not 
  enabled for editing

* Added checks to ProjectOptions for null values when deserializing from XML

* When compiling CSD from .blue using blue command-line options, blue did not check to 
  see if .blue file was in older or newer file format

* File reverting did not work with 0.94.0 project files

* If blue exits, kills csound is rendering


## [0.94.0 beta 3b] - 2004-06-10

### FIX

* CeciliaModule - CSlider resolution was not be parsed and defaulted to 0.1; value was 
  too low for some sliders, causing very large range values and was the source of slow 
  GUI loading for modules

* CeciliaModule - some CSlider values should be output as integers

* CeciliaModule - rt-click now removes points to match Cecilia's behavior


## [0.94.0 beta 3a] - 2004-06-07

### FIX

* Added repaint call when editing new CeciliaModule

* Graphs were using wrong colors due to not drawing in correct order

* Sound file names have all backslashes converted to slashes


## [0.94.0 beta 3] - 2004-06-06

### NEW

* First time CeciliaModule enabled; mostly functional, use modules from lib/
  ceciliaModule (should start there when doing load module), still pieces left to 
  implement!

### FIX

* PolyObject needed to respect muting and soloing for generateTables, 
  generateInstruments, and generateGlobals

* If currentSoundObject is being edited, don't refocus in SoundObjectEditPanel; 
  increased speed when moving/resizing soundObjects on timeline that take a long time to 
  bring up editor for

* Arrangement would always append a number when adding an instrument with name as id; 
  should only do if id is already in arrangement


## [0.94.0 beta 2] - 2004-05-09

### NEW

* Added ability to shift soundObjects by a given time amount (Select soundObjects on 
  timeline, rt-click on any soundObject, choose "Shift", then enter time value to shift 
  by)

* CommandBlocks - currently for use in globalOrc in Instruments, it allows for 
  directions to be given to blue for what to do within the block; currently two commands 
  are implemented, "pre" which moves the enclosed text to the top and "once" which will 
  only use that text once even if other instruments define it too

* \*File format changed\* - all data now in valid XML format

    * Changes have occurred in all data classes for custom saving/loading to/from XML
    * File size generally smaller by 20%
    * Opens opportunities for cleaning up data classes and new features which require 
      more flexible data saving

### UPDATED

* SoundObject Interface changed, added saveAsXML() and setNoteProcessorChain(), added 
  loadFromXML as required static method (not expressable in Interface)

* Refactored PolyObject's addLayer to newSoundLayer, returns new SoundLayer (old way was 
  to create a layer and add it to polyObject)

* Reworked InstrumentEditPanel to add tabs for Instrument Editor and to bring back 
  Comments for instruments

### FIX

* Instruments generate globalOrc once even if assigned multiple times in Arrangement 
  (globalSco still generates multiple times)

* Instruments did not clone all properties (Global Orc and Sco)

* Using keyboard shortcuts in InstrumentLibrary before using popup menu at least once 
  caused NullPointerException


## [0.94.0 beta 1] - 2004-04-05

### NEW

* Orchestra Manager updated: instruments are now in a tree, to enable instruments, 
  insert them into Arrangement (concept borrowed from Michael Gogins' program "Silence". 
  See documentation for usage.

* blue.orchstra.Instrument interface changed: added generateGlobalOrc() and 
  generateGlobalSco()

### UPDATED

* Instrument Conditionals have been deprecated and no longer work; not necessary due to 
  instruments capable of generating global orc and sco

* Modified Look and Feel: main blue color changed to lighter color, inverted table 
  header border

* Spanish translation updated by Francisco Vila

* Added link for linuxPPC JVM to installation instructions

* Internal

    * Removed method supportsNoteProcessors from SoundObject class, implicit from 
      getNoteProcessors returning null

### FIX

* ScoreGUI allows split pane to relocate to any degree, fixing annoyance when not being 
  able to make bottom pane smaller


## [0.93.2a] - 2004-02-22

### FIX

* Instrument Conditionals were being operated on original BlueData instead of cloned 
  copy, thus removing code from actual work document; was not viewable until reopening 
  of file


## [0.93.2] - 2004-02-21

### NEW

* Instrument Conditionals - Text in globals tab (orc and sco) and ftables in tables tab 
  can be conditionally inserted into outputted CSD, depending on if an instrument has 
  been enabled in Orchestra Manager; useful to optimize generated CSD to only have 
  tables, notes, and instrument-0 code that is necessary (please read manual entry for 
  more information, found under Users-\>User's Manual-> Other Features-\>Instrument 
  Conditionals)

* LineAdd and LineMultiply NoteProcessors

* Added capacity to copy and paste soundObjects between Score area and blueLive dialog 
  (will not allow pasting of soundObjects into the blueLive that are not enabled for use 
  with blueLive)

* If project's commandline in project properties is empty, will use default commandline 
  from Program Options to render the project when using [render/stop] or "Generate Score 
  to Run"

### UPDATED

* Shortcut key for render/stop project changed to F9 from ctrl-~ to accomodate keyboards 
  in other languages that don't have ~

* CsoundAV opcode definitions added to opcodes.xml; opcode info accessible from popup 
  menu as well as code completion (ctrl-space while in text editor); syntax hilighting 
  will hilight CsoundAV opcodes (opcode definitions contributed by Andres Cabrera)

### FIX

* Orchestra Manager now allows instrument number up to 9999 to be visible

* Open as Instrument Library dialog did not allow copying of instrument into current 
  working project

* Reworked calls to repaint ScoreTimeCanvas to improve speed

### Internal

* Added pnuts.awt.PnutsLayout layout manager


## [0.93.1a] - 2003-12-22

### FIX

* External SoundObject could freeze up when used on Windows, fixed with use of threads 
  to drain stderr and stdout


## [0.93.1] - 2003-12-20

### UPDATED

* Import CSD now has multiple options for how to handle i-statements from CsScore, as 
  well as will respect "s" section statement when importing

* Documentation

    * extra notes on usage of timeWarpProcessor
    * extra note on noteProcessor main page regarding order of application
    * new documentation on Import from CSD
    * reorganized organization of documentation for User's Documentation
    * added commandlines to use with External SoundObject for use with CMask and nGen

### FIX

* Bug with BlueSystem initialization did not correctly load selected language files; now 
  loads correctly

* Clicking on timeline caused unneccessary function calls to getObjectiveDuration() on 
  buffered soundObject which could cause noticable slowdown when working with a buffered 
  soundObject that is heavy in script

* Calling polyObject.normalizeSoundObjects() had unnecessary call to getObjectiveDuration() 
  which would cause all soundObjects to generate their scores and cause a noticable 
  slowdown (occurred when pasting a polyObject after copying a group of soundObjects)

* For soundObject freezing, on OSX, will use .aif files instead of .wav

* Copying soundObjects did not always maintain time behavior


## [0.93.0] - 2003-12-08

### NEW

* SoundObject Freezing - prerender SoundObjects out to wav files to free up processing 
  power

* blueX7 - added csound postCode area for editing output options in csound orc language, 
  allows user to apply filters, change output to mono, stereo, zak, etc.

* Moved release building targets to build.xml from private ant script, added IzPack 
  (http://www.izforge.com) installer.xml file to build GUI installer programs

* SoundFont viewer dialog added to view instruments and presets for a soundfont; 
  requires csound to be in the users PATH, uses sfilist and sfplist opcodes in csound to 
  list what's available in soundfont

### UPDATED

* blueShare

    * loading message when hitting server on import pane
    * Managment tab added for removing instruments user has submitted

* When editing soundObjects in blueLive dialog, green border now shows what soundObject 
  is currently being edited

* Filled in documentation for "quick time dialog" and "snap" in the user manual entry 
  for score timeline

* Changed BlueTheme

    * 5 pixel splitPane dividers, color
    * swapped colors on splitePane viewPort borders

### UPDATED/FIX

* Blue now calls csound from the directory the project file is located in (so all 
  relative files used in the project work correctly)

### FIX

* "Save file" and "file library" dialogs should now default correctly to the work 
  directory set in user preferences

* AudioFile did not swap "\" with "/" as is required for windows file names

* AudioFile would give error if no soundFile selected, changed to only show alert if a 
  selected file no longer is openable (moved, deleted, etc.)

### Internal

* Extracted out blue.gui.FileTree from SoundFileManager as a reusable component


## [0.92.3] - 2003-10-01

### NEW

* New blueLive dialog for performing SCO text in realtime

  blueLive mode of playing takes current work project and generates everything except 
  for score blocks, automatically putting in f0 3600 and replacing <TOTAL_DUR> with 3600.

  * Rt-Clicking in the score area adds a soundObject
  * Double-clicking on the soundObject label edits the soundObject
  * Clicking on the soundObject label brings up its editor
  * Clicking on the big button fires off the score if csound is
  * Currently playing (via stdin)

  (Documentation has been added to the User Manual within the in-program help, 
  accessible by pressing F1)

### UPDATED

* AudioFile object now on by default

### FIX

* blue.command and other shells scripts were mistyped with "#/bin/sh" instead of 
  "#!/bin/sh"


## [0.92.2] - 2003-09-22

### NEW

* New AudioFile soundObject makes it easy to add audio files into your project; select a 
  soundFile from your drive and the editor will give you information about the soundFile 
  as well as a place to add/modify the csoundCode (i.e. add some processing to your 
  soundFile or change the output to zak-variables instead of the default out)

    * note: currently in beta and not guaranteed (though most likely) to load in future 
      versions of blue; not enabled by default: to use, uncomment the commented line in 
      blue/conf/registry.xml that refers to the AudioFile object

* Added requirement that BLUE_HOME environment variable to be set; this has been done so 
  within the blue starter scripts; consult INSTALL.txt to see how to set these variables 
  need to be set

* Added hotkey ctrl-T for running test in soundObjects that use GenericEditor
  (GenericScore, PythonObject, RhinoObject)

* Added ability to open file from commandline by passing in file names i.e. blue 
  someFile.blue anotherFile.blue  will start blue with those two files open

* Changed all settings files to be moved to .blue directory in user home

    * if [userhome]/.blue is found not to exist, then .blue will be made

    * if [userhome]/.blue has to be made, it will make a copy of old .blueConfig.xml if 
      found;

    * libraries for internal python objects (soundObject, instrument) can now be placed 
      in blue/lib/pythonLib or [userhome]/.blue/pythonLib

    * if [userhome]/.blue/codeRepository.xml does not exist, copy from blue/lib/
      codeRepository/codeRepository.xml

### UPDATED

* Adding instruments now will use first available number after the the currently 
  selected instrument, or first available number if no instrument is selected

* Removed "instance count" from SoundObject Library Dialog


## [0.92.1] - 2003-09-08

### NEW

* Changed recent files to hold last 8 instead of 4

* Added commandline options for blue (usage info accesible from calling blue starter 
  script with -h, i.e. "blue.sh -h"); added compile mode to convert .blue file to .csd 
  from commandline (using -c infile, with option -o outfile (outfile defaults to infile 
  name with .blue changed to .csd); useful for batch processing of .blue files into csd's

* Tab width of BlueEditorPane set to 8 characters

* Made new class NoteProcessorChainEditor to edit NoteProcessors; able to view all 
  noteProcessors and their properties in one sheet

* Added undoable edits on the Score timeline for:

    * align left
    * align right
    * align center
    * follow the leader

### UPDATED/FIX

* Changed painting code for TimeBar back to using a bufferred image, improved overall 
  drawing when scrolling horizontally of score timeline, fixed code to update for zooms

### FIX

* ScoreUtility.getBaseTen() would not properly add if pch was given without decimal 
  point (i.e. 8 instead of 8.00) (affected PchAdd and PchInversion noteProcessors)

* On Score timeline, after pasting in a soundObject, selection marquee was being 
  enabled; set flag to not do a select after pasting

* Time behavior was not working correctly for PolyObject


## [0.92.0] - 2003-08-12

### NEW

* Added code completion for orchestra text while in a text editor, if you have a 
  partially filled out opcode, pressing ctrl-space will do a lookup of that partial word 
  and return any opcodes that start with the partial name and show in a dialog box 
  options to use; selecting an option will automatically replace the partially filled 
  out word with the opcode signature (uses the same database of opcode signatures found 
  in conf/opcodes.xml)

* Undo capabilities added to Score editor for major edits:

    * adding soundObjects
    * moving soundObjects
    * stretching soundObjects
    * replacing soundObjects
    * removing soundObjects
    * adding soundLayers
    * removing soundLayers
    * pushing up soundLayers
    * pushing down soundLayers

* Undo capabilities added to Orchestra Manager for major edits:

    * adding instruments
    * removing instruments
    * duplicating instruments
    * importing instruments
    * renumber instruments

* Ctrl-clicking on first column header of instruments table in orchestra manager will 
  enable/disable all instruments

* Internal

    * Moved all score editor classes to package blue.score

### NEW/UPDATED

* Mouse handling on score timeline changed:

    * When clicking to resize, will focus soundObject for editing
    * When selecting soundObjects, will not allow move or resize unless already selected 
      (to prevent accidental moves after clicks)

### FIX

* NoteProcessors were not properly showing editor when selected, possibly resulting in 
  user editing different noteProcessor than expected


## [0.91.5] - 2003-06-01

### NEW

* Added "Align" options on soundObjectPopup to align selected soundObjects to left, 
  center, or right (will not stop overlapping)

* Added support for "+" in p2 and "." in pfields in Csound score text (GenericScore)

* SoundObjects now have time behavior property that will either

    * "scale"     - scale notes to subjective duration
    * "repeat"    - repeat notes up to subjective duration
    * "none"      - do not appply any time operations

* Documentation

    * Added documentation for code repository under User Manual/Tools

    * Added documentation for blueShare under User Manual/Tools

    * Added documentation for user tools under User Manual/Tools

    * Added documentation for general information about SoundObjects under "User's 
      Manual -> Reference -> SoundObjects"; information about time behavior added there

### UPDATED

* RepetitionObject deprecated and no longer available due to new time operation options; 
  all project files when opened will convert any found repetitionObjects into 
  genericScore objects with "repeat" time behavior set

* Removed objective duration from soundObject properties

* Documentation

    * reorganized User Manual into parts

* Internal

    * Refactored SoundObjectView to only use use floats instead of strings, changed 
      corresponding code that expected strings

    * Overloaded Note.createNote() to take in a previous note to add support for "+" in 
      p2 and "." in any pfield

    * ScoreUtilities.getNotes() utility method was modified to pass previous notes into 
      Note.createNote()

### FIX

* CSDUtility trims spaces of instruments names when importing from CSD

### REMOVED

* Documentation

    * Entry for repetitionObject removed


## [0.91.41] - 2003-05-11

### UPDATED

* Internal

    * ScoreMouseProcessor refactored out from ScoreTimeCanvas

### UPDATED/FIX

* Time bar was not updating when time was zoomed; returned to using older drawing code

### FIX

* Text for Window menu were mislabelled for English


## [0.91.4] - 2003-05-07

### NEW

* Catalan translation contributed

* Added Help option from help menu, updated documentation

* Scratch Pad data now persistent (for making tutorial notes)

* TimeWarp noteProcessor - allows for time warping in the same way as Csound 
  t-statements on a per-soundObject basis

* Internal

    * OrchestraTableModel was passed into blueShare classes for updating, hack for now, 
      should be later redone with proper MVC

### UPDATED

* Changed painting code for TimeBar to use a bufferred image, improved overall drawing 
  when scrolling horizontally of score timeline (syntax is the same except no 't' is 
  needed)

* Removed bumps on ScrollBar's thumb

* Internal

    * Continued revising of core code to support internationalization

### UPDATED/FIX

* Note soundObject now removes "i" when parsing a note string and adds when generating 
  note text (was interfering with Equals NoteProcessor and replacing p1)

### FIX

* Fixed buggy behavior of pasting in soundObjects then dragging

* Array index out of bounds was being thrown when trying to paste a soundObject outside 
  of the ScoreTimeCanvas

* Removing note processors when none were instantiated caused an exception

* Repetition Object would go into an infinite loop and crash blue if no score was given 
  and the object was called for score generation

* When rendering, now will use quotes around filename if on Windows (previously, not 
  doing so would cause problems with filenames that had spaces in them)

* Orchestra updates when instruments are imported through blueShare (prior to fix, 
  imports would occur but would not show until view was resized or otherwise changed)


## [0.91.3] - 2003-03-10

### NEW

* Experiments with printing support, to "work away from the computer"

* Started work for internationalization of blue (menus in Spanish and Korean)

* Credits tab in About dialog

* Internal

    * Made ScoreTimeCanvas implement Printable for printing

    * Added printFile() function for printing in BlueMainFrame

    * blue.resources.locale package created for language resources

### UPDATED

* ProgramOptions dialog has option to select language

* Internal

    * Rearchitected ProgramFiles to be a static class

### UPDATED/FIX

* Internal

    * Message reports if commandline is no good

### FIX

* Added credits for blueX7 generated instruments

* blueX7 was altering data when setting data for editting

* About dialog could not find license.txt file

* SoundFile panel did not wrap filename with quotes when generating gen 01 string

* Patterns

    * render button renamed to "render/stop"


## [0.91.2] - 2003-02-25

### NEW

* Added SwitchProcessor NoteProcessor: switches pfield1 with pfield2 for all notes in 
  soundObject; useful in conjunction with RetrogradeProcessor when reversing notes that 
  have start and end values in pfields, i.e.

    ;inum start dur   start   end
    i1    0     1     8.04    8.00
    i1    1     2     8.00    8.07

    with just retrograde processor becomes:

    ;inum start dur   start   end
    i1    0     2     8.00    8.07
    i1    2     1     8.04    8.00

    with retrograde and switch on p4 and p5 becomes:

    ;inum start dur   start   end
    i1    0     2     8.07    8.00
    i1    2     1     8.00    8.04

* Added end time to soundObject property dialog

* Created blue\_shortcuts.html document that lists shortcuts in blue (found in docs 
  directory)

* Internal

    * Experiments with installer version of blue

### UPDATED

* Updated opcodes.xml, synchronized to Rasmus Eckman's Csound Winhelp 4.22

* Changed blueShare server to have tree structure for categories, reworked blueShare 
  client

* Internal

    * Made all noteProcessor processNotes() functions final

    * Made functions in NoteList final

### FIX

* Save and Library Import file choosers did not default to user value


## [0.91.1] - 2003-02-09

### NEW

* Add runtime option for selecting look and feel edit starter script with "-Dplaf=foo" 
  where foo is the name of the pluggable look and feel class (examples are in the 
  starter scripts)

* "Replace with SoundObject in Buffer" added to SoundObject popup menu (replaces 
  selected soundObject with one from buffer)

* Added shortcuts for each tabbed pane and render/stop (ctrl 1-6, ctrl-\` (back-quote))

* Patterns

    * Add blueShare (accessible from Tools menu)

* Internal

    * Created FileChooserManager class in package blue.gui to use for all JFileChooser's
    * Change Table.gridColor key for look and feel to darkGray

### UPDATED

* Changed close shortcut to "Ctrl-W" instead of "Ctrl-F4"

* Changed text areas in blueShare to be word wrapped

* Internal

    * Removed "final" attribute from BlueData class for making BlueShareWrapper

### UPDATED/FIX

* Changed hardcode use of CTRL key to platform dependent shortcut key(apple key on mac)

### FIX

* SoundObject property dialog was not properly displaying NoteProcessorChain list; flaky 
  behavior exhibited (editting noteProcessor on one soundObject might actually be 
  editting noteProcessor from other soundObject, etc.). This was all due to a bad index 
  on the ListModel.

* Patterns

    * Files would not save, only "save as"


## [0.91.0]

### NEW

* Initial version of blueShare created

  blueShare is an online community for sharing blue resources. For this initial version, 
  blueShare supports sharing instruments only. Future versions may support sharing other 
  resources. Sharing is free, though to submit an instrument requires a username and 
  password.

  Register for an account at: http://www.kunstmusik.com/blueShare.

### FIX

* Importing CSD had error when no were found

* Patterns

    * Opening a new document caused required save or cancel
    * Opening a new document threw null pointer exception due to data mishandled


## [0.91.0 beta]

### NEW

* BlueX7 GUI instrument beta built; imports from raw DX7 single and bank patch dumps

* Added static table generation mechanism;

* Added "Generate CSD to Screen" to help testing (from "Projects" menu)

* Added "Revert" option to File menu to revert to last saved

* Internal

    * Moved all non-source code (images, text files) to blue.resources branch of source 
      code tree
    * Created ANT build.xml file for building blue (Ant buildfiles are like Makefiles)


## [0.90.82]

### UPDATED

* Patterns

    * Openning of multiple documents now supported

### FIX

* Patterns

    * MaintainLastWindowState now functions
    * Default values from ProgramOptions being used
    * PatternArrayEdittor was not properly resizing; caused strange scrolling issues


## [0.90.81]

### NEW

* InversionNoteprocessor and PchInversionNoteprocessor; flips all values in designated 
  pfield about an axis (value)

### UPDATED

* PolyObject browser, instance editor now have test button

### FIX

* PolyObject did not apply noteProcessors


## [0.90.8]

### NEW

* Added Scanned Synthesis matrix editor; accessible from "Tools" menu

* Added Josh Mattoon's blue.command and bluePatterns.command for MacOSX (double-click 
  these to run blue and patterns when on MacOSX)

* Internal

    * Added showComponentAsStandalone() method to blue.utility.GUI, convenience function 
      for making a frame for a component

### UPDATED

* Changed render location of outputted temp CSD files when using [render/stop] button to 
  directory where .blue file is located; change due to that if you wanted to group any 
  dependent wav files or other files that csound normally would look to check for in the 
  same directory as the csd file, this would fail, as temp CSD files were being 
  generated to the system's temp directory

* "Play/stop" button renamed to "render/stop" button

* SoundFile browser now shows files with .aif ending (in addition to .aiff and .wav)

* SoundFile browser now shows "." in directory list; double-click to refresh the current 
  directories listing

### UPDATED/FIX

* CSD importing now preserves instrument numbers

### FIX

* Calculation of duration incorrect for instance soundObject, genericScore soundObject, 
  and polyObject when using a noteProcessor that would change the number of notes 
  generated (i.e. subList processor)


## [0.90.7]

### UPDATED

* Changed solo to allow for soloing multiple tracks (i.e. only play these 2 tracks)

* External soundObject : added $outfile parameter for commandLine, now able to use 
  external programs that output to file and not to stdin (cmask)

* Changed look of comment renderer, turned anti-aliasing on as italic text was hard to 
  read

* SoundLayer default name changed to blank string

* Patterns

    * Changed solo to allow for soloing multiple tracks (i.e. only play these 2 tracks)

### UPDATED/FIX

* Maintain last window state default set to false

### FIX

* Importing of CSD files did not function correctly

* Added more error checking code to hopefully prevent crashing due to bad saved window 
  sizes

* Added more error checking code to prevent exceptions from FileChooser during startup

* Comment soundObject did not properly copy itself, name was missing


## [0.90.6]

### NEW

* Implemented preliminary snap; currently is dependent on pixel time shown, so will 
  round to pixel's time representation

* Added new noteProcessor EqualsProcessor; sets user-given pField of all notes in 
  soundObject to user-given value, i.e. set all p4's to value "440", or set all p6's to 
  value "/work/audio/wav/mySample2.wav"

* Added program option to maintain last window state (X,Y,W,H)

### UPDATED

* Changed borders on textPanels

* Patterns

    * Added help button for calling user-defined help command, works in the same manner 
      as the one in blue; configured from the program options dialog, accessed from the 
      file menu

    * Added tools menu and script menu from blue, for user tools, code repository 
      editor, and script tools; moved UserTool class out from ProgramOptions.java to 
      make public, as to be accessible from patterns

    * Add solo

    * Version number now shows blue's version number

### UPDATED/FIX

* Continuing work on undo system, got rid of recording of stylechanges, increased undo 
  size limits

### FIX

* Added title to code repository dialog, also hides editor when nodes removed from tree

* Patterns

    * Now checks for save before closing

    * PatternsMainFrame crashed from not finding blue.gui.BlueButton which was removed, 
      now references JButton

    * Patterns was broken from adding of undo managers in blue, now bypasses undo 
      managers

    * Fixed pushing up and down of layers


## [0.90.5]

### NEW

* Added drive selection in soundFile browser

* Added logging message for pythonObject when generating notes; useful for finding out 
  what pythonObject was the last one trying to generate notes if the pythonInterpreter 
  happens to be unable to execute your script (for debugging)

* Added new Rhino soundObject, a javaScript interpreter object; functionally identical 
  to pythonObject except uses JavaScript; called rhinoObject because the Java Javascript 
  Interpreter is called Rhino (http://www.mozilla.org/rhino)

* Added scripting menu for reinitializing Jython interpreter or opening interactive 
  prompt, as well as reinitializing Rhino Javascript interpreter

* Added pythonInstrument for scripting instruments; works in similar fashion to python 
  soundObject except uses 'instrument' variable to bring back into blue

* Added rhinoInstrument for scripting instruments; works in similar fashion to rhino 
  soundObject except uses 'instrument' variable to bring back into blue

* Added error message to External SoundObject if the commandline given is unable to be 
  executed

* Added new CodeRepository editor dialog, aceesible from Tools menu; edits what used to 
  be conf/custom.xml (now moved to lib/codeRepository/codeRepository.xml; if you're  
  upgrading, copy over this file with your old custom.xml and rename), which is what 
  shows up on the popup menu under the "custom" menu option

### UPDATED

* Continuing changes of look and feel: changed tabs, worked with borders, etc.

* Changed look of external soundObject's bar renderer to not use gradients

* Created new blue.scripting package, moved PythonProxy class to there and rearchitected 
  as static object

* Changed OpcodePopup class to static class with reinitialization functions so as to 
  work with code repository

* Redid BlueSystem object, removed isInitialized() and used static {} block to do 
  initializaiton

* Reimplemented Instrument interface; uses Editors like soundObjects; 
  InstrumentEditPanel caches editors in the same way as SoundObjectEditPanel, which 
  saves memory and speeds up editting of instruments; new Instrument interface should 
  make it easier to create instrument plugins

* Added AlphabeticalFileComparator to sort files in the soundFile browser in 
  alphabetical order

* SoundFile browser now uses double-clicks to initiate selection rather than single click

* Changed default text of python soundObject and rhinoSoundObject to have a 
  demonstration note

* Redid ScoreGUI's scrolling: implemented Scrollable on ScoreTimeCanvas, blue.gui.
  JScrollerBar class to allow to swap out JScrollBar's from JScrollPane which tie into 
  Scrollable objects

* Removed blue.gui.BlueButton class and made all classes use JButton (remnant from my 
  earliest look and feel experiments)

### UPDATED/FIX

* Changed ScoreTimeCanvas to use BLIT_SCROLL_MODE; provides faster response and drawing, 
  fixes bug of not clearing out the backing store when closing out a file (ghost image 
  of old work file)

### FIX

* When calling "Convert to generic score" on a sound soundObject, instrument would be 
  added to orchestra but not displayed until the orchestra split pane was resized; now 
  updates correctly

* Making copies of a pythonObject did not copy its note processor chain; fixed clone() 
  method in pythonObject

* Converting to genericScore would not properly grab notes from original soundObject, 
  rescaling and translating the notes;

* When zooming the scoreTimeCanvas, canvas would not resize properly horizontally; fixed 
  logic in checkSize() method

* Overrided paintChildren() method in ScoreTimeCanvas to get Marquee drawing on top of 
  children


## [0.90.4]

### NEW

* Added marquee selection (currently draws underneath soundObjects, will change later)

* Added solo option to soundLayers, selecting solo only generates notes for that 
  soundLayer in the polyObject; can be used in any polyObject

* Partially implemented undo system; undo queues managed per tab, currently implemented 
  for global, tables, and project properties; currently the text control's hilighting is 
  interfering with the undo system causing multiple undo's necessary per inserted 
  character; still more work to do...

### UPDATED

* Now maintaining vertical scroll when after editting a polyObject and moving back up 
  the polyObject tree

* Changed look of splitter for splitPanes

* Changed time bar to show time every 10 seconds when at lower resolution

### UPDATED/FIX

* blue.utility.ScoreUtilities would die on parsing note text that wasn't a note but 
  started with "i"; made Note() constructor private add Note.createNote() function to 
  use as a factory method; now correctly removes any line of text that isn't a note

### FIX

* External soundObject would cause blue to hang java 1.4.1 jvm; removed process.waitFor
  () in code, using just buffer reading to determine end of program call

* Code in soundLayer resizing of height caused scoreTimeCanvas not to resize properly 
  and would allow scrolling past canvas size

* Scrolling of main scoreTimeCanvas would revert to last buffer of image; resolved by 
  turning doubleBuffering off on scrollPane

* HeightIndex was not properly being set in TimePixelManager, causing layer heights 
  saved in polyObjects not to be displayed


## [0.90.3]

### NEW

* Add option for default kr, sr, nchnls, author, and commandline in program options 
  dialog (found under file menu); new files will automatically have their values set to 
  the defaults

* Added GNU Public License to About dialog

* Added menuoption to popup to 'set subjective time to objective time' for genericScore 
  soundObjects

* Added menuoption to popup for 'follow the leader', if more than one soundObject is 
  selected, clicking 'follow the leader' will put the soundObjects one right after the 
  other, in order of selection

* Added Quick Time Dialog; when using score timeline, select a soundObject and press 
  "ctrl-t" to pop open dialog to set start and subjective duration of soundObject; when 
  openned, it will start with focus in start time and you can tab between the two 
  fields;  enter to commit the change, escape or click anywhere besides the dialog to 
  close it without making changes

### UPDATED

* Split readme into readme and changelog, changed 'copying' file to license file

* External SoundObject: for commandline, now have option to state '$infile' in 
  commandLine where it will be replaced with the name of the temp file created for the 
  text;

  example: if you have a commmandLine of "perl" it'll get changed to "perl tempFile.
  txt", while if you had something like "myProgram $infile arg1 arg2" it'll get changed 
  to "myProgram tempFile.txt arg1 arg2"

### UPDATED/FIX

* Reimplemented blue.soundObject.Note class; processing of scores that use quotes (i.e. 
  for filenames) properly maintain spaces inside the quotes (i.e. "my audio file.wav" 
  comes out as "my audio file.wav")


## [0.90.2]

### NEW

* Added Tools menu - runs user-defined commands, edit from Tools->Manage Tools, name is 
  name on menu, commandline is command to run

### UPDATED

* SoundFileManager - soundFile information more cleanly displayed, gen 01 table auto 
  generated

* Cleaned up look of programOptions dialog

* Reworked BlueMainFrame; program now supports multiple documents open at the same time

### FIX

* TablesGUI, GlobalGUI, OrchestraGUI not setting data correctly when opening new files


## [0.90.1]

### NEW

* Added initial soundFileManager - able to traverse filesystem and play soundfiles

### UPDATED

* Removed stack trace on process console to account for different behaviour of java 1.4.
  1 JVM

* Changed zoom icons from magnifying glasses to "+" and "-" for usability on ScoreGUI 
  (score timeline)

* Changed colors and look of time bar

* Added missing icons for dialogs (Question.gif, etc.)

* Changed behaviour of ProgramOptions class; now looks for .blueConfig.xml in user home 
  directory by default if blue is not passed a configuration filename as a parameter, 
  looks for .bluePatternsConfig.xml in user home directory for patterns; shell scripts 
  and batch files were modified to reflect that change

* SoundObject Property Dialog displays noteProcessor not supported message when editting 
  soundObjects not supporting noteProcessors

### UPDATED/FIX

* PolyObjectEditor clears out display of soundObjects when selecting a different 
  polyObject

* Changed behaviour of orchestra manager; new instruments are numbered to the first 
  available space rather than at end of the list

### FIX

* ftable edittor properly clears tables when new blue file is openned

* Edittor now automatically scrolls to top when editting a new soundObject


## [0.90.0]

### NEW

* A sound object test file (soundObjectTest\_0.90.0.blue) has been included in the work 
  directory

* Implemented syntax hilighting - required new BlueEditorPane and BlueSyntaxDocument 
  classes

    * opcodes are hilighted in bold orange
    * csound variables (words starting with i, k, a, gi, gk, ga) are in pink
    * comments are in gray
    * quotes are in pink

### NEW

* External SoundObject - text inside edittor is written to a temp file and command line 
  given is run on the temp file, anything written to stdout is brought back into blue

  (so you can run perl scripts, python, a commandline score generator like mother, etc.)

* Repetition SoundObject - accepts standard csound score, repeats score depending on 
  duration

  if your score text has two notes, "i1 0 1" and "i1 1 1", and your subjective duration 
  is 4.5, the repetition object will repeat your score twice, then stop as it can't fit 
  any more of the original score in; with the same score, if you set the subjective 
  duration to 5.5, the repetition soundObject would repeat your score twice, then add 
  the first note, but not the second.

* Added a test button for soundObjects that implement GenericEdittable; clicking on the 
  test button pops up a dialog and shows what the notes from the soundObject will be 
  when  generated. useful for testing python scripts from the python soundObject, or 
  seeing testing the affects of applied noteProcessors

* Added a utility InfoDialog class to blue.gui package; used by GenericEdittor to show 
  outputted notes

* Converting a soundObject into a generic score will call generateInstruments and append 
  instruments to orchestra

### UPDATED

* Changed color of comment object to darkGray

* Updated jython to 2.1 release (was using older 2.0)

* Changed default for new instruments in orchestra manager to be set to enabled

* Removed DurationsSequence soundObject

### FIX

* Making copies of GenericScore did not copy their noteProcessors


## [0.89.6.1]

### FIX

* Serious bug with upgrade code introduced in 0.89.5; load of files would clear tables 
  and globals;


## [0.89.6]

### UPDATED

### FIX

* selecting "convert to generic score" from score timeline when no objects
  selected caused null pointer error

### Patterns 
  
* (fix): muting of tracks now working
* (fix): title of frame now being set correctly to "blue - patterns"
* (updated) - release version numbers synchronized to blue


## [0.89.5]

### NEW

* Support for tied notes (negative start times) in Note class

* New Pattern based music program, "Patterns" created

  Patterns is a pattern-oriented music program.  Patterns was able to be made quickly by 
  using the blue core libraries.  It features a grid edittor and a bank of patterns.  
  Patterns may be of arbitrary metrical breakdown, meaning it's simple to have a pattern 
  broken into 3 part over a pattern broken into 5 parts, etc.  More documentation to 
  follow. Please open testPatterns.patterns, located in the work directory, to see how 
  Patterns operates.  More documentation to follow.

### NEW/UPDATED

* Refactored to componentize subparts of blue (orchestra editor, global editor, 
  projectPropertiesEditor) which opens options for reuse to quickly build new 
  composition environments (may do polyObject editor in the future, but not necessary 
  subpart)


## [0.89.4]

### NEW

* \<TOTAL\_DUR\> variable added for globalScore; anywhere where \<TOTAL\_DUR\> is found in the 
  global score section, it will get replaced with the calculated duration of the 
  generated notes from the timeline; i.e. useful for global reverbs where you'd like the 
  reverb to always last the total duration of all the notes + 3 seconds, etc.

* HelpButton added, runs user-defined help command; defined in program options, under 
  File menu

* Zoom of timeline for a polyObject now maintained between sessions(PolyObject, 
  TimePixelManager and PolyObjectBar modified)

* External SoundObject - runs external program and captures output, has temporary 
  textArea

### NEW/UPDATED

* Made play button into play/stop button; if csound is currently running, pressing the 
  button will stop performance

### NEW/FIX

* Added CSDRunner class to encapsulate ProcessConsole, correctly destroys self after 
  process finishes

### FIX

* Editted ProcessConsole class to properly kill threads (had been taking up to 90% of 
  cpu after process finished)

* Adding noteProcessors did not clone new noteProcessors


## [0.89.3]

### NEW

* Regrograde Processor - Note processor reverses order of notes, using:

  newStartTime = totalDurationOfNoteList - (noteOldStartTime + noteDuration)

### FIX

* Not working with Java 1.4 JVM - Removed TypeAheadSelector, added error checks to 
  NoteListModel


## [0.89.2]

### NEW

* Pch Add Processor - Note processor that allows you to add and subtract from pfields 
  that are for use with cpspch, so you can say -11 or 5 to transpose notes; i.e. a note 
  with 5.01 and a -3 value to the processor would yield 4.10; does not support 
  fractional pch (i.e. 8.055, 4.112)

* SoundObjects in instances from soundObjectLibrary were not copied by reference; 
  improper behaviour of instances (changing value of object in library did not change 
  what the instances generated from)

### FIX

* Ctrl-mouseDown to paste would give nullPointer exception if nothing was in buffer; 
  error handling added


## [0.89.1]

### FIX

* Adding instruments to orchestra did not properly clone for new instruments


## [0.89.0]

i've been working with this one for the past week and just didn't spend the time
to package up for release.  i'm finding less usability issues for myself, so if
you're finding things, please email me.

lots of reworking.  the way layers have been handled has been completely redone.
you can now push up/down layers, remove multiple at a time, and also insert a
new layer wherever.  also lots of shortcuts add have sped up timeline use (at
least, it did for me).  you can ctrl-x/ctrl-c to cut or copy and then ctrl-click
to paste.

### NEW

* Moved all configuration xml files to conf directory

* Moved rendering option out from BlueData class, now renderer classes from blue.render

* Cut, copy selected soundObjects with ctrl-x, ctrl-c; paste by holding ctrl and 
  clicking on timeline; remove selected soundObject with delete key

* Program Options Dialog - can set up default work directory from here

### NEW/UPDATED

* Reworked working with SoundLayers (layers on timeline); can now select multiple 
  layers, push them up, push them down, remove multiple; can add a layer anywhere (used 
  to only be able to add layers to the end); implemented in new blue.SoundLayerEditPanel 
  (ScoreTimeInfoPanel and SoundLayerInfoPanel were removed)

### UPDATED

* blue.ScoreGUI reworked to allow resizing between layer information and timeline area

* Word wrap option added to scratch pad dialog

* Can't move splitpane of timeline all the way down, but can collapse splitpane

### UPDATED/FIX

* Note processors can be pushed up and down in chain; note processor list and property 
  editor properly updates itself

### FIX

* Recent files were not properly being saved

* Instances made from the soundObjectLibrary were not properly generating durations for 
  notes

still need to do documentation, other soundObjects.  i'm trying to figure out a
roadmap to version 1.0 for myself, to keep myself focused when i'm programming.
i've also been spending more time composing, so fixes and additions will
probably as it has been, here and there.

enjoy,
steven


## [0.88.0]

what a joy it is for myself to see blue evolving!  such a satisfaction from
creating one's own tool for composition.

i cleaned up alot of stuff internally, making it alot easier for myself and
whoever may wish to add to blue to add soundObjects, instruments, and
noteProcessors.  i just had the idea to add utility dialogs to the registry as
well, but that'll be in the next release. as always, if you have any issues,
comments, criticism, etc. please let me know.  also, there's an egroups mailing
list for blue that i've set up for discussion on blue.  as i've gotten very l
ittle regular feedback on blue, i'll continue to work off my own needs and wants
for the program.  but if you're interested in seeing things in blue, feel free
to make requests on the mailing list or email me directly anytime.

here's the rundown:

### NEW

* CommentObject - add comments in the timeline

* ScratchPad Dialog - a blank text dialog for whatever happens to be on your 
  mindaccessible from Window menu, or press F5 (NOTE: does not get saved)

* AbstractSoundObject - convenience class for implemented SoundObjects

* Implemented GenericEditor and GenericEditable to ease soundObject creation

* Implemented BlueSystem object - allows for cleaner implementation of system 
  properties, which in turn makes it easier for developers to have objects interact with 
  blue

* Registry.xml - soundObjects, instruments, and noteProcessors dynamically loaded
  (instruments in this case are blue.orchestra.Instrument's, not csound instruments)

* Implemented SoundObjectEditPanel to cache editors, changed interface of soundObjects 
  to accomodate:optimization for performance

* Migrated setting files to conf dir

### UPDATED

* Colors - back to blue theme (still working on getting it right!)

* PolyObjectBarRenderer - started playing the bar renderers, to better differentiate 
  where PolyObjects are

### FIX

* Added JScrollPane for ProjectPropertiesGUI's note text

* If a soundLayer is muted, instruments now not generated from soundObjects that 
  generate instruments

* Fixed flickering on polyObject timeLine[bug] - can't move splitpane of timeline all 
  the way down

i've been lazy about documentation, i know! but the framework of blue is really
getting to the point where i don't have to think about it so much now, so my
work on blue will be shifting from internal construction outwards to
documentation and adding soundObjects (apologies to Gabriel Maldonado for being
slow to implement the PianoRoll!).

so much more to add as well... but it's getting there.

^\_^

enjoy!
-steven


## [0.87.0]

lots of false starts... things i tried but abandoned.  oh well.  here's the
run-down:

[end user]

* fixed scroll bug

* began work on color scheme

    * added soundObject library, Instance object (press F4 to open, or select from 
      "Windows" menu).  rt-click on an object on a timeline to add to the library.  
      later, if you want to make an instance of the soundObject from the library, go to 
      the library dialog, select the one you want, press the copy button, and then 
      rt-click on the main timeline and select paste.  you should get an Instance of the 
      soundObject there.  try using with noteProcessors (see note below)

* moved all project information into properties tab

* colors changed

* noteProcessors, addable to most soundObjects; access these from the soundObject 
  Property dialog (F3 when the main program is focused, or select from "Windows" menu) 
  allows for things like "adding 1.3 to every p4 field" or "use only notes 4-8". good in 
  conjunction with soundObject Instances from soundLibrary (i.e. i have a motif in the 
  library, i have four instances of it, one which is transposed up, one transposed down, 
  and two more which are only fragments of the motif)

### Internal

* changed from using generateScore() to generateNotes() (producing Notelist's instead of 
  String's)

* pushed out class MotionBuffer from SoundObjectBuffer

* created blue.components package, for reusable components

* add blue.soundObject.renderer (renders bar on ScoreTimeline)

* moved all Utility classes to blue.utilities

* created blue.render package

### Started

* ftable manager, reconsidering using live edittor (roundtrip)

* piano roll

* note table edittor

* LStdinPlayer

* scsort() function

this release is a bit 'dirty' in that i'm not quite sure if i tested everything.
i actually got a bit lost at one point because i tried to add too many things at
once and just got confused.  anyways, i think that lots of functionality got
added, so hopefully it'll all work out.

i also want to spend some time doing new documentation.
any requests for information?

later!
steven


## [0.86.5]

what i added:

* shift-click to select multiple soundobjects

    * cut, copy, and paste multiple soundobjects (currently pasted as a new polyObject 
      if multiple soundobjects selected)

* converting a soundObject to generic score

* converting a soundObject or multiple soundObjects into a polyObject

* double-clicking enters into a timeline of a polyObject

* added a "globals" tab, move the global orchestra stuff to here, added global score 
  stuff.  (one could, theoretically, not even use the time line now and just code away 
  in the global score area)

* the Patterns preprocessor: preprocessor for pattern based music.  the format is as 
  following: in a csd file, add patterns within pattern tags. within the score, add 
  p-statements with two p-fields: patternName and startTime.

  a lame example:

    ```
    <CsoundSynthesizer>
    ...
    <Patterns>

    pattern 1 ; drums
        i1 0 1 3 40
        i1 1 1 3 40
    endpattern

    pattern 2 ; bass drums
        i1 0 1 3 40
        i1 1 1 3 40
        i1 2 1 3 40
        i1 3 1 3 40
    endpattern

    pattern trumpetLine ; yes, you can use names as well
        i2 0 2 5
        i2 .5 2 5
    endpattern

    pattern set1 ; here i'm embedding patterns within the pattern
        p1 0
        p2 0
        p trumpetLine 0
        ptrumpetLine 2 ; can have a space or not, like i-statements
        i4 3 0 0
    endpattern

    </patterns>

    <CsScore>
        i1 0 4 0
        p1 0
        p1 4
        p1 8
        p2 0
        p2 4
        p2 8
        p trumpetLine 0
        p trumpetLine 8
        p set1 2

    </CsScore>
    <CsoundSynthesizer>
    ```


  all of the p-statements would get expanded out, such that, in the above
      example, if you had "p2 4", the resulting score generated would be:

        i1 4 1 3 40
        i1 5 1 3 40
        i1 6 1 3 40
        i1 7 1 3 40

  (it's a pretty simple system; i built it in a few hours and need to add
      some more error-checking code, but for it works fine right now)

what's not quite implemented:

* enabling/disabling instrument generation : good for .blue files with a
        a very large amount of instruments.  that way, you could keep one
        massive library of instruments, then only generate the ones you wanted
        to the resulting .csd file, which would cut down on sound generation
        time.  you'll see a new column on the orchestra editting area, but it
        doesn't do anything yet.
* adding GNU style options for the commandline of blue.  i want add
        possibilities like "blue --patterns inFile.csd outFile.csd" or
        "blue --compile in.blue out.csd".  that'll be in soon.

this release is more for me to get myself going than anything polished.  i've
been using this version myself and it seems to work fine for me.  also, it's the
first source code release, which is also for myself to get going more than
anything.  it's a bit ugly in there... if you're looking to hack at it, please
do contact me and i'd love to coordinate changes and features.

please send any comments and bug reports to kunstmusik@hotmail.com

enjoy!

steven


## [0.87.0] - 2002-02-23


## [0.86.5] - 2001-12-06

    read old release notes [i'll organize all this stuff someday...]


## [0.85.0] - 2001-08-14

* no <CsOptions> generated for [play] button
* [run garbage collector] option on help menu
* polyObjectGUI for seeing into polyObjects
* opcode popup only shows 10 at a time
* custom menu added to opcode popup (uses custom.xml in bin directory, edittable by hand)
* play bar replaces 'generate temp .csd and run'
* new soundObject 'durations sequence'
* new soundObject 'pythonObject'
* added 'open as library' option
* internal refactoring of code


## [0.8] - 2001-06-10

* added opcode popup to text area; created XML file as data source
* added option to generate csd files from a start time


## [0.79.7] - 2001-05-21

* added "sound" soundObject
* added track muting
* added soundObject dragging between soundLayers
* enabled tooltips for soundObjects


## [0.79.1] - 2001-05-01

* bug fix for start times


## [0.79] - 2001-04-30

I made lots of changes... I'll write more details when I put out ver 0.8
(hopefully) later this week


## [0.71] - 2001-03-07

* ability to name soundObjects implemented
* moved soundObject properties bar into a floating palette
* cleaned up the look quite a bit!  will continue with this as always


## [0.7] - 2001-03-02

* added a timebar up top
* added layer names
* added get/set names to all soundObjects (not yet edittable though)
* moved "add layer" from popup to remaining in window
* added "Generate CSD and Run" option
    * what this does is takes the commandLine parameter from Project Options and uses 
      that to run a temporary csd file that is generated
    * if "csound" is the commanLine parameter, it would be as if you ran "csound 
      tempCsd1352.csd"
    * the temp file is automatically deleted after the JVM closes, so you don't need to 
      worry about it


## [0.67] - 2001-02-26

* reworked some internals
    * add Note class (still needs work)
* added default ".oce" and ".csd" endings for save and generate options
* save and generate options now default to current working directory
* started changes to look and feel (this is not a priority right now, as I still feel I 
  need to work the program's structure more importantly than the look; but it was a bit 
  too unsightly, so I did some basic changes)


## [0.65]

* added cut, copy, paste of soundObjects
* added prevention of moving blocks to negative start times
* added dialog options for sr, kr, nchnls (ksmps calculated from sr/kr)

