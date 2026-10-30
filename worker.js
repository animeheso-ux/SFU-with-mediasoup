import mediasoup from "mediasoup"

import createRooms from "./router.js"

export  default async function createWorker() {
  const worker = await mediasoup.createWorker();

  console.log("Worker created!");
  console.log("Worker PID:", worker.pid);

  worker.on("died", () => {
    console.error("mediasoup Worker died!");
    process.exit(1);
  });




  const {router} = await createRooms(worker)

  return {worker,router}
}

