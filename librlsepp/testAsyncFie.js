const fs = require("fs");
const FILE = "sample.txt";

// This async function returns a promise that the 'text' we pass into
// this function has been asynchrnously written into our FILE.
async function write(text) {
  return new Promise((resolve, reject) => {
    fs.writeFile(FILE, text, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// This async function returns a promise that resolves to the the asynchronously
// read content in our FILE by fs.readFile
async function read() {
  return new Promise((resolve, reject) => {
    fs.readFile(FILE, "utf8", (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

// We can now run async non-blocking code
// as if it was 'normal' blocking code that 
// we're used to seeing in other languages!
async function main() {
  
  const originalContent = await read();

  console.log(originalContent);

  await write("updated con");

  const updatedContent = await read();

  console.log(updatedContent);
}

main();
