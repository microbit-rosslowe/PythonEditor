/*
  Tests: Add a single file that is too large for the filesystem
  - We have 216 chunks ([27 * 1024] / 128), so create a file that takes 216 chunks
  - Check that this shows an error message

  * Test 1: Adding a file that is too large shows an error message on load -> 'loads-test'
*/

const puppeteer = require('puppeteer');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    try {
      console.log("------------ Test 5 ------------");
      console.log("Tests that an error is raised when a file is added to the filesystem at capacity");
      if (device == null){
        console.log("> Running test without device");
      }else{
        console.log("> Running test with device");
      }

      // Initialise the tests
      let testStates = {
        "loads-test" : false
      };

      const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
      const page = await browser.newPage();
      await page.goto(targetUrl);

      await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadsDir});

      page.on('dialog', async dialog => {
        if (dialog.message().includes("enough space")){
          testStates["loads-test"] = true; // Pass of first test, that an error message appears when downloading a hex file that is too large
        }
        await dialog.accept();
      });

      await page.click('#command-load');
      let fileInput = await page.$("#file-upload-input");
      await fileInput.uploadFile('./puppeteer/UploadFiles/ToolargeTest/main.py');

      await page.click('#command-load');
      fileInput = await page.$('#fs-file-upload-input');
      await fileInput.uploadFile('./puppeteer/UploadFiles/ToolargeTest/main.py');


      await page.waitFor(3000); // Wait for an error dialog, if applicable
      browser.close();
      resolve(testStates);
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
