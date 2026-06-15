// ========== 1. SEGURIDAD (ANTI-XSS) ==========
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// ========== 2. ESTADO GLOBAL ==========
let campaignData = {
    name: '', date: new Date().toISOString().split('T')[0],
    players: [], quests: [], combatants: [], npcs: [], locations: [],
    treasure: [], sessions: [], bestiary: [], combatEnvironment: null
};

let diceHistory = [];
let currentTurnIndex = -1;
let currentRound = 1;
let currentUserRole = 'DM';

document.addEventListener('DOMContentLoaded', () => {
    checkLoginState();
    setupEventListeners();
});

// ========== 3. ROLES Y LOGIN ==========
function checkLoginState() {
    const isLoggedIn = localStorage.getItem('qm_logged_in');
    const loginScreen = document.getElementById('loginScreen');
    const appScreen = document.getElementById('appScreen');
    
    if(isLoggedIn === 'true') {
        loginScreen.style.display = 'none'; appScreen.style.display = 'flex'; 
        const savedUser = escapeHTML(localStorage.getItem('qm_username') || 'Usuario');
        currentUserRole = localStorage.getItem('qm_role') || 'DM'; 
        
        const welcomeBlock = document.querySelector('.welcome-block h2');
        if(welcomeBlock) welcomeBlock.textContent = `¡Bienvenido, ${savedUser}!`;
        
        applyRoleRestrictions();
        loadCampaign();
        renderAll();
    } else {
        loginScreen.style.display = 'flex'; appScreen.style.display = 'none';
    }
}

function applyRoleRestrictions() {
    const dmOnlyElements = document.querySelectorAll('.dm-only-element');
    dmOnlyElements.forEach(el => { el.style.display = currentUserRole === 'PLAYER' ? 'none' : ''; });
    const roleBadge = document.getElementById('roleBadgeDisplay');
    if(roleBadge) {
        roleBadge.textContent = currentUserRole === 'DM' ? '👑 DM' : '⚔️ Jugador';
        roleBadge.style.color = currentUserRole === 'DM' ? 'var(--accent)' : '#3b82f6';
    }
}

// ========== 4. PERSISTENCIA ==========
function loadCampaign() {
    try {
        const saved = localStorage.getItem('qm_mega_build');
        if (saved) Object.assign(campaignData, JSON.parse(saved));
        ['players','quests','combatants','npcs','locations','treasure','sessions','bestiary'].forEach(key => {
            if(!campaignData[key]) campaignData[key] = [];
        });
    } catch (e) { console.error("Error cargando.", e); }
}

function saveCampaign() {
    localStorage.setItem('qm_mega_build', JSON.stringify(campaignData));
    updateDashboardSummary();
}

function renderAll() {
    updateDashboardSummary(); renderPlayersList(); renderBestiary();
    renderCombatManager(); renderEnvironment(); renderQuestsList(); 
    renderNPCsList(); renderLocationsList(); renderTreasureList(); renderSessionsHistory();
}

// ========== 5. EVENTOS GLOBALES ==========
function switchTab(tabId) {
    const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if(btn) btn.click();
}

function setupEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        localStorage.setItem('qm_logged_in', 'true');
        localStorage.setItem('qm_username', document.getElementById('usernameInput').value);
        localStorage.setItem('qm_role', document.getElementById('passwordInput').value ? 'DM' : 'PLAYER');
        checkLoginState();
    });

    document.querySelector('.logout-btn')?.addEventListener('click', () => {
        if(confirm('¿Cerrar sesión?')) { localStorage.removeItem('qm_logged_in'); checkLoginState(); }
    });

    const navButtons = document.querySelectorAll('.nav-btn');
    const contents = document.querySelectorAll('.tab-content');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab)?.classList.add('active');
        });
    });

    document.getElementById('campaignName')?.addEventListener('input', (e) => { campaignData.name = e.target.value; saveCampaign(); });

    const forms = {
        'playerForm': addPlayer, 'monsterForm': addMonster, 'combatForm': addManualCombatant,
        'questForm': addQuest, 'npcForm': addNPC, 'locationForm': addLocation, 
        'sessionForm': addSession, 'treasureForm': addTreasure
    };
    for (let id in forms) { document.getElementById(id)?.addEventListener('submit', forms[id]); }

    document.getElementById('nextTurnBtn')?.addEventListener('click', handleNextTurn);
    document.getElementById('clearCombatBtn')?.addEventListener('click', handleClearCombat);
    document.getElementById('generateLootBtn')?.addEventListener('click', handleGenerateLootPo);
    document.getElementById('loadDefaultMonstersBtn')?.addEventListener('click', loadDefaultMonsters);
    document.getElementById('generateMapBtn')?.addEventListener('click', handleMapGeneration);
    document.getElementById('generateConsequencesBtn')?.addEventListener('click', handleConsequences);

    document.getElementById('rollBtn')?.addEventListener('click', handleManualDiceRoll);
    document.querySelectorAll('[data-quick]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const [count, sides] = e.currentTarget.dataset.quick.split('d').map(Number);
            executeDiceRoll(count, sides, 0);
        });
    });
}

// ========== 6. AUTO-NIVEL Y DASHBOARD ==========
function updateDashboardSummary() {
    const campNameInput = document.getElementById('campaignName');
    if(campNameInput) campNameInput.value = campaignData.name || '';
    
    // Auto-nivel
    const calculatedLevel = Math.min(20, 1 + campaignData.sessions.length);
    const levelDisplay = document.getElementById('campaignLevelDisplay');
    if (levelDisplay) levelDisplay.textContent = `Nivel ${calculatedLevel}`;
    
    ['sessionCount', 'playerCount', 'questCount', 'npcCount'].forEach((id, idx) => {
        const val = [campaignData.sessions.length, campaignData.players.length, campaignData.quests.length, campaignData.npcs.length][idx];
        if(document.getElementById(id)) document.getElementById(id).textContent = val;
    });

    const listEl = document.getElementById('upcomingQuests');
    if(listEl) {
        const criticalQuests = campaignData.quests.filter(q => q.status === 'activa' && (q.importance === 'alta' || q.importance === 'media'));
        listEl.innerHTML = criticalQuests.slice(0, 3).map(q => 
            `<div style="padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 8px;">
                <strong>${escapeHTML(q.title)}</strong><br>
                <span style="font-size: 11px; color: ${q.importance === 'alta' ? 'var(--danger)' : 'var(--accent)'}">${escapeHTML(q.importance.toUpperCase())}</span>
            </div>`
        ).join('') || `<p style="color: var(--text-secondary); font-size:12px;">Sin misiones críticas.</p>`;
    }
}

// ========== 7. PERSONAJES Y BESTIARIO (Con Stats) ==========
function addPlayer(e) {
    e.preventDefault();
    campaignData.players.push({
        player: document.getElementById('playerName').value, character: document.getElementById('characterName').value,
        class: document.getElementById('characterClass').value, race: document.getElementById('playerRace').value,
        str: document.getElementById('pjSTR').value, dex: document.getElementById('pjDEX').value, con: document.getElementById('pjCON').value,
        int: document.getElementById('pjINT').value, wis: document.getElementById('pjWIS').value, cha: document.getElementById('pjCHA').value,
        hp: document.getElementById('playerHP').value, ac: document.getElementById('playerAC').value,
        level: Math.min(20, 1 + campaignData.sessions.length)
    });
    e.target.reset(); saveCampaign(); renderPlayersList();
}

function renderPlayersList() {
    const list = document.getElementById('playersList');
    if(!list) return;
    list.innerHTML = campaignData.players.map((p, i) => 
        `<li style="flex-direction: column; align-items: stretch; border-left: 4px solid var(--accent);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div><strong style="font-size: 16px;">${escapeHTML(p.character)}</strong> <small style="color: var(--text-secondary);">(${escapeHTML(p.player)})</small><br><small style="color: var(--accent); font-weight: 600;">${escapeHTML(p.race)} ${escapeHTML(p.class)} - Nivel ${p.level}</small></div>
                <div>
                    <button class="action-btn primary-btn" style="padding:4px 8px; font-size:10px; margin-right:5px; color: black;" onclick="addEntityToCombat('players', ${i})">⚔️ A Combate</button>
                    <button onclick="handleDeleteItem('players', ${i})">X</button>
                </div>
            </div>
            <div style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>FUE:${escapeHTML(p.str||10)}</span><span>DES:${escapeHTML(p.dex||10)}</span><span>CON:${escapeHTML(p.con||10)}</span><span>INT:${escapeHTML(p.int||10)}</span><span>SAB:${escapeHTML(p.wis||10)}</span><span>CAR:${escapeHTML(p.cha||10)}</span>
            </div>
            <div style="font-size: 14px;"><span style="color: var(--success); font-weight: 800; margin-right: 15px;">HP: ${escapeHTML(p.hp||0)}</span> <strong>CA: ${escapeHTML(p.ac||10)}</strong></div>
        </li>`
    ).join('');
}

function addMonster(e) {
    e.preventDefault();
    campaignData.bestiary.push({
        name: document.getElementById('monName').value, type: document.getElementById('monType').value, cr: document.getElementById('monCR').value,
        str: document.getElementById('monSTR').value, dex: document.getElementById('monDEX').value, con: document.getElementById('monCON').value,
        int: document.getElementById('monINT').value, wis: document.getElementById('monWIS').value, cha: document.getElementById('monCHA').value,
        hp: document.getElementById('monHP').value, ac: document.getElementById('monAC').value, actions: document.getElementById('monActions').value
    });
    e.target.reset(); saveCampaign(); renderBestiary();
}

function renderBestiary() {
    const list = document.getElementById('monstersList');
    if(!list) return;
    list.innerHTML = campaignData.bestiary.map((m, i) => 
        `<li style="flex-direction: column; align-items: stretch; border-left: 4px solid var(--danger);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <strong>${escapeHTML(m.name)} <span style="color: var(--text-secondary); font-size: 11px; font-weight: normal;">(CR ${escapeHTML(m.cr)} | ${escapeHTML(m.type)})</span></strong>
                <div>
                    <button class="action-btn primary-btn" style="padding:4px 8px; font-size:10px; margin-right:5px; color: black;" onclick="addEntityToCombat('bestiary', ${i})">⚔️ A Combate</button>
                    <button onclick="handleDeleteItem('bestiary', ${i})">X</button>
                </div>
            </div>
            <div style="font-family: monospace; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-size: 12px; color: var(--accent); display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>FUE:${escapeHTML(m.str||10)}</span><span>DES:${escapeHTML(m.dex||10)}</span><span>CON:${escapeHTML(m.con||10)}</span><span>INT:${escapeHTML(m.int||10)}</span><span>SAB:${escapeHTML(m.wis||10)}</span><span>CAR:${escapeHTML(m.cha||10)}</span>
            </div>
            <div style="font-size: 13px; margin-bottom: 10px;"><span style="color: var(--success); font-weight: bold; margin-right: 15px;">HP: ${escapeHTML(m.hp||0)}</span> <span>CA: ${escapeHTML(m.ac||10)}</span></div>
            <div style="font-size: 12px; color: var(--text-secondary); padding-top: 10px; border-top: 1px solid var(--border-color); line-height: 1.5;">${escapeHTML(m.actions)}</div>
        </li>`
    ).join('');
}

function loadDefaultMonsters() {
    const basics = [
        { name: "Goblin", type: "Humanoide", cr: "1/4", str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, hp: 7, ac: 15, actions: "Cimitarra: +4, 1d6+2 cortante" },
        { name: "Orco", type: "Humanoide", cr: "1/2", str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10, hp: 15, ac: 13, actions: "Gran hacha: +5, 1d12+3 cortante" }
    ];
    campaignData.bestiary = [...campaignData.bestiary, ...basics];
    saveCampaign(); renderBestiary(); alert("Básicos 5e cargados.");
}

// ========== 8. COMBATE (Inteligente y con Entorno) ==========
function addEntityToCombat(sourceArray, index) {
    const entity = campaignData[sourceArray][index];
    const isPlayer = sourceArray === 'players';
    const name = isPlayer ? entity.character : entity.name;
    const dexMod = Math.floor((Number(entity.dex || 10) - 10) / 2);
    const autoRoll = Math.floor(Math.random() * 20) + 1 + dexMod;
    
    let initInput = prompt(`Iniciativa para ${name} (Mod DES: ${dexMod >= 0 ? '+'+dexMod : dexMod}):\nDejar en blanco/Enter para auto-roll.`, autoRoll);

    if (initInput !== null && initInput.trim() !== "") {
        let finalName = name;
        if(!isPlayer) {
            const count = campaignData.combatants.filter(c => c.name.startsWith(name)).length;
            if(count > 0) finalName = `${name} #${count + 1}`;
        }
        campaignData.combatants.push({
            name: finalName, init: Number(initInput), hp: Number(entity.hp || 0), ac: Number(entity.ac || 10),
            type: isPlayer ? "Jugador" : "Enemigo"
        });
        campaignData.combatants.sort((a, b) => b.init - a.init);
        saveCampaign(); renderCombatManager();
    }
}

function addManualCombatant(e) {
    e.preventDefault();
    campaignData.combatants.push({
        name: document.getElementById('charName').value, init: Number(document.getElementById('charInit').value),
        hp: Number(document.getElementById('charHP').value), ac: document.getElementById('charAC').value,
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
                <div><strong>${escapeHTML(c.name)}</strong> <span style="color: var(--accent); font-size: 10px; text-transform: uppercase;">(${escapeHTML(c.type)})</span></div>
                <div style="font-size:12px">Init: <strong>${escapeHTML(c.init)}</strong> | CA: <strong>${escapeHTML(c.ac)}</strong></div>
            </div>
            <div class="hp-controls">
                <span class="hp-display">HP: ${escapeHTML(c.hp)}</span>
                <input type="number" id="dmg-${i}" placeholder="Cant.">
                <button class="primary-btn" style="background:#e74c3c; color:white; padding:8px; border-radius:4px;" onclick="modifyHP(${i}, -1)">- Daño</button>
                <button class="primary-btn" style="background:var(--success); color:white; padding:8px; border-radius:4px;" onclick="modifyHP(${i}, 1)">+ Cura</button>
                <button style="background: transparent; border: 1px solid #444; color: var(--text-secondary); padding: 8px; border-radius:4px;" onclick="handleDeleteItem('combatants', ${i})">X</button>
            </div>
        </li>`
    ).join('');
    
    const turnDisplay = document.getElementById('currentTurn');
    if (turnDisplay) {
        if(campaignData.combatants.length > 0 && currentTurnIndex >= 0 && currentTurnIndex < campaignData.combatants.length) {
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
    if(!inputEl) return;
    const val = Number(inputEl.value);
    if(val) {
        campaignData.combatants[index].hp += (val * mult);
        if(campaignData.combatants[index].hp < 0) campaignData.combatants[index].hp = 0;
        inputEl.value = ''; saveCampaign(); renderCombatManager();
    }
}

function handleNextTurn() {
    if(campaignData.combatants.length === 0) return;
    currentTurnIndex++;
    if(currentTurnIndex >= campaignData.combatants.length) { currentTurnIndex = 0; currentRound++; document.getElementById('currentRound').textContent = currentRound; }
    renderCombatManager();
}

function handleClearCombat() {
    if(confirm('¿Limpiar todo el combate?')) {
        campaignData.combatants = []; currentTurnIndex = -1; currentRound = 1;
        document.getElementById('currentRound').textContent = 1; 
        saveCampaign(); renderCombatManager();
    }
}

function setEnvironment(e) {
    e.preventDefault();
    const name = document.getElementById('envName').value;
    const effect = document.getElementById('envEffect').value;
    if(!name) return;
    campaignData.combatEnvironment = { name, effect };
    saveCampaign(); renderEnvironment();
    document.getElementById('envName').value = ''; document.getElementById('envEffect').value = '';
}

function clearEnvironment() { campaignData.combatEnvironment = null; saveCampaign(); renderEnvironment(); }

function renderEnvironment() {
    const display = document.getElementById('currentEnvironmentDisplay');
    if(!display) return;
    if(campaignData.combatEnvironment && campaignData.combatEnvironment.name) {
        display.style.display = 'block';
        document.getElementById('displayEnvName').textContent = "📍 " + escapeHTML(campaignData.combatEnvironment.name);
        document.getElementById('displayEnvEffect').innerHTML = "⚠️ <strong>Penalización:</strong> " + escapeHTML(campaignData.combatEnvironment.effect);
    } else {
        display.style.display = 'none';
    }
}

// ========== 9. MISCELÁNEOS ==========
function addQuest(e) {
    e.preventDefault();
    campaignData.quests.push({
        title: document.getElementById('questTitle').value, desc: document.getElementById('questDescription').value,
        importance: document.getElementById('questImportance').value, status: document.getElementById('questStatus').value
    });
    e.target.reset(); saveCampaign(); renderQuestsList();
}
function renderQuestsList() {
    const list = document.getElementById('questsList');
    if(!list) return;
    const colors = { completada: 'var(--success)', activa: '#3b82f6', pendiente: 'var(--accent)' };
    list.innerHTML = campaignData.quests.map((q, i) => `<li style="border-left-color: ${colors[q.status]}"><div><strong>${escapeHTML(q.title)}</strong> <small>(${escapeHTML(q.status)})</small><br><small>${escapeHTML(q.desc)}</small></div><button onclick="handleDeleteItem('quests', ${i})">X</button></li>`).join('');
}

function addNPC(e) {
    e.preventDefault();
    campaignData.npcs.push({
        name: document.getElementById('npcName').value, role: document.getElementById('npcRole').value,
        desc: document.getElementById('npcDescription').value, allegiance: document.getElementById('npcAllegiance').value
    });
    e.target.reset(); saveCampaign(); renderNPCsList();
}
function renderNPCsList() {
    const list = document.getElementById('npcsList');
    if(!list) return;
    const colors = { aliado: 'var(--success)', enemigo: 'var(--danger)', neutral: 'var(--accent)' };
    list.innerHTML = campaignData.npcs.map((n, i) => `<li style="border-left-color: ${colors[n.allegiance]}"><div><strong>${escapeHTML(n.name)}</strong> - <small>${escapeHTML(n.role)}</small><br><small>${escapeHTML(n.desc)}</small></div><button onclick="handleDeleteItem('npcs', ${i})">X</button></li>`).join('');
}

function addLocation(e) { e.preventDefault(); campaignData.locations.push({ name: document.getElementById('locationName').value, notes: document.getElementById('locationNotes').value }); e.target.reset(); saveCampaign(); renderLocationsList(); }
function renderLocationsList() { const list = document.getElementById('locationsList'); if(!list) return; list.innerHTML = campaignData.locations.map((l, i) => `<li><div><strong>${escapeHTML(l.name)}</strong><br><small>${escapeHTML(l.notes)}</small></div><button onclick="handleDeleteItem('locations', ${i})">X</button></li>`).join(''); }

function addSession(e) {
    e.preventDefault();
    campaignData.sessions.unshift({
        number: document.getElementById('sessionNumber').value, date: document.getElementById('sessionDate').value,
        notes: document.getElementById('sessionNotes').value, importance: document.getElementById('sessionImportance').value
    });
    e.target.reset(); saveCampaign(); renderSessionsHistory();
}
function renderSessionsHistory() {
    const list = document.getElementById('sessionsList');
    if(!list) return;
    const colors = { normal: '#444', importante: 'var(--accent)', critica: 'var(--danger)' };
    list.innerHTML = campaignData.sessions.map((s, i) => `<li style="border-left-color: ${colors[s.importance]}"><div style="width:100%"><strong>Sesión ${escapeHTML(s.number)}</strong> <small>- ${escapeHTML(s.date)}</small><br><div style="font-size: 12px; margin-top: 8px;">${escapeHTML(s.notes)}</div></div><button onclick="handleDeleteItem('sessions', ${i})">X</button></li>`).join('');
}

function addTreasure(e) { e.preventDefault(); campaignData.treasure.push({ name: document.getElementById('treasureName').value, val: document.getElementById('treasureValue').value, desc: document.getElementById('treasureDescription').value }); e.target.reset(); saveCampaign(); renderTreasureList(); }
function renderTreasureList() { const list = document.getElementById('treasureList'); if(!list) return; list.innerHTML = campaignData.treasure.map((t, i) => `<li><div><strong>${escapeHTML(t.name)}</strong><br><small>${escapeHTML(t.val)} po | ${escapeHTML(t.desc)}</small></div><button onclick="handleDeleteItem('treasure', ${i})">X</button></li>`).join(''); }

function handleGenerateLootPo(e) {
    e.preventDefault();
    const cr = Number(document.getElementById('lootCR').value) || 1; 
    const count = Number(document.getElementById('lootCount').value) || 1;
    const totalGold = ((cr * 50) + Math.floor(Math.random() * (cr * 20))) * count;
    const resultEl = document.getElementById('lootResult');
    if(resultEl) resultEl.textContent = `💰 ${totalGold} Piezas de Oro`;
}

// ========== 10. IA MOCKS ==========
function handleMapGeneration(e) {
    e.preventDefault();
    const prompt = document.getElementById('mapPrompt').value;
    const output = document.getElementById('mapOutput');
    if(!prompt) return alert("Describe el mapa primero.");
    output.innerHTML = `<span style="color: var(--accent);">🔮 Generando mapa...</span>`;
    setTimeout(() => {
        output.innerHTML = `<div style="text-align:center;"><p style="color:var(--success); font-size:12px;">✅ Mapa generado</p><div style="width:100%; height:150px; background:repeating-linear-gradient(45deg, #2d3436, #2d3436 10px, #1f2937 10px, #1f2937 20px); border: 2px solid var(--accent); border-radius: 8px; display:flex; align-items:center; justify-content:center;"><span style="color: white; text-shadow: 1px 1px 2px black;">${escapeHTML(prompt.substring(0, 20))}...</span></div></div>`;
    }, 1500);
}

function handleConsequences(e) {
    e.preventDefault();
    if (campaignData.sessions.length === 0) return alert("Registra sesiones en el historial primero.");
    const outputDiv = document.getElementById('consequencesOutput');
    const textSpan = document.getElementById('consequenceText');
    outputDiv.style.display = 'block';
    textSpan.innerHTML = "<span style='color: var(--text-secondary)'>Consultando el Oráculo...</span>";
    setTimeout(() => { textSpan.innerHTML = escapeHTML("Basado en la sesión " + campaignData.sessions[0].number + ": Una facción rival ha notado tus acciones. Prepárate para una emboscada."); }, 2000);
}

// ========== 11. DADOS ==========
function handleManualDiceRoll() {
    executeDiceRoll(Number(document.getElementById('diceCount').value) || 1, Number(document.getElementById('diceSides').value), Number(document.getElementById('diceModifier').value) || 0);
}

function executeDiceRoll(count, sides, mod) {
    let rolls = []; let total = 0;
    for(let i=0; i<count; i++) { const r = Math.floor(Math.random() * sides) + 1; rolls.push(r); total += r; }
    const final = total + mod;
    const modStr = mod !== 0 ? (mod > 0 ? `+${mod}` : mod) : '';
    document.querySelector('.result-card-fancy .result-value').textContent = final;
    document.getElementById('diceBreakdown').textContent = `(${rolls.join('+')})${modStr} = ${final}`;
    diceHistory.unshift(`${count}d${sides}${modStr} ➔ <strong>${final}</strong>`);
    if(diceHistory.length > 10) diceHistory.pop();
    const hl = document.getElementById('diceHistory');
    if(hl) hl.innerHTML = diceHistory.map(h => `<li style="justify-content:center; padding:10px;">${h}</li>`).join('');
}

// ========== 12. BORRADO ==========
function handleDeleteItem(arrayName, index) {
    if(confirm('¿Eliminar permanente?')) {
        if (arrayName === 'combatants') {
            if (index < currentTurnIndex) currentTurnIndex--;
            else if (index === currentTurnIndex && currentTurnIndex >= campaignData.combatants.length - 1) currentTurnIndex = 0;
        }
        campaignData[arrayName].splice(index, 1);
        saveCampaign(); renderAll();
    }
}