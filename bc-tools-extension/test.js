    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms * 1000));
    const startTimeStamp = Date.now();
    let currentTimeStamp = Date.now();

    console.log(`Waiting an initial 10 seconds before polling...`);
    await sleep(10);

    currentTimeStamp = Date.now();
    let elapsed = (currentTimeStamp - startTimeStamp) / 1000;
    console.log(elapsed, 'seconds passed');

