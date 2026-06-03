/**
 * コマ合わせ (Koma-Awase) - アプリケーションロジック
 * v2.0.0 (アップグレード版)
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
        currentSchedule: new Set(), // 自分で選択中のコマキー (例: "月-1", "水-3")
        members: [], // グループメンバーの配列 { id, name, schedule: [], colorIndex }
        editingMemberId: null, // 現在編集中のメンバーID (nullなら新規追加モード)
        selectedDayMobile: '月', // モバイル表示時に選択されている曜日
        scoreBoard: {}, // 結果表示用一時スコアボード保持
        
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

    // v2新規DOM要素
    const editIndicator = document.getElementById('edit-indicator');
    const editMemberName = document.getElementById('edit-member-name');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const dayTabs = document.getElementById('day-tabs');
    const slotDetailPanel = document.getElementById('slot-detail-panel');
    const slotDetailTimeLabel = document.getElementById('slot-detail-time-label');
    const slotDetailMembers = document.getElementById('slot-detail-members');
    const btnCloseDetail = document.getElementById('btn-close-detail');
    const decisionBox = document.getElementById('decision-box');
    const decisionText = document.getElementById('decision-text');
    const btnCopyDecision = document.getElementById('btn-copy-decision');

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

        // スマホ用曜日タブの生成
        renderDayTabs();

        // 画面幅によるモバイルレイアウトの適用
        checkMobileLayout();
        window.addEventListener('resize', checkMobileLayout);

        // 時間割グリッドの初期描画
        renderTimetables();
        
        // メンバーリストとヒートマップの更新
        updateResults();
        
        // イベントリスナーの登録
        setupEventListeners();
    }

    // ---------------------------------------------------------
    // 4. モバイルレイアウト＆曜日タブ制御
    // ---------------------------------------------------------
    function checkMobileLayout() {
        const isMobile = window.innerWidth <= 600;
        if (isMobile) {
            selectionGrid.classList.add('mobile-single-day');
            resultGrid.classList.add('mobile-single-day');
        } else {
            selectionGrid.classList.remove('mobile-single-day');
            resultGrid.classList.remove('mobile-single-day');
        }
        updateGridMobileClasses();
    }

    function renderDayTabs() {
        dayTabs.innerHTML = '';
        const days = getActiveDays();
        
        // 選択中の曜日が、土日トグル等で非活性になった場合のケア
        if (!days.includes(state.selectedDayMobile)) {
            state.selectedDayMobile = days[0];
        }

        days.forEach(day => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = `day-tab ${day === state.selectedDayMobile ? 'active' : ''}`;
            tab.innerText = day;
            tab.addEventListener('click', () => {
                state.selectedDayMobile = day;
                
                // タブのアクティブクラス更新
                dayTabs.querySelectorAll('.day-tab').forEach(t => {
                    t.classList.toggle('active', t.innerText === day);
                });
                
                updateGridMobileClasses();
            });
            dayTabs.appendChild(tab);
        });
    }

    function updateGridMobileClasses() {
        const activeDay = state.selectedDayMobile;
        
        const updateGrid = (grid) => {
            const cells = grid.querySelectorAll('.grid-cell');
            cells.forEach(cell => {
                const key = cell.dataset.key || cell.dataset.resultKey;
                if (cell.classList.contains('cell-header')) {
                    if (cell.innerText === activeDay) {
                        cell.classList.add('active-day');
                    } else {
                        cell.classList.remove('active-day');
                    }
                } else if (key) {
                    if (key.startsWith(activeDay + '-')) {
                        cell.classList.add('active-day');
                    } else {
                        cell.classList.remove('active-day');
                    }
                }
            });
        };
        
        updateGrid(selectionGrid);
        updateGrid(resultGrid);
    }

    // ---------------------------------------------------------
    // 5. グリッドの描画 (Render Timetables)
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
        
        // モバイル用アクティブ曜日クラスの適用
        updateGridMobileClasses();

        // Lucideアイコンの再適用
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
            timeEl.innerText = period.time.split(' - ')[0]; // 開始時間のみ表示
            
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
                    
                    // v2: ドットインジケーター用の構造に変更
                    const container = document.createElement('div');
                    container.className = 'cell-result-container';
                    
                    const ratioLabel = document.createElement('span');
                    ratioLabel.className = 'result-ratio-label';
                    ratioLabel.innerText = '-';
                    container.appendChild(ratioLabel);

                    const dotContainer = document.createElement('div');
                    dotContainer.className = 'dot-container';
                    container.appendChild(dotContainer);
                    
                    cell.appendChild(container);
                }
                
                gridElement.appendChild(cell);
            });
        });
    }

    // ---------------------------------------------------------
    // 6. ドラッグ/スワイプによるインタラクション
    // ---------------------------------------------------------
    function setupEventListeners() {
        // 土日表示トグル
        btnToggleWeekend.addEventListener('click', () => {
            state.showWeekend = !state.showWeekend;
            btnToggleWeekend.classList.toggle('active', state.showWeekend);
            renderDayTabs(); // 曜日タブの再生成
            renderTimetables();
            updateResults(); // ヒートマップも再描画
        });

        // 選択用グリッドのマウス/タッチイベント
        setupDragSelection();

        // メンバー追加/更新ボタン
        btnAddMember.addEventListener('click', handleAddMember);

        // 編集キャンセルボタン
        btnCancelEdit.addEventListener('click', handleCancelEdit);

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
        
        // 詳細パネルの閉じるボタン
        btnCloseDetail.addEventListener('click', () => {
            slotDetailPanel.classList.add('hidden');
        });

        // 決定テキストコピーボタン
        btnCopyDecision.addEventListener('click', handleCopyDecision);
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
            
            state.isDragging = true;
            
            const cellKey = cell.dataset.key;
            state.dragMode = !state.currentSchedule.has(cellKey);
            state.lastTouchedCell = cell;
            toggleCellSelection(cell, cellKey, state.dragMode);
        }, { passive: true });

        selectionGrid.addEventListener('touchmove', (e) => {
            if (!state.isDragging) return;
            
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
        
        if (typeof lucide !== 'undefined' && iconEl) {
            lucide.createIcons({
                attrs: { 'data-lucide': iconEl.getAttribute('data-lucide') },
                nameAttr: 'data-lucide'
            });
        }
    }

    // ---------------------------------------------------------
    // 7. メンバーデータの処理と結果計算
    // ---------------------------------------------------------
    function handleAddMember() {
        if (!state.currentName) {
            showToast('名前を入力してください！', 3000);
            inputName.focus();
            return;
        }

        if (state.editingMemberId) {
            // 編集モードでの更新
            const memberIndex = state.members.findIndex(m => m.id === state.editingMemberId);
            if (memberIndex !== -1) {
                const oldName = state.members[memberIndex].name;
                state.members[memberIndex].name = state.currentName;
                state.members[memberIndex].schedule = Array.from(state.currentSchedule);
                
                showToast(`✏️ ${oldName} さんの予定を更新しました！`, 3000);
            }
            
            // 編集状態のクリア
            state.editingMemberId = null;
            editIndicator.classList.add('hidden');
            btnAddMember.querySelector('span').innerText = 'メンバーに追加する';
            if (typeof lucide !== 'undefined') {
                btnAddMember.querySelector('i').setAttribute('data-lucide', 'user-plus');
                lucide.createIcons();
            }
        } else {
            // 新規追加
            const isDuplicate = state.members.some(m => m.name.toLowerCase() === state.currentName.toLowerCase());
            if (isDuplicate) {
                if (!confirm(`すでに「${state.currentName}」というメンバーが登録されています。上書きしますか？`)) {
                    return;
                }
                // 上書きの場合は一度削除
                state.members = state.members.filter(m => m.name.toLowerCase() !== state.currentName.toLowerCase());
            }

            // カラーインデックスの自動割り当て (0〜9)
            const usedIndexes = state.members.map(m => m.colorIndex);
            let nextColorIndex = 0;
            // 未使用の最小インデックスを探す
            for (let i = 0; i < 10; i++) {
                if (!usedIndexes.includes(i)) {
                    nextColorIndex = i;
                    break;
                }
                if (i === 9) {
                    nextColorIndex = state.members.length % 10; // 全て埋まっている場合は順番
                }
            }

            const newMember = {
                id: 'mem_' + Date.now() + Math.random().toString(36).substr(2, 5),
                name: state.currentName,
                schedule: Array.from(state.currentSchedule),
                colorIndex: nextColorIndex
            };

            state.members.push(newMember);
            showToast(`👤 ${newMember.name} さんの空き時間を追加しました！`, 3000);
        }

        // 成功時の紙吹雪エフェクト
        startConfetti();

        // フォームのリセット
        state.currentSchedule.clear();
        inputName.value = '';
        state.currentName = '';
        
        // グリッドと結果の更新
        renderTimetables();
        updateResults();
    }

    function editMember(memberId) {
        const member = state.members.find(m => m.id === memberId);
        if (!member) return;

        state.editingMemberId = member.id;
        state.currentName = member.name;
        inputName.value = member.name;
        
        state.currentSchedule = new Set(member.schedule);

        // 編集インジケーターの表示
        editMemberName.innerText = `「${member.name}」さんの予定を編集中...`;
        editIndicator.classList.remove('hidden');

        // ボタン表示の切り替え
        btnAddMember.querySelector('span').innerText = '予定を更新する';
        if (typeof lucide !== 'undefined') {
            btnAddMember.querySelector('i').setAttribute('data-lucide', 'check');
            lucide.createIcons();
        }

        // 入力欄にフォーカス
        inputName.focus();

        // 時間割グリッドを再描画して選択状態を反映
        renderTimetables();

        // 編集中のメンバーの最初の空き時間にモバイルの表示曜日を合わせる
        if (member.schedule.length > 0) {
            const firstSlotDay = member.schedule[0].split('-')[0];
            const days = getActiveDays();
            if (days.includes(firstSlotDay)) {
                state.selectedDayMobile = firstSlotDay;
                renderDayTabs();
                updateGridMobileClasses();
            }
        }
        
        showToast('✏️ 空き時間を変更し、終わったら「予定を更新する」ボタンを押してください。', 4000);
    }

    function handleCancelEdit() {
        state.editingMemberId = null;
        editIndicator.classList.add('hidden');
        
        state.currentSchedule.clear();
        inputName.value = '';
        state.currentName = '';
        
        btnAddMember.querySelector('span').innerText = 'メンバーに追加する';
        if (typeof lucide !== 'undefined') {
            btnAddMember.querySelector('i').setAttribute('data-lucide', 'user-plus');
            lucide.createIcons();
        }
        
        renderTimetables();
    }

    function removeMember(memberId) {
        const removed = state.members.find(m => m.id === memberId);
        if (!removed) return;
        
        if (state.editingMemberId === memberId) {
            handleCancelEdit();
        }

        state.members = state.members.filter(m => m.id !== memberId);
        
        // 詳細パネルが表示中の場合は非表示にする
        slotDetailPanel.classList.add('hidden');
        
        updateResults();
        showToast(`🗑️ ${removed.name} さんのデータを削除しました。`, 3000);
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
                const colorIdx = member.colorIndex !== undefined ? member.colorIndex : 0;
                tag.className = `member-tag m-bg-${colorIdx}`;
                tag.innerHTML = `
                    <span>👤 ${member.name}</span>
                    <button type="button" class="member-tag-edit" aria-label="${member.name}のデータを編集" style="margin-left: 0.25rem;">
                        <i data-lucide="edit-2"></i>
                    </button>
                    <button type="button" class="member-tag-delete" aria-label="${member.name}のデータを削除">
                        <i data-lucide="x"></i>
                    </button>
                `;
                
                // 編集イベント
                tag.querySelector('.member-tag-edit').addEventListener('click', (e) => {
                    e.stopPropagation();
                    editMember(member.id);
                });

                // 削除イベント
                tag.querySelector('.member-tag-delete').addEventListener('click', (e) => {
                    e.stopPropagation();
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
        const scoreBoard = {}; // { '月-1': [{name, colorIndex}], ... }
        
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
                    scoreBoard[key].push({
                        name: member.name,
                        colorIndex: member.colorIndex !== undefined ? member.colorIndex : 0
                    });
                }
            });
        });

        // 状態に保持して詳細表示等で使い回す
        state.scoreBoard = scoreBoard;

        // ヒートマップグリッドの更新
        const resultCells = resultGrid.querySelectorAll('.cell-result');
        resultCells.forEach(cell => {
            const key = cell.dataset.resultKey;
            if (!key || !scoreBoard[key]) return;

            const freeMembers = scoreBoard[key];
            const freeCount = freeMembers.length;
            const ratioLabel = cell.querySelector('.result-ratio-label');
            const dotContainer = cell.querySelector('.dot-container');
            
            // セルのリセット
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.classList.remove('perfect-match');
            if (dotContainer) dotContainer.innerHTML = '';
            
            if (totalMembers === 0) {
                ratioLabel.innerText = '-';
                cell.removeAttribute('data-tooltip');
                return;
            }

            // 比率を計算
            const ratio = freeCount / totalMembers;
            
            if (freeCount > 0) {
                // 全員空いている (一致率100%) かつメンバーが2人以上の場合、特別ハイライト
                if (freeCount === totalMembers && totalMembers >= 2) {
                    cell.classList.add('perfect-match');
                } else {
                    // 人数に応じたカラー濃淡
                    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (isDark) {
                        cell.style.backgroundColor = `rgba(16, 185, 129, ${0.15 + ratio * 0.75})`;
                        cell.style.color = '#ffffff';
                    } else {
                        cell.style.backgroundColor = `rgba(16, 185, 129, ${0.1 + ratio * 0.8})`;
                        cell.style.color = ratio > 0.5 ? '#ffffff' : 'var(--text-main)';
                    }
                }
                
                ratioLabel.innerHTML = `<strong style="font-size: 1.1rem;">${freeCount}</strong><span style="font-size: 0.75rem; opacity: 0.8;">/${totalMembers}</span>`;
                
                // カラードットをセル内に並べる
                if (dotContainer) {
                    freeMembers.forEach(m => {
                        const dot = document.createElement('span');
                        dot.className = `color-dot m-bg-${m.colorIndex}`;
                        dot.title = m.name;
                        dotContainer.appendChild(dot);
                    });
                }

                // ツールチップテキスト
                const names = freeMembers.map(m => m.name).join(', ');
                cell.setAttribute('data-tooltip', `空き(${freeCount}人): ${names}`);
            } else {
                ratioLabel.innerText = '0';
                cell.setAttribute('data-tooltip', '空いているメンバーはいません');
            }
        });

        // タップしたセル詳細表示イベントのバインド
        setupResultCellClick();

        // 3. おすすめ日程の生成
        generateRecommendations(scoreBoard, totalMembers);
    }

    function setupResultCellClick() {
        const cells = resultGrid.querySelectorAll('.cell-result');
        cells.forEach(cell => {
            // イベントの重複登録防止のためクローンを作成するか、一旦クリア
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);

            newCell.addEventListener('click', (e) => {
                const key = newCell.dataset.resultKey;
                if (!key || !state.scoreBoard[key]) return;

                const [day, periodNum] = key.split('-');
                const period = PERIODS.find(p => p.num === parseInt(periodNum));
                const timeRange = period ? ` (${period.time})` : '';

                const freeMembers = state.scoreBoard[key];

                // 詳細パネルの更新
                slotDetailTimeLabel.innerText = `${day}曜 ${periodNum}限${timeRange} の空き状況`;
                slotDetailMembers.innerHTML = '';

                if (freeMembers.length === 0) {
                    slotDetailMembers.innerHTML = '<p class="no-members-msg" style="font-style:normal;">この時間に空いているメンバーはいません。</p>';
                } else {
                    freeMembers.forEach(m => {
                        const badge = document.createElement('span');
                        badge.className = `detail-member-badge m-bg-${m.colorIndex}`;
                        badge.innerHTML = `<span class="member-avatar"></span> ${m.name}`;
                        slotDetailMembers.appendChild(badge);
                    });
                }

                slotDetailPanel.classList.remove('hidden');
                slotDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        });
    }

    function generateRecommendations(scoreBoard, totalMembers) {
        recommendationList.innerHTML = '';
        decisionBox.classList.add('hidden'); // 決定ボックスを一旦隠す
        
        if (totalMembers < 2) {
            const li = document.createElement('li');
            li.innerText = '2人以上のメンバーが追加されると、ここに最適なおすすめ時間帯を提案します！';
            recommendationList.appendChild(li);
            return;
        }

        // スコアの高い順にソート
        const sortedSlots = Object.entries(scoreBoard)
            .map(([key, list]) => {
                const [day, period] = key.split('-');
                return {
                    key,
                    day,
                    period: parseInt(period),
                    count: list.length,
                    names: list.map(m => m.name),
                    members: list
                };
            })
            .filter(slot => slot.count > 0)
            .sort((a, b) => b.count - a.count || a.period - b.period);

        if (sortedSlots.length === 0) {
            const li = document.createElement('li');
            li.innerText = '全員の予定が完全にすれ違っています！別の日程を検討するか、選択肢を増やしてみてね。';
            recommendationList.appendChild(li);
            return;
        }

        // 上位3つの候補
        const topSlots = sortedSlots.slice(0, 3);
        
        topSlots.forEach((slot, index) => {
            const li = document.createElement('li');
            li.style.flexDirection = 'column';
            li.style.alignItems = 'flex-start';
            li.style.gap = '0.5rem';
            li.style.padding = '0.75rem';
            li.style.borderRadius = 'var(--radius-sm)';
            li.style.backgroundColor = 'var(--bg-app)';
            li.style.border = '1px solid var(--border-color)';
            li.style.cursor = 'pointer';
            li.style.transition = 'var(--transition-fast)';

            // ホバー効果用スタイル追加
            li.addEventListener('mouseenter', () => {
                li.style.borderColor = 'var(--primary-color)';
                li.style.boxShadow = 'var(--shadow-sm)';
            });
            li.addEventListener('mouseleave', () => {
                li.style.borderColor = 'var(--border-color)';
                li.style.boxShadow = 'none';
            });
            
            const percent = Math.round((slot.count / totalMembers) * 100);
            const timeObj = PERIODS.find(p => p.num === slot.period);
            const timeRange = timeObj ? `(${timeObj.time})` : '';
            
            let textHtml = '';
            if (slot.count === totalMembers) {
                textHtml = `<div><strong>👑 【超おすすめ】${slot.day}曜${slot.period}限</strong> ${timeRange} - <strong>全員空いてます！✨</strong></div>`;
            } else {
                textHtml = `<div><strong>💡 【第${index + 1}候補】${slot.day}曜${slot.period}限</strong> ${timeRange} - <strong>${totalMembers}人中 ${slot.count}人 空き</strong> (${percent}%)</div>`;
            }
            
            textHtml += `<div style="font-size:0.75rem; color:var(--text-muted); margin-left:1.5rem;">空き: ${slot.names.join(', ')}</div>`;
            
            // 操作ボタン
            textHtml += `
                <div style="display:flex; gap:0.5rem; width:100%; justify-content:flex-end; margin-top:0.25rem;">
                    <button type="button" class="btn btn-outline btn-slot-locate" style="padding:0.25rem 0.5rem; font-size:0.75rem;" data-key="${slot.key}">
                        <i data-lucide="map-pin" style="width:12px; height:12px;"></i> 位置を確認
                    </button>
                    <button type="button" class="btn btn-primary btn-slot-decide" style="padding:0.25rem 0.5rem; font-size:0.75rem;" data-key="${slot.key}">
                        <i data-lucide="check" style="width:12px; height:12px;"></i> この日程に決定
                    </button>
                </div>
            `;
            
            li.innerHTML = textHtml;
            recommendationList.appendChild(li);

            // 位置確認クリック
            li.querySelector('.btn-slot-locate').addEventListener('click', (e) => {
                e.stopPropagation();
                flashSlot(slot.key);
            });
            
            // 日程決定クリック
            li.querySelector('.btn-slot-decide').addEventListener('click', (e) => {
                e.stopPropagation();
                decideSlot(slot);
            });

            // 項目全体クリック時も位置確認
            li.addEventListener('click', () => {
                flashSlot(slot.key);
            });
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function flashSlot(cellKey) {
        const cell = resultGrid.querySelector(`[data-result-key="${cellKey}"]`);
        if (!cell) return;

        cell.classList.remove('flash-active');
        cell.offsetWidth; // リフロー
        cell.classList.add('flash-active');

        // モバイルで該当曜日が非表示の場合は切り替える
        const day = cellKey.split('-')[0];
        const isMobile = window.innerWidth <= 600;
        if (isMobile && state.selectedDayMobile !== day) {
            state.selectedDayMobile = day;
            renderDayTabs();
            updateGridMobileClasses();
        }

        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        setTimeout(() => {
            cell.classList.remove('flash-active');
        }, 2000);
    }

    function decideSlot(slot) {
        const timeObj = PERIODS.find(p => p.num === slot.period);
        const timeStr = timeObj ? ` ${timeObj.time}` : '';
        
        const text = `【コマ合わせ】調整結果決定！📅\n` +
            `-------------------------\n` +
            `■ 日程: ${slot.day}曜 ${slot.period}限 (${timeStr})\n` +
            `■ 参加可能メンバー: ${slot.names.join(', ')}\n` +
            `-------------------------\n` +
            `みんなで予定を合わせましょう！よろしくお願いします。`;
        
        decisionText.value = text;
        decisionBox.classList.remove('hidden');
        decisionBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        startConfetti();
        showToast('🎉 日程を決定しました！LINEに送信するためのテキストが生成されました。', 4000);
    }

    function handleCopyDecision() {
        if (!decisionText.value) return;
        
        navigator.clipboard.writeText(decisionText.value)
            .then(() => {
                showToast('📋 コピーしました！LINE等にそのまま貼り付けて送ってね。', 4000);
            })
            .catch(err => {
                console.error('コピー失敗:', err);
                decisionText.select();
                showToast('コピーに失敗しました。手動でコピーしてください。', 4000);
            });
    }

    // ---------------------------------------------------------
    // 8. URLエンコード / デコードによるデータ共有 (P2P的サーバーレス)
    // ---------------------------------------------------------
    function handleShareUrl() {
        if (state.members.length === 0 && state.currentSchedule.size === 0) {
            showToast('まずは名前と空き時間を入力して、メンバーに追加するか、入力を行ってください！', 4000);
            return;
        }

        if (state.currentName && state.currentSchedule.size > 0) {
            if (confirm(`現在入力中の「${state.currentName}」さんのデータを追加してからURLを生成しますか？`)) {
                handleAddMember();
            }
        }

        try {
            const exportData = {
                w: state.showWeekend ? 1 : 0,
                m: state.members.map(member => ({
                    n: member.name,
                    s: member.schedule
                }))
            };

            const jsonString = JSON.stringify(exportData);
            const encodedData = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => {
                return String.fromCharCode(parseInt(p1, 16));
            }));

            const url = new URL(window.location.href);
            url.searchParams.set('d', encodedData);
            
            navigator.clipboard.writeText(url.toString())
                .then(() => {
                    showToast('🎉 LINE用の共有URLをクリップボードにコピーしました！友達に送ってね。', 5000);
                })
                .catch(err => {
                    console.error('URLコピーに失敗:', err);
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
            const jsonString = decodeURIComponent(Array.prototype.map.call(atob(encodedData), (c) => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const importedData = JSON.parse(jsonString);

            if (importedData.w !== undefined) {
                state.showWeekend = importedData.w === 1;
                btnToggleWeekend.classList.toggle('active', state.showWeekend);
            }

            if (importedData.m && Array.isArray(importedData.m)) {
                state.members = importedData.m.map((importedMember, index) => ({
                    id: 'mem_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 3),
                    name: importedMember.n,
                    schedule: importedMember.s,
                    colorIndex: index % 10 // 復元時にも自動で色を順次割り当て
                }));

                const memberNames = state.members.map(m => m.name).join('さん、');
                showToast(`📥 ${state.members.length}人の空き時間データを読み込みました！ (${memberNames}さん)`, 5000);
            }
        } catch (error) {
            console.error('データデコードエラー:', error);
            showToast('⚠️ 共有データの読み込みに失敗しました。URLが壊れている可能性があります。', 4000);
        }
    }

    // ---------------------------------------------------------
    // 9. ユーティリティ (トースト表示 & 紙吹雪)
    // ---------------------------------------------------------
    let toastTimeout;
    function showToast(message, duration = 3000) {
        clearTimeout(toastTimeout);
        toastMessage.innerText = message;
        toast.classList.remove('hidden');
        toast.offsetWidth; 
        toast.classList.add('show');

        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (!toast.classList.contains('show')) {
                    toast.classList.add('hidden');
                }
            }, 400);
        }, duration);
    }

    // 紙吹雪 (Confetti) アニメーションの実装
    function startConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // 画面リサイズに対応
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);
        
        const colors = [
            '#3b82f6', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6',
            '#06b6d4', '#ec4899', '#f97316', '#84cc16'
        ];
        
        const particles = [];
        const particleCount = 100;
        
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height - 20, // 画面外上部から開始
                r: Math.random() * 6 + 4, // サイズ
                d: Math.random() * particleCount, // 降下パラメータ
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                tiltAngle: 0,
                speed: Math.random() * 3 + 2
            });
        }
        
        let animationFrameId;
        let active = true;
        let timeoutId = setTimeout(() => {
            active = false; // 2.5秒後に新規生成/描画ループを停止へ
        }, 2500);
        
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let particlesVisible = false;
            
            particles.forEach((p, idx) => {
                p.tiltAngle += p.tiltAngleIncremental;
                p.y += (Math.cos(p.d) + 1.5 + p.r / 2) * p.speed * 0.5;
                p.x += Math.sin(p.tiltAngle) * 0.5;
                p.tilt = Math.sin(p.tiltAngle - idx / 3) * 12;
                
                // 画面外に出ていなければ描画
                if (p.y < canvas.height && p.x > -20 && p.x < canvas.width + 20) {
                    particlesVisible = true;
                    ctx.beginPath();
                    ctx.lineWidth = p.r;
                    ctx.strokeStyle = p.color;
                    ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                    ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
                    ctx.stroke();
                } else if (active) {
                    // ループがアクティブなら画面上部にリセット
                    p.y = -20;
                    p.x = Math.random() * canvas.width;
                    particlesVisible = true;
                }
            });
            
            if (particlesVisible) {
                animationFrameId = requestAnimationFrame(draw);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrameId);
                window.removeEventListener('resize', handleResize);
                clearTimeout(timeoutId);
            }
        }
        
        draw();
    }

    // アプリの起動
    init();
});
