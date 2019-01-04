self.AudioContext = (self.AudioContext || self.webkitAudioContext);
async function churchTransform(audioBuffer) {

  let ctx = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);

  // Source
  let source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  // Reverb
  let convolver = ctx.createConvolver();
  convolver.buffer = await ctx.decodeAudioData(await (await fetch("../church.wav")).arrayBuffer());

  // Create graph
  source.connect(convolver);
  // convolver.connect(ctx.destination);

  // Create a gain node.
  var gainNode = ctx.createGain();
  // Connect the source to the gain node.
  convolver.connect(gainNode);
  // Connect the gain node to the destination.
  gainNode.connect(ctx.destination);

  gainNode.gain.value = 2;

  // Render
  source.start();
  let outputAudioBuffer = await ctx.startRendering();
  return outputAudioBuffer;

}
