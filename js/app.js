class PushNotificationApp {
    constructor() {
        this.characters = [
            { name: '親友', image: './images/character1.png' },
            { name: 'おばちゃん', image: './images/character2.png' },
            { name: 'おじさん', image: './images/character3.png' }
        ];
        this.currentCharacterIndex = 0;
        this.notifications = [];
        this.init();
    }

    init() {
        this.initializeIndexedDB();
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.updateCharacterDisplay();
        this.loadNotifications();
        this.registerServiceWorker();
    }

    // IndexedDB初期化
    initializeIndexedDB() {
        const request = indexedDB.open('PushNotificationDB', 1);
        
        request.onerror = () => {
            console.error('IndexedDB エラー');
        };
        
        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.loadNotifications();
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const objectStore = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            objectStore.createIndex('active', 'active', { unique: false });
        };
    }

    // イベントリスナー設定
    setupEventListeners() {
        // キャラクター切り替え
        document.getElementById('prev-character').addEventListener('click', () => this.previousCharacter());
        document.getElementById('next-character').addEventListener('click', () => this.nextCharacter());
        
        // モーダル操作
        document.getElementById('message-btn').addEventListener('click', () => this.openModal());
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        // タブ切り替え
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // 通知タイプ切り替え
        document.querySelectorAll('input[name="notification-type"]').forEach(radio => {
            radio.addEventListener('change', () => this.toggleNotificationSettings());
        });

        // フォーム送信
        document.getElementById('message-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createNotification();
        });

        // スワイプ対応
        this.setupSwipeGestures();
    }

    // キャラクター切り替え
    previousCharacter() {
        this.currentCharacterIndex = (this.currentCharacterIndex - 1 + this.characters.length) % this.characters.length;
        this.updateCharacterDisplay();
    }

    nextCharacter() {
        this.currentCharacterIndex = (this.currentCharacterIndex + 1) % this.characters.length;
        this.updateCharacterDisplay();
    }

    updateCharacterDisplay() {
        const character = this.characters[this.currentCharacterIndex];
        document.getElementById('character-image').src = character.image;
        document.getElementById('character-name').textContent = character.name;
    }

    // スワイプジェスチャー
    setupSwipeGestures() {
        let startX = 0;
        let startY = 0;
        const characterSection = document.querySelector('.character-section');

        characterSection.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        characterSection.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = startX - endX;
            const diffY = startY - endY;

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    this.nextCharacter();
                } else {
                    this.previousCharacter();
                }
            }
        });
    }

    // モーダル操作
    openModal() {
        document.getElementById('modal-overlay').style.display = 'block';
        setTimeout(() => {
            document.getElementById('modal').classList.add('show');
        }, 10);
    }

    closeModal() {
        document.getElementById('modal').classList.remove('show');
        setTimeout(() => {
            document.getElementById('modal-overlay').style.display = 'none';
        }, 300);
    }

    // タブ切り替え
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        if (tabName === 'list') {
            this.renderNotificationList();
        }
    }

    // 通知設定切り替え
    toggleNotificationSettings() {
        const type = document.querySelector('input[name="notification-type"]:checked').value;
        const timerSettings = document.querySelector('.timer-settings');
        const scheduleSettings = document.querySelector('.schedule-settings');

        if (type === 'timer') {
            timerSettings.style.display = 'block';
            scheduleSettings.style.display = 'none';
        } else {
            timerSettings.style.display = 'none';
            scheduleSettings.style.display = 'block';
        }
    }

    // 通知作成
    async createNotification() {
        const messageText = document.getElementById('message-text').value;
        const notificationType = document.querySelector('input[name="notification-type"]:checked').value;
        
        if (this.notifications.length >= 5) {
            alert('通知は最大5件まで登録できます。');
            return;
        }

        const notification = {
            message: messageText,
            character: this.characters[this.currentCharacterIndex].name,
            type: notificationType,
            active: true,
            createdAt: new Date().toISOString()
        };

        if (notificationType === 'timer') {
            const minutes = parseInt(document.getElementById('timer-minutes').value);
            const snoozeEnabled = document.getElementById('snooze-enabled').checked;
            
            notification.triggerTime = new Date(Date.now() + minutes * 60000).toISOString();
            notification.snoozeEnabled = snoozeEnabled;
            notification.settings = { minutes, snoozeEnabled };
        } else {
            const time = document.getElementById('schedule-time').value;
            const weekdays = Array.from(document.querySelectorAll('.weekday-label input:checked')).map(cb => parseInt(cb.value));
            
            notification.scheduleTime = time;
            notification.weekdays = weekdays;
            notification.settings = { time, weekdays };
        }

        try {
            await this.saveNotification(notification);
            this.scheduleNotification(notification);
            this.updateLatestMessage();
            
            document.getElementById('message-form').reset();
            this.closeModal();
            
            alert('伝言を託しました！');
        } catch (error) {
            console.error('通知作成エラー:', error);
            alert('伝言の作成に失敗しました。');
        }
    }

    // 通知保存
    async saveNotification(notification) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notifications'], 'readwrite');
            const objectStore = transaction.objectStore('notifications');
            const request = objectStore.add(notification);
            
            request.onsuccess = () => {
                notification.id = request.result;
                this.notifications.push(notification);
                resolve(notification);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 通知読み込み
    async loadNotifications() {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['notifications'], 'readonly');
            const objectStore = transaction.objectStore('notifications');
            const request = objectStore.getAll();
            
            request.onsuccess = () => {
                this.notifications = request.result;
                this.updateLatestMessage();
                
                // 既存のアクティブな通知を再スケジュール
                this.notifications.forEach(notification => {
                    if (notification.active) {
                        if (notification.type === 'schedule') {
                            // スケジュール通知は再スケジュール
                            this.scheduleNotification(notification);
                        } else if (notification.type === 'timer') {
                            // タイマー通知は時間が残っているかチェック
                            const delay = new Date(notification.triggerTime) - new Date();
                            if (delay > 0) {
                                this.scheduleNotification(notification);
                            }
                        }
                    }
                });
                
                resolve(this.notifications);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    // 最新メッセージ更新
    updateLatestMessage() {
        const activeNotifications = this.notifications.filter(n => n.active);
        if (activeNotifications.length > 0) {
            const latest = activeNotifications[activeNotifications.length - 1];
            document.getElementById('latest-message').textContent = latest.message;
        } else {
            document.getElementById('latest-message').textContent = 'まだ伝言がありません';
        }
    }

    // 通知スケジュール
    scheduleNotification(notification) {
        console.log('通知をスケジュール:', notification);
        
        if (notification.type === 'timer') {
            const delay = new Date(notification.triggerTime) - new Date();
            console.log('タイマー遅延:', delay, 'ms (約', Math.round(delay/1000/60), '分)');
            
            if (delay > 0) {
                setTimeout(() => {
                    console.log('タイマー通知実行:', notification.message);
                    this.showNotification(notification);
                }, delay);
            } else {
                console.warn('過去の時刻が指定されました');
            }
        } else {
            this.scheduleRecurringNotification(notification);
        }
    }

    // 繰り返し通知スケジュール
    scheduleRecurringNotification(notification) {
        console.log('スケジュール通知設定:', notification);
        
        const checkAndSchedule = () => {
            const now = new Date();
            const [hours, minutes] = notification.scheduleTime.split(':').map(Number);
            const today = now.getDay();
            
            console.log('スケジュールチェック:', {
                現在曜日: today,
                対象曜日: notification.weekdays,
                時刻: `${hours}:${minutes}`
            });
            
            // 今日が対象曜日かチェック
            if (notification.weekdays.includes(today)) {
                const scheduledTime = new Date();
                scheduledTime.setHours(hours, minutes, 0, 0);
                
                const delay = scheduledTime - now;
                console.log('今日のスケジュール遅延:', delay, 'ms');
                
                if (delay > 0) {
                    // 今日の指定時刻に通知
                    setTimeout(() => {
                        console.log('スケジュール通知実行:', notification.message);
                        this.showNotification(notification);
                    }, delay);
                }
            }
            
            // 次のチェックを約1時間後にスケジュール
            setTimeout(checkAndSchedule, 60 * 60 * 1000);
        };
        
        checkAndSchedule();
    }

    // 通知表示
    showNotification(notification) {
        console.log('通知表示試行:', notification);
        
        if (!notification.active) {
            console.log('非アクティブなためスキップ');
            return;
        }

        console.log('通知権限:', Notification.permission);
        
        if (Notification.permission === 'granted') {
            try {
                const notif = new Notification(notification.character, {
                    body: notification.message,
                    icon: './images/icon-512x512.png',
                    badge: './images/icon-512x512.png',
                    tag: notification.id.toString(),
                    requireInteraction: true
                });

                console.log('通知を表示しました:', notification.character, notification.message);

                notif.onclick = () => {
                    window.focus();
                    notif.close();
                };

                if (notification.snoozeEnabled && notification.type === 'timer') {
                    setTimeout(() => {
                        console.log('スヌーズ通知実行');
                        this.showNotification(notification);
                    }, 5 * 60 * 1000);
                }
            } catch (error) {
                console.error('通知表示エラー:', error);
            }
        } else {
            console.error('通知権限がありません');
            alert('通知権限を許可してください。');
        }
    }

    // 通知一覧表示
    renderNotificationList() {
        const listContainer = document.getElementById('notification-list');
        listContainer.innerHTML = '';

        if (this.notifications.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: #666;">まだ伝言がありません</p>';
            return;
        }

        this.notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = 'notification-item';
            
            const timeDisplay = notification.type === 'timer' 
                ? `${notification.settings.minutes}分後に通知`
                : `${notification.settings.time} (${notification.settings.weekdays.map(d => ['日','月','火','水','木','金','土'][d]).join(',')})`;

            item.innerHTML = `
                <div class="notification-header">
                    <div class="notification-title">${notification.character}</div>
                    <div class="notification-toggle ${notification.active ? 'active' : ''}" data-id="${notification.id}"></div>
                </div>
                <div class="notification-content">${notification.message}</div>
                <div class="notification-time">${timeDisplay}</div>
                <div class="notification-actions">
                    <button class="edit-btn" data-id="${notification.id}">編集</button>
                    <button class="delete-btn" data-id="${notification.id}">削除</button>
                </div>
            `;

            // イベントリスナー追加
            const toggle = item.querySelector('.notification-toggle');
            toggle.addEventListener('click', () => this.toggleNotification(notification.id));

            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => this.deleteNotification(notification.id));

            listContainer.appendChild(item);
        });
    }

    // 通知ON/OFF切り替え
    async toggleNotification(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.active = !notification.active;
            await this.updateNotification(notification);
            this.renderNotificationList();
        }
    }

    // 通知削除
    async deleteNotification(id) {
        if (confirm('この伝言を削除しますか？')) {
            const transaction = this.db.transaction(['notifications'], 'readwrite');
            const objectStore = transaction.objectStore('notifications');
            await objectStore.delete(id);
            
            this.notifications = this.notifications.filter(n => n.id !== id);
            this.renderNotificationList();
            this.updateLatestMessage();
        }
    }

    // 通知更新
    async updateNotification(notification) {
        const transaction = this.db.transaction(['notifications'], 'readwrite');
        const objectStore = transaction.objectStore('notifications');
        await objectStore.put(notification);
    }

    // 通知権限リクエスト
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('通知を受け取るには、通知の許可が必要です。');
            }
        }
    }

    // Service Worker登録
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered');
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
}

// アプリ初期化
document.addEventListener('DOMContentLoaded', () => {
    new PushNotificationApp();
});