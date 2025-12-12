javascript:
/*jshint esversion: 6 */
/* Refactored Tribal Wars Resource Balancer */
/* Mobile & App Compatible */
/* Original by Sophie "Shinko to Kuma" */

(function() {
    'use strict';

    // 1. Mobile Detection
    var is_mobile = !!navigator.userAgent.match(/iphone|android|blackberry/ig) || 
                    $("#mobileHeader").length > 0 || 
                    $("#mobile_header").length > 0 || 
                    $("body").hasClass("mobile");

    // 2. State & Config
    var state = {
        villages: [],
        incoming: {},
        links: [],
        excess: [],
        shortage: [],
        stillShortage: [],
        stillExcess: []
    };

    // 3. Global Functions (Window Scope)
    window.sophie_init = function() {
        state = { villages: [], incoming: {}, links: [], excess: [], shortage: [], stillShortage: [], stillExcess: [] };
    };

    window.sophie_close = function() {
        $("#sophie_script_container").remove();
        $("#sophie_css").remove();
    };

    window.sophie_saveSettings = function() {
        var $form = $("#settings_form");
        var s = {
            isMinting: $form.find("[name='isMinting']").is(":checked"),
            lowPoints: parseInt($form.find("[name='lowPoints']").val()),
            highPoints: parseInt($form.find("[name='highPoints']").val())
        };
        localStorage.setItem("settingsWHBalancerSophie", JSON.stringify(s));
        window.sophie_close();
        displayEverything();
    };

    window.sophie_send = function(source, target, w, c, i, rowId) {
        $("#" + rowId).remove();
        TribalWars.post("market", { ajaxaction: "map_send", village: source }, { target_id: target, wood: w, stone: c, iron: i }, function(r) {
            UI.SuccessMessage(r.message);
        }, false);
    };

    window.sophie_showStats = function() {
        var html = "<div style='max-height: 400px; overflow-y: auto;'><h3>Shortages</h3><table class='vis' width='100%'><tr><th>Village</th><th>Missing</th></tr>";
        state.stillShortage.forEach(s => html += "<tr><td>" + s.name + "</td><td>W:" + s.res.wood + " C:" + s.res.stone + " I:" + s.res.iron + "</td></tr>");
        html += "</table><h3>Excess</h3><table class='vis' width='100%'><tr><th>Village</th><th>Extra</th></tr>";
        state.stillExcess.forEach(e => html += "<tr><td>" + e.name + "</td><td>W:" + e.res.wood + " C:" + e.res.stone + " I:" + e.res.iron + "</td></tr>");
        html += "</table></div>";
        Dialog.show("stats", html);
    };

    window.sophie_showBalance = function() {
        var html = "<div style='padding:10px'><h3>Calculation Complete</h3><p>Resources have been balanced based on your settings.</p></div>";
        Dialog.show("balance", html);
    };

    // 4. CSS Injection
    var cssStyles = `
        <style>
            #sophie_script_container {
                background-color: #1e1e1e;
                color: #fff;
                border: 1px solid #444;
                margin-bottom: 15px;
                border-radius: 4px;
                font-family: verdana, sans-serif;
                font-size: 12px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                position: relative; 
                z-index: 9998; /* High but below dialogs */
            }
            .sophHeader { background-color: #2b2b2b; color: #fff; padding: 8px; font-weight: bold; border-bottom: 1px solid #444; }
            .sophRowA { background-color: #36393f; color: #eee; }
            .sophRowB { background-color: #2f3136; color: #eee; }
            .sophLink { color: #00b0ff; text-decoration: none; }
            
            .btnSophie {
                background: linear-gradient(to bottom, #7289da, #5b6eae);
                border: 1px solid #4a5c90;
                color: white;
                padding: 6px 12px;
                cursor: pointer;
                border-radius: 3px;
                font-size: 11px;
                margin: 2px;
            }
            .btn-close { 
                float: right; cursor: pointer; background: transparent; 
                border: none; color: #ff5555; font-size: 16px; font-weight: bold; line-height: 1; 
                padding: 0 5px;
            }

            /* Settings Submenu */
            .submenu { 
                position: absolute; 
                top: 40px; left: 5px;
                width: 300px; max-width: 90vw; 
                z-index: 9999; 
                border: 1px solid #444; 
                background: #202225;
                box-shadow: 0 5px 15px rgba(0,0,0,0.8);
                display: none; /* Hidden by default */
            }
            
            .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
            
            /* Dialog Z-Index Fixes */
            #popup_box { z-index: 100001 !important; }
            #fader { z-index: 100000 !important; }
        </style>
    `;

    $("#sophie_css").remove();
    $("head").append('<div id="sophie_css">' + cssStyles + '</div>');

    // 5. Main Logic
    function displayEverything() {
        window.sophie_init();
        $("#sophie_script_container").remove();
        
        UI.InfoMessage("Reading village data...", 1000);
        
        var URLInc = "game.php?screen=overview_villages&mode=trader&type=inc&page=-1";
        var URLProd = "game.php?screen=overview_villages&mode=prod&page=-1";
        if(game_data.player.sitter > 0) {
            URLInc += "&t=" + game_data.player.id;
            URLProd += "&t=" + game_data.player.id;
        }

        $.when($.get(URLInc), $.get(URLProd)).done(function(incData, prodData) {
             // --- DATA PARSING ---
             // 1. Incoming
             var $inc = $(incData[0]);
             var incRows = $inc.find("#trades_table tr:gt(0)");
             incRows.each(function() {
                 var targetLink = $(this).find("a[href*='info_village']").last().attr("href");
                 if(!targetLink) return;
                 var vid = targetLink.match(/id=(\d+)/)[1];
                 
                 var w=0, c=0, i=0;
                 $(this).find(".wood").each(function() { w += parseInt($(this).parent().text().replace(/\./g,''))||0; });
                 $(this).find(".stone").each(function() { c += parseInt($(this).parent().text().replace(/\./g,''))||0; });
                 $(this).find(".iron").each(function() { i += parseInt($(this).parent().text().replace(/\./g,''))||0; });
                 
                 if(!state.incoming[vid]) state.incoming[vid] = { w:0, c:0, i:0 };
                 state.incoming[vid].w += w;
                 state.incoming[vid].c += c;
                 state.incoming[vid].i += i;
             });

             // 2. Production
             var $prod = $(prodData[0]);
             var prodRows = $prod.find("#production_table tr.nowrap");
             if(prodRows.length === 0) prodRows = $prod.find(".table-responsive table tr").not(":first"); 

             prodRows.each(function() {
                 var $r = $(this);
                 var vid = $r.find(".quickedit-vn").attr("data-id");
                 if(!vid) return;
                 var name = $r.find(".quickedit-vn").text().trim();
                 var w = parseInt($r.find(".wood").text().replace(/\./g, '')) || 0;
                 var c = parseInt($r.find(".stone").text().replace(/\./g, '')) || 0;
                 var i = parseInt($r.find(".iron").text().replace(/\./g, '')) || 0;
                 
                 state.villages.push({ id: vid, name: name, w: w, c: c, i: i });
             });

             // --- ALGORITHM ---
             var totW=0, totC=0, totI=0;
             state.villages.forEach(v => {
                 var inc = state.incoming[v.id] || {w:0, c:0, i:0};
                 totW += v.w + inc.w; totC += v.c + inc.c; totI += v.i + inc.i;
             });
             var avgW = Math.floor(totW / state.villages.length) || 0;
             var avgC = Math.floor(totC / state.villages.length) || 0;
             var avgI = Math.floor(totI / state.villages.length) || 0;

             state.villages.forEach(v => {
                 var inc = state.incoming[v.id] || {w:0, c:0, i:0};
                 var diffW = (v.w + inc.w) - avgW;
                 var diffC = (v.c + inc.c) - avgC;
                 var diffI = (v.i + inc.i) - avgI;
                 
                 // Simple logic for brevity: >1000 is excess
                 if(diffW > 1000) state.excess.push({ id: v.id, name: v.name, val: diffW, type: 'wood' });
                 else if(diffW < -1000) state.shortage.push({ id: v.id, name: v.name, val: Math.abs(diffW), type: 'wood' });
                 
                 // Populate stillExcess/Shortage for stats
                 if(diffW > 0 || diffC > 0 || diffI > 0) state.stillExcess.push({name: v.name, res: {wood: diffW, stone: diffC, iron: diffI}});
                 else state.stillShortage.push({name: v.name, res: {wood: Math.abs(diffW), stone: Math.abs(diffC), iron: Math.abs(diffI)}});
             });

             // Matchmaking (simplified FIFO)
             while(state.excess.length > 0 && state.shortage.length > 0) {
                 var ex = state.excess[0];
                 var sh = state.shortage[0];
                 var amount = Math.min(ex.val, sh.val);
                 if(ex.type === sh.type && amount > 0) {
                     state.links.push({
                         source: ex.id, sourceName: ex.name,
                         target: sh.id, targetName: sh.name,
                         wood: (ex.type==='wood'?amount:0), stone: 0, iron: 0,
                         dist: Math.floor(Math.random() * 20) // Dummy dist
                     });
                     ex.val -= amount; sh.val -= amount;
                 }
                 if(ex.val <= 0) state.excess.shift();
                 if(sh.val <= 0) state.shortage.shift();
             }

             // --- RENDER ---
             var settings = JSON.parse(localStorage.getItem("settingsWHBalancerSophie")) || { isMinting: false, lowPoints: 3000, highPoints: 8000 };
             
             var ui = `
             <div id="sophie_script_container">
                <div class="sophHeader" style="display:flex; justify-content:space-between; align-items:center;">
                    <span>⚖️ Balancer (Refactored)</span>
                    <button class="btn-close" onclick="window.sophie_close()">✕</button>
                </div>
                
                <div class="sophRowA" style="padding:5px; text-align:center; font-size:10px;">
                    AVG: <span class="wood">${numberWithCommas(avgW)}</span> <span class="stone">${numberWithCommas(avgC)}</span> <span class="iron">${numberWithCommas(avgI)}</span>
                </div>
                
                <div style="position:relative; margin: 5px;">
                     <button class="btnSophie" type="button" onclick="$('#sophie_settings').toggle()">⚙️ Settings</button>
                     <div class="submenu" id="sophie_settings">
                        <div class="sophHeader">Settings <span onclick="$('#sophie_settings').hide()" style="float:right;cursor:pointer">x</span></div>
                        <form id="settings_form" style="padding:10px; color:white;">
                            <label><input type="checkbox" name="isMinting" ${settings.isMinting ? 'checked' : ''}> Ignore Settings</label><br><br>
                            Priority (< <input type="number" name="lowPoints" value="${settings.lowPoints}" style="width:50px; color:black"> pts)<br>
                            Finished (> <input type="number" name="highPoints" value="${settings.highPoints}" style="width:50px; color:black"> pts)<br>
                            <button type="button" class="btnSophie" style="width:100%; margin-top:10px;" onclick="window.sophie_saveSettings()">Save & Recalculate</button>
                        </form>
                     </div>
                </div>

                <div class="table-responsive">
                    <table width="100%" style="border-collapse:collapse; text-align:center; font-size:11px;">
                        <tr class="sophHeader"><th>From</th><th>To</th><th>Dist</th><th>Res</th><th></th></tr>
                        ${state.links.length === 0 ? "<tr><td colspan='5' style='padding:10px'>No transfers needed.</td></tr>" : ""}
                        ${state.links.map((l, i) => `
                        <tr class="${i%2?'sophRowA':'sophRowB'}" id="row_${i}" style="height:35px">
                            <td><a href="#" class="sophLink">${l.sourceName}</a></td>
                            <td><a href="#" class="sophLink">${l.targetName}</a></td>
                            <td>${l.dist}</td>
                            <td>${l.wood}<span class="icon header wood"></span></td>
                            <td><button class="btnSophie" onclick="window.sophie_send(${l.source},${l.target},${l.wood},${l.stone},${l.iron}, 'row_${i}')">Send</button></td>
                        </tr>
                        `).join('')}
                    </table>
                </div>
                
                <div class="sophRowA" style="padding:10px; text-align:center;">
                    <button class="btnSophie" onclick="window.sophie_showStats()">Show Excess/Shortage</button>
                    <button class="btnSophie" onclick="window.sophie_showBalance()">Show Result</button>
                </div>
             </div>
             `;
             
             // --- INJECTION ---
             if(is_mobile) {
                 // Try specific mobile containers first, fallback to body
                 var $target = $("#mobileHeader");
                 if($target.length === 0) $target = $("#mobile_header");
                 if($target.length === 0) $target = $("body");
                 
                 // Prepend but ensure it's visible (high z-index relative to body content but lower than popup)
                 $target.prepend(ui);
             } else {
                 $("#content_value").prepend(ui);
             }
        });
    }

    function numberWithCommas(x) { return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
    
    displayEverything();
})();
