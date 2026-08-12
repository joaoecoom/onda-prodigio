(function () {
    var SOUND_URL = '/metricas/sounds/sonido-shopify.mp3';
    var SOUND_KEY = 'onda-metrics-sale-sound';
    var saleAudio = null;

    function isEnabled() {
        try {
            return window.localStorage.getItem(SOUND_KEY) !== 'off';
        } catch (error) {
            return true;
        }
    }

    function getSaleAudio() {
        if (!saleAudio) {
            saleAudio = new Audio(SOUND_URL);
            saleAudio.preload = 'auto';
        }

        return saleAudio;
    }

    function prime() {
        var audio = getSaleAudio();

        audio.load();

        if (audio.paused) {
            audio.play().then(function () {
                audio.pause();
                audio.currentTime = 0;
            }).catch(function () {
                // Requer interacção do utilizador.
            });
        }
    }

    function playSaleSound() {
        if (!isEnabled()) {
            return;
        }

        var audio = getSaleAudio();

        audio.currentTime = 0;
        audio.play().catch(function () {
            // Autoplay bloqueado até haver interacção.
        });
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
