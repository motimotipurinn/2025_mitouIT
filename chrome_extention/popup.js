// popup.js
document.addEventListener('DOMContentLoaded', function () {
	// UI要素
	const hideKasuTweetsCheckbox = document.getElementById('hideKasuTweets');
	const autoScanCheckbox = document.getElementById('autoScan');
	const scanButton = document.getElementById('scanButton');
	const statusMessage = document.getElementById('statusMessage');
	const scannedCount = document.getElementById('scannedCount');
	const kasuCount = document.getElementById('kasuCount');
	const hiddenCount = document.getElementById('hiddenCount');
	const hideSpinner = document.getElementById('hideSpinner');
	const scanSpinner = document.getElementById('scanSpinner');

	// 保存されている設定を読み込み
	chrome.storage.sync.get({
		hideTweets: false,
		autoScan: true,
		stats: { scanned: 0, kasu: 0, hidden: 0 }
	}, function (data) {
		hideKasuTweetsCheckbox.checked = data.hideTweets;
		autoScanCheckbox.checked = data.autoScan;

		// 統計情報の表示
		updateStats(data.stats);
	});

	// アクティブなタブの現在の状態を取得
	getCurrentTabStats();

	// カス認定ツイート非表示設定の切り替え
	hideKasuTweetsCheckbox.addEventListener('change', function () {
		hideSpinner.style.display = 'inline-block';

		chrome.storage.sync.set({
			hideTweets: hideKasuTweetsCheckbox.checked
		}, function () {
			showStatusMessage(
				hideKasuTweetsCheckbox.checked
					? 'カス認定ツイートを非表示に設定しました'
					: 'カス認定ツイートにラベルのみ表示します'
			);

			// 現在のタブに変更を通知
			sendMessageToCurrentTab({
				action: 'updateHideTweets',
				hideTweets: hideKasuTweetsCheckbox.checked
			});

			setTimeout(() => {
				hideSpinner.style.display = 'none';
			}, 500);
		});
	});

	// 自動スキャン設定の切り替え
	autoScanCheckbox.addEventListener('change', function () {
		scanSpinner.style.display = 'inline-block';

		chrome.storage.sync.set({
			autoScan: autoScanCheckbox.checked
		}, function () {
			showStatusMessage(
				autoScanCheckbox.checked
					? '新しいツイートを自動的にスキャンします'
					: '自動スキャンをオフにしました'
			);

			// 現在のタブに変更を通知
			sendMessageToCurrentTab({
				action: 'updateAutoScan',
				autoScan: autoScanCheckbox.checked
			});

			setTimeout(() => {
				scanSpinner.style.display = 'none';
			}, 500);
		});
	});

	// 手動スキャンボタン
	scanButton.addEventListener('click', function () {
		scanButton.textContent = 'スキャン中...';
		scanButton.disabled = true;

		// 現在のタブにスキャンコマンドを送信
		sendMessageToCurrentTab({
			action: 'manualScan'
		}, function (response) {
			if (response && response.success) {
				showStatusMessage('スキャンを実行しました');
				// 最新の統計を取得
				getCurrentTabStats();
			} else {
				showStatusMessage('スキャンに失敗しました', 'error');
			}

			scanButton.textContent = '現在のページを今すぐスキャン';
			scanButton.disabled = false;
		});
	});

	// 現在のタブの統計情報を取得
	function getCurrentTabStats() {
		sendMessageToCurrentTab({
			action: 'getStats'
		}, function (response) {
			if (response && response.stats) {
				updateStats(response.stats);

				// ストレージにも保存
				chrome.storage.sync.set({
					stats: response.stats
				});
			}
		});
	}

	// 現在のタブにメッセージを送信するヘルパー関数
	function sendMessageToCurrentTab(message, callback) {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (tabs.length === 0) return;

			chrome.tabs.sendMessage(tabs[0].id, message, callback);
		});
	}

	// 統計情報を更新する関数
	function updateStats(stats) {
		scannedCount.textContent = `スキャン済みツイート: ${stats.scanned || 0}`;
		kasuCount.textContent = `カス認定ツイート: ${stats.kasu || 0}`;
		hiddenCount.textContent = `非表示ツイート: ${stats.hidden || 0}`;
	}

	// ステータスメッセージを表示する関数
	function showStatusMessage(message, type = 'success') {
		statusMessage.textContent = message;
		statusMessage.style.display = 'block';

		if (type === 'error') {
			statusMessage.style.backgroundColor = '#ffebee';
		} else {
			statusMessage.style.backgroundColor = '#e8f5e9';
		}

		// 3秒後に消す
		setTimeout(function () {
			statusMessage.style.display = 'none';
		}, 3000);
	}
});