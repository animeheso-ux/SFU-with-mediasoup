import express from "express"


export  default async function createRooms(worker) {
     const router = await worker.createRouter({
         mediaCodecs: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000
      }
    ]
  });

  console.log("Route created!")




  return {router};
}


