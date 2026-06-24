/**
 * コマ合わせ (Koma-Awase) - アプリケーションロジック
 * v5.0.0 (アップグレード版)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // 1. 定数とアプリケーション状態 (State)
    // ---------------------------------------------------------
    // アプリの状態
    const state = {
        currentName: '',
        currentSchedule: new Set(), // 自分で選択中のコマキー (例: "20260617-1")
        members: [], // グループメンバーの配列 { id, name, schedule: [], colorIndex }
        editingMemberId: null, 
        
        // 時限の定義 (一般的な大学のコマ割り)
        periods: [
            { num: 1, time: '9:00 - 10:30' },
            { num: 2, time: '10:40 - 12:10' },
            { num: 3, time: '13:00 - 14:30' },
            { num: 4, time: '14:40 - 16:10' },
            { num: 5, time: '16:20 - 17:50' },
            { num: 6, time: '18:00 - 19:30' }
        ],

        // カレンダー関連
        selectedDates: [], // 選択された日付のリスト ["2026-06-17", ...]
        calendarViewDate: new Date(), // 現在表示中のカレンダーの年月
        
        // 結果表示用一時スコアボード保持
        scoreBoard: {}, 
        
        // ドラッグ/タッチ選択用の一時状態
        isDragging: false,
        dragMode: true, 
        lastTouchedCell: null,
        
        // v5追加: オンボーディング状態
        guideStep: 0,
        guideSteps: [
            {
                title: "ようこそ！コマ合わせ v5へ",
                content: "「コマ合わせ」は、大学の友達と空き時間を一瞬で合わせるためのツールです。サーバー不要で個人情報も安心！",
                icon: "✨"
            },
            {
                title: "1. 自分の名前を入力",
                content: "まずはニックネームを入力しましょう。誰の予定かわかるようにしてね！",
                icon: "👤",
                target: "sec-profile"
            },
            {
                title: "2. 日付をタップ！",
                content: "カレンダーから遊びたい日や調整したい日を選びます。最大10日まで選べるよ！",
                icon: "📅",
                target: "sec-calendar"
            },
            {
                title: "3. 空き時間をなぞる",
                content: "授業がない時間をタップやスワイプで選択してね。スワイプで一気に選ぶこともできます！",
                icon: "🖱️",
                target: "sec-select-grid"
            },
            {
                title: "NEW! テンプレート機能",
                content: "「時限の設定を変更」からテンプレートを選べば、90分授業などの時間を一瞬でセットできます！",
                icon: "⚡",
                target: "btn-open-settings"
            },
            {
                title: "4. メンバーに追加 & 共有",
                content: "「メンバーに追加」を押すとあなたの予定が保存されます。URLをコピーしてLINEで友達に送ろう！",
                icon: "🔗",
                target: "btn-add-member"
            },
            {
                title: "5. おすすめを自動計算",
                content: "友達が追加されると、全員が空いている「おすすめの時間」をAIが自動提案（ベストタイミング表示）！",
                icon: "👑",
                target: "sec-results"
            }
        ]
    };

    // v5追加: テンプレートデータ
    const templates = {
        standard: [
            { num: 1, time: '9:20 - 10:50' },
            { num: 2, time: '11:00 - 12:30' },
            { num: 3, time: '13:20 - 14:50' },
            { num: 4, time: '15:00 - 16:30' },
            { num: 5, time: '16:40 - 18:10' },
            { num: 6, time: '18:20 - 19:50' }
        ],
        short: [
            { num: 1, time: '9:00 - 10:00' },
            { num: 2, time: '10:10 - 11:10' },
            { num: 3, time: '11:20 - 12:20' },
            { num: 4, time: '13:10 - 14:10' },
            { num: 5, time: '14:20 - 15:20' },
            { num: 6, time: '15:30 - 16:30' },
            { num: 7, time: '16:40 - 17:40' },
            { num: 8, time: '17:50 - 18:50' }
        ],
        afterschool: [
            { num: 1, time: '17:00 - 18:00' },
            { num: 2, time: '18:00 - 19:00' },
            { num: 3, time: '19:00 - 20:00' },
            { num: 4, time: '20:00 - 21:00' }
        ]
    };

    // ---------------------------------------------------------
    // 2. DOM要素の取得
    // ---------------------------------------------------------
    const inputName = document.getElementById('input-name');
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

    // カレンダーDOM
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarDays = document.getElementById('calendar-days');
    const btnPrevMonth = document.getElementById('btn-prev-month');
    const btnNextMonth = document.getElementById('btn-next-month');
    const selectedDatesList = document.getElementById('selected-dates-list');

    // 設定パネルDOM
    const btnOpenSettings = document.getElementById('btn-open-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const periodSettingsPanel = document.getElementById('period-settings-panel');
    const periodEditorList = document.getElementById('period-editor-list');
    const btnAddPeriod = document.getElementById('btn-add-period');
    const btnApplyPeriods = document.getElementById('btn-apply-periods');

    // その他DOM
    const editIndicator = document.getElementById('edit-indicator');
    const editMemberName = document.getElementById('edit-member-name');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const slotDetailPanel = document.getElementById('slot-detail-panel');
    const slotDetailTimeLabel = document.getElementById('slot-detail-time-label');
    const slotDetailMembers = document.getElementById('slot-detail-members');
    const btnCloseDetail = document.getElementById('btn-close-detail');
    const decisionBox = document.getElementById('decision-box');
    const decisionText = document.getElementById('decision-text');
    const btnCopyDecision = document.getElementById('btn-copy-decision');
    const bestTimingContainer = document.getElementById('best-timing-container');
    const bestTimingSlides = document.getElementById('best-timing-slides');
    const bestTimingPrev = document.getElementById('best-timing-prev');
    const bestTimingNext = document.getElementById('best-timing-next');
    const bestTimingDots = document.getElementById('best-timing-dots');
    const btnLineDirect = document.getElementById('btn-line-direct');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    const btnOpenGuide = document.getElementById('btn-open-guide');
    const guideModal = document.getElementById('guide-modal');
    const guideContent = document.getElementById('guide-content');
    const btnCloseGuide = document.getElementById('btn-close-guide');
    const btnGuidePrev = document.getElementById('btn-guide-prev');
    const btnGuideNext = document.getElementById('btn-guide-next');
    const btnGuideFinish = document.getElementById('btn-guide-finish');
    const guideProgressBar = document.getElementById('guide-progress-bar');


    // ---------------------------------------------------------
    // 3. 初期化処理
    // ---------------------------------------------------------
    function init() {
        initTheme();
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        loadDataFromUrl();
        renderCalendar();
        renderTimetables();
        updateResults();
        setupEventListeners();

        // v5追加: 初回起動時のガイド表示
        const hasVisited = localStorage.getItem('koma-visited-v5');
        const urlParams = new URLSearchParams(window.location.search);
        // URL共有で来た場合はガイドを強制しない
        if (!hasVisited && !urlParams.has('d')) {
            openGuide();
        }
    }



    // テーマ（ライト/ダーク）の初期化
    function initTheme() {
        const savedTheme = localStorage.getItem('koma-theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
            if (themeToggleIcon) themeToggleIcon.setAttribute('data-lucide', 'sun');
        } else {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
            if (themeToggleIcon) themeToggleIcon.setAttribute('data-lucide', 'moon');
        }
    }

    // ---------------------------------------------------------
    // 4. カレンダー制御
    // ---------------------------------------------------------
    function renderCalendar() {
        calendarDays.innerHTML = '';
        const year = state.calendarViewDate.getFullYear();
        const month = state.calendarViewDate.getMonth();

        // ヘッダー更新 (2026年 6月)
        calendarMonthYear.innerText = `${year}年 ${month + 1}月`;

        // 月の最初の日と最後の日
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // カレンダーの開始（前の月の残り）
        const startDay = firstDay.getDay(); // 0:日, 1:月...
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        // 前の月の日付
        for (let i = startDay - 1; i >= 0; i--) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'calendar-day other-month';
            dayDiv.innerText = prevMonthLastDay - i;
            calendarDays.appendChild(dayDiv);
        }

        // 今月の日付
        const today = new Date();
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dayDiv = document.createElement('div');
            const dateStr = formatDate(year, month, d);
            const isSelected = state.selectedDates.includes(dateStr);
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

            dayDiv.className = `calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`;
            dayDiv.innerText = d;
            
            dayDiv.addEventListener('click', () => toggleDateSelection(dateStr));
            calendarDays.appendChild(dayDiv);
        }

        renderSelectedDatesList();
    }

    function toggleDateSelection(dateStr) {
        const index = state.selectedDates.indexOf(dateStr);
        if (index > -1) {
            state.selectedDates.splice(index, 1);
        } else {
            if (state.selectedDates.length >= 10) {
                showToast('選択できるのは最大10日までです', 3000);
                return;
            }
            state.selectedDates.push(dateStr);
            state.selectedDates.sort(); // 日付順にソート
        }
        renderCalendar();
        renderTimetables();
        updateResults();
    }

    function renderSelectedDatesList() {
        selectedDatesList.innerHTML = '';
        if (state.selectedDates.length === 0) {
            selectedDatesList.innerHTML = '<span class="no-selection">カレンダーから選んでください</span>';
            return;
        }

        state.selectedDates.forEach(dateStr => {
            const badge = document.createElement('span');
            badge.className = 'date-badge';
            const [y, m, d] = dateStr.split('-');
            badge.innerText = `${parseInt(m)}/${parseInt(d)}`;
            
            const removeBtn = document.createElement('i');
            removeBtn.setAttribute('data-lucide', 'x');
            removeBtn.style.width = '12px';
            removeBtn.style.height = '12px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.marginLeft = '4px';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDateSelection(dateStr);
            });
            
            badge.appendChild(removeBtn);
            selectedDatesList.appendChild(badge);
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function formatDate(y, m, d) {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function getDisplayDate(dateStr) {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        const date = new Date(y, parseInt(m)-1, d);
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
        return `${parseInt(m)}/${parseInt(d)}(${dayOfWeek})`;
    }

    // ---------------------------------------------------------
    // 5. 時限設定（カスタマイズ）制御
    // ---------------------------------------------------------
    function renderPeriodEditor() {
        periodEditorList.innerHTML = '';
        state.periods.forEach((period, index) => {
            const item = document.createElement('div');
            item.className = 'period-editor-item';
            
            const badge = document.createElement('div');
            badge.className = 'period-badge-static';
            badge.innerText = period.num;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'period-input';
            input.value = period.time;
            input.placeholder = '例: 9:00 - 10:30';
            input.addEventListener('change', (e) => {
                period.time = e.target.value.trim();
            });
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-icon';
            delBtn.innerHTML = '<i data-lucide="minus-circle"></i>';
            delBtn.style.color = 'var(--text-danger)';
            delBtn.addEventListener('click', () => {
                if (state.periods.length <= 1) {
                    showToast('これ以上削除できません', 3000);
                    return;
                }
                state.periods.splice(index, 1);
                // 番号を振り直す
                state.periods.forEach((p, i) => p.num = i + 1);
                renderPeriodEditor();
            });
            
            item.appendChild(badge);
            item.appendChild(input);
            item.appendChild(delBtn);
            periodEditorList.appendChild(item);
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function handleApplyPeriods() {
        renderTimetables();
        updateResults();
        periodSettingsPanel.classList.add('hidden');
        showToast('✅ 時限設定を更新しました！', 3000);
    }


    // ---------------------------------------------------------
    // 5. グリッドの描画 (Render Timetables)
    // ---------------------------------------------------------
    function renderTimetables() {
        const dates = state.selectedDates;
        const totalColumns = dates.length;
        
        // CSS変数の更新 (Gridの列数を制御)
        selectionGrid.style.setProperty('--columns', totalColumns || 1);
        resultGrid.style.setProperty('--columns', totalColumns || 1);

        // 1. 選択用時間割グリッドの生成
        if (totalColumns > 0) {
            generateGridHtml(selectionGrid, true);
        } else {
            selectionGrid.innerHTML = '<p class="no-selection-msg">先にカレンダーで日付を選んでください</p>';
        }
        
        // 2. 結果ヒートマップ用時間割グリッドの生成
        if (totalColumns > 0) {
            generateGridHtml(resultGrid, false);
        } else {
            resultGrid.innerHTML = '<p class="no-selection-msg">日付が選ばれるとここに結果が表示されます</p>';
        }

        // Lucideアイコンの再適用
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function generateGridHtml(gridElement, isSelectable) {
        const dates = state.selectedDates;
        gridElement.innerHTML = '';

        // 左上の空白の角セル
        const cornerCell = document.createElement('div');
        cornerCell.className = 'grid-cell cell-header';
        cornerCell.innerText = '時間';
        gridElement.appendChild(cornerCell);

        // 日付ヘッダーの描画
        dates.forEach(dateStr => {
            const headerCell = document.createElement('div');
            headerCell.className = 'grid-cell cell-header';
            headerCell.innerText = getDisplayDate(dateStr);
            gridElement.appendChild(headerCell);
        });

        // 各時限の行を描画
        state.periods.forEach(period => {
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
            dates.forEach(dateStr => {
                const cell = document.createElement('div');
                const cellKey = `${dateStr.replace(/-/g, '')}-${period.num}`;
                
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
                    
                    cell.addEventListener('click', () => showSlotDetail(cellKey));
                }
                
                gridElement.appendChild(cell);
            });
        });
    }


    // ---------------------------------------------------------
    // 6. ドラッグ/スワイプによるインタラクション
    // ---------------------------------------------------------
    function setupEventListeners() {
        // テーマ切り替え
        if (btnThemeToggle) {
            btnThemeToggle.addEventListener('click', () => {
                const isDark = document.documentElement.classList.contains('dark-theme');
                if (isDark) {
                    document.documentElement.classList.remove('dark-theme');
                    document.documentElement.classList.add('light-theme');
                    localStorage.setItem('koma-theme', 'light');
                    themeToggleIcon.setAttribute('data-lucide', 'moon');
                } else {
                    document.documentElement.classList.remove('light-theme');
                    document.documentElement.classList.add('dark-theme');
                    localStorage.setItem('koma-theme', 'dark');
                    themeToggleIcon.setAttribute('data-lucide', 'sun');
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();
                updateResults();
            });
        }

        // カレンダー月移動
        btnPrevMonth.addEventListener('click', () => {
            state.calendarViewDate.setMonth(state.calendarViewDate.getMonth() - 1);
            renderCalendar();
        });
        btnNextMonth.addEventListener('click', () => {
            state.calendarViewDate.setMonth(state.calendarViewDate.getMonth() + 1);
            renderCalendar();
        });

        // 選択用グリッドのマウス/タッチイベント
        setupDragSelection();

        // メンバー追加/更新ボタン
        btnAddMember.addEventListener('click', handleAddMember);

        // 編集キャンセルボタン
        btnCancelEdit.addEventListener('click', handleCancelEdit);

        // LINE共有URLコピーボタン
        btnShareUrl.addEventListener('click', handleShareUrl);

        // LINEで直接送るボタン
        if (btnLineDirect) {
            btnLineDirect.addEventListener('click', handleLineDirectShare);
        }

        // ベストタイミングカルーセルの制御
        if (bestTimingPrev && bestTimingNext && bestTimingSlides) {
            bestTimingPrev.addEventListener('click', () => {
                const width = bestTimingSlides.querySelector('.best-timing-card')?.clientWidth || bestTimingSlides.clientWidth;
                bestTimingSlides.scrollBy({ left: -width, behavior: 'smooth' });
            });
            bestTimingNext.addEventListener('click', () => {
                const width = bestTimingSlides.querySelector('.best-timing-card')?.clientWidth || bestTimingSlides.clientWidth;
                bestTimingSlides.scrollBy({ left: width, behavior: 'smooth' });
            });
            bestTimingSlides.addEventListener('scroll', () => {
                updateCarouselDots();
            });
        }

        // 選択クリアボタン
        btnClearSelection.addEventListener('click', () => {
            state.currentSchedule.clear();
            renderTimetables();
        });

        // 名前入力欄の変更検知
        inputName.addEventListener('input', (e) => {
            state.currentName = e.target.value.trim();
        });
        
        // 詳細パネルの閉じるボタン
        btnCloseDetail.addEventListener('click', () => {
            slotDetailPanel.classList.add('hidden');
        });

        // 決定テキストコピーボタン
        btnCopyDecision.addEventListener('click', handleCopyDecision);

        // 時限設定
        btnOpenSettings.addEventListener('click', () => {
            renderPeriodEditor();
            periodSettingsPanel.classList.toggle('hidden');
        });
        btnCloseSettings.addEventListener('click', () => {
            periodSettingsPanel.classList.add('hidden');
        });
        btnAddPeriod.addEventListener('click', () => {
            if (state.periods.length >= 12) {
                showToast('追加できるのは12コマまでです', 3000);
                return;
            }
            state.periods.push({ num: state.periods.length + 1, time: '' });
            renderPeriodEditor();
        });
        btnApplyPeriods.addEventListener('click', handleApplyPeriods);

        // v5追加: ガイド操作
        btnOpenGuide.addEventListener('click', openGuide);
        btnCloseGuide.addEventListener('click', closeGuide);
        btnGuidePrev.addEventListener('click', () => navigateGuide(-1));
        btnGuideNext.addEventListener('click', () => navigateGuide(1));
        btnGuideFinish.addEventListener('click', closeGuide);

        // v5追加: テンプレート適用
        document.querySelectorAll('.btn-template').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateKey = btn.dataset.template;
                if (templates[templateKey]) {
                    if (confirm('時限設定をテンプレートの内容で上書きしますか？')) {
                        state.periods = JSON.parse(JSON.stringify(templates[templateKey]));
                        renderPeriodEditor();
                        handleApplyPeriods();
                        showToast(`✅ ${btn.innerText.trim()} を適用しました！`, 3000);
                    }
                }
            });
        });
    }

    // ---------------------------------------------------------
    // v5 オンボーディングガイド制御
    // ---------------------------------------------------------
    function openGuide() {
        state.guideStep = 0;
        updateGuideUI();
        guideModal.classList.remove('hidden');
    }

    function closeGuide() {
        guideModal.classList.add('hidden');
        localStorage.setItem('koma-visited-v5', 'true');
    }

    function navigateGuide(delta) {
        state.guideStep += delta;
        if (state.guideStep < 0) state.guideStep = 0;
        if (state.guideStep >= state.guideSteps.length) {
            closeGuide();
            return;
        }
        updateGuideUI();
    }

    function updateGuideUI() {
        const step = state.guideSteps[state.guideStep];
        const progress = ((state.guideStep + 1) / state.guideSteps.length) * 100;
        
        guideProgressBar.style.width = `${progress}%`;
        
        guideContent.innerHTML = `
            <div class="guide-step-icon">${step.icon}</div>
            <h2>${step.title}</h2>
            <p>${step.content}</p>
        `;

        // ターゲットセクションのハイライト（視覚的なガイド）
        document.querySelectorAll('.guide-highlight').forEach(el => el.classList.remove('guide-highlight'));
        if (step.target) {
            const targetEl = document.getElementById(step.target);
            if (targetEl) {
                targetEl.classList.add('guide-highlight');
                // モーダルが重ならないようにターゲットへ緩やかにスクロール
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // ボタンの表示切り替え
        btnGuidePrev.classList.toggle('hidden', state.guideStep === 0);
        
        if (state.guideStep === state.guideSteps.length - 1) {
            btnGuideNext.classList.add('hidden');
            btnGuideFinish.classList.remove('hidden');
        } else {
            btnGuideNext.classList.remove('hidden');
            btnGuideFinish.classList.add('hidden');
        }
    }

    function showSlotDetail(cellKey) {
        if (!state.scoreBoard[cellKey]) return;
        
        const dateStrLong = cellKey.substring(0, 4) + '-' + cellKey.substring(4, 6) + '-' + cellKey.substring(6, 8);
        const periodNum = cellKey.split('-')[1];
        const period = state.periods.find(p => p.num == periodNum);
        
        if (!period) {
            slotDetailPanel.classList.add('hidden');
            return;
        }
        
        slotDetailTimeLabel.innerText = `${getDisplayDate(dateStrLong)} ${periodNum}限 (${period.time})`;
        slotDetailMembers.innerHTML = '';
        
        const freeMembers = state.scoreBoard[cellKey];
        if (freeMembers.length > 0) {
            freeMembers.forEach(m => {
                const badge = document.createElement('span');
                badge.className = `slot-detail-member m-bg-${m.colorIndex}`;
                badge.innerText = `👤 ${m.name}`;
                slotDetailMembers.appendChild(badge);
            });
        } else {
            slotDetailMembers.innerHTML = '<p class="no-selection">空いている人はいません</p>';
        }
        
        slotDetailPanel.classList.remove('hidden');
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

        // --- スマホ向けタッチイベント (スワイプなぞり選択・スクロールロック機能付き) ---
        selectionGrid.addEventListener('touchstart', (e) => {
            const cell = e.target.closest('.cell-slot');
            if (!cell) return;
            
            // ドラッグ開始
            state.isDragging = true;
            selectionGrid.classList.add('touch-locked');
            
            const cellKey = cell.dataset.key;
            state.dragMode = !state.currentSchedule.has(cellKey);
            state.lastTouchedCell = cell;
            toggleCellSelection(cell, cellKey, state.dragMode);
        }, { passive: false });

        selectionGrid.addEventListener('touchmove', (e) => {
            if (!state.isDragging) return;
            
            // タッチなぞり選択中は画面スクロールを強制的にキャンセル
            if (e.cancelable) {
                e.preventDefault();
            }
            
            const touch = e.touches[0];
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            if (!targetElement) return;
            
            const cell = targetElement.closest('.cell-slot');
            if (!cell || cell === state.lastTouchedCell) return;
            
            state.lastTouchedCell = cell;
            const cellKey = cell.dataset.key;
            toggleCellSelection(cell, cellKey, state.dragMode);
        }, { passive: false });

        const endTouchDrag = () => {
            if (state.isDragging) {
                state.isDragging = false;
                state.lastTouchedCell = null;
                selectionGrid.classList.remove('touch-locked');
            }
        };

        selectionGrid.addEventListener('touchend', endTouchDrag);
        selectionGrid.addEventListener('touchcancel', endTouchDrag);
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
        const dates = state.selectedDates;
        const scoreBoard = {}; 
        
        dates.forEach(dateStr => {
            const dateKey = dateStr.replace(/-/g, '');
            state.periods.forEach(period => {
                scoreBoard[`${dateKey}-${period.num}`] = [];
            });
        });

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
            
            // セルを初期状態にリセット
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.classList.remove('perfect-match', 'match-100', 'match-75', 'match-50', 'match-25', 'match-0');
            if (dotContainer) dotContainer.innerHTML = '';
            
            if (totalMembers === 0) {
                ratioLabel.innerText = '-';
                cell.removeAttribute('data-tooltip');
                return;
            }

            // 一致率を計算
            const ratio = freeCount / totalMembers;
            
            if (freeCount > 0) {
                // v4: 一致率に応じたクラス付与
                if (ratio === 1) {
                    cell.classList.add('match-100');
                    if (totalMembers >= 2) cell.classList.add('perfect-match');
                } else if (ratio >= 0.75) {
                    cell.classList.add('match-75');
                } else if (ratio >= 0.5) {
                    cell.classList.add('match-50');
                } else {
                    cell.classList.add('match-25');
                }
                
                ratioLabel.innerText = `${freeCount}/${totalMembers}`;
                cell.setAttribute('data-tooltip', `${freeCount}人空き: ${freeMembers.map(m => m.name).join(', ')}`);
                
                // ドットの描画
                freeMembers.forEach(m => {
                    const dot = document.createElement('div');
                    dot.className = `status-dot m-bg-${m.colorIndex}`;
                    dotContainer.appendChild(dot);
                });
            } else {
                cell.classList.add('match-0');
                ratioLabel.innerText = '0';
                cell.setAttribute('data-tooltip', '空いている人はいません');
            }
        });

        // おすすめ（ベストタイミング）と候補一覧の生成
        generateRecommendations(scoreBoard, totalMembers);
    }
         function renderBestTimings(tieSlots, totalMembers) {
        bestTimingSlides.innerHTML = '';
        
        const isMultiple = tieSlots.length > 1;
        bestTimingPrev.style.display = isMultiple ? 'flex' : 'none';
        bestTimingNext.style.display = isMultiple ? 'flex' : 'none';
        bestTimingDots.style.display = isMultiple ? 'flex' : 'none';
        
        bestTimingDots.innerHTML = '';
        
        tieSlots.forEach((slot, index) => {
            const card = document.createElement('div');
            card.className = 'best-timing-card';
            
            const badgeText = isMultiple ? `おすすめ候補 (${index + 1}/${tieSlots.length})` : 'おすすめの時間帯 ✨';
            const badge = document.createElement('div');
            badge.className = 'best-timing-badge';
            badge.innerText = badgeText;
            card.appendChild(badge);
            
            const content = document.createElement('div');
            content.className = 'best-timing-content';
            
            const periodNum = slot.period;
            const timeObj = state.periods.find(p => p.num === periodNum);
            const timeStr = timeObj ? ` (${timeObj.time})` : '';
            
            const dateStrLong = slot.day.substring(0, 4) + '-' + slot.day.substring(4, 6) + '-' + slot.day.substring(6, 8);
            
            const mainInfo = document.createElement('div');
            mainInfo.className = 'best-timing-main';
            mainInfo.innerText = `${getDisplayDate(dateStrLong)} ${periodNum}限${timeStr}`;
            content.appendChild(mainInfo);
            
            const subInfo = document.createElement('div');
            subInfo.className = 'best-timing-sub';
            const percent = Math.round((slot.count / totalMembers) * 100);
            subInfo.innerHTML = `🌟 <strong>${totalMembers}人中 ${slot.count}人</strong> が参加可能！ (一致率 ${percent}%)`;
            content.appendChild(subInfo);
            
            const namesSection = document.createElement('div');
            namesSection.className = 'best-timing-names-section';
            
            const activeIds = new Set(slot.members.map(m => m.name));
            
            const activeTitle = document.createElement('div');
            activeTitle.className = 'best-timing-names-title';
            activeTitle.innerText = '⭕ 参加できるメンバー:';
            namesSection.appendChild(activeTitle);
            
            const activeList = document.createElement('div');
            activeList.className = 'best-timing-names';
            slot.members.forEach(m => {
                const b = document.createElement('span');
                b.className = `best-timing-name-badge m-bg-${m.colorIndex}`;
                b.innerText = m.name;
                activeList.appendChild(b);
            });
            namesSection.appendChild(activeList);
            
            const absentMembers = state.members.filter(m => !activeIds.has(m.name));
            if (absentMembers.length > 0) {
                const absentTitle = document.createElement('div');
                absentTitle.className = 'best-timing-names-title';
                absentTitle.innerText = '❌ 参加できないメンバー:';
                namesSection.appendChild(absentTitle);
                
                const absentList = document.createElement('div');
                absentList.className = 'best-timing-names';
                absentMembers.forEach(m => {
                    const b = document.createElement('span');
                    b.className = 'best-timing-name-badge absent';
                    b.innerText = m.name;
                    absentList.appendChild(b);
                });
                namesSection.appendChild(absentList);
            }
            
            content.appendChild(namesSection);
            
            const actions = document.createElement('div');
            actions.className = 'best-timing-actions';
            actions.innerHTML = `
                <button type="button" class="btn btn-hero-decide btn-slot-decide" data-key="${slot.key}">
                    <i data-lucide="check-circle"></i> この日程で決定！
                </button>
            `;
            content.appendChild(actions);
            
            actions.querySelector('.btn-slot-decide').addEventListener('click', (e) => {
                e.stopPropagation();
                decideSlot(slot);
            });
            
            card.appendChild(content);
            bestTimingSlides.appendChild(card);
            
            if (isMultiple) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
                dot.addEventListener('click', () => {
                    const cardWidth = card.clientWidth;
                    bestTimingSlides.scrollTo({
                        left: cardWidth * index,
                        behavior: 'smooth'
                    });
                });
                bestTimingDots.appendChild(dot);
            }
        });
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        bestTimingContainer.classList.remove('hidden');
        bestTimingSlides.scrollLeft = 0;
    }

    function updateCarouselDots() {
        if (!bestTimingSlides || !bestTimingDots) return;
        const cardEl = bestTimingSlides.querySelector('.best-timing-card');
        const cardWidth = cardEl?.clientWidth || bestTimingSlides.clientWidth;
        if (cardWidth === 0) return;
        const index = Math.round(bestTimingSlides.scrollLeft / cardWidth);
        
        bestTimingDots.querySelectorAll('.carousel-dot').forEach((dot, idx) => {
            dot.classList.toggle('active', idx === index);
        });
    }

    function generateRecommendations(scoreBoard, totalMembers) {
        recommendationList.innerHTML = '';
        decisionBox.classList.add('hidden');
        
        if (totalMembers < 2) {
            const li = document.createElement('li');
            li.innerText = '2人以上のメンバーが追加されると、ここに最適なおすすめ時間帯を提案します！';
            recommendationList.appendChild(li);
            bestTimingContainer.classList.add('hidden');
            return;
        }

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
            bestTimingContainer.classList.add('hidden');
            return;
        }

        // 最も人数が多い時間帯（同率1位をすべて集約）
        const maxCount = sortedSlots[0].count;
        const maxCountRatio = maxCount / totalMembers;
        const tieSlots = sortedSlots.filter(slot => slot.count === maxCount);

        // 閾値チェック: 一致した人が1人だけ、または一致率が50%未満の場合はベストタイミングを表示しない
        if (maxCount < 2 || maxCountRatio < 0.5) {
            bestTimingContainer.classList.add('hidden');
        } else {
            renderBestTimings(tieSlots, totalMembers);
        }

        // ベストタイミングに使われた以外の、2位以下の候補を「全ての候補一覧」として表示
        // (最大5つまで表示)
        const bestKeys = new Set(tieSlots.map(s => s.key));
        const otherSlots = sortedSlots.filter(s => !bestKeys.has(s.key)).slice(0, 5);
        
        if (otherSlots.length === 0 && tieSlots.length > 0) {
            // 他の候補がなく、ベスト候補のみの場合は説明を表示
            const li = document.createElement('li');
            li.innerText = '他の空き時間の候補はありません。上のベストタイミングを検討してください！';
            recommendationList.appendChild(li);
            return;
        } else if (otherSlots.length === 0) {
            const li = document.createElement('li');
            li.innerText = '他にも候補があればここに表示されます。';
            recommendationList.appendChild(li);
            return;
        }

        otherSlots.forEach((slot, index) => {
            const li = document.createElement('li');
            li.className = 'recommendation-item-v3';
            li.style.flexDirection = 'column';
            li.style.alignItems = 'flex-start';
            li.style.gap = '0.5rem';
            li.style.padding = '1rem';
            li.style.borderRadius = 'var(--radius-sm)';
            li.style.backgroundColor = 'var(--bg-app)';
            li.style.border = '1px solid var(--border-color)';
            li.style.cursor = 'pointer';
            li.style.transition = 'var(--transition-fast)';

            li.addEventListener('mouseenter', () => {
                li.style.borderColor = 'var(--primary-color)';
                li.style.boxShadow = 'var(--shadow-sm)';
            });
            li.addEventListener('mouseleave', () => {
                li.style.borderColor = 'var(--border-color)';
                li.style.boxShadow = 'none';
            });
            
            const percent = Math.round((slot.count / totalMembers) * 100);
            const timeObj = state.periods.find(p => p.num === slot.period);
            const timeRange = timeObj ? `(${timeObj.time})` : '';
            
            let textHtml = '';
            if (slot.count === totalMembers) {
                textHtml = `<div><strong>✨ 【おすすめ】${slot.day}曜${slot.period}限</strong> ${timeRange} - <strong>全員空いてます！</strong></div>`;
            } else {
                textHtml = `<div><strong>💡 【候補】${slot.day}曜${slot.period}限</strong> ${timeRange} - <strong>${totalMembers}人中 ${slot.count}人 空き</strong> (${percent}%)</div>`;
            }
            
            textHtml += `<div style="font-size:0.75rem; color:var(--text-muted); margin-left:1.5rem;">空き: ${slot.names.join(', ')}</div>`;
            
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

            li.querySelector('.btn-slot-locate').addEventListener('click', (e) => {
                e.stopPropagation();
                flashSlot(slot.key);
            });
            
            li.querySelector('.btn-slot-decide').addEventListener('click', (e) => {
                e.stopPropagation();
                decideSlot(slot);
            });

            li.addEventListener('click', () => {
                flashSlot(slot.key);
            });
        });

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function getBestTimings(scoreBoard, totalMembers) {
        if (totalMembers < 2) return [];

        let maxCount = 0;
        let bestSlots = [];

        for (const key in scoreBoard) {
            const count = scoreBoard[key].length;
            if (count > 0) {
                const parts = key.split('-');
                const day = parts[0];
                const period = parseInt(parts[1]);

                if (count > maxCount) {
                    maxCount = count;
                    bestSlots = [{ day, period, count, members: scoreBoard[key] }];
                } else if (count === maxCount) {
                    bestSlots.push({ day, period, count, members: scoreBoard[key] });
                }
            }
        }
        
        // 日付順にソート（YYYYMMDDなので単純比較可）
        bestSlots.sort((a, b) => {
            if (a.day !== b.day) return a.day.localeCompare(b.day);
            return a.period - b.period;
        });

        return bestSlots;
    }

    function handleShareUrl() {
        if (state.members.length === 0 && state.currentSchedule.size === 0) {
            showToast('まずは名前と空き時間を入力して、メンバーに追加するか、入力を行ってください！', 3000);
            return;
        }

        if (state.currentName && state.currentSchedule.size > 0) {
            if (confirm(`現在入力中の「${state.currentName}」さんのデータを追加してからURLを生成しますか？`)) {
                handleAddMember();
            }
        }

        try {
            const data = exportData();
            const url = new URL(window.location.href);
            url.searchParams.set('d', data);
            
            navigator.clipboard.writeText(url.toString()).then(() => {
                showToast('✅ 共有URLをコピーしました！LINEに貼り付けて送ってね。', 4000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                prompt('共有URLをコピーして友達に送ってください:', url.toString());
            });
        } catch (error) {
            console.error('Export error:', error);
            showToast('共有URLの作成に失敗しました。', 3000);
        }
    }

    function exportData() {
        const data = {
            m: state.members.map(m => ({
                n: m.name,
                s: m.schedule,
                c: m.colorIndex
            })),
            d: state.selectedDates,
            p: state.periods
        };
        const json = JSON.stringify(data);
        return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode(parseInt(p1, 16));
        }));
    }

    function loadDataFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const encodedData = params.get('d');
        if (encodedData) {
            try {
                const json = decodeURIComponent(Array.prototype.map.call(atob(encodedData), (c) => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                const data = JSON.parse(json);
                if (data && data.m) {
                    state.members = data.m.map((m, index) => ({
                        id: 'mem_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 3),
                        name: m.n,
                        schedule: m.s,
                        colorIndex: m.c !== undefined ? m.c : (index % 10)
                    }));
                }
                if (data && data.d) {
                    state.selectedDates = data.d;
                    state.selectedDates.sort();
                }
                if (data && data.p) {
                    state.periods = data.p;
                }
            } catch (e) {
                console.error('Failed to load data from URL', e);
            }
        }
    }

    function handleCopyDecision() {
        const message = decisionText.value;
        if (!message) return;
        
        navigator.clipboard.writeText(message).then(() => {
            showToast('✅ 送信用テキストをコピーしました！', 3000);
        });
    }

    function decideSlot(slot) {
        const timeObj = state.periods.find(p => p.num === slot.period);
        const timeStr = timeObj ? ` ${timeObj.time}` : '';
        const dateStrLong = slot.day.substring(0, 4) + '-' + slot.day.substring(4, 6) + '-' + slot.day.substring(6, 8);
        
        const text = `【コマ合わせ】調整結果決定！📅\n` +
            `-------------------------\n` +
            `■ 日程: ${getDisplayDate(dateStrLong)} ${slot.period}限 (${timeStr})\n` +
            `■ 参加可能メンバー: ${slot.members.map(m => m.name).join(', ')}\n` +
            `-------------------------\n` +
            `みんなで予定を合わせましょう！よろしくお願いします。`;
        
        decisionText.value = text;
        decisionBox.classList.remove('hidden');
        decisionBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        startConfetti();
        showToast('🎉 日程を決定しました！LINE送信用テキストも生成されました。', 4000);
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
    function flashSlot(cellKey) {
        const cell = resultGrid.querySelector(`[data-result-key="${cellKey}"]`);
        if (!cell) return;

        cell.classList.remove('flash-active');
        cell.offsetWidth; // リフロー
        cell.classList.add('flash-active');

        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        setTimeout(() => {
            cell.classList.remove('flash-active');
        }, 2000);
    }

    // LINEへ直接送信する処理
    function handleLineDirectShare() {
        if (state.members.length === 0 && state.currentSchedule.size === 0) {
            showToast('まずは名前と空き時間を入力して、メンバーに追加するか、入力を行ってください！', 4000);
            return;
        }

        if (state.currentName && state.currentSchedule.size > 0) {
            if (confirm(`現在入力中の「${state.currentName}」さんのデータを追加してからLINEで共有しますか？`)) {
                handleAddMember();
            }
        }

        try {
            const encodedData = exportData();
            const url = new URL(window.location.href);
            url.searchParams.set('d', encodedData);
            
            const shareText = `【コマ合わせ】友達と空き時間を調整中！📅\n全員の予定が合うコマを見つけよう！下のリンクからあなたの空き時間を追加してね！\n\n${url.toString()}`;
            
            // LINE共有URLスキーム
            const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(shareText)}`;
            
            // LINEを開く
            window.open(lineUrl, '_blank');
            showToast('🎉 LINEの送信画面を開きました！', 4000);
            
        } catch (error) {
            console.error('LINE共有エラー:', error);
            showToast('LINE共有URLの作成に失敗しました。', 3000);
        }
    }

    // (カレンダーモードではスワイプ曜日切り替えは不要のため削除)

    // アプリの起動
    init();
});
