
// This stuff gets injected into each webpage (according to the matching rules)

// lets keep this for now to show that the script is working
document.body.style.border = "10px solid red";


var myPort = browser.runtime.connect({name:"port-from-cs"});
//myPort.postMessage({type:"greeting", greeting: "hello from content script"});

myPort.onMessage.addListener(function(m) {
  console.log("In content script, received message from background script: ");
  //console.log(m.greeting);
});

/*
document.body.addEventListener("click", function() {
  myPort.postMessage({greeting: "hey backgound script: someone clicked the page!"});
});
*/

'use strict';

// wrapping GreaseMonkey APIs

function GM_xmlhttpRequest(orders) {
  try {
    var oReq = new XMLHttpRequest();
    oReq.addEventListener("load", function(a1, a2, a3) {
      console.log('xhr.load: %s, %s, %s', a1, a2, a3);
    });

    // open synchronously
    oReq.open(orders.method, orders.url, false);

    // headers
    for (var key in orders.headers) {
      oReq.setRequestHeader(key, orders.headers[key]);
    }

    // send
    var res = oReq.send(orders.data);
    console.log('xhr result: %s', res);
  } catch(e) {
    debugger;
    console.warn('could not send ajax request %s to %s, reason %s', orders.method, orders.url, e.toString());
  }
}


// this hash is just intended to help isolate UI specifics
// so that we don't need to maintain/port tons of code 

var UserInterface = {
  get: function() {
    return UserInterface.DEFAULT;
  },
  
 CONSOLE: {
   
 }, // CONSOLE (shell, mainly useful for testing)
  
 DEFAULT: {
  alert: function(msg) {return window.alert(msg);     },
  prompt: function(msg) {return window.prompt(msg);  }, 
  confirm: function(msg) {return window.confirm(msg); },
  notify: function(msg) {
  }, // notify
  result: function(msg) {
    myPort.postMessage({type: "show-result", output:msg});
  },

  dialog: null,
  selection: null
    
 } // default UI mapping (Browser/User script)
  
}; // UserInterface

var UI = UserInterface.get(); // DEFAULT for now


// This hash is intended to help encapsulate platform specifics (browser/scripting host)
// Ideally, all APIs that are platform specific should be kept here
// This should make it much easier to update/port and maintain the script in the future
var Environment = {
  getHost: function(webExt=true) {
 
     if(webExt) {
       Environment.scriptEngine = 'webExt mode';
       console.log('webExt mode');
       return Environment.WebExtension; // HACK for testing the webExt mode (firefox addon)
     }
},

  WebExtension: {
  	init: function() {
		console.log("webExt mode ...");
  	},//init
	getScriptVersion: function() {
		return '0.36'; // FIXME
	}, //getScriptVersion
	dbLog: function(msg) {
		console.log(msg);
	}, // dbLog
	addEventListener: function(ev, cb) {
		console.log("addEventListener");
	}, // addEventListenr
    
	registerConfigurationOption: function(name, callback, hook) {
		console.log("registerConfigurationOption");
	}, //registerConfigurationoption
    
	registerTrigger: function() {
		console.log("registerTrigger");
		window.addEventListener('load', init); // page fully loaded
		Host.dbLog('Instant Cquotes: page load handler registered');

    
		// Initialize (matching page loaded)
		function init() {
		console.log('Instant Cquotes: page load handler invoked');
  		var profile = getProfile();

		// runProfileTests();
  
  		Host.dbLog("Profile type is:"+profile.type);
  
  		// Dispatch to correct event handler (depending on website/URL)
  		// TODO: this stuff could/should be moved into the config hash itself
  
  		//if (profile.type=='wiki') {
    		// profile.event_handler(); // just for testing
    		//return;
  		//}
   
    document.onmouseup = instantCquote;
    // HACK: preparations for moving the the event/handler logic also into the profile hash, so that the wiki (edit mode) can be handled equally
    //eval(profile.event+"=instantCquote");
     
} // init()



	}, //registerTrigger
    
    // turn a string/text blob into a DOM tree that can be queried (e.g. for xpath expressions)
    // FIXME: this is browser specific not GM specific ...
    make_doc: function(text, type='text/html') {
      // to support other browsers, see: https://developer.mozilla.org/en/docs/Web/API/DOMParser
      return new DOMParser().parseFromString(text,type);
    }, // make DOM document
    
    // xpath handling may be handled separately depending on browser/platform, so better encapsulate this
    // FIXME: this is browser specific not GM specific ...
    eval_xpath: function(doc, xpath, type=XPathResult.STRING_TYPE) {
      return doc.evaluate(xpath, doc, null, type, null);
    }, // eval_xpath

 download: function (url, callback, method='GET') {
  // http://wiki.greasespot.net/GM_xmlhttpRequest
     try {
  GM_xmlhttpRequest({
    method: method,
    url: url,
    onload: callback
  });
     }catch(e) {
       console.log("download did not work");
     }
  }, // download()
    
    // this is only intended to work with archives supported by the  hash
    downloadPosting: function (url, EventHandler) {
      
    Host.download(url, function (response) {
    var profile = getProfile(url);
    var blob = response.responseText;
    var doc = Host.make_doc(blob,'text/html'); 
    var result = {}; // hash to be returned
    
    [].forEach.call(['author','date','title','content'], function(field) {
      var xpath_query = '//' + profile[field].xpath;
      try {
       var value = Host.eval_xpath(doc, xpath_query).stringValue; 
       //UI.alert("extracted field value:"+value);
        
        // now apply all transformations, if any
       value = applyTransformations(value, profile[field].transform );
        
       result[field]=value; // store the extracted/transformed value in the hash that we pass on
      } // try
      catch(e) {
        UI.alert("downloadPosting failed:\n"+ e.message);
      } // catch
    }); // forEach field
    
    EventHandler(result); // pass the result to the handler
    }); // call to Host.download() 
      
    }, // downloadPosting()

    getTemplate: function(reset=false) {
    
    // hard-coded default template
    var template = '$CONTENT<ref>{{cite web\n' +
  '  |url    =  $URL \n' +
  '  |title  =  <nowiki> $TITLE </nowiki> \n' +
  '  |author =  <nowiki> $AUTHOR </nowiki> \n' +
  '  |date   =  $DATE \n' +
  '  |added  =  $ADDED \n' +
  '  |script_version = $SCRIPT_VERSION \n' +
  '  }}</ref>\n';
     
    // return a saved template if found, fall back to hard-coded one above otherwise
    // return the default template if reset is specified
    return (reset)?template:Host.get_persistent('default_template', template);
    
  }, // getTemplate


	get_persistent: function(key, default_value) {
    		console.log("webExt mode does not yet have persistence support");
    		return default_value;
	}, // get_persistent

	set_persistent: function(key, value) {
		console.log("webExt persistence stubs not yet filled in !");
	}, //set_persistent
    
  
	set_clipboard: function(content) {
		console.log("set_clipboard");
	} //set_clipboard
    
  } // end of webExt config
  
 

  
}; // Environment hash - intended to help encapsulate host specific stuff (APIs)


// the first thing we need to do is to determine what APIs are available
// and store everything in a Host hash, which is subsequently used for API lookups
// the Host hash contains all platform/browser-specific APIs
var Host = Environment.getHost();
//Environment.validate(Host); // this checks the obtained host to see if all required dependencies are available
Host.init(); // run environment specific initialization code (e.g. logic for GreaseMonkey setup)


// move DEBUG handling to a persistent configuration flag so that we can configure this using a jQuery dialog (defaulted to false)
// TODO: move DEBUG variable to Environment hash / init() routine
var DEBUG = Host.get_persistent('debug_mode_enabled', false);
Host.dbLog("Debug mode is:"+DEBUG);

function DEBUG_mode() {
  // reset script invocation counter for testing purposes
  Host.dbLog('Resetting script invocation counter');
  Host.set_persistent(GM_info.script.version, 0);
}


if (DEBUG)
DEBUG_mode();

// hash with supported websites/URLs,  includes xpath and regex expressions to extract certain fields, and a vector with optional transformations for post-processing each field

var CONFIG = {
  
  'Sourceforge Mailing list': {
    enabled: true,
    type: 'archive',
    event: 'document.onmouseup', // when to invoke the event handler
    event_handler: instantCquote, // the event handler to be invoked
    url_reg: '^(http|https)://sourceforge.net/p/flightgear/mailman/.*/',
    content: {
      xpath: 'tbody/tr[2]/td/pre/text()', // NOTE this is only used by the downloadPosting  helper to retrieve the posting without having a selection (TODO:add content xpath to forum hash)
      selection: getSelectedText,
      idStyle: /msg[0-9]{8}/,
      parentTag: [
        'tagName',
        'PRE'
      ],
      transform: [],
    }, // content recipe
    // vector with tests to be executed for sanity checks (unit testing)
    tests: [
      {
        url: 'https://sourceforge.net/p/flightgear/mailman/message/35059454/',
        author: 'Erik Hofman',
        date: 'May 3rd, 2016', // NOTE: using the transformed date here 
        title: 'Re: [Flightgear-devel] Auto altimeter setting at startup (?)'
      },
      {
        url: 'https://sourceforge.net/p/flightgear/mailman/message/35059961/',
        author: 'Ludovic Brenta',
        date: 'May 3rd, 2016',
        title: 'Re: [Flightgear-devel] dual-control-tools and the limit on packet size'
      },
      {
        url: 'https://sourceforge.net/p/flightgear/mailman/message/20014126/',
        author: 'Tim Moore',
        date: 'Aug 4th, 2008',
        title: 'Re: [Flightgear-devel] Cockpit displays (rendering, modelling)'
      },
      {
        url: 'https://sourceforge.net/p/flightgear/mailman/message/23518343/',
        author: 'Tim Moore',
        date: 'Sep 10th, 2009',
        title: '[Flightgear-devel] Atmosphere patch from John Denker'
      } // add other tests below

    ], // end of vector with self-tests
    // regex/xpath and transformations for extracting various required fields
    author: {
      xpath: 'tbody/tr[1]/td/div/small/text()',
      transform: [extract(/From: (.*) <.*@.*>/)]
    },
    title: {
      xpath: 'tbody/tr[1]/td/div/div[1]/b/a/text()',
      transform:[]
    },
    date: {
      xpath: 'tbody/tr[1]/td/div/small/text()',
      transform: [extract(/- (.*-.*-.*) /)]
    },
    url: {
      xpath: 'tbody/tr[1]/td/div/div[1]/b/a/@href',
      transform: [prepend('https://sourceforge.net')]
    }
  }, // end of mailing list profile
  // next website/URL (forum)
  'FlightGear forum': {
    enabled: true,
    type: 'archive',
    event: 'document.onmouseup', // when to invoke the event handler (not used atm)
    event_handler: null, // the event handler to be invoked (not used atm)
    url_reg: /https:\/\/forum\.flightgear\.org\/.*/,
    content: {
      xpath: '', //TODO: this must be added for downloadPosting() to work, or it cannot extract contents
      selection: getSelectedHtml,
      idStyle: /p[0-9]{6}/,
      parentTag: [
        'className',
        'content',
        'postbody'
      ],
      transform: [
        removeComments,
        forum_quote2cquote,
        forum_smilies2text,
        forum_fontstyle2wikistyle,
        forum_code2syntaxhighlight,
        img2link,
        a2wikilink,
        vid2wiki,
        list2wiki,
        forum_br2newline
      ]
    },
    // vector with tests to be executed for sanity checks (unit testing)
    // postings will be downloaded using the URL specified, and then the author/title 
    // fields extracted using the outer regex and matched against what is expected
    // NOTE: forum postings can be edited, so that these tests would fail - thus, it makes sense to pick locked topics/postings for such tests
    tests: [
      {
        url: 'https://forum.flightgear.org/viewtopic.php?f=18&p=284108#p284108',
        author: 'mickybadia',
        date: 'May 3rd, 2016',
        title: 'OSM still PNG maps'
      },
      {
        url: 'https://forum.flightgear.org/viewtopic.php?f=19&p=284120#p284120',
        author: 'Thorsten',
        date: 'May 3rd, 2016',
        title: 'Re: FlightGear\'s Screenshot Of The Month MAY 2016'
      },
       {
        url: 'https://forum.flightgear.org/viewtopic.php?f=71&t=29279&p=283455#p283446',
        author: 'Hooray',
         date: 'Apr 25th, 2016',
        title: 'Re: Best way to learn Canvas?'
      },
      {
        url: 'https://forum.flightgear.org/viewtopic.php?f=4&t=1460&p=283994#p283994',
        author: 'bugman',
        date: 'May 2nd, 2016',
        title: 'Re: eurofighter typhoon'
      } // add other tests below

    ], // end of vector with self-tests
    author: {
      xpath: 'div/div[1]/p/strong/a/text()',
      transform: [] // no transformations applied
    },
    title: {
      xpath: 'div/div[1]/h3/a/text()',
      transform: [] // no transformations applied
    },
    date: {
      xpath: 'div/div[1]/p/text()[2]',
      transform: [extract(/» (.*?[0-9]{4})/)]
    },
    url: {
      xpath: 'div/div[1]/p/a/@href',
      transform: [
        extract(/\.(.*)/),
        prepend('https://forum.flightgear.org')
      ] // transform vector
    } // url
  } // forum 
}; // CONFIG hash

// hash to map URLs (wiki article, issue tracker, sourceforge link, forum thread etc) to existing wiki templates
var MatchURL2Templates = [
  // placeholder for now
 {
   name: 'rewrite sourceforge code links',
   url_reg: '',
   handler: function() {
   
 } // handler
  
 } // add other templates below
  
]; // MatchURL2Templates




// output methods (alert and jQuery for now)
var OUTPUT = {
  // Shows a window.prompt() message box
  msgbox: function (msg) {
    //UI.prompt('Copy to clipboard ' + Host.getScriptVersion(), msg);
    //Host.set_clipboard(msg);
    //window.alert(msg);a
    //window.prompt("Result:", msg);
    //UI.notify(msg);
    UI.result(msg);
  } // msgbox
  
  
}; // output methods



var MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];
// Conversion for forum emoticons
var EMOTICONS = [
  [/:shock:/g,
  'O_O'],
  [
    /:lol:/g,
    '(lol)'
  ],
  [
    /:oops:/g,
    ':$'
  ],
  [
    /:cry:/g,
    ';('
  ],
  [
    /:evil:/g,
    '>:)'
  ],
  [
    /:twisted:/g,
    '3:)'
  ],
  [
    /:roll:/g,
    '(eye roll)'
  ],
  [
    /:wink:/g,
    ';)'
  ],
  [
    /:!:/g,
    '(!)'
  ],
  [
    /:\?:/g,
    '(?)'
  ],
  [
    /:idea:/g,
    '(idea)'
  ],
  [
    /:arrow:/g,
    '(->)'
  ],
  [
    /:mrgreen:/g,
    'xD'
  ]
];
// ##################
// # Main functions #
// ##################


// the required trigger is host specific (userscript vs. addon vs. android etc)
// for now, this merely wraps window.load mapping to the instantCquotoe callback below
Host.registerTrigger();


// FIXME: function is currently referenced in CONFIG hash - event_handler, so cannot be easily moved across
// The main function
// TODO: split up, so that we can reuse the code elsewhere
function instantCquote(sel) {
  var profile = getProfile();
  
  // TODO: use config hash here
  var selection =  document.getSelection(),
  post_id=0;
  
  try {
    post_id = getPostId(selection, profile);
  } 
  catch (error) {
    Host.dbLog('Failed extracting post id\nProfile:' + profile);
    return;
  }
  if (selection.toString() === '') {
    Host.dbLog('No text is selected, aborting function');
    return;
  }
  if (!checkValid(selection, profile)) {
    Host.dbLog('Selection is not valid, aborting function');
    return;
  }
  try {
    transformationLoop(profile, post_id);
  }
  catch(e) {
    UI.alert("Transformation loop:\n"+e.message);
  }
} // instantCquote

  // TODO: this needs to be refactored so that it can be also reused by the async/AJAX mode
  // to extract fields in the background (i.e. move to a separate function)
function transformationLoop(profile, post_id) {
  var output = {}, field;
  Host.dbLog("Starting extraction/transformation loop");
  for (field in profile) {
    if (field === 'name') continue;
    if (field ==='type' || field === 'event' || field === 'event_handler') continue; // skip fields that don't contain xpath expressions
    Host.dbLog("Extracting field using field id:"+post_id);
    var fieldData = extractFieldInfo(profile, post_id, field);
    var transform = profile[field].transform;
    if (transform !== undefined) {
      Host.dbLog('Field \'' + field + '\' before transformation:\n\'' + fieldData + '\'');
      fieldData = applyTransformations(fieldData, transform);
      Host.dbLog('Field \'' + field + '\' after transformation:\n\'' + fieldData + '\'');
    }
    output[field] = fieldData;
  } // extract and transform all fields for the current profile (website)
  Host.dbLog("extraction and transformation loop finished");
  output.content = stripWhitespace(output.content);
  
  var outputPlain = createCquote(output);
  outputText(outputPlain, output);
} // transformationLoop()



/// #############

function runProfileTests() {
  
  for (var profile in CONFIG) {
    if (CONFIG[profile].type != 'archive' || !CONFIG[profile].enabled ) continue; // skip the wiki entry, because it's not an actual archive that we need to test
    // should be really moved to downloadPosting
    if (CONFIG[profile].content.xpath === '') console.log("xpath for content extraction is empty, cannot procedurally extract contents");
    for (var test in CONFIG[profile].tests) {
      var required_data = CONFIG[profile].tests[test];
      var title = required_data.title;
      var url = required_data.url;

      Host.downloadPosting(url, function(posting) {
		if(posting.author != required_data.author) {
		console.log(" author failed:"+posting.author);
		}
	});

      //dbLog('Running test for posting titled:' + title);
      // fetch posting via getPostingDataAJAX() and compare to the fields we are looking for (author, title, date)
      //getPostingDataAJAX(profile, required_data.url);
      //alert("required title:"+title);
    } // foreach test

  } // foreach profile (website)
  
} //runProfileTests

  
  
 
function getProfile(url=undefined) {
  
  if(url === undefined) 
    url=window.location.href;
  else
    url=url;
  
  Host.dbLog("getProfile call URL is:"+url);
  
  for (var profile in CONFIG) {
    if (url.match(CONFIG[profile].url_reg) !== null) {
      Host.dbLog('Matching website profile found');
      var invocations = Host.get_persistent(Host.getScriptVersion(), 0);
      Host.dbLog('Number of script invocations for version ' + Host.getScriptVersion() + ' is:' + invocations);

      
      return CONFIG[profile];
    } // matched website profile
    Host.dbLog('Could not find matching URL in getProfile() call!');
  } // for each profile
}// Get the HTML code that is selected

function getSelectedHtml() {
  // From http://stackoverflow.com/a/6668159
  var html = '',
  selection = document.getSelection();
  if (selection.rangeCount) {
    var container = document.createElement('div');
    for (var i = 0; i < selection.rangeCount; i++) {
      container.appendChild(selection.getRangeAt(i).cloneContents());
    }
    html = container.innerHTML;
  }
  Host.dbLog('instantCquote(): Unprocessed HTML\n\'' + html + '\'');
  return html;
}// Gets the selected text

function getSelectedText() {
  return document.getSelection().toString();
}// Get the ID of the post
// (this needs some work so that it can be used by the AJAX mode, without an actual selection)

function getPostId(selection, profile, focus) {
  if (focus !== undefined) {
    Host.dbLog("Trying to get PostId with defined focus");
    selection = selection.focusNode.parentNode;
  } else {
    Host.dbLog("Trying to get PostId with undefined focus");
    selection = selection.anchorNode.parentNode;
  }
  while (selection.id.match(profile.content.idStyle) === null) {
    selection = selection.parentNode;
  }
  Host.dbLog("Selection id is:"+selection.id);
  return selection.id;
}

// Checks that the selection is valid
function checkValid(selection, profile) {
  var ret = true,
  selection_cp = {
  },
  tags = profile.content.parentTag;
  for (var n = 0; n < 2; n++) {
    if (n === 0) {
      selection_cp = selection.anchorNode.parentNode;
    } else {
      selection_cp = selection.focusNode.parentNode;
    }
    while (true) {
      if (selection_cp.tagName === 'BODY') {
        ret = false;
        break;
      } else {
        var cont = false;
        for (var i = 0; i < tags.length; i++) {
          if (selection_cp[tags[0]] === tags[i]) {
            cont = true;
            break;
          }
        }
        if (cont) {
          break;
        } else {
          selection_cp = selection_cp.parentNode;
        }
      }
    }
  }
  ret = ret && (getPostId(selection, profile) === getPostId(selection, profile, 1));
  return ret;
}// Extracts the raw text from a certain place, using an XPath

function extractFieldInfo(profile, id, field) {
  
  if (field === 'content') {
    Host.dbLog("Returning content (selection)");
    return profile[field].selection();
  } else {
    Host.dbLog("Extracting field via xpath:"+field);
    var xpath = '//*[@id="' + id + '"]/' + profile[field].xpath;
    return Host.eval_xpath(document, xpath).stringValue; // document.evaluate(xpath, document, null, XPathResult.STRING_TYPE, null).stringValue;
  }
}// Change the text using specified transformations

function applyTransformations(fieldInfo, trans) { 
    for (var i = 0; i < trans.length; i++) {
      fieldInfo = trans[i](fieldInfo);
      Host.dbLog('applyTransformations(): Multiple transformation, transformation after loop #' + (i + 1) + ':\n\'' + fieldInfo + '\'');
    }
    return fieldInfo;
  
} //applyTransformations

// Formats the quote

function createCquote(data, indirect_speech=false) {
 if(!indirect_speech)
   return nonQuotedRef(data); // conventional/verbatim selection
  else { 
    // pattern match the content using a vector of regexes
    //data.content = transformSpeech(data.content, data.author, null, speechTransformations );
    return nonQuotedRef(data);
  }
}

function nonQuotedRef(data) { //TODO: rename 
  var template = Host.getTemplate();
  console.log("Using template:\n"+template);
 
  var substituted = template
  .replace('$CONTENT', data.content)
  .replace('$URL',data.url)
  .replace('$TITLE',data.title)  
  .replace('$AUTHOR',data.author)
  .replace('$DATE',datef(data.date))
  .replace('$ADDED',datef(data.date))
  .replace('$SCRIPT_VERSION', Host.getScriptVersion() );

  console.log("Substituted template is:\n"+substituted);
  
  return substituted; 
}// 

// Output the text.
// Tries the jQuery dialog, and falls back to window.prompt()

function outputText(msg, original) {
    console.log("Final output is:\n"+msg);
 
    //msg = msg.replace(/&lt;\/syntaxhighligh(.)>/g, '</syntaxhighligh$1');
    OUTPUT.msgbox(msg);
  
}

// #############
// # Utilities #
// #############

function extract(regex) {
  return function (text) {
    return text.match(regex) [1];
  };
}
function prepend(prefix) {
  return function (text) {
    return prefix + text;
  };
}
function removeComments(html) {
  return html.replace(/<!--.*?-->/g, '');
}// Not currently used (as of June 2015), but kept just in case


// currently unused
function escapePipes(html) {
  html = html.replace(/\|\|/g, '{{!!}n}');
  html = html.replace(/\|\-/g, '{{!-}}');
  return html.replace(/\|/g, '{{!}}');
}// Converts HTML <a href="...">...</a> tags to wiki links, internal if possible.

function a2wikilink(html) {
  // Links to wiki images, because
  // they need special treatment, or else they get displayed.
  html = html.replace(/<a.*?href="http:\/\/wiki\.flightgear\.org\/File:(.*?)".*?>(.*?)<\/a>/g, '[[Media:$1|$2]]');
  // Wiki links without custom text.
  html = html.replace(/<a.*?href="http:\/\/wiki\.flightgear\.org\/(.*?)".*?>http:\/\/wiki\.flightgear\.org\/.*?<\/a>/g, '[[$1]]');
  // Links to the wiki with custom text
  html = html.replace(/<a.*?href="http:\/\/wiki\.flightgear\.org\/(.*?)".*?>(.*?)<\/a>/g, '[[$1|$2]]');
  // Remove underscores from all wiki links
  var list = html.match(/\[\[.*?\]\]/g);
  if (list !== null) {
    for (var i = 0; i < list.length; i++) {
      html = html.replace(list[i], underscore2Space(list[i]));
    }
  }  // Convert non-wiki links
  // TODO: identify forum/devel list links, and use the AJAX/Host.download helper to get a title/subject for unnamed links (using the existing xpath/regex helpers for that)

  html = html.replace(/<a.*?href="(.*?)".*?>(.*?)<\/a>/g, '[$1 $2]');
  // Remove triple dots from external links.
  // Replace with raw URL (MediaWiki converts it to a link).
  list = html.match(/\[.*?(\.\.\.).*?\]/g);
  if (list !== null) {
    for (var i = 0; i < list.length; i++) {
      html = html.replace(list[i], list[i].match(/\[(.*?) .*?\]/) [1]);
    }
  }
  return html;
}// Converts images, including images in <a> links

function img2link(html) {
  html = html.replace(/<a[^<]*?href="([^<]*?)"[^<]*?><img.*?src="http:\/\/wiki\.flightgear\.org\/images\/.*?\/.*?\/(.*?)".*?><\/a>/g, '[[File:$2|250px|link=$1]]');
  html = html.replace(/<img.*?src="http:\/\/wiki\.flightgear\.org\/images\/.*?\/.*?\/(.*?)".*?>/g, '[[File:$1|250px]]');
  html = html.replace(/<a[^<]*?href="([^<]*?)"[^<]*?><img.*?src="(.*?)".*?><\/a>/g, '(see [$2 image], links to [$1 here])');
  return html.replace(/<img.*?src="(.*?)".*?>/g, '(see the [$1 linked image])');
}// Converts smilies

function forum_smilies2text(html) {
  html = html.replace(/<img src="\.\/images\/smilies\/icon_.*?\.gif" alt="(.*?)".*?>/g, '$1');
  for (var i = 0; i < EMOTICONS.length; i++) {
    html = html.replace(EMOTICONS[i][0], EMOTICONS[i][1]);
  }
  return html;
}// Converts font formatting

function forum_fontstyle2wikistyle(html) {
  html = html.replace(/<span style="font-weight: bold">(.*?)<\/span>/g, '\'\'\'$1\'\'\'');
  html = html.replace(/<span style="text-decoration: underline">(.*?)<\/span>/g, '<u>$1</u>');
  html = html.replace(/<span style="font-style: italic">(.*?)<\/span>/g, '\'\'$1\'\'');
  return html.replace(/<span class="posthilit">(.*?)<\/span>/g, '$1');
}// Converts code blocks

function forum_code2syntaxhighlight(html) {
  var list = html.match(/<dl class="codebox">.*?<code>(.*?)<\/code>.*?<\/dl>/g),
  data = [
  ];
  if (list === null) return html;
  for (var n = 0; n < list.length; n++) {
    data = html.match(/<dl class="codebox">.*?<code>(.*?)<\/code>.*?<\/dl>/);
    html = html.replace(data[0], processCode(data));
  }
  return html;
}// Strips any whitespace from the beginning and end of a string

function stripWhitespace(html) {
  html = html.replace(/^\s*?(\S)/, '$1');
  return html.replace(/(\S)\s*?\z/, '$1');
}// Process code, including basic detection of language

function processCode(data) {
  var lang = '',
  code = data[1];
  code = code.replace(/&nbsp;/g, ' ');
  if (code.match(/=?.*?\(?.*?\)?;/) !== null) lang = 'nasal';
  if (code.match(/&lt;.*?&gt;.*?&lt;\/.*?&gt;/) !== null || code.match(/&lt;!--.*?--&gt;/) !== null) lang = 'xml';
  code = code.replace(/<br\/?>/g, '\n');
  return '<syntaxhighlight lang="' + lang + '" enclose="div">\n' + code + '\n&lt;/syntaxhighlight>';
}// Converts quote blocks to Cquotes

function forum_quote2cquote(html) {
  html = html.replace(/<blockquote class="uncited"><div>(.*?)<\/div><\/blockquote>/g, '{{cquote|$1}}');
  if (html.match(/<blockquote>/g) === null) return html;
  var numQuotes = html.match(/<blockquote>/g).length;
  for (var n = 0; n < numQuotes; n++) {
    html = html.replace(/<blockquote><div><cite>(.*?) wrote.*?:<\/cite>(.*?)<\/div><\/blockquote>/, '{{cquote|$2|$1}}');
  }
  return html;
}// Converts videos to wiki style

function vid2wiki(html) {
  // YouTube
  html = html.replace(/<div class="video-wrapper">\s.*?<div class="video-container">\s*?<iframe class="youtube-player".*?width="(.*?)" height="(.*?)" src="http:\/\/www\.youtube\.com\/embed\/(.*?)".*?><\/iframe>\s*?<\/div>\s*?<\/div>/g, '{{#ev:youtube|$3|$1x$2}}');
  // Vimeo
  html = html.replace(/<iframe src="http:\/\/player\.vimeo\.com\/video\/(.*?)\?.*?" width="(.*?)" height="(.*?)".*?>.*?<\/iframe>/g, '{{#ev:vimeo|$1|$2x$3}}');
  return html.replace(/\[.*? Watch on Vimeo\]/g, '');
}// Not currently used (as of June 2015), but kept just in case

// currently unused
function escapeEquals(html) {
  return html.replace(/=/g, '{{=}}');
}// <br> to newline.

function forum_br2newline(html) {
  html = html.replace(/<br\/?><br\/?>/g, '\n');
  return html.replace(/<br\/?>/g, '\n\n');
}// Forum list to wiki style

function list2wiki(html) {
  var list = html.match(/<ul>(.*?)<\/ul>/g);
  if (list !== null) {
    for (var i = 0; i < list.length; i++) {
      html = html.replace(/<li>(.*?)<\/li>/g, '* $1\n');
    }
  }
  list = html.match(/<ol.*?>(.*?)<\/ol>/g);
  if (list !== null) {
    for (var i = 0; i < list.length; i++) {
      html = html.replace(/<li>(.*?)<\/li>/g, '# $1\n');
    }
  }
  html = html.replace(/<\/?[uo]l>/g, '');
  return html;
}
function nowiki(text) {
  return '<nowiki>' + text + '</nowiki>';
}// Returns the correct ordinal adjective

function ordAdj(date) {
  date = date.toString();
  if (date == '11' || date == '12' || date == '13') {
    return 'th';
  } else if (date.substr(1) == '1' || date == '1') {
    return 'st';
  } else if (date.substr(1) == '2' || date == '2') {
    return 'nd';
  } else if (date.substr(1) == '3' || date == '3') {
    return 'rd';
  } else {
    return 'th';
  }
}

// Formats the date to this format: Apr 26th, 2015
function datef(text) {
  var date = new Date(text);
  return MONTHS[date.getMonth()] + ' ' + date.getDate() + ordAdj(date.getDate()) + ', ' + date.getFullYear();
}
function underscore2Space(str) {
  return str.replace(/_/g, ' ');
}






