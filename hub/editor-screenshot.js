(function () {
    'use strict';

    var context = null;
    var selectedFile = null;

    function getRoot() {
        return document.getElementById('peb-screenshot-panel');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderShell() {
        var root = getRoot();
        if (!root) {
            return;
        }

        root.innerHTML =
            '<div class="peb-screenshot">' +
                '<p class="peb-screenshot__hint">Carrega um screenshot de landing page. O sistema gera sections/blocks no schema do Page Engine.</p>' +
                '<label class="peb-screenshot__upload">' +
                    '<input type="file" id="peb-screenshot-input" accept="image/png,image/jpeg,image/webp" hidden>' +
                    '<span class="peb-screenshot__upload-box" id="peb-screenshot-preview">' +
                        '<strong>Escolher screenshot</strong>' +
                        '<span>PNG, JPG ou WebP · máx. 4MB</span>' +
                    '</span>' +
                '</label>' +
                '<button type="button" class="peb-button peb-button--primary" id="peb-screenshot-analyze" disabled>Analisar e aplicar</button>' +
                '<p class="peb-screenshot__status" id="peb-screenshot-status" hidden></p>' +
                '<p class="peb-screenshot__error" id="peb-screenshot-error" hidden></p>' +
            '</div>';
    }

    function setStatus(message, kind) {
        var el = document.getElementById('peb-screenshot-status');
        el.hidden = !message;
        el.className = 'peb-screenshot__status' + (kind ? ' is-' + kind : '');
        el.textContent = message || '';
    }

    function setError(message) {
        var el = document.getElementById('peb-screenshot-error');
        el.hidden = !message;
        el.textContent = message || '';
    }

    function renderPreview(file, dataUrl) {
        var preview = document.getElementById('peb-screenshot-preview');
        preview.innerHTML =
            '<img src="' + dataUrl + '" alt="Screenshot preview">' +
            '<span>' + escapeHtml(file.name) + '</span>';
    }

    function readFileAsBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var result = String(reader.result || '');
                var comma = result.indexOf(',');
                resolve({
                    mime_type: file.type || 'image/png',
                    image_base64: comma >= 0 ? result.slice(comma + 1) : result,
                });
            };
            reader.onerror = function () {
                reject(new Error('Não foi possível ler a imagem.'));
            };
            reader.readAsDataURL(file);
        });
    }

    function bindEvents() {
        var input = document.getElementById('peb-screenshot-input');
        var analyzeBtn = document.getElementById('peb-screenshot-analyze');

        input.addEventListener('change', function () {
            setError('');
            setStatus('');
            selectedFile = input.files && input.files[0] ? input.files[0] : null;
            analyzeBtn.disabled = !selectedFile;

            if (!selectedFile) {
                return;
            }

            if (selectedFile.size > 4 * 1024 * 1024) {
                selectedFile = null;
                analyzeBtn.disabled = true;
                setError('Imagem demasiado grande (máx. 4MB).');
                return;
            }

            var reader = new FileReader();
            reader.onload = function () {
                renderPreview(selectedFile, reader.result);
            };
            reader.readAsDataURL(selectedFile);
        });

        analyzeBtn.addEventListener('click', async function () {
            if (!selectedFile || !context) {
                return;
            }

            setError('');
            setStatus('A analisar screenshot…', 'running');
            analyzeBtn.disabled = true;

            try {
                var encoded = await readFileAsBase64(selectedFile);
                var editorState = context.getState();
                var payload = await context.apiFetch(
                    '/api/sales-attribution?action=hub_page_builder_screenshot&offer=' +
                        encodeURIComponent(editorState.slugs.offer) + '&funnel=' +
                        encodeURIComponent(editorState.slugs.funnel) + '&page=' +
                        encodeURIComponent(editorState.slugs.page),
                    {
                        method: 'POST',
                        body: encoded,
                    }
                );

                context.onApplySections(payload.sections || [], payload);
                setStatus(payload.summary || 'Screenshot aplicado.', payload.source === 'vision' ? 'success' : 'info');
                input.value = '';
                selectedFile = null;
                document.getElementById('peb-screenshot-preview').innerHTML =
                    '<strong>Escolher screenshot</strong><span>PNG, JPG ou WebP · máx. 4MB</span>';
            } catch (error) {
                setError(error.message || 'Análise falhou.');
                setStatus('');
            } finally {
                analyzeBtn.disabled = !selectedFile;
            }
        });
    }

    function init(options) {
        context = options;
        renderShell();
        bindEvents();
    }

    window.PebScreenshot = {
        init: init,
    };
})();
