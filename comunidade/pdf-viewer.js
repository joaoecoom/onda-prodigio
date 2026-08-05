(function () {
    var pdfJsPromise = null;
    var activeRenderToken = 0;

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-pdfjs="true"]');

            if (existing) {
                if (window.pdfjsLib) {
                    resolve(window.pdfjsLib);
                    return;
                }

                existing.addEventListener('load', function () {
                    resolve(window.pdfjsLib);
                });
                existing.addEventListener('error', reject);
                return;
            }

            var script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.setAttribute('data-pdfjs', 'true');
            script.onload = function () {
                resolve(window.pdfjsLib);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function ensurePdfJs() {
        if (!pdfJsPromise) {
            pdfJsPromise = loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js').then(function (pdfjsLib) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                return pdfjsLib;
            });
        }

        return pdfJsPromise;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getContainerWidth(pagesHost) {
        var width = pagesHost.clientWidth;

        if (width > 0) {
            return width;
        }

        return Math.min(window.innerWidth - 32, 720);
    }

    async function renderPage(pdfjsLib, pdf, pageNum, pagesHost, containerWidth) {
        var page = await pdf.getPage(pageNum);
        var outputScale = window.devicePixelRatio || 1;
        var baseViewport = page.getViewport({ scale: 1 });
        var scale = containerWidth / baseViewport.width;
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');

        canvas.className = 'comunidade-pdf-page';
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        await page.render({
            canvasContext: context,
            viewport: viewport,
        }).promise;

        pagesHost.appendChild(canvas);
    }

    function renderFallback(host, url, title) {
        host.innerHTML = (
            '<div class="comunidade-pdf-viewer__fallback">' +
                '<p>Não foi possível mostrar o PDF aqui. Podes abri-lo no teu dispositivo:</p>' +
                '<div class="comunidade-pdf-viewer__actions">' +
                    '<a class="comunidade-btn comunidade-btn--primary" href="' + url + '" target="_blank" rel="noopener">Abrir PDF</a>' +
                    '<a class="comunidade-btn comunidade-btn--ghost" href="' + url + '" download="' + escapeHtml(title) + '.pdf">Descarregar</a>' +
                '</div>' +
            '</div>'
        );
    }

    async function render(host, url, title) {
        if (!host) {
            return;
        }

        var renderToken = ++activeRenderToken;

        host.innerHTML = (
            '<div class="comunidade-pdf-viewer">' +
                '<div class="comunidade-pdf-viewer__toolbar">' +
                    '<span class="comunidade-pdf-viewer__hint">Desliza para ler todas as páginas</span>' +
                    '<div class="comunidade-pdf-viewer__actions">' +
                        '<a class="comunidade-btn comunidade-btn--ghost" href="' + url + '" target="_blank" rel="noopener">Abrir</a>' +
                        '<a class="comunidade-btn comunidade-btn--ghost" href="' + url + '" download="' + escapeHtml(title || 'material') + '.pdf">Descarregar</a>' +
                    '</div>' +
                '</div>' +
                '<div class="comunidade-pdf-viewer__status">A carregar PDF…</div>' +
                '<div class="comunidade-pdf-viewer__pages"></div>' +
            '</div>'
        );

        var statusEl = host.querySelector('.comunidade-pdf-viewer__status');
        var pagesHost = host.querySelector('.comunidade-pdf-viewer__pages');

        try {
            var pdfjsLib = await ensurePdfJs();

            if (renderToken !== activeRenderToken) {
                return;
            }

            var pdf = await pdfjsLib.getDocument(url).promise;

            if (renderToken !== activeRenderToken) {
                return;
            }

            statusEl.textContent = pdf.numPages + ' página(s)';
            pagesHost.innerHTML = '';

            var pageNum;
            var containerWidth = getContainerWidth(pagesHost);

            for (pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
                if (renderToken !== activeRenderToken) {
                    return;
                }

                await renderPage(pdfjsLib, pdf, pageNum, pagesHost, containerWidth);
            }

            if (renderToken === activeRenderToken) {
                statusEl.hidden = true;
            }
        } catch (error) {
            console.error('Erro ao renderizar PDF:', error);

            if (renderToken === activeRenderToken) {
                renderFallback(host, url, title);
            }
        }
    }

    window.ComunidadePdfViewer = {
        render: render,
    };
})();
