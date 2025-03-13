// contentScript.js
// ユーザー設定を保持する変数
let hideTweets = false;
let autoScan = true;

// 統計情報を保持する変数
let stats = {
	scanned: 0,
	kasu: 0,
	hidden: 0
};

// 拡張機能のストレージから設定を取得
chrome.storage.sync.get({
	hideTweets: false,
	autoScan: true,
	stats: { scanned: 0, kasu: 0, hidden: 0 }
}, (data) => {
	hideTweets = data.hideTweets;
	autoScan = data.autoScan;
	stats = data.stats;
});

// オプション変更（ストレージ変更）を監視し、設定変数を更新
chrome.storage.onChanged.addListener((changes, area) => {
	if (area === 'sync') {
		if (changes.hideTweets) {
			hideTweets = changes.hideTweets.newValue;
		}
		if (changes.autoScan) {
			autoScan = changes.autoScan.newValue;
		}
		if (changes.stats) {
			stats = changes.stats.newValue;
		}
	}
});

// popup.jsからのメッセージを処理するリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	// 非表示設定の更新を処理
	if (message.action === 'updateHideTweets') {
		hideTweets = message.hideTweets;
		// すでにカス認定されたツイートの表示状態を更新
		updateKasuTweetDisplay();
		sendResponse({ success: true });
	}
	// 自動スキャン設定の更新を処理
	else if (message.action === 'updateAutoScan') {
		autoScan = message.autoScan;
		sendResponse({ success: true });
	}
	// 手動スキャンコマンドを処理
	else if (message.action === 'manualScan') {
		scanAndClassifyAllTweets();
		sendResponse({ success: true });
	}
	// 統計情報を返す
	else if (message.action === 'getStats') {
		sendResponse({ stats: stats });
	}

	return true; // 非同期レスポンスを示す
});

// カス認定ツイートの表示/非表示を切り替える関数
function updateKasuTweetDisplay() {
	// すでにカス認定されたツイートを探す
	const kasuTweets = document.querySelectorAll('article[data-kasu="true"]');

	kasuTweets.forEach(tweet => {
		if (hideTweets) {
			tweet.style.display = "none";
			stats.hidden += 1;
		} else {
			tweet.style.display = "";
			stats.hidden = Math.max(0, stats.hidden - 1);
		}
	});

	// 統計情報を更新して保存
	saveStats();
}

// 統計情報を保存する関数
function saveStats() {
	chrome.storage.sync.set({ stats: stats });
}

// ツイート要素（article）をGPT評価する関数
function classifyTweet(article, tweetText) {
	console.log("評価中のツイート:", tweetText);

	// 統計情報を更新
	stats.scanned += 1;

	// すでに評価済みの場合はスキップ
	if (article.dataset.kasuRating) {
		return;
	}

	// バックグラウンドのサービスワーカーにメッセージを送り、GPT評価をリクエスト
	chrome.runtime.sendMessage({ type: 'classify', text: tweetText }, (response) => {
		if (!response) {
			console.error("レスポンスが空です");
			return;
		}

		console.log("APIレスポンス:", response);
		const rating = response.rating;

		// カス度スコアが取得できた場合のみ処理
		if (typeof rating === 'number') {
			// ツイートにカス度評価を保存（再表示/非表示の切り替え用）
			article.dataset.kasuRating = rating;

			if (rating >= 50) {
				// カス認定されたことを記録
				article.dataset.kasu = "true";
				stats.kasu += 1;

				// スコア50以上ならカス認定：ラベルを生成
				const label = document.createElement('span');
				label.textContent = `カス度: ${rating}`;
				label.className = "kasu-label";

				// スタイルを設定（赤背景・白文字など）
				label.style.padding = "2px 4px";
				label.style.marginLeft = "8px";
				label.style.backgroundColor = "red";
				label.style.color = "white";
				label.style.fontWeight = "bold";
				label.style.borderRadius = "3px";
				label.style.cursor = "pointer";
				label.title = "クリックして判定を更新";  // ツールチップ: クリックで再判定

				// ツイートを非表示にする設定が有効な場合
				if (hideTweets) {
					// ツイート要素を非表示（display:none）
					article.style.display = "none";
					stats.hidden += 1;
				} else {
					// ツイートヘッダー部分を探してラベルを追加
					const header = article.querySelector('[data-testid="User-Name"]');
					if (header) {
						header.appendChild(label);
					} else {
						// ヘッダーが見つからない場合は別の場所を試す
						article.querySelector('div[dir="auto"]')?.appendChild(label);
					}
				}

				// 統計情報を保存
				saveStats();

				// ラベルクリック時の再判定処理
				label.addEventListener('click', (e) => {
					// イベントの伝播を止める（クリックがツイート自体に伝わらないように）
					e.stopPropagation();

					// 再判定中の表示に変更
					label.textContent = "判定更新中...";
					label.style.backgroundColor = "orange";

					// バックエンドに再度問い合わせ
					chrome.runtime.sendMessage({ type: 'classify', text: tweetText }, (newResponse) => {
						if (!newResponse) {
							label.textContent = "エラー";
							label.style.backgroundColor = "gray";
							return;
						}

						const newRating = newResponse.rating;
						if (typeof newRating === 'number') {
							if (newRating >= 50) {
								label.textContent = `カス度: ${newRating} (更新)`;
								label.style.backgroundColor = "red";
							} else {
								// 再判定で50未満になった場合はラベルを緑色表示（または削除）
								label.textContent = `カス度: ${newRating} (改善)`;
								label.style.backgroundColor = "green";
							}
						} else {
							label.textContent = "エラー";
							label.style.backgroundColor = "gray";
						}
					});
				});
			}
			// スコアが50未満の場合は何もしない（カス度低いためラベル表示なし）
		}
	});
}

// ページ上の全ツイート(article要素)を走査し、未評価のものを判定
function scanAndClassifyAllTweets() {
	console.log("ツイートのスキャンを開始");

	// 自動スキャンが無効の場合（手動スキャンなら実行）
	if (!autoScan && arguments.length === 0) {
		console.log("自動スキャンが無効のため、スキャンをスキップします");
		return;
	}

	// X.comでのツイート要素を取得（X特有のdata属性を使用）
	const articles = document.querySelectorAll('article[data-testid="tweet"]');
	console.log(`${articles.length}件のツイートを検出`);

	// スキャン対象のツイート数をカウント
	let pendingTweets = 0;

	articles.forEach(article => {
		// 重複判定を避けるため、データ属性で未処理かチェック
		if (article.dataset.kasuChecked === "true") return;
		article.dataset.kasuChecked = "true";

		// ツイート本文のテキストを取得（X.com特有のdata属性を使用）
		let tweetText = "";
		const textElem = article.querySelector('div[data-testid="tweetText"]');

		if (textElem) {
			tweetText = textElem.innerText;
		} else {
			// ツイートテキストがない場合（画像や引用ツイートのみなど）の処理
			const spans = article.querySelectorAll('span');
			for (const span of spans) {
				if (span.innerText && span.innerText.length > 10) {
					tweetText = span.innerText;
					break;
				}
			}
		}

		if (!tweetText.trim()) {
			console.log("テキストが空のツイート（スキップ）");
			return;
		}

		// バックエンドへの負荷を分散させるために評価を遅延
		pendingTweets++;
		setTimeout(() => {
			// ツイート本文を評価
			classifyTweet(article, tweetText);
		}, pendingTweets * 200); // 各ツイートをずらして評価
	});
}

// X.comのページを観測し、ツイートリストをスキャンする関数
function observeTwitterTimeline() {
	console.log("X.comのタイムライン観測を開始");

	// 初期ロード時に既に存在するツイートを評価
	scanAndClassifyAllTweets();

	// ページの変更を監視（スクロールによる新ツイートの読み込みや、タブ切り替えなど）
	const observer = new MutationObserver((mutations) => {
		let shouldScan = false;

		for (const mutation of mutations) {
			// 新しいノードが追加された場合
			if (mutation.addedNodes.length > 0) {
				for (const node of mutation.addedNodes) {
					// article要素が直接追加された場合
					if (node.nodeType === 1 && node.tagName === 'ARTICLE') {
						shouldScan = true;
						break;
					}

					// article要素を含む親要素が追加された場合
					if (node.nodeType === 1 && node.querySelector('article')) {
						shouldScan = true;
						break;
					}
				}
			}

			// 既存要素の属性変更が多数ある場合（ページ内容の大幅な変更時）
			if (mutation.type === 'attributes' && mutation.target.tagName === 'DIV' &&
				mutation.target.children && mutation.target.children.length > 5) {
				shouldScan = true;
			}

			if (shouldScan) break;
		}

		// 変更があった場合のみスキャンを実行（パフォーマンス対策）
		if (shouldScan) {
			setTimeout(scanAndClassifyAllTweets, 500); // 少し遅延させてDOM更新を待つ
		}
	});

	// メインタイムラインのDOMの変化を監視（子要素の追加と属性変更）
	const mainElement = document.querySelector('main');
	if (mainElement) {
		observer.observe(mainElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['aria-label']
		});
		console.log("メインタイムラインの監視を開始");
	} else {
		// mainが見つからない場合はbodyを監視
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
		console.log("body全体の監視を開始（メインタイムラインが見つからないため）");
	}
}

// ページロード完了時にタイムライン監視を開始
if (document.readyState === 'complete') {
	observeTwitterTimeline();
} else {
	window.addEventListener('load', observeTwitterTimeline);
}

// URLの変更（X.com内の異なるページへの遷移）を検知して再スキャン
let lastUrl = location.href;
new MutationObserver(() => {
	const currentUrl = location.href;
	if (currentUrl !== lastUrl) {
		lastUrl = currentUrl;
		console.log("URL変更を検知:", currentUrl);

		// URLが変わった場合、少し待ってからスキャン（ページ読み込み待ち）
		setTimeout(() => {
			console.log("URL変更後の再スキャン");
			scanAndClassifyAllTweets();
		}, 1000);
	}
}).observe(document, { subtree: true, childList: true });