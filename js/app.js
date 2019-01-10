// GLOBALS
let $ = document.querySelector.bind(document);
AudioContext = window.AudioContext || window.webkitAudioContext;
let ctx;
let globalAudioBuffer = null;
let audioURL;

function removeAllAudioTags() {
    let element = document.getElementsByTagName('audio'), index;
    for (index = element.length - 1; index >= 0; index--) {
        element[index].parentNode.removeChild(element[index]);
    }
}

let vis = document.getElementById('vis');

function appendAudioTag(id, audioURL) {
    let audio = document.createElement('audio');
    audio.controls = true;
    audio.src = audioURL;
    $('#' + id).appendChild(audio);
    audio.onplaying = function () {
        if(vis.checked) {
            visualize(audio);
        }
    };
    audio.play();
}

vis.onchange = function () {
    if (vis.checked) {
        document.getElementById('freq').style.display = 'block';
        svgWidth = document.getElementById('freq').offsetWidth;
        svg = createSvg('#freq', svgHeight, svgWidth);
    } else {
        document.getElementById('freq').style.display = 'none';
        document.getElementById('freq').children[0].remove();
    }
};

async function importAudio(id, file) {
    removeAllAudioTags();

    let arrayBuffer = await (await fetch(file)).arrayBuffer();
    audioURL = URL.createObjectURL(new Blob([arrayBuffer]));
    appendAudioTag('recording-' + id, audioURL);

    if (typeof ctx === 'undefined') { ctx = new AudioContext() };
    globalAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
    let source = ctx.createBufferSource();
    source.buffer = globalAudioBuffer;
    var analyser = ctx.createAnalyser();

    // Bind our analyser to the media element source.
    source.connect(analyser);
    source.connect(ctx.destination);
}

let maxFileSizeMegabytes = 100;
function loadAudioFile(file) {

    removeAllAudioTags();

    if (file.size > maxFileSizeMegabytes * 1000 * 1000) {
        alert("Sorry, that file is too big. Your audio file needs to be under " + maxFileSizeMegabytes + " megabytes.");
        return;
    }

    let reader = new FileReader();
    reader.onloadend = async function () {
        let arrayBuffer = this.result;
        try {

            audioURL = URL.createObjectURL(await new Blob([arrayBuffer]));
            appendAudioTag('recording-upload', audioURL);

            if (typeof ctx === 'undefined') { ctx = new AudioContext() };
            globalAudioBuffer = await ctx.decodeAudioData(arrayBuffer);

        } catch (e) {
            alert("Sorry, either that's not an audio file, or it's not an audio format that's supported by your browser. Most modern browsers support: wav, mp3, mp4, ogg, webm, flac. You should use Chrome or Firefox if you want the best audio support, and ensure you're using the *latest version* of your browser of choice. Chrome and Firefox update automatically, but you may need to completely close down the browser and potentially restart your device to 'force' it to update itself to the latest version.");
        }
    }
    reader.onerror = function (e) {
        alert("There was an error reading that file: " + JSON.stringify(e));
    }

    reader.readAsArrayBuffer(file);

}

// Microphone
let currentlyRecording = false;
let maxRecordingSeconds = 5 * 60;
async function recordFromMicrophone() {
    removeAllAudioTags();
    if (currentlyRecording) {
        return;
    }
    currentlyRecording = true;

    // Change, button, start timer:
    var micButtonCssText = $("#microphone-button").style.cssText;
    $("#microphone-button").style.cssText = "background:#e71010; color:white;";
    $("#microphone-button .start").style.cssText = "display:none;"
    $("#microphone-button .mic-enable").style.cssText = "display:initial;"

    let chunks = [];
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    let mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });

    mediaRecorder.start();
    let timerInterval;

    mediaRecorder.ondataavailable = function (e) { chunks.push(e.data); };
    mediaRecorder.onstart = function () {
        console.log('Started, state = ', mediaRecorder.state);

        $("#microphone-button .mic-enable").style.cssText = "display:none;";
        $("#microphone-button .stop").style.cssText = "display:initial;";

        var seconds = 0;
        $("#microphone-button .time").innerText = seconds;
        timerInterval = setInterval(() => { seconds++; $("#microphone-button .time").innerText = seconds; }, 1000);


        let stopFn = function () {
            mediaRecorder.stop();
            $("#microphone-button").removeEventListener("click", stopFn);
            clearTimeout(maxLengthTimeout);
        };
        $("#microphone-button").addEventListener("click", stopFn)
        let maxLengthTimeout = setTimeout(stopFn, maxRecordingSeconds * 1000);

    };

    mediaRecorder.onerror = function (e) { console.log('Error: ', e); };
    mediaRecorder.onwarning = function (e) { console.log('Warning: ', e); };

    mediaRecorder.onstop = async function () {
        console.log('Stopped, state = ' + mediaRecorder.state);

        let blob = new Blob(chunks, { type: mediaRecorder.mimeType });//+'; codecs=opus' });//
        audioURL = URL.createObjectURL(blob);

        appendAudioTag('recording-mic', audioURL);

        let arrayBuffer = await (await fetch(audioURL)).arrayBuffer();

        try {
            if (typeof ctx === 'undefined') { ctx = new AudioContext() };
            globalAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
            // $("#audio-load-success").style.display = "flex";
        } catch (e) {
            alert("Sorry, your browser doesn't support a crucial feature needed to allow you to record using your device's microphone. You should use Chrome or Firefox if you want the best audio support, and ensure you're using the *latest version* of your browser of choice. Chrome and Firefox update automatically, but you may need to completely close down the browser and potentially restart your device to 'force' it to update itself to the latest version.");
        }

        // Change, button, end timer:
        $("#microphone-button").style.cssText = micButtonCssText;
        $("#microphone-button .start").style.cssText = "display:initial;";
        $("#microphone-button .stop").style.cssText = "display:none;";
        clearInterval(timerInterval);

        currentlyRecording = false;

    }


}

async function loadTransform(e, transformName, ...transformArgs) {

    if (currentlyRecording) {
        alert("You're currently recording a clip using your microphone. Please click the red \"stop recording\" button at the top of the page to finalize the recording, then you can click one of the voice transformers to get your transformed audio file.");
        return;
    }

    let outputAudioBuffer = await window[transformName + "Transform"](globalAudioBuffer, ...transformArgs);

    let outputWavBlob = await audioBufferToWaveBlob(outputAudioBuffer);
    audioURL = URL.createObjectURL(outputWavBlob);
    if (!document.getElementById(transformName).hasChildNodes()) {
        appendAudioTag(transformName, audioURL);
    }

}

var frequencyData;
var svgHeight = 255;
var svgWidth = 300;
var barPadding = 1;
var analyser;
var svg;
var audioSrc;

function visualize(audioElement) {

    audioSrc = ctx.createMediaElementSource(audioElement);
    analyser = ctx.createAnalyser();

    frequencyData = new Uint8Array(analyser.frequencyBinCount/4);

    // Bind our analyser to the media element source.
    audioSrc.connect(analyser);
    audioSrc.connect(ctx.destination);

    svg.selectAll('rect')
        .data(frequencyData)
        .enter()
        .append('rect')
        .attr('x', function (d, i) {
            return i * (svgWidth / frequencyData.length);
        })
        .attr('width', svgWidth / frequencyData.length - barPadding);

    // Run the loop
    renderChart();
}


function createSvg(parent, height, width) {
    return d3.select(parent)
        .append('svg')
        .attr('height', height)
        .attr('width', width);
}

// Continuously loop and update chart with frequency data.
var request;
function renderChart() {
    request = requestAnimationFrame(renderChart);
    // Copy frequency data to frequencyData array.
    analyser.getByteFrequencyData(frequencyData);
    // console.log(frequencyData)

    // Update d3 chart with new data.
    svg.selectAll('rect')
        .data(frequencyData)
        .attr('y', function (d) {
            return svgHeight - d;
        })
        .attr('height', function (d) {
            return d;
        })
        .attr('fill', function (d) {
            return 'rgb(' + d + ', 40, 50)';
        });
}
