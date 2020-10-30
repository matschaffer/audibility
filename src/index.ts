import * as Tone from "tone";
import { hash, audiolize } from "./player";

// import * as NexusUI from "nexusui";

// var button = new Nexus.Button("#target");

const playButton = document.querySelector("button");

if (playButton) {
  playButton.addEventListener("click", () => {
    if (Tone.context.state !== "running") {
      Tone.context.resume().then(() => {
        Tone.Transport.start();

        let synth = new Tone.Synth().toDestination();

        audiolize("us-east-1", "service-docker-*", (event) => {
          let scaleElement = document.querySelector<HTMLInputElement>("#scale");
          if (scaleElement) {
            let scale = scaleElement.value.split(" ");
            let note = scale[hash(event.docker.container.name) % scale.length];
            try {
              synth.triggerAttackRelease(note, "16n");
            } catch (e) {
              console.log(`Bad note ${note}`);
            }
          }
        });
      });
    }
  });
}
