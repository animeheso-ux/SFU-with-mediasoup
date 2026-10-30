import { WebSocketServer } from "ws"
import { router } from "./server.js"

let Users = new Map()






export function websocketSetup(server) {
    const wsServer = new WebSocketServer({ server })




    wsServer.on("connection", (ws) => {
        console.log("server online!")


        ws.on("message", async (e) => {
            const Data = JSON.parse(e)

            if (Data.type == "getRTP") {

                const listenInfos = [
                    { protocol: "udp", ip: "0.0.0.0", announcedAddress: "127.0.0.1" }, // your LAN IP
                    { protocol: "tcp", ip: "0.0.0.0", announcedAddress: "127.0.0.1" }
                ]

                const transportOptions = {
                    listenInfos,
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true
                }

                const senderTransport = await router.createWebRtcTransport(transportOptions)
                const recvTransport = await router.createWebRtcTransport(transportOptions)


                const transportInfo = {
                    id: senderTransport.id,
                    iceParameters: senderTransport.iceParameters,
                    iceCandidates: senderTransport.iceCandidates,
                    dtlsParameters: senderTransport.dtlsParameters
                };




                const recvTransportInfo = {
                    id: recvTransport.id,
                    iceParameters: recvTransport.iceParameters,
                    iceCandidates: recvTransport.iceCandidates,
                    dtlsParameters: recvTransport.dtlsParameters
                };

                console.log("Sender ICE:", senderTransport.iceState)
                console.log("Receiver ICE:", recvTransport.iceState)

                console.log("ICE candidates:", senderTransport.iceCandidates);

                senderTransport.on("icestatechange", (state) => {
                    console.log("ICE STATE:", state)
                })

                senderTransport.on("dtlsstatechange", (state) => {
                    console.log("DTLS STATE:", state)
                })

                recvTransport.on("icestatechange", (state) => {
                    console.log("ICE STATE:", state)
                })

                recvTransport.on("dtlsstatechange", (state) => {
                    console.log("DTLS STATE:", state)
                })



                console.log("Transport created!");


                Users.set(ws, {
                    senderTransport: senderTransport,
                    receiverTransport: recvTransport,
                    producer: [],
                    consumer: []
                })


                ws.send(JSON.stringify({ type: "returnRTP", rtpinfo: router.rtpCapabilities, transportInfo: transportInfo, recvTransportInfo: recvTransportInfo }))
            }

            if (Data.type == "connectTransport") {

                await Users.get(ws).senderTransport.connect({ dtlsParameters: Data.dtlsParameters })


                ws.send(JSON.stringify({
                    type: "transportConnected"
                }));
            }


            if (Data.type == "connectReceiverTransport") {

                await Users.get(ws).receiverTransport.connect({ dtlsParameters: Data.dtlsParameters })

                ws.send(JSON.stringify({
                    type: "transportReceiverConnected"
                }));
            }

            if (Data.type === "produce") {

                const producer = await Users.get(ws).senderTransport.produce({
                    kind: Data.kind,
                    rtpParameters: Data.rtpParameters
                })

                Users.get(ws).producer.push(producer)

                const otherProducersEntries = [...Users.entries()]

                const otherProducers = [...Users.entries()]
                    .filter(([key]) => key !== ws)
                    .flatMap(([, value]) => value.producer.map(p => p.id))




                for (const [client, user] of Users.entries()) {
                    if (client !== ws && client.readyState === 1) {
                        client.send(JSON.stringify({
                            type: "newProducer",
                            producerId: producer.id
                        }))
                    }
                }


                ws.send(JSON.stringify({
                    type: "producerCreated",
                    id: producer.id,
                    otherProducers: otherProducers,
                    kind : producer.kind
                }));
            }

            if (Data.type === "consume") {

                const consumers = await Promise.all(
                    Data.otherProducers.map(async (producerId) => {
                        const consumer = await Users.get(ws).receiverTransport.consume({
                            producerId,
                            rtpCapabilities: Data.rtpCapabilities,
                            paused: true
                        })

                        Users.get(ws).consumer.push(consumer)

                        return {
                            id: consumer.id,
                            producerId: consumer.producerId,
                            kind: consumer.kind,
                            rtpParameters: consumer.rtpParameters
                        }
                    })
                )

                ws.send(JSON.stringify({
                    type: "consumerCreated",
                    consumers: consumers
                }))
            }

            if (Data.type === "resumeConsumer") {
                const consumer = Users.get(ws).consumer.find(consumer => consumer["id"] == Data.consumerId)

                if (consumer) {
                    await consumer.resume();
                    console.log("Consumer resumed!");
                }
            }


        })
    })

}