import { keyToMidi } from "./notes.js";

// Loads one register's sample pack (see docs/SAMPLE_PACK.md) and decodes it.
// Returns { samples: Map(key -> { buffer, loopStart, loopEnd }), minMidi, maxMidi }
// with loop points converted from sample indexes to seconds. Seconds stay
// correct even if the browser resamples the audio to its own rate on decode.
export async function loadBank(ctx, { baseUrl = "samples/low_voice", set = "steady" } = {}) {
  const metaResponse = await fetch(`${baseUrl}/loops.json`);
  if (!metaResponse.ok) throw new Error(`loops.json: HTTP ${metaResponse.status}`);
  const meta = await metaResponse.json();
  const keys = Object.keys(meta.samples);

  const samples = new Map();
  await Promise.all(
    keys.map(async (key) => {
      const response = await fetch(`${baseUrl}/${set}/${key}.wav`);
      if (!response.ok) throw new Error(`${key}.wav: HTTP ${response.status}`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      const loop = meta.samples[key][set];
      samples.set(key, {
        buffer,
        loopStart: loop.loop_start_sample / meta.sample_rate,
        loopEnd: loop.loop_end_sample / meta.sample_rate,
      });
    })
  );

  const midis = keys.map(keyToMidi);
  return { samples, minMidi: Math.min(...midis), maxMidi: Math.max(...midis) };
}
