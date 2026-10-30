import { exec } from "child_process"
import express from "express"
import http from "http"
import path from "path"
import { fileURLToPath } from "url"

import createWorker from "./worker.js"
import { websocketSetup } from "./websocket.js"



const app = express()

const server = http.createServer(app)


const filename = fileURLToPath(import.meta.url)
const dir = path.dirname(filename)

const port = 3000



export const {Worker,router} = await createWorker()





websocketSetup(server)



app.use(express.static(path.join(dir,"myapp/dist")))



app.get("/{*path}",(req,res)=> {
    res.sendFile(path.join(dir,"myapp/dist","index.html"))
})



exec("cd myapp && npm run build",(err)=> {
    if (err) {
        throw err
    }

    console.log("react loaded ")
})


server.listen(port,()=> console.log(`http://localhost:${port}`))