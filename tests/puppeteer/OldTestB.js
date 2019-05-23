/*
  Tests: Hex files from old versions of the editor should work well

  * Test 1: 0.9.hex should load correctly -> 'load-test'
  * Test 2: Hex should be flashed correctly -> 'flash-test'
*/

const puppeteer = require('puppeteer');
const usbutils = require('../src/WebUSB');
const fileutils = require('../src/FileUtils');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    console.log("------------ Test 7B ------------");
    console.log("Tests that v0.9 hex file can be flashed correctly");
    if (device == null){
      console.log("> Running test without device");
    }else{
      console.log("> Running test with device");
    }

    // Initialise the tests
    let testStates = {
      "load-test" : false,
      "flash-test" : null // Optional
    };

    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
    const page = await browser.newPage();
    await page.goto(targetUrl);

    page.on('dialog', async dialog => {
      await dialog.accept();
      testStates["load-test"] = false;
    });

    await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadsDir});

    await page.click('#command-load');
    await page.click('.load-drag-target.load-toggle');
    let fileInput = await page.$("#file-upload-input");
    await fileInput.uploadFile('./puppeteer/UploadFiles/OldTest/0.9.hex');
    testStates["load-test"] = true; // Pass of first test, code is loaded successfully
    await page.waitFor(1000);

    if (device != null){
      await page.click('#command-download');

      const downloadListener = fileutils.onDownload(downloadsDir);
      console.log("> Awaiting download...");

      downloadListener.then(async function handle(path){
        browser.close();
        console.log("> Flashing main hex");
        await usbutils.flashFile(path, device);
      })
      .then(async function (){
        console.log("> Starting serial listen...");
        const serialListener = usbutils.listenForSuccess(device, "PASS2");
        serialListener.then(function (response){
          console.log("> Serial listener finished. Got response: " + response.toString());
          testStates["flash-test"] = (response === 1); // Pass of second test, code is flashed successfully
          resolve(testStates);
        });
      })
      .catch(function(){
        console.log("> Unable to finish test on device");
        browser.close();
        resolve(testStates);
      });
    }else{
      browser.close();
      resolve(testStates);
    }

  });
}

module.exports = {
  Run : Run
}
