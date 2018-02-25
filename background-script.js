// background-script.js

function actionButtonClicked() {
browser.runtime.openOptionsPage();
}

browser.browserAction.onClicked.addListener( actionButtonClicked );

var portFromCS;

function connected(p) {
  console.log("new content script connected!");
  portFromCS = p;
  //portFromCS.postMessage({greeting: "hi there content script!"});
  portFromCS.onMessage.addListener(function(m) {
    //console.log("In background script, received message from content script")
    //console.log(m.greeting);

   if (m.type == "show-result") {

function onCreated(tab) {
var sending = browser.tabs.sendMessage(
  tab.id,
  { type:"set-output", output:m.output}
); // sendMessage

  //p.postMessage({type: "set-output", output="baz" });
} // onCreated

  function onError() {}

  var createData = {
  //type: "detached_panel",
  url: "ui/result.html"
  //width: 320,
  //height: 320
  };
  var creating = browser.tabs.create(createData);
  creating.then(onCreated, onError);

 } // show-result

  }); // addListener
} // connected

browser.runtime.onConnect.addListener(connected);

/*
browser.browserAction.onClicked.addListener(function() {
  portFromCS.postMessage({greeting: "they clicked the browser action button!"});
});
*/

function storageTest() {

if(0)
browser.storage.local.set({
  kitten:  {name:"Mog", eats:"mice"},
  monster: {name:"Kraken", eats:"people"}
});

function onGot(item) {
  console.log(item);
}

function onError(error) {
  console.log(`Error: ${error}`);
}


let gettingItem = browser.storage.local.get();
gettingItem.then(onGot, onError);

console.log( JSON.stringify(gettingItem));

} //storageTest

storageTest();
