// ========== ESTADO GLOBAL ==========
let campaignData = {
    name: '',
    date: new Date().toISOString().split('T')[0],
    players: [],
    quests: [],
    combatants: [],
    npcs: [],
    locations: [],
    treasure: [],
    sessions: []
};

let diceHistory = [];
let currentTurnIndex = -1;
let currentRound = 1;

// Esperar a que el HTML cargue completamente
document.addEventListener('DOMContentLoaded', () => {
    console.log("🟢 Iniciando Gestor de D&D");
    loadCampaign();
    setupSidebarNavigation(); // NUEVA FUNCIÓN DE NAV
    setupEventListeners();
    renderAll();
    console.log("✅ Todo cargado.");
});

// ========== NAVEGACIÓN (Sidebar) ==========
// Función auxiliar para llamar desde el HTML (ej: onclick de quick cards)
function switchTab(tabId) {
    // Buscar el botón correspondiente en el sidebar y hacerle clic
    const sidebarBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if(sidebarBtn) {
        sidebarBtn.click();
    }
}

function setupSidebarNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const contents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Quitar clase activa de todos los botones y secciones
            navButtons.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Añadir clase activa al botón presionado
            btn.classList.add('active');
            
            // Mostrar el contenido correspondiente
            const targetId = btn.dataset.tab;
            const targetContent = document.getElementById(targetId);
            if(targetContent) {
                targetContent.classList.add('active');
            } else {
                console.error(`❌ No se encontró la sección: ${targetId}`);
            }
        });
    });
}

// ========== CARGA Y GUARDADO ==========
function loadCampaign() {
    try {
        const saved = localStorage.getItem('dndCampaignMaster_v2'); // Nueva versión para caché limpia
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(campaignData, parsed); // Manera más limpia de mezclar datos
            if(!campaignData.date) campaignData.date = new Date().toISOString().split('T')[0];
            console.log("💾 Datos cargados.");
        }
    } catch (error) {
        console.error("❌ Error LocalStorage.", error);
    }
}

function saveCampaign() {
    localStorage.setItem('dndCampaignMaster_v2', JSON.stringify(campaignData));
    updateDashboardSummary(); // Dashboard Summary en lugar del viejo updateDashboard
}

// Centraliza todos los renderizados
function renderAll() {
    updateDashboardSummary(); 
    renderPlayersList(); 
    renderQuestsList(); 
    renderCombatManager();
    renderNPCsList(); 
    renderLocationsList(); 
    renderTreasureList(); 
    renderSessionsHistory();
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Inputs generales de cabecera
    const campName = document.getElementById('campaignName');
    if(campName) campName.addEventListener('input', (e) => { campaignData.name = e.target.value; saveCampaign(); });
    
    const campDate = document.getElementById('campaignDate'); // Calendario en Dashboard
    if(campDate) campDate.addEventListener('change', (e) => { campaignData.date = e.target.value; saveCampaign(); });
    
    // Formularios
    const forms = {
        'playerForm': addPlayer, 'questForm': addQuest, 'combatForm': addCombatant,
        'npcForm': addNPC, 'locationForm': addLocation, 'sessionForm': addSession,
        'treasureForm': addTreasure
    };

    for (let id in forms) {
        const form = document.getElementById(id);
        if (form) form.addEventListener('submit', forms[id]);
    }
    
    // Controles de Combate
    document.getElementById('nextTurnBtn')?.addEventListener('click', handleNextTurn);
    document.getElementById('clearCombatBtn')?.addEventListener('click', handleClearCombat);
    
    // Botón Dashboard -> Historial
    document.getElementById('newSessionBtn')?.addEventListener('click', () => switchTab('history'));
    
    // Botón Loot
    document.getElementById('generateLootBtn')?.addEventListener('click', handleGenerateLootPo);
    
    // Dados
    document.getElementById('rollBtn')?.addEventListener('click', handleManualDiceRoll);
    document.querySelectorAll('[data-quick]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const [count, sides] = e.currentTarget.dataset.quick.split('d').map(Number);
            executeDiceRoll(count, sides, 0);
        });
    });
}

// ========== LÓGICA DASHBOARD (Resumen) ==========
function updateDashboardSummary() {
    // Nombre e info general
    const campNameInput = document.getElementById('campaignName');
    if(campNameInput) campNameInput.value = campaignData.name || '';
    
    const campDateInput = document.getElementById('campaignDate');
    if(campDateInput) campDateInput.value = campaignData.date;
    
    // Contadores
    const sets = {
        'sessionCount': campaignData.sessions.length,
        'playerCount': campaignData.players.length,
        'questCount': campaignData.quests.length,
        'npcCount': campaignData.npcs.length
    };
    for (let id in sets) {
        const el = document.getElementById(id);
        if(el) el.textContent = sets[id];
    }

    // Render Misiones Críticas (upcoming sessions en foto)
    const listEl = document.getElementById('upcomingQuests');
    if(listEl) {
        // Filtrar misiones de importancia alta o media y activas
        const criticalQuests = campaignData.quests
            .filter(q => q.status === 'activa' && (q.importance === 'alta' || q.importance === 'media'));
            
        listEl.innerHTML = criticalQuests.slice(0, 3).map(q => 
            `<div class="sess-item">
                <span class="card-icon">📜</span>
                <div class="sess-info">
                    <h4>${q.title}</h4>
                    <p style="color:${q.importance === 'alta' ? 'var(--danger)' : 'var(--accent)'}">${q.importance.toUpperCase()} | Recompensa: ${q.reward || 0}</p>
                </div>
            </div>`
        ).join('') || `<p style="color: var(--text-secondary); font-size:12px; padding:10px;">No hay misiones críticas activas.</p>`;
    }
}

// ========== PJS ==========
function addPlayer(e) {
    e.preventDefault();
    const data = {
        player: document.getElementById('playerName').value, 
        character: document.getElementById('characterName').value,
        class: document.getElementById('characterClass').value, 
        race: document.getElementById('playerRace').value,
        level: document.getElementById('playerLevel').value, 
        hp: document.getElementById('playerHP').value,
        ac: document.getElementById('playerAC').value, 
        str: document.getElementById('pjSTR').value,   
        dex: document.getElementById('pjDEX').value,
        con: document.getElementById('pjCON').value,
        int: document.getElementById('pjINT').value,
        wis: document.getElementById('pjWIS').value,
        cha: document.getElementById('pjCHA').value
    };
    campaignData.players.push(data);
    e.target.reset(); saveCampaign(); renderPlayersList();
}

function renderPlayersList() {
    const list = document.getElementById('playersList');
    if(!list) return;
    list.innerHTML = campaignData.players.map((p, i) => 
        `<li style="flex-direction: column; align-items: stretch; border-left: 4px solid var(--accent);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <strong style="font-size: 16px;">${p.character}</strong> <small style="color: var(--text-secondary);">(${p.player})</small><br>
                    <small style="color: var(--accent); font-weight: 600;">${p.race} ${p.class} - Nivel ${p.level}</small>
                </div>
                <button onclick="handleDeleteItem('players', ${i})">X</button>
            </div>
            
            <div style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-size: 12px; color: var(--text-primary); display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>FUE:${p.str || 10}</span><span>DES:${p.dex || 10}</span><span>CON:${p.con || 10}</span><span>INT:${p.int || 10}</span><span>SAB:${p.wis || 10}</span><span>CAR:${p.cha || 10}</span>
            </div>
            
            <div style="font-size: 14px;">
                <span style="color: var(--success); font-weight: 800; margin-right: 15px;">HP: ${p.hp || 0}</span> 
                <span style="font-weight: bold;">CA: ${p.ac || 10}</span>
            </div>
        </li>`
    ).join('');
}

// ========== MISIONES ==========
function addQuest(e) {
    e.preventDefault();
    campaignData.quests.push({
        title: document.getElementById('questTitle').value, 
        desc: document.getElementById('questDescription').value,
        importance: document.getElementById('questImportance').value, 
        status: document.getElementById('questStatus').value,
        reward: document.getElementById('questReward').value
    });
    e.target.reset(); saveCampaign(); renderQuestsList();
}

function renderQuestsList() {
    const list = document.getElementById('questsList');
    if(!list) return;
    const colors = { completada: 'var(--success)', activa: '#3b82f6', pendiente: 'var(--accent)' };
    list.innerHTML = campaignData.quests.map((q, i) => 
        `<li style="border-left-color: ${colors[q.status] || 'var(--border-color)'}">
            <div>
                <strong>${q.title}</strong> <small>(${q.status})</small><br>
                <small>${q.importance.toUpperCase()} - ${q.desc}</small>
            </div>
            <button onclick="handleDeleteItem('quests', ${i})">X</button>
        </li>`
    ).join('');
}

// ========== COMBATE ==========
function addCombatant(e) {
    e.preventDefault();
    campaignData.combatants.push({
        name: document.getElementById('charName').value, 
        init: Number(document.getElementById('charInit').value),
        hp: Number(document.getElementById('charHP').value), 
        ac: document.getElementById('charAC').value,
        type: document.getElementById('combatantType').value
    });
    campaignData.combatants.sort((a, b) => b.init - a.init);
    e.target.reset(); saveCampaign(); renderCombatManager();
}

function renderCombatManager() {
    const list = document.getElementById('combatList');
    if(!list) return;
    list.innerHTML = campaignData.combatants.map((c, i) => 
        `<li class="combat-item ${i === currentTurnIndex ? 'active-turn' : ''}">
            <div class="item-header">
                <div><strong>${c.name}</strong> <span class="status-tag">(${c.type})</span></div>
                <div style="font-size:12px">Init: <strong>${c.init}</strong> | AC: <strong>${c.ac}</strong></div>
            </div>
            <div class="hp-controls">
                <span class="hp-display">HP: ${c.hp}</span>
                <input type="number" id="dmg-${i}" placeholder="Cant.">
                <button class="primary-btn" style="background:#e74c3c; color:white;" onclick="modifyHP(${i}, -1)">- Daño</button>
                <button class="primary-btn" style="background:var(--success); color:white;" onclick="modifyHP(${i}, 1)">+ Cura</button>
                <button class="clear-btn" style="padding: 8px;" onclick="handleDeleteItem('combatants', ${i})">X</button>
            </div>
        </li>`
    ).join('');
    
    // Actualizar display de turno actual
    const turnDisplay = document.getElementById('currentTurn');
    if (turnDisplay) {
        if(campaignData.combatants.length > 0 && currentTurnIndex >= 0) {
            turnDisplay.textContent = campaignData.combatants[currentTurnIndex].name;
            turnDisplay.style.color = "var(--accent)";
        } else {
            turnDisplay.textContent = "Ninguno";
            turnDisplay.style.color = "var(--text-secondary)";
        }
    }
}

function modifyHP(index, mult) {
    const inputEl = document.getElementById(`dmg-${index}`);
    const val = Number(inputEl.value);
    if(val) {
        campaignData.combatants[index].hp += (val * mult);
        if(campaignData.combatants[index].hp < 0) campaignData.combatants[index].hp = 0;
        inputEl.value = ''; 
        saveCampaign(); renderCombatManager();
    }
}

function handleNextTurn() {
    if(campaignData.combatants.length === 0) return;
    currentTurnIndex++;
    if(currentTurnIndex >= campaignData.combatants.length) {
        currentTurnIndex = 0; 
        currentRound++; 
        document.getElementById('currentRound').textContent = currentRound;
    }
    renderCombatManager();
}

function handleClearCombat() {
    if(confirm('¿Limpiar todo el combate?')) {
        campaignData.combatants = []; currentTurnIndex = -1; currentRound = 1;
        document.getElementById('currentRound').textContent = 1; 
        saveCampaign(); renderCombatManager();
    }
}

// ========== NPCs ==========
function addNPC(e) {
    e.preventDefault();
    campaignData.npcs.push({
        name: document.getElementById('npcName').value, 
        role: document.getElementById('npcRole').value,
        desc: document.getElementById('npcDescription').value, 
        allegiance: document.getElementById('npcAllegiance').value,
        loc: document.getElementById('npcLocation').value
    });
    e.target.reset(); saveCampaign(); renderNPCsList();
}

function renderNPCsList() {
    const list = document.getElementById('npcsList');
    if(!list) return;
    const colors = { aliado: 'var(--success)', enemigo: 'var(--danger)', neutral: '#f1c40f' };
    list.innerHTML = campaignData.npcs.map((n, i) => 
        `<li style="border-left-color: ${colors[n.allegiance]}">
            <div>
                <strong>${n.name}</strong> - ${n.role}<br>
                <small>📍 ${n.loc} | ${n.desc}</small>
            </div>
            <button onclick="handleDeleteItem('npcs', ${i})">X</button>
        </li>`
    ).join('');
}

// ========== MUNDO ==========
function addLocation(e) {
    e.preventDefault();
    campaignData.locations.push({
        name: document.getElementById('locationName').value, 
        type: document.getElementById('locationType').value,
        desc: document.getElementById('locationDescription').value, 
        conn: document.getElementById('locationConnections').value
    });
    e.target.reset(); saveCampaign(); renderLocationsList();
}

function renderLocationsList() {
    const list = document.getElementById('locationsList');
    if(!list) return;
    list.innerHTML = campaignData.locations.map((l, i) => 
        `<li>
            <div><strong>${l.name}</strong> (${l.type})<br><small>${l.desc} | Conecta: ${l.conn}</small></div>
            <button onclick="handleDeleteItem('locations', ${i})">X</button>
        </li>`
    ).join('');
}

// ========== LOOT ==========
function addTreasure(e) {
    e.preventDefault();
    campaignData.treasure.push({
        name: document.getElementById('treasureName').value, 
        type: document.getElementById('treasureType').value,
        val: document.getElementById('treasureValue').value, 
        desc: document.getElementById('treasureDescription').value
    });
    e.target.reset(); saveCampaign(); renderTreasureList();
}

function renderTreasureList() {
    const list = document.getElementById('treasureList');
    if(!list) return;
    list.innerHTML = campaignData.treasure.map((t, i) => 
        `<li>
            <div><strong>${t.name}</strong> (${t.type})<br><small>${t.val} po | ${t.desc}</small></div>
            <button onclick="handleDeleteItem('treasure', ${i})">X</button>
        </li>`
    ).join('');
}

function handleGenerateLootPo() {
    const cr = Number(document.getElementById('lootCR').value) || 1; 
    const count = Number(document.getElementById('lootCount').value) || 1;
    // Fórmula de oro aleatoria basada en CR
    const basePo = (cr * 50) + Math.floor(Math.random() * (cr * 20));
    const totalGold = basePo * count;
    
    const resultEl = document.getElementById('lootResult');
    if(resultEl) {
        resultEl.textContent = `💰 ${totalGold.toLocaleString('es-CL')} Piezas de Oro`;
        resultEl.style.color = "var(--accent)";
    }
}

// ========== HISTORIAL SESIONES ==========
function addSession(e) {
    e.preventDefault();
    // unshift para añadir al principio (lo más reciente arriba)
    campaignData.sessions.unshift({
        number: document.getElementById('sessionNumber').value, 
        date: document.getElementById('sessionDate').value,
        notes: document.getElementById('sessionNotes').value, 
        importance: document.getElementById('sessionImportance').value
    });
    e.target.reset(); 
    // Reset date input a hoy
    document.getElementById('sessionDate').value = new Date().toISOString().split('T')[0];
    saveCampaign(); 
    renderSessionsHistory();
}

function renderSessionsHistory() {
    const list = document.getElementById('sessionsList');
    if(!list) return;
    const colors = { normal: '#444', importante: 'var(--accent)', critica: 'var(--danger)' };
    list.innerHTML = campaignData.sessions.map((s, i) => 
        `<li style="border-left-color: ${colors[s.importance]}">
            <div style="width:100%">
                <strong>Sesión ${s.number}</strong> <span style="color:var(--text-secondary); font-size:11px;">- ${s.date}</span><br>
                <div class="timeline-notes">${s.notes}</div>
            </div>
            <button onclick="handleDeleteItem('sessions', ${i})">X</button>
        </li>`
    ).join('');
}

// ========== DADOS ==========
function handleManualDiceRoll() {
    const count = Number(document.getElementById('diceCount').value) || 1;
    const sides = Number(document.getElementById('diceSides').value);
    const mod = Number(document.getElementById('diceModifier').value) || 0;
    executeDiceRoll(count, sides, mod);
}

function executeDiceRoll(count, sides, mod) {
    let rolls = []; let totalNoMod = 0;
    for(let i=0; i<count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll); totalNoMod += roll;
    }
    const final = totalNoMod + mod;
    const modStr = mod !== 0 ? (mod > 0 ? `+${mod}` : mod) : '';
    
    // UI FANCY
    document.querySelector('.result-card-fancy .result-value').textContent = final;
    document.getElementById('diceBreakdown').textContent = `(${rolls.join('+')})${modStr} = ${final}`;
    
    // Historial
    diceHistory.unshift(`${count}d${sides}${modStr} ➔ <strong>${final}</strong>`);
    if(diceHistory.length > 10) diceHistory.pop();
    
    const historyList = document.getElementById('diceHistory');
    if(historyList) {
        historyList.innerHTML = diceHistory.map(h => `<li style="justify-content:center; padding:10px;">${h}</li>`).join('');
    }
}

// ========== UTILIDAD CENTRALIZADA DE BORRADO ==========
function handleDeleteItem(arrayName, index) {
    if(confirm('¿Eliminar elemento?')) {
        
        // Corrección de lógica para no perder el turno si eliminas a un combatiente previo en la lista
        if (arrayName === 'combatants') {
            if (index < currentTurnIndex) {
                currentTurnIndex--;
            } else if (index === currentTurnIndex && currentTurnIndex >= campaignData.combatants.length - 1) {
                currentTurnIndex = 0; // Vuelve al inicio si era el último
            }
        }

        campaignData[arrayName].splice(index, 1);
        saveCampaign(); 
        renderAll();
    }
}
// ========== SISTEMA DE LOGIN ==========
function checkLoginState() {
    const isLoggedIn = localStorage.getItem('qm_logged_in');
    const loginScreen = document.getElementById('loginScreen');
    const appScreen = document.getElementById('appScreen');
    
    if(isLoggedIn === 'true') {
        // Mostrar App, Ocultar Login
        loginScreen.style.display = 'none';
        appScreen.style.display = 'flex'; // Usamos flex porque el app-container lo requiere
        
        // Personalizar mensaje de bienvenida
        const savedUser = localStorage.getItem('qm_username') || 'Maestro';
        const welcomeBlock = document.querySelector('.welcome-block h2');
        if(welcomeBlock) welcomeBlock.textContent = `¡Bienvenido, ${savedUser}!`;
    } else {
        // Mostrar Login, Ocultar App
        loginScreen.style.display = 'flex';
        appScreen.style.display = 'none';
    }
}

// Interceptar el formulario de Login
document.addEventListener('DOMContentLoaded', () => {
    // 1. Revisar estado al cargar la página
    checkLoginState();
    
    // 2. Evento del formulario de Login
    const loginForm = document.getElementById('loginForm');
    if(loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = document.getElementById('usernameInput').value;
    
            const pass = document.getElementById('passwordInput').value;

            // Guardar sesión en LocalStorage
            localStorage.setItem('qm_logged_in', 'true');
            localStorage.setItem('qm_username', user);
            
            // Entrar
            checkLoginState();
        });
    }

    // 3. Conectar el botón de Cerrar Sesión del Sidebar
    const logoutBtn = document.querySelector('.logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(confirm('¿Seguro que quieres cerrar sesión?')) {
                localStorage.removeItem('qm_logged_in');
                checkLoginState();
            }
        });
    }
});

function renderBestiary() {
    const list = document.getElementById('monstersList');
    if(!list || !campaignData.bestiary) return;
    list.innerHTML = campaignData.bestiary.map((m, i) => 
        `<li class="bestiary-item">
            <div class="bestiary-header">
                <strong>${m.name} <span class="cr-type">(CR ${m.cr} | ${m.type})</span></strong>
                <div>
                    <button class="action-btn primary-btn" style="padding:4px 8px; font-size:10px; margin-right:5px; color: black;" onclick="addMonsterToCombat(${i})">⚔️ A Combate</button>
                    <button onclick="handleDeleteItem('bestiary', ${i})">X</button>
                </div>
            </div>
            <div class="bestiary-stats-row">
                <span>FUE:${m.str}</span><span>DES:${m.dex}</span><span>CON:${m.con}</span><span>INT:${m.int}</span><span>SAB:${m.wis}</span><span>CAR:${m.cha}</span>
            </div>
            <div class="bestiary-combat-info">
                <span class="hp">HP: ${m.hp}</span> <span>CA: ${m.ac}</span>
            </div>
            <div class="bestiary-actions">${m.actions}</div>
        </li>`
    ).join('');
}