
const SCENARIO_DATA = window.SCENARIO_DATA;

const bgLayer = document.getElementById('bg-layer');
const btnContainer = document.getElementById('buttons-container');
const audioPlayer = document.getElementById('audio-player');
const globalAudioPlayer = document.getElementById('global-audio-player');
const overlay = document.getElementById('start-overlay');
const popupOverlay = document.getElementById('popup-overlay');
const closePopupBtn = document.getElementById('close-popup');

let currentSceneId = null;
let autoAdvanceTimeout = null;
let currentScore = 0;

closePopupBtn.onclick = () => popupOverlay.style.display = 'none';
popupOverlay.onclick = (e) => {
    if(e.target === popupOverlay) popupOverlay.style.display = 'none';
};


function fadeVolume(player, toVolume, duration = 1000) {
    if (player._fadeInterval) clearInterval(player._fadeInterval);
    const fromVolume = player.volume;
    if (fromVolume === toVolume) return;
    const steps = 30;
    const stepTime = duration / steps;
    const stepDiff = (toVolume - fromVolume) / steps;
    let step = 0;
    player._fadeInterval = setInterval(() => {
        step++;
        let newVol = fromVolume + (stepDiff * step);
        if(newVol < 0) newVol = 0;
        if(newVol > 1) newVol = 1;
        player.volume = newVol;
        if (step >= steps) {
            clearInterval(player._fadeInterval);
            player.volume = toVolume;
        }
    }, stepTime);
}

function init() {
    if(!SCENARIO_DATA) return;
    const sc = SCENARIO_DATA.startScreen || {};

    // Apply start screen config
    const overlay = document.getElementById('start-overlay');
    if (sc.bgGradient && sc.bgColor && sc.gradientTo) {
        overlay.style.background = 'linear-gradient(135deg, ' + sc.bgColor + ', ' + sc.gradientTo + ')';
    } else if (sc.bgColor) {
        overlay.style.background = sc.bgColor;
    }
    if (sc.textColor) overlay.style.color = sc.textColor;
    if (sc.fontFamily) overlay.style.fontFamily = sc.fontFamily;

    const titleEl = document.getElementById('start-title');
    if (SCENARIO_DATA.startTitle && titleEl) titleEl.innerText = SCENARIO_DATA.startTitle;

    const subtitleEl = document.getElementById('start-subtitle');
    if (subtitleEl && sc.subtitle) { subtitleEl.innerText = sc.subtitle; subtitleEl.style.display = ''; }

    const descEl = document.getElementById('start-description');
    if (descEl && sc.description) { descEl.innerText = sc.description; descEl.style.display = ''; }

    const footerEl = document.getElementById('start-footer');
    if (footerEl && sc.footer) { footerEl.innerText = sc.footer; footerEl.style.display = ''; }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        if (SCENARIO_DATA.startButtonText) startBtn.innerText = SCENARIO_DATA.startButtonText;
        if (sc.btnBgColor) startBtn.style.background = sc.btnBgColor;
        if (sc.btnTextColor) startBtn.style.color = sc.btnTextColor;
    }

    if(SCENARIO_DATA.scenes) {
        SCENARIO_DATA.scenes.forEach(scene => {
            if(scene.bgSrc) {
                const transClass = 'trans-' + (scene.transition || 'fade');
                if(scene.bgType === 'video') {
                    const vid = document.createElement('video');
                    vid.id = 'bg-' + scene.id;
                    vid.className = 'scene-bg ' + transClass;
                    vid.src = scene.bgSrc;
                    vid.loop = true;
                    vid.muted = false;
                    vid.playsInline = true;
                    bgLayer.appendChild(vid);
                } else {
                    const img = document.createElement('img');
                    img.id = 'bg-' + scene.id;
                    img.className = 'scene-bg ' + transClass;
                    img.src = scene.bgSrc;
                    bgLayer.appendChild(img);
                }
            }
        });
    }

    // If skip is enabled, jump directly to scene 1 without showing the overlay
    if (sc.skip) {
        overlay.style.display = 'none';
        setTimeout(startApp, 0);
        return; // don't show the overlay at all
    }

    // Reveal the overlay NOW that all config has been applied — user sees their version, not the HTML default
    overlay.style.opacity = '1';

    // Apply canvas aspect ratio from project config
    const ratio = (SCENARIO_DATA.canvasRatio || '16/9').split('/');
    const rw = parseFloat(ratio[0]) || 16;
    const rh = parseFloat(ratio[1]) || 9;
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
        appContainer.style.aspectRatio = rw + ' / ' + rh;
        appContainer.style.maxWidth = 'calc(100vh * (' + rw + ' / ' + rh + '))';
        appContainer.style.maxHeight = 'calc(100vw * (' + rh + ' / ' + rw + '))';
    }
}

function startApp() {
    overlay.style.display = 'none';
    // Show author credit badge if configured
    const creditEl = document.getElementById('player-credit');
    if (creditEl && SCENARIO_DATA.authorCredit) {
        creditEl.textContent = '© ' + SCENARIO_DATA.authorCredit;
        creditEl.style.display = 'block';
    }
    if(SCENARIO_DATA.globalAudioSrc) {
        globalAudioPlayer.src = SCENARIO_DATA.globalAudioSrc;
        globalAudioPlayer.volume = SCENARIO_DATA.globalVolume !== undefined ? SCENARIO_DATA.globalVolume : 0.2;
        globalAudioPlayer.play().catch(e => console.log('Global Audio blocked', e));
    }
    if(SCENARIO_DATA.enableScore) {
        document.getElementById('score-display').style.display = 'block';
    }
    if(SCENARIO_DATA.scenes && SCENARIO_DATA.scenes.length > 0) {
        goToScene(SCENARIO_DATA.scenes[0].id);
    }
}
window.startApp = startApp; // Ensure global access directly from HTML element onclick

function goToScene(sceneId, silent) {
    const scene = SCENARIO_DATA.scenes.find(s => s.id === sceneId);
    if(!scene) return;

    if(autoAdvanceTimeout) {
        clearTimeout(autoAdvanceTimeout);
        autoAdvanceTimeout = null;
    }
    btnContainer.classList.remove('active');
    
    setTimeout(() => {
        if(currentSceneId) {
            const oldBg = document.getElementById('bg-' + currentSceneId);
            if(oldBg) {
                oldBg.classList.remove('active');
                if(oldBg.tagName === 'VIDEO') oldBg.pause();
            }
        }

        currentSceneId = sceneId;
        let isLocalAudioActive = false;

        const newBg = document.getElementById('bg-' + scene.id);
        if(newBg) {
            newBg.classList.add('active');
            if(newBg.tagName === 'VIDEO') {
                newBg.muted = !!scene.videoMuted;
                newBg.currentTime = 0;
                const loopCount = parseInt(scene.videoLoopCount) || 0;
                const shouldAdvance = !!scene.videoAdvanceOnEnd || !!SCENARIO_DATA.clickToAdvance;

                if (loopCount === 0 && !shouldAdvance) {
                    // Infinite loop, no advance
                    newBg.loop = true;
                } else {
                    newBg.loop = false;
                    const targetLoops = loopCount === 0 ? 1 : loopCount; // if 0 but shouldAdvance, play once
                    let playsDone = 1;
                    newBg.onended = function() {
                        if (playsDone < targetLoops) {
                            newBg.currentTime = 0;
                            newBg.play();
                            playsDone++;
                        } else if (shouldAdvance) {
                            // Navigate to configured target or next scene
                            if (scene.videoAdvanceTarget) {
                                goToScene(scene.videoAdvanceTarget);
                            } else {
                                const idx = SCENARIO_DATA.scenes.findIndex(s => s.id === scene.id);
                                if (idx >= 0 && idx < SCENARIO_DATA.scenes.length - 1) {
                                    goToScene(SCENARIO_DATA.scenes[idx + 1].id);
                                }
                            }
                        }
                    };
                }
                newBg.play().catch(function(e) { console.log('Video play blocked', e); });
                if (!scene.videoMuted) isLocalAudioActive = true;
            }
        }

        if(!silent && scene.audioSrc) {
            if (!audioPlayer.src.endsWith(scene.audioSrc)) {
                audioPlayer.src = scene.audioSrc;
            }
            audioPlayer.currentTime = 0;
            audioPlayer.play().catch(e => console.log('Audio autoplay blocked', e));
            isLocalAudioActive = true;
        } else if (!silent) {
            audioPlayer.pause();
        }

        if (SCENARIO_DATA.globalAudioSrc) {
            const baseVol = SCENARIO_DATA.globalVolume !== undefined ? SCENARIO_DATA.globalVolume : 0.2;
            let targetVol = baseVol;
            if (!silent) {
                if (scene.customGlobalVolume !== undefined && scene.customGlobalVolume !== null && scene.customGlobalVolume !== '') {
                    targetVol = parseFloat(scene.customGlobalVolume);
                } else if (isLocalAudioActive) {
                    targetVol = baseVol * 0.15;
                }
            }
            fadeVolume(globalAudioPlayer, targetVol, 1500);
        }

        btnContainer.innerHTML = '';
        // Remove previous scene text overlay
        const oldSceneText = document.getElementById('scene-text-overlay');
        if (oldSceneText) oldSceneText.remove();
        // Render sceneText if present
        if (scene.sceneText) {
            const posMap = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
            const pos = scene.sceneTextPosition || 'bottom';
            const overlay = document.createElement('div');
            overlay.id = 'scene-text-overlay';
            const hex2rgba = (hex, alpha) => {
                const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
                return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
            };
            const bgHex = scene.sceneTextBg || '#000000';
            const bgAlpha = scene.sceneTextBgOpacity !== undefined ? scene.sceneTextBgOpacity : 0.5;
            overlay.style.cssText = [
                'position:absolute','inset:0','z-index:90','pointer-events:none',
                'display:flex','align-items:' + posMap[pos],'padding:16px',
                'box-sizing:border-box'
            ].join(';');
            const textBox = document.createElement('div');
            textBox.style.cssText = [
                'background:' + hex2rgba(bgHex, bgAlpha),
                'color:' + (scene.sceneTextColor || '#fff'),
                'font-size:calc(' + (scene.sceneTextSize || 18) + ' * 100cqi / 1280)',
                'padding:10px 16px',
                'border-radius:8px',
                'max-width:80%',
                'white-space:pre-wrap',
                'line-height:1.5'
            ].join(';');
            textBox.innerText = scene.sceneText;
            overlay.appendChild(textBox);
            document.getElementById('app-container').appendChild(overlay);
        }
        const ENTRY_MAP = {
            'fade':'anim-fade-in','slide-left':'anim-slide-left','slide-right':'anim-slide-right',
            'slide-up':'anim-slide-up','slide-down':'anim-slide-down',
            'zoom':'anim-zoom-in','bounce':'anim-bounce-in','flip':'anim-flip-in'
        };
        const EXIT_MAP = {
            'fade':'anim-fade-out','slide-left':'anim-slide-out-left','slide-right':'anim-slide-out-right',
            'slide-up':'anim-slide-out-up','slide-down':'anim-slide-out-down','zoom':'anim-zoom-out'
        };
        const LOOP_DUR = { float:'3s', pulse:'2s', shake:'0.5s', spin:'4s' };

        scene.buttons.forEach(btn => {
            const el = document.createElement('div');
            let classes = 'interactive-btn ' + (btn.imgSrc ? 'img-mode' : (btn.useGlassmorphism !== false ? 'glass-mode' : 'plain-mode'));
            if (btn.isDecorative) classes += ' decorative-mode';
            el.className = classes;
            el.style.left = btn.x + '%';
            el.style.top = btn.y + '%';
            el.style.width = btn.width + '%';
            el.style.height = btn.height + '%';

            if(btn.color) el.style.color = btn.color;
            if(btn.bgColor && btn.bgColor !== 'transparent') el.style.backgroundColor = btn.bgColor;
            el.style.fontSize = 'calc(' + (btn.fontSize || 16) + ' * 100cqi / 1280)';
            if(btn.isBold) el.style.fontWeight = 'bold';
            else el.style.fontWeight = 'normal';
            if(btn.fontFamily) el.style.fontFamily = btn.fontFamily;
            el.style.textAlign = btn.textAlign || 'center';
            el.style.justifyContent = btn.textAlign === 'left' ? 'flex-start' : btn.textAlign === 'right' ? 'flex-end' : 'center';
            el.style.alignItems = btn.textVAlign === 'top' ? 'flex-start' : btn.textVAlign === 'bottom' ? 'flex-end' : 'center';
            el.style.padding = '0';

            const transitionLayer = document.createElement('div');
            transitionLayer.className = 'btn-main-layer';
            el.appendChild(transitionLayer);

            const loopLayer = document.createElement('div');
            loopLayer.className = 'btn-loop-layer';
            transitionLayer.appendChild(loopLayer);

            // Propagate text alignment to inner layers (overrides CSS class defaults)
            const hAlign = btn.textAlign === 'left' ? 'flex-start' : btn.textAlign === 'right' ? 'flex-end' : 'center';
            const vAlign = btn.textVAlign === 'top' ? 'flex-start' : btn.textVAlign === 'bottom' ? 'flex-end' : 'center';
            transitionLayer.style.justifyContent = hAlign;
            transitionLayer.style.alignItems = vAlign;
            loopLayer.style.justifyContent = hAlign;
            loopLayer.style.alignItems = vAlign;
            loopLayer.style.textAlign = btn.textAlign || 'center';

            if(btn.imgSrc) {
                const img = document.createElement('img');
                img.src = btn.imgSrc;
                img.draggable = false;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                loopLayer.appendChild(img);
            } else {
                loopLayer.innerText = btn.text || '';
                loopLayer.style.padding = '10px';
            }


            const entryKey = ENTRY_MAP[btn.entryAnim];
            const entryDelay = parseFloat(btn.entryDelay) || 0;
            const entryDur   = parseFloat(btn.entryDuration) || 0.6;
            const loopAnim   = btn.loopAnim || 'none';
            const exitKey    = EXIT_MAP[btn.exitAnim];
            const exitAt     = parseFloat(btn.exitAt) || 0;
            const exitDur    = parseFloat(btn.exitDuration) || 0.5;

            if (entryKey) {
                transitionLayer.style.opacity = '0';
                transitionLayer.style.animation = entryKey + ' ' + entryDur + 's ease ' + entryDelay + 's both';
            }

            if (loopAnim !== 'none') {
                const loopStartDelay = entryKey ? (entryDelay + entryDur) : entryDelay;
                loopLayer.style.animation = 'loop-' + loopAnim + ' ' + (LOOP_DUR[loopAnim] || '2s') + ' ' + loopStartDelay + 's ease-in-out infinite';
            }

            if (exitKey && exitAt > 0) {
                setTimeout(function() {
                    transitionLayer.style.animation = exitKey + ' ' + exitDur + 's ease forwards';
                    setTimeout(function() { el.style.display = 'none'; }, exitDur * 1000);
                }, exitAt * 1000);
            }

            if (!btn.isDecorative) {
                el.onclick = (e) => {
                    e.stopPropagation();
                    if (SCENARIO_DATA.enableScore && btn.points) {
                        currentScore += parseInt(btn.points);
                        document.getElementById('score-val').innerText = currentScore;
                        const scoreBox = document.getElementById('score-display');
                        scoreBox.style.transform = 'scale(1.2)';
                        setTimeout(() => { scoreBox.style.transform = 'scale(1)'; }, 200);
                    }
                    const action = btn.actionType || 'navigate';

                    // Helper: execute the actual navigation action
                    const executeAction = () => {
                        if (action === 'go-start') {
                            if (SCENARIO_DATA.scenes.length > 0) goToScene(SCENARIO_DATA.scenes[0].id, !!btn.silentNav);
                        } else if (action === 'go-previous') {
                            const ci = SCENARIO_DATA.scenes.findIndex(s => s.id === currentSceneId);
                            if (ci > 0) goToScene(SCENARIO_DATA.scenes[ci - 1].id, !!btn.silentNav);
                        } else if (action === 'go-next') {
                            const ci = SCENARIO_DATA.scenes.findIndex(s => s.id === currentSceneId);
                            if (ci !== -1 && ci < SCENARIO_DATA.scenes.length - 1) goToScene(SCENARIO_DATA.scenes[ci + 1].id, !!btn.silentNav);
                        } else if (action === 'close') {
                            window.close();
                            setTimeout(function() {
                                var endEl = document.createElement('div');
                                endEl.style.cssText = 'position:fixed;inset:0;background:#0a0a0a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:20px;font-family:inherit;text-align:center;padding:40px;';
                                endEl.innerHTML = '<div style="font-size:4em">\u2705<\/div><h2 style="font-size:2em;font-weight:bold;margin:0">Actividad finalizada<\/h2><p style="opacity:0.6;font-size:1.1em;">Pod\u00e9s cerrar esta pesta\u00f1a.<\/p>';
                                document.body.appendChild(endEl);
                            }, 350);
                        } else if (btn.targetSceneId) {
                            goToScene(btn.targetSceneId, !!btn.silentNav);
                        }
                    };

                    if (action === 'popup') {
                        const _pt = document.getElementById('popup-text');
                        const _ptRaw = btn.popupText || '';
                        const parts = _ptRaw.split('**');
                        let html = '';
                        for(let i=0; i<parts.length; i++) html += (i % 2 === 1) ? '<strong>' + parts[i] + '<\/strong>' : parts[i];
                        _pt.innerHTML = html;
                        popupOverlay.style.display = 'flex';
                        const prevContinue = document.getElementById('popup-continue');
                        if (prevContinue) prevContinue.remove();
                    } else if (btn.feedbackText) {
                        // Show feedback popup then execute action on Continuar
                        const popupTextEl = document.getElementById('popup-text');
                        const _fbRaw = btn.feedbackText || '';
                        const parts = _fbRaw.split('**');
                        let html = '';
                        for(let i=0; i<parts.length; i++) html += (i % 2 === 1) ? '<strong>' + parts[i] + '<\/strong>' : parts[i];
                        popupTextEl.innerHTML = html;
                        popupTextEl.style.fontWeight = btn.feedbackBold ? 'bold' : 'normal';
                        popupTextEl.style.fontSize = 'calc(' + (btn.feedbackFontSize || 20) + ' * 100cqi / 1280)';
                        popupOverlay.style.display = 'flex';
                        const prevContinue = document.getElementById('popup-continue');
                        if (prevContinue) prevContinue.remove();
                        const continueBtn = document.createElement('button');
                        continueBtn.id = 'popup-continue';
                        continueBtn.innerText = 'Continuar ▶';
                        continueBtn.style.cssText = 'display:block;margin:calc(14 * 100cqi / 1280) auto 0;background:#e94560;color:#fff;border:none;border-radius:calc(6 * 100cqi / 1280);padding:calc(8 * 100cqi / 1280) calc(22 * 100cqi / 1280);font-size:calc(18 * 100cqi / 1280);cursor:pointer;font-weight:bold;';
                        continueBtn.onclick = () => {
                            continueBtn.onclick = null;
                            executeAction();
                            setTimeout(() => {
                                popupOverlay.style.transition = 'opacity 0.4s ease';
                                popupOverlay.style.opacity = '0';
                                setTimeout(() => {
                                    popupOverlay.style.display = 'none';
                                    popupOverlay.style.opacity = '1';
                                    popupOverlay.style.transition = '';
                                    continueBtn.remove();
                                }, 400);
                            }, 500);
                        };
                        document.getElementById('popup-text').after(continueBtn);
                    } else {
                        executeAction();
                    }
                };
            }
            btnContainer.appendChild(el);
        });

        setTimeout(() => {
            btnContainer.classList.add('active');
        }, 100);

        if(scene.autoAdvanceTime > 0) {
            const idx = SCENARIO_DATA.scenes.findIndex(s => s.id === scene.id);
            let targetId = scene.autoAdvanceTarget;
            if (!targetId && idx !== -1 && idx < SCENARIO_DATA.scenes.length - 1) {
                targetId = SCENARIO_DATA.scenes[idx + 1].id;
            }
            if (targetId) {
                autoAdvanceTimeout = setTimeout(() => {
                    goToScene(targetId);
                }, scene.autoAdvanceTime * 1000);
            }
        }
    }, 400);
}

document.getElementById('app-container').addEventListener('click', (e) => {
    if(e.target.closest('.interactive-btn') || document.getElementById('start-overlay').style.display !== 'none') return;
    if(currentSceneId) {
        const idx = SCENARIO_DATA.scenes.findIndex(s => s.id === currentSceneId);
        if(idx !== -1) {
            const currentScene = SCENARIO_DATA.scenes[idx];
            if (!currentScene.clickToAdvance && !SCENARIO_DATA.clickToAdvance) return;
            const targetId = currentScene.clickAdvanceTarget ||
                (idx < SCENARIO_DATA.scenes.length - 1 ? SCENARIO_DATA.scenes[idx + 1].id : null);
            if (targetId) goToScene(targetId);
        }
    }
});

function makeBtnEl(cfg) {
    const el = document.createElement('div');
    el.className = 'interactive-btn ' + (cfg.useGlassmorphism !== false ? 'glass-mode' : 'plain-mode');
    el.style.cssText = [
        'position:absolute', 'z-index:500',
        'left:' + cfg.x + '%', 'top:' + cfg.y + '%',
        'width:' + cfg.width + '%', 'height:' + cfg.height + '%',
        'color:' + (cfg.color || '#fff'),
        'font-weight:' + (cfg.isBold ? 'bold' : 'normal'),
        'font-family:' + (cfg.fontFamily || 'inherit'),
        'font-size:calc(' + (cfg.fontSize || 16) + ' * 100cqi / 1280)',
        'pointer-events:auto', 'cursor:pointer',
        'display:flex', 'align-items:center', 'justify-content:center',
    ].join(';');
    if (cfg.bgColor && cfg.bgColor !== 'transparent') el.style.backgroundColor = cfg.bgColor;
    el.innerText = cfg.text || '';
    return el;
}

function renderGlobalButtons() {
    // Legacy single globalButton (from Options modal, kept for backward compat)
    const gb = SCENARIO_DATA && SCENARIO_DATA.globalButton;
    if (gb && gb.enabled) {
        const el = makeBtnEl(gb);
        el.id = 'global-btn-legacy';
        el.onclick = (e) => {
            e.stopPropagation();
            const targetIndex = typeof gb.targetSceneIndex === 'number' ? gb.targetSceneIndex : 0;
            const targetScene = SCENARIO_DATA.scenes[targetIndex];
            if (targetScene) goToScene(targetScene.id);
        };
        document.getElementById('app-container').appendChild(el);
    }

    // New per-button globalButtons array
    const gbs = (SCENARIO_DATA && SCENARIO_DATA.globalButtons) || [];
    gbs.forEach(function(cfg) {
        const el = makeBtnEl(cfg);
        el.id = 'global-btn-' + cfg.id;
        el.onclick = (e) => {
            e.stopPropagation();
            const action = cfg.actionType || 'navigate';
            if (action === 'go-start') {
                if (SCENARIO_DATA.scenes.length > 0) goToScene(SCENARIO_DATA.scenes[0].id);
            } else if (action === 'go-previous') {
                const currentIdx = SCENARIO_DATA.scenes.findIndex(s => s.id === currentSceneId);
                if (currentIdx > 0) goToScene(SCENARIO_DATA.scenes[currentIdx - 1].id);
            } else if (action === 'go-next') {
                const currentIdx = SCENARIO_DATA.scenes.findIndex(s => s.id === currentSceneId);
                if (currentIdx !== -1 && currentIdx < SCENARIO_DATA.scenes.length - 1) goToScene(SCENARIO_DATA.scenes[currentIdx + 1].id);
            } else if (cfg.targetSceneId) {
                goToScene(cfg.targetSceneId);
            }
        };
        document.getElementById('app-container').appendChild(el);
    });
}

init();

// Hook into startApp to render global buttons after app starts
const _origStartApp = startApp;
window.startApp = function() {
    _origStartApp();
    renderGlobalButtons();
    
    // Author Credit
    if (SCENARIO_DATA && SCENARIO_DATA.authorCredit) {
        const credit = document.createElement('div');
        credit.innerText = SCENARIO_DATA.authorCredit;
        credit.style.cssText = 'position:absolute; bottom:8px; right:12px; font-size:10px; color:rgba(255,255,255,0.4); z-index:999; pointer-events:none; font-family:sans-serif; letter-spacing:0.02em;';
        document.getElementById('app-container').appendChild(credit);
    }
};
