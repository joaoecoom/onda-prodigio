(function () {
    var TOKEN_KEY = 'onda-adm-token';

    var loginSection = document.getElementById('adm-login');
    var dashboardSection = document.getElementById('adm-dashboard');
    var loginForm = document.getElementById('adm-login-form');
    var passwordInput = document.getElementById('adm-password');
    var loginError = document.getElementById('adm-login-error');
    var statusBox = document.getElementById('adm-status');
    var membersBody = document.getElementById('adm-members-body');
    var generatedAt = document.getElementById('adm-generated-at');
    var summaryText = document.getElementById('adm-summary-text');
    var searchInput = document.getElementById('adm-search');
    var refreshButton = document.getElementById('adm-refresh');
    var resendNeverLoggedInButton = document.getElementById('adm-resend-never-logged-in');
    var logoutButton = document.getElementById('adm-logout');
    var addForm = document.getElementById('adm-add-form');
    var addEmailInput = document.getElementById('adm-add-email');
    var addNameInput = document.getElementById('adm-add-name');
    var addProductsRoot = document.getElementById('adm-add-products');
    var addSendEmailInput = document.getElementById('adm-add-send-email');
    var addSubmitButton = document.getElementById('adm-add-submit');

    var latestPayload = null;
    var searchTerm = '';

    function getToken() {
        return window.sessionStorage.getItem(TOKEN_KEY) || '';
    }

    function setToken(token) {
        if (token) {
            window.sessionStorage.setItem(TOKEN_KEY, token);
        } else {
            window.sessionStorage.removeItem(TOKEN_KEY);
        }
    }

    function showLogin() {
        loginSection.hidden = false;
        dashboardSection.hidden = true;
    }

    function showDashboard() {
        loginSection.hidden = true;
        dashboardSection.hidden = false;
    }

    function setStatus(message, isError) {
        if (!message) {
            statusBox.hidden = true;
            statusBox.textContent = '';
            statusBox.classList.remove('metrics-status--error');
            return;
        }

        statusBox.hidden = false;
        statusBox.textContent = message;
        statusBox.classList.toggle('metrics-status--error', Boolean(isError));
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(value) {
        if (!value) {
            return '—';
        }

        try {
            return new Intl.DateTimeFormat('pt-PT', {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'Europe/Lisbon',
            }).format(new Date(value));
        } catch (error) {
            return value;
        }
    }

    function formatMoney(value) {
        if (value == null || Number.isNaN(Number(value))) {
            return '—';
        }

        return '€' + Number(value).toFixed(2);
    }

    function renderWhatsAppCell(member) {
        if (member.whatsapp_sent) {
            return (
                '<span class="adm-wa-badge adm-wa-badge--ok" title="WhatsApp enviado">✅ Enviado</span>' +
                '<div class="adm-muted">' + escapeHtml(formatDate(member.whatsapp_sent_at)) + '</div>'
            );
        }

        if (!member.phone && !member.whatsapp_phone) {
            return '<span class="adm-wa-badge adm-wa-badge--muted" title="Sem telemóvel na conta">— Sem tel.</span>';
        }

        if (member.whatsapp_eligible) {
            return '<span class="adm-wa-badge adm-wa-badge--fail" title="Compra com telefone mas WhatsApp não registado">❌ Não enviado</span>';
        }

        return '<span class="adm-wa-badge adm-wa-badge--muted" title="Conta manual ou sem compra Stripe">—</span>';
    }

    async function fetchJson(path, options) {
        var token = getToken();
        var config = Object.assign({
            headers: {
                Authorization: 'Bearer ' + token,
            },
        }, options || {});

        if (config.body && !config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
        }

        var response = await fetch(path, config);
        var data = await response.json();

        if (response.status === 401) {
            setToken('');
            showLogin();
            loginError.hidden = false;
            loginError.textContent = 'Sessão expirada. Introduz a palavra-passe outra vez.';
            return null;
        }

        if (!response.ok) {
            throw new Error(data.error || 'Pedido falhou.');
        }

        return data;
    }

    function buildProductOptions(products, memberProductIds) {
        return (products || []).map(function (product) {
            var owned = memberProductIds.indexOf(product.id) !== -1;
            var label = owned ? (product.name + ' ✓') : product.name;
            return '<option value="' + escapeHtml(product.id) + '">' + escapeHtml(label) + '</option>';
        }).join('');
    }

    function renderAddProductCheckboxes() {
        var products = (latestPayload && latestPayload.products) || [];

        if (!products.length) {
            addProductsRoot.innerHTML = '<p class="adm-muted">A carregar produtos…</p>';
            return;
        }

        addProductsRoot.innerHTML = products.map(function (product) {
            var checked = product.id === 'onda-prodigio' ? ' checked' : '';

            return (
                '<label class="adm-product-check">' +
                    '<input type="checkbox" name="adm-add-product" value="' + escapeHtml(product.id) + '"' + checked + '>' +
                    '<span>' + escapeHtml(product.name) + '</span>' +
                '</label>'
            );
        }).join('');
    }

    function getSelectedAddProductIds() {
        return Array.prototype.slice.call(
            addProductsRoot.querySelectorAll('input[name="adm-add-product"]:checked')
        ).map(function (input) {
            return input.value;
        });
    }

    function resetAddForm() {
        addForm.reset();
        addSendEmailInput.checked = true;
        renderAddProductCheckboxes();
    }

    function renderMembers() {
        if (!latestPayload) {
            membersBody.innerHTML = '';
            return;
        }

        var members = latestPayload.members || [];
        var products = latestPayload.products || [];
        var needle = searchTerm.trim().toLowerCase();

        if (needle) {
            members = members.filter(function (member) {
                return (
                    String(member.email || '').toLowerCase().indexOf(needle) !== -1 ||
                    String(member.full_name || '').toLowerCase().indexOf(needle) !== -1
                );
            });
        }

        if (!members.length) {
            membersBody.innerHTML = '<tr><td colspan="9" class="adm-muted">Nenhum membro encontrado.</td></tr>';
            return;
        }

        membersBody.innerHTML = members.map(function (member) {
            var memberProductIds = (member.products || []).map(function (item) {
                return item.product_id;
            });

            var productsHtml = (member.products || []).map(function (item) {
                return '<span class="adm-product-tag">' + escapeHtml(item.product_name) + '</span>';
            }).join('') || '<span class="adm-muted">—</span>';

            return (
                '<tr data-member-id="' + escapeHtml(member.id) + '">' +
                    '<td>' +
                        '<strong>' + escapeHtml(member.email) + '</strong>' +
                        (member.password_set ? '' : '<div class="adm-muted">Password pendente</div>') +
                    '</td>' +
                    '<td>' + escapeHtml(member.full_name || '—') + '</td>' +
                    '<td><div class="adm-products">' + productsHtml + '</div></td>' +
                    '<td>' + formatMoney(member.total_paid_eur) + '</td>' +
                    '<td><span class="adm-progress">' + escapeHtml(String(member.progress_percent || 0)) + '%</span></td>' +
                    '<td>' + escapeHtml(String(member.login_count != null ? member.login_count : '—')) + '</td>' +
                    '<td>' + renderWhatsAppCell(member) + '</td>' +
                    '<td>' + escapeHtml(formatDate(member.last_login_at)) + '</td>' +
                    '<td>' +
                        '<div class="adm-actions">' +
                            '<select class="metrics-login__input adm-grant-select" data-member-id="' + escapeHtml(member.id) + '">' +
                                '<option value="">Dar acesso…</option>' +
                                buildProductOptions(products, memberProductIds) +
                            '</select>' +
                            '<button class="metrics-button metrics-button--ghost adm-revoke-btn" type="button" data-member-id="' + escapeHtml(member.id) + '">Remover produto</button>' +
                            '<button class="metrics-button metrics-button--ghost adm-resend-btn" type="button" data-member-id="' + escapeHtml(member.id) + '">Reenviar email</button>' +
                        '</div>' +
                    '</td>' +
                '</tr>'
            );
        }).join('');
    }

    async function loadMembers() {
        setStatus('A carregar membros…', false);

        var data = await fetchJson('/api/sales-attribution?action=admin_members');

        if (!data) {
            return;
        }

        latestPayload = data;
        generatedAt.textContent = 'Actualizado: ' + formatDate(data.generated_at);
        summaryText.textContent = data.member_count + ' membros registados na comunidade.';
        renderAddProductCheckboxes();
        renderMembers();
        setStatus('', false);
    }

    async function createMember(event) {
        event.preventDefault();

        var email = addEmailInput.value.trim().toLowerCase();
        var fullName = addNameInput.value.trim();
        var productIds = getSelectedAddProductIds();
        var sendEmail = addSendEmailInput.checked;

        if (!email) {
            setStatus('Introduz o email do membro.', true);
            return;
        }

        if (!productIds.length) {
            setStatus('Selecciona pelo menos um produto.', true);
            return;
        }

        addSubmitButton.disabled = true;
        setStatus('A criar membro…', false);

        try {
            var result = await fetchJson('/api/sales-attribution?action=admin_create_member', {
                method: 'POST',
                body: JSON.stringify({
                    email: email,
                    full_name: fullName,
                    product_ids: productIds,
                    send_email: sendEmail,
                }),
            });

            resetAddForm();
            setStatus(
                'Membro criado: ' + result.email + (result.email_sent ? ' — email enviado.' : ' — sem email.'),
                false
            );
            await loadMembers();
        } catch (error) {
            setStatus(error.message || 'Não foi possível criar o membro.', true);
        } finally {
            addSubmitButton.disabled = false;
        }
    }

    async function grantProduct(memberId, productId) {
        setStatus('A conceder acesso…', false);

        await fetchJson('/api/sales-attribution?action=admin_grant', {
            method: 'POST',
            body: JSON.stringify({
                member_id: memberId,
                product_id: productId,
            }),
        });

        setStatus('Acesso concedido.', false);
        await loadMembers();
    }

    async function revokeProduct(memberId) {
        var select = document.querySelector('.adm-grant-select[data-member-id="' + memberId + '"]');
        var productId = select ? select.value : '';

        if (!productId) {
            var member = (latestPayload.members || []).find(function (item) {
                return item.id === memberId;
            });
            var names = (member && member.products || []).map(function (item, index) {
                return (index + 1) + '. ' + item.product_name + ' (' + item.product_id + ')';
            }).join('\n');
            productId = window.prompt('Qual o product_id a remover?\n\n' + (names || 'Sem produtos'));

            if (!productId) {
                return;
            }
        }

        if (!window.confirm('Remover acesso a "' + productId + '"?')) {
            return;
        }

        setStatus('A remover acesso…', false);

        await fetchJson('/api/sales-attribution?action=admin_revoke', {
            method: 'POST',
            body: JSON.stringify({
                member_id: memberId,
                product_id: productId,
            }),
        });

        setStatus('Acesso removido.', false);
        await loadMembers();
    }

    async function resendEmail(memberId) {
        if (!window.confirm('Reenviar email de acesso? Será gerada uma nova password provisória.')) {
            return;
        }

        setStatus('A enviar email…', false);

        var result = await fetchJson('/api/sales-attribution?action=admin_resend_email', {
            method: 'POST',
            body: JSON.stringify({
                member_id: memberId,
            }),
        });

        setStatus('Email enviado para ' + (result.email || 'membro') + '.', false);
        await loadMembers();
    }

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        var password = passwordInput.value.trim();

        if (!password) {
            return;
        }

        loginError.hidden = true;
        setToken(password);
        showDashboard();

        try {
            await loadMembers();
        } catch (error) {
            setStatus(error.message || 'Erro de ligação.', true);
        }
    });

    searchInput.addEventListener('input', function () {
        searchTerm = searchInput.value;
        renderMembers();
    });

    refreshButton.addEventListener('click', function () {
        loadMembers().catch(function (error) {
            setStatus(error.message || 'Erro de ligação.', true);
        });
    });

    if (resendNeverLoggedInButton) {
        resendNeverLoggedInButton.addEventListener('click', function () {
            if (!window.confirm('Reenviar credenciais a todos os membros que ainda nunca entraram?')) {
                return;
            }

            resendNeverLoggedInButton.disabled = true;
            setStatus('A reenviar emails…', false);

            fetchJson('/api/sales-attribution?action=admin_resend_never_logged_in', {
                method: 'POST',
                body: JSON.stringify({ retroactive: true }),
            }).then(function (result) {
                setStatus(
                    'Reenviados: ' + result.sent_count + '/' + result.target_count +
                    (result.failed_count ? ' · Falhados: ' + result.failed_count : ''),
                    Boolean(result.failed_count)
                );
                return loadMembers();
            }).catch(function (error) {
                setStatus(error.message || 'Não foi possível reenviar em massa.', true);
            }).finally(function () {
                resendNeverLoggedInButton.disabled = false;
            });
        });
    }

    logoutButton.addEventListener('click', function () {
        setToken('');
        passwordInput.value = '';
        showLogin();
    });

    addForm.addEventListener('submit', function (event) {
        createMember(event).catch(function (error) {
            setStatus(error.message || 'Não foi possível criar o membro.', true);
        });
    });

    membersBody.addEventListener('change', function (event) {
        var select = event.target.closest('.adm-grant-select');

        if (!select || !select.value) {
            return;
        }

        var memberId = select.getAttribute('data-member-id');
        var productId = select.value;
        select.value = '';

        grantProduct(memberId, productId).catch(function (error) {
            setStatus(error.message || 'Não foi possível conceder acesso.', true);
        });
    });

    membersBody.addEventListener('click', function (event) {
        var resendBtn = event.target.closest('.adm-resend-btn');
        var revokeBtn = event.target.closest('.adm-revoke-btn');

        if (resendBtn) {
            resendEmail(resendBtn.getAttribute('data-member-id')).catch(function (error) {
                setStatus(error.message || 'Não foi possível reenviar email.', true);
            });
            return;
        }

        if (revokeBtn) {
            revokeProduct(revokeBtn.getAttribute('data-member-id')).catch(function (error) {
                setStatus(error.message || 'Não foi possível remover acesso.', true);
            });
        }
    });

    if (getToken()) {
        showDashboard();
        loadMembers().catch(function (error) {
            setStatus(error.message || 'Erro de ligação.', true);
        });
    }
})();
