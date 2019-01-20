// audio variables
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx; // created audio context
let audioSource = null; // holds all audio buffers from audio sources
let audioURL = ''; // audio url
// ui variables
let svgParent = $('#svg-parent');
// visualisation
let analyser;
let frequencyData; // frequency from analyser
let waveformData; // waveform from analyser
// svg settings
let svgHeight = 511;
let svgParentWidth = svgParent.width();
let svgPathHeight = Math.floor(svgHeight / 2);
// upload
let maxFileSizeMegabytes = 100;

// Preloading the piano into an audio context on page load throws is prohibited in Chrome
// Thus we work around by using also the ajax load method
// the visualisation section outlines loading existing audio sources from tags

// Guni button: load audio file with ajax
async function importAudio(id, file) {
    removeAllAudioTags(); // cleanup Interface and remove all Tags

    let arrayBuffer = await (await fetch(file)).arrayBuffer();
    audioURL = URL.createObjectURL(new Blob([arrayBuffer]));
    appendAudioTag('recording-' + id, audioURL);

    audioCtx = audioCtx || new AudioContext();
    audioSource = await audioCtx.decodeAudioData(arrayBuffer);
    // let source = audioCtx.createBufferSource();
    // source.buffer = audioSource;
    // var analyser = audioCtx.createAnalyser();

    // // Bind our analyser to the media element source.
    // source.connect(analyser);
    // source.connect(audioCtx.destination);
}

// Record button: record audio with the mic
let currentlyRecording = false;
let maxRecordingSeconds = 5 * 60;
async function recordFromMicrophone() {
    removeAllAudioTags(); // cleanup Interface and remove all Tags
    if (currentlyRecording) {
        return;
    }
    currentlyRecording = true;

    // Change, button, start timer:
    let microphoneButton = $('#microphone-button');

    microphoneButton.find('.start').hide();
    microphoneButton.find('.mic-enable').show();

    let chunks = [];
    let stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    let mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

    mediaRecorder.start();
    let timerInterval;

    mediaRecorder.ondataavailable = function (e) { chunks.push(e.data); };
    mediaRecorder.onstart = function () {

        microphoneButton.find('.mic-enable').hide();
        microphoneButton.find('.stop').show();

        let seconds = 0;
        microphoneButton.find('.time').text(seconds);
        timerInterval = setInterval(() => { seconds++; microphoneButton.find('.time').text(seconds); }, 1000);

        let stopFn = function () {
            mediaRecorder.stop();
            microphoneButton.off('click', stopFn);
            clearTimeout(maxLengthTimeout);
        };
        microphoneButton.on('click', stopFn);
        let maxLengthTimeout = setTimeout(stopFn, maxRecordingSeconds * 1000);
    };

    mediaRecorder.onerror = function (e) { console.log('Error: ', e); };
    mediaRecorder.onwarning = function (e) { console.log('Warning: ', e); };

    mediaRecorder.onstop = async function () {

        let blob = new Blob(chunks, { type: mediaRecorder.mimeType });//+'; codecs=opus' });//
        audioURL = URL.createObjectURL(blob);

        appendAudioTag('recording-mic', audioURL);

        let arrayBuffer = await (await fetch(audioURL)).arrayBuffer();

        try {
            audioCtx = audioCtx || new AudioContext();
            audioSource = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            alert('Sorry, your browser');
        }

        // Change, button, end timer:
        microphoneButton.find('.start').css('display', 'initial');
        microphoneButton.find('.stop').hide();
        clearInterval(timerInterval);
        currentlyRecording = false;
    };
}

//Upload button: upload audio from the browser
function loadAudioFile(file) {
    removeAllAudioTags(); // cleanup Interface and remove all Tags

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

            audioCtx = audioCtx || new AudioContext();
            audioSource = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            alert('Sorry, this is not an audio file');
        }
    },
    reader.onerror = function (e) {
        alert('There was an error reading that file: ' + JSON.stringify(e));
    };

    reader.readAsArrayBuffer(file);
}

// load the audio transformations
async function loadTransform(e, transformName, ...transformArgs) {

    if (currentlyRecording) {
        alert('You\'re currently recording');
        return;
    }

    let outputAudioBuffer = await window[transformName + 'Transform'](audioSource, ...transformArgs);

    let outputWavBlob = await audioBufferToWaveBlob(outputAudioBuffer);
    audioURL = URL.createObjectURL(outputWavBlob);
    if (!document.getElementById(transformName).hasChildNodes()) {
        appendAudioTag(transformName, audioURL);
    }
}

// d3js
let svg = d3.select('#svg')
    .attr('width', svgParentWidth)
    .attr('height', svgHeight);

svg.append('line')
    .attr('x1', 0)
    .attr('y1', svgPathHeight + 1)
    .attr('x2', svgParentWidth)
    .attr('y2', svgPathHeight + 1)
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

let waveXScale = d3.scaleLinear()
    .range([0, svgParentWidth])
    .domain([0, svgParentWidth]);

let waveYScale = d3.scaleLinear()
    .range([255, 0])
    .domain([-1, 1]);

let waveLine = d3.line()
    .x(function (d, i) { return waveXScale(i); })
    .y(function (d, i) { return waveYScale(d); });


function visualize(audioElement) {

    // bind the audioElement to the AudioContext
    let audioSrc = audioCtx.createMediaElementSource(audioElement);
    analyser = audioCtx.createAnalyser();
    // analyser.fftSize = 256;

    frequencyData = new Uint8Array(analyser.frequencyBinCount / 4);
    waveformData = new Float32Array(analyser.fftSize);

    // Bind our analyser to the media element source.
    audioSrc.connect(analyser);
    audioSrc.connect(audioCtx.destination);

    frequencyGroup.selectAll('rect')
        .data(frequencyData)
        .enter()
        .append('rect')
        .attr('x', function (d, i) {
            return i * (svgParentWidth / frequencyData.length);
        })
        .attr('width', svgParentWidth / frequencyData.length - 1); // 1 is bar spacing

    // Run the loop
    renderChart();
}

// Continuously loop and update chart with frequency data.
function renderChart() {
    requestAnimationFrame(renderChart);

    analyser.getByteFrequencyData(frequencyData);
    analyser.getFloatTimeDomainData(waveformData);
    console.log(waveformData);

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
        .attr('d', waveLine);
}

// Interface functions
// Show Transformation buttons
$('.grid-container').on('click', 'h2', function () {
    $('.grid-container').find('button').fadeToggle();
});

// Show Visualisation area
$('.col-header-5').on('click', 'h2', function () {
    svgParent.slideToggle();
});

// Clean the UI and remove all audio tags
function removeAllAudioTags() {
    $('audio').remove();
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
