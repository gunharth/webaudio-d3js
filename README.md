# Web Audio API and SVG using d3.js

## Audio Sources
### <audio> Tag
Feeds an existing audio element into the AudioContext.
```
let audioElement = document.querySelector('audio');
var audioCtx = new AudioContext();
var source = audioCtx.createMediaElementSource(audioElement);
```

## Audio Research & Demos
### Recording Audio with JS solutions
recorder.js, vmsg and opus-recorder

### Native recording with HTML5 Media Recorder API
w3c Editor's draft: https://w3c.github.io/mediacapture-record/  

Chrome and Opera will record mono channel Opus (default) and pcm (wav, uncompressed) audio at 48kHz in .webm (Matroska) containers.  

Firefox will record mono Opus audio at 48kHz in .ogg containers (.webm is supported starting with Firefox 63). Firefox used Vorbis for audio recording in the 1st implementations but it moved to Opus since.  

No requirements to make extra HTTP request nor load external libraries

Demo: todo

Data stream saved as a Blob in browser cache. Chrome uses webm and opus audio codec.
