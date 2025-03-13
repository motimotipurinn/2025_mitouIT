// options.js - 拡張機能の設定画面のスクリプト

// ページロード時に保存済み設定を読み込み
document.addEventListener('DOMContentLoaded', () => {
	// ストレージから設定を取得してチェックボックスに反映
	chrome.storage.sync.get({ hideTweets: false }, (data) => {
		document.getElementById('hideTweets').checked = data.hideTweets;
	});

	// 保存ボタンのクリックイベントリスナーを設定
	document.getElementById('save').addEventListener('click', saveOptions);
});

// 設定を保存する関数
function saveOptions() {
	// チェックボックスの状態を取得
	const hideTweets = document.getElementById('hideTweets').checked;

	// ストレージに設定を保存
	chrome.storage.sync.set({ hideTweets: hideTweets }, () => {
		// 保存成功時のステータス表示
		const status = document.getElementById('status');
		status.style.display = 'block';

		// 2秒後にステータス表示を消す
		setTimeout(() => {
			status.style.display = 'none';
		}, 2000);
	});
}