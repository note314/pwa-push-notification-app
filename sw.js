const CACHE_NAME = 'push-notification-app-v1';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './images/character1.png',
    './images/character2.png',
    './images/character3.png',
    './images/icon-512x512.png',
    './manifest.json'
];

// Service Worker インストール
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('キャッシュを開きました');
                return cache.addAll(urlsToCache);
            })
    );
});

// Service Worker フェッチ
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにある場合はそれを返す
                if (response) {
                    return response;
                }
                
                // キャッシュにない場合はネットワークから取得
                return fetch(event.request).then((response) => {
                    // レスポンスが有効でない場合はそのまま返す
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // レスポンスをクローン（ストリームは一度しか読めないため）
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

// Service Worker アクティベート
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('古いキャッシュを削除:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// プッシュ通知受信
self.addEventListener('push', (event) => {
    console.log('プッシュ通知を受信しました');
    
    let data = {};
    if (event.data) {
        data = event.data.json();
    }

    const options = {
        body: data.body || '新しい伝言があります',
        icon: './images/icon-512x512.png',
        badge: './images/icon-512x512.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: data.primaryKey || 1
        },
        actions: [
            {
                action: 'explore',
                title: '確認する',
                icon: '/images/checkmark.png'
            },
            {
                action: 'close',
                title: '閉じる',
                icon: '/images/xmark.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'プッシュ通知', options)
    );
});

// 通知クリック処理
self.addEventListener('notificationclick', (event) => {
    console.log('通知がクリックされました:', event.notification.tag, event.action);

    event.notification.close();

    if (event.action === 'explore') {
        // アプリを開く
        event.waitUntil(
            clients.matchAll().then((clientList) => {
                for (const client of clientList) {
                    if (client.url.endsWith('/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('./');
                }
            })
        );
    } else if (event.action === 'close') {
        // 何もしない（通知を閉じるだけ）
        console.log('通知を閉じました');
    } else {
        // デフォルトアクション（通知本体のクリック）
        event.waitUntil(
            clients.matchAll().then((clientList) => {
                for (const client of clientList) {
                    if (client.url.endsWith('/') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('./');
                }
            })
        );
    }
});

// 通知閉じる処理
self.addEventListener('notificationclose', (event) => {
    console.log('通知が閉じられました:', event.notification.tag);
});

// バックグラウンド同期
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('バックグラウンド同期を実行');
        event.waitUntil(doBackgroundSync());
    }
});

// バックグラウンド同期処理
async function doBackgroundSync() {
    try {
        // IndexedDBから未送信のデータを取得して処理
        console.log('バックグラウンド同期処理を実行中...');
        
        // 実際の同期処理をここに実装
        // 例：未送信の通知データをサーバーに送信
        
        return Promise.resolve();
    } catch (error) {
        console.error('バックグラウンド同期エラー:', error);
        return Promise.reject(error);
    }
}

// メッセージ受信（メインスレッドから）
self.addEventListener('message', (event) => {
    console.log('Service Workerがメッセージを受信:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    // メインスレッドに応答
    event.ports[0].postMessage({
        type: 'RESPONSE',
        message: 'Service Workerから応答'
    });
});