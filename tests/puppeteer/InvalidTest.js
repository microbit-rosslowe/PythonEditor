/*
  Tests: Adding invalid files
  - Trying to load a completely empty file to the filesystem should display an understandable error message.
  - Trying to load an invalid hex file (e.g. from MakeCode) should display an understandable error message.

  * Test 1: Uploading a completely empty file shows an error message -> 'empty-py-test'
  * Test 2: Loading an invalid hex file shows an error message -> 'invalid-test'
*/

const puppeteer = require('puppeteer');
const fs = require('fs');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    console.log("------------ Test 6 ------------");
    console.log("Tests that adding invalid files gives an error");
    if (device == null){
      console.log("> Running test without device");
    }else{
      console.log("> Running test with device");
    }

    // Initialise the tests
    let testStates = {
      "empty-py-test" : false,
      "invalid-test" : false
    };

    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
    const page = await browser.newPage();
    await page.goto(targetUrl);

    page.on('dialog', async dialog => {
      if (dialog.message().includes("has to contain data")) testStates["empty-py-test"] = true; // Pass of first test, that we get an error dialog when loading an empty file
      else if (dialog.message().includes("data after an EOF")) testStates["invalid-test"] = true; // Pass of second test, that we get an error dialog when loading an invalid hex file
      await dialog.accept();
    });

    await page.click('#command-load');
    let fileInput = await page.$('#fs-file-upload-input');
    await fileInput.uploadFile('./puppeteer/UploadFiles/InvalidTest/empty.py');
    await page.waitFor(1000);

    await page.click('.load-drag-target.load-toggle');
    fileInput = await page.$("#file-upload-input");
    await fileInput.uploadFile('./puppeteer/UploadFiles/InvalidTest/makecode.hex');
    await page.waitFor(1000);

    browser.close();
    resolve(testStates);

  });
}

module.exports = {
  Run : Run
}
