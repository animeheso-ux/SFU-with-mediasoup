import { useState, useEffect, useRef } from 'react'
import './App.css'
import { Device } from "mediasoup-client"

function App() {
  const [count, setCount] = useState(0)
  const DeviceREF = useRef(null)
  const websocketREF = useRef(null)
  const transportInfoREF = useRef(null)
  const recvTransportInfoREF = useRef(null)
  const transportREF = useRef(null)
  const receiveTransportREF = useRef(null)
  const callbacksREF = useRef(null)
  const receiveCallbacksREF = useRef(null)
  const producerCallbacksREF = useRef(null)
  const [remoteStreams,setRemoteStreams] = useState([])


  function startCall() {


    websocketREF.current.send(JSON.stringify({ type: "getRTP" }))
  }


  async function createDevice(rtpparamas, transportInfo, recvTransportInfo) {
    const device = new Device()
    DeviceREF.current = device


    await device.load({
      routerRtpCapabilities: rtpparamas
    })

    const transport = await device.createSendTransport({
      ...transportInfo, iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    })
    transportREF.current = transport

    const receiveTransport = await device.createRecvTransport({
      ...recvTransportInfo, iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    })





    receiveTransportREF.current = receiveTransport


    receiveTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
      receiveCallbacksREF.current = { callback, errback }
      websocketREF.current.send(JSON.stringify({ type: "connectReceiverTransport", dtlsParameters: dtlsParameters }))
    })


    transport.on("connect", ({dtlsParameters }, callback, errback) => {
      callbacksREF.current = { callback, errback }
      websocketREF.current.send(JSON.stringify({ type: "connectTransport", dtlsParameters: dtlsParameters }))
    })

    transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
              console.log("Frontend requesting Producer:", kind);
      producerCallbacksREF.current = { callback, errback }
      websocketREF.current.send(JSON.stringify({
        type: "produce",
        kind,
        rtpParameters
      }));
    });




    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video : true
    });

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0]


    console.log("Audio:", audioTrack);
console.log("Video:", videoTrack);

const audioProducer = await transport.produce({ track: audioTrack });
console.log("Audio producer:", audioProducer.id);

const videoProducer = await transport.produce({ track: videoTrack });
console.log("Video producer:", videoProducer.id);







    console.log("device ready")

    return device
  }




  useEffect(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const websocket = new WebSocket(`${wsProtocol}//${window.location.host}`)

    websocketREF.current = websocket


    websocket.addEventListener("open", () => {




      console.log("client open!")
    })

    websocket.addEventListener("message", async (e) => {
      const Data = JSON.parse(e.data)




      if (Data.type == "returnRTP") {

        console.log(Data.rtpinfo)


        transportInfoREF.current = Data.transportInfo
        recvTransportInfoREF.current = Data.recvTransportInfo
        createDevice(Data.rtpinfo, Data.transportInfo, Data.recvTransportInfo)
      }

      if (Data.type === "transportConnected") {
        callbacksREF.current?.callback()
        callbacksREF.current = null
        console.log("Server transport connected!");
      }


      if (Data.type === "transportReceiverConnected") {
        receiveCallbacksREF.current?.callback()
        receiveCallbacksREF.current = null
        console.log("Server receiver transport connected!");
      }


      if (Data.type == "producerCreated") {
        console.log("Server created Producer:", Data.id);


        producerCallbacksREF.current?.callback({id : Data.id})
        producerCallbacksREF.current = null


        // Request to receive the other participant's audio
        websocketREF.current.send(JSON.stringify({
          type: "consume",
          otherProducers: Data.otherProducers,
          rtpCapabilities: DeviceREF.current.rtpCapabilities
        }));


      }

      if (Data.type === "newProducer") {
        websocketREF.current.send(JSON.stringify({
          type: "consume",
          otherProducers: [Data.producerId],
          rtpCapabilities: DeviceREF.current.rtpCapabilities
        }))
      }

      if (Data.type === "consumerCreated") {
        for (const params of Data.consumers) {
          const consumer = await receiveTransportREF.current.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters
          })

          console.log("Consumer created:", consumer.id)

          websocketREF.current.send(JSON.stringify({
            type: "resumeConsumer",
            consumerId: consumer.id
          }))

          const stream = new MediaStream([consumer.track])


          console.log("Consumer ID:", consumer.id)
          console.log("Track state:", consumer.track.readyState)
          console.log("Track enabled:", consumer.track.enabled)
          console.log("Track muted:", consumer.track.muted)

          consumer.track.onunmute = () => {
            console.log("Audio track is receiving media!")
          }




    if (consumer.track.kind === "audio") {
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.srcObject = stream;
      document.body.appendChild(audio);

      await audio.play().catch(console.error);
    }
    if (consumer.track.kind === "video") {


      setRemoteStreams(prev => [...prev,stream])
    }


        }
      }



    })
  }, [])
  return (
    <>
      <div>
      {remoteStreams.map((stream,index)=> {
        return (<div key={index}>
          <video autoPlay playsInline ref={(video) => {
            if (video) {
              video.srcObject = stream
            }
          }}></video>
        </div>)
      })}
        <button onClick={startCall}>start</button>
        <audio id="remoteAudio" autoPlay />
      </div>
    </>
  )
}

export default App
