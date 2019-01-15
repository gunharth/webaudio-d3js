# Web Audio API and SVG using d3.js

## Audio Sources
### 1. <audio> Tag
Feeds an existing audio element into the AudioContext.
```
let audioElement = document.querySelector('audio');
var audioCtx = new AudioContext();
var source = audioCtx.createMediaElementSource(audioElement);
source.connect(audioCtx.destination);
```
### 2. Load audio with AJAX
The following creates a JavaScript promise fetching an audio file from a URL into an arrayBuffer. From this arrayBuffer we can either create a new Blob to integrate the audio into an audio Element on the site or decode the audio for passing it on as the source to the audioContext.
```
async function loadAudioWithAjax() {
    let arrayBuffer = await (await fetch('audio.ogg')).arrayBuffer();

    audioURL = URL.createObjectURL(new Blob([arrayBuffer]));

    var audioCtx = new AudioContext();
    let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    let source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
}
```
### 3. Record with microphone

```
async function recordFromMicrophone() {

    let chunks = [];
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    let mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

    mediaRecorder.start();

    mediaRecorder.ondataavailable = function (e) { chunks.push(e.data); };

    mediaRecorder.onstop = async function () {

        let blob = new Blob(chunks, { type: mediaRecorder.mimeType });//+'; codecs=opus' });//
        audioURL = URL.createObjectURL(blob);

        let arrayBuffer = await (await fetch(audioURL)).arrayBuffer();
        ...
    }
}
```

### 4. Upload audio

```
function loadAudioFile(file) {

    let reader = new FileReader();
    reader.onloadend = async function () {
        let arrayBuffer = this.result;
        ...
    }

    reader.readAsArrayBuffer(file);

}
```

## Audio Transformations
```
let ctx = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);

let source = ctx.createBufferSource();
source.buffer = audioBuffer;

// some effect

// source.connect(effect)

effect.connect(ctx.destination);

// Render
source.start();
let outputAudioBuffer = await ctx.startRendering();
return outputAudioBuffer;
```
### 1. Reverb
```
let convolver = ctx.createConvolver();
convolver.buffer = await ctx.decodeAudioData(await (await fetch("./audio/church.wav")).arrayBuffer());

source.connect(convolver);
convolver.connect(ctx.destination);
```
### 2. Wah
WaveShaper
BiquadFilter
Gain
DynamicsCompressor

### 3. Slow
loops through inputChannels, delays the source and creates new outputChannels

### 4. Pitch
uses Google Jungle library

### 5. Scary
Oscillators
BiquadFilters
Gains
DynamicsCompressors

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
