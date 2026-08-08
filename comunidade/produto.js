(function () {
    var params = new URLSearchParams(window.location.search);
    var productId = params.get('id') || '';
    var moduleParam = params.get('module') || '';
    var aulaParam = params.get('aula') || '';

    var THUMB_LABELS = [
        'Começa aqui',
        'Método Onda Prodígio',
        'Protocolo do Sono',
        'Ofertas',
        'Método Concluído',
    ];

    var AULA_THUMB_LABELS = [
        'Boas-vindas',
        'Questionário',
        'Instruções',
    ];

    var SONO_AULA_SHORT_LABELS = [
        'Coala',
        'Tobias',
        'Capivara',
        'Eco',
        'Luz',
        'Ponte',
    ];

    var SONO_AULA_META = [
        {
            infoTitle: 'O Coala Kiko que Não Queria Dormir 🐨',
        },
        {
            infoTitle: 'O Cachorrinho Tobias e o Lugar Onde o Coração Descansa 🐶',
        },
        {
            infoTitle: 'O Capivara e a Coragem de Dormir Sozinho 🦫',
        },
        {
            infoTitle: 'O Eco do Quarto Vazio 🍃',
        },
        {
            infoTitle: 'A Luz que Ficou Acesa 💡',
        },
        {
            infoTitle: 'A Ponte que Só Aparece de Noite 🌉',
        },
    ];

    var OFERTAS_AULA_SHORT_LABELS = [
        'Receitas',
        'Teste',
        'Guia',
        '3-6 anos',
        '7-12 anos',
        '13-18 anos',
    ];

    var SURPRESA_AULA_SHORT_LABELS = [
        'Financeira',
        'Sono',
    ];

    var LEITURA_RAPIDA_AULA_SHORT_LABELS = [
        'Boas-vindas',
        'Semente',
        'Foguete',
        'Júnior',
        'Starter',
        'Pro',
        'Máster',
    ];

    var MEMORIA_TRABALHO_AULA_SHORT_LABELS = [
        'Guia',
        'Onda',
        'Desafio',
        'Activa',
        'Meditação',
    ];

    var CONCLUIDO_AULA_SHORT_LABELS = [
        'Inquérito',
        'Presente',
    ];

    var PDF_MATERIALS = {
        '/comunidade/assets/ebooks/seja-bem-vinda.pdf': {
            name: 'Boas-vindas PDF.pdf',
            size: '10,7 MB',
        },
        '/comunidade/assets/ebooks/instrucoes.pdf': {
            name: 'Instruções PDF.pdf',
            size: '14,8 MB',
        },
        '/comunidade/assets/ebooks/20-receitas-genio.pdf': {
            name: '20 Receitas para alimentar um Génio.pdf',
            size: '81 MB',
        },
        '/comunidade/assets/ebooks/tardes-sem-discussoes.pdf': {
            name: 'A Fábrica das Tardes Tranquilas.pdf',
            size: '25,1 MB',
        },
        '/comunidade/assets/ebooks/clube-instrucoes.pdf': {
            name: 'Instruções Clube dos Super Cérebros.pdf',
            size: '3,2 MB',
        },
        '/comunidade/assets/ebooks/guia-inteligencia-financeira-criancas.pdf': {
            name: 'Guia de Inteligência Financeira para Crianças.pdf',
            size: '44 MB',
        },
        '/comunidade/assets/ebooks/leitura-rapida-bem-vindos.pdf': {
            name: 'Boas-vindas — Leitura Rápida.pdf',
            size: '53 MB',
        },
        '/comunidade/assets/ebooks/leitura-rapida-nivel-semente.pdf': {
            name: 'Nível Semente (4 a 5 anos) — Pré-leitores.pdf',
            size: '14 MB',
        },
        '/comunidade/assets/ebooks/leitura-rapida-nivel-foguete.pdf': {
            name: 'Nível Foguete (6 a 7 anos) — Leitores a caminho.pdf',
            size: '57 MB',
        },
        '/comunidade/assets/ebooks/leitura-rapida-nivel-supercerebro-junior.pdf': {
            name: 'Nível Supercérebro Júnior (8 a 9 anos) — Leitores avançados.pdf',
            size: '73 MB',
        },
        '/comunidade/assets/ebooks/leitura-rapida-nivel-elite-starter.pdf': {
            name: 'Nível Élite Starter (10 a 11 anos) — Pré-secundário.pdf',
            size: '78 MB',
        },
        '/comunidade/assets/ebooks/leitura-rapida-nivel-elite-pro.pdf': {
            name: 'Nível Élite Pro (12 a 13 anos) — Secundário activo.pdf',
            size: '54 MB',
        },
        '/comunidade/assets/ebooks/leitura-rapida-nivel-elite-master.pdf': {
            name: 'Nível Élite Máster (14 a 16 anos) — Alto desempenho.pdf',
            size: '57 MB',
        },
    };

    var ORDER_BUMP_LESSON_CHROME = {
        'tardes-sem-brigas': {
            headerGift: '🎁 A Fábrica das Tardes Tranquilas',
            materialsHint: 'Descarrega o PDF para imprimir e usar em casa 👇👇',
            intro: (
                'INSTRUÇÕES\n\n' +
                'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as páginas que precisares — acordos, checklists e ferramentas — e usa-as em casa no dia a dia.\n\n' +
                'Onde colocar: Deixa os impressos visíveis no quarto ou na cozinha, para toda a família saber o que foi combinado.\n\n' +
                'Por onde começar: Lê o sistema completo, escolhe um passo de cada vez e aplica com calma. O objectivo são tardes mais tranquilas, com menos discussão.'
            ),
        },
        'caixa-super-truques': {
            headerGift: '🎁 A Caixa dos Super Truques do Génio',
            materialsHint: 'Descarrega o PDF para imprimir e usar em casa 👇👇',
            intro: (
                'INSTRUÇÕES\n\n' +
                'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as ferramentas, jogos e truques que fizerem sentido para o teu filho e usa-os no dia a dia.\n\n' +
                'Onde aplicar: Usa em momentos de estudo, tarefas ou quando precisares de mais concentração, autonomia ou motivação.\n\n' +
                'Por onde começar: Explora a caixa completa, escolhe um truque de cada vez e experimenta com calma. Pequenas acções consistentes criam grandes resultados.'
            ),
        },
    };

    var AUDIO_MATERIALS = {
        '/comunidade/assets/audio/metodo-onda-prodigio.mp3': {
            name: 'Onda Prodígio Áudio.mp3',
            size: '15,4 MB',
        },
        '/comunidade/assets/audio/sono-profundo.mp3': {
            name: 'Áudio de Sono Profundo.mp3',
            size: '41 MB',
        },
    };

    var state = {
        product: null,
        modules: [],
        activeModuleId: null,
        activeAulaId: null,
        comments: [],
        isAdmin: false,
        replyToId: null,
        searchQuery: '',
        sidebarSearchQuery: '',
        sidebarExpandedModules: {},
        progress: {},
    };

    var viewModules = document.getElementById('view-modules');
    var viewModuleAulas = document.getElementById('view-module-aulas');
    var viewLesson = document.getElementById('view-lesson');
    var moduleGrid = document.getElementById('module-grid');
    var moduleSearch = document.getElementById('module-search');
    var aulaList = document.getElementById('aula-list');
    var moduleHeaderNum = document.getElementById('module-header-num');
    var moduleHeaderTitle = document.getElementById('module-header-title');
    var moduleHeaderProgress = document.getElementById('module-header-progress');
    var moduleHeaderProgressText = document.getElementById('module-header-progress-text');
    var sidebar = document.getElementById('sidebar');
    var sidebarOverlay = document.getElementById('sidebar-overlay');
    var sidebarSearch = document.getElementById('sidebar-search');
    var moduleList = document.getElementById('module-list');
    var lessonPlayerWrap = document.querySelector('.comunidade-player-wrap');
    var lessonInstructions = document.getElementById('lesson-instructions');
    var contentPlayer = document.getElementById('content-player');
    var lessonSurvey = document.getElementById('lesson-survey');
    var lessonMaterials = document.getElementById('lesson-materials');
    var materialsList = document.getElementById('materials-list');
    var materialsCount = document.getElementById('materials-count');
    var materialsHint = document.getElementById('materials-hint');
    var lessonTitle = document.getElementById('lesson-title');
    var lessonDescription = document.getElementById('lesson-description');
    var lessonInfo = document.querySelector('.comunidade-lesson-info');
    var lessonInfoLabel = document.getElementById('lesson-info-label');
    var lessonHeader = document.getElementById('lesson-header');
    var lessonHeaderTitle = document.getElementById('lesson-header-title');
    var btnCompleteLesson = document.getElementById('btn-complete-lesson');
    var commentsList = document.getElementById('comments-list');
    var commentsError = document.getElementById('comments-error');
    var commentForm = document.getElementById('comment-form');
    var commentContent = document.getElementById('comment-content');
    var topbarUser = document.getElementById('topbar-user');
    var btnPrev = document.getElementById('btn-prev');
    var btnNext = document.getElementById('btn-next');
    var btnList = document.getElementById('btn-list');
    var btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    var backBar = document.getElementById('back-bar');
    var btnBackModules = document.getElementById('btn-back-modules');
    var btnBackFromAulas = document.getElementById('btn-back-from-aulas');

    function getItemProgress(moduleId) {
        return state.progress[moduleId] || 0;
    }

    function getModuleProgress(moduleItem) {
        if (!moduleItem) {
            return 0;
        }

        if (moduleHasAulas(moduleItem)) {
            var aulas = moduleItem.aulas;

            if (!aulas.length) {
                return 0;
            }

            var total = 0;

            aulas.forEach(function (aulaItem) {
                total += getItemProgress(aulaItem.id);
            });

            return Math.round(total / aulas.length);
        }

        return getItemProgress(moduleItem.id);
    }

    function isItemComplete(moduleId) {
        return getItemProgress(moduleId) >= 100;
    }

    function renderProgressMarkup(percent) {
        return (
            '<span class="comunidade-module-card__progress-text">' + percent + '%</span>' +
            '<div class="comunidade-module-card__progress-bar">' +
                '<div class="comunidade-module-card__progress-fill" style="width:' + percent + '%"></div>' +
            '</div>'
        );
    }

    function refreshProgressUi() {
        if (!viewModules.hidden) {
            renderModuleGrid();
        }

        if (!viewModuleAulas.hidden) {
            var activeModule = getActiveModule();

            if (activeModule) {
                var moduleProgress = getModuleProgress(activeModule);
                moduleHeaderProgress.style.width = moduleProgress + '%';
                moduleHeaderProgressText.textContent = moduleProgress + '%';
                renderAulaList(activeModule.aulas);
            }
        }

        if (!viewLesson.hidden) {
            renderSidebarAulas();
        }
    }

    async function loadProgress() {
        var response = await window.ComunidadeAuth.apiFetch(
            '/api/comunidade/progress?product_id=' + encodeURIComponent(productId)
        );
        var data = await response.json();

        if (response.ok) {
            state.progress = data.progress || {};
        }
    }

    async function markContentViewed(moduleId) {
        if (state.isAdmin || !moduleId || getItemProgress(moduleId) >= 100) {
            return;
        }

        state.progress[moduleId] = 100;
        refreshProgressUi();

        await window.ComunidadeAuth.apiFetch('/api/comunidade/progress', {
            method: 'POST',
            body: JSON.stringify({
                product_id: productId,
                module_id: moduleId,
                progress_percent: 100,
            }),
        });
    }

    function isSonoModule(moduleItem) {
        if (!moduleItem) {
            return false;
        }

        if (productId === 'onda-prodigio' && moduleItem.sort_order === 3) {
            return true;
        }

        if (productId === 'clube-super-cerebros' && moduleItem.sort_order === 2) {
            return true;
        }

        return false;
    }

    function getSonoAulaMeta(aulaItem, moduleItem) {
        if (!isSonoModule(moduleItem) || !aulaItem) {
            return null;
        }

        var aulas = moduleHasAulas(moduleItem) ? moduleItem.aulas : [];
        var index = aulas.findIndex(function (item) {
            return item.id === aulaItem.id;
        });

        if (index < 0 || !SONO_AULA_META[index]) {
            return null;
        }

        return {
            index: index,
            infoTitle: SONO_AULA_META[index].infoTitle,
        };
    }

    function getAulaDisplayTitle(aulaItem) {
        return aulaItem.title;
    }

    function updateCompleteButton(aulaItem) {
        if (!btnCompleteLesson) {
            return;
        }

        var isDone = isItemComplete(aulaItem.id);

        btnCompleteLesson.classList.toggle('is-done', isDone);
        btnCompleteLesson.disabled = isDone;
        btnCompleteLesson.innerHTML = isDone
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg> Concluída'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg> Concluir';
    }

    function hideLessonHeaderChrome() {
        if (lessonHeader) {
            lessonHeader.hidden = true;
        }

        if (lessonInfo) {
            lessonInfo.classList.remove('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.remove('is-tab');
        }
    }

    function getClubeLessonMeta(aulaItem, moduleItem) {
        if (productId !== 'clube-super-cerebros' || !moduleItem || moduleItem.sort_order !== 1) {
            return null;
        }

        if (aulaItem.sort_order === 1) {
            return {
                headerGift: '👉 Começa aqui',
                infoTitle: 'Bem-vindos ao Clube!',
            };
        }

        if (aulaItem.sort_order === 2) {
            return {
                headerGift: '👉 Começa aqui',
                infoTitle: 'Instruções',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
            };
        }

        return null;
    }

    function renderClubeLessonChrome(aulaItem, moduleItem) {
        var clubeMeta = getClubeLessonMeta(aulaItem, moduleItem);

        if (!clubeMeta) {
            return false;
        }

        if (lessonHeader) {
            lessonHeader.hidden = false;
        }

        if (document.getElementById('lesson-header-gift')) {
            document.getElementById('lesson-header-gift').textContent = clubeMeta.headerGift;
        }

        if (lessonHeaderTitle) {
            lessonHeaderTitle.textContent = aulaItem.title;
        }

        if (lessonInfo) {
            lessonInfo.classList.add('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.add('is-tab');
        }

        lessonTitle.textContent = clubeMeta.infoTitle;
        lessonDescription.textContent = aulaItem.description || '';
        updateCompleteButton(aulaItem);

        return true;
    }

    function renderSonoLessonChrome(aulaItem, moduleItem) {
        var sonoMeta = getSonoAulaMeta(aulaItem, moduleItem);

        if (!sonoMeta) {
            return false;
        }

        if (lessonHeader) {
            lessonHeader.hidden = false;
        }

        if (document.getElementById('lesson-header-gift')) {
            document.getElementById('lesson-header-gift').textContent = '🎁 Oferta — Protocolo do Sono Profundo';
        }

        if (lessonHeaderTitle) {
            lessonHeaderTitle.textContent = aulaItem.title;
        }

        if (lessonInfo) {
            lessonInfo.classList.add('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.add('is-tab');
        }

        lessonTitle.textContent = sonoMeta.infoTitle;
        lessonDescription.textContent = aulaItem.description || '';
        updateCompleteButton(aulaItem);

        return true;
    }

    function isOfertasModule(moduleItem) {
        if (!moduleItem) {
            return false;
        }

        if (productId === 'onda-prodigio' && moduleItem.sort_order === 4) {
            return true;
        }

        if (productId === 'clube-super-cerebros' && moduleItem.sort_order === 3) {
            return true;
        }

        return false;
    }

    function isSurpresaModule(moduleItem) {
        if (!moduleItem) {
            return false;
        }

        if (productId === 'clube-super-cerebros' && moduleItem.sort_order === 4) {
            return true;
        }

        return false;
    }

    function getSurpresaLessonMeta(aulaItem, moduleItem) {
        if (productId !== 'clube-super-cerebros' || !moduleItem || !isSurpresaModule(moduleItem) || !aulaItem) {
            return null;
        }

        if (aulaItem.sort_order === 1) {
            return {
                infoTitle: 'Guia de Inteligência Financeira para Crianças',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as páginas que precisares e usa-as em conversas sobre dinheiro com os teus filhos.\n\n' +
                    'Por onde começar: Lê o guia completo e escolhe uma actividade de cada vez — poupança, consumo consciente e metas simples.'
                ),
            };
        }

        if (aulaItem.sort_order === 2) {
            return {
                infoTitle: 'Áudio de Sono Profundo',
                materialsHint: 'Se quiseres descarregar o áudio, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Ouve este áudio com o teu filho antes de dormir, num quarto calmo, com luzes suaves e sem ecrãs.\n\n' +
                    'Quando usar: Ideal para a rotina da hora de deitar — ajuda a acalmar o corpo e a mente para um sono profundo e reparador.\n\n' +
                    'Dica: Se quiseres ouvir offline, descarrega o áudio no material adjunto abaixo.'
                ),
            };
        }

        return null;
    }

    function renderSurpresaLessonChrome(aulaItem, moduleItem) {
        if (!isSurpresaModule(moduleItem)) {
            return false;
        }

        var surpresaMeta = getSurpresaLessonMeta(aulaItem, moduleItem);

        if (lessonHeader) {
            lessonHeader.hidden = false;
        }

        if (document.getElementById('lesson-header-gift')) {
            document.getElementById('lesson-header-gift').textContent = '🎁 Ofertas Surpresa';
        }

        if (lessonHeaderTitle) {
            lessonHeaderTitle.textContent = aulaItem.title;
        }

        if (lessonInfo) {
            lessonInfo.classList.add('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.add('is-tab');
        }

        lessonTitle.textContent = surpresaMeta && surpresaMeta.infoTitle ?
            surpresaMeta.infoTitle :
            aulaItem.title;
        lessonDescription.textContent = aulaItem.description || '';
        updateCompleteButton(aulaItem);

        return true;
    }

    function isLeituraRapidaModule(moduleItem) {
        if (!moduleItem) {
            return false;
        }

        if (productId === 'clube-super-cerebros' && moduleItem.sort_order === 5) {
            return true;
        }

        return false;
    }

    function isMemoriaTrabalhoModule(moduleItem) {
        if (!moduleItem) {
            return false;
        }

        if (productId === 'clube-super-cerebros' && moduleItem.sort_order === 6) {
            return true;
        }

        return false;
    }

    function getMemoriaTrabalhoLessonMeta(aulaItem, moduleItem) {
        if (productId !== 'clube-super-cerebros' || !moduleItem || !isMemoriaTrabalhoModule(moduleItem) || !aulaItem) {
            return null;
        }

        if (aulaItem.sort_order === 1) {
            return {
                infoTitle: 'Guia estratégica — Memória de trabalho',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Este guia explica o funcionamento da memória de trabalho e o calendário de actividades deste mês.\n\n' +
                    'Por onde começar: Lê o guia completo antes das restantes aulas — é a base para aplicares a Onda Relâmpago, o Desafio e as actividades complementares.'
                ),
            };
        }

        if (aulaItem.sort_order === 2) {
            return {
                infoTitle: 'Onda Relâmpago',
                materialsHint: 'Se quiseres descarregar o áudio, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Ouve esta onda num ambiente calmo, de preferência com auscultadores e sem distracções.\n\n' +
                    'Quando usar: Segue a frequência indicada no guia estratégico — normalmente antes ou depois das actividades de memória de trabalho.\n\n' +
                    'Dica: Mantém uma rotina consistente para obteres melhores resultados ao longo do mês.'
                ),
            };
        }

        if (aulaItem.sort_order === 3) {
            return {
                infoTitle: 'Desafio Relâmpago',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime o que precisares e realiza os desafios com o teu filho.\n\n' +
                    'Objectivo: Treinar a memória de trabalho com actividades práticas, rápidas e divertidas.\n\n' +
                    'Por onde começar: Escolhe um desafio de cada vez e celebra cada pequena vitória.'
                ),
            };
        }

        if (aulaItem.sort_order === 4) {
            return {
                infoTitle: 'Ativa o teu cérebro',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Usa estas dinâmicas para «acordar» o cérebro antes das actividades principais.\n\n' +
                    'Quando usar: Ideal antes do Desafio Relâmpago ou de momentos de estudo mais exigentes.\n\n' +
                    'Dica: Mantém as sessões curtas e energéticas — o objectivo é activar, não cansar.'
                ),
            };
        }

        if (aulaItem.sort_order === 5) {
            return {
                infoTitle: 'Meditação reencontro',
                materialsHint: 'Se quiseres descarregar o áudio, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Ouve esta meditação num espaço calmo, sentados confortavelmente ou deitados.\n\n' +
                    'Quando usar: No final de uma sessão de actividades ou antes de dormir, para consolidar o que foi aprendido.\n\n' +
                    'Objectivo: Reencontrar a calma interior e fechar o ciclo deste mês com serenidade.'
                ),
            };
        }

        return null;
    }

    function renderMemoriaTrabalhoLessonChrome(aulaItem, moduleItem) {
        if (!isMemoriaTrabalhoModule(moduleItem)) {
            return false;
        }

        var memoriaMeta = getMemoriaTrabalhoLessonMeta(aulaItem, moduleItem);

        if (lessonHeader) {
            lessonHeader.hidden = false;
        }

        if (document.getElementById('lesson-header-gift')) {
            document.getElementById('lesson-header-gift').textContent = 'Mês 1 - Memória de trabalho ⚡';
        }

        if (lessonHeaderTitle) {
            lessonHeaderTitle.textContent = aulaItem.title;
        }

        if (lessonInfo) {
            lessonInfo.classList.add('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.add('is-tab');
        }

        lessonTitle.textContent = memoriaMeta && memoriaMeta.infoTitle ?
            memoriaMeta.infoTitle :
            aulaItem.title;
        lessonDescription.textContent = aulaItem.description || '';
        updateCompleteButton(aulaItem);

        return true;
    }

    function getLeituraRapidaLessonMeta(aulaItem, moduleItem) {
        if (productId !== 'clube-super-cerebros' || !moduleItem || !isLeituraRapidaModule(moduleItem) || !aulaItem) {
            return null;
        }

        if (aulaItem.sort_order === 1) {
            return {
                infoTitle: 'Boas-vindas ao Leitura Rápida',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Este guia apresenta o módulo de Leitura Rápida e explica o percurso por níveis etários.\n\n' +
                    'Por onde começar: Lê a introdução completa e identifica o nível mais adequado à idade do teu filho — depois avança aula a aula no teu ritmo.'
                ),
            };
        }

        if (aulaItem.sort_order === 2) {
            return {
                infoTitle: 'Nível Semente (4 a 5 anos) – «Pré-leitores»',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as actividades que precisares e pratica com o teu filho em momentos calmos do dia.\n\n' +
                    'Objectivo do nível: Despertar a curiosidade pela leitura, reconhecimento de letras e ritmo — ideal para crianças dos 4 aos 5 anos que ainda estão a dar os primeiros passos como «pré-leitores».\n\n' +
                    'Por onde começar: Lê o guia completo e escolhe uma actividade de cada vez, com calma e sem pressão.'
                ),
            };
        }

        if (aulaItem.sort_order === 7) {
            return {
                infoTitle: 'Nível Élite Máster (14 a 16 anos) – «Alto desempenho»',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as actividades que precisares e pratica com o teu filho em momentos de estudo focados.\n\n' +
                    'Objectivo do nível: Dominar métodos de leitura rápida com foco em rendimento escolar e autonomia — ideal para jovens dos 14 aos 16 anos em fase de alto desempenho.\n\n' +
                    'Por onde começar: Lê o guia completo e escolhe uma actividade de cada vez, reforçando velocidade, compreensão e independência na leitura.'
                ),
            };
        }

        if (aulaItem.sort_order === 6) {
            return {
                infoTitle: 'Nível Élite Pro (12 a 13 anos) – «Secundário activo»',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as actividades que precisares e pratica com o teu filho em momentos de estudo focados.\n\n' +
                    'Objectivo do nível: Aprofundar técnicas de leitura rápida e compreensão — ideal para adolescentes dos 12 aos 13 anos em plena fase de secundário activo.\n\n' +
                    'Por onde começar: Lê o guia completo e escolhe uma actividade de cada vez, reforçando velocidade, foco e autonomia na leitura.'
                ),
            };
        }

        if (aulaItem.sort_order === 5) {
            return {
                infoTitle: 'Nível Élite Starter (10 a 11 anos) – «Pré-secundário»',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as actividades que precisares e pratica com o teu filho em momentos de estudo focados.\n\n' +
                    'Objectivo do nível: Desenvolver leitura rápida e compreensão avançada — ideal para crianças dos 10 aos 11 anos a prepararem o salto para o secundário.\n\n' +
                    'Por onde começar: Lê o guia completo e escolhe uma actividade de cada vez, reforçando autonomia e confiança na leitura.'
                ),
            };
        }

        if (aulaItem.sort_order === 4) {
            return {
                infoTitle: 'Nível Supercérebro Júnior (8 a 9 anos) – «Leitores avançados»',
                materialsHint: 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as actividades que precisares e pratica com o teu filho em momentos de estudo calmos.\n\n' +
                    'Objectivo do nível: Consolidar fluência, compreensão e velocidade de leitura — ideal para crianças dos 8 aos 9 anos que já leem com mais autonomia.\n\n' +
                    'Por onde começar: Lê o guia completo e escolhe uma actividade de cada vez, reforçando a confiança do teu filho como «leitor avançado».'
                ),
            };
        }

        if (aulaItem.sort_order === 3) {
            return {
                infoTitle: 'Nível Foguete (6 a 7 anos) – «Leitores a caminho»',
                materialsHint: 'Se quiseres descarregar os ficheiros, vê abaixo 👇👇',
                intro: (
                    'INSTRUÇÕES\n\n' +
                    'Como usar: Descarrega o PDF abaixo ou lê online. Imprime as três fichas de exercício e pratica uma de cada vez com o teu filho.\n\n' +
                    'Objectivo do nível: Potenciar o ritmo de leitura, automatização de palavras comuns e consolidação da compreensão literal — para crianças dos 6 aos 7 anos.\n\n' +
                    'Por onde começar: Lê o guia completo e segue as actividades na ordem sugerida, com calma e sem pressão.'
                ),
                worksheets: [
                    {
                        path: '/comunidade/assets/leitura-rapida/foguete/modulo-1-piramides-palavras.png',
                        name: 'Módulo 1 — Pirâmides de Palavras.png',
                        size: '122 KB',
                    },
                    {
                        path: '/comunidade/assets/leitura-rapida/foguete/modulo-2-mini-chunking.png',
                        name: 'Módulo 2 — Mini-Chunking.png',
                        size: '160 KB',
                    },
                    {
                        path: '/comunidade/assets/leitura-rapida/foguete/modulo-3-cronometro-espiao.png',
                        name: 'Módulo 3 — O Cronómetro Espião.png',
                        size: '222 KB',
                    },
                ],
            };
        }

        return null;
    }

    function renderLeituraRapidaLessonChrome(aulaItem, moduleItem) {
        if (!isLeituraRapidaModule(moduleItem)) {
            return false;
        }

        var leituraMeta = getLeituraRapidaLessonMeta(aulaItem, moduleItem);

        if (lessonHeader) {
            lessonHeader.hidden = false;
        }

        if (document.getElementById('lesson-header-gift')) {
            document.getElementById('lesson-header-gift').textContent = 'Leitura Rápida 📚';
        }

        if (lessonHeaderTitle) {
            lessonHeaderTitle.textContent = aulaItem.title;
        }

        if (lessonInfo) {
            lessonInfo.classList.add('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.add('is-tab');
        }

        lessonTitle.textContent = leituraMeta && leituraMeta.infoTitle ?
            leituraMeta.infoTitle :
            aulaItem.title;
        lessonDescription.textContent = aulaItem.description || '';
        updateCompleteButton(aulaItem);

        return true;
    }

    function renderOfertasLessonChrome(aulaItem, moduleItem) {
        if (!isOfertasModule(moduleItem)) {
            return false;
        }

        if (lessonHeader) {
            lessonHeader.hidden = false;
        }

        if (document.getElementById('lesson-header-gift')) {
            document.getElementById('lesson-header-gift').textContent = '🎁 Ofertas';
        }

        if (lessonHeaderTitle) {
            lessonHeaderTitle.textContent = aulaItem.title;
        }

        if (lessonInfo) {
            lessonInfo.classList.add('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.add('is-tab');
        }

        lessonTitle.textContent = aulaItem.title;
        lessonDescription.textContent = aulaItem.description || '';
        updateCompleteButton(aulaItem);

        return true;
    }

    function renderOrderBumpLessonChrome(aulaItem) {
        var config = ORDER_BUMP_LESSON_CHROME[productId];

        if (!config) {
            return false;
        }

        if (lessonHeader) {
            lessonHeader.hidden = false;
        }

        if (document.getElementById('lesson-header-gift')) {
            document.getElementById('lesson-header-gift').textContent = config.headerGift;
        }

        if (lessonHeaderTitle) {
            lessonHeaderTitle.textContent = aulaItem.title;
        }

        if (lessonInfo) {
            lessonInfo.classList.add('is-sono');
        }

        if (lessonInfoLabel) {
            lessonInfoLabel.classList.add('is-tab');
        }

        lessonTitle.textContent = aulaItem.title;
        lessonDescription.textContent = aulaItem.description || '';
        updateCompleteButton(aulaItem);

        return true;
    }

    function renderLessonHeaderChrome(aulaItem, moduleItem) {
        hideLessonHeaderChrome();

        if (renderSonoLessonChrome(aulaItem, moduleItem)) {
            return true;
        }

        if (renderOfertasLessonChrome(aulaItem, moduleItem)) {
            return true;
        }

        if (renderSurpresaLessonChrome(aulaItem, moduleItem)) {
            return true;
        }

        if (renderLeituraRapidaLessonChrome(aulaItem, moduleItem)) {
            return true;
        }

        if (renderMemoriaTrabalhoLessonChrome(aulaItem, moduleItem)) {
            return true;
        }

        if (renderOrderBumpLessonChrome(aulaItem)) {
            return true;
        }

        if (renderClubeLessonChrome(aulaItem, moduleItem)) {
            return true;
        }

        return false;
    }

    function getAulaThumbLabel(aulaItem, index, moduleItem) {
        if (productId === 'clube-super-cerebros' && moduleItem && moduleItem.sort_order === 1) {
            var clubeAulaLabels = ['Bem-vinda', 'Instruções'];

            if (clubeAulaLabels[index]) {
                return clubeAulaLabels[index];
            }
        }

        if (productId === 'onda-prodigio' && moduleItem && moduleItem.sort_order === 1 && AULA_THUMB_LABELS[index]) {
            return AULA_THUMB_LABELS[index];
        }

        if (moduleItem && isSonoModule(moduleItem) && SONO_AULA_SHORT_LABELS[index]) {
            return SONO_AULA_SHORT_LABELS[index];
        }

        if (moduleItem && isOfertasModule(moduleItem) && OFERTAS_AULA_SHORT_LABELS[index]) {
            return OFERTAS_AULA_SHORT_LABELS[index];
        }

        if (moduleItem && isSurpresaModule(moduleItem) && SURPRESA_AULA_SHORT_LABELS[index]) {
            return SURPRESA_AULA_SHORT_LABELS[index];
        }

        if (moduleItem && isLeituraRapidaModule(moduleItem) && LEITURA_RAPIDA_AULA_SHORT_LABELS[index]) {
            return LEITURA_RAPIDA_AULA_SHORT_LABELS[index];
        }

        if (moduleItem && isMemoriaTrabalhoModule(moduleItem) && MEMORIA_TRABALHO_AULA_SHORT_LABELS[index]) {
            return MEMORIA_TRABALHO_AULA_SHORT_LABELS[index];
        }

        if (productId === 'onda-prodigio' && moduleItem && moduleItem.sort_order === 5 && CONCLUIDO_AULA_SHORT_LABELS[index]) {
            return CONCLUIDO_AULA_SHORT_LABELS[index];
        }

        return aulaItem.title;
    }

    function isAulaLocked(aulaItem) {
        return Boolean(aulaItem && aulaItem.is_locked && !state.isAdmin);
    }

    function unmountLessonSurveys() {
        if (!lessonSurvey) {
            return;
        }

        if (window.ComunidadeWelcomeSurvey) {
            window.ComunidadeWelcomeSurvey.unmount(lessonSurvey);
        }

        if (window.ComunidadeGeniusTest) {
            window.ComunidadeGeniusTest.unmount(lessonSurvey);
        }
    }

    function renderLockedPlayer(aulaItem) {
        unmountLessonSurveys();

        if (lessonPlayerWrap) {
            lessonPlayerWrap.hidden = false;
        }

        lessonMaterials.hidden = true;
        materialsList.innerHTML = '';
        renderInstructions('');

        contentPlayer.className = 'comunidade-player comunidade-player--locked';
        contentPlayer.innerHTML = (
            '<div class="comunidade-locked">' +
                '<div class="comunidade-locked__icon" aria-hidden="true">' +
                    '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' +
                '</div>' +
                '<p class="comunidade-locked__title">Este conteúdo ainda não está disponível.</p>' +
                (aulaItem.unlock_label ?
                    '<p class="comunidade-locked__date">' + escapeHtml(aulaItem.unlock_label) + '</p>' :
                    '') +
                '<p class="comunidade-locked__hint">O desbloqueio é calculado a partir da data da tua compra.</p>' +
            '</div>'
        );
    }

    function resolveAssetUrl(path) {
        if (!path) {
            return '';
        }

        return path.charAt(0) === '/' ? path : '/' + path.replace(/^\//, '');
    }

    function getPdfMeta(pdfPath) {
        var url = resolveAssetUrl(pdfPath);
        var meta = PDF_MATERIALS[url];

        if (meta) {
            return meta;
        }

        var fileName = url.split('/').pop() || 'Material.pdf';

        return {
            name: decodeURIComponent(fileName),
            size: 'PDF',
        };
    }

    function getAudioMeta(audioPath) {
        var url = resolveAssetUrl(audioPath);
        var meta = AUDIO_MATERIALS[url];

        if (meta) {
            return meta;
        }

        var fileName = url.split('/').pop() || 'Audio.mp3';

        return {
            name: decodeURIComponent(fileName),
            size: 'MP3',
        };
    }

    function renderMaterialFile(url, meta, kind) {
        var icon = kind === 'audio'
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
            : kind === 'image'
                ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
                : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>';
        var typeLabel = kind === 'audio' ? 'MP3' : kind === 'image' ? 'Imagem' : 'PDF';

        return (
            '<a class="comunidade-materials__file" href="' + url + '" download="' + escapeHtml(meta.name) + '" target="_blank" rel="noopener">' +
                '<span class="comunidade-materials__file-icon" aria-hidden="true">' + icon + '</span>' +
                '<span class="comunidade-materials__file-info">' +
                    '<span class="comunidade-materials__file-name">' + escapeHtml(meta.name) + '</span>' +
                    '<span class="comunidade-materials__file-meta">' + typeLabel + ' · ' + escapeHtml(meta.size) + '</span>' +
                '</span>' +
                '<span class="comunidade-materials__file-action">Descarregar</span>' +
            '</a>'
        );
    }

    function renderInstructions(text) {
        if (!lessonInstructions) {
            return;
        }

        if (!text) {
            lessonInstructions.hidden = true;
            lessonInstructions.innerHTML = '';
            return;
        }

        var html = text.split('\n\n').map(function (paragraph) {
            var trimmed = paragraph.trim();

            if (!trimmed) {
                return '';
            }

            if (trimmed === 'INSTRUÇÕES') {
                return '<h3 class="comunidade-lesson-instructions__title">' + escapeHtml(trimmed) + '</h3>';
            }

            var parts = trimmed.match(/^([^:]+):\s*(.+)$/);

            if (parts) {
                return '<p class="comunidade-lesson-instructions__item"><strong>' + escapeHtml(parts[1]) + ':</strong> ' + escapeHtml(parts[2]) + '</p>';
            }

            return '<p class="comunidade-lesson-instructions__item">' + escapeHtml(trimmed) + '</p>';
        }).join('');

        lessonInstructions.hidden = false;
        lessonInstructions.innerHTML = html;
    }

    function renderMaterials(aulaItem) {
        var items = [];

        if (aulaItem.pdf_path) {
            items.push(renderMaterialFile(
                resolveAssetUrl(aulaItem.pdf_path),
                getPdfMeta(aulaItem.pdf_path),
                'pdf'
            ));
        }

        if (aulaItem.audio_path) {
            items.push(renderMaterialFile(
                resolveAssetUrl(aulaItem.audio_path),
                getAudioMeta(aulaItem.audio_path),
                'audio'
            ));
        }

        var leituraMeta = getLeituraRapidaLessonMeta(aulaItem, getActiveModule());

        if (leituraMeta && leituraMeta.worksheets) {
            leituraMeta.worksheets.forEach(function (worksheet) {
                items.push(renderMaterialFile(
                    resolveAssetUrl(worksheet.path),
                    worksheet,
                    'image'
                ));
            });
        }

        if (!items.length) {
            lessonMaterials.hidden = true;
            materialsList.innerHTML = '';
            return;
        }

        if (materialsHint) {
            var orderBumpHint = ORDER_BUMP_LESSON_CHROME[productId];

            if (orderBumpHint && orderBumpHint.materialsHint) {
                materialsHint.textContent = orderBumpHint.materialsHint;
            } else {
                var clubeMeta = getClubeLessonMeta(aulaItem, getActiveModule());
                var surpresaMeta = getSurpresaLessonMeta(aulaItem, getActiveModule());
                var leituraMaterialsMeta = getLeituraRapidaLessonMeta(aulaItem, getActiveModule());
                var memoriaMaterialsMeta = getMemoriaTrabalhoLessonMeta(aulaItem, getActiveModule());

                if (leituraMaterialsMeta && leituraMaterialsMeta.materialsHint) {
                    materialsHint.textContent = leituraMaterialsMeta.materialsHint;
                } else if (memoriaMaterialsMeta && memoriaMaterialsMeta.materialsHint) {
                    materialsHint.textContent = memoriaMaterialsMeta.materialsHint;
                } else if (surpresaMeta && surpresaMeta.materialsHint) {
                    materialsHint.textContent = surpresaMeta.materialsHint;
                } else if (clubeMeta && clubeMeta.materialsHint) {
                    materialsHint.textContent = clubeMeta.materialsHint;
                } else if (aulaItem.audio_path && !aulaItem.pdf_path) {
                    materialsHint.textContent = 'Se quiseres descarregar o áudio, vai ao material adjunto 👇👇';
                } else if (aulaItem.audio_path && aulaItem.pdf_path) {
                    materialsHint.textContent = 'Se quiseres descarregar os materiais, vê abaixo 👇👇';
                } else {
                    materialsHint.textContent = 'Se quiseres descarregar o ficheiro, vai ao material adjunto 👇👇';
                }
            }
        }

        lessonMaterials.hidden = false;
        materialsCount.textContent = String(items.length);
        materialsList.innerHTML = items.join('');
    }

    function renderAudioPlayer(aulaItem) {
        var audioUrl = resolveAssetUrl(aulaItem.audio_path);
        var coverUrl = aulaItem.image_url ? resolveAssetUrl(aulaItem.image_url) : '';

        contentPlayer.className = 'comunidade-player comunidade-player--audio';
        contentPlayer.innerHTML = (
            '<div class="comunidade-audio-player">' +
                (coverUrl ?
                    '<div class="comunidade-audio-player__cover">' +
                        '<img src="' + coverUrl + '" alt="' + escapeHtml(aulaItem.title) + '">' +
                    '</div>' :
                    '') +
                '<audio class="comunidade-audio-player__controls" controls preload="metadata" src="' + audioUrl + '">' +
                    'O teu browser não suporta áudio.' +
                '</audio>' +
            '</div>'
        );
    }

    function renderPdfViewer(aulaItem) {
        var url = resolveAssetUrl(aulaItem.pdf_path);

        contentPlayer.className = 'comunidade-player comunidade-player--pdf';
        contentPlayer.innerHTML = '<div class="comunidade-pdf-viewer-host"></div>';

        if (window.ComunidadePdfViewer) {
            window.ComunidadePdfViewer.render(
                contentPlayer.querySelector('.comunidade-pdf-viewer-host'),
                url,
                aulaItem.title
            );
        }
    }

    function renderLeituraRapidaWorksheets(worksheets) {
        contentPlayer.className = 'comunidade-player comunidade-player--worksheets';
        contentPlayer.innerHTML = worksheets.map(function (worksheet) {
            var url = resolveAssetUrl(worksheet.path);

            return (
                '<figure class="comunidade-worksheet">' +
                    '<img src="' + url + '" alt="' + escapeHtml(worksheet.name) + '" loading="lazy">' +
                '</figure>'
            );
        }).join('');
    }

    function renderVideoPlayer(aulaItem) {
        if (aulaItem.video_path) {
            var videoUrl = resolveAssetUrl(aulaItem.video_path);

            contentPlayer.className = 'comunidade-player';
            contentPlayer.innerHTML = (
                '<video class="comunidade-video-player" controls playsinline preload="metadata" ' +
                'controlsList="nodownload noplaybackrate noremoteplayback" ' +
                'disablePictureInPicture disableRemotePlayback src="' + videoUrl + '">' +
                    'O teu browser não suporta vídeo.' +
                '</video>'
            );

            var videoEl = contentPlayer.querySelector('.comunidade-video-player');

            if (videoEl) {
                videoEl.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
                videoEl.disablePictureInPicture = true;
                videoEl.disableRemotePlayback = true;
                videoEl.addEventListener('contextmenu', function (event) {
                    event.preventDefault();
                });
            }

            return;
        }

        contentPlayer.className = 'comunidade-player';
        contentPlayer.innerHTML = (
            '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(aulaItem.youtube_id) + '" ' +
            'title="' + escapeHtml(aulaItem.title) + '" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
        );
    }
    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(value) {
        try {
            return new Intl.DateTimeFormat('pt-PT', {
                dateStyle: 'short',
                timeStyle: 'short',
            }).format(new Date(value));
        } catch (error) {
            return value;
        }
    }

    function getModuleById(moduleId) {
        return state.modules.find(function (item) {
            return item.id === moduleId;
        });
    }

    function moduleHasAulas(moduleItem) {
        return Boolean(moduleItem && moduleItem.aulas && moduleItem.aulas.length);
    }

    function getActiveModule() {
        return getModuleById(state.activeModuleId);
    }

    function getActiveAulas() {
        var moduleItem = getActiveModule();

        if (!moduleItem) {
            return [];
        }

        if (moduleHasAulas(moduleItem)) {
            return moduleItem.aulas;
        }

        return [moduleItem];
    }

    function getActiveAula() {
        var aulas = getActiveAulas();

        return aulas.find(function (item) {
            return item.id === state.activeAulaId;
        }) || null;
    }

    function hasModuleGrid() {
        return state.modules.length > 1;
    }

    function hideAllViews() {
        viewModules.hidden = true;
        viewModuleAulas.hidden = true;
        viewLesson.hidden = true;
    }

    function updateUrl() {
        var url = new URL(window.location.href);

        if (state.activeModuleId && hasModuleGrid()) {
            url.searchParams.set('module', state.activeModuleId);
        } else {
            url.searchParams.delete('module');
        }

        if (state.activeAulaId) {
            url.searchParams.set('aula', state.activeAulaId);
        } else {
            url.searchParams.delete('aula');
        }

        history.replaceState(null, '', url.pathname + url.search);
    }

    function getActiveAulaIndex() {
        return getActiveAulas().findIndex(function (item) {
            return item.id === state.activeAulaId;
        });
    }

    function openSidebar() {
        sidebar.classList.add('is-open');
        sidebarOverlay.classList.add('is-visible');
    }

    function closeSidebar() {
        sidebar.classList.remove('is-open');
        sidebarOverlay.classList.remove('is-visible');
    }

    function updateNavButtons() {
        var index = getActiveAulaIndex();
        var aulas = getActiveAulas();

        btnPrev.disabled = index <= 0;
        btnNext.disabled = index < 0 || index >= aulas.length - 1;
    }

    function showModuleGridView() {
        hideAllViews();
        viewModules.hidden = false;
        btnToggleSidebar.hidden = true;
        state.activeModuleId = null;
        state.activeAulaId = null;
        updateUrl();
        renderModuleGrid();
    }

    function showModuleAulasView(moduleId) {
        var moduleItem = getModuleById(moduleId);

        if (!moduleItem) {
            return;
        }

        hideAllViews();
        viewModuleAulas.hidden = false;
        btnToggleSidebar.hidden = true;
        state.activeModuleId = moduleId;
        state.activeAulaId = null;
        updateUrl();

        var moduleIndex = state.modules.findIndex(function (item) {
            return item.id === moduleId;
        });

        moduleHeaderNum.textContent = String(moduleIndex + 1);
        moduleHeaderTitle.textContent = moduleItem.title;

        var moduleProgress = getModuleProgress(moduleItem);
        moduleHeaderProgress.style.width = moduleProgress + '%';
        moduleHeaderProgressText.textContent = moduleProgress + '%';

        if (moduleHasAulas(moduleItem)) {
            renderAulaList(moduleItem.aulas);
            return;
        }

        aulaList.innerHTML = '<p class="comunidade-panel__subtitle">Conteúdo em breve — estamos a preparar este módulo.</p>';
    }

    function showLessonView(moduleId, aulaId) {
        hideAllViews();
        viewLesson.hidden = false;
        btnToggleSidebar.hidden = false;

        state.activeModuleId = moduleId;
        state.activeAulaId = aulaId;
        state.sidebarExpandedModules[moduleId] = true;

        var moduleItem = getModuleById(moduleId);
        backBar.hidden = !moduleHasAulas(moduleItem);

        updateUrl();
        renderSidebarAulas();

        if (aulaId) {
            selectAula(aulaId, false);
        }
    }

    function getFilteredModules() {
        var query = state.searchQuery.trim().toLowerCase();

        if (!query) {
            return state.modules;
        }

        return state.modules.filter(function (moduleItem) {
            var haystack = (moduleItem.title + ' ' + (moduleItem.description || '')).toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function renderModuleGrid() {
        var modules = getFilteredModules();

        if (!modules.length) {
            moduleGrid.innerHTML = '<p class="comunidade-panel__subtitle">Nenhum módulo encontrado.</p>';
            return;
        }

        moduleGrid.innerHTML = modules.map(function (moduleItem) {
            var index = state.modules.findIndex(function (item) {
                return item.id === moduleItem.id;
            });
            var thumbIndex = Math.min(index + 1, 5);
            var thumbLabel = THUMB_LABELS[index] || moduleItem.title;
            var image = moduleItem.image_url ? '/' + moduleItem.image_url.replace(/^\//, '') : '';
            var progress = getModuleProgress(moduleItem);

            return (
                '<button type="button" class="comunidade-module-card" data-open-module="' + moduleItem.id + '">' +
                    '<div class="comunidade-module-card__progress">' +
                        renderProgressMarkup(progress) +
                    '</div>' +
                    '<div class="comunidade-module-card__title">' + escapeHtml(moduleItem.title) + '</div>' +
                    '<div class="comunidade-module-card__thumb comunidade-module-card__thumb--' + thumbIndex + '">' +
                        (image ? '<img src="' + image + '" alt="">' : '<span class="comunidade-module-card__label">' + escapeHtml(thumbLabel) + '</span>') +
                    '</div>' +
                '</button>'
            );
        }).join('');

        moduleGrid.querySelectorAll('[data-open-module]').forEach(function (button) {
            button.addEventListener('click', function () {
                openModule(button.getAttribute('data-open-module'));
            });
        });
    }

    function renderAulaList(aulas) {
        aulaList.innerHTML = aulas.map(function (aulaItem, index) {
            var image = aulaItem.image_url ? '/' + aulaItem.image_url.replace(/^\//, '') : '';
            var thumbLabel = getAulaThumbLabel(aulaItem, index, getActiveModule());
            var isDone = isItemComplete(aulaItem.id);
            var isLocked = isAulaLocked(aulaItem);

            return (
                '<button type="button" class="comunidade-aula-item' + (isDone ? ' is-done' : '') + (isLocked ? ' is-locked' : '') + '" data-open-aula="' + aulaItem.id + '">' +
                    '<div class="comunidade-aula-item__thumb">' +
                        (image ? '<img src="' + image + '" alt="">' : '<span class="comunidade-aula-item__thumb-label">' + escapeHtml(thumbLabel) + '</span>') +
                    '</div>' +
                    '<span class="comunidade-aula-item__meta">' +
                        '<span class="comunidade-aula-item__title">' + escapeHtml(getAulaDisplayTitle(aulaItem)) + '</span>' +
                        (isLocked && aulaItem.unlock_label ?
                            '<span class="comunidade-aula-item__unlock">' + escapeHtml(aulaItem.unlock_label) + '</span>' :
                            '') +
                    '</span>' +
                    '<span class="comunidade-aula-item__status" aria-hidden="true">' +
                        (isLocked ?
                            '<svg class="comunidade-aula-item__lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' :
                            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>') +
                    '</span>' +
                '</button>'
            );
        }).join('');

        aulaList.querySelectorAll('[data-open-aula]').forEach(function (button) {
            button.addEventListener('click', function () {
                openAula(button.getAttribute('data-open-aula'));
            });
        });
    }

    function isSidebarModuleExpanded(moduleId) {
        if (Object.prototype.hasOwnProperty.call(state.sidebarExpandedModules, moduleId)) {
            return state.sidebarExpandedModules[moduleId];
        }

        if (moduleId === state.activeModuleId) {
            return true;
        }

        var query = state.sidebarSearchQuery.trim().toLowerCase();

        if (query) {
            var moduleItem = getModuleById(moduleId);

            if (moduleItem) {
                var moduleHaystack = (moduleItem.title + ' ' + (moduleItem.description || '')).toLowerCase();

                if (moduleHaystack.indexOf(query) === -1) {
                    return true;
                }
            }
        }

        return false;
    }

    function toggleSidebarModule(moduleId) {
        state.sidebarExpandedModules[moduleId] = !isSidebarModuleExpanded(moduleId);
        renderSidebarAulas();
    }

    function getSidebarModules() {
        var query = state.sidebarSearchQuery.trim().toLowerCase();

        if (!query) {
            return state.modules;
        }

        return state.modules.filter(function (moduleItem) {
            var haystack = (moduleItem.title + ' ' + (moduleItem.description || '')).toLowerCase();

            if (haystack.indexOf(query) !== -1) {
                return true;
            }

            if (moduleHasAulas(moduleItem)) {
                return moduleItem.aulas.some(function (aulaItem) {
                    var aulaHaystack = (aulaItem.title + ' ' + (aulaItem.description || '')).toLowerCase();
                    return aulaHaystack.indexOf(query) !== -1;
                });
            }

            return false;
        });
    }

    function getSidebarLessonsForModule(moduleItem) {
        var query = state.sidebarSearchQuery.trim().toLowerCase();
        var lessons = moduleHasAulas(moduleItem) ? moduleItem.aulas : [moduleItem];

        if (!query) {
            return lessons;
        }

        return lessons.filter(function (aulaItem) {
            var haystack = (aulaItem.title + ' ' + (aulaItem.description || '')).toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function renderSidebarLessonItem(moduleId, aulaItem, index) {
        var isActive = moduleId === state.activeModuleId && aulaItem.id === state.activeAulaId;
        var isDone = isItemComplete(aulaItem.id);
        var isLocked = isAulaLocked(aulaItem);
        var image = aulaItem.image_url ? '/' + aulaItem.image_url.replace(/^\//, '') : '';
        var moduleItem = getModuleById(moduleId);
        var thumbLabel = getAulaThumbLabel(aulaItem, index, moduleItem);

        return (
            '<button type="button" class="comunidade-sidebar-lesson' + (isActive ? ' is-active' : '') + (isDone ? ' is-done' : '') + (isLocked ? ' is-locked' : '') + '" data-module-id="' + moduleId + '" data-aula-id="' + aulaItem.id + '">' +
                '<span class="comunidade-sidebar-lesson__thumb">' +
                    (image ?
                        '<img src="' + image + '" alt="">' :
                        '<span class="comunidade-sidebar-lesson__thumb-label">' + escapeHtml(thumbLabel) + '</span>') +
                    (isActive && !isLocked ?
                        '<span class="comunidade-sidebar-lesson__playing">' +
                            '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
                            'A reproduzir agora' +
                        '</span>' :
                        '') +
                '</span>' +
                '<span class="comunidade-sidebar-lesson__info">' +
                    '<span class="comunidade-sidebar-lesson__title">' + escapeHtml(getAulaDisplayTitle(aulaItem)) + '</span>' +
                    (isLocked && aulaItem.unlock_label ?
                        '<span class="comunidade-sidebar-lesson__unlock">' + escapeHtml(aulaItem.unlock_label) + '</span>' :
                        '') +
                '</span>' +
                '<span class="comunidade-sidebar-lesson__status" aria-hidden="true">' +
                    (isLocked ?
                        '<svg class="comunidade-sidebar-lesson__lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>' :
                        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>') +
                '</span>' +
            '</button>'
        );
    }

    function renderSidebarModule(moduleItem, moduleIndex) {
        var expanded = isSidebarModuleExpanded(moduleItem.id);
        var moduleProgress = getModuleProgress(moduleItem);
        var lessons = getSidebarLessonsForModule(moduleItem);
        var isActiveModule = moduleItem.id === state.activeModuleId;

        return (
            '<div class="comunidade-sidebar-module' + (isActiveModule ? ' is-active' : '') + '">' +
                '<button type="button" class="comunidade-sidebar-module__head" data-module-toggle="' + moduleItem.id + '" aria-expanded="' + expanded + '">' +
                    '<span class="comunidade-sidebar-module__num">' + (moduleIndex + 1) + '</span>' +
                    '<span class="comunidade-sidebar-module__info">' +
                        '<span class="comunidade-sidebar-module__title">' + escapeHtml(moduleItem.title) + '</span>' +
                        '<div class="comunidade-sidebar-module__progress">' +
                            '<div class="comunidade-sidebar-module__progress-bar"><div class="comunidade-sidebar-module__progress-fill" style="width:' + moduleProgress + '%"></div></div>' +
                            '<span class="comunidade-sidebar-module__progress-text">' + moduleProgress + '%</span>' +
                        '</div>' +
                    '</span>' +
                    '<span class="comunidade-sidebar-module__chevron" aria-hidden="true">' +
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
                    '</span>' +
                '</button>' +
                '<div class="comunidade-sidebar-lessons' + (expanded ? '' : ' is-collapsed') + '">' +
                    (lessons.length ?
                        lessons.map(function (aulaItem, index) {
                            return renderSidebarLessonItem(moduleItem.id, aulaItem, index);
                        }).join('') :
                        '<p class="comunidade-sidebar-lessons__empty">Nenhuma aula encontrada.</p>') +
                '</div>' +
            '</div>'
        );
    }

    function renderSidebarAulas() {
        var modules = getSidebarModules();

        if (!modules.length) {
            moduleList.innerHTML = '<p class="comunidade-sidebar-lessons__empty">Nenhum conteúdo encontrado.</p>';
            return;
        }

        moduleList.innerHTML = modules.map(function (moduleItem) {
            var moduleIndex = state.modules.findIndex(function (item) {
                return item.id === moduleItem.id;
            });

            return renderSidebarModule(moduleItem, moduleIndex);
        }).join('');

        moduleList.querySelectorAll('[data-module-toggle]').forEach(function (button) {
            button.addEventListener('click', function () {
                toggleSidebarModule(button.getAttribute('data-module-toggle'));
            });
        });

        moduleList.querySelectorAll('[data-aula-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                showLessonView(
                    button.getAttribute('data-module-id'),
                    button.getAttribute('data-aula-id')
                );
                closeSidebar();
            });
        });

        updateNavButtons();
    }

    function openModule(moduleId) {
        showModuleAulasView(moduleId);
    }

    function openAula(aulaId) {
        if (!state.activeModuleId) {
            return;
        }

        showLessonView(state.activeModuleId, aulaId);
    }

    function selectAula(aulaId, syncUrl) {
        if (syncUrl === undefined) {
            syncUrl = true;
        }

        var aulas = getActiveAulas();
        var aulaItem = aulas.find(function (item) {
            return item.id === aulaId;
        });

        if (!aulaItem) {
            if (aulas.length) {
                selectAula(aulas[0].id, syncUrl);
            }

            return;
        }

        state.activeAulaId = aulaId;

        if (syncUrl) {
            updateUrl();
        }

        renderSidebarAulas();

        var moduleItem = getActiveModule();
        var isLessonChromeLayout = renderLessonHeaderChrome(aulaItem, moduleItem);

        if (!isLessonChromeLayout) {
            lessonTitle.textContent = aulaItem.title;
        }

        var surpresaMeta = getSurpresaLessonMeta(aulaItem, moduleItem);
        var leituraMeta = getLeituraRapidaLessonMeta(aulaItem, moduleItem);
        var memoriaMeta = getMemoriaTrabalhoLessonMeta(aulaItem, moduleItem);

        if (surpresaMeta && surpresaMeta.intro) {
            renderInstructions(surpresaMeta.intro);
        } else if (leituraMeta && leituraMeta.intro) {
            renderInstructions(leituraMeta.intro);
        } else if (memoriaMeta && memoriaMeta.intro) {
            renderInstructions(memoriaMeta.intro);
        } else if (aulaItem.audio_path && aulaItem.description) {
            renderInstructions(aulaItem.description);
            if (!isLessonChromeLayout) {
                lessonDescription.textContent = 'Ouve o áudio completo e segue as instruções acima.';
            }
        } else if (!isLessonChromeLayout) {
            renderInstructions('');
            lessonDescription.textContent = aulaItem.description || (aulaItem.type === 'video'
                ? 'Assiste a esta aula em vídeo.'
                : 'Descarrega o material em PDF.');
        } else {
            var orderBumpConfig = ORDER_BUMP_LESSON_CHROME[productId];

            if (orderBumpConfig && orderBumpConfig.intro) {
                renderInstructions(orderBumpConfig.intro);
            } else {
                renderInstructions('');
            }
        }

        if (window.ComunidadeWelcomeSurvey && window.ComunidadeWelcomeSurvey.isSurveyLesson(aulaItem)) {
            renderInstructions('');

            if (lessonPlayerWrap) {
                lessonPlayerWrap.hidden = true;
            }

            lessonMaterials.hidden = true;
            materialsList.innerHTML = '';

            if (window.ComunidadeGeniusTest) {
                window.ComunidadeGeniusTest.unmount(lessonSurvey);
            }

            window.ComunidadeWelcomeSurvey.mount(lessonSurvey, {
                productId: productId,
                moduleId: aulaItem.id,
                previewMode: state.isAdmin,
            });

            markContentViewed(aulaItem.id);
            return;
        }

        if (window.ComunidadeGeniusTest && window.ComunidadeGeniusTest.isGeniusTestLesson(aulaItem)) {
            renderInstructions('');

            if (lessonPlayerWrap) {
                lessonPlayerWrap.hidden = true;
            }

            lessonMaterials.hidden = true;
            materialsList.innerHTML = '';

            if (window.ComunidadeWelcomeSurvey) {
                window.ComunidadeWelcomeSurvey.unmount(lessonSurvey);
            }

            window.ComunidadeGeniusTest.mount(lessonSurvey, {
                productId: productId,
                moduleId: aulaItem.id,
                previewMode: state.isAdmin,
                onComplete: function () {
                    markContentViewed(aulaItem.id);
                },
            });

            return;
        }

        if (isAulaLocked(aulaItem)) {
            renderLockedPlayer(aulaItem);

            if (!isLessonChromeLayout) {
                lessonDescription.textContent = aulaItem.description || 'Material complementar do método.';
            }

            return;
        }

        if (lessonSurvey) {
            unmountLessonSurveys();
        }

        if (lessonPlayerWrap) {
            lessonPlayerWrap.hidden = false;
        }

        renderMaterials(aulaItem);

        if (aulaItem.youtube_id || aulaItem.video_path) {
            renderVideoPlayer(aulaItem);
            markContentViewed(aulaItem.id);
            return;
        }

        if (aulaItem.audio_path) {
            renderAudioPlayer(aulaItem);
            markContentViewed(aulaItem.id);
            return;
        }

        if (aulaItem.pdf_path) {
            renderPdfViewer(aulaItem);
            markContentViewed(aulaItem.id);
            return;
        }

        if (leituraMeta && leituraMeta.worksheets && leituraMeta.worksheets.length) {
            renderLeituraRapidaWorksheets(leituraMeta.worksheets);
            markContentViewed(aulaItem.id);
            return;
        }

        contentPlayer.className = 'comunidade-player comunidade-player--empty';
        contentPlayer.textContent = aulaItem.type === 'video'
            ? 'Vídeo em breve — estamos a preparar esta aula.'
            : 'Material em breve.';

        markContentViewed(aulaItem.id);
    }

    function navigateAula(direction) {
        var index = getActiveAulaIndex();
        var aulas = getActiveAulas();

        if (index < 0) {
            return;
        }

        var nextIndex = index + direction;

        if (nextIndex < 0 || nextIndex >= aulas.length) {
            return;
        }

        selectAula(aulas[nextIndex].id);
    }

    function showCommentsError(message) {
        commentsError.hidden = false;
        commentsError.textContent = message;
    }

    function clearCommentsError() {
        commentsError.hidden = true;
        commentsError.textContent = '';
    }

    function buildCommentTree(comments) {
        var roots = comments.filter(function (comment) {
            return !comment.parent_id;
        });

        return roots.map(function (comment) {
            var replies = comments.filter(function (item) {
                return item.parent_id === comment.id;
            });

            return { comment: comment, replies: replies };
        });
    }

    function renderComment(comment, isReply) {
        var adminActions = '';

        if (state.isAdmin) {
            adminActions = '<div class="comunidade-comment__actions">' +
                (!comment.is_admin ?
                    '<button type="button" class="comunidade-btn comunidade-btn--light" data-reply-id="' + comment.id + '">Responder</button>' :
                    '') +
                '<button type="button" class="comunidade-btn comunidade-btn--danger" data-delete-id="' + comment.id + '">Eliminar</button>' +
            '</div>';
        }

        return (
            '<article class="comunidade-comment' + (comment.is_admin ? ' is-admin' : '') + (isReply ? ' comunidade-comment__reply' : '') + '">' +
                '<div class="comunidade-comment__head">' +
                    '<span class="comunidade-comment__author">' + escapeHtml(comment.author_name) + (comment.is_admin ? ' · Suporte' : '') + '</span>' +
                    '<span class="comunidade-comment__date">' + escapeHtml(formatDate(comment.created_at)) + '</span>' +
                '</div>' +
                '<div class="comunidade-comment__content">' + escapeHtml(comment.content) + '</div>' +
                adminActions +
            '</article>'
        );
    }

    function renderComments() {
        var tree = buildCommentTree(state.comments);

        if (!tree.length) {
            commentsList.innerHTML = '<p class="comunidade-panel__subtitle" style="margin:0;">Ainda não há comentários neste produto. Sê o primeiro(a).</p>';
            return;
        }

        commentsList.innerHTML = tree.map(function (group) {
            return (
                '<div>' +
                    renderComment(group.comment, false) +
                    group.replies.map(function (reply) {
                        return renderComment(reply, true);
                    }).join('') +
                '</div>'
            );
        }).join('');

        commentsList.querySelectorAll('[data-reply-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                state.replyToId = button.getAttribute('data-reply-id');
                commentContent.placeholder = 'Resposta de suporte…';
                commentContent.focus();
            });
        });

        commentsList.querySelectorAll('[data-delete-id]').forEach(function (button) {
            button.addEventListener('click', async function () {
                var commentId = button.getAttribute('data-delete-id');

                if (!commentId) {
                    return;
                }

                if (!window.confirm('Eliminar este comentário? Esta acção não pode ser desfeita.')) {
                    return;
                }

                clearCommentsError();
                button.disabled = true;

                var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/comments', {
                    method: 'DELETE',
                    body: JSON.stringify({ id: commentId }),
                });

                var data = await response.json();

                if (!response.ok) {
                    button.disabled = false;
                    showCommentsError(data.error || 'Não foi possível eliminar o comentário.');
                    return;
                }

                if (state.replyToId === commentId) {
                    state.replyToId = null;
                    commentContent.placeholder = 'Escreve um comentário ou resposta de suporte…';
                }

                await loadComments();
            });
        });
    }

    async function loadComments() {
        var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/comments?product_id=' + encodeURIComponent(productId));
        var data = await response.json();

        if (!response.ok) {
            showCommentsError(data.error || 'Erro ao carregar comentários.');
            return;
        }

        state.comments = data.comments || [];
        renderComments();
    }

    function resolveInitialView() {
        if (moduleParam) {
            var moduleItem = getModuleById(moduleParam);

            if (!moduleItem) {
                showModuleGridView();
                return;
            }

            if (aulaParam) {
                showLessonView(moduleParam, aulaParam);
                return;
            }

            showModuleAulasView(moduleParam);
            return;
        }

        if (hasModuleGrid()) {
            showModuleGridView();
            return;
        }

        var onlyModule = state.modules[0];

        if (onlyModule) {
            showModuleAulasView(onlyModule.id);
        }
    }

    async function loadProduct() {
        if (!productId) {
            window.location.href = '/comunidade';
            return;
        }

        var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/product?id=' + encodeURIComponent(productId));
        var data = await response.json();

        if (!response.ok) {
            lessonTitle.textContent = data.error || 'Produto indisponível';
            return;
        }

        state.product = data.product;
        state.modules = data.product.modules || [];
        document.title = data.product.name + ' — Comunidade Onda Prodígio';

        await loadProgress();
        resolveInitialView();
    }

    async function boot() {
        var session = await window.ComunidadeAuth.requireAuth();

        if (!session) {
            return;
        }

        var meResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/me');
        var meData = await meResponse.json();

        if (meResponse.ok) {
            state.isAdmin = meData.role === 'admin';

            if (state.isAdmin) {
                topbarUser.textContent = (meData.name || 'Admin') + ' · Admin';
                topbarUser.title = meData.email || '';
                commentContent.placeholder = 'Escreve um comentário ou resposta de suporte…';

                var adminSurveyLink = document.getElementById('admin-survey-link');
                if (adminSurveyLink) {
                    adminSurveyLink.hidden = false;
                }
            } else {
                topbarUser.textContent = meData.name ? meData.name + ' · ' + meData.email : meData.email;
                topbarUser.title = '';
            }

            if (window.ComunidadeTheme && window.ComunidadeTheme.syncTopbarHeight) {
                window.ComunidadeTheme.syncTopbarHeight();
            }
        }

        await loadProduct();
        await loadComments();
    }

    btnPrev.addEventListener('click', function () {
        navigateAula(-1);
    });

    btnNext.addEventListener('click', function () {
        navigateAula(1);
    });

    btnList.addEventListener('click', function () {
        var moduleItem = getActiveModule();

        if (moduleItem && moduleHasAulas(moduleItem)) {
            showModuleAulasView(state.activeModuleId);
            return;
        }

        if (hasModuleGrid()) {
            showModuleGridView();
            return;
        }

        openSidebar();
    });

    btnBackModules.addEventListener('click', function () {
        if (state.activeModuleId && moduleHasAulas(getActiveModule())) {
            showModuleAulasView(state.activeModuleId);
            return;
        }

        showModuleGridView();
    });

    btnBackFromAulas.addEventListener('click', showModuleGridView);
    btnToggleSidebar.addEventListener('click', openSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    if (btnCompleteLesson) {
        btnCompleteLesson.addEventListener('click', async function () {
            var aulaItem = getActiveAula();

            if (!aulaItem || isItemComplete(aulaItem.id)) {
                return;
            }

            await markContentViewed(aulaItem.id);
            updateCompleteButton(aulaItem);
        });
    }

    moduleSearch.addEventListener('input', function () {
        state.searchQuery = moduleSearch.value;
        renderModuleGrid();
    });

    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', function () {
            state.sidebarSearchQuery = sidebarSearch.value;
            renderSidebarAulas();
        });
    }

    commentForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        clearCommentsError();

        var content = commentContent.value.trim();

        if (content.length < 2) {
            showCommentsError('Comentário demasiado curto.');
            return;
        }

        var payload = {
            product_id: productId,
            module_id: state.activeAulaId || state.activeModuleId,
            content: content,
        };

        if (state.isAdmin && state.replyToId) {
            payload.parent_id = state.replyToId;
            payload.admin_reply = true;
        } else if (state.isAdmin && content.indexOf('[resposta]') === 0) {
            payload.admin_reply = true;
            payload.content = content.replace(/^\[resposta\]\s*/i, '');
        }

        var response = await window.ComunidadeAuth.apiFetch('/api/comunidade/comments', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        var data = await response.json();

        if (!response.ok) {
            showCommentsError(data.error || 'Não foi possível publicar.');
            return;
        }

        commentContent.value = '';
        state.replyToId = null;
        commentContent.placeholder = state.isAdmin ? 'Escreve um comentário ou resposta de suporte…' : 'Escreve aqui…';
        await loadComments();
    });

    document.getElementById('btn-logout').addEventListener('click', function () {
        window.ComunidadeAuth.signOut();
    });

    boot();
})();
