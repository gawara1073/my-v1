/**
 * コマ合わせ (Koma-Awase) - アプリケーションロジック
 * v1.0.0 (プロトタイプ)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. 定数とアプリケーション状態 (State)
    // ---------------------------------------------------------
    const DAYS_WEEKDAY = ['月', '火', '水', '木', '金'];
    const DAYS_WEEKEND = ['土', '日'];
    
    // 時限の定義 (一般的な大学のコマ割り)
    const PERIODS = [
        { num: 1, time: '9:00 - 10:30' },
        { num: 2, time: '10:40 - 12:10' },
        { num: 3, time: '13:00 - 14:30' },
        { num: 4, time: '14:40 - 16:10' },
        { num: 5, time: '16:20 - 17:50' },
        { num: 6, time: '18:00 - 19:30' }
    ];

    // アプリの状態
    const state = {
        showWeekend: false,
        currentName: '',
        currentSchedule: new Set(), // 自分で選択中のコマキー (例: "Mon-1", "Tue-3")
        members: [], // グループメンバーの配列 { id, name, schedule: [] }
        
        // ドラッグ/タッチ選択用の一時状態
        isDragging: false,
        dragMode: true, // true: 選択モード, false: 解除モード
        lastTouchedCell: null
    };

    // ---------------------------------------------------------
    // 2. DOM要素の取得
    // ---------------------------------------------------------
    const inputName = document.getElementById('input-name');
    const btnToggleWeekend = document.getElementById('btn-toggle-weekend');
    const selectionGrid = document.getElementById('selection-grid');
    const resultGrid = document.getElementById('result-grid');
    const btnAddMember = document.getElementById('btn-add-member');
    const btnShareUrl = document.getElementById('btn-share-url');
    const btnClearSelection = document.getElementById('btn-clear-selection');
    const memberCountEl = document.getElementById('member-count');
    const memberTagsEl = document.getElementById('member-tags');
    const recommendationList = document.getElementById('recommendation-list');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // ---------------------------------------------------------
    // 3. 初期化処理
    // ---------------------------------------------------------
    function init() {
        // Lucideアイコンの初期化
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // URLパラメータからのデータ復元
        loadDataFromUrl();

        // 時間割グリッドの初期描画
        renderTimetables();
        
        // メンバーリストとヒートマップの更新
        updateResults();
        
        // イベントリスナーの登録
        setupEventListeners();
    }

    // ---------------------------------------------------------
    // 4. グリッドの描画 (Render Timetables)
    // ---------------------------------------------------------
    function getActiveDays() {
        return state.showWeekend ? [...DAYS_WEEKDAY, ...DAYS_WEEKEND] : DAYS_WEEKDAY;
    }

    function renderTimetables() {
        const days = getActiveDays();
        const totalColumns = days.length;
        
        // CSS変数の更新 (Gridの列数を制御)
        selectionGrid.style.setProperty('--columns', totalColumns);
        resultGrid.style.setProperty('--columns', totalColumns);

        // 1. 選択用時間割グリッドの生成
        generateGridHtml(selectionGrid, true);
        
        // 2. 結果ヒートマップ用時間割グリッドの生成
        generateGridHtml(resultGrid, false);
        
        // Lucideアイコンの再適用 (動的生成の要素にアイコンが含まれる場合のため)
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function generateGridHtml(gridElement, isSelectable) {
        const days = getActiveDays();
        gridElement.innerHTML = '';

        // 左上の空白の角セル
        const cornerCell = document.createElement('div');
        cornerCell.className = 'grid-cell cell-header';
        cornerCell.innerText = '時間';
        gridElement.appendChild(cornerCell);

        // 曜日ヘッダーの描画
        days.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'grid-cell cell-header';
            headerCell.innerText = day;
            gridElement.appendChild(headerCell);
        });

        // 各時限の行を描画
        PERIODS.forEach(period => {
            // 時限ラベルセル
            const labelCell = document.createElement('div');
            labelCell.className = 'grid-cell cell-label';
            
            const numEl = document.createElement('span');
            numEl.className = 'period-num';
            numEl.innerText = period.num;
            
            const timeEl = document.createElement('span');
            timeEl.className = 'period-time';
            timeEl.innerText = period.time.split(' - ')[0]; // 開始時間のみ表示して省スペース化
            
            labelCell.appendChild(numEl);
            labelCell.appendChild(timeEl);
            gridElement.appendChild(labelCell);

            // 各曜日の時間枠セル
            days.forEach((day, dayIndex) => {
                const cell = document.createElement('div');
                const cellKey = `${day}-${period.num}`;
                
                if (isSelectable) {
                    // 選択用グリッド
                    cell.className = 'grid-cell cell-slot';
                    cell.dataset.key = cellKey;
                    
                    const iconEl = document.createElement('i');
                    iconEl.setAttribute('data-lucide', 'circle');
                    iconEl.style.width = '16px';
                    iconEl.style.height = '16px';
                    iconEl.style.opacity = '0.3';
                    cell.appendChild(iconEl);

                    // 選択済みならクラスとアイコンを更新
                    if (state.currentSchedule.has(cellKey)) {
                        cell.classList.add('selected');
                        iconEl.setAttribute('data-lucide', 'check-circle');
                        iconEl.style.opacity = '1';
                    }
                } else {
                    // 結果ヒートマップ用グリッド
                    cell.className = 'grid-cell cell-result';
                    cell.dataset.resultKey = cellKey;
                    
                    const labelSpan = document.createElement('span');
                    labelSpan.className = 'result-ratio-label';
                    labelSpan.innerText = '-';
                    cell.appendChild(labelSpan);
                }
                
                gridElement.appendChild(cell);
            });
        });
    }

    // ---------------------------------------------------------
    // 5. ドラッグ/スワイプによるインタラクション
    // ---------------------------------------------------------
    function setupEventListeners() {
        // 土日表示トグル
        btnToggleWeekend.addEventListener('click', () => {
            state.showWeekend = !state.showWeekend;
            btnToggleWeekend.classList.toggle('active', state.showWeekend);
            renderTimetables();
            updateResults(); // ヒートマップも再描画
        });

        // 選択用グリッドのマウス/タッチイベント
        setupDragSelection();

        // メンバー追加ボタン
        btnAddMember.addEventListener('click', handleAddMember);

        // LINE共有URLコピーボタン
        btnShareUrl.addEventListener('click', handleShareUrl);

        // 選択クリアボタン
        btnClearSelection.addEventListener('click', () => {
            state.currentSchedule.clear();
            renderTimetables();
        });

        // 名前入力欄の変更検知 (リアルタイムで状態に同期)
        inputName.addEventListener('input', (e) => {
            state.currentName = e.target.value.trim();
        });
        
        // 結果グリッドのタップイベント (スマホでのツールチップ代替表示用)
        resultGrid.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell-result');
            if (cell && cell.dataset.tooltip) {
                showToast(cell.dataset.tooltip, 3000);
            }
        });
    }

    function setupDragSelection() {
        // --- PC向けマウスドラッグイベント ---
        selectionGrid.addEventListener('mousedown', (e) => {
            const cell = e.target.closest('.cell-slot');
            if (!cell) return;
            
            e.preventDefault();
            state.isDragging = true;
            selectionGrid.classList.add('dragging');
            
            const cellKey = cell.dataset.key;
            // ドラッグ開始セルの状態の反転でモードを決定 (すでに選択されていれば「解除」、なければ「選択」)
            state.dragMode = !state.currentSchedule.has(cellKey);
            toggleCellSelection(cell, cellKey, state.dragMode);
        });

        window.addEventListener('mousemove', (e) => {
            if (!state.isDragging) return;
            
            const cell = e.target.closest('.cell-slot');
            if (!cell) return;
            
            const cellKey = cell.dataset.key;
            toggleCellSelection(cell, cellKey, state.dragMode);
        });

        window.addEventListener('mouseup', () => {
            if (state.isDragging) {
                state.isDragging = false;
                selectionGrid.classList.remove('dragging');
            }
        });

        // --- スマホ向けタッチイベント (スワイプなぞり選択) ---
        selectionGrid.addEventListener('touchstart', (e) => {
            const cell = e.target.closest('.cell-slot');
            if (!cell) return;
            
            // スクロールを一時的に防止してドラッグ操作に専念させる
            state.isDragging = true;
            
            const cellKey = cell.dataset.key;
            state.dragMode = !state.currentSchedule.has(cellKey);
            state.lastTouchedCell = cell;
            toggleCellSelection(cell, cellKey, state.dragMode);
        }, { passive: true });

        selectionGrid.addEventListener('touchmove', (e) => {
            if (!state.isDragging) return;
            
            // タッチ位置の座標から要素を取得
            const touch = e.touches[0];
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            if (!targetElement) return;
            
            const cell = targetElement.closest('.cell-slot');
            if (!cell || cell === state.lastTouchedCell) return;
            
            state.lastTouchedCell = cell;
            const cellKey = cell.dataset.key;
            toggleCellSelection(cell, cellKey, state.dragMode);
        });

        selectionGrid.addEventListener('touchend', () => {
            state.isDragging = false;
            state.lastTouchedCell = null;
        });
    }

    function toggleCellSelection(cellElement, cellKey, select) {
        const iconEl = cellElement.querySelector('i');
        
        if (select) {
            if (!state.currentSchedule.has(cellKey)) {
                state.currentSchedule.add(cellKey);
                cellElement.classList.add('selected');
                if (iconEl) {
                    iconEl.setAttribute('data-lucide', 'check-circle');
                    iconEl.style.opacity = '1';
                }
            }
        } else {
            if (state.currentSchedule.has(cellKey)) {
                state.currentSchedule.delete(cellKey);
                cellElement.classList.remove('selected');
                if (iconEl) {
                    iconEl.setAttribute('data-lucide', 'circle');
                    iconEl.style.opacity = '0.3';
                }
            }
        }
        
        // Lucideアイコンの更新
        if (typeof lucide !== 'undefined' && iconEl) {
            lucide.createIcons({
                attrs: { 'data-lucide': iconEl.getAttribute('data-lucide') },
                nameAttr: 'data-lucide'
            });
        }
    }

    // ---------------------------------------------------------
    // 6. メンバーデータの処理と結果計算
    // ---------------------------------------------------------
    function handleAddMember() {
        if (!state.currentName) {
            showToast('名前を入力してください！', 3000);
            inputName.focus();
            return;
        }

        // 重複チェック
        const isDuplicate = state.members.some(m => m.name.toLowerCase() === state.currentName.toLowerCase());
        if (isDuplicate) {
            if (!confirm(`すでに「${state.currentName}」というメンバーが登録されています。上書きしますか？`)) {
                return;
            }
            // 上書き処理 (既存を削除)
            state.members = state.members.filter(m => m.name.toLowerCase() !== state.currentName.toLowerCase());
        }

        // 新しいメンバーを追加
        const newMember = {
            id: 'mem_' + Date.now() + Math.random().toString(36).substr(2, 5),
            name: state.currentName,
            schedule: Array.from(state.currentSchedule)
        };

        state.members.push(newMember);
        
        // 入力フォームをクリア（次の方の入力へ）
        state.currentSchedule.clear();
        inputName.value = '';
        state.currentName = '';
        
        // 画面の更新
        renderTimetables();
        updateResults();
        
        showToast(`${newMember.name} さんの空き時間を追加しました！`, 3000);
    }

    function removeMember(memberId) {
        const removed = state.members.find(m => m.id === memberId);
        if (!removed) return;
        
        state.members = state.members.filter(m => m.id !== memberId);
        updateResults();
        showToast(`${removed.name} さんのデータを削除しました。`, 3000);
    }

    function updateResults() {
        const totalMembers = state.members.length;
        memberCountEl.innerText = totalMembers;

        // 1. メンバータグリストの描画
        memberTagsEl.innerHTML = '';
        if (totalMembers === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'no-members-msg';
            emptyMsg.innerText = 'メンバーがまだ登録されていません。上のボタンから追加してね！';
            memberTagsEl.appendChild(emptyMsg);
        } else {
            state.members.forEach(member => {
                const tag = document.createElement('div');
                tag.className = 'member-tag';
                tag.innerHTML = `
                    <span>👤 ${member.name}</span>
                    <button type="button" class="member-tag-delete" aria-label="${member.name}のデータを削除">
                        <i data-lucide="x"></i>
                    </button>
                `;
                
                // 削除イベント
                tag.querySelector('.member-tag-delete').addEventListener('click', () => {
                    removeMember(member.id);
                });
                
                memberTagsEl.appendChild(tag);
            });
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }

        // 2. 共通空き時間のヒートマップ計算と反映
        const days = getActiveDays();
        const scoreBoard = {}; // { 'Mon-1': [name1, name2], ... }
        
        // スコアボード初期化
        days.forEach(day => {
            PERIODS.forEach(period => {
                scoreBoard[`${day}-${period.num}`] = [];
            });
        });

        // 各メンバーのスケジュールを集計
        state.members.forEach(member => {
            member.schedule.forEach(key => {
                if (scoreBoard[key]) {
                    scoreBoard[key].push(member.name);
                }
            });
        });

        // ヒートマップグリッドの更新
        const resultCells = resultGrid.querySelectorAll('.cell-result');
        resultCells.forEach(cell => {
            const key = cell.dataset.resultKey;
            if (!key || !scoreBoard[key]) return;

            const freeMembers = scoreBoard[key];
            const freeCount = freeMembers.length;
            const ratioLabel = cell.querySelector('.result-ratio-label');
            
            // セルのリセット
            cell.style.backgroundColor = '';
            cell.style.color = '';
            
            if (totalMembers === 0) {
                ratioLabel.innerText = '-';
                cell.removeAttribute('data-tooltip');
                return;
            }

            // 比率を計算して背景色の透明度(アルファ)に適用
            const ratio = freeCount / totalMembers;
            
            if (freeCount > 0) {
                // 参加メンバー数に応じたカラー濃淡 (ミントグリーン)
                // ライトモードとダークモードで視認性を調整
                const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                
                if (isDark) {
                    cell.style.backgroundColor = `rgba(16, 185, 129, ${0.15 + ratio * 0.75})`;
                    cell.style.color = '#ffffff';
                } else {
                    cell.style.backgroundColor = `rgba(16, 185, 129, ${0.1 + ratio * 0.8})`;
                    cell.style.color = ratio > 0.5 ? '#ffffff' : 'var(--text-main)';
                }
                
                ratioLabel.innerHTML = `<strong style="font-size: 1.1rem;">${freeCount}</strong><span style="font-size: 0.75rem; opacity: 0.8;">/${totalMembers}</span>`;
                
                // ツールチップ用テキスト
                cell.setAttribute('data-tooltip', `空き(${freeCount}人): ${freeMembers.join(', ')}`);
            } else {
                ratioLabel.innerText = '0';
                cell.setAttribute('data-tooltip', '空いているメンバーはいません');
            }
        });

        // 3. おすすめ日程の生成
        generateRecommendations(scoreBoard, totalMembers);
    }

    function generateRecommendations(scoreBoard, totalMembers) {
        recommendationList.innerHTML = '';
        
        if (totalMembers < 2) {
            const li = document.createElement('li');
            li.innerText = '2人以上のメンバーが追加されると、ここに最適なおすすめ時間帯を提案します！';
            recommendationList.appendChild(li);
            return;
        }

        // スコアの高い順（空いているメンバーが多い順）にソート
        const sortedSlots = Object.entries(scoreBoard)
            .map(([key, list]) => {
                const [day, period] = key.split('-');
                return {
                    key,
                    day,
                    period: parseInt(period),
                    count: list.length,
                    names: list
                };
            })
            .filter(slot => slot.count > 0) // 1人以上空いている枠のみ
            .sort((a, b) => b.count - a.count || a.period - b.period); // 人数順、同数なら時限順

        if (sortedSlots.length === 0) {
            const li = document.createElement('li');
            li.innerText = '全員の予定が完全にすれ違っています！別の日程を検討するか、選択肢を増やしてみてね。';
            recommendationList.appendChild(li);
            return;
        }

        // 上位3つの候補を表示
        const topSlots = sortedSlots.slice(0, 3);
        
        topSlots.forEach((slot, index) => {
            const li = document.createElement('li');
            const percent = Math.round((slot.count / totalMembers) * 100);
            
            const timeObj = PERIODS.find(p => p.num === slot.period);
            const timeRange = timeObj ? `(${timeObj.time})` : '';
            
            if (slot.count === totalMembers) {
                li.innerHTML = `<strong>【超おすすめ】${slot.day}曜${slot.period}限</strong> ${timeRange} - <strong>全員空いてます！✨</strong>`;
            } else {
                li.innerHTML = `<strong>【第${index + 1}候補】${slot.day}曜${slot.period}限</strong> ${timeRange} - <strong>${totalMembers}人中 ${slot.count}人 空き</strong> (${percent}%) <br><span style="font-size:0.75rem; color:var(--text-muted); margin-left:1.5rem;">空き: ${slot.names.join(', ')}</span>`;
            }
            recommendationList.appendChild(li);
        });
    }

    // ---------------------------------------------------------
    // 7. URLエンコード / デコードによるデータ共有 (P2P的サーバーレス)
    // ---------------------------------------------------------
    function handleShareUrl() {
        if (state.members.length === 0 && state.currentSchedule.size === 0) {
            showToast('まずは自分の名前と空き時間を入力して、メンバーに追加するか、入力を行ってください！', 4000);
            return;
        }

        // もし入力中だけど「メンバー追加」を押していないデータがある場合、自動で追加するか尋ねる
        if (state.currentName && state.currentSchedule.size > 0) {
            if (confirm(`現在入力中の「${state.currentName}」さんのデータを追加してからURLを生成しますか？`)) {
                handleAddMember();
            }
        }

        try {
            // データをコンパクトにまとめる
            const exportData = {
                w: state.showWeekend ? 1 : 0, // 土日フラグ
                m: state.members.map(member => ({
                    n: member.name,
                    s: member.schedule
                }))
            };

            // JSONをBase64にエンコード (日本語対応のために一度UTF-8のエスケープシーケンスにする)
            const jsonString = JSON.stringify(exportData);
            const encodedData = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => {
                return String.fromCharCode(parseInt(p1, 16));
            }));

            // 現在のベースURLを取得し、パラメータを合成
            const url = new URL(window.location.href);
            url.searchParams.set('d', encodedData);
            
            // クリップボードにコピー
            navigator.clipboard.writeText(url.toString())
                .then(() => {
                    showToast('🎉 LINE用の共有URLをクリップボードにコピーしました！友達に送ってね。', 5000);
                })
                .catch(err => {
                    console.error('URLコピーに失敗:', err);
                    // 代替表示
                    prompt('コピーに失敗したため、以下のURLを手動でコピーしてください：', url.toString());
                });
                
        } catch (error) {
            console.error('データエンコードエラー:', error);
            showToast('共有URLの作成に失敗しました。', 3000);
        }
    }

    function loadDataFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('d');
        
        if (!encodedData) return;

        try {
            // Base64デコード
            const jsonString = decodeURIComponent(Array.prototype.map.call(atob(encodedData), (c) => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const importedData = JSON.parse(jsonString);

            // データの展開
            if (importedData.w !== undefined) {
                state.showWeekend = importedData.w === 1;
                btnToggleWeekend.classList.toggle('active', state.showWeekend);
            }

            if (importedData.m && Array.isArray(importedData.m)) {
                state.members = importedData.m.map((importedMember, index) => ({
                    id: 'mem_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 3),
                    name: importedMember.n,
                    schedule: importedMember.s
                }));

                // 最新の読み込みメンバをトーストでお知らせ
                const memberNames = state.members.map(m => m.name).join('さん、');
                showToast(`📥 ${state.members.length}人の空き時間データを読み込みました！ (${memberNames}さん)`, 5000);
            }
        } catch (error) {
            console.error('データデコードエラー:', error);
            showToast('⚠️ 共有データの読み込みに失敗しました。URLが壊れている可能性があります。', 4000);
        }
    }

    // ---------------------------------------------------------
    // 8. ユーティリティ (トースト表示)
    // ---------------------------------------------------------
    let toastTimeout;
    function showToast(message, duration = 3000) {
        clearTimeout(toastTimeout);
        toastMessage.innerText = message;
        toast.classList.remove('hidden');
        
        // リフローを起こしてトランジションを有効化
        toast.offsetWidth; 
        
        toast.classList.add('show');

        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            // アニメーション完了後に完全に非表示にする
            setTimeout(() => {
                if (!toast.classList.contains('show')) {
                    toast.classList.add('hidden');
                }
            }, 400);
        }, duration);
    }

    // アプリの起動
    init();
});
