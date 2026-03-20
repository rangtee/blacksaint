// public/sw.js
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon.png', // 🌟 앱 아이콘 이미지 경로 (public 폴더 안에 있어야 함)
      badge: '/badge.png', // 안드로이드 상단바용 작은 아이콘 (선택)
      data: { url: data.url }, // 클릭 시 이동할 주소
      vibrate: [200, 100, 200]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 알림을 클릭했을 때 발생하는 이벤트
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});