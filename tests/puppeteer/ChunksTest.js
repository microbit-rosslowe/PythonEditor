/*
  Tests: Add as many tiny files as possible to the filesystem, each less than 128 Bytes (each file < 1 chunk).

  - Record how many fit (it should fit less than 250 - should be 216)
  - Check that at eventually the editor tells you the storage is full
  - Check that the error message is sensible and understandable
  - Check that at after this point is reached all the other files were correctly added to the FS (flash the hex file and in the REPL using os.listdir() and read each individual file)

  * Test 1: < 250 files are added -> 'files-test'
  * Test 2: os.listdir() length is correct -> 'flash-test'
*/

const puppeteer = require('puppeteer');
const fs = require('fs');

const usbutils = require('../src/WebUSB');
const fileutils = require('../src/FileUtils');

async function Run(targetUrl, downloadsDir, device){

  return new Promise(async function(resolve, reject){

    console.log("------------ Test 2 ------------");
    console.log("Tests that the right number of small files fill the filesystem.");
    if (device == null){
      console.log("> Running test without device");
    }else{
      console.log("> Running test with device");
    }

    // Initialise the tests
    let testStates = {
      "files-test" : false,
      "flash-test" : null // As test is optional
    };

    const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']});
    const page = await browser.newPage();
    await page.goto(targetUrl);
    await page._client.send('Page.setDownloadBehavior', {behavior: 'allow', downloadPath: downloadsDir});

    await page.click('#command-load');

    const fileInput = await page.$('#fs-file-upload-input');

    var fileList = [];
    for (var i = 0; i<215; i++){
      var filepath = 'small' + i + '.py';
      if (!fs.existsSync('./puppeteer/UploadFiles/ChunksTest/' + filepath)) {
        console.log(">> Generated new file for test: " + filepath)
        await fs.writeFile('./puppeteer/UploadFiles/ChunksTest/' + filepath, "# Empty Python file < 128 bytes" + filepath, function(err) {
          if(err) {
            return console.log(err);
          }
        });
      }
      fileList.push('./puppeteer/UploadFiles/ChunksTest/' + filepath);
    }
    console.log("> Uploading files (this may take some time)");
    await fileInput.uploadFile(...fileList);

    page.on('dialog', async dialog => {
      await dialog.accept();
      if (dialog.message().includes("There is no storage space left.")){
        var numberOfFiles = parseInt(dialog.message().split("small")[1].split(".py")[0]) + 2;
        console.log("> Created " + numberOfFiles + " files");
        if (numberOfFiles == 216){
          testStates["files-test"] = true; // Pass of first test, file system is filled by the right number of files
        }else{
          testStates["files-test"] = false;
        }

        if (device != null){
          await fileInput.uploadFile('./puppeteer/UploadFiles/ChunksTestPermanent/main.py');
          await page.waitFor(1000);
          await page.mouse.click(5,5);
          await page.waitFor(1000);
          await page.click('#command-download');
          const downloadListener = fileutils.onDownload(downloadsDir);
          downloadListener.then(async function handle(path){
            browser.close();
            console.log("> Flashing main hex");
            await usbutils.flashFile(path, device);
          })
          .then(async function (){
            console.log("> Starting serial listen...");
            const serialListener = usbutils.listenForSuccess(device, "PASS: 215");
            serialListener.then(function (response){
              console.log("> Serial listener finished. Got response: " + response.toString());
              testStates["flash-test"] = (response === 1); // Pass of second test, file is flashed & runs successfully
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
          resolve (testStates);
        }

      }
    });

  });
}

module.exports = {
  Run : Run
}
