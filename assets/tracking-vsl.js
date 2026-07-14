(function () {
    if (document.documentElement.getAttribute('data-page-type') !== 'vsl') {
        return;
    }

    var milestones = {
        25: 'vsl_progress_25',
        50: 'vsl_progress_50',
        75: 'vsl_progress_75',
        100: 'vsl_completed',
    };

    var fired = {
        started: false,
        25: false,
        50: false,
        75: false,
        100: false,
    };

    function track(eventName) {
        if (window.OndaTracking && typeof window.OndaTracking.trackVslEvent === 'function') {
            window.OndaTracking.trackVslEvent(eventName);
        }
    }

    function getPlayer() {
        return document.querySelector('vturb-smartplayer');
    }

    function getVideoState() {
        if (window.smartplayer && window.smartplayer.instances && window.smartplayer.instances.length) {
            var instance = window.smartplayer.instances[0];
            var video = instance.video;

            if (video) {
                return {
                    currentTime: video.currentTime || 0,
                    duration: video.duration || 0,
                    paused: video.paused,
                };
            }
        }

        var host = getPlayer();

        if (!host) {
            return {
                currentTime: 0,
                duration: 0,
                paused: true,
            };
        }

        return {
            currentTime: host.currentTime || 0,
            duration: host.duration || 0,
            paused: host.paused,
        };
    }

    function markStarted() {
        if (fired.started) {
            return;
        }

        fired.started = true;
        track('vsl_started');
    }

    function checkMilestones() {
        var state = getVideoState();
        var duration = state.duration;
        var currentTime = state.currentTime;

        if (!duration || duration <= 0) {
            return;
        }

        var progress = (currentTime / duration) * 100;

        [25, 50, 75, 100].forEach(function (threshold) {
            if (fired[threshold] || progress < threshold) {
                return;
            }

            fired[threshold] = true;
            track(milestones[threshold]);
        });
    }

    function bindPlayer(player) {
        if (!player || player.dataset.vslTrackingBound) {
            return;
        }

        player.dataset.vslTrackingBound = 'true';

        player.addEventListener('video:play', markStarted);
        player.addEventListener('video:playing', markStarted);
        player.addEventListener('video:timeupdate', checkMilestones);
        player.addEventListener('video:ended', function () {
            if (!fired[100]) {
                fired[100] = true;
                track('vsl_completed');
            }
        });
    }

    function init() {
        var player = getPlayer();

        if (player) {
            bindPlayer(player);
        }

        document.addEventListener('player:ready', function () {
            bindPlayer(getPlayer());
        });

        setInterval(function () {
            if (!fired.started) {
                var state = getVideoState();

                if (!state.paused && state.currentTime > 0) {
                    markStarted();
                }
            }

            checkMilestones();
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
