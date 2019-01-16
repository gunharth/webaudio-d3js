// GLOBALS
// let $ = document.querySelector.bind(document);
// audio variables
const AudioContext = window.AudioContext || window.webkitAudioContext;
let ctx;
let globalAudioBuffer = null;
let audioURL;
// ui variables
let visibilityCheckbox = $('#visibilityCheckbox');
let svgParent = $('#svg-parent');

// let audioIsPlaying = false;

// Clean the UI and remove all audio tags
function removeAllAudioTags() {
    let element = document.getElementsByTagName('audio'), index;
    for (index = element.length - 1; index >= 0; index--) {
        element[index].parentNode.removeChild(element[index]);
    }
}


function appendAudioTag(id, audioURL) {
    let audio = document.createElement('audio');
    audio.controls = true;
    audio.src = audioURL;
    $('#' + id).append(audio);
    audio.onplaying = function () {
        if (svgParent.is(':visible')) {
            visualize(audio);
        }
    };
    audio.play();
}


visibilityCheckbox.change(function () {
    if ($(this).is(':checked')) {
        svgParent.slideDown();
    } else {
        svgParent.slideUp();
    }
});

async function importAudio(id, file) {
    removeAllAudioTags(); // cleanup Interface and remove all Tags

    let arrayBuffer = await (await fetch(file)).arrayBuffer();
    audioURL = URL.createObjectURL(new Blob([arrayBuffer]));
    appendAudioTag('recording-' + id, audioURL);

    ctx = ctx || new AudioContext();
    globalAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
    // let source = ctx.createBufferSource();
    // source.buffer = globalAudioBuffer;
    // var analyser = ctx.createAnalyser();

    // // Bind our analyser to the media element source.
    // source.connect(analyser);
    // source.connect(ctx.destination);
}

let maxFileSizeMegabytes = 100;
function loadAudioFile(file) {

    removeAllAudioTags();

    if (file.size > maxFileSizeMegabytes * 1000 * 1000) {
        alert('Sorry, that file is too big. Your audio file needs to be under ' + maxFileSizeMegabytes + ' megabytes.');
        return;
    }

    let reader = new FileReader();
    reader.onloadend = async function () {
        let arrayBuffer = this.result;
        try {

            audioURL = URL.createObjectURL(await new Blob([arrayBuffer]));
            appendAudioTag('recording-upload', audioURL);

            ctx = ctx || new AudioContext();
            globalAudioBuffer = await ctx.decodeAudioData(arrayBuffer);

        } catch (e) {
            alert('Sorry, this is not an audio file');
        }
    },
    reader.onerror = function (e) {
        alert('There was an error reading that file: ' + JSON.stringify(e));
    };

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
    var micButtonCssText = $('#microphone-button').style.cssText;
    $('#microphone-button').style.cssText = 'background:#e71010; color:white;';
    $('#microphone-button .start').style.cssText = 'display:none;';
    $('#microphone-button .mic-enable').style.cssText = 'display:initial;';

    let chunks = [];
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    let mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

    mediaRecorder.start();
    let timerInterval;

    mediaRecorder.ondataavailable = function (e) { chunks.push(e.data); };
    mediaRecorder.onstart = function () {
        console.log('Started, state = ', mediaRecorder.state);

        $('#microphone-button .mic-enable').style.cssText = 'display:none;';
        $('#microphone-button .stop').style.cssText = 'display:initial;';

        var seconds = 0;
        $('#microphone-button .time').innerText = seconds;
        timerInterval = setInterval(() => { seconds++; $('#microphone-button .time').innerText = seconds; }, 1000);


        let stopFn = function () {
            mediaRecorder.stop();
            $('#microphone-button').removeEventListener('click', stopFn);
            clearTimeout(maxLengthTimeout);
        };
        $('#microphone-button').addEventListener('click', stopFn);
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
            ctx = ctx || new AudioContext();
            globalAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            alert('Sorry, your browser');
        }

        // Change, button, end timer:
        $('#microphone-button').style.cssText = micButtonCssText;
        $('#microphone-button .start').style.cssText = 'display:initial;';
        $('#microphone-button .stop').style.cssText = 'display:none;';
        clearInterval(timerInterval);

        currentlyRecording = false;

    };


}

async function loadTransform(e, transformName, ...transformArgs) {

    if (currentlyRecording) {
        alert('You\'re currently recording');
        return;
    }

    let outputAudioBuffer = await window[transformName + 'Transform'](globalAudioBuffer, ...transformArgs);

    let outputWavBlob = await audioBufferToWaveBlob(outputAudioBuffer);
    audioURL = URL.createObjectURL(outputWavBlob);
    if (!document.getElementById(transformName).hasChildNodes()) {
        appendAudioTag(transformName, audioURL);
    }

}

// Visualisation
var frequencyData;
var waveformData;
var svgHeight = 511;
var svgParentWidth = svgParent.width();
var svgPathHeight = Math.floor(svgHeight / 2);
var barPadding = 1;
var analyser;

let svg = d3.select('#svg')
    .attr('width', svgParentWidth)
    .attr('height', svgHeight);

svg.append('line')
    .attr('x1', 0)
    .attr('y1', svgPathHeight+1)
    .attr('x2', svgParentWidth)
    .attr('y2', svgPathHeight+1)
    .attr('stroke-width', '1')
    .attr('stroke', '#000');

let frequencyGroup = d3.select('.frequency');
let waveformGroup = d3.select('.waveform');

frequencyGroup
    .attr('width', svgParentWidth)
    .attr('height', svgPathHeight);

waveformGroup
    .attr('width', svgParentWidth)
    .attr('height', svgPathHeight)
    .attr('transform', 'translate(0, ' + svgPathHeight + ')');

var xScale = d3.scaleLinear()
    .range([0, svgParentWidth])
    .domain([0, svgParentWidth]);

var yScale = d3.scaleLinear()
    .range([255, 0])
    .domain([-1, 1]);

var line = d3.line()
    .x(function (d, i) { return xScale(i); })
    .y(function (d, i) { return yScale(d); });


function visualize(audioElement) {

    // bind the audioElement to the AudioContext
    let audioSrc = ctx.createMediaElementSource(audioElement);
    analyser = ctx.createAnalyser();

    frequencyData = new Uint8Array(analyser.frequencyBinCount/4);
    waveformData = new Float32Array(analyser.fftSize);

    // Bind our analyser to the media element source.
    audioSrc.connect(analyser);
    audioSrc.connect(ctx.destination);

    frequencyGroup.selectAll('rect')
        .data(frequencyData)
        .enter()
        .append('rect')
        .attr('x', function (d, i) {
            return i * (svgParentWidth / frequencyData.length);
        })
        .attr('width', svgParentWidth / frequencyData.length - barPadding);

    // Run the loop
    renderChart();
}

// Continuously loop and update chart with frequency data.
function renderChart() {
    requestAnimationFrame(renderChart);
    // Copy frequency data to frequencyData array.
    analyser.getByteFrequencyData(frequencyData);
    analyser.getFloatTimeDomainData(waveformData);
    // console.log(waveformData);
    // console.log(frequencyData)

    // Update d3 chart with new data.
    frequencyGroup.selectAll('rect')
        .data(frequencyData)
        .attr('y', function (d) {
            return svgPathHeight - d;
        })
        .attr('height', function (d) {
            return d;
        })
        .attr('fill', function (d) {
            return 'rgb(' + d + ', 40, 50)';
        });

    waveformGroup.select('path')
        .datum(waveformData)
        .attr('d', line);
}
