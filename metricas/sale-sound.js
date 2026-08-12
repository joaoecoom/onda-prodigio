(function () {
    var audioContext = null;
    var SOUND_KEY = 'onda-metrics-sale-sound';

    function isEnabled() {
        try {
            return window.localStorage.getItem(SOUND_KEY) !== 'off';
        } catch (error) {
            return true;
        }
    }

    function getContext() {
        if (audioContext) {
            return audioContext;
        }

        var Context = window.AudioContext || window.webkitAudioContext;

        if (!Context) {
            return null;
        }

        audioContext = new Context();
        return audioContext;
    }

    function prime() {
        var context = getContext();

        if (context && context.state === 'suspended') {
            context.resume().catch(function () {
                // Requer interacção do utilizador.
            });
        }
    }

    function playTone(context, frequency, startAt, duration, volume, type) {
        var oscillator = context.createOscillator();
        var gain = context.createGain();

        oscillator.type = type || 'triangle';
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), startAt + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.04);
    }

    function playCoinClink(context, startAt) {
        var bufferSize = Math.floor(context.sampleRate * 0.06);
        var buffer = context.createBuffer(1, bufferSize, context.sampleRate);
        var data = buffer.getChannelData(0);

        for (var i = 0; i < bufferSize; i += 1) {
            var decay = 1 - (i / bufferSize);
            data[i] = (Math.random() * 2 - 1) * decay * decay;
        }

        var source = context.createBufferSource();
        var filter = context.createBiquadFilter();
        var gain = context.createGain();

        source.buffer = buffer;
        filter.type = 'bandpass';
        filter.frequency.value = 2800;
        filter.Q.value = 0.8;
        gain.gain.value = 0.22;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(context.destination);
        source.start(startAt);
        source.stop(startAt + 0.07);
    }

    function playSaleSound() {
        if (!isEnabled()) {
            return;
        }

        var context = getContext();

        if (!context) {
            return;
        }

        if (context.state === 'suspended') {
            context.resume().catch(function () {
                return undefined;
            });
        }

        var now = context.currentTime;

        playCoinClink(context, now);
        playTone(context, 987.77, now + 0.05, 0.16, 0.28, 'triangle');
        playTone(context, 1318.51, now + 0.13, 0.22, 0.24, 'sine');
        playTone(context, 1760, now + 0.2, 0.18, 0.14, 'sine');
    }

    window.MetricsSaleSound = {
        play: playSaleSound,
        prime: prime,
        setEnabled: function (enabled) {
            try {
                window.localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
            } catch (error) {
                // Ignorar.
            }
        },
        isEnabled: isEnabled,
    };
})();
