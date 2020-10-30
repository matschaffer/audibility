import * as Tone from "tone";

export class ESPlayer {
  server: string;
  indexPattern: string;
  playCallback: (event: any) => void;
  initialLoad: number;
  delay: number;
  blockDuration: number;
  size: number;
  blocks: any[];

  constructor(
    server: string,
    indexPattern: string,
    playCallback: (event: any) => void,
    initialLoad: number = 4,
    delay = 120,
    blockDuration = 2,
    size = 10000
  ) {
    this.server = server;
    this.indexPattern = indexPattern;
    this.playCallback = playCallback;
    this.initialLoad = initialLoad;
    this.delay = delay;
    this.blockDuration = blockDuration;
    this.size = size;
    this.blocks = [];
  }

  start() {
    this.runLoader();
    this.runPlayer();
  }

  runLoader() {
    if (this.blocks.length === 0) {
      this.loadInitial();
    } else {
      let lastBlockAge = new Date().getTime() - this.lastBlockStart();
      if (lastBlockAge > (this.blockDuration + this.delay) * 1000) {
        this.loadNext();
      } else {
        let player = this;
        Tone.Transport.schedule(function () {
          player.runLoader();
        }, "+1");
      }
    }
  }

  lastBlockStart() {
    return this.blocks[this.blocks.length - 1].key;
  }

  req(body: any, callback: any) {
    let player = this;
    let request = new XMLHttpRequest();

    request.open(
      "POST",
      "/proxy/" + this.server + "/" + this.indexPattern + "/_search",
      true
    );

    request.onload = function () {
      if (this.status >= 200 && this.status < 400) {
        callback(JSON.parse(this.response));
      } else {
        console.error(this.response);
      }
    };

    request.onerror = function () {
      console.error("Connection error to " + player.server);
    };

    request.setRequestHeader("Content-Type", "application/json");
    request.send(JSON.stringify(body));
  }

  loadInitial() {
    console.log("loading initial");
    let player = this;
    this.req(
      {
        size: 0,
        query: {
          bool: {
            filter: [
              {
                range: {
                  "@timestamp": {
                    gte:
                      "now-" +
                      (this.delay + this.initialLoad * this.blockDuration) +
                      "s",
                  },
                },
              },
              { range: { "@timestamp": { lt: "now-" + this.delay + "s" } } },
            ],
          },
        },
        aggs: {
          blocks: {
            date_histogram: {
              field: "@timestamp",
              interval: this.blockDuration + "s",
            },
            aggs: {
              docs: {
                top_hits: { size: 100 },
              },
            },
          },
        },
      },
      (data: any) => {
        let blocks = data.aggregations.blocks.buckets;
        blocks.pop();
        player.blocks = blocks.map((block: any) => {
          return {
            key: block.key,
            events: block.docs.hits.hits.map((doc: any) => {
              return doc._source;
            }),
          };
        });
        Tone.Transport.schedule(function () {
          player.runLoader();
        }, "+1");
      }
    );
  }

  loadNext() {
    console.log("loading next");
    let player = this;
    let nextBlockStart = this.lastBlockStart() + this.blockDuration * 1000;
    this.req(
      {
        size: player.size,
        query: {
          bool: {
            filter: [
              {
                range: {
                  "@timestamp": {
                    gte: new Date(nextBlockStart).toISOString(),
                  },
                },
              },
              {
                range: {
                  "@timestamp": {
                    lt: new Date(
                      nextBlockStart + this.blockDuration * 1000
                    ).toISOString(),
                  },
                },
              },
            ],
          },
        },
      },
      (data: any) => {
        player.blocks.push({
          key: nextBlockStart,
          events: data.hits.hits.map((doc: any) => {
            return doc._source;
          }),
        });
        Tone.Transport.schedule(function () {
          player.runLoader();
        }, "+1");
      }
    );
  }

  runPlayer() {
    let player = this;
    let block = this.blocks.shift();
    if (block) {
      let start = block.key;
      console.log("rendering " + block.events.length + " events");
      block.events.forEach((event: any) => {
        let eventTime = Date.parse(event["@timestamp"]);
        let delay = (eventTime - start) / 1000;
        Tone.Transport.schedule(function (time) {
          player.playCallback(event);
        }, "+" + delay);
      });
      Tone.Transport.schedule(function () {
        player.runPlayer();
      }, "+" + player.blockDuration);
    } else {
      Tone.Transport.schedule(function () {
        player.runPlayer();
      }, "+1");
    }
  }
}

export function hash(str: string) {
  let hash = 5381,
    i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  return hash >>> 0;
}

export function audiolize(
  server: string,
  indexPattern: string,
  callback: (event: any) => void
) {
  let player = new ESPlayer(server, indexPattern, callback);
  player.start();
  return player;
}
