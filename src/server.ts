import express, { Application, Request, Response } from "express";
import process from "process";
import request from "request";

const app: Application = express();
const port = process.env.PORT || 8080;

const config = require("../config.json");

app.get("/hello", (req: Request, res: Response) => {
  res.send("hello world!");
});

app.use("/proxy/:cluster", (req: Request, res: Response) => {
  let clusterName = req.params.cluster;

  if (!(clusterName in config.clusters)) {
    return res
      .status(400)
      .send(`No config available for cluster ${clusterName}`);
  }

  let cluster = config.clusters[clusterName];

  let esRequest = request(cluster.url + req.url);
  if (cluster.user) {
    esRequest = esRequest.auth(cluster.user, cluster.pass);
  }

  req.pipe(esRequest).pipe(res);
});

app.use(express.static("dist"));

app.listen(port, () => {
  console.log(`app started: http://localhost:${port}`);
});
