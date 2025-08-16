
        // 공통 JavaScript 함수들
        var currentGradeTypes = {};  // 각 플롯별 현재 등급 타입 저장
        var initializedPlots = {};   // 초기화된 플롯 저장
        
        function goBack() {
            window.history.back();
        }
        
        function searchData(query) {
            // 검색 기능 구현
            console.log('검색:', query);
        }
        
        function initializeCharts() {
            // 차트 초기화 함수
            if (typeof Chart !== 'undefined') {
                Chart.defaults.font.family = "'Malgun Gothic', '맑은 고딕', sans-serif";
            }
        }

        // ===== 대학 페이지: 모집단위 비교(전체 전형) =====
        function initDeptCompareSection() {
            var container = document.getElementById('dept-compare');
            if (!container || !window.deptCompareData) return;
            var input = document.getElementById('compare-dept-input');
            var yearSel = document.getElementById('compare-year-mode');
            var applyBtn = document.getElementById('compare-apply');
            function parseTerm() {
                var q = (input.value||'').trim().toLowerCase();
                if (!q) return '';
                // 쉼표가 있으면 첫 항목만 사용
                if (q.indexOf(',') !== -1) q = q.split(',')[0].trim();
                return q;
            }
            function render() {
                var terms = parseTerms();
                var yearMode = yearSel ? yearSel.value : 'overall';
                var rows = window.deptCompareData || [];
                var filtered = rows.filter(r=>{
                    if (!terms.length) return false;
                    var name = (r.dept||'').toString().toLowerCase();
                    return terms.some(t=> name.indexOf(t) !== -1);
                });
                if (!filtered.length) {
                    var tbody = document.getElementById('compare-tbody');
                    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#777;">선택된 모집단위에 해당하는 데이터가 없습니다.</td></tr>';
                    var el = document.getElementById('compare-bar');
                    if (el && window.Plotly) { el.innerHTML=''; }
                    return;
                }
                // 연도 모드 적용
                if (yearMode === 'recent') {
                    var years = filtered.map(r=>r.year).filter(v=>v!==undefined && v!==null);
                    if (years.length) {
                        var maxY = Math.max.apply(null, years);
                        filtered = filtered.filter(r=>r.year===maxY);
                    }
                }
                // 전형별 집계
                var map = {}; // subtype -> stats
                filtered.forEach(r=>{
                    var st = r.subtype || '기타';
                    if (!map[st]) map[st] = {total:0, pass:0, fail:0, allsum:0, alln:0, convsum:0, convn:0};
                    var m = map[st];
                    m.total += 1;
                    if (r.result === '불합격') m.fail += 1;
                    if (r.result === '합격' || r.result === '충원합격') m.pass += 1;
                    if (typeof r.all_subj_grade === 'number') { m.allsum += r.all_subj_grade; m.alln += 1; }
                    if (typeof r.conv_grade === 'number') { m.convsum += r.conv_grade; m.convn += 1; }
                });
                var subtypes = Object.keys(map).sort();
                var passY = subtypes.map(s=> map[s].pass);
                var failY = subtypes.map(s=> map[s].fail);
                // 막대그래프 렌더
                var el = document.getElementById('compare-bar');
                if (el && window.Plotly) {
                    var traces = [
                        { x: subtypes, y: passY, type: 'bar', name: '합격(충원포함)', marker:{color:'#4f81bd'} },
                        { x: subtypes, y: failY, type: 'bar', name: '불합격', marker:{color:'#d9534f'} }
                    ];
                    Plotly.newPlot(el, traces, {
                        barmode: (parseTerms().length>1 ? 'group':'stack'),
                        margin:{t:20,b:60,l:60,r:30},
                        xaxis:{ title:'전형(세부유형)' },
                        yaxis:{ title:'인원 (명)' },
                        height: 380,
                        template:'plotly_white',
                        showlegend:true
                    }, {displayModeBar:false, responsive:true});
                }
                // 표 렌더
                var tbody = document.getElementById('compare-tbody');
                if (tbody) {
                    var rowsHtml = subtypes.map(st=>{
                        var m = map[st];
                        var rate = (m.total>0 ? (m.pass/m.total*100) : 0);
                        var allmean = (m.alln>0 ? (m.allsum/m.alln) : 0);
                        var convmean = (m.convn>0 ? (m.convsum/m.convn) : 0);
                        return '<tr>'+
                            '<td>'+st+'</td>'+
                            '<td style="text-align:right">'+m.total+'</td>'+
                            '<td style="text-align:right">'+m.pass+'</td>'+
                            '<td style="text-align:right">'+m.fail+'</td>'+
                            '<td style="text-align:right">'+rate.toFixed(1)+'%</td>'+
                            '<td style="text-align:right">'+(allmean?allmean.toFixed(2):'-')+'</td>'+
                            '<td style="text-align:right">'+(convmean?convmean.toFixed(2):'-')+'</td>'+
                        '</tr>';
                    }).join('');
                    tbody.innerHTML = rowsHtml || '<tr><td colspan="7" style="text-align:center;color:#777;">데이터 없음</td></tr>';
                }
            }
            if (applyBtn) applyBtn.addEventListener('click', render);
        }

        // 박스플롯 렌더링 버전 (전체 전형 대상)
        function initDeptCompareSectionBoxplots() {
            var container = document.getElementById('dept-compare');
            if (!container || !window.deptCompareData) return;
            var input = document.getElementById('compare-dept-input');
            var applyBtn = document.getElementById('compare-apply');
            var btnAll = document.getElementById('compare-btn-all');
            var btnConv = document.getElementById('compare-btn-conv');
            var compareGradeType = 'all_subj';

            function parseTerm() {
                var q = (input.value||'').trim().toLowerCase();
                if (!q) return '';
                if (q.indexOf(',') !== -1) q = q.split(',')[0].trim();
                return q;
            }

            function quantile(arr, q){
                if (!arr.length) return null;
                var a = arr.slice().sort(function(x,y){return x-y});
                var pos = (a.length-1)*q;
                var base = Math.floor(pos), rest = pos - base;
                if (a[base+1]!==undefined) return a[base] + rest*(a[base+1]-a[base]);
                else return a[base];
            }

            function buildQuartileTable(rows, gradeKey){
                var labels = ['합격','충원합격','불합격'];
                var html = '<table class="small-table"><thead><tr><th></th><th>Min</th><th>Q1</th><th>Median</th><th>Q3</th><th>Max</th></tr></thead><tbody>';
                labels.forEach(function(lbl){
                    // 숫자형이면서 유한한 값만 사용 (NaN/Infinity 제거)
                    var vals = rows
                        .filter(function(r){ return r.result===lbl; })
                        .map(function(r){ return Number(r[gradeKey]); })
                        .filter(function(v){ return Number.isFinite(v); });
                    if (!vals.length){
                        html += '<tr><td>'+lbl+'</td><td colspan="5" style="text-align:center">데이터 없음</td></tr>';
                    } else {
                        var mn = Math.min.apply(null, vals);
                        var mx = Math.max.apply(null, vals);
                        var q1 = quantile(vals, 0.25);
                        var md = quantile(vals, 0.5);
                        var q3 = quantile(vals, 0.75);
                        function f(v){ return (typeof v==='number' && isFinite(v)) ? v.toFixed(2) : '-'; }
                        html += '<tr><td>'+lbl+'</td><td>'+f(mn)+'</td><td>'+f(q1)+'</td><td>'+f(md)+'</td><td>'+f(q3)+'</td><td>'+f(mx)+'</td></tr>';
                    }
                });
                html += '</tbody></table>';
                return html;
            }

            function buildCounts(rows){
                var total = rows.length;
                var pass = rows.filter(r=> r.result==='합격' || r.result==='충원합격').length;
                var fail = rows.filter(r=> r.result==='불합격').length;
                var rate = total ? (pass/total*100).toFixed(1) : '0.0';
                return '<div class="stats-grid">'
                    +'<div class="stat-item">총 지원: '+total+'명</div>'
                    +'<div class="stat-item stat-pass">합격: '+pass+'명 ('+rate+'%)</div>'
                    +'<div class="stat-item stat-fail">불합격: '+fail+'명</div>'
                +'</div>';
            }

            function render() {
                var term = parseTerm();
                var rows = window.deptCompareData || [];
                if (!term) {
                    var wrapInit = document.getElementById('compare-plots');
                    if (wrapInit) wrapInit.innerHTML = '<div class="plot-container" style="text-align:center;color:#777;">모집단위를 입력하고 적용을 눌러 비교를 시작하세요.</div>';
                    return;
                }
                // 입력어와 가장 잘 맞는 모집단위명을 선택 (정확 일치 우선, 없으면 포함 일치)
                var depts = Array.from(new Set(rows.map(r=> (r.dept||'').toString())));
                var lower = term.toLowerCase();
                var target = depts.find(d=> d.toLowerCase()===lower) || depts.find(d=> d.toLowerCase().indexOf(lower)!==-1) || '';
                var filtered = rows.filter(r=> ((r.dept||'').toString()===target));
                var wrap = document.getElementById('compare-plots');
                if (!filtered.length) {
                    if (wrap) wrap.innerHTML = '<div class="plot-container" style="text-align:center;color:#777;">선택된 모집단위에 해당하는 데이터가 없습니다.</div>';
                    return;
                }
                var subtypes = Array.from(new Set(filtered.map(r=> r.subtype||'기타'))).sort();
                if (wrap) wrap.innerHTML = '';
                var colorMap = { '합격':'rgba(51, 102, 204, 0.3)', '충원합격':'rgba(16, 150, 24, 0.3)', '불합격':'rgba(220, 57, 18, 0.3)' };
                var lineMap = { '합격':'#3366CC', '충원합격':'#109618', '불합격':'#DC3912' };
                // 년도 목록: 페이지 전역 연도 순서 사용 (없으면 데이터에서 유도)
                var years = Array.isArray(window.deptCompareYears) && window.deptCompareYears.length ? window.deptCompareYears.slice() : Array.from(new Set(filtered.map(r=> r.year))).filter(v=>v!==undefined && v!==null).sort();
                if (!years.length) years = [null];
                subtypes.forEach(function(st, idx){
                    var block = document.createElement('div');
                    block.innerHTML = '<div class="subtype-section" style="padding:10px 12px; background:#fbfcfe; border:1px solid #e7eaf0; border-radius:8px;">'
                        +'<div class="subtype-header" style="font-size: 16px; color: #4a5568; font-weight:600;">'+st+'</div>'
                        +'<div class="plot-controls" style="text-align:center; margin:6px 0 6px 0;"></div>'
                        +'<div class="three-col" id="compare-grid-'+idx+'"></div>'
                        +'</div>';
                    wrap.appendChild(block);
                    var grid = block.querySelector('#compare-grid-'+idx);
                    years.forEach(function(y){
                        var yrows = filtered.filter(r=> (r.subtype||'기타')===st && (y===null || r.year===y));
                        var pid = 'compare-plot-'+idx+'-'+y;
                        var allTableId = 'compare-q-all-'+idx+'-'+y;
                        var convTableId = 'compare-q-conv-'+idx+'-'+y;
                        var statsHtml = buildCounts(yrows);
                        var card = document.createElement('div');
                        card.className = 'mini-col';
                        // 모집인원 (해당 연도에서 최초 유효값)
                        var yQuota = null;
                        try {
                            var qArr = yrows.map(function(r){ return (typeof r.quota==='number') ? r.quota : null; }).filter(function(v){return v!==null && !isNaN(v)});
                            if (qArr.length) yQuota = parseInt(qArr[0]);
                        } catch(e) {}
                        // 수능최저 텍스트
                        var cs = null;
                        try {
                            var csArr = yrows.map(function(r){ var s = (r.csat_req||''); s = (typeof s==='string')? s.trim(): ''; return s; })
                                             .filter(function(s){ return s && s.toLowerCase()!=='nan' && s.toLowerCase()!=='none'; });
                            if (csArr.length) cs = csArr[0].replace(/"/g,'&quot;');
                        } catch(e) {}
                        var yLabel = (y===null ? '전체' : (y+'년')) + (y!==null && yQuota!==null ? '(모집인원:'+yQuota+'명)' : '') + (cs? ' <span class="csat-badge" title="'+cs+'">수능최저학력 기준O</span>' : '');
                        if (!yrows.length) {
                            card.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">'+yLabel+'</div>'
                                + '<div class="plot-chart" style="height: 300px; margin: 10px 0; display:flex; align-items:center; justify-content:center; color:#777; background:#fff; border:1px dashed #e5e7eb;">데이터 없음</div>';
                            grid.appendChild(card);
                            return;
                        }
                        card.innerHTML = '<div style="font-weight:600; margin-bottom:6px;">'+yLabel+'</div>'
                            +'<div id="'+pid+'" class="plot-chart" style="height:300px; margin:10px 0;"></div>'
                            + statsHtml
                            +'<div id="'+allTableId+'" style="margin-top:8px;"></div>'
                            +'<div id="'+convTableId+'" style="margin-top:8px; display:none;"></div>';
                        grid.appendChild(card);
                        // 표 생성 (토글에 따라 가시성 제어)
                        document.getElementById(allTableId).innerHTML = buildQuartileTable(yrows, 'all_subj_grade');
                        document.getElementById(convTableId).innerHTML = buildQuartileTable(yrows, 'conv_grade');
                        document.getElementById(allTableId).style.display = (compareGradeType==='all_subj') ? '' : 'none';
                        document.getElementById(convTableId).style.display = (compareGradeType==='conv') ? '' : 'none';
                        // 박스플롯 생성
                        var gradeKey = (compareGradeType === 'conv') ? 'conv_grade' : 'all_subj_grade';
                        var traces = [];
                        ['합격','충원합격','불합격'].forEach(function(label){
                            var ys = yrows.filter(r=> r.result===label && typeof r[gradeKey] === 'number').map(r=> r[gradeKey]);
                            traces.push({ y: ys, type:'box', name: label, boxpoints:'outliers', marker:{color: colorMap[label]||'rgba(100,100,100,0.3)'}, line:{color: lineMap[label]||'#666'} });
                        });
                        if (window.Plotly) {
                            var elPlot = document.getElementById(pid);
                            Plotly.newPlot(elPlot, traces, {
                                height: 300, margin:{t:10,b:50,l:60,r:30}, xaxis:{ title:'결과', type:'category' },
                                yaxis:{ range:[9.5,0.5], title:(compareGradeType==='conv'?'환산등급':'전교과등급'), autorange:false, tickmode:'array', tickvals:[1,2,3,4,5,6,7,8,9], ticktext:['1','2','3','4','5','6','7','8','9'] },
                                template:'plotly_white', showlegend:false
                            }, {displayModeBar:false, responsive:true});
                            Plotly.relayout(elPlot, { 'yaxis.autorange': false, 'yaxis.range':[9.5,0.5], 'yaxis.tickvals':[1,2,3,4,5,6,7,8,9], 'yaxis.ticktext':['1','2','3','4','5','6','7','8','9'] });
                            try { Plotly.Plots.resize(elPlot); } catch(e) {}
                        }
                    });
                });
            }

            if (applyBtn) applyBtn.addEventListener('click', render);
            if (input) {
                input.addEventListener('change', render);
                input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); render(); } });
            }
            if (btnAll) btnAll.addEventListener('click', function(){ compareGradeType='all_subj'; btnAll.classList.add('active'); if(btnConv) btnConv.classList.remove('active'); render(); });
            if (btnConv) btnConv.addEventListener('click', function(){ compareGradeType='conv'; btnConv.classList.add('active'); if(btnAll) btnAll.classList.remove('active'); render(); });
        }

        function switchView(plotId, viewType) {
            // 보기 타입 전환 (전형 전체 <-> 모집단위별)
            
            // 탭 버튼 상태 변경
            var totalTab = document.getElementById('tab-total-' + plotId);
            var deptTab = document.getElementById('tab-dept-' + plotId);
            
            if (totalTab && deptTab) {
                totalTab.classList.toggle('active', viewType === 'total');
                deptTab.classList.toggle('active', viewType === 'dept');
            }
            
            // 콘텐츠 표시 전환
            var totalView = document.getElementById('total-view-' + plotId);
            var deptView = document.getElementById('dept-view-' + plotId);
            
            if (totalView && deptView) {
                totalView.style.display = (viewType === 'total') ? 'block' : 'none';
            deptView.style.display = (viewType === 'dept') ? 'block' : 'none';
                
                // 보이는 뷰의 플롯들을 다시 초기화/리사이즈 (hidden 상태에서 렌더된 문제 보정)
                setTimeout(function() {
                    var container = (viewType === 'dept') ? deptView : totalView;
                    if (!container) return;
                    // 전형 전체/모집단위별 모두 포함: 'plot-' 및 'dept-plot-' 아이디 처리
                    container.querySelectorAll('[id^="plot-"]').forEach(function(plotDiv){
                        var pid = plotDiv.id.split('-')[1];
                        if (!currentGradeTypes[pid]) currentGradeTypes[pid] = 'all_subj';
                        updatePlot(pid, currentGradeTypes[pid]);
                        try { 
                            if (window.Plotly && plotDiv.offsetWidth > 0) {
                                Plotly.Plots.resize(plotDiv); 
                            }
                        } catch(e){}
                    });
                    container.querySelectorAll('[id^="dept-plot-"]').forEach(function(plotDiv){
                        var pid = plotDiv.id.split('-')[2];
                        if (!currentGradeTypes[pid]) currentGradeTypes[pid] = 'all_subj';
                        updateDeptPlot(pid, currentGradeTypes[pid]);
                        try { 
                            if (window.Plotly && plotDiv.offsetWidth > 0) {
                                Plotly.Plots.resize(plotDiv); 
                            }
                        } catch(e){}
                    });
                }, 150);
                
                // 비교 탭일 때: 정렬바의 검색창에 포커스
                // no-op
                
                // 추가 리사이즈 (더 안정적인 렌더링을 위해)
                setTimeout(function() {
                    var container = (viewType === 'dept') ? deptView : totalView;
                    if (!container) return;
                    container.querySelectorAll('[id^="plot-"], [id^="dept-plot-"]').forEach(function(plotDiv){
                        try { 
                            if (window.Plotly && plotDiv.offsetWidth > 0) {
                                Plotly.Plots.resize(plotDiv); 
                            }
                        } catch(e){}
                    });
                }, 400);
            }
        }

        // ===== 모집단위 정렬/필터 =====
        function getMetricFromEl(el, key, yearMode) {
            if (yearMode === 'overall') return parseFloat(el.dataset[key] || '0') || 0;
            if (yearMode === 'recent') {
                try {
                    var years = JSON.parse(el.dataset.years || '{}');
                    var ys = Object.keys(years).map(Number).sort((a,b)=>b-a);
                    if (!ys.length) return parseFloat(el.dataset[key] || '0') || 0;
                    var rec = years[ys[0]];
                    switch (key) {
                        case 'total': return rec.total || 0;
                        case 'pass': return rec.pass || 0;
                        case 'fail': return rec.fail || 0;
                        case 'passrate': return rec.passrate || 0;
                        case 'allmean': return rec.allmean || 0;
                        case 'convmean': return rec.convmean || 0;
                        default: return parseFloat(el.dataset[key] || '0') || 0;
                    }
                } catch(e) { return parseFloat(el.dataset[key] || '0') || 0; }
            }
            return parseFloat(el.dataset[key] || '0') || 0;
        }

        function applyDeptSorting(sectionId) {
            var container = document.getElementById('dept-sections-' + sectionId);
            if (!container) return;
            var keySel = document.getElementById('dept-sort-key-' + sectionId);
            var dirBtn = document.getElementById('dept-sort-dir-' + sectionId);
            var yearSel = document.getElementById('dept-year-mode-' + sectionId);
            var topSel = document.getElementById('dept-topn-' + sectionId);
            var queryEl = document.getElementById('dept-search-' + sectionId);
            var key = keySel ? keySel.value : 'name';
            var dir = (dirBtn ? dirBtn.dataset.dir : 'desc') || 'desc';
            var yearMode = yearSel ? yearSel.value : 'overall';
            var topN = topSel ? topSel.value : 'all';
            var q = (queryEl ? (queryEl.value||'').trim().toLowerCase() : '');

            var items = Array.from(container.querySelectorAll('.dept-section'));
            // filter by query (콤마로 다중 검색)
            if (q) {
                var terms = q.split(',').map(s=>s.trim()).filter(Boolean);
                items = items.filter(el => {
                    var name = (el.dataset.dept||'').toLowerCase();
                    return terms.some(t => name.includes(t));
                });
                // 일치하지 않는 항목은 숨김
                Array.from(container.querySelectorAll('.dept-section')).forEach(el => {
                    var name = (el.dataset.dept||'').toLowerCase();
                    var match = terms.some(t => name.includes(t));
                    el.style.display = match ? '' : 'none';
                });
            } else {
                Array.from(container.querySelectorAll('.dept-section')).forEach(el => { el.style.display=''; });
            }

            // sort
            if (key === 'name') {
                items.sort((a,b)=> (a.dataset.dept||'').localeCompare(b.dataset.dept||'', 'ko-KR'));
                if (dir === 'desc') items.reverse();
            } else {
                items.sort((a,b)=>{
                    var av = getMetricFromEl(a, key, yearMode);
                    var bv = getMetricFromEl(b, key, yearMode);
                    return (dir==='desc' ? (bv-av) : (av-bv));
                });
            }

            // topN
            var n = (topN==='all') ? items.length : parseInt(topN,10)||items.length;
            items.forEach((el,idx)=>{ el.style.display = (idx<n) ? '' : 'none'; });

            // re-append in order
            items.forEach(el=>container.appendChild(el));

            // resize plots to fit new order
            try {
                container.querySelectorAll('[id^="plot-"]').forEach(function(div){ if (window.Plotly && div.offsetWidth>0) Plotly.Plots.resize(div); });
            } catch(e){}
        }

        function bindDeptSortBar(sectionId) {
            ['dept-sort-key-','dept-year-mode-','dept-topn-'].forEach(function(prefix){
                var el = document.getElementById(prefix + sectionId);
                if (el) el.addEventListener('change', function(){ applyDeptSorting(sectionId); });
            });
            var dirBtn = document.getElementById('dept-sort-dir-' + sectionId);
            if (dirBtn) dirBtn.addEventListener('click', function(){
                this.dataset.dir = (this.dataset.dir==='desc') ? 'asc' : 'desc';
                this.textContent = (this.dataset.dir==='desc') ? '내림차순' : '오름차순';
                applyDeptSorting(sectionId);
            });
            var q = document.getElementById('dept-search-' + sectionId);
            if (q) q.addEventListener('input', function(){
                // 콤마 분리 다중 검색 지원: 입력값을 쉼표로 나눠 any-match 필터
                applyDeptSorting(sectionId);
            });
            var resetBtn = document.getElementById('dept-reset-' + sectionId);
            if (resetBtn) resetBtn.addEventListener('click', function(){
                document.getElementById('dept-sort-key-' + sectionId).value = 'name';
                document.getElementById('dept-year-mode-' + sectionId).value = 'overall';
                document.getElementById('dept-topn-' + sectionId).value = 'all';
                var dirB = document.getElementById('dept-sort-dir-' + sectionId);
                dirB.dataset.dir = 'desc'; dirB.textContent='내림차순';
                var se = document.getElementById('dept-search-' + sectionId); if (se) se.value='';
                applyDeptSorting(sectionId);
            });
        }

        // ===== 사이드 네비: 부드러운 스크롤 + 스크롤스파이 =====
        function initSideNavScrollSpy() {
            var sideNav = document.querySelector('.side-nav');
            if (!sideNav) return; // 대학 상세 페이지에만 존재

            // 부드러운 스크롤
            sideNav.querySelectorAll('.nav-link').forEach(function(link){
                link.addEventListener('click', function(e){
                    var href = this.getAttribute('href');
                    if (href && href.startsWith('#')) {
                        e.preventDefault();
                        var target = document.querySelector(href);
                        if (target) {
                            target.scrollIntoView({behavior:'smooth', block:'start'});
                        }
                    }
                });
            });

            // 스크롤스파이 (현재 보이는 전형 하이라이트)
            var sectionEls = document.querySelectorAll('.subtype-section');
            if (!sectionEls.length) return;
            var linkMap = {};
            sideNav.querySelectorAll('.nav-link').forEach(function(link){
                var href = link.getAttribute('href') || '';
                if (href.startsWith('#')) linkMap[href.substring(1)] = link;
            });

            function setActive(id) {
                Object.values(linkMap).forEach(function(l){ l.classList.remove('active'); });
                if (linkMap[id]) linkMap[id].classList.add('active');
            }

            // 첫 항목 기본 활성화
            var first = sectionEls[0];
            if (first && linkMap[first.id]) linkMap[first.id].classList.add('active');

            var observer = new IntersectionObserver(function(entries){
                entries.forEach(function(entry){
                    if (entry.isIntersecting) {
                        setActive(entry.target.id);
                    }
                });
            }, { rootMargin: '0px 0px -60% 0px', threshold: [0.3, 0.6] });

            sectionEls.forEach(function(sec){ observer.observe(sec); });
        }

        document.addEventListener('DOMContentLoaded', function(){
            initSideNavScrollSpy();
        });
        
        function switchGradeType(plotId, gradeType) {
            // 등급 타입 전환 (환산등급 <-> 전교과등급)
            if (currentGradeTypes[plotId] === gradeType) return;
            
            currentGradeTypes[plotId] = gradeType;
            
            // 버튼 활성화 상태 변경
            var convBtn = document.getElementById('btn-conv-' + plotId);
            var allSubjBtn = document.getElementById('btn-all-subj-' + plotId);
            
            if (convBtn && allSubjBtn) {
                convBtn.classList.toggle('active', gradeType === 'conv');
                allSubjBtn.classList.toggle('active', gradeType === 'all_subj');
            }
            
            // 통계 표시 전환
            var convStats = document.getElementById('conv-stats-' + plotId);
            var allSubjStats = document.getElementById('all-subj-stats-' + plotId);
            var convDetailed = document.getElementById('conv-detailed-' + plotId);
            var allSubjDetailed = document.getElementById('all-subj-detailed-' + plotId);
            
            if (convStats && allSubjStats) {
                convStats.style.display = (gradeType === 'conv') ? 'block' : 'none';
                allSubjStats.style.display = (gradeType === 'all_subj') ? 'block' : 'none';
            }
            
            if (convDetailed && allSubjDetailed) {
                convDetailed.style.display = (gradeType === 'conv') ? 'block' : 'none';
                allSubjDetailed.style.display = (gradeType === 'all_subj') ? 'block' : 'none';
            }
            
            // 사분위 표 전환 (연도별 미니 카드)
            var qConv = document.getElementById('quartile-conv-' + plotId);
            var qAll = document.getElementById('quartile-all-' + plotId);
            if (qConv && qAll) {
                qConv.style.display = (gradeType === 'conv') ? 'block' : 'none';
                qAll.style.display = (gradeType === 'all_subj') ? 'block' : 'none';
            }

            // 박스플롯 업데이트
            updatePlot(plotId, gradeType);
        }

        function switchGroupGrade(ids, gradeType, anchorId) {
            try {
                (ids || []).forEach(function(id){ 
                    switchGradeType(id, gradeType);
                    
                    // 모집단위별 사분위표도 함께 전환
                    var qConv = document.getElementById('quartile-conv-' + id);
                    var qAll = document.getElementById('quartile-all-' + id);
                    if (qConv && qAll) {
                        qConv.style.display = (gradeType === 'conv') ? 'block' : 'none';
                        qAll.style.display = (gradeType === 'all_subj') ? 'block' : 'none';
                    }
                });
                
                if (anchorId) {
                    var allBtn = document.getElementById('btn-bulk-all-' + anchorId);
                    var convBtn = document.getElementById('btn-bulk-conv-' + anchorId);
                    if (allBtn && convBtn) {
                        allBtn.classList.toggle('active', gradeType === 'all_subj');
                        convBtn.classList.toggle('active', gradeType === 'conv');
                    }
                }
            } catch (e) {
                console.warn('switchGroupGrade error', e, ids, anchorId);
            }
        }
        
        function updatePlot(plotId, gradeType) {
            // Plotly로 박스플롯 업데이트 (전형 전체용)
            if (!window.Plotly || !window.plotsData || !window.plotsData[plotId]) {
                console.warn('Plotly or plot data not available for plotId:', plotId);
                return;
            }
            
            var plotDiv = document.getElementById('plot-' + plotId);
            if (!plotDiv) return;
            
            var plotData = window.plotsData[plotId];
            var traces = gradeType === 'conv' ? plotData.convTraces : plotData.allSubjTraces;
            
            var layout = {
                template: 'plotly_white',
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#ffffff',
                font: {family: "Pretendard, Inter, 'Noto Sans KR', sans-serif", color: "#334155", size: 13},
                height: 400,
                autosize: true,
                margin: {t: 20, b: 50, l: 60, r: 30},
                xaxis: { title: { text: '결과', font: { size: 13, color: '#333' }}, type: 'category', gridcolor:'#eef2f7', linecolor:'#e2e8f0' },
                yaxis: {
                    range: [9.5, 0.5],
                    title: { text: gradeType === 'conv' ? '환산등급' : '전교과등급', font: { size: 13, color: '#333' }},
                    autorange: false,
                    fixedrange: true,
                    tickmode: 'array',
                    tickvals: [1,2,3,4,5,6,7,8,9],
                    ticktext: ['1','2','3','4','5','6','7','8','9'],
                    showgrid: true,
                    gridcolor: '#e0e0e0'
                },
                plot_bgcolor: "white",
                paper_bgcolor: "white",
                showlegend: false
            };
            
            try {
                var config = {displayModeBar: false, responsive: false};
                if (initializedPlots[plotId]) {
                    Plotly.react(plotDiv, traces, layout, config);
                } else {
                    Plotly.newPlot(plotDiv, traces, layout, config);
                    initializedPlots[plotId] = true;
                }
                // y축 범위 재적용 (토글 후 축 확대 방지)
                Plotly.relayout(plotDiv, {
                    'yaxis.autorange': false,
                    'yaxis.range': [9.5, 0.5],
                    'yaxis.tickvals': [1,2,3,4,5,6,7,8,9],
                    'yaxis.ticktext': ['1','2','3','4','5','6','7','8','9']
                });
                try { if (window.Plotly) Plotly.Plots.resize(plotDiv); } catch(e){}
            } catch (error) {
                console.error('플롯 업데이트 오류:', error);
            }
        }
        
        function updateDeptPlot(plotId, gradeType) {
            // Plotly로 박스플롯 업데이트 (모집단위별용)
            if (!window.Plotly || !window.plotsData || !window.plotsData[plotId]) {
                console.warn('Plotly or plot data not available for plotId:', plotId);
                return;
            }
            
            var plotDiv = document.getElementById('dept-plot-' + plotId);
            if (!plotDiv) return;
            
            var plotData = window.plotsData[plotId];
            var traces = gradeType === 'conv' ? plotData.convTraces : plotData.allSubjTraces;
            
            var layout = {
                template: 'plotly_white',
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#ffffff',
                font: {family: "Pretendard, Inter, 'Noto Sans KR', sans-serif", color: "#334155", size: 12},
                height: 300,  // 모집단위별은 좀 더 작게
                autosize: true,
                margin: {t: 20, b: 50, l: 60, r: 30},
                xaxis: { title: { text: '결과', font: { size: 12, color: '#333' }}, type: 'category', gridcolor:'#eef2f7', linecolor:'#e2e8f0' },
                yaxis: {
                    range: [9.5, 0.5],
                    title: { text: gradeType === 'conv' ? '환산등급' : '전교과등급', font: { size: 12, color: '#333' }},
                    autorange: false,
                    fixedrange: true,
                    tickmode: 'array',
                    tickvals: [1,2,3,4,5,6,7,8,9],
                    ticktext: ['1','2','3','4','5','6','7','8','9'],
                    showgrid: true,
                    gridcolor: '#e0e0e0'
                },
                plot_bgcolor: "white",
                paper_bgcolor: "white",
                showlegend: false
            };
            
            try {
                var config = {displayModeBar: false, responsive: false};
                if (initializedPlots[plotId]) {
                    Plotly.react(plotDiv, traces, layout, config);
                } else {
                    Plotly.newPlot(plotDiv, traces, layout, config);
                    initializedPlots[plotId] = true;
                }
                // y축 범위 재적용 (토글 후 축 확대 방지)
                Plotly.relayout(plotDiv, {
                    'yaxis.autorange': false,
                    'yaxis.range': [9.5, 0.5],
                    'yaxis.tickvals': [1,2,3,4,5,6,7,8,9],
                    'yaxis.ticktext': ['1','2','3','4','5','6','7','8','9']
                });
                try { if (window.Plotly) Plotly.Plots.resize(plotDiv); } catch(e){}
            } catch (error) {
                console.error('모집단위별 플롯 업데이트 오류:', error);
            }
        }
        
        function initializePlots() {
            // 보이는 플롯만 초기화 (전형 전체가 기본으로 보임)
            document.querySelectorAll('[id^="plot-"]').forEach(function(plotDiv) {
                // 부모 컨테이너가 보이는 상태인지 확인
                var parentView = plotDiv.closest('[id^="total-view-"]');
                if (parentView && parentView.style.display !== 'none') {
                    var plotId = plotDiv.id.split('-')[1];
                    if (!currentGradeTypes[plotId]) {
                        currentGradeTypes[plotId] = 'all_subj';  // 기본값: 전교과등급
                    }
                    updatePlot(plotId, currentGradeTypes[plotId]);
                }
            });
            
            // 모집단위별 박스플롯은 초기에 숨겨져 있으므로 초기화하지 않음
            // (switchView에서 탭 전환 시 초기화됨)
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            initializeCharts();
            
            // 플롯 초기화 (Plotly 로드 후) - 충분한 지연 후 실행
            if (typeof Plotly !== 'undefined') {
                setTimeout(function(){
                    initializePlots();
                    // 초기화 후 리사이즈 시도
                    setTimeout(function(){
                        try {
                            document.querySelectorAll('[id^="plot-"]').forEach(function(div){
                                var parentView = div.closest('[id^="total-view-"]');
                                if (parentView && parentView.style.display !== 'none' && window.Plotly && div.offsetWidth > 0) {
                                    Plotly.Plots.resize(div);
                                }
                            });
                            window.dispatchEvent(new Event('resize'));
                        } catch(e) { console.warn('initial resize error', e); }
                    }, 100);
                }, 300);
                
                // 추가 리사이즈 (더 긴 지연)
                setTimeout(function(){
                    try {
                        document.querySelectorAll('[id^="plot-"]').forEach(function(div){
                            var parentView = div.closest('[id^="total-view-"]');
                            if (parentView && parentView.style.display !== 'none' && window.Plotly && div.offsetWidth > 0) {
                                Plotly.Plots.resize(div);
                            }
                        });
                    } catch(e) { console.warn('secondary resize error', e); }
                }, 800);
            } else {
                // Plotly가 로드되지 않은 경우 대기
                var checkPlotly = setInterval(function() {
                    if (typeof Plotly !== 'undefined') {
                        clearInterval(checkPlotly);
                        setTimeout(function(){
                            initializePlots();
                            setTimeout(function(){
                                try {
                                    document.querySelectorAll('[id^="plot-"]').forEach(function(div){
                                        var parentView = div.closest('[id^="total-view-"]');
                                        if (parentView && parentView.style.display !== 'none' && window.Plotly && div.offsetWidth > 0) {
                                            Plotly.Plots.resize(div);
                                        }
                                    });
                                    window.dispatchEvent(new Event('resize'));
                                } catch(e) { console.warn('delayed resize error', e); }
                            }, 100);
                        }, 300);
                        
                        // 추가 리사이즈
                        setTimeout(function(){
                            try {
                                document.querySelectorAll('[id^="plot-"]').forEach(function(div){
                                    var parentView = div.closest('[id^="total-view-"]');
                                    if (parentView && parentView.style.display !== 'none' && window.Plotly && div.offsetWidth > 0) {
                                        Plotly.Plots.resize(div);
                                    }
                                });
                            } catch(e) { console.warn('secondary delayed resize error', e); }
                        }, 800);
                    }
                }, 100);
            }
            
            // 부드러운 스크롤
            document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    e.preventDefault();
                    var target = document.querySelector(this.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth'
                        });
                    }
                });
            });
            // 모집단위 정렬 바 바인딩 및 초기 정렬
            document.querySelectorAll('.subtype-section').forEach(function(sec){
                var id = (sec.querySelector('[id^="dept-view-"]')||{}).id || '';
                if (!id) return;
                var sid = id.split('-').pop();
                bindDeptSortBar(sid);
                // 기본값으로 초기 적용
                applyDeptSorting(sid);
            });
            // 대학 상단 비교 섹션 초기화 (박스플롯 버전)
            if (typeof initDeptCompareSectionBoxplots === 'function') {
                initDeptCompareSectionBoxplots();
            } else {
                initDeptCompareSection();
            }
        });

        // 모바일 최적화 JavaScript
        
        // 터치 이벤트 지원
        function addTouchSupport() {
            // 모든 클릭 가능한 요소에 터치 클래스 추가
            const clickableElements = document.querySelectorAll('.summary-card, .university-item, .nav-link, .tab-btn, .grade-btn');
            clickableElements.forEach(element => {
                element.addEventListener('touchstart', function() {
                    this.style.transform = 'scale(0.98)';
                }, {passive: true});
                
                element.addEventListener('touchend', function() {
                    this.style.transform = '';
                }, {passive: true});
            });
        }
        
        // 모바일에서 테이블 스크롤 힌트 표시
        function addTableScrollHints() {
            const tables = document.querySelectorAll('.data-table');
            tables.forEach(table => {
                if (table.scrollWidth > table.clientWidth) {
                    // 스크롤 힌트 추가
                    const hint = document.createElement('div');
                    hint.className = 'scroll-hint';
                    hint.innerHTML = '← 좌우로 스크롤하여 더 많은 정보 보기 →';
                    hint.style.cssText = `
                        text-align: center; 
                        font-size: 12px; 
                        color: #666; 
                        margin: 5px 0; 
                        padding: 5px; 
                        background: #f8f9fa; 
                        border-radius: 4px;
                        animation: fadeInOut 3s ease-in-out;
                    `;
                    table.parentNode.insertBefore(hint, table.nextSibling);
                    
                    // 3초 후 힌트 제거
                    setTimeout(() => {
                        if (hint.parentNode) {
                            hint.parentNode.removeChild(hint);
                        }
                    }, 3000);
                }
            });
        }
        
        // 모바일에서 차트 크기 조정
        function adjustChartsForMobile() {
            if (window.innerWidth <= 768) {
                const charts = document.querySelectorAll('.plot-chart');
                charts.forEach(chart => {
                    chart.style.height = '250px';
                    // 차트가 Plotly 차트인 경우 리사이즈
                    if (chart.id && window.Plotly) {
                        setTimeout(() => {
                            try {
                                window.Plotly.Plots.resize(chart.id);
                            } catch (e) {
                                console.log('Chart resize failed:', e);
                            }
                        }, 100);
                    }
                });
            }
        }
        
        // 모바일 네비게이션 토글
        function initMobileNavigation() {
            const sideNav = document.querySelector('.side-nav');
            const mainContent = document.querySelector('.main-content');
            
            if (sideNav && window.innerWidth <= 768) {
                // 모바일에서 네비게이션 접기/펼치기 버튼 추가
                const toggleBtn = document.createElement('button');
                toggleBtn.innerHTML = '📋 네비게이션 보기';
                toggleBtn.className = 'nav-toggle-btn';
                toggleBtn.style.cssText = `
                    width: 100%; 
                    padding: 10px; 
                    margin-bottom: 10px; 
                    background: #667eea; 
                    color: white; 
                    border: none; 
                    border-radius: 6px; 
                    font-size: 14px;
                    cursor: pointer;
                `;
                
                // 처음에는 네비게이션 숨김
                sideNav.style.display = 'none';
                
                toggleBtn.addEventListener('click', function() {
                    if (sideNav.style.display === 'none') {
                        sideNav.style.display = 'block';
                        toggleBtn.innerHTML = '📋 네비게이션 숨김';
                    } else {
                        sideNav.style.display = 'none';
                        toggleBtn.innerHTML = '📋 네비게이션 보기';
                    }
                });
                
                if (mainContent) {
                    mainContent.insertBefore(toggleBtn, mainContent.firstChild);
                }
            }
        }
        
        // 화면 회전 감지 및 차트 재조정
        function handleOrientationChange() {
            window.addEventListener('orientationchange', function() {
                setTimeout(() => {
                    adjustChartsForMobile();
                    addTableScrollHints();
                }, 500);
            });
        }
        
        // iOS Safari의 100vh 문제 해결
        function fixiOSViewportHeight() {
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                window.addEventListener('resize', () => {
                    const vh = window.innerHeight * 0.01;
                    document.documentElement.style.setProperty('--vh', `${vh}px`);
                });
            }
        }
        
        // 모바일 최적화 초기화
        function initMobileOptimizations() {
            addTouchSupport();
            addTableScrollHints();
            adjustChartsForMobile();
            initMobileNavigation();
            handleOrientationChange();
            fixiOSViewportHeight();
            
            // 스크롤 성능 최적화
            if ('scrollBehavior' in document.documentElement.style) {
                document.documentElement.style.scrollBehavior = 'smooth';
            }
        }
        
        // 페이지 로드 완료 후 모바일 최적화 실행
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initMobileOptimizations);
        } else {
            initMobileOptimizations();
        }
        
        // 리사이즈 이벤트 처리
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                adjustChartsForMobile();
                addTableScrollHints();
            }, 250);
        });
        