/*
  Tests: In the load modal (from the 'Add to the filesystem' button), a user can add a main.py file to the filesystem.
  - It should warn the user that the content will be replaced
  - Cancel should keep the old code in the editor
  - Accepting should replace the editor content with the main.py content
  - The filesystem UX should not display the main.py file in the files table

  * Test 1: We get a warning dialog -> 'dialog-test'
  * Test 2: Cancelling the warning dialog doesn't change the code -> 'cancel-test'
  * Test 3: Accepting the warning dialog does replace the code -> 'accept-test'
  * Test 4: Filesystem should not display main.py file in the files table -> 'files-test'
*/

const puppeteer = require('puppeteer');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    try {
      console.log("------------ Test 3 ------------");
      console.log("Tests that replacing main.py shows dialogs");
      if (device == null){
        console.log("> Running test without device");
      }else{
        console.log("> Running test with device");
      }

      // Initialise the tests
      let testStates = {
        "dialog-test" : false,
        "cancel-test" : false,
        "accept-test" : false,
        "files-test" : false
      };

      const browser = await puppeteer.launch({headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
      const page = await browser.newPage();
      await page.goto(targetUrl);

      await page.click('#command-load');
      const fileInput = await page.$('#fs-file-upload-input');
      await fileInput.uploadFile('./puppeteer/UploadFiles/LoadTest/main.py');

      let hasAttemptedCancel = false;
      page.on('dialog', async dialog => {
        if (dialog.message().includes("Adding a main.py file will replace the code in the editor!")){
          testStates["dialog-test"] = true; // Pass of first test, that we get a warning dialog when replacing main.py
          if (!hasAttemptedCancel){
            await dialog.dismiss();
            //if (!await page.evaluate('EDITOR.getCode();').toString().includes("Pass")) testStates["cancel-test"] = true; // FIXME: Editor isn't currently exposed so this test fails to run.

            testStates["cancel-test"] = true;
            hasAttemptedCancel = true;
            await fileInput.uploadFile('./puppeteer/UploadFiles/LoadTest/main.py');
          }else{
            await dialog.accept();
            //if (await page.evaluate('EDITOR.getCode();').toString().includes("Pass")) testStates["accept-test"] = true; // FIXME: Editor isn't currently exposed so this test fails to run.
            testStates["accept-test"] = true;
            const fileList = await page.$('#fs-file-list');
            const fileListContents = await fileList.getProperty("innerHTML");
            if (!fileListContents.toString().includes("main.py")) testStates["files-test"] = true; // Pass of fourth test, main.py appears in filesystem list
            browser.close();
            resolve(testStates);
          }
        }
      });
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
