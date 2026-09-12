import autocannon from 'autocannon';

async function run() {
  const url = 'http://localhost:5005';
  
  const instance = autocannon({
    url: `${url}/api/health`,
    connections: 10,
    pipelining: 1,
    duration: 10
  });

  autocannon.track(instance, { renderProgressBar: true });

  instance.on('done', (result) => {
    console.log(`Load test completed for ${url}/api/health`);
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Average Latency: ${result.latency.average} ms`);
    console.log(`Errors: ${result.errors}`);
  });
}

run();
