/*
  Tests: Can add multiple files that import each other

  - Create a.py
  - Create b.py, import a in b.py to generate something together
  - In main.py, import a, import b and check that their content can be accessed from main.py
  - Run this test in a micro:bit at least once with DAPLink 0234 and with 0249.

  * Test 1: A dialog appears when replacing main.py -> 'dialog-test'
  * Test 2: Imports work successfully (this needs to be manually tested on Daplink 0234, 0249) -> 'flash-test'
*/

const puppeteer = require('puppeteer');
const usbutils = require('../src/WebUSB');
const fileutils = require('../src/FileUtils');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    console.log("------------ Test 1 ------------");
    console.log("Tests that we can add multiple files that import each other");
    if (device == null){
      console.log("> Running test without device");
    }else{
      console.log("> Running test with device");
    }

    // Initialise the tests
    let testStates = {
      "dialog-test" : false,
      "flash-test" : null // As test is optional
    };

    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
    const page = await browser.newPage();
    await page.goto(targetUrl);
    await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadsDir});

    await page.click('#command-load');

    const fileInput = await page.$('#fs-file-upload-input');
    await fileInput.uploadFile('./puppeteer/UploadFiles/ImportTest/a.py');
    await fileInput.uploadFile('./puppeteer/UploadFiles/ImportTest/b.py');

    page.on('dialog', async dialog => {
      await dialog.accept();
      if (dialog.message().includes("Adding a main.py file will replace the code in the editor!")){
        testStates["dialog-test"] = true; // Pass of first test, that we get a warning dialog when replacing main.py
      }
    });

    await fileInput.uploadFile('./puppeteer/UploadFiles/ImportTest/main.py');

    // Optional test: Flash to device
    if (device != null){
      await page.mouse.click(5,5);
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
          testStates["flash-test"] = (response === 1); // Pass of second test, that the script is flashed & runs successfully
          resolve(testStates);
        });
      })
      .catch(function(){
        console.log("> Unable to finish test on device");
        browser.close();
        resolve(testStates);
      });

    }else{
      await page.waitFor(1000);
      browser.close();
      resolve(testStates);
    }
  });

}

module.exports = {
  Run : Run
}
