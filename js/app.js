/* =====================================================================
           GentaAlert — pop-up bergaya SweetAlert (dialog + toast)
           Mengikuti tema Gelap/Cerah lewat variabel CSS GentaDash dan selalu
           menampilkan logo Genta (sumber gambar sama persis dengan header).
           ---------------------------------------------------------------
           GentaAlert.fire({ icon, title, text, confirmButtonText, ... })  -> Promise
           GentaAlert.confirm({ title, text, danger })                      -> Promise<boolean>
           GentaAlert.toast({ icon, title, text, timer, key })
           GentaAlert.loading(title, text) / GentaAlert.close()
           ===================================================================== */
        const GentaAlert = (function () {
            'use strict';

            const ICONS = {
                success:  '<path class="ga-draw" pathLength="1" d="M5.6 12.9l4.1 4.1L18.6 8"/>',
                error:    '<path class="ga-draw" pathLength="1" d="M7.2 7.2l9.6 9.6M16.8 7.2l-9.6 9.6"/>',
                warning:  '<path class="ga-draw" pathLength="1" d="M12 6.4v7.2"/><circle class="ga-dot" cx="12" cy="17.6" r="1.25"/>',
                info:     '<path class="ga-draw" pathLength="1" d="M12 10.8v6.8"/><circle class="ga-dot" cx="12" cy="7.3" r="1.25"/>',
                question: '<path class="ga-draw" pathLength="1" d="M9.3 9.4a2.8 2.8 0 1 1 4.1 2.5c-.9.5-1.4 1.1-1.4 2.3"/><circle class="ga-dot" cx="12" cy="17.7" r="1.25"/>'
            };
            const DEFAULTS = {
                icon: 'info', title: '', text: '', html: null,
                confirmButtonText: 'OK', cancelButtonText: 'Batal', denyButtonText: 'Tidak',
                showCancelButton: false, showDenyButton: false, showCloseButton: false,
                danger: false, allowOutsideClick: true, allowEscapeKey: true,
                timer: 0, loading: false, fields: null, input: null
            };

            const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            const mk = (tag, cls, text) => {
                const n = document.createElement(tag);
                if (cls) n.className = cls;
                if (text !== undefined && text !== null) n.textContent = text;
                return n;
            };
            // Logo diambil dari <img> header supaya selalu sama dengan logo asli (tidak diubah)
            function logoImg() {
                const h = document.querySelector('.header-center img');
                const img = mk('img', 'ga-logo');
                img.src = (h && h.getAttribute('src')) || 'GENTA.png';
                img.alt = 'Logo Genta';
                img.draggable = false;
                return img;
            }
            const iconSvg = (type) => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[type] || ICONS.info) + '</svg>';

            /* ------------------------------ DIALOG ------------------------------ */
            let current = null;
            const queue = [];
            let appRoot = null;

            function setInert(on) {
                appRoot = appRoot || document.querySelector('.container');
                if (appRoot && 'inert' in appRoot) appRoot.inert = on;
            }

            function fire(options) {
                const opts = Object.assign({}, DEFAULTS, typeof options === 'string' ? { text: options } : (options || {}));
                if (!ICONS[opts.icon]) opts.icon = 'info';
                return new Promise((resolve) => {
                    const job = { opts: opts, resolve: resolve };
                    if (current && current.opts.loading) {      // dialog "memproses" langsung digantikan hasilnya
                        close({ isDismissed: true, dismiss: 'replaced' }, true);
                        open(job);
                    } else if (current) {
                        queue.push(job);
                    } else {
                        open(job);
                    }
                });
            }

            function open(job) {
                const o = job.opts;
                const lastFocus = document.activeElement;

                const overlay = mk('div', 'ga-overlay');
                const dlg = mk('div', 'ga-dialog ga-type-' + o.icon + (o.danger ? ' ga-danger' : '') + (o.loading ? ' ga-loading' : ''));
                dlg.setAttribute('role', o.loading ? 'alertdialog' : 'dialog');
                dlg.setAttribute('aria-modal', 'true');
                dlg.tabIndex = -1;
                const uid = 'ga' + Date.now().toString(36);
                dlg.setAttribute('aria-labelledby', uid + '-t');
                dlg.setAttribute('aria-describedby', uid + '-d');
                if (o.loading) dlg.setAttribute('aria-busy', 'true');

                dlg.appendChild(mk('div', 'ga-accent'));

                if (o.showCloseButton && !o.loading) {
                    const x = mk('button', 'ga-close', '✕');
                    x.type = 'button';
                    x.setAttribute('aria-label', 'Tutup');
                    x.addEventListener('click', () => close({ isDismissed: true, dismiss: 'close' }));
                    dlg.appendChild(x);
                }

                // Logo + lencana status
                const hero = mk('div', 'ga-hero');
                const wrap = mk('div', 'ga-logo-wrap');
                wrap.appendChild(mk('span', 'ga-glow'));
                wrap.appendChild(mk('span', 'ga-ring'));
                wrap.appendChild(logoImg());
                if (!o.loading) {
                    const badge = mk('span', 'ga-badge');
                    badge.innerHTML = iconSvg(o.icon);
                    wrap.appendChild(badge);
                }
                hero.appendChild(wrap);
                dlg.appendChild(hero);

                const title = mk('h2', 'ga-title', o.title || (o.loading ? 'Memproses…' : ''));
                title.id = uid + '-t';
                if (!title.textContent) title.style.display = 'none';
                dlg.appendChild(title);

                const body = mk('div', 'ga-text');
                body.id = uid + '-d';
                if (o.html) body.innerHTML = o.html;      // hanya untuk string statis buatan sendiri
                else body.textContent = o.text || '';
                if (!o.html && !o.text) body.style.display = 'none';
                dlg.appendChild(body);

                // Kolom isian (menggantikan prompt bawaan)
                const fields = o.fields || (o.input ? [{
                    name: 'value', type: o.input, label: o.inputLabel, placeholder: o.inputPlaceholder,
                    value: o.inputValue, validator: o.inputValidator
                }] : []);
                const inputs = {};
                if (fields.length) {
                    const form = mk('form', 'ga-form');
                    form.noValidate = true;
                    fields.forEach((f, i) => {
                        const row = mk('label', 'ga-field');
                        if (f.label) row.appendChild(mk('span', 'ga-field-label', f.label));
                        const box = mk('span', 'ga-field-box');
                        const inp = document.createElement('input');
                        inp.className = 'ga-input';
                        inp.type = (f.type === 'number') ? 'number' : 'text';
                        if (f.type === 'number') { inp.inputMode = f.step && f.step < 1 ? 'decimal' : 'numeric'; inp.step = f.step || 1; }
                        if (f.min !== undefined) inp.min = f.min;
                        if (f.max !== undefined) inp.max = f.max;
                        if (f.maxLength) inp.maxLength = f.maxLength;
                        if (f.suffix) inp.classList.add('ga-has-suffix');
                        if (f.placeholder) inp.placeholder = f.placeholder;
                        if (f.value !== undefined && f.value !== null) inp.value = f.value;
                        inp.autocomplete = 'off';
                        inp.spellcheck = false;
                        inp.name = f.name;
                        inputs[f.name] = inp;
                        // Enter mengirim form (formulir tanpa tombol submit tidak melakukannya sendiri bila ada >1 kolom)
                        inp.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); confirmClick(); }
                        });
                        box.appendChild(inp);
                        if (f.suffix) box.appendChild(mk('span', 'ga-suffix', f.suffix));
                        row.appendChild(box);
                        form.appendChild(row);
                    });
                    form.addEventListener('submit', (e) => { e.preventDefault(); confirmClick(); });
                    dlg.appendChild(form);
                }
                const err = mk('div', 'ga-error');
                err.setAttribute('role', 'alert');
                dlg.appendChild(err);

                // Tombol
                let btnConfirm = null, btnCancel = null, btnDeny = null;
                if (!o.loading) {
                    const actions = mk('div', 'ga-actions');
                    if (o.showCancelButton) {
                        btnCancel = mk('button', 'ga-btn ga-cancel', o.cancelButtonText);
                        btnCancel.type = 'button';
                        btnCancel.addEventListener('click', () => close({ isDismissed: true, dismiss: 'cancel' }));
                        actions.appendChild(btnCancel);
                    }
                    if (o.showDenyButton) {
                        btnDeny = mk('button', 'ga-btn ga-deny', o.denyButtonText);
                        btnDeny.type = 'button';
                        btnDeny.addEventListener('click', () => close({ isDenied: true }));
                        actions.appendChild(btnDeny);
                    }
                    btnConfirm = mk('button', 'ga-btn ga-confirm', o.confirmButtonText);
                    btnConfirm.type = 'button';
                    btnConfirm.addEventListener('click', confirmClick);
                    actions.appendChild(btnConfirm);
                    dlg.appendChild(actions);
                }

                if (o.timer > 0) {
                    const bar = mk('div', 'ga-timer');
                    const fill = mk('i');
                    fill.style.animationDuration = o.timer + 'ms';
                    bar.appendChild(fill);
                    dlg.appendChild(bar);
                }

                overlay.appendChild(dlg);

                function confirmClick() {
                    if (!fields.length) { close({ isConfirmed: true }); return; }
                    const values = {};
                    for (let i = 0; i < fields.length; i++) {
                        const f = fields[i], inp = inputs[f.name];
                        const raw = inp.value.trim();
                        const label = f.label || 'Kolom';
                        let msg = '';
                        if (raw === '' && f.required !== false) msg = label + ' wajib diisi.';
                        else if (f.type === 'number' && raw !== '') {
                            const n = Number(raw);
                            if (!Number.isFinite(n) || (f.integer !== false && !Number.isInteger(n))) msg = label + ' harus berupa angka bulat.';
                            else if (f.min !== undefined && n < f.min) msg = label + ' minimal ' + f.min + '.';
                            else if (f.max !== undefined && n > f.max) msg = label + ' maksimal ' + f.max + '.';
                        }
                        if (!msg && f.validator) msg = f.validator(raw) || '';
                        if (msg) { showError(msg, inp); return; }
                        values[f.name] = (f.type === 'number' && raw !== '') ? Number(raw) : raw;
                    }
                    close({ isConfirmed: true, value: values[fields[0].name], values: values });
                }
                function showError(msg, inp) {
                    err.textContent = msg;
                    err.classList.add('show');
                    Object.keys(inputs).forEach((k) => inputs[k].removeAttribute('aria-invalid'));
                    if (inp) { inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
                    dlg.classList.remove('ga-shake');
                    void dlg.offsetWidth;
                    dlg.classList.add('ga-shake');
                }

                const onOverlayDown = (e) => {
                    if (e.target === overlay && o.allowOutsideClick && !o.loading) close({ isDismissed: true, dismiss: 'backdrop' });
                };
                overlay.addEventListener('pointerdown', onOverlayDown);

                // Escape + jebakan fokus (capture agar tidak ikut menutup modal grafik di belakang)
                const onKey = (e) => {
                    if (e.key === 'Escape') {
                        e.stopImmediatePropagation();
                        if (o.allowEscapeKey && !o.loading) { e.preventDefault(); close({ isDismissed: true, dismiss: 'esc' }); }
                        return;
                    }
                    if (e.key === 'Tab') {
                        const list = Array.from(dlg.querySelectorAll('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])'))
                            .filter((n) => !n.disabled && n.offsetParent !== null);
                        if (!list.length) { e.preventDefault(); dlg.focus(); return; }
                        const first = list[0], last = list[list.length - 1];
                        if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
                        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                        else if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
                    }
                };
                document.addEventListener('keydown', onKey, true);

                current = { opts: o, resolve: job.resolve, overlay: overlay, dlg: dlg, onKey: onKey, lastFocus: lastFocus, timer: null };

                setInert(true);
                document.body.appendChild(overlay);
                if (reduceMotion()) overlay.classList.add('ga-instant');

                // Fokus awal: kolom pertama, lalu tombol utama
                const firstInput = fields.length ? inputs[fields[0].name] : null;
                const target = firstInput || (o.showCancelButton && o.focusCancel ? btnCancel : btnConfirm) || dlg;
                setTimeout(() => { try { target.focus({ preventScroll: true }); if (firstInput) firstInput.select(); } catch (e) { /* abaikan */ } }, 30);

                if (o.timer > 0) current.timer = setTimeout(() => close({ isDismissed: true, dismiss: 'timer' }), o.timer);
            }

            function close(result, instant) {
                if (!current) return;
                const c = current;
                current = null;
                clearTimeout(c.timer);
                document.removeEventListener('keydown', c.onKey, true);
                const res = Object.assign({ isConfirmed: false, isDenied: false, isDismissed: false }, result || {});
                if (res.isConfirmed || res.isDenied) res.isDismissed = false;

                const finish = () => {
                    if (c.overlay.parentNode) c.overlay.parentNode.removeChild(c.overlay);
                    if (!current) {
                        setInert(false);
                        if (c.lastFocus && document.contains(c.lastFocus) && typeof c.lastFocus.focus === 'function') {
                            try { c.lastFocus.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
                        }
                    }
                    c.resolve(res);
                    if (!current && queue.length) open(queue.shift());
                };
                if (instant || reduceMotion()) { finish(); return; }
                c.overlay.classList.add('ga-out');
                setTimeout(finish, 170);
            }

            const confirmDialog = (o) => fire(Object.assign({ icon: 'question', showCancelButton: true, confirmButtonText: 'Ya', cancelButtonText: 'Batal' }, typeof o === 'string' ? { text: o } : o))
                .then((r) => !!r.isConfirmed);

            /* ------------------------------ TOAST ------------------------------ */
            let host = null;
            function toastHost() {
                if (host && host.isConnected) return host;
                host = mk('div', 'ga-toasts');
                host.setAttribute('aria-live', 'polite');
                document.body.appendChild(host);
                return host;
            }

            function removeToast(t, instant) {
                if (!t || t._gone) return;
                t._gone = true;
                clearTimeout(t._timer);
                if (instant || reduceMotion()) { if (t.parentNode) t.parentNode.removeChild(t); return; }
                t.classList.add('ga-toast-out');
                setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 200);
            }

            function toast(options) {
                const o = Object.assign({ icon: 'info', timer: 3800, title: '', text: '', key: '' }, typeof options === 'string' ? { title: options } : (options || {}));
                if (!ICONS[o.icon]) o.icon = 'info';
                const h = toastHost();
                if (o.key) {
                    const old = h.querySelector('[data-key="' + String(o.key).replace(/"/g, '') + '"]');
                    if (old) removeToast(old, true);
                }
                const t = mk('div', 'ga-toast ga-type-' + o.icon);
                t.setAttribute('role', o.icon === 'error' ? 'alert' : 'status');
                if (o.key) t.setAttribute('data-key', o.key);

                const lw = mk('div', 'ga-toast-logo');
                lw.appendChild(logoImg());
                const badge = mk('span', 'ga-badge');
                badge.innerHTML = iconSvg(o.icon);
                lw.appendChild(badge);
                t.appendChild(lw);

                const body = mk('div', 'ga-toast-body');
                if (o.title) body.appendChild(mk('b', '', o.title));
                if (o.text) body.appendChild(mk('span', '', o.text));
                t.appendChild(body);

                const x = mk('button', 'ga-toast-x', '✕');
                x.type = 'button';
                x.setAttribute('aria-label', 'Tutup notifikasi');
                x.addEventListener('click', () => removeToast(t));
                t.appendChild(x);

                if (o.timer > 0) {
                    const bar = mk('i', 'ga-toast-bar');
                    bar.style.animationDuration = o.timer + 'ms';
                    t.appendChild(bar);
                }

                h.appendChild(t);
                while (h.children.length > 3) removeToast(h.firstElementChild, true);

                // Timer yang berhenti saat ditahan/di-hover
                let remaining = o.timer, started = 0;
                const run = () => { if (o.timer <= 0) return; started = Date.now(); clearTimeout(t._timer); t._timer = setTimeout(() => removeToast(t), Math.max(remaining, 300)); t.classList.remove('is-held'); };
                const hold = () => { if (o.timer <= 0 || t._gone) return; clearTimeout(t._timer); remaining -= Date.now() - started; t.classList.add('is-held'); };
                run();
                t.addEventListener('pointerenter', hold);
                t.addEventListener('pointerleave', () => { if (!drag) run(); });

                // Geser ke samping untuk menutup
                let drag = null;
                t.addEventListener('pointerdown', (e) => {
                    if (e.target.closest('.ga-toast-x')) return;
                    drag = { x: e.clientX, dx: 0, id: e.pointerId };
                    hold();
                    try { t.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
                    t.classList.add('is-dragging');
                });
                t.addEventListener('pointermove', (e) => {
                    if (!drag || e.pointerId !== drag.id) return;
                    drag.dx = e.clientX - drag.x;
                    t.style.transform = 'translate3d(' + drag.dx + 'px,0,0)';
                    t.style.opacity = String(Math.max(0.2, 1 - Math.abs(drag.dx) / 220));
                });
                const endDrag = () => {
                    if (!drag) return;
                    const dx = drag.dx;
                    drag = null;
                    t.classList.remove('is-dragging');
                    if (Math.abs(dx) > 70) {
                        t.style.transform = 'translate3d(' + (dx > 0 ? 400 : -400) + 'px,0,0)';
                        t.style.opacity = '0';
                        removeToast(t);
                    } else {
                        t.style.transform = '';
                        t.style.opacity = '';
                        run();
                    }
                };
                t.addEventListener('pointerup', endDrag);
                t.addEventListener('pointercancel', endDrag);

                return { close: () => removeToast(t) };
            }

            return {
                fire: fire,
                confirm: confirmDialog,
                toast: toast,
                loading: (title, text) => fire({ loading: true, icon: 'info', title: title || 'Memproses…', text: text || '', allowOutsideClick: false, allowEscapeKey: false }),
                close: () => close({ isDismissed: true, dismiss: 'api' }),
                isOpen: () => !!current,
                isLoading: () => !!(current && current.opts.loading)
            };
        })();

        // Pengaman: alert() bawaan peramban dialihkan ke GentaAlert (tidak memblokir halaman)
        window.alert = function (msg) {
            GentaAlert.fire({ icon: 'info', title: 'Pemberitahuan', text: String(msg === undefined || msg === null ? '' : msg) });
        };

        const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/14G5xLi7_v-DZzk6yyPEZGZJZFne_Lw68CbS-9MU8LME/edit?usp=sharing";
        const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx-P4cmWvDIX4vXIoQKgKhWob60DuiQB3c_DRwde-8eY4Rc1Bc7X-HDetjgTuLdMYRg/exec";

        /* ---------- Helper ---------- */
        const $ = (id) => document.getElementById(id);

        function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
        function lsSet(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* storage tidak tersedia */ } }
        function lsRemove(key) { try { localStorage.removeItem(key); } catch (e) { /* abaikan */ } }
        function loadList(key, fallback) {
            try {
                const v = JSON.parse(lsGet(key));
                return Array.isArray(v) && v.length ? v : fallback;
            } catch (e) { return fallback; }
        }
        function esc(s) {
            return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
        function toNum(v) {
            if (v === null || v === undefined || v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        }
        function validReading(n) { return n !== null && n !== 0; }

        /* ---------- State Aktuator ---------- */
        let actuatorState = {
            uvActive: false,
            uvReason: "Standby",
            spkActive: false,
            spkReason: "Standby",
            isManual: false,
            simulationActive: false
        };

        let hwUv = null;          // status UV yang dilaporkan hardware (null = belum ada)
        let lastSound = 0;        // dB terakhir
        let spkCooldownTimer = null;
        let spkRemainingSeconds = 0;
        const SPK_DURATION_SECONDS = 60;
        let simulatedNight = null;

        const TYPE_STYLE = {
            MANUSIA: { color: 'var(--blue-soft)', bg: 'var(--blue-bg)', blip: 'blip-manusia' },
            BURUNG:  { color: 'var(--wine-soft)', bg: 'var(--wine-bg)', blip: 'blip-burung' },
            HEWAN:   { color: 'var(--warn)', bg: 'var(--warn-bg)', blip: 'blip-hewan' }
        };

        function isNightMode() {
            if (simulatedNight !== null) return simulatedNight;
            const hour = new Date().getHours();
            return (hour >= 18 || hour < 6);
        }

        function toggleSimulasiMalam(e) {
            if (e) e.stopPropagation();
            simulatedNight = (simulatedNight === null) ? !isNightMode() : !simulatedNight;
            updateNightStatusUI();
            checkActuatorsSchedule();
        }

        function updateNightStatusUI() {
            const night = isNightMode();
            const btnSim = $('btnSimMalamText');
            const uvTag = $('uvScheduleTag');
            if (btnSim) btnSim.innerText = night ? "☀️ Beralih ke Siang" : "🌙 Tes Mode Malam";
            if (uvTag) {
                uvTag.innerText = night ? "🌙 Malam (Aktif)" : "☀️ Siang (Standby)";
                uvTag.style.background = night ? "var(--blue-bg)" : "var(--ov-soft)";
                uvTag.style.borderColor = night ? "var(--blue-soft)" : "var(--border-subtle)";
            }
        }

        /* ---------- Speaker (1 menit) ---------- */
        function triggerSpeaker(reason, forceReset = false, silent = false) {
            if (actuatorState.spkActive && !forceReset) {
                if (spkRemainingSeconds < 10) spkRemainingSeconds = SPK_DURATION_SECONDS;
                return;
            }
            clearInterval(spkCooldownTimer);
            spkRemainingSeconds = SPK_DURATION_SECONDS;
            actuatorState.spkActive = true;
            actuatorState.spkReason = reason || "Terdeteksi Hama • Suara Pengusir Aktif (60 detik)";
            updateSpeakerUI();
            if (!silent) sendCmd('strobo', 1);
            if (!forceReset) {
                GentaAlert.toast({
                    icon: 'warning',
                    title: 'Hama terdeteksi!',
                    text: String(actuatorState.spkReason).replace(/^[^\p{L}\p{N}]+/u, ''),
                    timer: 6000,
                    key: 'pest'
                });
            }

            spkCooldownTimer = setInterval(() => {
                spkRemainingSeconds--;
                if (spkRemainingSeconds <= 0) {
                    stopSpeaker("Standby Otomatis (Cooldown Selesai)");
                } else {
                    updateSpeakerUI();
                }
            }, 1000);
        }

        function stopSpeaker(reason, silent = false, forceSend = false) {
            const wasActive = actuatorState.spkActive;
            clearInterval(spkCooldownTimer);
            spkCooldownTimer = null;
            spkRemainingSeconds = 0;
            actuatorState.spkActive = false;
            actuatorState.spkReason = reason || "Frekuensi predator & pengacau pendengaran standby.";
            updateSpeakerUI();
            if ((wasActive || forceSend) && !silent) sendCmd('strobo', 0);
        }

        function triggerTestSpeaker1Menit(e) {
            if (e) e.stopPropagation();
            triggerSpeaker("Uji Pengetesan Suara Akustik • Cooldown 1 Menit Aktif", true);
        }

        function updateSpeakerUI() {
            const active = actuatorState.spkActive && spkRemainingSeconds > 0;
            const pct = (spkRemainingSeconds / SPK_DURATION_SECONDS) * 100;
            const mins = Math.floor(spkRemainingSeconds / 60);
            const secs = spkRemainingSeconds % 60;
            const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            $('cardSpkStatus').classList.toggle('is-active', active);
            $('cardSpkMini').classList.toggle('is-active', active);

            const pillText = active ? `AKTIF (${spkRemainingSeconds}s)` : "STANDBY";
            const pillClass = active ? "actuator-status-pill pill-on-spk" : "actuator-status-pill pill-off";
            $('badgeSpkPill').className = pillClass;
            $('badgeSpkPill').innerText = pillText;
            $('badgeSpkPillDash').className = pillClass;
            $('badgeSpkPillDash').innerText = pillText;

            $('spkCooldownTag').innerText = active ? `⏱️ ${spkRemainingSeconds}s Tersisa` : "⏱️ 60s Timer";
            $('spkCooldownBar').style.width = active ? pct + "%" : "0%";
            $('spkCooldownTimer').innerText = active ? formatted : "00:00";
            $('spkCooldownStatusLabel').innerText = active ? "🚨 Mengusir Hama" : "Siaga Hama";
            $('spkCooldownStatusLabel').style.color = active ? "var(--lime-fg)" : "var(--text-muted)";
            $('descSpkStatus').innerText = active ? actuatorState.spkReason : "Frekuensi predator & pengacau pendengaran standby.";
            $('descSpkDash').innerText = active ? `Suara Predator Aktif (${spkRemainingSeconds}s)` : "Standby Otomatis";

            // Sinkronkan toggle manual dengan status speaker sebenarnya
            const chk = $('chkStrobo');
            if (chk) chk.checked = active;
        }

        /* ---------- Chart.js ---------- */
        let chartInstance = null;
        let activeChartKey = '';
        const maxDataPoints = 20;
        let histLabels = [];
        const histKeys = ['temp', 'hum', 'vpd', 'press', 'alt', 'batt', 'current', 'power', 'sound', 'ai'];
        let histData = {};
        histKeys.forEach((k) => { histData[k] = []; });

        /* ---------- Sektor Radar ---------- */
        let sectorStates = [
            { id: 0, label: "UTARA", state: 0, md: 0, me: 0, sd: 0, se: 0, stagT: 0, obj: 0 },
            { id: 1, label: "TIMUR", state: 0, md: 0, me: 0, sd: 0, se: 0, stagT: 0, obj: 0 },
            { id: 2, label: "SELATAN", state: 0, md: 0, me: 0, sd: 0, se: 0, stagT: 0, obj: 0 },
            { id: 3, label: "BARAT", state: 0, md: 0, me: 0, sd: 0, se: 0, stagT: 0, obj: 0 }
        ];

        // Objek dengan jarak <= nilai ini (cm) diabaikan dan dianggap aman
        const BLIND_ZONE_CM = 30;

        // Klasifikasi energi radar mengikuti profil di tab Sensor (bukan angka tetap)
        function classifyEnergy(energy) {
            const sorted = [...radarProfiles].sort((a, b) => a.energy - b.energy);
            let match = null;
            sorted.forEach((p) => { if (energy >= p.energy) match = p; });
            if (!match) return null;
            if (match.exclude) return "MANUSIA";
            const l = String(match.label).toLowerCase();
            if (l.includes('burung') || l.includes('bird')) return "BURUNG";
            return "HEWAN";
        }
        function micAlarmThreshold() {
            const sorted = [...micProfiles].sort((a, b) => a.db - b.db);
            return sorted.length > 1 ? sorted[1].db : 75;
        }
        function evaluateActuators(threatType, sectorLabel, distance, soundLevel) {
            if (actuatorState.isManual) return;
            let threatLevel = "safe";
            const nightActive = isNightMode();
            let uvShouldBeActive;
            if (hwUv !== null && simulatedNight === null) uvShouldBeActive = hwUv;
            else uvShouldBeActive = nightActive;

            const uvReason = uvShouldBeActive
                ? "🌙 Jadwal Malam Aktif (18:00 - 06:00) • Fototaksis Serangga/Wereng Malam"
                : "☀️ Siang Hari • Standby (Lampu UV hanya menyala pada malam hari)";

            // Speaker: aktif 1 menit saat hama terdeteksi
            if (threatType === "MANUSIA") {
                threatLevel = "warn";
                if (actuatorState.spkActive) stopSpeaker("Bypass Keamanan (Meredam Suara untuk Petani/Manusia)");
            } else if (threatType === "BURUNG") {
                threatLevel = "high";
                triggerSpeaker(`🚨 Terdeteksi Burung di ${sectorLabel} (${distance}cm) • Suara Predator Aktif 1 Menit`, false);
            } else if (threatType === "HEWAN") {
                threatLevel = "high";
                triggerSpeaker(`🚨 Terdeteksi Tikus/Hewan di ${sectorLabel} • Frekuensi Pengacau Aktif 1 Menit`, false);
            } else if (soundLevel > micAlarmThreshold()) {
                threatLevel = "high";
                threatType = "SUARA BISING";
                triggerSpeaker(`🚨 Suara Bising Lahan (${soundLevel} dB) • Audio Repeller Triggered (1 Menit)`, false);
            } else if (actuatorState.spkActive && spkRemainingSeconds > 0) {
                threatLevel = "warn";
            }

            setActuatorState({
                uvActive: uvShouldBeActive,
                uvReason: uvReason,
                threatLevel: threatLevel,
                threatType: threatType,
                sector: sectorLabel
            });
        }

        function setActuatorState(params) {
            actuatorState.uvActive = params.uvActive;
            actuatorState.uvReason = params.uvReason;

            const uvOn = !!params.uvActive;
            $('cardUvStatus').classList.toggle('is-active', uvOn);
            $('cardUvMini').classList.toggle('is-active', uvOn);

            $('badgeUvPill').className = uvOn ? "actuator-status-pill pill-on-uv" : "actuator-status-pill pill-off";
            $('badgeUvPill').innerText = uvOn ? "AKTIF (MALAM)" : "STANDBY (SIANG)";
            $('badgeUvPillDash').className = uvOn ? "actuator-status-pill pill-on-uv" : "actuator-status-pill pill-off";
            $('badgeUvPillDash').innerText = uvOn ? "MALAM: ON" : "STANDBY";
            $('descUvStatus').innerText = params.uvReason || "Hanya menyala pada malam hari (18:00 - 06:00).";
            $('descUvDash').innerText = uvOn ? "UV Menyala (Fototaksis Malam)" : "Standby (Hanya Malam)";

            const uvTag = $('uvScheduleTag');
            uvTag.innerText = uvOn ? "🌙 Malam (Aktif)" : "☀️ Siang (Standby)";
            uvTag.style.background = uvOn ? "var(--blue-bg)" : "var(--ov-soft)";
            uvTag.style.borderColor = uvOn ? "var(--blue-soft)" : "var(--border-subtle)";

            if ($('chkUv')) $('chkUv').checked = uvOn;

            updateSpeakerUI();

            const intelBox = $('defenseIntelBox');
            const intelTitle = $('intelTitle');
            const intelDesc = $('intelDesc');
            const intelBadge = $('intelThreatBadge');
            const intelIcon = $('intelIcon');

            if (params.threatLevel === "high") {
                intelBox.className = "defense-intel-box threat-high";
                intelTitle.innerText = `Ancaman Hama: ${params.threatType || 'Target Terdeteksi'}!`;
                intelDesc.innerText = `Sektor ${params.sector && params.sector !== '-' ? params.sector : 'Lahan'} aktif. Speaker akustik berbunyi selama 1 menit (cooldown aktif).`;
                intelBadge.className = "threat-level-badge threat-danger";
                intelBadge.innerText = "BAHAYA";
                intelIcon.innerText = "⚠️";
            } else if (params.threatLevel === "warn") {
                intelBox.className = "defense-intel-box threat-medium";
                intelTitle.innerText = `Aktivitas Terpantau: ${params.threatType || 'Objek Terdeteksi'}`;
                intelDesc.innerText = params.uvReason || "Memonitor pergerakan di perimeter lahan.";
                intelBadge.className = "threat-level-badge threat-warn";
                intelBadge.innerText = "WASPADA";
                intelIcon.innerText = "👁️";
            } else {
                intelBox.className = "defense-intel-box";
                intelTitle.innerText = "Area Lahan Terlindungi";
                intelDesc.innerText = "Radar 24GHz & Mic Akustik aktif memantau pergerakan perimeter sawah.";
                intelBadge.className = "threat-level-badge threat-safe";
                intelBadge.innerText = "AMAN";
                intelIcon.innerText = "🛡️";
            }
        }

        function checkActuatorsSchedule() {
            if (actuatorState.isManual) return;
            const activeSec = sectorStates.find((s) => s.me > 0 || s.se > 0 || s.obj > 0);
            if (activeSec) updateSectorDisplay();
            else evaluateActuators("AMAN", "-", 0, lastSound);
        }


        /* ---------- Cerminkan ringkasan Dash ke halaman Farm ---------- */
        function syncFarmSummary() {
            const pairs = [
                ['valSound', 'fmSound'], ['valMicClass', 'fmMicClass'], ['valAiStatus', 'fmAi'],
                ['radState', 'fmRadState'], ['radDistS', 'fmRadDir'], ['radDistM', 'fmRadDist'],
                ['radNrgM', 'fmRadNrg'], ['radNrgS', 'fmRadNrgS']
            ];
            pairs.forEach(([src, dst]) => {
                const a = $(src), b = $(dst);
                if (!a || !b) return;
                b.innerText = a.innerText;
                if (a.style.color) b.style.color = a.style.color;
            });
        }

        /* ---------- Tampilan radar & sektor ---------- */
        function updateSectorDisplay() {
            let html = "";
            let highestEnergy = -1;
            let activeSektor = -1;
            let maxObjType = "KOSONG";
            let finalDist = 0;
            let finalNrg = 0;

            for (let i = 0; i < 4; i++) {
                const blip = $('blip' + i);
                if (blip) blip.style.display = 'none';
            }

            sectorStates.forEach((sec) => {
                let mEng = sec.me;
                const sEng = sec.se;
                const mDist = sec.md;
                const sDist = sec.sd;

                if (sEng > 0 && mEng === 0) sec.stagT += 1; else sec.stagT = 0;
                let effStat = (sec.stagT >= 6) ? 0 : sEng;
                const maxEng = Math.max(mEng, effStat);

                let objType = null;
                if (sec.obj === 3) objType = "MANUSIA";
                else if (sec.obj === 1) objType = "BURUNG";
                else if (sec.obj === 2) objType = "HEWAN";
                else objType = classifyEnergy(maxEng);

                // Jarak acuan (dihitung sebelum keputusan terdeteksi/tidak)
                let rawPos = 0;
                if (mEng > 0 && mDist > 0) rawPos = mDist;
                else if (effStat > 0 && sDist > 0) rawPos = sDist;
                else if (mDist > 0) rawPos = mDist;
                else rawPos = sDist;

                // Zona buta: objek di dalam radius 30 cm diabaikan → dianggap AMAN / tidak ada objek
                const inBlindZone = objType !== null && rawPos > 0 && rawPos <= BLIND_ZONE_CM;
                if (inBlindZone) {
                    objType = null;
                    mEng = 0;
                    effStat = 0;
                }

                const isDetected = objType !== null;
                const style = isDetected ? TYPE_STYLE[objType] : null;

                let acuanPos = 0;
                if (isDetected) {
                    acuanPos = rawPos;

                    if (activeSektor === -1 || maxEng > highestEnergy) {
                        highestEnergy = maxEng;
                        activeSektor = sec.id;
                        maxObjType = objType;
                        finalDist = acuanPos;
                        finalNrg = maxEng;
                    }

                    const blip = $('blip' + sec.id);
                    if (blip) {
                        blip.style.display = 'block';
                        blip.classList.remove('blip-manusia', 'blip-hewan', 'blip-burung');
                        blip.classList.add(style.blip);

                        const minR = (30 / 800) * 48;
                        let radiusPercent = (acuanPos / 800) * 48;
                        radiusPercent = Math.max(minR, Math.min(48, radiusPercent));

                        const angleRad = ([0, 90, 180, 270][sec.id] - 90) * (Math.PI / 180);
                        blip.style.left = (50 + radiusPercent * Math.cos(angleRad)) + "%";
                        blip.style.top = (50 + radiusPercent * Math.sin(angleRad)) + "%";
                    }
                }

                const pctDist = Math.min((acuanPos / 800) * 100, 100);
                const pctEng = Math.min(mEng, 100);
                const pctStat = Math.min(effStat, 100);
                const badgeStyle = isDetected ? `background:${style.bg}; border:1px solid ${style.color}; color:${style.color};` : '';

                html += `
                <div class="sector-row-card">
                    <div class="sector-row-header">
                        <span class="sector-tag-title"><span style="color: var(--lime-fg);">●</span> SEKTOR ${sec.label}</span>
                        <span class="sector-target-badge ${isDetected ? '' : 'badge-none'}" style="${badgeStyle}">${isDetected ? objType : (inBlindZone ? 'DIABAIKAN ≤30 CM' : 'KOSONG')}</span>
                    </div>
                    <div class="metric-progress-wrap">
                        <div class="mp-label-row"><span>Jarak Deteksi:</span><span><b style="color: var(--blue-soft);">${acuanPos}</b> cm</span></div>
                        <div class="custom-progress-track"><div class="custom-progress-fill fill-distance" style="width: ${pctDist}%;"></div></div>
                    </div>
                    <div class="metric-progress-wrap">
                        <div class="mp-label-row"><span>Energi Gerak:</span><span><b style="color: ${mEng > 40 ? 'var(--wine-soft)' : 'var(--warn)'};">${mEng}</b></span></div>
                        <div class="custom-progress-track"><div class="custom-progress-fill fill-energy" style="width: ${pctEng}%;"></div></div>
                    </div>
                    <div class="metric-progress-wrap">
                        <div class="mp-label-row"><span>Energi Diam:</span><span><b style="color: var(--warn);">${effStat}</b></span></div>
                        <div class="custom-progress-track"><div class="custom-progress-fill fill-stationary" style="width: ${pctStat}%;"></div></div>
                    </div>
                </div>`;
            });

            const box = $('radarSectorContainer');
            if (box) box.innerHTML = html;

            const statusTextEl = $('radarStatusText');
            const radStateEl = $('radState');

            if (activeSektor >= 0) {
                const sektorL = ["UTARA", "TIMUR", "SELATAN", "BARAT"][activeSektor];
                const col = TYPE_STYLE[maxObjType].color;
                statusTextEl.innerText = `🚨 TERDETEKSI ${maxObjType} DI SEKTOR ${sektorL}!`;
                statusTextEl.style.color = col;

                radStateEl.innerText = maxObjType;
                radStateEl.style.color = col;
                $('radDistM').innerText = finalDist + " cm";
                $('radDistS').innerText = sektorL;
                $('radNrgM').innerText = finalNrg;
                $('radNrgS').innerText = (maxObjType === "MANUSIA") ? "BYPASS (Petani)" : "HAMA (Aktif)";

                evaluateActuators(maxObjType, sektorL, finalDist, lastSound);
            } else {
                statusTextEl.innerText = "Scanning Sektor Lahan... (Aman)";
                statusTextEl.style.color = "var(--lime-fg)";

                radStateEl.innerText = "KOSONG";
                radStateEl.style.color = "var(--text-muted)";
                $('radDistM').innerText = "-- cm";
                $('radDistS').innerText = "--";
                $('radNrgM').innerText = "0";
                $('radNrgS').innerText = "Aman";

                evaluateActuators("AMAN", "-", 0, lastSound);
            }
            syncFarmSummary();
        }

        /* ---------- Simulasi demo ---------- */
        let simInterval = null;
        function toggleSimulasiDeteksi() {
            const btn = $('btnDemoSim');
            if (actuatorState.simulationActive) {
                actuatorState.simulationActive = false;
                clearInterval(simInterval);
                btn.innerHTML = "<span>⚡ Test Simulasi</span>";
                btn.style.borderColor = "";
                btn.style.color = "";

                sectorStates.forEach((sec) => { sec.me = 0; sec.se = 0; sec.md = 0; sec.obj = 0; sec.stagT = 0; });
                lastSound = 0;
                $('valSound').innerText = "--";
                stopSpeaker("Simulasi dihentikan");
                updateSectorDisplay();
            } else {
                actuatorState.simulationActive = true;
                btn.innerHTML = "<span>⏹ Stop Simulasi</span>";
                btn.style.borderColor = "var(--wine-soft)";
                btn.style.color = "var(--wine-soft)";

                let demoCycle = 0;
                const simSteps = [
                    { sec: 1, obj: 1, nrg: 65, dist: 240, snd: 82 },  // burung
                    { sec: 3, obj: 2, nrg: 78, dist: 150, snd: 68 },  // tikus
                    { sec: 0, obj: 3, nrg: 95, dist: 380, snd: 55 }   // petani
                ];

                const runStep = () => {
                    const step = simSteps[demoCycle % simSteps.length];
                    sectorStates.forEach((sec, idx) => {
                        const hit = idx === step.sec;
                        sec.me = hit ? step.nrg : 0;
                        sec.se = hit ? 20 : 0;
                        sec.md = hit ? step.dist : 0;
                        sec.obj = hit ? step.obj : 0;
                    });
                    lastSound = step.snd;
                    $('valSound').innerText = step.snd;
                    updateSectorDisplay();
                    demoCycle++;
                };

                runStep();
                simInterval = setInterval(runStep, 4500);
            }
        }

        /* ---------- Kontrol ---------- */
        function syncManualModeUI(isManual, notifyHardware = false) {
            actuatorState.isManual = isManual;
            if ($('chkManual')) $('chkManual').checked = isManual;

            document.querySelectorAll('.actuator').forEach((el) => {
                el.disabled = !isManual;
            });
            document.querySelectorAll('#dynamicAudioButtons button').forEach((el) => {
                el.disabled = !isManual;
            });

            if (notifyHardware) sendCmd('manual', isManual ? 1 : 0);
        }

        function toggleManualMode(isManual) {
            syncManualModeUI(isManual, true);

            if (!isManual) {
                if ($('chkUv').checked) sendCmd('uv', 0);
                stopSpeaker("Manual Override Dimatikan", false, true);
                $('chkUv').checked = false;
                checkActuatorsSchedule();
            } else {
                if (actuatorState.spkActive) stopSpeaker("Mode Manual Override Diaktifkan", false, true);
                setActuatorState({
                    uvActive: false,
                    uvReason: "Mode Manual Override Diaktifkan",
                    threatLevel: "warn",
                    threatType: "MANUAL CONTROL"
                });
            }
        }

        function handleUvManual(isChecked) {
            sendCmd('uv', isChecked ? 1 : 0);
            setActuatorState({
                uvActive: isChecked,
                uvReason: isChecked ? "Diaktifkan Manual oleh Pengguna" : "Dimatikan Manual (Siaga)",
                threatLevel: isChecked ? "warn" : "safe",
                threatType: "MANUAL CONTROL"
            });
        }

        function handleSpkManual(isChecked) {
            if (isChecked) triggerSpeaker("Diaktifkan Manual oleh Pengguna (Uji 1 Menit)", true);
            else stopSpeaker("Dimatikan Manual oleh Pengguna", false, true);
        }

        function applyNeoPixel() {
            sendCmd('neo', parseInt($('neoColorSel').value, 10));
        }

        function toggleSystemMode(isCalibrate) {
            if (isCalibrate) {
                GentaAlert.confirm({
                    icon: 'warning',
                    title: 'Masuk mode Kalibrasi?',
                    text: 'Mode Kalibrasi/Perekaman Data akan diaktifkan.\nSistem otomatis AI Fusion dihentikan sementara.',
                    confirmButtonText: 'Ya, aktifkan',
                    cancelButtonText: 'Batal'
                }).then((ok) => {
                    if (ok) {
                        sendCmd('mode', 3);
                        notifyCmd('Mode kalibrasi diminta', 'AI Fusion dihentikan sementara.', 'mode');
                    } else {
                        $('chkMode').checked = false;
                    }
                });
            } else {
                sendCmd('mode', 0);
                notifyCmd('Kembali ke mode normal', 'AI Fusion aktif kembali.', 'mode');
            }
        }

        // Toast hasil pengiriman perintah ke ESP32 (MQTT)
        function notifyCmd(okTitle, okText, key) {
            if (client.isConnected()) GentaAlert.toast({ icon: 'success', title: okTitle, text: okText, key: key });
            else GentaAlert.toast({ icon: 'warning', title: 'Perintah belum terkirim', text: 'Tidak terhubung ke ESP32 (MQTT).', key: key });
        }

        function confirmReboot() {
            GentaAlert.confirm({
                icon: 'warning',
                danger: true,
                title: 'Restart perangkat?',
                text: 'Perintah reboot dikirim ke ESP32 lewat MQTT. Koneksi akan terputus beberapa detik.',
                confirmButtonText: 'Ya, restart',
                cancelButtonText: 'Batal'
            }).then((ok) => {
                if (!ok) return;
                sendCmd('reboot', 1);
                notifyCmd('Perintah reboot terkirim', 'ESP32 akan memulai ulang.', 'reboot');
            });
        }

        /* ---------- Tema: gelap / cerah / otomatis ---------- */
        let themeMode = lsGet('themeMode') || 'dark';
        let currentTheme = 'dark';
        let chartMeta = null;
        const mqLight = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
        const CHART_LIGHT_MAP = { '#b8d94e': '#5f7d0e', '#8ba4f4': '#2a4fc7', '#ecdcae': '#8a6410', '#e0708f': '#7b1e3a' };

        function themeVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
        function chartColor(hex) { return currentTheme === 'light' ? (CHART_LIGHT_MAP[hex] || hex) : hex; }
        function resolveTheme(mode) {
            if (mode === 'auto') return (mqLight && mqLight.matches) ? 'light' : 'dark';
            return mode === 'light' ? 'light' : 'dark';
        }

        function applyChartTheme() {
            if (typeof Chart === 'undefined') return;
            Chart.defaults.color = themeVar('--text-muted');
            }

        let themeAnimTimer = null;
        function applyTheme(mode, persist = true) {
            if (!['dark', 'light', 'auto'].includes(mode)) mode = 'dark';
            if (persist) {
                document.documentElement.classList.add('theme-anim');
                clearTimeout(themeAnimTimer);
                themeAnimTimer = setTimeout(() => document.documentElement.classList.remove('theme-anim'), 400);
            }
            themeMode = mode;
            currentTheme = resolveTheme(mode);
            document.documentElement.setAttribute('data-theme', currentTheme);
            if (persist) lsSet('themeMode', mode);

            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', currentTheme === 'light' ? '#dcd5c6' : '#0d0f13');

            const btn = $('btnThemeToggle');
            if (btn) {
                btn.innerText = currentTheme === 'light' ? '🌙 Gelap' : '☀️ Cerah';
                btn.setAttribute('aria-label', currentTheme === 'light' ? 'Ganti ke mode gelap' : 'Ganti ke mode cerah');
            }
            const badge = $('themeBadge');
            if (badge) badge.innerText = (currentTheme === 'light' ? 'CERAH' : 'GELAP') + (mode === 'auto' ? ' • AUTO' : '');
            document.querySelectorAll('.theme-opt').forEach((o) => {
                const on = o.dataset.mode === mode;
                o.classList.toggle('active', on);
                o.setAttribute('aria-pressed', on ? 'true' : 'false');
            });

            applyChartTheme();
            if (activeChartKey && chartMeta) openChart(chartMeta.sensorKey, chartMeta.title, chartMeta.unit, chartMeta.colorHex);
        }

        function toggleTheme() { applyTheme(currentTheme === 'light' ? 'dark' : 'light'); }

        if (mqLight) {
            const onSystemThemeChange = () => { if (themeMode === 'auto') applyTheme('auto', false); };
            if (mqLight.addEventListener) mqLight.addEventListener('change', onSystemThemeChange);
            else if (mqLight.addListener) mqLight.addListener(onSystemThemeChange);
        }

        /* ---------- Modal grafik ---------- */
        function openChart(sensorKey, title, unit, colorHex) {
            if (typeof Chart === 'undefined') {
                GentaAlert.fire({
                    icon: 'error',
                    title: 'Grafik tidak tersedia',
                    text: 'Library grafik (Chart.js) gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.',
                    confirmButtonText: 'Muat ulang',
                    showCancelButton: true,
                    cancelButtonText: 'Tutup'
                }).then((r) => { if (r.isConfirmed) location.reload(); });
                return;
            }
            chartMeta = { sensorKey, title, unit, colorHex };
            activeChartKey = sensorKey;
            $('chartModalTitle').innerText = title;
            $('chartModal').style.display = 'flex';

            applyChartTheme();
            const color = chartColor(colorHex);
            const ctx = $('sensorChart').getContext('2d');
            if (chartInstance) chartInstance.destroy();

            const gradient = ctx.createLinearGradient(0, 0, 0, 240);
            gradient.addColorStop(0, color + '55');
            gradient.addColorStop(1, color + '05');
            const gridColor = themeVar('--border-subtle');

            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: histLabels,
                    datasets: [{
                        label: `${title} (${unit})`,
                        data: histData[sensorKey],
                        borderColor: color,
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.3,
                        spanGaps: true,
                        pointRadius: 3,
                        pointBackgroundColor: color,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: themeVar('--bg-card'),
                            titleColor: themeVar('--text-main'),
                            bodyColor: themeVar('--text-muted'),
                            borderColor: themeVar('--border-strong'),
                            borderWidth: 1,
                            padding: 8
                        }
                    },
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 6, font: { size: 9 } } },
                        y: {
                            grid: { color: gridColor },
                            ticks: { font: { size: 9 } },
                            beginAtZero: ['sound', 'current', 'power', 'ai'].includes(sensorKey)
                        }
                    }
                }
            });
        }

        function closeChart() {
            $('chartModal').style.display = 'none';
            activeChartKey = '';
            chartMeta = null;
            if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
        }

        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeChart(); });

        /* ---------- Navigasi tab + geser (swipe) antar halaman ---------- */
        const TabNav = (function () {
            'use strict';
            const tabs = Array.prototype.slice.call(document.querySelectorAll('.tab-content'));
            const nav = document.querySelector('.bottom-nav');
            const navBtns = Array.prototype.slice.call(document.querySelectorAll('.bottom-nav .nav-btn'));
            const canAnimate = typeof Element.prototype.animate === 'function';
            const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

            let index = Math.max(0, tabs.findIndex((t) => t.classList.contains('active')));
            let anims = [];
            let swallowUntil = 0;

            const COMMIT_RATIO = 0.22;      // geser > 22% lebar layar => pindah
            const FLICK_SPEED = 0.45;       // atau kibasan cepat (px/ms)
            const LOCK_PX = 10;             // jarak minimal sebelum arah ditentukan
            const EDGE_GUARD = 12;          // abaikan sentuhan di tepi layar (gestur sistem)

            if (nav) nav.style.setProperty('--nav-n', String(navBtns.length));

            function trackAnim(a) { anims.push(a); return a; }
            function cancelAnims() {
                anims.forEach((a) => { try { a.cancel(); } catch (e) { /* abaikan */ } });
                anims = [];
            }

            function setNav(pos, dragging) {
                if (!nav) return;
                nav.classList.toggle('is-dragging', !!dragging);
                nav.style.setProperty('--nav-idx', String(pos));
            }
            function markActive(idx) {
                navBtns.forEach((b, i) => {
                    b.classList.toggle('active', i === idx);
                    if (i === idx) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
                });
                setNav(idx, false);
            }

            function resetTabStyle(el) {
                if (!el) return;
                el.style.transform = '';
                el.style.opacity = '';
                el.style.transition = '';
            }

            /* Pindah ke tab ke-idx. dir: +1 (maju, masuk dari kanan) / -1 (mundur, dari kiri) */
            function go(idx, opts) {
                opts = opts || {};
                if (idx < 0 || idx >= tabs.length) return;
                cancelAnims();
                tabs.forEach(resetTabStyle);
                hidePeek();
                document.documentElement.classList.remove('is-swiping');

                if (idx === index) {                       // tab yang sama: cukup gulir ke atas
                    markActive(index);
                    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
                    return;
                }
                const dir = opts.dir || (idx > index ? 1 : -1);
                tabs.forEach((t, i) => t.classList.toggle('active', i === idx));
                index = idx;
                markActive(idx);
                window.scrollTo(0, 0);

                if (canAnimate && !reduceMotion() && !opts.instant) {
                    trackAnim(tabs[idx].animate(
                        [{ transform: 'translate3d(' + (dir * 40) + 'px,0,0)', opacity: 0 }, { transform: 'translate3d(0,0,0)', opacity: 1 }],
                        { duration: 300, easing: 'cubic-bezier(.22,.9,.3,1)' }
                    ));
                }
            }

            /* ---- petunjuk di tepi layar saat menggeser ---- */
            let peek = null, peekFor = -2;
            function ensurePeek() {
                if (peek) return peek;
                peek = document.createElement('div');
                peek.className = 'swipe-peek';
                peek.setAttribute('aria-hidden', 'true');
                peek.innerHTML = '<span class="sp-ico"></span><span class="sp-txt"></span>';
                document.body.appendChild(peek);
                return peek;
            }
            function showPeek(target, side, progress, armed) {
                const p = ensurePeek();
                if (peekFor !== target) {
                    peekFor = target;
                    const btn = navBtns[target];
                    const svg = btn ? btn.querySelector('svg') : null;
                    const label = btn ? btn.querySelector('span') : null;
                    p.querySelector('.sp-ico').innerHTML = svg ? svg.outerHTML : '';
                    p.querySelector('.sp-txt').textContent = label ? label.textContent : '';
                }
                p.dataset.side = side;
                p.style.setProperty('--sp', String(Math.max(0, Math.min(1, progress))));
                p.classList.toggle('armed', !!armed);
                p.classList.add('show');
            }
            function hidePeek() {
                if (peek) peek.classList.remove('show', 'armed');
                peekFor = -2;
            }

            /* ---- seret (drag) ---- */
            let sw = null;     // { id, x0, y0, t0, state, samples, w, dx }

            function blocked(target) {
                if (!(target instanceof Element)) return true;
                if (typeof GentaAlert !== 'undefined' && GentaAlert.isOpen()) return true;
                const cm = document.getElementById('chartModal');
                if (cm && cm.style.display === 'flex') return true;
                if (target.closest('input, select, textarea, [contenteditable="true"], [data-no-swipe], .terminal-box, .ga-overlay, .ga-toasts, .modal-overlay')) return true;
                for (let n = target; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
                    if (n.scrollWidth > n.clientWidth + 1) {
                        const ox = getComputedStyle(n).overflowX;
                        if (ox === 'auto' || ox === 'scroll') return true;     // area yang bisa digulir mendatar
                    }
                }
                return false;
            }

            function applyDrag(dx) {
                const el = tabs[index];
                const w = sw.w;
                const atFirst = index === 0, atLast = index === tabs.length - 1;
                let eff = dx;
                if ((dx > 0 && atFirst) || (dx < 0 && atLast)) eff = dx * 0.28;      // tepi: terasa menahan
                sw.eff = eff;
                el.style.transform = 'translate3d(' + eff + 'px,0,0)';
                el.style.opacity = String(1 - Math.min(Math.abs(eff) / (w * 0.85), 1) * 0.55);

                const prog = Math.max(-1, Math.min(1, -eff / w));
                setNav(index + prog * 0.9, true);

                const target = dx < 0 ? index + 1 : index - 1;
                if (target >= 0 && target < tabs.length) {
                    const armed = Math.abs(dx) > w * COMMIT_RATIO;
                    showPeek(target, dx < 0 ? 'right' : 'left', Math.abs(dx) / (w * COMMIT_RATIO), armed);
                } else hidePeek();
            }

            function onDown(e) {
                if (e.pointerType === 'mouse' || !e.isPrimary) return;
                if (e.clientX < EDGE_GUARD || e.clientX > window.innerWidth - EDGE_GUARD) return;
                if (blocked(e.target)) return;
                sw = { id: e.pointerId, x0: e.clientX, y0: e.clientY, state: 'pending', samples: [{ x: e.clientX, t: e.timeStamp }], w: Math.max(240, window.innerWidth), eff: 0 };
            }
            function onMove(e) {
                if (!sw || e.pointerId !== sw.id) return;
                const dx = e.clientX - sw.x0, dy = e.clientY - sw.y0;
                if (sw.state === 'pending') {
                    if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
                    if (Math.abs(dx) > Math.abs(dy) * 1.35) {
                        sw.state = 'drag';
                        cancelAnims();
                        document.documentElement.classList.add('is-swiping');
                        try { const sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges(); } catch (err) { /* abaikan */ }
                    } else { sw.state = 'ignore'; return; }
                }
                if (sw.state !== 'drag') return;
                sw.samples.push({ x: e.clientX, t: e.timeStamp });
                if (sw.samples.length > 8) sw.samples.shift();
                sw.dx = dx;
                applyDrag(dx);
            }
            function onUp(e) {
                if (!sw || e.pointerId !== sw.id) return;
                const s = sw;
                sw = null;
                if (s.state !== 'drag') return;
                swallowUntil = performance.now() + 350;      // jangan teruskan "klik" setelah menggeser
                finishDrag(s, e.type === 'pointercancel');
            }

            function finishDrag(s, cancelled) {
                const dx = s.dx || 0;
                const vx = vFromSamples(s);                  // px/ms, + = ke kanan
                const el = tabs[index];
                const dir = dx < 0 ? 1 : -1;                 // 1 = ke tab berikutnya
                const target = index + dir;
                const valid = target >= 0 && target < tabs.length;
                const flick = Math.abs(vx) > FLICK_SPEED && Math.abs(dx) > 28 && Math.sign(vx) === Math.sign(dx);
                const commit = !cancelled && valid && (Math.abs(dx) > s.w * COMMIT_RATIO || flick);
                const fromTransform = el.style.transform || 'translate3d(0,0,0)';
                const fromOpacity = Number(el.style.opacity || 1);
                el.style.transform = '';
                el.style.opacity = '';
                document.documentElement.classList.remove('is-swiping');
                hidePeek();

                if (commit) {
                    if (!canAnimate || reduceMotion()) { go(target, { dir: dir, instant: true }); return; }
                    const out = trackAnim(el.animate(
                        [{ transform: fromTransform, opacity: fromOpacity }, { transform: 'translate3d(' + (-dir * Math.min(s.w * 0.45, 170)) + 'px,0,0)', opacity: 0 }],
                        { duration: 140, easing: 'ease-in', fill: 'forwards' }
                    ));
                    out.onfinish = () => go(target, { dir: dir });
                } else {
                    markActive(index);
                    if (canAnimate && !reduceMotion()) {
                        trackAnim(el.animate(
                            [{ transform: fromTransform, opacity: fromOpacity }, { transform: 'translate3d(0,0,0)', opacity: 1 }],
                            { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.15)' }
                        ));
                    }
                }
            }
            function vFromSamples(s) {
                const a = s.samples;
                if (a.length < 2) return 0;
                const last = a[a.length - 1];
                let first = a[0];
                for (let i = a.length - 1; i >= 0; i--) { if (last.t - a[i].t <= 120) first = a[i]; else break; }
                const dt = last.t - first.t;
                return dt > 0 ? (last.x - first.x) / dt : 0;
            }

            document.addEventListener('pointerdown', onDown, { passive: true });
            document.addEventListener('pointermove', onMove, { passive: true });
            document.addEventListener('pointerup', onUp, { passive: true });
            document.addEventListener('pointercancel', onUp, { passive: true });
            document.addEventListener('click', (e) => {
                if (performance.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); }
            }, true);

            // Keyboard: panah kiri/kanan pada bilah navigasi
            if (nav) {
                nav.addEventListener('keydown', (e) => {
                    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                    const next = index + (e.key === 'ArrowRight' ? 1 : -1);
                    if (next < 0 || next >= tabs.length) return;
                    e.preventDefault();
                    go(next);
                    if (navBtns[next]) navBtns[next].focus();
                });
            }

            markActive(index);
            return {
                go: go,
                goById: (id) => { const i = tabs.findIndex((t) => t.id === id); if (i >= 0) go(i); },
                index: () => index,
                count: () => tabs.length
            };
        })();

        function openTab(tabId, btn) { TabNav.goById(tabId); }


        function bukaLogbook() { window.open(GOOGLE_SHEET_URL, '_blank', 'noopener'); }

        function updateSensorBadge(id, isOk, name) {
            const el = $(id);
            if (!el) return;
            el.className = isOk ? "health-chip chip-ok" : "health-chip chip-err";
            el.innerText = name + (isOk ? ": ACTIVE" : ": OFFLINE");
        }

        function appendWebSerial(text) {
            const box = $('webSerialBox');
            if (!box) return;
            if (box.textContent.startsWith("Menunggu paket")) box.textContent = "";
            box.textContent += "> " + text + "\n";
            if (box.textContent.length > 8000) box.textContent = box.textContent.slice(-4000);
            box.scrollTop = box.scrollHeight;
        }

        /* ---------- Notifikasi ---------- */
        let waNumbers = [];

        function renderWaList() {
            let html = "";
            if(waNumbers.length === 0) {
                html = `<div style="font-size:10px; color:var(--text-muted); text-align:center; padding:10px;">Belum ada nomor terdaftar</div>`;
            } else {
                waNumbers.forEach((no) => {
                    html += `<div class="list-chip-item">
                        <span> ${esc(no)}</span>
                        <button type="button" class="btn-outline btn-danger" style="padding:3px 8px; font-size:10px;" onclick="delWaNumber('${esc(no)}')">Hapus</button>
                    </div>`;
                });
            }
            const container = $('waListContainer');
            if(container) container.innerHTML = html;
        }

        function fetchWaList() {
            gasRequest({ cmd: "get_wa" })
                .then(data => {
                    waNumbers = Array.isArray(data) ? data : [];
                    renderWaList();
                })
                .catch(e => {
                    console.log("Gagal fetch WA list", e);
                    $('waListContainer').innerHTML = `<div style="font-size:10px; color:var(--wine-soft); text-align:center; padding:10px;">Gagal memuat dari Google. Coba lagi.</div>`;
                });
        }

        function gasJsonpFallback(baseUrl) {
            return new Promise((resolve, reject) => {
                const cbName = "__gasCb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
                const script = document.createElement("script");
                const timer = setTimeout(() => {
                    cleanup();
                    reject(new Error("Timeout koneksi ke Google Apps Script (cek akses deployment 'Anyone')"));
                }, 12000);

                function cleanup() {
                    clearTimeout(timer);
                    delete window[cbName];
                    if (script.parentNode) script.parentNode.removeChild(script);
                }

                window[cbName] = function (data) {
                    cleanup();
                    if (data && data.status === "error") {
                        reject(new Error(data.message || "Error dari Google Apps Script"));
                    } else {
                        resolve(data);
                    }
                };

                script.onerror = function () {
                    cleanup();
                    reject(new Error("URL Web App Google tidak dapat diakses (cek jaringan / akses 'Anyone')"));
                };

                const sep = baseUrl.includes("?") ? "&" : "?";
                script.src = baseUrl + sep + "callback=" + cbName;
                document.head.appendChild(script);
            });
        }

        async function gasRequest(paramsObj) {
            const url = new URL(GAS_WEB_APP_URL);
            Object.entries(paramsObj || {}).forEach(([k, v]) => {
                if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
            });
            const fullUrl = url.toString();

            try {
                const response = await fetch(fullUrl, { method: 'GET', redirect: 'follow' });
                if (!response.ok) throw new Error("HTTP " + response.status);
                const text = await response.text();
                const parsed = JSON.parse(text);
                if (parsed && parsed.status === "error") {
                    throw new Error(parsed.message || "Error dari Google Apps Script");
                }
                return parsed;
            } catch (fetchErr) {
                return await gasJsonpFallback(fullUrl);
            }
        }

        function addWaNumber() {
            const no = $('inpWaNumber').value.replace(/[^0-9]/g, '');
            if (!no || no.length < 10 || (!no.startsWith('62') && !no.startsWith('08'))) {
                GentaAlert.fire({ icon: 'warning', title: 'Format nomor belum sesuai', text: 'Gunakan format 628xxx (minimal 10 digit).' });
                return;
            }
            const finalNo = no.startsWith('0') ? "62" + no.substring(1) : no;
            if (waNumbers.includes(finalNo)) {
                GentaAlert.fire({ icon: 'info', title: 'Nomor sudah terdaftar', text: 'Nomor ' + finalNo + ' sudah ada di dalam daftar penerima.' });
                return;
            }

            const connected = client.isConnected() && (lastESPTime > 0) && ((Date.now() - lastESPTime) <= 8000);
            const radarActive = sectorStates.some((s) => s.me > 0 || s.se > 0 || s.obj > 0) ? "1" : "0";
            const hstClean = ($('hstValue') ? $('hstValue').innerText.replace(/[^0-9]/g, '') : "") || "-";

            const payload = {
                cmd: 'set_wa',
                no: finalNo,
                conn: connected ? "CONNECTED" : "DISCONNECTED",
                uv: actuatorState.uvActive ? "1" : "0",
                spk: actuatorState.spkActive ? "1" : "0",
                manual: actuatorState.isManual ? "1" : "0",
                radar: radarActive,
                hst: hstClean
            };

            if (connected) {
                payload.temp = $('valTemp').innerText;
                payload.hum = $('valHum').innerText;
                payload.vpd = $('valVpd').innerText;
                payload.press = $('valPress').innerText;
                payload.batt = $('valBatt').innerText;
                payload.current = $('valCurrent').innerText;
                payload.sound = $('valSound').innerText;
                payload.ai = $('valAiStatus').innerText || "Aman";
            }

            GentaAlert.loading('Mendaftarkan nomor…', 'Menyimpan ke server dan mengirim pesan WhatsApp.');
            gasRequest(payload)
                .then((res) => {
                    $('inpWaNumber').value = '';
                    waNumbers.push(finalNo);
                    renderWaList();
                    if (res && res.waSent === false) {
                        GentaAlert.fire({ icon: 'warning', title: 'Nomor tersimpan', text: 'Namun Fonnte gagal mengirim WA (' + (res.waReason || 'cek device Fonnte') + ').' });
                    } else {
                        GentaAlert.fire({ icon: 'success', title: 'Nomor WA terdaftar!', text: 'Bot telah mengirim pesan sambutan dan status lahan terkini ke ' + finalNo + '.' });
                    }
                })
                .catch((err) => {
                    GentaAlert.fire({ icon: 'error', title: 'Gagal menambahkan nomor', text: 'Nomor WA tidak dapat ditambahkan ke server (' + err.message + ').' });
                });
        }

        function delWaNumber(no) {
            GentaAlert.confirm({
                icon: 'warning',
                danger: true,
                title: 'Hapus nomor ini?',
                text: 'Nomor ' + no + ' tidak akan lagi menerima peringatan hama.',
                confirmButtonText: 'Ya, hapus',
                cancelButtonText: 'Batal'
            }).then((ok) => {
                if (!ok) return;
                GentaAlert.loading('Menghapus nomor…');
                gasRequest({ cmd: 'del_wa', no: no })
                    .then(() => {
                        waNumbers = waNumbers.filter(n => n !== no);
                        renderWaList();
                        GentaAlert.close();
                        GentaAlert.toast({ icon: 'success', title: 'Nomor dihapus', text: no });
                    })
                    .catch((err) => {
                        GentaAlert.fire({ icon: 'error', title: 'Gagal menghapus nomor', text: 'Nomor WA tidak dapat dihapus dari server (' + err.message + ').' });
                    });
            });
        }

        /* ---------- Profil kalibrasi ---------- */
        let micProfiles = loadList('micProfiles', [
            { db: 60, label: "Angin / Normal" },
            { db: 80, label: "Kepakan Hama Burung" }
        ]);

        function renderMicProfiles() {
            micProfiles.sort((a, b) => a.db - b.db);
            let html = "";
            micProfiles.forEach((p, idx) => {
                html += `<div class="list-chip-item">
                    <span>&gt; ${esc(p.db)} dB : <b style="color:var(--blue-soft);">${esc(p.label)}</b></span>
                    <button type="button" class="btn-outline btn-danger" style="padding:2px 7px; font-size:10px;" aria-label="Hapus profil" onclick="delMicProfile(${idx})">✖</button>
                </div>`;
            });
            $('listMicProfiles').innerHTML = html;
        }

        function addMicProfile() {
            GentaAlert.fire({
                icon: 'info',
                title: 'Tambah ambang batas mic',
                text: 'Suara di atas nilai ini dikenali sebagai profil yang Anda beri nama.',
                fields: [
                    { name: 'db', type: 'number', label: 'Minimal dB ambang batas', placeholder: 'mis. 75', min: 0, max: 150, suffix: 'dB' },
                    { name: 'label', type: 'text', label: 'Identifikasi suara / nama hama', placeholder: 'mis. Kepakan burung', maxLength: 40 }
                ],
                showCancelButton: true,
                confirmButtonText: 'Simpan',
                cancelButtonText: 'Batal'
            }).then((r) => {
                if (!r.isConfirmed) return;
                micProfiles.push({ db: r.values.db, label: r.values.label });
                saveProfiles();
                GentaAlert.toast({ icon: 'success', title: 'Ambang batas ditambahkan', text: '> ' + r.values.db + ' dB • ' + r.values.label });
            });
        }
        function delMicProfile(idx) { micProfiles.splice(idx, 1); saveProfiles(); }

        let speakerTracks = loadList('speakerTracks', [
            { track: 1, label: "Suara Predator Elang", isAlarm: true },
            { track: 2, label: "Ultrasonik 22-25kHz", isAlarm: true }
        ]);

        function renderSpeakerTracks() {
            let html = "";
            let diagHtml = "";
            speakerTracks.forEach((p, idx) => {
                html += `<div class="list-chip-item" style="flex-wrap: wrap; gap: 4px;">
                    <span style="flex: 1;">Track ${esc(p.track)}: <b>${esc(p.label)}</b></span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label style="font-size:10px; display:flex; align-items:center; gap:3px;">
                            <input type="checkbox" onchange="toggleAlarmMode(${idx}, this.checked)" ${p.isAlarm ? "checked" : ""}> Auto
                        </label>
                        <button type="button" class="btn-outline btn-danger" style="padding:2px 7px; font-size:10px;" aria-label="Hapus track" onclick="delSpeakerTrack(${idx})">✖</button>
                    </div>
                </div>`;
                diagHtml += `<button type="button" class="btn-outline actuator" onclick="sendCmd('audio', ${Number(p.track)})" ${actuatorState.isManual ? "" : "disabled"} style="font-size: 11px;">▶ ${esc(p.label)}</button>`;
            });
            $('listSpeakerTracks').innerHTML = html;
            $('dynamicAudioButtons').innerHTML = diagHtml;
        }

        function addSpeakerTrack() {
            GentaAlert.fire({
                icon: 'info',
                title: 'Tambah track speaker',
                text: 'Nomor track sesuai urutan file MP3 pada kartu DFPlayer.',
                fields: [
                    { name: 'track', type: 'number', label: 'Nomor track MP3', placeholder: 'mis. 3', min: 1, max: 3000 },
                    { name: 'label', type: 'text', label: 'Nama audio', placeholder: 'mis. Suara predator', maxLength: 40 }
                ],
                showCancelButton: true,
                confirmButtonText: 'Simpan',
                cancelButtonText: 'Batal'
            }).then((r) => {
                if (!r.isConfirmed) return;
                speakerTracks.push({ track: r.values.track, label: r.values.label, isAlarm: false });
                saveProfiles();
                GentaAlert.toast({ icon: 'success', title: 'Track ditambahkan', text: 'Track ' + r.values.track + ' • ' + r.values.label });
            });
        }
        function toggleAlarmMode(idx, checked) { speakerTracks[idx].isAlarm = checked; saveProfiles(); }
        function delSpeakerTrack(idx) { speakerTracks.splice(idx, 1); saveProfiles(); }

        let radarProfiles = loadList('radarProfiles', [
            { energy: 30, label: "Burung", exclude: false },
            { energy: 50, label: "Tikus / Hewan", exclude: false },
            { energy: 90, label: "Petani (Bypass)", exclude: true }
        ]);

        function renderRadarProfiles() {
            radarProfiles.sort((a, b) => a.energy - b.energy);
            let html = "";
            radarProfiles.forEach((p, idx) => {
                const excStyle = p.exclude ? "color:var(--wine-soft); text-decoration:line-through;" : "color: var(--lime-fg);";
                html += `<div class="list-chip-item">
                    <span>Energi &gt; ${esc(p.energy)} : <b style="${excStyle}">${esc(p.label)}</b></span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <label style="font-size:10px; display:flex; align-items:center; gap:3px;">
                            <input type="checkbox" onchange="toggleRadarExclude(${idx}, this.checked)" ${p.exclude ? "checked" : ""}> Exclude
                        </label>
                        <button type="button" class="btn-outline btn-danger" style="padding:2px 7px; font-size:10px;" aria-label="Hapus profil" onclick="delRadarProfile(${idx})">✖</button>
                    </div>
                </div>`;
            });
            $('listRadarProfiles').innerHTML = html;
        }

        function addRadarProfile() {
            GentaAlert.fire({
                icon: 'info',
                title: 'Tambah profil radar',
                text: 'Objek dengan energi di atas nilai ini dikenali sebagai profil yang Anda beri nama.',
                fields: [
                    { name: 'energy', type: 'number', label: 'Nilai energi radar (0 - 100)', placeholder: 'mis. 40', min: 0, max: 100 },
                    { name: 'label', type: 'text', label: 'Identifikasi objek', placeholder: 'mis. Tikus', maxLength: 40 }
                ],
                showCancelButton: true,
                confirmButtonText: 'Simpan',
                cancelButtonText: 'Batal'
            }).then((r) => {
                if (!r.isConfirmed) return;
                radarProfiles.push({ energy: r.values.energy, label: r.values.label, exclude: false });
                saveProfiles();
                GentaAlert.toast({ icon: 'success', title: 'Profil radar ditambahkan', text: 'Energi > ' + r.values.energy + ' • ' + r.values.label });
            });
        }
        function toggleRadarExclude(idx, checked) { radarProfiles[idx].exclude = checked; saveProfiles(); }
        function delRadarProfile(idx) { radarProfiles.splice(idx, 1); saveProfiles(); }

        function saveProfiles() {
            lsSet('micProfiles', JSON.stringify(micProfiles));
            lsSet('speakerTracks', JSON.stringify(speakerTracks));
            lsSet('radarProfiles', JSON.stringify(radarProfiles));
            renderMicProfiles();
            renderSpeakerTracks();
            renderRadarProfiles();
        }

        renderMicProfiles();
        renderSpeakerTracks();
        renderRadarProfiles();

        /* ---------- Fase tanam ---------- */
        function calcHST() {
            const dt = $('plantDate').value;
            if (!dt) return;
            lsSet('plantDate', dt);

            const diff = Math.floor((new Date() - new Date(dt)) / (1000 * 60 * 60 * 24));
            const val = diff >= 0 ? diff : 0;
            const pct = Math.min((val / 120) * 100, 100);

            $('hstValue').innerText = diff >= 0 ? diff + " HST" : "Belum Tanam";
            $('farmProgressFill').style.width = pct + "%";
        }

        if (lsGet('plantDate')) {
            $('plantDate').value = lsGet('plantDate');
            calcHST();
        }

        function confirmResetFase() {
            return GentaAlert.confirm({
                icon: 'warning',
                danger: true,
                title: 'Reset tanggal tanam?',
                text: 'Tanggal tanam padi dan progres HST akan dihapus.',
                confirmButtonText: 'Ya, reset',
                cancelButtonText: 'Batal'
            });
        }

        function resetFaseTanam() {
            confirmResetFase().then((ok) => {
                if (!ok) return;
                $('plantDate').value = '';
                lsRemove('plantDate');
                $('hstValue').innerText = "- HST";
                $('farmProgressFill').style.width = "0%";
                GentaAlert.toast({ icon: 'success', title: 'Tanggal tanam direset' });
            });
        }

        function forceSimpanManual() {
            const hst = $('hstValue').innerText.replace(/[^0-9]/g, '');
            if (hst === "") { GentaAlert.fire({ icon: 'warning', title: 'Tanggal tanam belum dipilih', text: 'Pilih tanggal tanam terlebih dahulu!' }); return; }

            const q = new URLSearchParams({
                cmd: 'log',
                hst: hst,
                temp: $('valTemp').innerText,
                hum: $('valHum').innerText,
                vpd: $('valVpd').innerText,
                press: $('valPress').innerText,
                batt: $('valBatt').innerText,
                current: $('valCurrent').innerText,
                sound: $('valSound').innerText,
                fan: $('valAiStatus').innerText,
                radar: 0
            });

            GentaAlert.loading('Mengirim log telemetri…', 'Menyimpan ke Google Sheets.');
            fetch(GAS_WEB_APP_URL + "?" + q.toString(), { mode: 'no-cors' })
                .then(() => GentaAlert.fire({ icon: 'success', title: 'Log terkirim', text: 'Log telemetri terkirim ke Google Sheets!', timer: 4500 }))
                .catch(() => GentaAlert.fire({ icon: 'error', title: 'Gagal mengirim log', text: 'Gagal mengirim ke Google Sheets. Periksa koneksi internet.' }));
        }

        /* ---------- Sinyal seluler ---------- */
        function updateCellularWidget(rssi, netType) {
            const val = Number(rssi) || 0;
            $('cellSpeed').innerText = val !== 0 ? val : "--";
            if (netType) $('cellNetType').innerText = netType;

            let level = 0;
            if (val > 0 && val <= 31) {            // format CSQ (1-31)
                if (val > 20) level = 4;
                else if (val > 15) level = 3;
                else if (val > 10) level = 2;
                else level = 1;
            } else if (val < 0) {                  // format dBm
                if (val > -70) level = 4;
                else if (val > -85) level = 3;
                else if (val > -100) level = 2;
                else if (val > -110) level = 1;
            }

            for (let i = 1; i <= 4; i++) {
                const bar = $('bar' + i);
                if (bar) bar.classList.toggle('active', i <= level);
            }
        }

        /* ---------- MQTT Lintas Jaringan ---------- */
        const broker = "broker.hivemq.com";
        const clientId = "GentaWeb_" + Date.now().toString(36) + "_" + Math.random().toString(16).substr(2, 6);
        const topic_telemetry   = "genta/unesa/telemetry";
        const topic_command     = "genta/unesa/command";
        const topic_console_req = "genta/unesa/console";
        const topic_console_res = "genta/unesa/console_reply";

        const mqttLibMissing = (typeof Paho === 'undefined');
        const client = mqttLibMissing
            ? { isConnected: () => false, connect() {}, send() {}, subscribe() {} }
            : new Paho.MQTT.Client(broker, 8884, "/mqtt", clientId);

        let lastESPTime = 0;
        let lastRtcFromESP = 0;
        let pendingPings = {};
        let expectedSeq = -1;
        let lostPackets = 0;
        let totalPackets = 0;
        let mqttConnecting = false;
        let reconnectTimer = null;
        let reconnectDelay = 2000;
        let remoteLogSeq = 0;

        function scheduleReconnect(delay) {
            clearTimeout(reconnectTimer);
            const wait = delay || reconnectDelay;
            reconnectTimer = setTimeout(initMQTT, wait);
            reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
        }

        function openRemoteConsole() {
            window.open("remote_console.html", "_blank", "noopener");
        }

        // Ping heartbeat + sinkronisasi log serial lintas jaringan
        setInterval(() => {
            if (client.isConnected()) {
                const now = Date.now();
                Object.keys(pendingPings).forEach((k) => { if (now - pendingPings[k] > 15000) delete pendingPings[k]; });
                const pingId = now % 10000000;
                pendingPings[pingId] = now;
                const message = new Paho.MQTT.Message(JSON.stringify({ cmd: "ping", val: pingId }));
                message.destinationName = topic_command;
                client.send(message);

                // Tarik log serial baru dari ESP32 jika tab sedang aktif
                if (!document.hidden && lastESPTime > 0 && (now - lastESPTime < 10000)) {
                    const logReq = new Paho.MQTT.Message(JSON.stringify({
                        rid: pingId,
                        action: "telemetry",
                        since: remoteLogSeq
                    }));
                    logReq.destinationName = topic_console_req;
                    client.send(logReq);
                }
            }
        }, 3000);

        let cloudKind = null, cloudCand = null, cloudCandN = 0;
        function notifyCloudState(kind) {
            if (kind !== cloudCand) { cloudCand = kind; cloudCandN = 0; }
            if (++cloudCandN !== 2 || kind === cloudKind) return;
            const prev = cloudKind;
            cloudKind = kind;
            if (kind === 'connected') {
                GentaAlert.toast({ icon: 'success', title: 'Terhubung ke Genta-IoT', text: 'Link MQTT lintas jaringan aktif.', key: 'conn' });
            } else if (prev === 'connected' && kind === 'disconnected') {
                GentaAlert.toast({ icon: 'error', title: 'Koneksi terputus', text: 'Mencoba menghubungkan ulang…', key: 'conn', timer: 5000 });
            } else if (prev === 'connected' && kind === 'warning') {
                GentaAlert.toast({ icon: 'warning', title: 'Telemetri berhenti', text: 'Menunggu data baru dari ESP32…', key: 'conn', timer: 5000 });
            }
        }

        setInterval(() => {
            const st = $('cloudStatus');
            const stText = $('cloudStatusText');

            if (!client.isConnected()) {
                st.className = 'cloud-status-bar disconnected';
                stText.innerText = mqttLibMissing ? "Library MQTT gagal dimuat (cek internet)" : (mqttConnecting ? "Genta-IoT • Menghubungkan..." : "Genta-IoT Disconnected");
                updateCellularWidget(0, "NO NET");
                updateSensorBadge('badgeBME', false, "BME280");
                updateSensorBadge('badgeINA', false, "INA219");
                updateSensorBadge('badgeMIC', false, "MIC I2S");
                updateSensorBadge('badgeRAD', false, "RADAR 24GHz");
                notifyCloudState('disconnected');
            } else if (Date.now() - lastESPTime > 6000) {
                notifyCloudState('warning');
                st.className = 'cloud-status-bar warning';
                stText.innerText = "Genta-IoT Menunggu Data Telemetri...";
                updateSensorBadge('badgeBME', false, "BME280");
                updateSensorBadge('badgeINA', false, "INA219");
                updateSensorBadge('badgeMIC', false, "MIC I2S");
                updateSensorBadge('badgeRAD', false, "RADAR 24GHz");
            } else {
                st.className = 'cloud-status-bar connected';
                stText.innerText = "Genta-IoT Connected • Cloud Link Active";
                notifyCloudState('connected');
            }
        }, 1000);

        function pushHist(key, val) {
            histData[key].push(val);
        }

        client.onMessageArrived = function (message) {
            if (message.destinationName === topic_console_res) {
                try {
                    const env = JSON.parse(message.payloadString);
                    if (env && env.data) {
                        if (typeof env.data.last_seq === 'number' && env.data.last_seq > remoteLogSeq) {
                            remoteLogSeq = env.data.last_seq;
                        }
                        if (Array.isArray(env.data.logs)) {
                            env.data.logs.forEach((entry) => {
                                if (!entry) return;
                                if (typeof entry.seq === 'number' && entry.seq > remoteLogSeq) {
                                    remoteLogSeq = entry.seq;
                                }
                                const line = entry.text || entry.m;
                                if (line) appendWebSerial(line);
                            });
                        } else if (env.data.msg) {
                            appendWebSerial(env.data.msg);
                        }
                    }
                } catch (e) { /* abaikan paket korup */ }
                return;
            }

            if (message.destinationName !== topic_telemetry) return;

            let data;
            try {
                data = JSON.parse(message.payloadString);
            } catch (e) {
                appendWebSerial("[MQTT RX] Payload bukan JSON valid, diabaikan.");
                return;
            }
            if (!data || typeof data !== 'object') return;

            if (data.type === "pong") {
                const sentTime = pendingPings[data.val];
                if (sentTime) {
                    $('cellLat').innerText = (Date.now() - sentTime) + " ms";
                    delete pendingPings[data.val];
                }
                return;
            }

            const t = toNum(data.t), h = toNum(data.h), p = toNum(data.p), alt = toNum(data.alt);
            const v = toNum(data.v_bus), c = toNum(data.c), pwr = toNum(data.pw);
            const snd = toNum(data.snd);
            const up = toNum(data.up) || 0;
            const sig = toNum(data.sig) || 0;
            const ai_str = data.ai_s || "--";
            const ai_val = toNum(data.ai_v) || 0;

            if (!actuatorState.simulationActive) lastSound = (snd !== null && snd > 15) ? snd : 0;

            let isRadarUpdated = false;
            if (!actuatorState.simulationActive) {
                if (Array.isArray(data.radars)) {
                    data.radars.forEach((r) => {
                        if (r && r.id >= 0 && r.id <= 3) {
                            const s = sectorStates[r.id];
                            s.state = r.st || 0; s.md = r.md || 0; s.me = r.me || 0;
                            s.sd = r.sd || 0; s.se = r.se || 0; s.obj = r.obj || 0;
                            isRadarUpdated = true;
                        }
                    });
                } else if (data.r_id !== undefined && data.r_id !== null) {
                    const r_id = parseInt(data.r_id, 10);
                    if (!isNaN(r_id) && r_id >= 0 && r_id <= 3) {
                        const s = sectorStates[r_id];
                        s.state = data.r_st || 0; s.md = data.r_md || 0; s.me = data.r_me || 0;
                        s.sd = data.r_sd || 0; s.se = data.r_se || 0;
                        isRadarUpdated = true;
                    }
                }
            }

            if (data.type !== "telemetry") {
                if (isRadarUpdated) updateSectorDisplay();
                return;
            }

            lastESPTime = Date.now();

            if (data.sq !== undefined) {
                const seq = Number(data.sq);
                totalPackets++;
                if (expectedSeq !== -1) {
                    const missed = seq - expectedSeq;
                    if (missed > 0) {
                        lostPackets += missed;
                        totalPackets += missed;
                    } else if (missed < 0) {
                        lostPackets = 0;
                        totalPackets = 1;
                        hwUv = null;
                        remoteLogSeq = 0;
                        if (actuatorState.isManual) {
                            syncManualModeUI(false, false);
                            if ($('chkUv')) $('chkUv').checked = false;
                            stopSpeaker("ESP32 Reboot • Kembali ke Mode Otomatis", true, false);
                            appendWebSerial("[SYS] ESP32 reboot terdeteksi • Manual Override direset ke AUTO.");
                        }
                    }
                }
                expectedSeq = seq + 1;
                $('cellLoss').innerText = ((lostPackets / totalPackets) * 100).toFixed(1) + "%";
            }

            if (data.rtc_time) {
                lastRtcFromESP = Date.now();
                const parts = String(data.rtc_time).split(" ");
                $('rtcTime').innerText = parts[0];
                $('rtcDate').innerText = parts.length >= 2 ? parts[1] : "";
                $('rtcZone').innerText = "WIB (GMT+7)";
            }

            $('valIp').innerText = data.ip || "--";
            $('valNtp').innerText = data.ntp || "--";

            if (data.lat !== undefined && data.lon !== undefined) {
                $('valGps').innerText = `${data.lat}, ${data.lon}`;
            }

            const bmeOk = validReading(t), inaOk = validReading(v);
            updateSensorBadge('badgeBME', bmeOk, "BME280");
            updateSensorBadge('badgeINA', inaOk, "INA219");
            updateSensorBadge('badgeMIC', snd !== null && snd > 15, "MIC I2S");
            updateSensorBadge('badgeRAD', data.r_id !== undefined || !!data.radars, "RADAR 24GHz");
            updateCellularWidget(sig, data.net || "Wi-Fi");
            updateWeatherWidget(data);
            $('valTemp').innerText = bmeOk ? t.toFixed(1) : "--";
            $('valHum').innerText = validReading(h) ? h.toFixed(1) : "--";
            $('valPress').innerText = validReading(p) ? p.toFixed(0) : "--";
            $('valAlt').innerText = validReading(alt) ? alt.toFixed(1) : "--";
            $('valBatt').innerText = inaOk ? v.toFixed(1) : "--";
            const shunt = toNum(data.v_shnt);
            $('valShunt').innerText = shunt !== null ? shunt.toFixed(2) : "--";
            $('valCurrent').innerText = validReading(c) ? c.toFixed(1) : "--";
            $('valPower').innerText = validReading(pwr) ? pwr.toFixed(1) : "--";
            const aiEl = $('valAiStatus');
            aiEl.innerText = ai_str;
            const aiSafe = ai_str.includes("Aman") || ai_str === "--" || ai_str === "Standby";
            aiEl.style.color = aiSafe ? "var(--lime-fg)" : "var(--wine-soft)";
            $('valUptime').innerText = `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m ${Math.floor(up % 60)}s`;

            let vpd = null;
            if (bmeOk && h !== null) {
                const svp = 0.61078 * Math.exp((17.27 * t) / (t + 237.3));
                vpd = svp - (svp * (h / 100));
            }
            $('valVpd').innerText = vpd !== null ? vpd.toFixed(2) : "--";

            const sndOk = snd !== null && snd > 15;
            if (!actuatorState.simulationActive) $('valSound').innerText = sndOk ? snd.toFixed(1) : "--";
            let micClass = "Normal";
            let isLoudAlarm = false;
            if (sndOk) {
                const sorted = [...micProfiles].sort((a, b) => a.db - b.db);
                for (let i = sorted.length - 1; i >= 0; i--) {
                    if (snd >= sorted[i].db) {
                        micClass = sorted[i].label;
                        if (i > 0) isLoudAlarm = true;
                        break;
                    }
                }
            }
            $('valMicClass').innerText = micClass;
            $('valMicClass').style.color = isLoudAlarm ? "var(--wine-soft)" : "var(--text-muted)";

            const now = new Date();
            const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(":");
            if (histLabels.length >= maxDataPoints) {
                histLabels.shift();
                histKeys.forEach((k) => histData[k].shift());
            }
            histLabels.push(timeStr);
            pushHist('temp', bmeOk ? t : null);
            pushHist('hum', validReading(h) ? h : null);
            pushHist('vpd', vpd !== null ? parseFloat(vpd.toFixed(2)) : null);
            pushHist('press', validReading(p) ? p : null);
            pushHist('alt', validReading(alt) ? alt : null);
            pushHist('batt', inaOk ? v : null);
            pushHist('current', validReading(c) ? c : null);
            pushHist('power', validReading(pwr) ? parseFloat(pwr.toFixed(1)) : null);
            pushHist('sound', sndOk ? snd : null);
            pushHist('ai', ai_val);

            if (activeChartKey !== '' && chartInstance !== null) chartInstance.update();

            // Sinkronisasi status manual & aktuator dari firmware
            if (data.manual !== undefined) {
                const fwManual = (data.manual === 1 || data.manual === true);
                if (fwManual !== actuatorState.isManual) {
                    syncManualModeUI(fwManual, false);
                }
            }
            if (data.uv !== undefined) {
                hwUv = (data.uv === 1 || data.uv === true);
            }

            if (isRadarUpdated) updateSectorDisplay();
            else checkActuatorsSchedule();
            syncFarmSummary();
        };

        client.onConnectionLost = function (responseObject) {
            mqttConnecting = false;
            expectedSeq = -1;
            if (responseObject.errorCode !== 0) {
                $('cloudStatus').className = 'cloud-status-bar disconnected';
                $('cloudStatusText').innerText = "Genta-IoT Disconnected";
                scheduleReconnect(2000);
            }
        };

        function initMQTT() {
            if (mqttLibMissing || client.isConnected() || mqttConnecting) return;
            mqttConnecting = true;
            clearTimeout(reconnectTimer);
            try {
                client.connect({
                    useSSL: true,
                    cleanSession: true,
                    keepAliveInterval: 30,
                    timeout: 10,
                    onSuccess: () => {
                        mqttConnecting = false;
                        reconnectDelay = 2000;
                        $('cloudStatus').className = 'cloud-status-bar connected';
                        $('cloudStatusText').innerText = "Genta-IoT Connected • Cloud Link Active";
                        client.subscribe(topic_telemetry);
                        client.subscribe(topic_console_res);
                    },
                    onFailure: () => {
                        mqttConnecting = false;
                        scheduleReconnect();
                    }
                });
            } catch (err) {
                mqttConnecting = false;
                scheduleReconnect();
            }
        }

        function sendCmd(cmd, val) {
            if (client.isConnected()) {
                const message = new Paho.MQTT.Message(JSON.stringify({ cmd: cmd, val: val }));
                message.destinationName = topic_command;
                client.send(message);
                appendWebSerial(`[MQTT TX] ${cmd} = ${val}`);
            } else {
                appendWebSerial(`[MQTT TX GAGAL] ${cmd} = ${val} (tidak terhubung)`);
            }
        }

        function tickLocalClock() {
            const now = new Date();
            if (Date.now() - lastRtcFromESP > 10000) {
                $('rtcTime').innerText = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, '0')).join(":");
                const days = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
                const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
                $('rtcDate').innerText = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
                $('rtcZone').innerText = "WAKTU PERANGKAT";
            }
            // Perbarui jadwal UV tepat saat pergantian menit
            if (now.getSeconds() === 0 && simulatedNight === null) {
                updateNightStatusUI();
                checkActuatorsSchedule();
            }
        }

        function updateWeatherWidget(data) {
            if (!data || data.z_txt === undefined) return;
            const badge = $('weatherBadge');
            const txtEl = $('weatherForecastText');
            const icoUse = $('weatherIcoUse');
            if (!badge || !txtEl || !icoUse) return;
            const forecast = String(data.z_txt || "Stabil");
            const trend = String(data.z_tr || "Stabil");
            const icoType = String(data.z_ico || "cloud");
            const p0 = toNum(data.z_p0);
            const dp = toNum(data.z_dp);
            const zNum = toNum(data.z_num);
            const arrow = trend === "Naik" ? "↗" : (trend === "Turun" ? "↘" : "→");
            txtEl.innerText = `${arrow} ${forecast}`;
            const iconMap = {
                sun: "#i-weather-sun",
                partly: "#i-weather-partly",
                cloud: "#i-cloud",
                rain: "#i-weather-rain",
                storm: "#i-weather-storm"
            };
            icoUse.setAttribute("href", iconMap[icoType] || "#i-cloud");
            badge.classList.remove("w-sun", "w-cloud", "w-rain", "w-storm");
            if (icoType === "sun" || icoType === "partly") badge.classList.add("w-sun");
            else if (icoType === "rain") badge.classList.add("w-rain");
            else if (icoType === "storm") badge.classList.add("w-storm");
            else badge.classList.add("w-cloud");
            const p0Str = p0 !== null ? p0.toFixed(1) + " hPa" : "--";
            const dpStr = dp !== null ? (dp >= 0 ? "+" : "") + dp.toFixed(2) + " hPa/3j" : "--";
            badge.title = `Zambretti Z=${zNum ?? '--'} | ${forecast} | P0: ${p0Str} | Tren: ${trend} (${dpStr})`;
        }

        window.onload = function () {
            applyTheme(themeMode, false);
            initMQTT();
            updateSectorDisplay();
            updateNightStatusUI();
            updateSpeakerUI();
            tickLocalClock();
            fetchWaList();
            setInterval(tickLocalClock, 1000);
            showSwipeHint();
        };

        // Petunjuk sekali saja pada layar sentuh
        function showSwipeHint() {
            if (!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return;
            if (lsGet('swipeHintSeen')) return;
            setTimeout(() => {
                GentaAlert.toast({
                    icon: 'info',
                    title: 'Tips: geser untuk pindah halaman',
                    text: 'Geser layar ke kiri atau kanan untuk berpindah tab.',
                    timer: 5500,
                    key: 'hint'
                });
                lsSet('swipeHintSeen', '1');
            }, 1500);
        }
/* ===== Header Compact on Scroll ===== */
        (function () {
            var hdr = document.querySelector('.header');
            if (!hdr) return;
            var COMPACT_AT = 40; 
            var EXPAND_AT = 8;     
            var compact = false;
            var ticking = false;
            var clearTimer = null;
            function fullHeight() {
                if (!hdr.classList.contains('is-compact')) return hdr.getBoundingClientRect().height;
                hdr.style.transition = 'none';
                hdr.classList.remove('is-compact');
                var h = hdr.getBoundingClientRect().height;
                hdr.classList.add('is-compact');
                void hdr.offsetHeight;          
                hdr.style.transition = '';
                return h;
            }

            function setCompact(on) {
                if (on === compact) return;
                compact = on;
                clearTimeout(clearTimer);

                if (on) {
                    var h = fullHeight();
                    hdr.style.setProperty('--hdr-full', h + 'px');
                    hdr.style.height = h + 'px';      
                    void hdr.offsetHeight;
                    hdr.classList.add('is-compact', 'was-compact');
                    hdr.style.height = '';
                } else {
                    var full = fullHeight();
                    hdr.style.setProperty('--hdr-full', full + 'px');
                    hdr.style.height = full + 'px';   
                    hdr.classList.remove('is-compact');
                    clearTimer = setTimeout(function () {
                        if (!compact) hdr.style.height = '';
                    }, 350);
                }
            }

            function update() {
                ticking = false;
                var y = window.pageYOffset || document.documentElement.scrollTop || 0;
                if (!compact && y > COMPACT_AT) setCompact(true);
                else if (compact && y < EXPAND_AT) setCompact(false);
            }

            window.addEventListener('scroll', function () {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(update);
            }, { passive: true });

            update();
        })();

/* ===== Genta Cloud Sync & WA Integration ===== */
    (function initGentaCloudSync() {
        let lastKnownConn = null;
        let lastPestSignature = "";
        let isPollingWa = false;

        function isHardwareConnected() {
            return client.isConnected() && (lastESPTime > 0) && ((Date.now() - lastESPTime) <= 8000);
        }
        function cleanSensorVal(id) {
            const el = $(id);
            if (!el) return "";
            const txt = String(el.innerText || "").trim();
            return (txt === "--" || txt === "-" || txt === "") ? "" : txt;
        }
        function syncDatabaseAndStatus(saveToHistoryLog = false) {
            const connected = isHardwareConnected();
            const connStr = connected ? "CONNECTED" : "DISCONNECTED";
            const radarActive = sectorStates.some((s) => s.me > 0 || s.se > 0 || s.obj > 0) ? "1" : "0";
            const hstClean = ($('hstValue') ? $('hstValue').innerText.replace(/[^0-9]/g, '') : "") || "-";

            const params = {
                cmd: saveToHistoryLog ? "log" : "sync_state",
                conn: connStr,
                uv: actuatorState.uvActive ? "1" : "0",
                spk: actuatorState.spkActive ? "1" : "0",
                manual: actuatorState.isManual ? "1" : "0",
                radar: radarActive,
                hst: hstClean
            };

            if (connected) {
                params.temp = cleanSensorVal("valTemp");
                params.hum = cleanSensorVal("valHum");
                params.vpd = cleanSensorVal("valVpd");
                params.press = cleanSensorVal("valPress");
                params.batt = cleanSensorVal("valBatt");
                params.current = cleanSensorVal("valCurrent");
                params.sound = cleanSensorVal("valSound");
                params.ai = cleanSensorVal("valAiStatus") || "Aman";
            }

            lastKnownConn = connStr;
            return gasRequest(params);
        }
        window.calcHST = function () {
            const dt = $('plantDate').value;
            if (!dt) return;
            lsSet('plantDate', dt);

            const diff = Math.floor((new Date() - new Date(dt)) / (1000 * 60 * 60 * 24));
            const val = diff >= 0 ? diff : 0;
            const pct = Math.min((val / 120) * 100, 100);
            const hstText = diff >= 0 ? diff + " HST" : "Belum Tanam";

            $('hstValue').innerText = hstText;
            $('farmProgressFill').style.width = pct + "%";

            gasRequest({
                cmd: "save_config",
                plantDate: dt,
                hst: diff >= 0 ? String(diff) : "0",
                conn: isHardwareConnected() ? "CONNECTED" : "DISCONNECTED"
            }).catch(() => {});
        };
        window.resetFaseTanam = function () {
            confirmResetFase().then((ok) => {
                if (!ok) return;
                $('plantDate').value = '';
                lsRemove('plantDate');
                $('hstValue').innerText = "- HST";
                $('farmProgressFill').style.width = "0%";
                GentaAlert.toast({ icon: 'success', title: 'Tanggal tanam direset' });

                gasRequest({
                    cmd: "save_config",
                    plantDate: "",
                    hst: "-",
                    conn: isHardwareConnected() ? "CONNECTED" : "DISCONNECTED"
                }).catch(() => {});
            });
        };
        window.forceSimpanManual = function () {
            GentaAlert.loading('Menyimpan ke Google Sheets…', 'Mengirim data telemetri & status koneksi.');
            syncDatabaseAndStatus(true)
                .then(() => GentaAlert.fire({ icon: 'success', title: 'Tersimpan di Google Sheets', text: 'Data telemetri & status koneksi berhasil diverifikasi tersimpan.', timer: 4500 }))
                .catch((err) => GentaAlert.fire({ icon: 'error', title: 'Gagal mengirim log', text: 'Gagal mengirim log ke Google Sheets (' + err.message + '). Periksa koneksi internet.' }));
        };
        function loadConfigFromDatabase() {
            gasRequest({ cmd: "get_config" })
                .then((cfg) => {
                    if (cfg && cfg.plantDate) {
                        if ($('plantDate').value !== cfg.plantDate) {
                            $('plantDate').value = cfg.plantDate;
                            window.calcHST();
                        }
                    } else if ($('plantDate').value) {
                        window.calcHST();
                    }
                })
                .catch(() => {});
        }
        function enableManualOverrideForWa() {
            if (!actuatorState.isManual) {
                syncManualModeUI(true, true);
            }
        }

        function pollWaCommands() {
            if (isPollingWa) return;
            isPollingWa = true;

            gasRequest({ cmd: "get_cmd_web" })
                .then((res) => {
                    const waCmd = res && res.cmd ? String(res.cmd).toUpperCase().trim() : "NONE";
                    if (!waCmd || waCmd === "NONE") return;

                    appendWebSerial("[WA CMD] Eksekusi perintah dari WhatsApp: " + waCmd);

                    if (waCmd === "UV_ON") {
                        enableManualOverrideForWa();
                        if ($('chkUv')) $('chkUv').checked = true;
                        sendCmd('uv', 1);
                        setActuatorState({
                            uvActive: true,
                            uvReason: "Diaktifkan via Tombol/Perintah WhatsApp",
                            threatLevel: "warn",
                            threatType: "KONTROL WHATSAPP"
                        });
                    } else if (waCmd === "UV_OFF") {
                        enableManualOverrideForWa();
                        if ($('chkUv')) $('chkUv').checked = false;
                        sendCmd('uv', 0);
                        setActuatorState({
                            uvActive: false,
                            uvReason: "Dimatikan via Tombol/Perintah WhatsApp",
                            threatLevel: "safe",
                            threatType: "KONTROL WHATSAPP"
                        });
                    } else if (waCmd === "SPK_ON") {
                        enableManualOverrideForWa();
                        triggerSpeaker("Diaktifkan via Tombol/Perintah WhatsApp (1 Menit)", true, false);
                    } else if (waCmd === "SPK_OFF") {
                        stopSpeaker("Dimatikan via Tombol/Perintah WhatsApp", false, true);
                    } else if (waCmd === "MODE_AUTO") {
                        toggleManualMode(false);
                    } else if (waCmd === "MODE_MANUAL") {
                        enableManualOverrideForWa();
                    }

                    syncDatabaseAndStatus(false).catch(() => {});
                })
                .catch(() => {})
                .finally(() => { isPollingWa = false; });
        }
        loadConfigFromDatabase();
        setInterval(() => {
            const currentConn = isHardwareConnected() ? "CONNECTED" : "DISCONNECTED";
            const aiNow = cleanSensorVal("valAiStatus");
            const radarNow = sectorStates.some((s) => s.me > 0 || s.se > 0 || s.obj > 0) ? "1" : "0";
            const pestSig = aiNow + "|" + radarNow;

            if (currentConn === "CONNECTED" && pestSig !== lastPestSignature && (radarNow === "1" || (aiNow && !aiNow.includes("Aman") && aiNow !== "Standby"))) {
                lastPestSignature = pestSig;
                syncDatabaseAndStatus(true).catch(() => {});
                return;
            }
            lastPestSignature = pestSig;
            if (lastKnownConn !== null && currentConn !== lastKnownConn) {
                syncDatabaseAndStatus(false).catch(() => {});
            }
        }, 2000);
        setInterval(() => syncDatabaseAndStatus(false).catch(() => {}), 15000);
        setInterval(() => {
            if (isHardwareConnected()) syncDatabaseAndStatus(true).catch(() => {});
        }, 60000);
        setInterval(pollWaCommands, 3000);
    })();