// background.js (サービスワーカー)

// コンテンツスクリプトからのメッセージをリスン
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'classify') {
		const tweetText = message.text || "";
		console.log("分類リクエスト:", tweetText);

		// バックエンドAPIへPOSTリクエストを送信
		fetch('http://localhost:5000/classify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: tweetText })
		})
			.then(res => {
				if (!res.ok) {
					throw new Error(`HTTP error: ${res.status}`);
				}
				return res.json();
			})
			.then(data => {
				console.log("API応答:", data);
				// バックエンドから受け取ったデータ（スコア）をそのままコンテンツスクリプトに返す
				sendResponse({ rating: data.rating });
			})
			.catch(err => {
				console.error('バックエンド通信エラー:', err);
				sendResponse({ error: err.toString() });
			});

		// 応答を非同期で返すことを示す
		return true;
	}
});

// インストール時やアップデート時に実行される処理
chrome.runtime.onInstalled.addListener(() => {
	console.log("Twitter Kasu Detector拡張機能がインストールされました");

	// デフォルト設定を保存
	chrome.storage.sync.set({ hideTweets: false }, () => {
		console.log("デフォルト設定を保存しました");
	});
});