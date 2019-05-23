/*
  Tests: Describe the purpose of the test in 1 line

  - Describe each of the steps involved in the test

  * Test 1: List the test completion criteria
*/

const puppeteer = require('puppeteer');
const usbutils = require('../src/WebUSB');
const fileutils = require('../src/FileUtils');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    // Give the test number and the purpose of the test
    console.log("------------ Test 1 ------------");
    console.log("Tests that we can add multiple files that import each other");
    if (device == null){
      console.log("> Running test without device");
    }else{
      console.log("> Running test with device");
    }

    // Initialise the test states
    let testStates = {
      "dialog-test" : false,
      "flash-test" : null // Use null where a test is optional, i.e. any devices requiring a physical micro:bit connection
    };

    // Begin each test by initialising the browser
    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
    const page = await browser.newPage();
    await page.goto(targetUrl);
    await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadsDir}); // Sets the downloads directory to a local directory. Only required on tests that perform a download action (& flash a downloaded hex to a device)

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
      await page.mouse.click(5,5); // Dismisses the dialog by clicking outside the dialog
      await page.waitFor(1000); // Let browser catch-up. Sometimes required due to page animations, which can conceal elements

      await page.click('#command-download');

      const downloadListener = fileutils.onDownload(downloadsDir); // Listens to the custom downloads directory and returns the path of the downloaded file. Allows us to flash a hex to the micro:bit from the editor.
      console.log("> Awaiting download...");

      downloadListener.then(async function handle(path){
        browser.close();
        console.log("> Flashing main hex");
        await usbutils.flashFile(path, device); // Flashes a given hex file (given the path)
      })
      .then(async function (){
        console.log("> Starting serial listen...");
        const serialListener = usbutils.listenForSuccess(device, "PASS"); // Connects to serial and listens for the given 'success code'. In this case, the flashed hex contains while True: print ("PASS")
        serialListener.then(function (response){
          console.log("> Serial listener finished. Got response: " + response.toString());
          testStates["flash-test"] = (response === 1);
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
