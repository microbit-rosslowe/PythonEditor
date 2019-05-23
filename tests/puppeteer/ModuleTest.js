/*
  Tests: Python modules are added automatically to the filesystem
  - This script tests that the 'Magic Comment' works when adding files via the filesystem menu

  * Test 1: a.py is added to the filesystem (magic comment on first line) -> 'firstline-test'
  * Test 2: b.py is added to the filesystem (magic comment on second line) -> 'secondline-test'
  * Test 3: c.py is added to the filesystem (magic comment on third line) -> 'thirdline-test'
  * Test 4: d.py replaces main code -> 'fourthline-test'
  * Test 5: code can be flashed to micro:bit -> 'flash-test'
  * Test 6: tests that adding modules doesn't replace filename -> 'filename-test'
*/

const puppeteer = require('puppeteer');
const usbutils = require('../src/WebUSB');
const fileutils = require('../src/FileUtils');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    console.log("------------ Test 8A ------------");
    console.log("Tests that modules are correctly added to the filesystem");
    if (device == null){
      console.log("> Running test without device");
    }else{
      console.log("> Running test with device");
    }

    // Initialise the tests
    let testStates = {
      "firstline-test" : false,
      "secondline-test" : false,
      "thirdline-test" : false,
      "filename-test" : true, // Passes by default
      "fourthline-test" : false,
      "flash-test" : null
    };

    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
    const page = await browser.newPage();
    await page.goto(targetUrl);

    let fileList;
    let fileListContents = "";

    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.click('#command-load');
    let fileInput = await page.$("#file-upload-input");
    await fileInput.uploadFile('./puppeteer/UploadFiles/ModuleTest/a.py');
    await page.waitFor(1000);
    await page.click('#command-load');
    fileList = await page.$('#fs-file-list');
    fileListContents = await fileList.getProperty("innerHTML");
    if (fileListContents.toString().includes("a.py")) testStates["firstline-test"] = true; // Pass of first test, loading a module loads it into the filesystem
    if (await page.evaluate('document.getElementById("script-name").innerHTML').toString().includes("a.py")) testStates["filename-test"] = false;

    fileInput = await page.$("#file-upload-input");
    await fileInput.uploadFile('./puppeteer/UploadFiles/ModuleTest/b.py');
    await page.waitFor(1000);
    await page.click('#command-load');
    fileList = await page.$('#fs-file-list');
    fileListContents = await fileList.getProperty("innerHTML");
    if (fileListContents.toString().includes("b.py")) testStates["secondline-test"] = true; // Pass of second test, loading a module loads it into the filesystem
    if (await page.evaluate('document.getElementById("script-name").innerHTML').toString().includes("b.py")) testStates["filename-test"] = false;

    fileInput = await page.$("#file-upload-input");
    await fileInput.uploadFile('./puppeteer/UploadFiles/ModuleTest/c.py');
    await page.waitFor(1000);
    await page.click('#command-load');
    fileList = await page.$('#fs-file-list');
    fileListContents = await fileList.getProperty("innerHTML");
    if (fileListContents.toString().includes("c.py")) testStates["thirdline-test"] = true; // Pass of third test, loading a module loads it into the filesystem
    if (await page.evaluate('document.getElementById("script-name").innerHTML').toString().includes("c.py")) testStates["filename-test"] = false;

    fileInput = await page.$("#file-upload-input");
    await fileInput.uploadFile('./puppeteer/UploadFiles/ModuleTest/d.py');
    await page.waitFor(1000);
    await page.click('#command-load');
    fileList = await page.$('#fs-file-list');
    fileListContents = await fileList.getProperty("innerHTML");
    if (!fileListContents.toString().includes("d.py")) testStates["fourthline-test"] = true; // Pass of fourth test, loading a file that isn't a module replaces main code and doesn't appear in filesystem list

    if (device != null){
      await page.mouse.click(5,5);
      await page.waitFor(1000);
      await page.click('#command-download');

      await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadsDir});

      const downloadListener = fileutils.onDownload(downloadsDir);
      console.log("> Awaiting download...");

      downloadListener.then(async function handle(path){
        console.log("> Flashing main hex");
        await usbutils.flashFile(path, device);
      })
      .then(async function (){
        await browser.close();
        console.log("> Starting serial listen...");
        const serialListener = usbutils.listenForSuccess(device, "PASS");
        serialListener.then(function (response){
          console.log("> Serial listener finished. Got response: " + response.toString());
          testStates["flash-test"] = (response === 1); // pass of fifth test, code is flashed to the micro:bit
          resolve(testStates);
        });
      })
      .catch(function(){
        console.log("> Unable to finish test on device");
        browser.close();
        resolve(testStates);
      });
    }else{
      await browser.close();
      resolve(testStates);
    }

  });
}

module.exports = {
  Run : Run
}
