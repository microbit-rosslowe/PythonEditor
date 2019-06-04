/*
  Tests: Add a single file that takes the entire filesystem
  - We have 216 chunks ([27 * 1024] / 128), so create a file that takes 216 chunks (no need to fill the last chunk to the very last byte)
  - Check that this file as a main.py works
  - Filesize: ([27 * 1024] * [126 / 128] ) - 2 = 27,214

  * Test 1: File is loaded in editor successfully -> 'loads-test'
  * Test 2: File can be flashed to micro:bit -> 'flash-test'
*/

const puppeteer = require('puppeteer');
const usbutils = require('../src/WebUSB');
const fileutils = require('../src/FileUtils');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    try {
      console.log("------------ Test 4 ------------");
      console.log("Tests that the filesystem can be filled by a single, large file");
      if (device == null){
        console.log("> Running test without device");
      }else{
        console.log("> Running test with device");
      }

      // Initialise the tests
      let testStates = {
        "loads-test" : false,
        "flash-test" : null // Test is optional
      };

      const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
      const page = await browser.newPage();
      await page.goto(targetUrl);
      await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadsDir});

      await page.click('#command-load');
      await page.click('.load-drag-target.load-toggle');

      const fileInput = await page.$("#file-upload-input");
      await fileInput.uploadFile('./puppeteer/UploadFiles/LargeTest/main.py');

      page.on('dialog', async dialog => {
        if (dialog.message().includes("large")){
          testStates["loads-test"] = false;
        }
      });

      testStates["loads-test"] = true; // Pass of first test, that the file loads successfully (without an error dialog)

      if (device != null){

        await page.waitFor(1000);
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
          const serialListener = usbutils.listenForSuccess(device, "PASS");
          serialListener.then(function (response){
            console.log("> Serial listener finished. Got response: " + response.toString());
            testStates["flash-test"] = (response === 1); // Pass of second test, that the large file is flashed & runs successfully
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
    } catch (e) {
      if (e.toString().includes("Cannot read property")) {
        console.warn("!! An error occurred. If you've updated the editor, check that you've updated the selectors in the tests.");
      }
      try {
        browser.close();
      }
      finally {
        reject(e);
      }
    }
  });
}

module.exports = {
  Run : Run
}
