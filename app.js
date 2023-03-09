const express = require('express')
const path = require("path");
const app = express()
// Require fs and csv-stringify modules
const fs = require('fs');
// Require csv-stringify module using the default export
const stringify = require('csv-stringify');
const { Parser } = require('json2csv');
var DOMParser = require('xmldom').DOMParser;
const fse = require("fs-extra");
var cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js')
// #############################################################################
// Logs all request paths and method
app.use(function (req, res, next) {
  res.set('x-timestamp', Date.now())
  res.set('x-powered-by', 'cyclic.sh')
  console.log(`[${new Date().toISOString()}] ${req.ip} ${req.method} ${req.path}`);
  next();
});

// #############################################################################
// This configures static hosting for files in /public that have the extensions
// listed in the array.
var options = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html','css','js','ico','jpg','jpeg','png','svg'],
  index: ['index.html'],
  maxAge: '1m',
  redirect: false
}
app.use(express.static('public', options))

// #############################################################################
// Catch all handler for all other request.
app.use('*', (req,res) => {
  // Call fetchData function every 5 seconds using setInterval 
setInterval(fetchData,5000);
  res.json({
      at: new Date().toISOString(),
      method: req.method,
      hostname: req.hostname,
      ip: req.ip,
      query: req.query,
      headers: req.headers,
      cookies: req.cookies,
      params: req.params
    })
    .end()
})
let currentBtcPrice;
let currentChatSpeed;


const supabaseUrl = 'https://neagbwwobyqvckagizsx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lYWdid3dvYnlxdmNrYWdpenN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzgyOTU0MzEsImV4cCI6MTk5Mzg3MTQzMX0.vWsrJB96E-fOHtJlWVbdUL0d6yfVcDekJDS-I117wQk'
const supabase = createClient(supabaseUrl, supabaseKey)
async function checkAndSave(messages) {
    let chatData;
    try {
      chatData = await fse.readFile("chatdata.csv", "utf8");
    } catch (error) {
      console.error(error);
      return;
    }
    let lines = chatData.split("\n");
    
    // Check if this is the first entry in chatdata.csv
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      // Add a row with column headers
      await fse.appendFile("chatdata.csv", "id,time,user_id,username,text,symbol,btcprice,chatspeed\n");
    }
    
    
    
    for (let message of messages) {
      let id = message.id;
      let exists = false;
      for (let line of lines) {
        let lineId = line.split(",")[0];
        if (lineId === id) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        try {
          // Create a new object with only the desired properties
          const newMessage = {
            id: message.id,
            time: message.time,
            user_id: message.user_id,
            username: message.username,
            text: `"${message.text.replace(/\n/g, ' ').replace(/"/g, '""').replace(/,/g, ' ')}"`,
            symbol: message.symbol,
            btcprice: await currentBtcPrice,
            chatspeed: currentChatSpeed // Add chatspeed property to newMessage object
          };
          console.log(newMessage.btcprice)
          await fse.appendFile("chatdata.csv", Object.values(newMessage).join(",") + "\n");
        } catch (error) {
          console.error(error);
          continue;
        }
      }
    }
  }

// Declare an async function that fetches data from the URL and calls saveToCSV function with it

async function fetchData() {
  try {

     // Call updatePrice before calling checkAndSave 
      currentBtcPrice = await updatePrice();

     // Use await keyword to wait for the fetch promise to resolve
     const response = await fetch('https://www.tradingview.com/conversation-status/?_rand=0.46910101152052874&offset=0&room_id=bitcoin&stat_interval=60&size=10');
     // Use await keyword to wait for the response.json() promise to resolve
     const data = await response.json();
     // Get the messages array from the data object
     const messages = data.messages;

     // Define a helper function that converts a timestamp string to seconds
     const timestampToSeconds = (timestamp) => {
       const parts = timestamp.split(' ')[4].split(':');
       const seconds = (+parts[0]) * 60 * 60 + (+parts[1]) * 60 + (+parts[2]);
       return seconds;
     }

     // Define a helper function that calculates the messages per minute rate 
     const messagesPerMinute= (messages) => {

       const lastTimestamp= timestampToSeconds(new Date().toUTCString())
       const firstTimestamp=timestampToSeconds(messages[messages.length-1].time);
       const durationMinutes= (lastTimestamp - firstTimestamp)/60;
       const count=messages.length;
       const rate=count/durationMinutes;
       currentChatSpeed =  rate;
       return rate; 
     }

   // Log the chat speed to the console 
   console.log(`Chat Speed: ${messagesPerMinute(messages)} messages per minute`);

   // Call saveToCSV function with messages array as an argument 
   await checkAndSave(messages);

 } catch (error) { 
   // If there is an error, log it to the console 
   console.error(error); 
 } 
}

async function updatePrice() {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    return data.bitcoin.usd;
}

module.exports = app
