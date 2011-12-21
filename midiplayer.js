(function() {
  var TAU = Math.PI * 2;
  var SAMPLES_PER_CYCLE = 4096;

  var mouseOn = false;
  var context;

  function main() {
    setStatus("starting");

    // keep track of whether a mouse button is down

    document.body.onmousedown = function(e) {
      if (event.which == 1) {
        mouseOn = true;
      }
    };

    document.body.onmouseup = function(e) {
      mouseOn = false;
    };

    document.body.onmouseout = function(e) {
      if (e.target == document.body) {
        mouseOn = false;
      }
    };

    // create sounds

    context = new webkitAudioContext();

    var sineWave = digitize(1, function(phase) {
      return Math.sin(phase * TAU);
    });

    var squareWave = digitize(1, function(phase) {
      return phase < 0.5 ? 1.0 : -1.0;
    });

    var sawToothWave = digitize(1, function(phase) {
      return phase * 2 - 1;
    });

    // create keyboard

    var volume = context.createGainNode();
    volume.gain.value = 0.2;
    volume.connect(context.destination);

    var volumeSlider = document.getElementById("volume");
    volumeSlider.value = volume.gain.value * 100;
    volumeSlider.onchange = function(e) {
      volume.gain.value = volumeSlider.value / 100;
    };

    var keyboard = new Keyboard("sounds", "black_keys", "white_keys", volume);

    var organEnvelope = [0.05, 0.0, 1.0, 0.08];
    keyboard.addPatchButton("Sine", organEnvelope, sineWave);
    keyboard.addPatchButton("Square", organEnvelope, squareWave);
    keyboard.addPatchButton("Sawtooth", organEnvelope, sawToothWave);
    keyboard.addPatchButton("Even Harmonics", organEnvelope,
      makeFractionalHarmonicWave(1, [6, 1, 0, 1, 0, 1, 0, 1]));
    keyboard.addPatchButton("Odd Harmonics", organEnvelope,
      makeFractionalHarmonicWave(1, [6, 0, 1, 0, 1, 0, 1, 0, 1]));
    keyboard.addPatchButton("Octave Harmonics", organEnvelope,
      makeFractionalHarmonicWave(1, [6, 1, 0, 1, 0, 0, 0, 1]));
    keyboard.addPatchButton("Fractional Harmonics", organEnvelope,
      makeFractionalHarmonicWave(3, [0, 0, 6, 1, 1, 1, 1]));
    keyboard.addPatchButton("Fractional Harmonics 2", organEnvelope,
      makeFractionalHarmonicWave(3, [0, 0, 6, 0, 2, 0, 2]));

    var malletEnvelope = [0.01, 1.0, 0.0, 1.0];
    keyboard.addPatchButton("Xylophone", malletEnvelope, sineWave);

    var pianoEnvelope = [0.01, 1.0, 0.2, 0.1];
    keyboard.addPatchButton("Electric Piano",
      pianoEnvelope, makeFractionalHarmonicWave(3,
        [0, 0, 8, 7, 6, 7, 6, 5, 6, 5, 4, 5, 4, 3, 4]));


    var blackOctave = [0, 2, "spacer", 5, 7, 9, "spacer"];
    var blackKeys = ["half_spacer"]
      .concat(transpose(29, blackOctave))
      .concat(transpose(41, blackOctave));
    keyboard.addBlackKeys(blackKeys);
    var majorOctave = [0, 2, 4, 5, 7, 9, 11];
    keyboard.addWhiteKeys(
      transpose(28, majorOctave.concat(transpose(12, majorOctave)).concat([24]))
    );

    setStatus("");
  }

  function transpose(delta, pitches) {
    var result = [];
    for (var i = 0; i < pitches.length; i++) {
      var p = pitches[i];
      result.push(typeof(p) == "number" ? p + delta : p);
    }
    return result;
  }

  function Keyboard(soundsId, blackKeysId, whiteKeysId, destination) {
    this.soundsId = soundsId;
    this.blackKeysId = blackKeysId;
    this.whiteKeysId = whiteKeysId;
    this.selectedSoundButton = null;
    this.selectedPatch = null;
    this.destination = destination;
  }

  Keyboard.prototype.addPatchButton = function (label, envelope, waveBuffer) {
    var self = this;
    var patch = new Patch(waveBuffer, envelope);
    var onClasses = "sound_on";
    var offClasses = "sound_off";

    var button = document.createElement("button");
    button.setAttribute("class", offClasses);
    button.textContent = label;

    function setPatch() {
      if (self.selectedSoundButton) {
        self.selectedSoundButton.setAttribute("class", offClasses);
      }
      self.selectedPatch = patch;
      self.selectedSoundButton = button;
      button.setAttribute("class", onClasses);
    }

    button.onclick = function (e) {
      setPatch();
    };

    document.getElementById(self.soundsId).appendChild(button);

    if (self.selectedPatch == null) {
      setPatch();
    }

    return patch;
  };

  Keyboard.prototype.addBlackKeys = function (pitches) {
    var self = this;
    var parent = document.getElementById(self.blackKeysId);
    for (var i = 0; i < pitches.length; i++) {
      var pitch = pitches[i];
      if (typeof(pitch) == "number") {
        var button = self.makeKey(pitch, "black_key_on", "black_key_off");
        parent.appendChild(button);
      } else {
        var spacer = document.createElement("span");
        spacer.setAttribute("class", pitch);
        spacer.textContent = " ";
        parent.appendChild(spacer);
      }
    }
  };

  Keyboard.prototype.addWhiteKeys = function (pitches) {
    var self = this;
    var parent = document.getElementById(self.whiteKeysId);
    for (var i = 0; i < pitches.length; i++) {
      var pitch = pitches[i];
      var button = self.makeKey(pitch, "white_key_on", "white_key_off");
      parent.appendChild(button);
    }
  };

  Keyboard.prototype.makeKey = function (pitch, onClasses, offClasses) {
    var self = this;
    var hertz = getHertz(pitch);

    var stopFunction = null;

    function start() {
      if (stopFunction) {
        stopFunction(context.currentTime);
      }
      stopFunction = self.selectedPatch.playNote(hertz, context.currentTime, self.destination);
      button.setAttribute("class", onClasses);
    }

    function stop() {
      if (stopFunction) {
        stopFunction(context.currentTime);
      }
      stopFunction = null;
      button.setAttribute("class", offClasses);
    }

    var button = document.createElement("button");
    button.setAttribute("class", offClasses);

    button.onmousedown = function(e) {
      if (e.which == 1) {
        start();
      }
    };
    button.onmouseover = function(e) {
      if (mouseOn) {
        start();
      }
    };
    button.onmouseout = stop;
    button.onmouseup = stop;

    return button;
  };

  function getHertz(pitch) {
    return 440 * Math.pow(2, (pitch - 49) / 12);
  }

  /* patches */

  function Patch(waveBuffer, adsr) {
    this.waveBuffer = waveBuffer;
    this.attackTime = adsr[0];
    this.decayTime = adsr[1];
    this.sustainLevel = adsr[2];
    this.releaseTime = adsr[3];

    this.ringBuffer = null;
    this.ringHarmonic = null;
  }

  Patch.prototype.setRing = function (waveBuffer, harmonic, volume) {
    this.ringBuffer = waveBuffer;
    this.ringHarmonic = harmonic;
    this.ringVolume = volume;
  };

  Patch.prototype.playNote = function (hertz, startTime, destination) {
    var self = this;

    var tone = makeTone(self.waveBuffer, hertz, startTime);
    var envelope = makeEnvelope(startTime, self.attackTime, self.decayTime, self.sustainLevel);

    var ring = null;
    if (this.ringBuffer) {
      ring = makeTone(this.ringBuffer, hertz * this.ringHarmonic, startTime);
      ring.gain.value = this.ringVolume;
      ring.connect(envelope);
    }
    tone.connect(envelope);
    envelope.connect(destination);

    function stop(stopTime) {
      var doneTime = stopTime + self.releaseTime;
      tone.gain.setTargetValueAtTime(0, stopTime, self.releaseTime);
      tone.noteOff(doneTime + 2.0);
      if (ring) {
        ring.gain.setTargetValueAtTime(0, stopTime, self.releaseTime);
        ring.noteOff(doneTime + 2.0);
      }
    }

    return stop;
  };

  function makeTone(waveBuffer, hertz, startTime) {
    var node = context.createBufferSource();
    node.buffer = waveBuffer;
    node.loop = true;

    var sampleHertz = context.sampleRate / SAMPLES_PER_CYCLE;
    node.playbackRate.value = hertz / sampleHertz;

    node.noteOn(startTime);
    node.noteOff(startTime + 10); // just in case

    return node;
  }

  function makeEnvelope(startTime, attackTime, decayTime, sustainLevel) {
    var node = context.createGainNode();

    node.gain.linearRampToValueAtTime(0.0, startTime);
    node.gain.linearRampToValueAtTime(1.0, startTime + attackTime);
    node.gain.setTargetValueAtTime(sustainLevel, startTime + attackTime, decayTime);

    return node;
  }

  function makeFractionalHarmonicWave(denominator, harmonics) {
    function sum(items) {
      var result = 0.0;
      for (var i = 0; i < items.length; i++) {
        result += items[i];
      }
      return result;
    }
    var total = sum(harmonics);

    function waveFunction(phase) {
      var result = 0;
      for (var i = 0; i < harmonics.length; i++) {
        var harmonic = (1 + i) / denominator;
        result += harmonics[i]/total * Math.sin(phase * TAU * harmonic);
      }
      return result;
    }

    return digitize(denominator, waveFunction);
  }

  function digitize(cycles, waveFunction) {
    var buffer = context.createBuffer(1, cycles * SAMPLES_PER_CYCLE, context.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      var phase = i/SAMPLES_PER_CYCLE;
      phase = phase - Math.floor(phase);
      data[i] = waveFunction(phase);
    }
    return buffer;
  }

  function setStatus(msg) {
    document.getElementById("status").textContent = msg;
  }

  main();
})();