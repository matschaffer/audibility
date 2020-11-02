import * as Tone from "tone";
import { hash, audiolize } from "./player";
import * as Nexus from "nexusui";

function ensureTransport(callback: () => void) {
  if (Tone.context.state !== "running") {
    Tone.context.resume().then(() => {
      Tone.Transport.start();
      callback();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const controls = document.getElementById("controls");
  if (controls) {
    let regionElement = controls.querySelector<HTMLInputElement>(
      "input[name=region]"
    );
    let indexPatternElement = controls.querySelector<HTMLInputElement>(
      "input[name=indexPattern]"
    );

    let run = new Nexus.Toggle(controls.querySelector(".run"));

    let pan = new Nexus.Dial(controls.querySelector(".pan"), {
      min: -1,
      max: 1,
      value: 0,
    });

    let offsetDial = new Nexus.Dial(controls.querySelector(".offset .dial"), {
      min: -3,
      max: 3,
      value: 0,
    });
    let offsetNumber = new Nexus.Number(
      controls.querySelector(".offset .number")
    );
    offsetNumber.link(offsetDial);

    let notes = new Nexus.Sequencer(controls.querySelector(".notes"), {
      rows: 3,
      columns: 12,
    });
    notes.matrix.set.cell(0, 1, 1);
    notes.matrix.set.cell(2, 1, 1);
    notes.matrix.set.cell(4, 1, 1);

    run.on("change", (state: boolean) => {
      if (state) {
        ensureTransport(() => {
          let panner = new Tone.Panner(0).toDestination();
          pan.on("change", (v: number) => {
            panner.pan.setValueAtTime(v, "+0");
          });
          let synth = new Tone.Synth().connect(panner);

          let region = regionElement ? regionElement.value : "";
          let indexPattern = indexPatternElement
            ? indexPatternElement.value
            : "";

          audiolize(region, indexPattern, (event) => {
            let scale: number[] = [];
            notes.matrix.pattern.forEach((row: boolean[], rowIndex: number) => {
              row.forEach((state: boolean, columnIndex: number) => {
                if (state) {
                  scale.push(
                    60 +
                      (rowIndex - 1) * 12 +
                      columnIndex +
                      offsetDial.value * 12
                  );
                }
              });
            });

            try {
              let note = scale[hash(event.logger) % scale.length];
              let frequency = Tone.Frequency(note, "midi").toFrequency();
              synth.triggerAttackRelease(frequency, "16n");
            } catch (e) {
              console.log(`Couldn't play event: ${event}`);
            }
          });
        });
      }
    });
  }
});
