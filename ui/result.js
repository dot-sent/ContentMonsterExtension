"use strict";

browser.runtime.onMessage.addListener(function(m) {
  //console.log("In result script, received message from background script: ");
  //console.log(m.greeting);
 
  if(m.type == "set-output") {
	document.querySelector("#output").value=m.output ;
  }

}); //addListener

function copy() {
  var copyText = document.querySelector("#output");
  copyText.select();
  document.execCommand("Copy");
  //document.querySelector("#output").value=m.output ;
}

document.querySelector("#copy").addEventListener("click", copy);

//document.addEventListener("DOMContentLoaded", defaults);
