const net = require('net');
const server = net.createServer((c) => {
  // 'connection' listener.
  console.log('client connected');
  c.on('end', () => {
    console.log('client disconnected');
  });
  c.write('hello\r\n');
  c.on('readable', () => {
  let chunk;
  console.log('Stream is readable (new data received in buffer)');
  // Use a loop to make sure we read all currently available data
  while (null !== (chunk = c.read())) {
    console.log(`Read ${chunk.length} bytes of data... [${chunk}]`);
  }
  });
  c.pipe(c);
});

server.on('error', (err) => {
  throw err;
});
server.listen(2324, () => {
  console.log('server bound');
});
